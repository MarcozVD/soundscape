import { router, protectedProcedure } from '../trpc';
import { mlClient } from '../../lib/mlClient';

const ML_SERVICE_URL = process.env.ML_SERVICE_URL ?? 'http://localhost:8000';

export const adminRouter = router({
  stats: protectedProcedure.query(async ({ ctx }) => {
    const [users, tracks, listenEvents, ratings] = await Promise.all([
      ctx.prisma.user.count(),
      ctx.prisma.track.count(),
      ctx.prisma.listenEvent.count(),
      ctx.prisma.rating.count(),
    ]);

    return { users, tracks, listenEvents, ratings };
  }),

  mlHealth: protectedProcedure.query(async () => {
    try {
      const res = await fetch(`${ML_SERVICE_URL}/health`, {
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(5000),
      });

      if (!res.ok) {
        return {
          status: 'unreachable' as const,
          modelVersion: null,
          lastTrainedAt: null,
          precisionAt10: null,
          coverage: null,
        };
      }

      const data = await res.json() as {
        status: string;
        model_version?: string;
        last_trained_at?: string;
        metrics?: {
          precision_at_10?: number;
          coverage?: number;
        };
      };

      return {
        status: data.status as string,
        modelVersion: data.model_version ?? null,
        lastTrainedAt: data.last_trained_at ? new Date(data.last_trained_at) : null,
        precisionAt10: data.metrics?.precision_at_10 ?? null,
        coverage: data.metrics?.coverage ?? null,
      };
    } catch {
      return {
        status: 'unreachable' as const,
        modelVersion: null,
        lastTrainedAt: null,
        precisionAt10: null,
        coverage: null,
      };
    }
  }),
});
