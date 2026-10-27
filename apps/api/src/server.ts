import dotenv from 'dotenv';
import path from 'path';
// Load .env from monorepo root when running via ts-node-dev (CWD is apps/api)
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { appRouter } from './trpc/routers/index';
import { createContext } from './trpc/context';
import { logger } from './lib/logger';
import { rateLimiter } from './middleware/rateLimit';
import { redis } from './lib/redis';

const app = express();
const PORT = process.env.PORT ?? 3001;

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID ?? '';
const SPOTIFY_REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI ?? 'http://localhost:3000/auth/spotify/callback';
const SPOTIFY_SCOPES = [
  'user-read-email',
  'user-top-read',
  'user-read-recently-played',
  'playlist-modify-public',
  'playlist-modify-private',
].join(' ');

app.use(express.json());
const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3000',
];
app.use(
  cors({
    origin: (origin, cb) => cb(null, !origin || ALLOWED_ORIGINS.includes(origin)),
    credentials: true,
  })
);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Spotify OAuth PKCE redirect — browser navigates here to start OAuth flow
app.get('/api/auth/spotify', async (_req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');

  await redis.set(`oauth:pkce:${state}`, codeVerifier, 'EX', 300);

  const params = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    response_type: 'code',
    redirect_uri: SPOTIFY_REDIRECT_URI,
    scope: SPOTIFY_SCOPES,
    state,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
  });

  res.redirect(`https://accounts.spotify.com/authorize?${params}`);
});

app.use('/api/trpc', rateLimiter, createExpressMiddleware({ router: appRouter, createContext }));

app.listen(PORT, () => {
  logger.info({ port: PORT }, 'Soundscape API started');
  logger.info({ SPOTIFY_REDIRECT_URI }, 'Spotify OAuth config');
});

// Start BullMQ workers in-process
import('./workers/importHistoryWorker').then(({ importHistoryWorker }) => {
  importHistoryWorker.on('completed', (job) => logger.info({ jobId: job.id }, 'import job completed'));
  importHistoryWorker.on('failed', (job, err) => logger.error({ jobId: job?.id, err }, 'import job failed'));
  logger.info('importHistoryWorker started');
}).catch((err) => logger.error({ err }, 'Failed to start importHistoryWorker'));

export type { AppRouter } from './trpc/routers/index';
