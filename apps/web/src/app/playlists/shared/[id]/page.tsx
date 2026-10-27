'use client';

import { use } from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function SharedPlaylistPage({ params }: PageProps) {
  const { id } = use(params);
  const { data: playlist, isLoading, error } = trpc.sharing.getPublicPlaylist.useQuery({ id });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-[#262626] border-t-green-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !playlist) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-white">Playlist not found</h1>
          <p className="text-[#a3a3a3]">This playlist doesn&apos;t exist or is private.</p>
          <Link href="/" className="inline-block text-green-500 hover:text-green-400 hover:underline">
            Go to Soundscape
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] px-4 py-12">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-white">Soundscape</Link>
          <Link
            href="/auth/login"
            className="bg-green-500 hover:bg-green-400 text-black font-semibold rounded-full px-5 py-2 text-sm transition-colors"
          >
            Sign in
          </Link>
        </div>

        {/* Playlist hero */}
        <div className="flex gap-6 items-start">
          <div className="w-36 h-36 shrink-0 rounded-xl bg-gradient-to-br from-green-600 to-green-900 flex items-center justify-center text-4xl text-white/60">
            ♪
          </div>
          <div className="flex-1 space-y-2">
            <p className="text-xs font-medium uppercase tracking-widest text-[#a3a3a3]">Playlist</p>
            <h1 className="text-3xl font-bold text-white">{playlist.title}</h1>
            {playlist.description && (
              <p className="text-[#a3a3a3] text-sm">{playlist.description}</p>
            )}
            <p className="text-sm text-[#525252]">
              by {playlist.user.displayName} · {playlist.tracks.length} tracks
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="bg-[#171717] border border-[#262626] rounded-xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <p className="text-white font-medium">Want to listen and get personalized recs?</p>
            <p className="text-sm text-[#a3a3a3] mt-0.5">Create a free Soundscape account.</p>
          </div>
          <Link
            href="/auth/register"
            className="shrink-0 bg-green-500 hover:bg-green-400 text-black font-semibold rounded-full px-6 py-2.5 text-sm transition-colors"
          >
            Get started free
          </Link>
        </div>

        {/* Track list */}
        <div className="space-y-2">
          {playlist.tracks.map((pt, idx) => {
            const track = pt.track;
            const artists = track.trackArtists.map((ta) => ta.artist.name).join(', ');
            const cover = track.albumTracks[0]?.album?.coverUrl ?? null;
            return (
              <div
                key={pt.id}
                className="flex items-center gap-4 bg-[#171717] border border-[#262626] rounded-xl p-3 hover:border-[#404040] transition-colors"
              >
                <span className="text-[#525252] text-sm w-6 text-center shrink-0">{idx + 1}</span>
                <div className="w-10 h-10 shrink-0 rounded-md overflow-hidden bg-[#262626]">
                  {cover ? (
                    <img src={cover} alt={track.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[#525252] text-lg">♪</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{track.title}</p>
                  <p className="text-xs text-[#a3a3a3] truncate">{artists}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
