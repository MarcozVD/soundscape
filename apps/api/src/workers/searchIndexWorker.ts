import { Worker, Job } from 'bullmq';
import { prisma } from '@soundscape/db';
import { bullmqRedis } from '../lib/redis';
import { esClient, ensureTracksIndex } from '../lib/elasticsearch';
import { logger } from '../lib/logger';

interface SearchIndexJobData {
  trackIds: string[];
}

async function processSearchIndex(job: Job<SearchIndexJobData>): Promise<void> {
  const { trackIds } = job.data;

  if (trackIds.length === 0) return;

  logger.info({ jobId: job.id, count: trackIds.length }, 'Indexing tracks into Elasticsearch');

  await ensureTracksIndex();

  // Load tracks from DB with artists and albums
  const tracks = await prisma.track.findMany({
    where: { id: { in: trackIds } },
    include: {
      trackArtists: { include: { artist: true } },
      albumTracks: {
        take: 1,
        include: { album: true },
      },
      providerIds: {
        where: { provider: 'spotify' },
        take: 1,
      },
    },
  });

  if (tracks.length === 0) {
    logger.warn({ jobId: job.id, trackIds }, 'No tracks found for indexing');
    return;
  }

  // Build bulk operations
  const operations: object[] = [];

  for (const track of tracks) {
    const artistNames = track.trackArtists.map((ta) => ta.artist.name);
    const album = track.albumTracks[0]?.album;
    const genres: string[] = track.trackArtists.flatMap((ta) => ta.artist.genres);
    const releaseYear = track.releaseDate ? new Date(track.releaseDate).getFullYear() : undefined;
    const spotifyPid = track.providerIds[0];

    const suggestInputs = [
      track.title,
      ...artistNames,
      ...(album ? [album.title] : []),
    ].filter(Boolean);

    operations.push({ index: { _index: 'tracks', _id: track.id } });
    operations.push({
      id: track.id,
      title: track.title,
      title_suggest: { input: suggestInputs },
      artists: artistNames,
      album: album?.title ?? null,
      genres: [...new Set(genres)],
      release_year: releaseYear,
      duration_ms: track.durationMs,
      explicit: track.explicit,
      isrc: track.isrc ?? null,
      preview_url: spotifyPid?.previewUrl ?? null,
      stream_url: spotifyPid?.streamUrl ?? null,
    });
  }

  const response = await esClient.bulk({ body: operations, refresh: true });

  if (response.errors) {
    const failed = response.items.filter((item) => item.index?.error);
    logger.warn({ failed: failed.length, total: tracks.length }, 'Some tracks failed to index');
  }

  logger.info({ jobId: job.id, indexed: tracks.length }, 'Tracks indexed successfully');
}

export const searchIndexWorker = new Worker<SearchIndexJobData>(
  'search-index',
  processSearchIndex,
  {
    connection: bullmqRedis,
    concurrency: 2,
  }
);

searchIndexWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'searchIndexWorker job failed');
});
