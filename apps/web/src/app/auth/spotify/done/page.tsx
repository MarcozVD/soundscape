'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function SpotifyDoneInner() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const at = params.get('at');
    const rt = params.get('rt');
    if (at) localStorage.setItem('access_token', at);
    if (rt) localStorage.setItem('refresh_token', rt);
    // Mark onboarding complete in case this is the first connection
    localStorage.setItem('onboarding_complete', '1');
    // Replace current history entry so back button doesn't return here
    router.replace('/recommendations');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
      <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border-2)', borderTopColor: 'var(--accent)' }} />
    </div>
  );
}

export default function SpotifyDonePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border-2)', borderTopColor: 'var(--accent)' }} />
      </div>
    }>
      <SpotifyDoneInner />
    </Suspense>
  );
}
