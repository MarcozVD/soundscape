import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, publicProcedure, protectedProcedure } from '../trpc';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export const sharingRouter = router({
  getPublicPlaylist: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const playlist = await ctx.prisma.playlist.findFirst({
        where: { id: input.id, isPublic: true },
        include: {
          user: { select: { displayName: true, avatarUrl: true } },
          tracks: {
            orderBy: { position: 'asc' },
            include: {
              track: {
                include: {
                  trackArtists: { include: { artist: true } },
                  albumTracks: { include: { album: true } },
                  providerIds: { where: { provider: 'spotify' } },
                },
              },
            },
          },
        },
      });

      if (!playlist) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Playlist not found or not public' });
      }

      return playlist;
    }),

  generateShareLink: protectedProcedure
    .input(z.object({ playlistId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const playlist = await ctx.prisma.playlist.findFirst({
        where: { id: input.playlistId, userId: ctx.user.id },
      });

      if (!playlist) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Playlist not found' });
      }

      if (!playlist.isPublic) {
        await ctx.prisma.playlist.update({
          where: { id: input.playlistId },
          data: { isPublic: true },
        });
      }

      return {
        url: `${APP_URL}/playlists/shared/${input.playlistId}`,
        playlistId: input.playlistId,
      };
    }),
});
