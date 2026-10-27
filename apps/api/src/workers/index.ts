import 'dotenv/config';
import { logger } from '../lib/logger';
import { importHistoryWorker } from './importHistoryWorker';
import { retrainWorker } from './retrainWorker';
import { playlistExportWorker } from './playlistExportWorker';
import { searchIndexWorker } from './searchIndexWorker';

const workers = [importHistoryWorker, retrainWorker, playlistExportWorker, searchIndexWorker];

logger.info('BullMQ workers started');

for (const worker of workers) {
  worker.on('ready', () => {
    logger.info({ workerName: worker.name }, 'Worker ready');
  });

  worker.on('error', (err) => {
    logger.error({ workerName: worker.name, err }, 'Worker error');
  });
}

const shutdown = async () => {
  logger.info('Shutting down workers…');
  await Promise.all(workers.map((w) => w.close()));
  logger.info('All workers closed');
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
