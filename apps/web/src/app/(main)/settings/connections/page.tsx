'use client';

import { useEffect, useState } from 'react';
import { trpc } from '@/lib/trpc';

type ImportStatus = 'idle' | 'importing' | 'done' | 'failed';

interface ImportState {
  jobId: string | null;
  status: ImportStatus;
  progress: number | null;
}

function getStorageKey() {
  try {
    const token = localStorage.getItem('access_token');
    if (!token) return 'import_jobs:anon';
    const payload = JSON.parse(atob(token.split('.')[1]!)) as { sub?: string };
    return `import_jobs:${payload.sub ?? 'anon'}`;
  } catch {
    return 'import_jobs:anon';
  }
}

function loadPersistedJobs(): Record<string, ImportState> {
  try {
    return JSON.parse(sessionStorage.getItem(getStorageKey()) ?? '{}');
  } catch {
    return {};
  }
}

function saveJobs(jobs: Record<string, ImportState>) {
  sessionStorage.setItem(getStorageKey(), JSON.stringify(jobs));
}

const PROVIDER_META: Record<string, { label: string }> = {
  spotify: { label: 'Spotify' },
  apple_music: { label: 'Apple Music' },
  lastfm: { label: 'Last.fm' },
  youtube: { label: 'YouTube Music' },
};

export default function ConnectionsPage() {
  const utils = trpc.useUtils();

  const { data: providers, isLoading } = trpc.providers.list.useQuery();
  const initiateSpotify = trpc.providers.initiateSpotifyConnect.useMutation({
    onSuccess: (data) => { window.location.href = data.url; },
  });
  const disconnectProvider = trpc.providers.disconnect.useMutation({
    onSuccess: () => void utils.providers.list.invalidate(),
  });
  const importHistory = trpc.providers.importHistory.useMutation();

  const [importStates, setImportStates] = useState<Record<string, ImportState>>({});

  // Restore persisted import jobs on mount and resume polling
  // Restore persisted jobs and resume polling, but defer to DB truth once loaded
  useEffect(() => {
    const saved = loadPersistedJobs();
    if (Object.keys(saved).length === 0) return;
    setImportStates(saved);
    for (const [provider, state] of Object.entries(saved)) {
      if (state.status === 'importing' && state.jobId) {
        pollJob(provider, state.jobId);
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync import state with DB truth: if the DB shows imported, mark done
  useEffect(() => {
    if (!providers) return;
    setImportStates((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const p of providers) {
        if (p.hasImported && next[p.provider]?.status !== 'done') {
          next[p.provider] = { jobId: null, status: 'done', progress: 100 };
          changed = true;
        }
      }
      if (changed) saveJobs(next);
      return changed ? next : prev;
    });
  }, [providers]);

  function updateState(provider: string, patch: Partial<ImportState>) {
    setImportStates((prev) => {
      const next = { ...prev, [provider]: { ...prev[provider], ...patch } as ImportState };
      saveJobs(next);
      return next;
    });
  }

  async function pollJob(provider: string, jobId: string) {
    try {
      const result = await utils.providers.getImportStatus.fetch({ jobId });
      const data = result.progress as { percent?: number; status?: string } | null;

      if (data?.status === 'completed') {
        updateState(provider, { status: 'done', progress: 100 });
      } else if (data?.status === 'failed') {
        updateState(provider, { status: 'failed' });
      } else {
        updateState(provider, { progress: data?.percent ?? null });
        setTimeout(() => pollJob(provider, jobId), 2500);
      }
    } catch {
      updateState(provider, { status: 'failed' });
    }
  }

  async function startImport(provider: 'spotify' | 'lastfm') {
    updateState(provider, { jobId: null, status: 'importing', progress: null });
    try {
      const { jobId } = await importHistory.mutateAsync({ provider });
      if (!jobId) throw new Error('No job ID');
      updateState(provider, { jobId });
      setTimeout(() => pollJob(provider, jobId), 2500);
    } catch {
      updateState(provider, { status: 'failed' });
    }
  }

  const connectedProviders = new Set(providers?.map((p) => p.provider) ?? []);
  const isSpotifyConnected = connectedProviders.has('spotify');

  return (
    <div className="p-8 space-y-8 max-w-2xl">
      <div>
        <h1 className="font-display font-bold mb-1" style={{ fontSize: '24px', color: 'var(--text)' }}>
          Connected accounts
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--text-2)' }}>
          Link your music accounts to improve recommendations.
        </p>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="h-20 rounded-xl animate-pulse" style={{ background: 'var(--surface)' }} />
          ))}
        </div>
      )}

      <div className="space-y-3">
        <p className="uppercase font-medium" style={{ fontSize: '11px', color: 'var(--text-2)', letterSpacing: '0.08em' }}>
          Available
        </p>

        {/* Spotify */}
        <div className="rounded-xl p-5 flex items-center justify-between gap-4" style={{ background: 'var(--surface)', border: '1px solid var(--border-2)' }}>
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(29,185,84,0.08)', border: '1px solid rgba(29,185,84,0.15)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#1db954" aria-hidden>
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.371-.721.49-1.101.241-3.021-1.858-6.832-2.278-11.322-1.237-.422.1-.852-.16-.952-.581-.1-.422.16-.852.581-.952 4.912-1.121 9.122-.641 12.521 1.431.38.241.49.721.273 1.098zm1.47-3.27c-.301.46-.921.6-1.381.3-3.461-2.13-8.732-2.75-12.822-1.5-.512.15-1.052-.15-1.202-.66-.15-.51.15-1.052.66-1.202 4.671-1.42 10.48-.73 14.461 1.71.451.3.6.92.284 1.352zm.127-3.4C15.521 8.34 8.58 8.1 4.9 9.241c-.611.181-1.261-.18-1.441-.79-.181-.611.18-1.261.79-1.441 4.241-1.291 11.281-1.041 15.721 1.71.561.33.75 1.051.421 1.611-.33.561-1.051.75-1.592.42v-.01z"/>
              </svg>
            </div>
            <div>
              <p className="font-medium" style={{ fontSize: '14px', color: 'var(--text)' }}>Spotify</p>
              <p style={{ fontSize: '12px', color: isSpotifyConnected ? '#1db954' : 'var(--text-2)' }}>
                {isSpotifyConnected ? 'Connected' : 'Not connected'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {isSpotifyConnected ? (
              <>
                <ImportButton
                  state={importStates.spotify}
                  onImport={() => startImport('spotify')}
                />
                <button
                  onClick={() => disconnectProvider.mutate({ provider: 'spotify' })}
                  disabled={disconnectProvider.isPending}
                  style={{ fontSize: '13px', color: 'var(--text-2)' }}
                  className="hover:text-red-400 transition-colors disabled:opacity-50"
                >
                  Disconnect
                </button>
              </>
            ) : (
              <button
                onClick={() => initiateSpotify.mutate()}
                disabled={initiateSpotify.isPending}
                className="px-4 py-2 rounded-lg text-sm font-semibold transition-opacity"
                style={{ background: 'var(--accent)', color: 'var(--bg)', opacity: initiateSpotify.isPending ? 0.6 : 1 }}
              >
                {initiateSpotify.isPending ? 'Opening…' : 'Connect'}
              </button>
            )}
          </div>
        </div>

        {/* Other connected providers */}
        {providers?.filter((p) => p.provider !== 'spotify').map((p) => (
          <div key={p.id} className="rounded-xl p-5 flex items-center justify-between gap-4" style={{ background: 'var(--surface)', border: '1px solid var(--border-2)' }}>
            <div>
              <p className="font-medium" style={{ fontSize: '14px', color: 'var(--text)' }}>
                {PROVIDER_META[p.provider]?.label ?? p.provider}
              </p>
              <p style={{ fontSize: '12px', color: 'var(--text-2)' }}>Connected</p>
            </div>
            <div className="flex items-center gap-3">
              {p.provider === 'lastfm' && (
                <ImportButton state={importStates.lastfm} onImport={() => startImport('lastfm')} />
              )}
              <button
                onClick={() => disconnectProvider.mutate({ provider: p.provider as 'spotify' | 'apple_music' | 'lastfm' | 'youtube' })}
                style={{ fontSize: '13px', color: 'var(--text-2)' }}
                className="hover:text-red-400 transition-colors"
              >
                Disconnect
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Coming soon */}
      <div className="space-y-3">
        <p className="uppercase font-medium" style={{ fontSize: '11px', color: 'var(--text-2)', letterSpacing: '0.08em' }}>
          Coming soon
        </p>
        {[
          { id: 'apple_music', label: 'Apple Music' },
          { id: 'lastfm', label: 'Last.fm' },
          { id: 'youtube_music', label: 'YouTube Music' },
        ].filter((p) => !connectedProviders.has(p.id)).map((p) => (
          <div key={p.id} className="rounded-xl p-5 flex items-center justify-between opacity-40" style={{ background: 'var(--surface)', border: '1px solid var(--border-2)' }}>
            <div>
              <p className="font-medium" style={{ fontSize: '14px', color: 'var(--text)' }}>{p.label}</p>
              <p style={{ fontSize: '12px', color: 'var(--text-2)' }}>Not connected</p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: 'var(--surface-3)', border: '1px solid var(--border-2)', color: 'var(--text-2)' }}>
              Coming soon
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ImportButton({ state, onImport }: { state: ImportState | undefined; onImport: () => void }) {
  if (state?.status === 'importing') {
    return (
      <span className="flex items-center gap-2" style={{ fontSize: '13px', color: 'var(--text-2)' }}>
        <span className="w-3.5 h-3.5 border-2 rounded-full animate-spin shrink-0" style={{ borderColor: 'var(--border-2)', borderTopColor: 'var(--accent)' }} />
        {state.progress != null ? `${state.progress}%` : 'Importing…'}
      </span>
    );
  }
  if (state?.status === 'done') {
    return <span style={{ fontSize: '13px', color: 'var(--accent)' }}>Imported</span>;
  }
  if (state?.status === 'failed') {
    return (
      <button onClick={onImport} style={{ fontSize: '13px', color: '#f87171' }}>
        Retry import
      </button>
    );
  }
  return (
    <button
      onClick={onImport}
      className="px-3.5 py-1.5 rounded-lg text-sm transition-colors"
      style={{ border: '1px solid var(--border-2)', color: 'var(--text-2)', fontSize: '13px' }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-2)')}
    >
      Import history
    </button>
  );
}
