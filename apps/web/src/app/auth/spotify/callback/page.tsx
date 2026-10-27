'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';

function SpotifyCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const connectSpotify = trpc.providers.completeSpotifyConnect.useMutation({
    onSuccess(data) {
      // Redirect to localhost:3000 to fix the 127.0.0.1 vs localhost localStorage isolation.
      // /auth/spotify/done stores the tokens and forwards to /recommendations.
      const base = `${window.location.protocol}//localhost:${window.location.port}`;
      const params = new URLSearchParams({ at: data.accessToken, rt: data.refreshToken });
      window.location.href = `${base}/auth/spotify/done?${params}`;
    },
  });
  const calledRef = useRef(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;

    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      setErrorMessage(`Spotify denied access: ${error}`);
      return;
    }

    if (!code || !state) {
      setErrorMessage('Missing OAuth parameters. Please try again.');
      return;
    }

    connectSpotify.mutate({ code, state });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const displayError = errorMessage ?? connectSpotify.error?.message ?? null;

  if (displayError) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-[#171717] border border-[#262626] rounded-2xl p-8 space-y-4">
            <div className="w-14 h-14 rounded-full bg-red-950/40 border border-red-900/50 flex items-center justify-center mx-auto text-2xl">
              ✕
            </div>
            <h2 className="text-xl font-semibold text-white">Connection failed</h2>
            <p className="text-[#a3a3a3] text-sm">{displayError}</p>
            <Link
              href="/settings/connections"
              className="inline-block bg-green-500 hover:bg-green-400 text-black font-semibold rounded-full px-6 py-2.5 transition-colors mt-2"
            >
              Back to connections
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <div className="bg-[#171717] border border-[#262626] rounded-2xl p-8 space-y-4">
          <div className="w-14 h-14 mx-auto">
            <div className="w-14 h-14 border-4 border-[#262626] border-t-green-500 rounded-full animate-spin" />
          </div>
          <h2 className="text-xl font-semibold text-white">Connecting Spotify</h2>
          <p className="text-[#a3a3a3] text-sm">Hang tight while we link your account&hellip;</p>
        </div>
      </div>
    </div>
  );
}

export default function SpotifyCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-14 h-14 border-4 border-[#262626] border-t-green-500 rounded-full animate-spin" />
      </div>
    }>
      <SpotifyCallbackInner />
    </Suspense>
  );
}
