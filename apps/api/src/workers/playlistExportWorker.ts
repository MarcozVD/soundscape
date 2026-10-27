import { Worker, Job } from 'bullmq';
import { prisma } from '@soundscape/db';
import { decryptToken } from '@soundscape/auth';
import { getProvider } from '@soundscape/music-providers';
import type { NormalizedTrack } from '@soundscape/types';
import { bullmqRedis } from '../lib/redis';
import { logger } from '../lib/logger';

interface PlaylistExportJobData {
  exportId: string;
  // These may be supplied directly or resolved via exportId
  userId?: string;
  playlistId?: string;
  provider?: 'spotify' | 'apple_music';
}

async function processPlaylistExport(job: Job<PlaylistExportJobData>): Promise<void> {
  const { exportId } = job.data;

  // 1. Load export record to get all required fields
  const exportRecord = await prisma.playlistExport.findUniqueOrThrow({
    where: { id: exportId },
    select: {
      id: true,
      playlistId: true,
      userId: true,
      provider: true,
      playlist: {
        select: {
          title: true,
          description: true,
          isPublic: true,
          tracks: {
            orderBy: { position: 'asc' },
            include: {
              track: {
                include: {
                  providerIds: true,
                  trackArtists: { include: { artist: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  const { userId, provider, playlist } = exportRecord;

  logger.info({ exportId, userId, provider, playlistId: exportRecord.playlistId }, 'Starting playlist export');

  // 2. Update status to in_progress
  await prisma.playlistExport.update({
    where: { id: exportId },
    data: { status: 'in_progress' },
  });

  try {
    // 3. Get user's provider tokens (decrypt)
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

    // 4. Build normalized tracks list for export
    const tracks: NormalizedTrack[] = playlist.tracks.map(({ track }) => {
      const spotifyId = track.providerIds.find((p) => p.provider === 'spotify');
      const primaryArtist = track.trackArtists[0]?.artist;

      return {
        id: track.id,
        isrc: track.isrc ?? undefined,
        title: track.title,
        durationMs: track.durationMs ?? undefined,
        explicit: track.explicit,
        artists: track.trackArtists.map((ta) => ({
          id: ta.artist.id,
          name: ta.artist.name,
          genres: ta.artist.genres,
          popularity: ta.artist.popularity ?? undefined,
        })),
        providerTrackId: spotifyId?.providerTrackId,
        provider: spotifyId ? 'spotify' : undefined,
        previewUrl: spotifyId?.previewUrl ?? undefined,
        streamUrl: spotifyId?.streamUrl ?? undefined,
      };
    });

    // 5. Call provider export
    const providerAdapter = getProvider(provider as 'spotify');
    const result = await providerAdapter.exportPlaylist(tokens, tracks, {
      playlistName: playlist.title,
      description: playlist.description ?? undefined,
      isPublic: playlist.isPublic,
    });

    // 6. Update export record as done
    await prisma.playlistExport.update({
      where: { id: exportId },
      data: {
        status: 'done',
        providerPlaylistId: result.providerPlaylistId,
        tracksExported: result.tracksExported,
        exportedAt: new Date(),
      },
    });

    logger.info(
      { exportId, provider, tracksExported: result.tracksExported, url: result.url },
      'Playlist export completed'
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ exportId, err }, 'Playlist export failed');

    await prisma.playlistExport.update({
      where: { id: exportId },
      data: { status: 'failed', errorMessage: message },
    });

    throw err;
  }
}

export const playlistExportWorker = new Worker<PlaylistExportJobData>(
  'playlist-export',
  processPlaylistExport,
  {
    connection: bullmqRedis,
    concurrency: 5,
  }
);

playlistExportWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'playlistExportWorker job failed');
});
