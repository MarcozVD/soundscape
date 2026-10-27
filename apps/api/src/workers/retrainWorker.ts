import { Worker, Job } from 'bullmq';
import { bullmqRedis } from '../lib/redis';
import { logger } from '../lib/logger';

interface RetrainJobData {
  triggeredBy: string;
  pendingCount: number;
}

const ML_SERVICE_URL = process.env.ML_SERVICE_URL ?? 'http://localhost:8000';
const POLL_INTERVAL_MS = 5_000;
const MAX_POLL_MS = 10 * 60 * 1_000; // 10 minutes

async function pollRetrainStatus(jobId: string): Promise<'completed' | 'failed'> {
  const deadline = Date.now() + MAX_POLL_MS;

  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

    try {
      const res = await fetch(`${ML_SERVICE_URL}/retrain/status?jobId=${jobId}`);
      if (!res.ok) {
        logger.warn({ jobId }, 'ML retrain status check returned non-ok response');
        continue;
      }

      const data = (await res.json()) as { status: string };

      if (data.status === 'completed') return 'completed';
      if (data.status === 'failed') return 'failed';

      logger.debug({ jobId, status: data.status }, 'Retrain still in progress');
    } catch (err) {
      logger.warn({ err, jobId }, 'Error polling retrain status');
    }
  }

  throw new Error(`Retrain job ${jobId} timed out after ${MAX_POLL_MS / 60000} minutes`);
}

async function processRetrain(job: Job<RetrainJobData>): Promise<void> {
  const { triggeredBy, pendingCount } = job.data;

  logger.info({ jobId: job.id, triggeredBy, pendingCount }, 'Starting ML retrain');

  // 1. Trigger retrain
  const res = await fetch(`${ML_SERVICE_URL}/retrain`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ triggeredBy, pendingCount }),
  });

  if (!res.ok) {
    throw new Error(`ML retrain trigger failed with status ${res.status}`);
  }

  const data = (await res.json()) as { jobId?: string };
  const mlJobId = data.jobId ?? job.id ?? 'unknown';

  logger.info({ mlJobId, triggeredBy }, 'ML retrain job started, polling for completion');

  // 2. Poll until done
  const finalStatus = await pollRetrainStatus(mlJobId);

  if (finalStatus === 'failed') {
    throw new Error(`ML retrain job ${mlJobId} failed`);
  }

  // 3. Reset pending counter on success
  await redis.set('retrain:pending:count', '0');

  logger.info({ mlJobId, triggeredBy }, 'ML retrain completed successfully');
}

export const retrainWorker = new Worker<RetrainJobData>(
  'retrain-trigger',
  processRetrain,
  {
    connection: bullmqRedis,
    concurrency: 1, // Only one retrain at a time
  }
);

retrainWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'retrainWorker job failed');
});
