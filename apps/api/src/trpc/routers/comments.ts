import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure, publicProcedure } from '../trpc';

const entityTypeSchema = z.enum(['track', 'album', 'artist']);

export const commentsRouter = router({
  list: publicProcedure
    .input(z.object({ entityType: entityTypeSchema, entityId: z.string().uuid(), limit: z.number().min(1).max(50).default(20), cursor: z.string().uuid().optional() }))
    .query(async ({ ctx, input }) => {
      const items = await ctx.prisma.comment.findMany({
        where: { entityType: input.entityType, entityId: input.entityId, parentId: null, deletedAt: null },
        include: {
          user: { select: { id: true, displayName: true, avatarUrl: true } },
          replies: {
            where: { deletedAt: null },
            include: { user: { select: { id: true, displayName: true, avatarUrl: true } } },
            orderBy: { createdAt: 'asc' },
          },
          _count: { select: { replies: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
      });

      const hasMore = items.length > input.limit;
      return { items: items.slice(0, input.limit), nextCursor: hasMore ? items[input.limit - 1]?.id : undefined };
    }),

  create: protectedProcedure
    .input(z.object({ entityType: entityTypeSchema, entityId: z.string().uuid(), body: z.string().min(1).max(2000), parentId: z.string().uuid().optional() }))
    .mutation(({ ctx, input }) =>
      ctx.prisma.comment.create({
        data: { userId: ctx.user.id, ...input },
        include: { user: { select: { id: true, displayName: true, avatarUrl: true } } },
      })
    ),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const comment = await ctx.prisma.comment.findUniqueOrThrow({ where: { id: input.id }, select: { userId: true } });
      if (comment.userId !== ctx.user.id) throw new TRPCError({ code: 'FORBIDDEN' });
      await ctx.prisma.comment.update({ where: { id: input.id }, data: { deletedAt: new Date() } });
      return { success: true };
    }),
});
