'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { trpc } from '@/lib/trpc';

gsap.registerPlugin(useGSAP);

type Step = 'choose' | 'connect' | 'taste';

const GENRES = [
  'Pop', 'Rock', 'Hip-Hop', 'Electronic', 'Jazz',
  'Classical', 'R&B', 'Metal', 'Folk', 'Latin',
  'Reggaeton', 'Indie', 'Soul', 'Country', 'Funk',
  'Punk', 'Blues', 'Ambient', 'Reggae', 'Afrobeats',
];

const PROVIDERS = [
  { id: 'spotify',     name: 'Spotify',        desc: 'Import your listening history, top tracks, and playlists', available: true,  color: '#1db954' },
  { id: 'apple_music', name: 'Apple Music',     desc: 'Connect your Apple Music library',                         available: false, color: '#fc3c44' },
  { id: 'lastfm',      name: 'Last.fm',          desc: 'Import your scrobble history',                              available: false, color: '#d51007' },
  { id: 'youtube',     name: 'YouTube Music',   desc: 'Link your YouTube Music account',                          available: false, color: '#ff0000' },
];

interface PickedTrack {
  id: string;
  title: string;
  artistName: string | null;
  coverUrl: string | null;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('choose');
  const initiateSpotify = trpc.providers.initiateSpotifyConnect.useMutation({
    onSuccess: (data) => { window.location.href = data.url; },
  });
  const [selectedGenres, setSelectedGenres] = useState<Set<string>>(new Set());
  const [pickedTracks, setPickedTracks] = useState<PickedTrack[]>([]);
  const [searchQ, setSearchQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stepRef = useRef<HTMLDivElement>(null);
  const container = useRef<HTMLDivElement>(null);

  const searchResults = trpc.tracks.search.useQuery(
    { q: debouncedQ, limit: 6 },
    { enabled: debouncedQ.length >= 2 }
  );

  const seed = trpc.recommendations.seed.useMutation({
    onSuccess: () => finish(),
  });

  useGSAP(() => {
    gsap.from('.onboard-enter', {
      y: 24, opacity: 0, duration: 0.5, stagger: 0.08, ease: 'power2.out', delay: 0.1,
    });
  }, { scope: container });

  function transitionTo(next: Step) {
    if (!stepRef.current) { setStep(next); return; }
    gsap.to(stepRef.current, {
      y: -16, opacity: 0, duration: 0.22, ease: 'power2.in',
      onComplete: () => {
        setStep(next);
        gsap.fromTo(stepRef.current,
          { y: 20, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.32, ease: 'power2.out' }
        );
      },
    });
  }

  function handleSearchChange(q: string) {
    setSearchQ(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedQ(q), 350);
  }

  function toggleGenre(g: string) {
    setSelectedGenres((prev) => {
      const next = new Set(prev);
      next.has(g) ? next.delete(g) : next.add(g);
      return next;
    });
  }

  function pickTrack(track: PickedTrack) {
    if (pickedTracks.find((t) => t.id === track.id)) return;
    setPickedTracks((prev) => [...prev, track]);
    setSearchQ('');
    setDebouncedQ('');
  }

  function removeTrack(id: string) {
    setPickedTracks((prev) => prev.filter((t) => t.id !== id));
  }

  function handleTasteContinue() {
    if (selectedGenres.size === 0 && pickedTracks.length === 0) return;
    seed.mutate({
      genres: Array.from(selectedGenres),
      artistNames: [],
      trackIds: pickedTracks.map((t) => t.id),
    });
  }

  function finish() {
    localStorage.setItem('onboarding_complete', '1');
    router.push('/recommendations');
  }

  const progress = step === 'choose' ? 33 : 66;
  const hasSelection = selectedGenres.size > 0 || pickedTracks.length > 0;

  return (
    <div ref={container} className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-8 py-5">
        <span className="onboard-enter font-display font-bold text-sm tracking-[0.18em] uppercase" style={{ color: 'var(--text)' }}>
          Soundscape
        </span>
        <div className="flex items-center gap-4">
          {step !== 'choose' && (
            <button onClick={() => transitionTo('choose')} style={{ fontSize: '13px', color: 'var(--text-2)' }}>
              Back
            </button>
          )}
          <button onClick={finish} style={{ fontSize: '13px', color: 'var(--text-3)' }}>
            Skip for now
          </button>
        </div>
      </div>

      {/* Progress */}
      <div className="h-px w-full" style={{ background: 'var(--border)' }}>
        <div className="h-full transition-all duration-500" style={{ width: `${progress}%`, background: 'var(--accent)' }} />
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10">
        <div ref={stepRef} className="w-full max-w-2xl">

          {/* ── CHOOSE ── */}
          {step === 'choose' && (
            <div className="space-y-8">
              <div className="text-center onboard-enter">
                <p className="font-display font-bold mb-3" style={{ fontSize: 'clamp(24px, 4vw, 34px)', color: 'var(--text)', lineHeight: 1.1 }}>
                  How do you want to start?
                </p>
                <p style={{ fontSize: '14px', color: 'var(--text-2)' }}>
                  We'll use this to personalise your recommendations from day one.
                </p>
              </div>

              <div className="onboard-enter grid grid-cols-1 sm:grid-cols-2 gap-4">
                <ChoiceCard
                  onClick={() => transitionTo('connect')}
                  icon={
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <circle cx="9" cy="9" r="7.5"/>
                      <path d="M5 9h8M9 5l4 4-4 4"/>
                    </svg>
                  }
                  title="Connect a service"
                  description="Import your listening history from Spotify, Apple Music, or Last.fm."
                  tags={['Spotify', 'Apple Music', 'Last.fm']}
                />
                <ChoiceCard
                  onClick={() => transitionTo('taste')}
                  icon={
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M9 2l1.8 5.4H17l-4.7 3.4 1.8 5.4L9 13.1l-5.1 3.1 1.8-5.4L1 7.4h6.2z"/>
                    </svg>
                  }
                  title="Set your tastes"
                  description="Choose genres and specific songs you love. We'll seed your feed instantly."
                  tags={['Genres', 'Songs', 'Artists']}
                />
              </div>
            </div>
          )}

          {/* ── CONNECT ── */}
          {step === 'connect' && (
            <div className="space-y-6">
              <div className="text-center">
                <p className="font-display font-bold mb-2" style={{ fontSize: 'clamp(20px, 3.5vw, 28px)', color: 'var(--text)', lineHeight: 1.1 }}>
                  Connect your music services
                </p>
                <p style={{ fontSize: '14px', color: 'var(--text-2)' }}>
                  We'll import your history to build your taste profile.
                </p>
              </div>

              <div className="space-y-2">
                {PROVIDERS.map((p) => (
                  <div key={p.id} className="flex items-center gap-4 px-5 py-4 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border-2)' }}>
                    <div className="shrink-0 w-2 h-2 rounded-full" style={{ background: p.available ? p.color : 'var(--text-3)' }} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium" style={{ fontSize: '14px', color: p.available ? 'var(--text)' : 'var(--text-2)' }}>{p.name}</p>
                      <p className="mt-0.5" style={{ fontSize: '12px', color: 'var(--text-2)' }}>{p.desc}</p>
                    </div>
                    {p.available ? (
                      <button
                        onClick={() => initiateSpotify.mutate()}
                        disabled={initiateSpotify.isPending}
                        className="shrink-0 px-4 py-2 rounded-lg text-xs font-semibold"
                        style={{ background: 'var(--accent)', color: 'var(--bg)', opacity: initiateSpotify.isPending ? 0.6 : 1 }}
                      >
                        {initiateSpotify.isPending ? 'Opening…' : 'Connect'}
                      </button>
                    ) : (
                      <span className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: 'var(--surface-3)', border: '1px solid var(--border-2)', color: 'var(--text-3)' }}>
                        Coming soon
                      </span>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex gap-3 pt-1">
                <button onClick={() => transitionTo('taste')} className="flex-1 py-3 rounded-xl text-sm font-medium" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', color: 'var(--text-2)' }}>
                  Set genres instead
                </button>
                <button onClick={finish} className="flex-1 py-3 rounded-xl text-sm font-semibold" style={{ background: 'var(--accent)', color: 'var(--bg)' }}>
                  Continue to app
                </button>
              </div>
            </div>
          )}

          {/* ── TASTE ── */}
          {step === 'taste' && (
            <div className="space-y-6">
              <div className="text-center">
                <p className="font-display font-bold mb-2" style={{ fontSize: 'clamp(20px, 3.5vw, 28px)', color: 'var(--text)', lineHeight: 1.1 }}>
                  Build your taste profile
                </p>
                <p style={{ fontSize: '14px', color: 'var(--text-2)' }}>
                  Select genres and add songs you love. Genres are inferred from your picks automatically.
                </p>
              </div>

              {/* Song search */}
              <div>
                <label className="block uppercase font-medium mb-2" style={{ fontSize: '11px', color: 'var(--text-2)', letterSpacing: '0.08em' }}>
                  Add songs you like
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-3)' }}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden>
                      <circle cx="6" cy="6" r="5"/><line x1="10" y1="10" x2="13" y2="13"/>
                    </svg>
                  </div>
                  <input
                    type="text"
                    value={searchQ}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    placeholder="Search by title or artist…"
                    className="w-full rounded-xl pl-9 pr-4 py-3 text-sm"
                    style={{
                      background: 'var(--surface-2)',
                      border: '1px solid var(--border-2)',
                      color: 'var(--text)',
                      transition: 'border-color 0.15s',
                    }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
                    onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border-2)')}
                  />
                </div>

                {/* Search results dropdown */}
                {debouncedQ.length >= 2 && (
                  <div className="mt-1.5 rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-2)', background: 'var(--surface)' }}>
                    {searchResults.isLoading && (
                      <div className="px-4 py-3" style={{ fontSize: '13px', color: 'var(--text-2)' }}>
                        Searching…
                      </div>
                    )}
                    {!searchResults.isLoading && searchResults.data?.length === 0 && (
                      <div className="px-4 py-3" style={{ fontSize: '13px', color: 'var(--text-2)' }}>
                        No tracks found. Try connecting Spotify to import your library first.
                      </div>
                    )}
                    {searchResults.data?.map((t) => {
                      const artist = t.trackArtists[0]?.artist.name;
                      const cover = t.albumTracks[0]?.album.coverUrl;
                      const alreadyPicked = pickedTracks.some((p) => p.id === t.id);
                      return (
                        <button
                          key={t.id}
                          onClick={() => pickTrack({ id: t.id, title: t.title, artistName: artist ?? null, coverUrl: cover ?? null })}
                          disabled={alreadyPicked}
                          className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
                          style={{
                            borderTop: '1px solid var(--border)',
                            opacity: alreadyPicked ? 0.4 : 1,
                          }}
                          onMouseEnter={(e) => { if (!alreadyPicked) e.currentTarget.style.background = 'var(--surface-2)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                        >
                          <div className="shrink-0 rounded overflow-hidden" style={{ width: 36, height: 36, background: 'var(--surface-3)' }}>
                            {cover && <img src={cover} alt={t.title} className="w-full h-full object-cover" />}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate" style={{ fontSize: '13px', color: 'var(--text)' }}>{t.title}</p>
                            <p className="truncate" style={{ fontSize: '11px', color: 'var(--text-2)' }}>{artist ?? 'Unknown'}</p>
                          </div>
                          {alreadyPicked && (
                            <span className="ml-auto shrink-0 text-xs" style={{ color: 'var(--accent)' }}>Added</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Picked tracks */}
                {pickedTracks.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {pickedTracks.map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full"
                        style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)' }}
                      >
                        <div className="w-5 h-5 rounded-full overflow-hidden shrink-0" style={{ background: 'var(--surface-3)' }}>
                          {t.coverUrl && <img src={t.coverUrl} alt={t.title} className="w-full h-full object-cover" />}
                        </div>
                        <span style={{ fontSize: '12px', color: 'var(--text)', maxWidth: 140 }} className="truncate">
                          {t.title}
                        </span>
                        <button
                          onClick={() => removeTrack(t.id)}
                          className="shrink-0 flex items-center justify-center rounded-full transition-colors"
                          style={{ width: 16, height: 16, background: 'var(--surface-3)', color: 'var(--text-2)' }}
                          aria-label={`Remove ${t.title}`}
                        >
                          <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
                            <path d="M1 1l6 6M7 1L1 7"/>
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Genre grid */}
              <div>
                <label className="block uppercase font-medium mb-3" style={{ fontSize: '11px', color: 'var(--text-2)', letterSpacing: '0.08em' }}>
                  Genres
                </label>
                <div className="flex flex-wrap gap-2">
                  {GENRES.map((genre) => {
                    const active = selectedGenres.has(genre);
                    return (
                      <button
                        key={genre}
                        onClick={() => toggleGenre(genre)}
                        className="px-3.5 py-1.5 rounded-full text-sm font-medium transition-all duration-150"
                        style={{
                          background: active ? 'var(--accent)' : 'var(--surface-2)',
                          border: `1px solid ${active ? 'var(--accent)' : 'var(--border-2)'}`,
                          color: active ? 'var(--bg)' : 'var(--text-2)',
                          fontSize: '13px',
                        }}
                      >
                        {genre}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Summary */}
              {hasSelection && (
                <p style={{ fontSize: '12px', color: 'var(--text-2)' }}>
                  {[
                    pickedTracks.length > 0 && `${pickedTracks.length} song${pickedTracks.length > 1 ? 's' : ''}`,
                    selectedGenres.size > 0 && `${selectedGenres.size} genre${selectedGenres.size > 1 ? 's' : ''}`,
                  ].filter(Boolean).join(' · ')} selected
                </p>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => transitionTo('connect')}
                  className="flex-1 py-3 rounded-xl text-sm font-medium"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', color: 'var(--text-2)' }}
                >
                  Connect a service instead
                </button>
                <button
                  onClick={handleTasteContinue}
                  disabled={!hasSelection || seed.isPending}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold transition-opacity"
                  style={{ background: 'var(--accent)', color: 'var(--bg)', opacity: !hasSelection || seed.isPending ? 0.4 : 1 }}
                >
                  {seed.isPending ? 'Saving…' : 'Continue'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ChoiceCard({
  onClick, icon, title, description, tags,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
  tags: string[];
}) {
  return (
    <button
      onClick={onClick}
      className="group text-left rounded-2xl p-6 transition-all duration-200"
      style={{ background: 'var(--surface)', border: '1px solid var(--border-2)' }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'var(--accent-dim)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-2)'; e.currentTarget.style.background = 'var(--surface)'; }}
    >
      <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: 'var(--surface-3)', color: 'var(--accent)' }}>
        {icon}
      </div>
      <p className="font-display font-semibold mb-2" style={{ fontSize: '15px', color: 'var(--text)' }}>{title}</p>
      <p style={{ fontSize: '13px', color: 'var(--text-2)', lineHeight: 1.5 }}>{description}</p>
      <div className="flex gap-1.5 mt-4 flex-wrap">
        {tags.map((t) => (
          <span key={t} className="px-2 py-0.5 rounded" style={{ background: 'var(--surface-3)', color: 'var(--text-2)', fontSize: '11px' }}>{t}</span>
        ))}
      </div>
    </button>
  );
}
