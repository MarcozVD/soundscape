'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';

const STARS_LABEL = ['', 'Terrible', 'Bad', 'OK', 'Good', 'Amazing'];

function StarDisplay({ stars }: { stars: number }) {
  return (
    <span className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <span key={s} style={{ color: s <= stars ? '#eab308' : '#404040' }} className="text-sm">
          ★
        </span>
      ))}
    </span>
  );
}

export default function ProfilePage() {
  const { data: me, isLoading: meLoading } = trpc.auth.me.useQuery();
  const [offset, setOffset] = useState(0);
  const LIMIT = 20;

  const { data: ratings, isLoading: ratingsLoading } = trpc.ratings.list.useQuery(
    { limit: LIMIT, offset },
    { keepPreviousData: true } as never
  );

  const { data: playlists } = trpc.playlists.list.useQuery();

  if (meLoading) {
    return (
      <div className="p-8 space-y-6 animate-pulse">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-[#262626]" />
          <div className="space-y-2">
            <div className="h-6 bg-[#262626] rounded w-40" />
            <div className="h-4 bg-[#262626] rounded w-56" />
          </div>
        </div>
      </div>
    );
  }

  if (!me) {
    return (
      <div className="p-8">
        <p className="text-[#a3a3a3]">Please log in to view your profile.</p>
      </div>
    );
  }

  const initials = me.displayName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const totalRatings = ratings?.length ?? 0;
  const totalPlaylists = playlists?.length ?? 0;

  return (
    <div className="p-8 space-y-8 max-w-3xl">
      {/* Avatar + info */}
      <div className="flex items-center gap-5">
        <div className="w-20 h-20 rounded-full overflow-hidden bg-[#262626] shrink-0 flex items-center justify-center">
          {me.avatarUrl ? (
            <img src={me.avatarUrl} alt={me.displayName} className="w-full h-full object-cover" />
          ) : (
            <span className="text-2xl font-bold text-[#a3a3a3]">{initials}</span>
          )}
        </div>
        <div>
          <h1 className="text-3xl font-bold text-white">{me.displayName}</h1>
          <p className="text-[#a3a3a3] mt-0.5">{me.email}</p>
          <p className="text-[#525252] text-sm mt-1">
            Member since{' '}
            {new Date(me.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {[
          { label: 'Ratings', value: totalRatings },
          { label: 'Playlists', value: totalPlaylists },
          { label: 'Connected providers', value: me.providerAccounts.length },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-[#171717] border border-[#262626] rounded-xl p-5 text-center"
          >
            <p className="text-3xl font-bold text-white">{stat.value}</p>
            <p className="text-[#a3a3a3] text-sm mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Rating history */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-white">Rating history</h2>

        {ratingsLoading && (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 bg-[#171717] rounded-xl animate-pulse" />
            ))}
          </div>
        )}

        {!ratingsLoading && ratings && ratings.length === 0 && (
          <p className="text-[#a3a3a3] text-sm">You haven&apos;t rated any tracks yet.</p>
        )}

        <div className="space-y-2">
          {ratings?.map((rating) => {
            const track = rating.track;
            const artist = track.trackArtists[0]?.artist;
            const cover = track.albumTracks?.[0]?.album?.coverUrl ?? null;
            return (
              <div
                key={rating.id}
                className="flex items-center gap-4 bg-[#171717] border border-[#262626] rounded-xl px-4 py-3 hover:border-[#404040] transition-colors"
              >
                <div className="w-10 h-10 rounded-md overflow-hidden bg-[#262626] shrink-0">
                  {cover ? (
                    <img src={cover} alt={track.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[#525252]">♪</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{track.title}</p>
                  <p className="text-xs text-[#a3a3a3] truncate">{artist?.name ?? 'Unknown artist'}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <StarDisplay stars={rating.stars} />
                  <span className="text-xs text-[#525252]">{STARS_LABEL[rating.stars]}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Pagination */}
        {(ratings && (ratings.length === LIMIT || offset > 0)) && (
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={() => setOffset((o) => Math.max(0, o - LIMIT))}
              disabled={offset === 0}
              className="border border-[#404040] hover:border-[#525252] disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-full px-5 py-2 text-sm transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => setOffset((o) => o + LIMIT)}
              disabled={ratings.length < LIMIT}
              className="border border-[#404040] hover:border-[#525252] disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-full px-5 py-2 text-sm transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
