import { Router } from 'express';
import { randomBytes } from 'crypto';
import { redis } from '../lib/redis';

export const oauthRouter = Router();

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID ?? '';
const SPOTIFY_REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI ?? 'http://localhost:3000/auth/spotify/callback';
const SPOTIFY_SCOPES = [
  'user-read-private',
  'user-read-email',
  'user-library-read',
  'user-read-recently-played',
  'playlist-read-private',
  'playlist-read-collaborative',
  'playlist-modify-public',
  'playlist-modify-private',
].join(' ');

// GET /api/auth/spotify — builds Spotify auth URL with PKCE and redirects
oauthRouter.get('/spotify', async (req, res) => {
  try {
    // Generate PKCE code verifier and challenge
    const codeVerifier = randomBytes(64).toString('base64url');
    const state = randomBytes(16).toString('hex');

    // Store code_verifier in Redis with state as key (5 min TTL)
    await redis.set(`oauth:pkce:${state}`, codeVerifier, 'EX', 60 * 5);

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: SPOTIFY_CLIENT_ID,
      scope: SPOTIFY_SCOPES,
      redirect_uri: SPOTIFY_REDIRECT_URI,
      state,
      code_challenge_method: 'S256',
      code_challenge: await computeCodeChallenge(codeVerifier),
    });

    res.redirect(`https://accounts.spotify.com/authorize?${params.toString()}`);
  } catch (err) {
    res.status(500).json({ error: 'Failed to initiate OAuth flow' });
  }
});

async function computeCodeChallenge(verifier: string): Promise<string> {
  const { createHash } = await import('crypto');
  return createHash('sha256').update(verifier).digest('base64url');
}
