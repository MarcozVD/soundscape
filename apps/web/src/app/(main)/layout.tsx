'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { PlayerBar } from '@/components/PlayerBar';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      router.replace('/auth/login');
      return;
    }
    const onboarded = localStorage.getItem('onboarding_complete');
    if (!onboarded) {
      router.replace('/onboarding');
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-950">
        <div className="w-8 h-8 border-2 border-[#262626] border-t-green-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-neutral-950">
      <Sidebar />
      <main className="flex-1 overflow-y-auto pb-24">{children}</main>
      <PlayerBar />
    </div>
  );
}
