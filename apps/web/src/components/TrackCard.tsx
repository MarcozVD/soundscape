'use client';

import { trpc } from '@/lib/trpc';
import { usePlayerStore } from '@/store/player';
import { RatingWidget } from './RatingWidget';

interface TrackCardProps {
  trackId: string;
  score?: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function TrackCard({ trackId, score }: TrackCardProps) {
  const { data: track } = trpc.tracks.getById.useQuery({ id: trackId }) as { data: any };
  const play = usePlayerStore((s) => s.play);

  if (!track) return <div className="aspect-square rounded-lg bg-neutral-800 animate-pulse" />;

  const artist = track.trackArtists[0]?.artist;
  const cover = track.albumTracks[0]?.album?.coverUrl;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const previewUrl = (track.providerIds as any[]).find((p) => p.provider === 'spotify')?.previewUrl as string | null | undefined;

  return (
    <div className="group relative rounded-lg bg-neutral-900 p-4 hover:bg-neutral-800 transition-colors cursor-pointer">
      <div className="relative mb-3">
        <div className="aspect-square rounded-md bg-neutral-700 overflow-hidden">
          {cover && <img src={cover} alt={track.title} className="w-full h-full object-cover" />}
        </div>
        {previewUrl && (
          <button
            onClick={() =>
              play({ id: track.id, title: track.title, artist: artist?.name ?? '', coverUrl: cover ?? undefined, previewUrl })
            }
            className="absolute bottom-2 right-2 w-10 h-10 rounded-full bg-green-500 text-black flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
            aria-label={`Play ${track.title}`}
          >
            ▶
          </button>
        )}
      </div>
      <p className="font-medium truncate text-sm">{track.title}</p>
      <p className="text-xs text-neutral-400 truncate mt-0.5">{artist?.name}</p>
      {score !== undefined && (
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-neutral-500">{Math.round(score * 100)}% match</span>
          <RatingWidget trackId={trackId} compact />
        </div>
      )}
    </div>
  );
}
