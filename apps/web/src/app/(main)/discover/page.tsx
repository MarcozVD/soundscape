'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc';

const GENRES = [
  'Pop',
  'Rock',
  'Hip-Hop',
  'Electronic',
  'Jazz',
  'Classical',
  'R&B',
  'Metal',
  'Folk',
  'Latin',
  'Country',
  'Reggae',
];

const SAMPLE_ARTISTS = [
  'Taylor Swift',
  'Kendrick Lamar',
  'Radiohead',
  'Beyoncé',
  'The Beatles',
  'Frank Ocean',
  'Daft Punk',
  'Miles Davis',
  'Led Zeppelin',
  'Billie Eilish',
  'Arctic Monkeys',
  'SZA',
  'Metallica',
  'Bob Dylan',
  'Tame Impala',
  'Drake',
  'Pink Floyd',
  'Ariana Grande',
  'Nirvana',
  'Fleetwood Mac',
];

export default function DiscoverPage() {
  const router = useRouter();
  const [selectedGenres, setSelectedGenres] = useState<Set<string>>(new Set());
  const [selectedArtists, setSelectedArtists] = useState<Set<string>>(new Set());

  const seed = trpc.recommendations.seed.useMutation({
    onSuccess: () => router.push('/recommendations'),
  });

  function toggleGenre(genre: string) {
    setSelectedGenres((prev) => {
      const next = new Set(prev);
      if (next.has(genre)) next.delete(genre);
      else next.add(genre);
      return next;
    });
  }

  function toggleArtist(artist: string) {
    setSelectedArtists((prev) => {
      const next = new Set(prev);
      if (next.has(artist)) next.delete(artist);
      else next.add(artist);
      return next;
    });
  }

  const canSubmit = selectedGenres.size > 0 || selectedArtists.size > 0;

  return (
    <div className="p-8 space-y-10 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold text-white">Tell us your taste</h1>
        <p className="text-[#a3a3a3] mt-2">
          Select genres and artists you enjoy — we&apos;ll use this to build your first recommendations.
        </p>
      </div>

      {/* Genres */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-white">Genres</h2>
        <div className="flex flex-wrap gap-2">
          {GENRES.map((genre) => {
            const selected = selectedGenres.has(genre);
            return (
              <button
                key={genre}
                onClick={() => toggleGenre(genre)}
                className={`rounded-full px-5 py-2 text-sm font-medium transition-all ${
                  selected
                    ? 'bg-green-500 text-black'
                    : 'bg-[#171717] border border-[#262626] text-[#a3a3a3] hover:border-[#404040] hover:text-white'
                }`}
              >
                {genre}
              </button>
            );
          })}
        </div>
      </div>

      {/* Artists */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-white">Artists</h2>
        <div className="flex flex-wrap gap-2">
          {SAMPLE_ARTISTS.map((artist) => {
            const selected = selectedArtists.has(artist);
            return (
              <button
                key={artist}
                onClick={() => toggleArtist(artist)}
                className={`rounded-full px-5 py-2 text-sm font-medium transition-all ${
                  selected
                    ? 'bg-green-500 text-black'
                    : 'bg-[#171717] border border-[#262626] text-[#a3a3a3] hover:border-[#404040] hover:text-white'
                }`}
              >
                {artist}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selection summary */}
      {(selectedGenres.size > 0 || selectedArtists.size > 0) && (
        <p className="text-sm text-[#a3a3a3]">
          {selectedGenres.size > 0 && (
            <span>
              {selectedGenres.size} genre{selectedGenres.size !== 1 ? 's' : ''}
            </span>
          )}
          {selectedGenres.size > 0 && selectedArtists.size > 0 && <span> &amp; </span>}
          {selectedArtists.size > 0 && (
            <span>
              {selectedArtists.size} artist{selectedArtists.size !== 1 ? 's' : ''}
            </span>
          )}{' '}
          selected
        </p>
      )}

      {seed.error && (
        <p className="text-sm text-red-400 bg-red-950/40 border border-red-900/50 rounded-lg px-4 py-3">
          {seed.error.message}
        </p>
      )}

      <button
        onClick={() => {
          if (!canSubmit) return;
          seed.mutate({
            genres: Array.from(selectedGenres),
            artistNames: Array.from(selectedArtists),
          });
        }}
        disabled={!canSubmit || seed.isPending}
        className="bg-green-500 hover:bg-green-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-semibold rounded-full px-8 py-3 transition-colors text-base"
      >
        {seed.isPending ? 'Building your recommendations...' : 'Generate my recommendations'}
      </button>
    </div>
  );
}
