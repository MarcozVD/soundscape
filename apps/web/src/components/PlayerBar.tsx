'use client';

import { useRef } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { usePlayerStore } from '@/store/player';
import { PlayIcon, PauseIcon } from './Icons';

gsap.registerPlugin(useGSAP);

export function PlayerBar() {
  const { currentTrack, isPlaying, toggle } = usePlayerStore();
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (currentTrack) {
      gsap.fromTo(
        ref.current,
        { y: 72, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.5, ease: 'power3.out' }
      );
    }
  }, { scope: ref, dependencies: [currentTrack?.id] });

  if (!currentTrack) return null;

  return (
    <div
      ref={ref}
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center gap-5 px-6"
      style={{
        height: '68px',
        background: 'var(--surface)',
        borderTop: '1px solid var(--border)',
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* Album art */}
      <div
        className="shrink-0 rounded overflow-hidden"
        style={{ width: 42, height: 42, background: 'var(--surface-3)' }}
      >
        {currentTrack.coverUrl && (
          <img
            src={currentTrack.coverUrl}
            alt={currentTrack.title}
            className="w-full h-full object-cover"
          />
        )}
      </div>

      {/* Track info */}
      <div className="min-w-0 flex-1">
        <p
          className="font-medium truncate leading-tight"
          style={{ fontSize: '13px', color: 'var(--text)' }}
        >
          {currentTrack.title}
        </p>
        <p
          className="truncate mt-0.5"
          style={{ fontSize: '11px', color: 'var(--text-2)' }}
        >
          {currentTrack.artist}
        </p>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4">
        <span
          style={{ fontSize: '11px', color: 'var(--text-3)', letterSpacing: '0.06em' }}
          className="font-medium uppercase tracking-widest hidden sm:block"
        >
          Preview
        </span>

        <button
          onClick={toggle}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          className="flex items-center justify-center rounded-full transition-transform duration-150 active:scale-95"
          style={{
            width: 36,
            height: 36,
            background: 'var(--text)',
            color: 'var(--bg)',
          }}
        >
          {isPlaying ? <PauseIcon /> : <PlayIcon />}
        </button>
      </div>
    </div>
  );
}
