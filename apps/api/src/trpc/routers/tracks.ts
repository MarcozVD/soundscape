import { z } from 'zod';
import { router, publicProcedure } from '../trpc';

export const tracksRouter = router({
  search: publicProcedure
    .input(z.object({ q: z.string().min(1).max(200), limit: z.number().min(1).max(20).default(8) }))
    .query(async ({ ctx, input }) => {
      const q = input.q.trim();
      return ctx.prisma.track.findMany({
        where: {
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { trackArtists: { some: { artist: { name: { contains: q, mode: 'insensitive' } } } } },
          ],
        },
        include: {
          trackArtists: {
            include: { artist: { select: { name: true, genres: true } } },
            take: 1,
          },
          albumTracks: {
            include: { album: { select: { coverUrl: true } } },
            take: 1,
          },
        },
        take: input.limit,
        orderBy: { listenEvents: { _count: 'desc' } },
      });
    }),

  getById: publicProcedure.input(z.object({ id: z.string().uuid() })).query(async ({ ctx, input }) => {
    return ctx.prisma.track.findUniqueOrThrow({
      where: { id: input.id },
      include: {
        trackArtists: { include: { artist: true } },
        albumTracks: { include: { album: true } },
        providerIds: true,
      },
    });
  }),

  getAlbum: publicProcedure.input(z.object({ id: z.string().uuid() })).query(async ({ ctx, input }) => {
    return ctx.prisma.album.findUniqueOrThrow({
      where: { id: input.id },
      include: {
        albumArtists: { include: { artist: true } },
        albumTracks: { orderBy: { trackNumber: 'asc' }, include: { track: { include: { providerIds: true } } } },
      },
    });
  }),

  getArtist: publicProcedure.input(z.object({ id: z.string().uuid() })).query(async ({ ctx, input }) => {
    return ctx.prisma.artist.findUniqueOrThrow({
      where: { id: input.id },
      include: {
        trackArtists: {
          include: { track: { include: { providerIds: true } } },
          take: 10,
        },
        albumArtists: { include: { album: true } },
      },
    });
  }),
});
