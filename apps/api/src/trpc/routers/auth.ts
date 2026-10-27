import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import bcrypt from 'bcryptjs';
import { router, publicProcedure, protectedProcedure } from '../trpc';
import { issueTokens, verifyRefreshToken, revokeAccessToken } from '@soundscape/auth';

export const authRouter = router({
  register: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(8),
        displayName: z.string().min(1).max(50),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.user.findUnique({ where: { email: input.email } });
      if (existing) throw new TRPCError({ code: 'CONFLICT', message: 'Email already in use' });

      const passwordHash = await bcrypt.hash(input.password, 12);
      const user = await ctx.prisma.user.create({
        data: { email: input.email, passwordHash, displayName: input.displayName },
        select: { id: true, email: true, displayName: true, avatarUrl: true },
      });

      const tokens = issueTokens({ sub: user.id, email: user.email ?? undefined });
      await ctx.redis.set(`session:refresh:${tokens.refreshTokenId}`, user.id, 'EX', 60 * 60 * 24 * 7);
      return { user, ...tokens };
    }),

  login: publicProcedure
    .input(z.object({ email: z.string().email(), password: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findUnique({ where: { email: input.email } });
      if (!user?.passwordHash) throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid credentials' });

      const valid = await bcrypt.compare(input.password, user.passwordHash);
      if (!valid) throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid credentials' });

      const tokens = issueTokens({ sub: user.id, email: user.email ?? undefined });
      await ctx.redis.set(`session:refresh:${tokens.refreshTokenId}`, user.id, 'EX', 60 * 60 * 24 * 7);
      return {
        user: { id: user.id, email: user.email, displayName: user.displayName, avatarUrl: user.avatarUrl },
        ...tokens,
      };
    }),

  refresh: publicProcedure
    .input(z.object({ refreshToken: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { tokenId } = verifyRefreshToken(input.refreshToken);
      const userId = await ctx.redis.get(`session:refresh:${tokenId}`);
      if (!userId) throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Refresh token expired' });

      const user = await ctx.prisma.user.findUniqueOrThrow({ where: { id: userId } });
      await ctx.redis.del(`session:refresh:${tokenId}`);

      const tokens = issueTokens({ sub: user.id, email: user.email ?? undefined });
      await ctx.redis.set(`session:refresh:${tokens.refreshTokenId}`, user.id, 'EX', 60 * 60 * 24 * 7);
      return tokens;
    }),

  me: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.prisma.user.findUniqueOrThrow({
      where: { id: ctx.user.id },
      select: {
        id: true, email: true, displayName: true, avatarUrl: true, createdAt: true,
        providerAccounts: { select: { provider: true } },
      },
    });
    return user;
  }),

  logout: protectedProcedure
    .input(z.object({ refreshTokenId: z.string(), jti: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await Promise.all([
        ctx.redis.del(`session:refresh:${input.refreshTokenId}`),
        revokeAccessToken(ctx.redis, input.jti),
      ]);
      return { success: true };
    }),
});
