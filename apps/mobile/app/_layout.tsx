import { Stack, useRouter, useSegments } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { trpc, trpcClient } from '../lib/trpc';
import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/auth';

function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const { accessToken, loadTokens } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadTokens().finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === 'auth';

    if (!accessToken && !inAuthGroup) {
      router.replace('/auth/login');
    } else if (accessToken && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [accessToken, segments, isLoading]);

  return <>{children}</>;
}

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <AuthGuard>
          <Stack screenOptions={{ headerShown: false }} />
        </AuthGuard>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
