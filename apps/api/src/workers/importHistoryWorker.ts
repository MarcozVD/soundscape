import { Worker, Job } from 'bullmq';
import { prisma } from '@soundscape/db';
import { decryptToken } from '@soundscape/auth';
import { getProvider } from '@soundscape/music-providers';
import type { NormalizedTrack } from '@soundscape/types';
import { redis, bullmqRedis } from '../lib/redis';
import { logger } from '../lib/logger';
import { searchIndexQueue } from './queues';

interface ImportHistoryJobData {
  userId: string;
  provider: 'spotify' | 'lastfm';
}

async function upsertTrackCatalog(track: NormalizedTrack): Promise<string> {
  // Upsert track (by ISRC if available, else upsert by provider track id)
  let dbTrack: { id: string } | null = null;

  if (track.isrc) {
    dbTrack = await prisma.track.upsert({
      where: { isrc: track.isrc },
      update: {},
      create: {
        isrc: track.isrc,
        title: track.title,
        durationMs: track.durationMs,
        explicit: track.explicit,
      },
      select: { id: true },
    });
  } else {
    // Check if provider track id exists already
    const existing = await prisma.trackProviderId.findUnique({
      where: { provider_providerTrackId: { provider: track.provider ?? 'spotify', providerTrackId: track.providerTrackId ?? track.id } },
      select: { trackId: true },
    });
    if (existing) {
      dbTrack = { id: existing.trackId };
    } else {
      dbTrack = await prisma.track.create({
        data: { title: track.title, durationMs: track.durationMs, explicit: track.explicit },
        select: { id: true },
      });
    }
  }

  const trackId = dbTrack.id;

  // Upsert provider ID
  if (track.providerTrackId && track.provider) {
    await prisma.trackProviderId.upsert({
      where: { provider_providerTrackId: { provider: track.provider, providerTrackId: track.providerTrackId } },
      update: { previewUrl: track.previewUrl, streamUrl: track.streamUrl },
      create: {
        trackId,
        provider: track.provider,
        providerTrackId: track.providerTrackId,
        previewUrl: track.previewUrl,
        streamUrl: track.streamUrl,
      },
    });
  }

  // Upsert artists and track_artists (use spotifyId as stable key, not UUID)
  for (const artist of track.artists) {
    const dbArtist = await prisma.artist.upsert({
      where: { spotifyId: artist.id },
      update: { name: artist.name, genres: artist.genres ?? [], popularity: artist.popularity },
      create: { spotifyId: artist.id, name: artist.name, genres: artist.genres ?? [], popularity: artist.popularity },
      select: { id: true },
    });

    await prisma.trackArtist.upsert({
      where: { trackId_artistId: { trackId, artistId: dbArtist.id } },
      update: {},
      create: { trackId, artistId: dbArtist.id, role: 'main' },
    });
  }

  // Upsert album if present
  if (track.album) {
    const album = track.album;
    const dbAlbum = await prisma.album.upsert({
      where: { spotifyId: album.id },
      update: { title: album.title, coverUrl: album.coverUrl },
      create: {
        spotifyId: album.id,
        title: album.title,
        albumType: album.albumType,
        coverUrl: album.coverUrl,
        totalTracks: album.totalTracks,
        releaseDate: album.releaseDate ? new Date(album.releaseDate) : undefined,
      },
      select: { id: true },
    });

    await prisma.albumTrack.upsert({
      where: { albumId_trackId: { albumId: dbAlbum.id, trackId } },
      update: {},
      create: { albumId: dbAlbum.id, trackId, trackNumber: 1 },
    });
  }

  return trackId;
}

async function processImport(job: Job<ImportHistoryJobData>): Promise<void> {
  const { userId, provider } = job.data;
  const jobId = job.id ?? 'unknown';

  const setProgress = async (status: string, processed: number, total: number) => {
    await redis.set(
      `import:${userId}:${jobId}`,
      JSON.stringify({ status, processed, total }),
      'EX',
      3600
    );
    // Also write to the key the router checks
    await redis.set(
      `import:job:${jobId}:progress`,
      JSON.stringify({ status, processed, total }),
      'EX',
      3600
    );
  };

  logger.info({ userId, provider, jobId }, 'Starting history import');
  await setProgress('fetching', 0, 0);

  // 1. Fetch provider account and decrypt tokens
  const account = await prisma.providerAccount.findFirst({
    where: { userId, provider },
    select: { accessToken: true, refreshToken: true, tokenExpiresAt: true },
  });

  if (!account) {
    throw new Error(`No ${provider} account found for user ${userId}`);
  }

  const tokens = {
    accessToken: decryptToken(account.accessToken),
    refreshToken: account.refreshToken ? decryptToken(account.refreshToken) : undefined,
    expiresAt: account.tokenExpiresAt ?? undefined,
  };

  // 2. Fetch tracks from provider
  let tracks: NormalizedTrack[] = [];

  if (provider === 'spotify') {
    const spotifyProvider = getProvider('spotify');
    const [topTracks, recentTracks] = await Promise.all([
      spotifyProvider.getUserTopTracks(tokens, 50),
      spotifyProvider.getRecentlyPlayed(tokens, 50),
    ]);

    // Deduplicate by providerTrackId
    const seen = new Set<string>();
    for (const t of [...topTracks, ...recentTracks]) {
      const key = t.providerTrackId ?? t.id;
      if (!seen.has(key)) {
        seen.add(key);
        tracks.push(t);
      }
    }
  } else {
    // lastfm — provider not yet implemented, skip gracefully
    logger.warn({ userId, provider }, 'Last.fm import not yet implemented');
    await setProgress('completed', 0, 0);
    return;
  }

  await setProgress('processing', 0, tracks.length);

  // 3. Upsert catalog and create listen_events
  const newTrackIds: string[] = [];
  let processed = 0;

  for (const track of tracks) {
    try {
      const trackId = await upsertTrackCatalog(track);
      newTrackIds.push(trackId);

      // 4. Create listen event (import)
      await prisma.listenEvent.create({
        data: {
          userId,
          trackId,
          provider,
          listenedAt: new Date(),
          source: 'import',
        },
      }).catch(() => {
        // Duplicates are fine — no unique constraint on listen_events by default
      });

      processed++;
      if (processed % 10 === 0) {
        await setProgress('processing', processed, tracks.length);
      }
    } catch (err) {
      logger.warn({ err, trackId: track.id, title: track.title }, 'Failed to upsert track during import');
    }
  }

  // 5. Queue search index job for new tracks
  if (newTrackIds.length > 0) {
    await searchIndexQueue.add('index', { trackIds: newTrackIds });
  }

  await setProgress('completed', processed, tracks.length);
  logger.info({ userId, provider, jobId, processed, total: tracks.length }, 'History import complete');
}

export const importHistoryWorker = new Worker<ImportHistoryJobData>(
  'import-history',
  processImport,
  {
    connection: bullmqRedis,
    concurrency: 3,
  }
);

importHistoryWorker.on('failed', async (job, err) => {
  logger.error({ jobId: job?.id, err }, 'importHistoryWorker job failed');
  if (job?.id) {
    await redis.set(
      `import:job:${job.id}:progress`,
      JSON.stringify({ status: 'failed', processed: 0, total: 0 }),
      'EX', 3600,
    );
  }
});
