import { z } from 'zod';
import { randomBytes, createHash } from 'crypto';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure, publicProcedure } from '../trpc';
import { importHistoryQueue } from '../../workers/queues';
import { issueTokens, encryptToken } from '@soundscape/auth';

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID ?? '';
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET ?? '';
const SPOTIFY_REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI ?? 'http://localhost:3000/auth/spotify/callback';
const SPOTIFY_SCOPES = [
  'user-read-private', 'user-read-email', 'user-library-read',
  'user-read-recently-played', 'user-top-read',
  'playlist-read-private', 'playlist-modify-public', 'playlist-modify-private',
].join(' ');

export const providersRouter = router({
  // Step 1: authenticated user requests the Spotify auth URL.
  // userId is stored in Redis alongside the PKCE verifier so the callback
  // can complete without needing a JWT from localStorage.
  initiateSpotifyConnect: protectedProcedure.mutation(async ({ ctx }) => {
    const state = randomBytes(16).toString('hex');
    const codeVerifier = randomBytes(32).toString('base64url');
    const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');

    await ctx.redis.set(
      `oauth:pkce:${state}`,
      JSON.stringify({ codeVerifier, userId: ctx.user.id }),
      'EX', 300,
    );

    const params = new URLSearchParams({
      client_id: SPOTIFY_CLIENT_ID,
      response_type: 'code',
      redirect_uri: SPOTIFY_REDIRECT_URI,
      scope: SPOTIFY_SCOPES,
      state,
      code_challenge_method: 'S256',
      code_challenge: codeChallenge,
    });

    return { url: `https://accounts.spotify.com/authorize?${params}` };
  }),

  // Step 2: callback page (public, no auth header available) exchanges the code.
  completeSpotifyConnect: publicProcedure
    .input(z.object({ code: z.string(), state: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const stored = await ctx.redis.get(`oauth:pkce:${input.state}`);
      if (!stored) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid or expired state parameter' });
      }
      await ctx.redis.del(`oauth:pkce:${input.state}`);

      const { codeVerifier, userId } = JSON.parse(stored) as { codeVerifier: string; userId: string };

      const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: input.code,
          redirect_uri: SPOTIFY_REDIRECT_URI,
          client_id: SPOTIFY_CLIENT_ID,
          client_secret: SPOTIFY_CLIENT_SECRET,
          code_verifier: codeVerifier,
        }),
      });

      if (!tokenRes.ok) {
        const body = await tokenRes.text();
        throw new TRPCError({ code: 'BAD_REQUEST', message: `Spotify token exchange failed: ${body}` });
      }

      const spotifyTokens = await tokenRes.json() as {
        access_token: string; refresh_token?: string; expires_in: number; scope: string;
      };

      const profileRes = await fetch('https://api.spotify.com/v1/me', {
        headers: { Authorization: `Bearer ${spotifyTokens.access_token}` },
      });
      if (!profileRes.ok) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch Spotify profile' });
      }
      const profile = await profileRes.json() as { id: string; email?: string; display_name?: string };

      const tokenExpiresAt = new Date(Date.now() + spotifyTokens.expires_in * 1000);

      await ctx.prisma.providerAccount.upsert({
        where: { provider_providerUid: { provider: 'spotify', providerUid: profile.id } },
        update: {
          userId,
          accessToken: encryptToken(spotifyTokens.access_token),
          refreshToken: spotifyTokens.refresh_token ? encryptToken(spotifyTokens.refresh_token) : undefined,
          tokenExpiresAt,
          scope: spotifyTokens.scope,
          rawProfile: profile as object,
          updatedAt: new Date(),
        },
        create: {
          userId,
          provider: 'spotify',
          providerUid: profile.id,
          accessToken: encryptToken(spotifyTokens.access_token),
          refreshToken: spotifyTokens.refresh_token ? encryptToken(spotifyTokens.refresh_token) : undefined,
          tokenExpiresAt,
          scope: spotifyTokens.scope,
          rawProfile: profile as object,
        },
      });

      const user = await ctx.prisma.user.findUniqueOrThrow({ where: { id: userId } });
      const tokens = issueTokens({ sub: user.id, email: user.email ?? undefined });
      await ctx.redis.set(`session:refresh:${tokens.refreshTokenId}`, user.id, 'EX', 60 * 60 * 24 * 7);

      return { user: { id: user.id, email: user.email }, ...tokens };
    }),

  connectSpotify: protectedProcedure
    .input(z.object({ code: z.string(), state: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Retrieve PKCE code_verifier from Redis
      const codeVerifier = await ctx.redis.get(`oauth:pkce:${input.state}`);
      if (!codeVerifier) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid or expired state parameter' });
      }
      await ctx.redis.del(`oauth:pkce:${input.state}`);

      // Exchange authorization code for Spotify tokens
      const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: input.code,
          redirect_uri: SPOTIFY_REDIRECT_URI,
          client_id: SPOTIFY_CLIENT_ID,
          client_secret: SPOTIFY_CLIENT_SECRET,
          code_verifier: codeVerifier,
        }),
      });

      if (!tokenRes.ok) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Failed to exchange Spotify code' });
      }

      const spotifyTokens = await tokenRes.json() as {
        access_token: string;
        refresh_token?: string;
        expires_in: number;
        scope: string;
      };

      // Fetch Spotify profile to get providerUid
      const profileRes = await fetch('https://api.spotify.com/v1/me', {
        headers: { Authorization: `Bearer ${spotifyTokens.access_token}` },
      });

      if (!profileRes.ok) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch Spotify profile' });
      }

      const profile = await profileRes.json() as { id: string; email?: string; display_name?: string };

      const tokenExpiresAt = new Date(Date.now() + spotifyTokens.expires_in * 1000);

      // Upsert provider account with encrypted tokens
      await ctx.prisma.providerAccount.upsert({
        where: { provider_providerUid: { provider: 'spotify', providerUid: profile.id } },
        update: {
          userId: ctx.user.id,
          accessToken: encryptToken(spotifyTokens.access_token),
          refreshToken: spotifyTokens.refresh_token ? encryptToken(spotifyTokens.refresh_token) : undefined,
          tokenExpiresAt,
          scope: spotifyTokens.scope,
          rawProfile: profile as object,
          updatedAt: new Date(),
        },
        create: {
          userId: ctx.user.id,
          provider: 'spotify',
          providerUid: profile.id,
          accessToken: encryptToken(spotifyTokens.access_token),
          refreshToken: spotifyTokens.refresh_token ? encryptToken(spotifyTokens.refresh_token) : undefined,
          tokenExpiresAt,
          scope: spotifyTokens.scope,
          rawProfile: profile as object,
        },
      });

      // Issue our own app tokens for the user
      const tokens = issueTokens({ sub: ctx.user.id, email: ctx.user.email ?? undefined });
      await ctx.redis.set(`session:refresh:${tokens.refreshTokenId}`, ctx.user.id, 'EX', 60 * 60 * 24 * 7);

      return {
        user: { id: ctx.user.id, email: ctx.user.email },
        ...tokens,
      };
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    const accounts = await ctx.prisma.providerAccount.findMany({
      where: { userId: ctx.user.id },
      select: { id: true, provider: true, createdAt: true },
    });

    // Check which providers have actual imported listen_events in the DB
    const importCounts = await ctx.prisma.listenEvent.groupBy({
      by: ['provider'],
      where: { userId: ctx.user.id, source: 'import' },
      _count: { id: true },
    });
    const importedSet = new Set(importCounts.map((r) => r.provider));

    return accounts.map((a) => ({ ...a, hasImported: importedSet.has(a.provider) }));
  }),

  disconnect: protectedProcedure
    .input(z.object({ provider: z.enum(['spotify', 'apple_music', 'lastfm', 'youtube']) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.providerAccount.deleteMany({ where: { userId: ctx.user.id, provider: input.provider } });
      return { success: true };
    }),

  importHistory: protectedProcedure
    .input(z.object({ provider: z.enum(['spotify', 'lastfm']) }))
    .mutation(async ({ ctx, input }) => {
      const job = await importHistoryQueue.add('import', { userId: ctx.user.id, provider: input.provider });
      return { jobId: job.id };
    }),

  getImportStatus: protectedProcedure
    .input(z.object({ jobId: z.string() }))
    .query(async ({ ctx, input }) => {
      const progress = await ctx.redis.get(`import:job:${input.jobId}:progress`);
      return { progress: progress ? JSON.parse(progress) : null };
    }),
});
