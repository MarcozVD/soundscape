import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { mlClient } from '../../lib/mlClient';

const CACHE_TTL_SECONDS = 60 * 60 * 6; // 6 hours

interface HydratedTrack {
  id: string;
  title: string;
  score: number;
  artistName: string | null;
  albumTitle: string | null;
  coverUrl: string | null;
  previewUrl: string | null;
  durationMs: number | null;
}

export const recommendationsRouter = router({
  forUser: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(20) }))
    .query(async ({ ctx, input }) => {
      const cacheKey = `user:recs:${ctx.user.id}:hydrated`;
      const cached = await ctx.redis.get(cacheKey);
      if (cached) return JSON.parse(cached) as { tracks: HydratedTrack[] };

      const result = await mlClient.getRecommendations(ctx.user.id, input.limit);
      if (!result || result.tracks.length === 0) return { tracks: [] as HydratedTrack[] };

      const trackIds = result.tracks.map((t) => t.trackId);
      const scoreMap = new Map(result.tracks.map((t) => [t.trackId, t.score]));

      const tracks = await ctx.prisma.track.findMany({
        where: { id: { in: trackIds } },
        include: {
          providerIds: { select: { provider: true, providerTrackId: true, previewUrl: true } },
          trackArtists: { include: { artist: { select: { name: true } } }, take: 1 },
          albumTracks: { include: { album: { select: { title: true, coverUrl: true } } }, take: 1 },
        },
      });

      const hydrated: HydratedTrack[] = tracks.map((t) => ({
        id: t.id,
        title: t.title,
        score: scoreMap.get(t.id) ?? 0,
        artistName: t.trackArtists[0]?.artist.name ?? null,
        albumTitle: t.albumTracks[0]?.album.title ?? null,
        coverUrl: t.albumTracks[0]?.album.coverUrl ?? null,
        previewUrl: (t.providerIds as Array<{ provider: string; previewUrl: string | null }>)
          .find((p) => p.provider === 'spotify')?.previewUrl ?? null,
        durationMs: t.durationMs,
      }));

      // Sort by original ML score order
      hydrated.sort((a, b) => (scoreMap.get(b.id) ?? 0) - (scoreMap.get(a.id) ?? 0));

      const payload = { tracks: hydrated };
      await ctx.redis.set(cacheKey, JSON.stringify(payload), 'EX', CACHE_TTL_SECONDS);
      return payload;
    }),

  refresh: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.redis.del(`user:recs:${ctx.user.id}:hydrated`);
    return { ok: true };
  }),

  seed: protectedProcedure
    .input(z.object({
      genres: z.array(z.string()).min(0).max(20).default([]),
      artistNames: z.array(z.string()).max(20).default([]),
      trackIds: z.array(z.string().uuid()).max(100).default([]),
    }))
    .mutation(async ({ ctx, input }) => {
      const now = new Date();
      type Event = { userId: string; trackId: string; listenedAt: Date; source: string };
      const events: Event[] = [];

      // 1. Direct track selections — highest intent signal
      if (input.trackIds.length > 0) {
        const pickedTracks = await ctx.prisma.track.findMany({
          where: { id: { in: input.trackIds } },
          include: {
            trackArtists: {
              include: { artist: { select: { genres: true } } },
            },
          },
        });

        for (const t of pickedTracks) {
          // Add 3 listen events per picked track to boost its weight
          for (let i = 0; i < 3; i++) {
            events.push({ userId: ctx.user.id, trackId: t.id, listenedAt: now, source: 'onboarding' });
          }

          // Auto-expand: find more tracks from the same artists
          for (const ta of t.trackArtists) {
            const moreTracks = await ctx.prisma.track.findMany({
              where: {
                trackArtists: { some: { artistId: ta.artistId } },
                id: { not: t.id },
              },
              take: 3,
              orderBy: { listenEvents: { _count: 'desc' } },
            });
            for (const mt of moreTracks) {
              events.push({ userId: ctx.user.id, trackId: mt.id, listenedAt: now, source: 'onboarding' });
            }
          }
        }
      }

      // 2. Artist names
      for (const artistName of input.artistNames) {
        const artist = await ctx.prisma.artist.findFirst({
          where: { name: { equals: artistName, mode: 'insensitive' } },
          include: { trackArtists: { take: 5, include: { track: true } } },
        });
        if (artist) {
          for (const ta of artist.trackArtists) {
            events.push({ userId: ctx.user.id, trackId: ta.trackId, listenedAt: now, source: 'onboarding' });
          }
        }
      }

      // 3. Genre-based tracks
      const effectiveGenres = new Set(input.genres.map((g) => g.toLowerCase()));

      // Also extract genres from picked tracks' artists
      if (input.trackIds.length > 0) {
        const pickedArtists = await ctx.prisma.artist.findMany({
          where: { trackArtists: { some: { track: { id: { in: input.trackIds } } } } },
          select: { genres: true },
        });
        for (const a of pickedArtists) {
          for (const g of a.genres) effectiveGenres.add(g.toLowerCase());
        }
      }

      for (const genre of effectiveGenres) {
        const artists = await ctx.prisma.artist.findMany({
          where: { genres: { has: genre } },
          take: 4,
          include: { trackArtists: { take: 3, include: { track: true } } },
        });
        for (const artist of artists) {
          for (const ta of artist.trackArtists) {
            events.push({ userId: ctx.user.id, trackId: ta.trackId, listenedAt: now, source: 'onboarding' });
          }
        }
      }

      if (events.length > 0) {
        await ctx.prisma.listenEvent.createMany({ data: events, skipDuplicates: true });
      }

      await ctx.redis.del(`user:recs:${ctx.user.id}:hydrated`);
      return { seeded: events.length };
    }),
});
