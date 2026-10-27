import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import { esClient } from '../../lib/elasticsearch';

export const searchRouter = router({
  query: publicProcedure
    .input(z.object({ q: z.string().min(1).max(200), limit: z.number().min(1).max(50).default(20) }))
    .query(async ({ input }) => {
      const response = await esClient.search({
        index: 'tracks',
        body: {
          query: {
            multi_match: {
              query: input.q,
              fields: ['title^3', 'artists^2', 'album'],
              fuzziness: 'AUTO',
            },
          },
          size: input.limit,
        },
      });

      return response.hits.hits.map((hit) => ({
        id: hit._id,
        score: hit._score,
        ...(hit._source as Record<string, unknown>),
      }));
    }),

  suggestions: publicProcedure
    .input(z.object({ prefix: z.string().min(1).max(100) }))
    .query(async ({ input }) => {
      const response = await esClient.search({
        index: 'tracks',
        body: {
          suggest: {
            track_suggest: {
              prefix: input.prefix,
              completion: { field: 'title_suggest', size: 10 },
            },
          },
        },
      });

      const options = (response.suggest as Record<string, unknown[]> | undefined)?.['track_suggest']?.[0] as
        | { options: { text: string; _id: string }[] }
        | undefined;

      return options?.options?.map((o) => ({ text: o.text, id: o._id })) ?? [];
    }),
});
