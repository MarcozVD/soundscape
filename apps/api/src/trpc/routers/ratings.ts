import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { retrainQueue } from '../../workers/queues';

const RETRAIN_THRESHOLD = 50;

export const ratingsRouter = router({
  submit: protectedProcedure
    .input(z.object({ trackId: z.string().uuid(), stars: z.number().int().min(1).max(5), feedbackText: z.string().max(500).optional() }))
    .mutation(async ({ ctx, input }) => {
      const rating = await ctx.prisma.rating.upsert({
        where: { userId_trackId: { userId: ctx.user.id, trackId: input.trackId } },
        update: { stars: input.stars, feedbackText: input.feedbackText, retrainIngested: false },
        create: { userId: ctx.user.id, ...input, retrainIngested: false },
      });

      // Increment pending-retrain counter and trigger if threshold reached
      const pendingCount = await ctx.redis.incr('retrain:pending:count');
      if (pendingCount >= RETRAIN_THRESHOLD) {
        await ctx.redis.set('retrain:pending:count', '0');
        await retrainQueue.add('retrain', { triggeredBy: 'threshold' }, { jobId: 'retrain-singleton', removeOnComplete: 5 });
      }

      return rating;
    }),

  list: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(50), offset: z.number().default(0) }))
    .query(({ ctx, input }) =>
      ctx.prisma.rating.findMany({
        where: { userId: ctx.user.id },
        include: { track: { include: { providerIds: true, trackArtists: { include: { artist: true } }, albumTracks: { include: { album: true }, take: 1 } } } },
        orderBy: { ratedAt: 'desc' },
        take: input.limit,
        skip: input.offset,
      })
    ),
});
