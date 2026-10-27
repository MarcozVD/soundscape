'use client';

import { useRef, useState, FormEvent } from 'react';
import Link from 'next/link';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { trpc } from '@/lib/trpc';
import { ListMusicIcon } from '@/components/Icons';

gsap.registerPlugin(useGSAP);

export default function PlaylistsPage() {
  const utils = trpc.useUtils();
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const container = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  const { data: playlists, isLoading } = trpc.playlists.list.useQuery();
  const createPlaylist = trpc.playlists.create.useMutation({
    onSuccess: () => {
      void utils.playlists.list.invalidate();
      closeModal();
    },
  });

  // Entrance animation for page
  useGSAP(() => {
    gsap.from('.playlist-row', {
      y: 14,
      opacity: 0,
      duration: 0.35,
      stagger: 0.05,
      ease: 'power2.out',
    });
  }, { scope: container, dependencies: [isLoading] });

  function openModal() {
    setTitle('');
    setDescription('');
    setShowModal(true);
  }

  function closeModal() {
    if (!modalRef.current || !backdropRef.current) { setShowModal(false); return; }
    gsap.to(modalRef.current, { y: 16, opacity: 0, duration: 0.2, ease: 'power2.in' });
    gsap.to(backdropRef.current, {
      opacity: 0, duration: 0.2, ease: 'power2.in',
      onComplete: () => setShowModal(false),
    });
  }

  // Animate modal in when it mounts
  const modalContainer = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    if (!showModal || !modalRef.current || !backdropRef.current) return;
    gsap.fromTo(backdropRef.current, { opacity: 0 }, { opacity: 1, duration: 0.2, ease: 'power2.out' });
    gsap.fromTo(modalRef.current, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.3, ease: 'power3.out' });
  }, { scope: modalContainer, dependencies: [showModal] });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    createPlaylist.mutate({ title: title.trim(), description: description.trim() || undefined });
  }

  return (
    <div ref={container} className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.12em] mb-2" style={{ color: 'var(--text-2)' }}>
            Library
          </p>
          <h1 className="font-display font-bold" style={{ fontSize: '28px', color: 'var(--text)', lineHeight: 1 }}>
            Playlists
          </h1>
        </div>
        <button
          onClick={openModal}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90 active:scale-[0.98]"
          style={{ background: 'var(--accent)', color: 'var(--bg)' }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
            <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          New playlist
        </button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: 'var(--surface-2)' }} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && playlists?.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center space-y-3">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center mb-1"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', color: 'var(--text-3)' }}
          >
            <ListMusicIcon />
          </div>
          <h2 className="font-display font-semibold" style={{ fontSize: '17px', color: 'var(--text)' }}>
            No playlists yet
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-2)' }}>
            Create your first playlist to get started.
          </p>
          <button
            onClick={openModal}
            className="mt-2 px-5 py-2.5 rounded-lg text-sm font-semibold"
            style={{ background: 'var(--accent)', color: 'var(--bg)' }}
          >
            Create playlist
          </button>
        </div>
      )}

      {/* List */}
      {playlists && playlists.length > 0 && (
        <div className="space-y-1.5">
          {playlists.map((p) => {
            const count = (p as { _count: { tracks: number } })._count?.tracks ?? 0;
            return (
              <Link
                key={p.id}
                href={`/playlists/${p.id}`}
                className="playlist-row flex items-center gap-4 px-4 py-3.5 rounded-xl transition-colors group"
                style={{ border: '1px solid transparent' }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'transparent')}
              >
                <div
                  className="shrink-0 rounded-lg overflow-hidden flex items-center justify-center"
                  style={{ width: 44, height: 44, background: 'var(--surface-3)', color: 'var(--text-3)' }}
                >
                  {p.coverUrl
                    ? <img src={p.coverUrl} alt={p.title} className="w-full h-full object-cover" />
                    : <ListMusicIcon />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate" style={{ fontSize: '14px', color: 'var(--text)' }}>
                    {p.title}
                  </p>
                  <p className="mt-0.5" style={{ fontSize: '12px', color: 'var(--text-2)' }}>
                    {count} {count === 1 ? 'track' : 'tracks'}
                  </p>
                </div>
                <svg
                  width="14" height="14" viewBox="0 0 14 14" fill="none"
                  stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"
                  style={{ color: 'var(--text-3)', flexShrink: 0 }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-hidden
                >
                  <path d="M5 3l4 4-4 4"/>
                </svg>
              </Link>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div ref={modalContainer}>
          {/* Backdrop */}
          <div
            ref={backdropRef}
            className="fixed inset-0 z-40 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
            onClick={closeModal}
          >
            {/* Dialog */}
            <div
              ref={modalRef}
              className="relative w-full max-w-md rounded-2xl p-7 z-50"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border-2)',
                boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close */}
              <button
                onClick={closeModal}
                className="absolute top-4 right-4 flex items-center justify-center rounded-lg transition-colors"
                style={{ width: 32, height: 32, color: 'var(--text-2)', background: 'var(--surface-3)' }}
                aria-label="Close"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
                  <path d="M1 1l10 10M11 1L1 11"/>
                </svg>
              </button>

              <h2
                className="font-display font-bold mb-1"
                style={{ fontSize: '20px', color: 'var(--text)' }}
              >
                New playlist
              </h2>
              <p className="mb-6" style={{ fontSize: '13px', color: 'var(--text-2)' }}>
                Give your playlist a name to get started.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor="pl-title"
                    className="block uppercase font-medium"
                    style={{ fontSize: '11px', color: 'var(--text-2)', letterSpacing: '0.08em' }}
                  >
                    Name
                  </label>
                  <input
                    id="pl-title"
                    type="text"
                    required
                    autoFocus
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="My playlist"
                    className="w-full rounded-lg px-4 py-3 text-sm"
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

                <div className="space-y-1.5">
                  <label
                    htmlFor="pl-desc"
                    className="block uppercase font-medium"
                    style={{ fontSize: '11px', color: 'var(--text-2)', letterSpacing: '0.08em' }}
                  >
                    Description{' '}
                    <span style={{ color: 'var(--text-3)', textTransform: 'none', letterSpacing: 0 }}>
                      (optional)
                    </span>
                  </label>
                  <textarea
                    id="pl-desc"
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="A short description…"
                    className="w-full rounded-lg px-4 py-3 text-sm resize-none"
                    style={{
                      background: 'var(--surface-2)',
                      border: '1px solid var(--border-2)',
                      color: 'var(--text)',
                      transition: 'border-color 0.15s',
                      outline: 'none',
                    }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
                    onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border-2)')}
                  />
                </div>

                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex-1 rounded-lg py-3 text-sm font-medium transition-colors"
                    style={{
                      background: 'var(--surface-3)',
                      border: '1px solid var(--border-2)',
                      color: 'var(--text-2)',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!title.trim() || createPlaylist.isPending}
                    className="flex-1 rounded-lg py-3 text-sm font-semibold transition-opacity active:scale-[0.99]"
                    style={{
                      background: 'var(--accent)',
                      color: 'var(--bg)',
                      opacity: !title.trim() || createPlaylist.isPending ? 0.5 : 1,
                    }}
                  >
                    {createPlaylist.isPending ? 'Creating…' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
