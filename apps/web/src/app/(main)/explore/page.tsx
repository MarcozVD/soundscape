'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { TrackCard } from '@/components/TrackCard';
import { SearchBar } from '@/components/SearchBar';

export default function ExplorePage() {
  const [query, setQuery] = useState('');
  const { data, isLoading } = trpc.search.query.useQuery(
    { q: query },
    { enabled: query.length > 2 }
  );

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-3xl font-bold">Explore</h1>
      <SearchBar value={query} onChange={setQuery} placeholder="Search songs, artists, albums..." />

      {isLoading && <p className="text-neutral-400">Searching...</p>}

      {data && data.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {data.map((track) => (
            <TrackCard key={track.id as string} trackId={track.id as string} />
          ))}
        </div>
      )}

      {data && data.length === 0 && (
        <p className="text-neutral-400">No results for "{query}"</p>
      )}
    </div>
  );
}
