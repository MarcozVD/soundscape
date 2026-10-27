'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { trpc } from '@/lib/trpc';
import { usePlayerStore } from '@/store/player';
import { PlayIcon } from '@/components/Icons';

gsap.registerPlugin(useGSAP);

export default function RecommendationsPage() {
  const utils = trpc.useUtils();
  const container = useRef<HTMLDivElement>(null);

  const { data, isLoading, error } = trpc.recommendations.forUser.useQuery({ limit: 20 });
  const refresh = trpc.recommendations.refresh.useMutation({
    onSuccess: () => utils.recommendations.forUser.invalidate(),
  });

  useGSAP(() => {
    if (!isLoading && data?.tracks && data.tracks.length > 0) {
      gsap.from('.track-card', {
        y: 20,
        opacity: 0,
        duration: 0.4,
        stagger: 0.045,
        ease: 'power2.out',
        delay: 0.05,
      });
    }
  }, { scope: container, dependencies: [isLoading] });

  return (
    <div ref={container} className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.12em] mb-2" style={{ color: 'var(--text-2)' }}>
            Personalised
          </p>
          <h1 className="font-display font-bold" style={{ fontSize: '28px', color: 'var(--text)', lineHeight: 1 }}>
            For You
          </h1>
        </div>

        {data && data.tracks.length > 0 && (
          <button
            onClick={() => refresh.mutate()}
            disabled={refresh.isPending}
            className="text-xs font-medium uppercase tracking-widest px-4 py-2 rounded-md transition-colors"
            style={{
              border: '1px solid var(--border-2)',
              color: 'var(--text-2)',
              letterSpacing: '0.08em',
              opacity: refresh.isPending ? 0.5 : 1,
            }}
          >
            {refresh.isPending ? 'Refreshing…' : 'Refresh'}
          </button>
        )}
      </div>

      {/* Loading skeleton */}
      {isLoading && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="aspect-square rounded-xl animate-pulse"
              style={{ background: 'var(--surface-2)' }}
            />
          ))}
        </div>
      )}

      {/* Error */}
      {error && <PageMessage title="Could not load" description={error.message} />}

      {/* Empty */}
      {!isLoading && data && data.tracks.length === 0 && (
        <PageMessage
          title="Nothing here yet"
          description="Connect your Spotify account and import your listening history."
          action={
            <Link
              href="/settings/connections"
              className="inline-block px-5 py-2.5 rounded-lg text-sm font-semibold"
              style={{ background: 'var(--accent)', color: 'var(--bg)' }}
            >
              Connect Spotify
            </Link>
          }
        />
      )}

      {/* Grid */}
      {data && data.tracks.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {data.tracks.map((track) => (
            <TrackCard key={track.id} track={track} />
          ))}
        </div>
      )}
    </div>
  );
}

interface Track {
  id: string;
  title: string;
  score: number;
  artistName: string | null;
  coverUrl: string | null;
  previewUrl: string | null;
  durationMs: number | null;
}

function TrackCard({ track }: { track: Track }) {
  const play = usePlayerStore((s) => s.play);
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isActive = currentTrack?.id === track.id;

  return (
    <div
      className="track-card group relative rounded-xl overflow-hidden cursor-pointer"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      {/* Cover */}
      <div className="relative aspect-square overflow-hidden" style={{ background: 'var(--surface-3)' }}>
        {track.coverUrl ? (
          <img
            src={track.coverUrl}
            alt={track.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full" style={{ background: 'var(--surface-3)' }} />
        )}

        {/* Overlay on hover */}
        <div
          className="absolute inset-0 transition-opacity duration-200 opacity-0 group-hover:opacity-100 flex items-center justify-center"
          style={{ background: 'rgba(9,9,9,0.5)' }}
        >
          {track.previewUrl && (
            <button
              onClick={() =>
                play({
                  id: track.id,
                  title: track.title,
                  artist: track.artistName ?? '',
                  coverUrl: track.coverUrl ?? undefined,
                  previewUrl: track.previewUrl!,
                })
              }
              className="flex items-center justify-center rounded-full transition-transform duration-150 hover:scale-105 active:scale-95"
              style={{
                width: 44,
                height: 44,
                background: isActive ? 'var(--accent)' : 'var(--text)',
                color: 'var(--bg)',
              }}
              aria-label={`Play ${track.title}`}
            >
              <PlayIcon />
            </button>
          )}
        </div>

        {/* Score badge */}
        <div
          className="absolute top-2 right-2 px-1.5 py-0.5 rounded font-medium tabular-nums"
          style={{
            fontSize: '10px',
            background: 'rgba(9,9,9,0.75)',
            color: 'var(--accent)',
            border: '1px solid rgba(200,255,87,0.2)',
            backdropFilter: 'blur(4px)',
            letterSpacing: '0.04em',
          }}
        >
          {Math.round(track.score * 100)}%
        </div>
      </div>

      {/* Info */}
      <div className="px-3 py-2.5">
        <p
          className="font-medium truncate leading-tight"
          style={{ fontSize: '13px', color: 'var(--text)' }}
        >
          {track.title}
        </p>
        <p
          className="truncate mt-0.5"
          style={{ fontSize: '11px', color: 'var(--text-2)' }}
        >
          {track.artistName ?? 'Unknown'}
        </p>
      </div>
    </div>
  );
}

function PageMessage({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-28 text-center space-y-3">
      <div
        className="w-10 h-10 rounded-xl mb-2 flex items-center justify-center"
        style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)' }}
      >
        <span className="w-2 h-2 rounded-full" style={{ background: 'var(--text-3)' }} />
      </div>
      <h2 className="font-display font-semibold" style={{ fontSize: '18px', color: 'var(--text)' }}>
        {title}
      </h2>
      <p style={{ fontSize: '13px', color: 'var(--text-2)', maxWidth: '280px' }}>{description}</p>
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}
