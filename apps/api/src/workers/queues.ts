import { Queue } from 'bullmq';
import { bullmqRedis } from '../lib/redis';

const connection = bullmqRedis;

export const importHistoryQueue = new Queue('import-history', { connection });
export const retrainQueue = new Queue('retrain-trigger', { connection });
export const playlistExportQueue = new Queue('playlist-export', { connection });
export const searchIndexQueue = new Queue('search-index', { connection });

/**
 * Queue one or more tracks for Elasticsearch indexing.
 * Called after tracks are created/upserted during history import.
 */
export async function queueTrackIndexing(trackIds: string[]): Promise<void> {
  if (trackIds.length === 0) return;
  await searchIndexQueue.addBulk(
    trackIds.map((id) => ({
      name: 'index-track',
      data: { trackId: id },
      opts: { removeOnComplete: 100, removeOnFail: 50 },
    })),
  );
}
