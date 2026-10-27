import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure, publicProcedure } from '../trpc';
import { playlistExportQueue } from '../../workers/queues';

export const playlistsRouter = router({
  list: protectedProcedure.query(({ ctx }) =>
    ctx.prisma.playlist.findMany({
      where: { userId: ctx.user.id },
      include: { _count: { select: { tracks: true } } },
      orderBy: { updatedAt: 'desc' },
    })
  ),

  getById: publicProcedure.input(z.object({ id: z.string().uuid() })).query(async ({ ctx, input }) => {
    const playlist = await ctx.prisma.playlist.findUniqueOrThrow({
      where: { id: input.id },
      include: {
        tracks: {
          orderBy: { position: 'asc' },
          include: { track: { include: { providerIds: true, trackArtists: { include: { artist: true } } } } },
        },
        user: { select: { id: true, displayName: true, avatarUrl: true } },
      },
    });
    if (!playlist.isPublic && playlist.userId !== ctx.user?.id) {
      throw new TRPCError({ code: 'FORBIDDEN' });
    }
    return playlist;
  }),

  create: protectedProcedure
    .input(z.object({ title: z.string().min(1).max(100), description: z.string().max(500).optional(), isPublic: z.boolean().default(false) }))
    .mutation(({ ctx, input }) =>
      ctx.prisma.playlist.create({ data: { ...input, userId: ctx.user.id } })
    ),

  update: protectedProcedure
    .input(z.object({ id: z.string().uuid(), title: z.string().min(1).max(100).optional(), description: z.string().max(500).optional(), isPublic: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      await assertPlaylistOwner(ctx, id);
      return ctx.prisma.playlist.update({ where: { id }, data });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await assertPlaylistOwner(ctx, input.id);
      await ctx.prisma.playlist.delete({ where: { id: input.id } });
      return { success: true };
    }),

  addTrack: protectedProcedure
    .input(z.object({ playlistId: z.string().uuid(), trackId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await assertPlaylistOwner(ctx, input.playlistId);
      const count = await ctx.prisma.playlistTrack.count({ where: { playlistId: input.playlistId } });
      return ctx.prisma.playlistTrack.create({
        data: { playlistId: input.playlistId, trackId: input.trackId, position: count + 1 },
      });
    }),

  removeTrack: protectedProcedure
    .input(z.object({ playlistId: z.string().uuid(), trackId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await assertPlaylistOwner(ctx, input.playlistId);
      await ctx.prisma.playlistTrack.delete({ where: { playlistId_trackId: input } });
      return { success: true };
    }),

  export: protectedProcedure
    .input(z.object({ playlistId: z.string().uuid(), provider: z.enum(['spotify', 'apple_music']) }))
    .mutation(async ({ ctx, input }) => {
      await assertPlaylistOwner(ctx, input.playlistId);
      const tracksTotal = await ctx.prisma.playlistTrack.count({ where: { playlistId: input.playlistId } });

      const exportRecord = await ctx.prisma.playlistExport.create({
        data: { playlistId: input.playlistId, userId: ctx.user.id, provider: input.provider, tracksTotal },
      });

      await playlistExportQueue.add('export', { exportId: exportRecord.id });
      return { exportId: exportRecord.id };
    }),

  getExportStatus: protectedProcedure
    .input(z.object({ exportId: z.string().uuid() }))
    .query(({ ctx, input }) =>
      ctx.prisma.playlistExport.findUniqueOrThrow({ where: { id: input.exportId } })
    ),
});

async function assertPlaylistOwner(ctx: { user: { id: string }; prisma: typeof import('@soundscape/db').prisma }, playlistId: string) {
  const playlist = await ctx.prisma.playlist.findUniqueOrThrow({ where: { id: playlistId }, select: { userId: true } });
  if (playlist.userId !== ctx.user.id) throw new TRPCError({ code: 'FORBIDDEN' });
}
