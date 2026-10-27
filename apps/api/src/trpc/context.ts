import type { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import { prisma } from '@soundscape/db';
import { verifyAccessToken } from '@soundscape/auth';
import { redis } from '../lib/redis';

export async function createContext({ req }: CreateExpressContextOptions) {
  let user: { id: string; email: string | null } | null = null;

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      const payload = verifyAccessToken(token);
      // Check JWT blocklist (logout)
      const blocked = await redis.get(`session:blocklist:${payload.jti}`);
      if (!blocked) {
        user = { id: payload.sub, email: payload.email ?? null };
      }
    } catch {
      // Invalid token — proceed as unauthenticated
    }
  }

  return { user, prisma, redis };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
