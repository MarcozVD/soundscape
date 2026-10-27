import { createTRPCReact } from '@trpc/react-query';
import { httpBatchLink } from '@trpc/client';
import type { AppRouter } from '@soundscape/api-client';

export const trpc = createTRPCReact<AppRouter>();

export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: `${process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001'}/api/trpc`,
      async headers() {
        const { default: SecureStore } = await import('expo-secure-store');
        const token = await SecureStore.getItemAsync('access_token');
        return token ? { Authorization: `Bearer ${token}` } : {};
      },
    }),
  ],
});
