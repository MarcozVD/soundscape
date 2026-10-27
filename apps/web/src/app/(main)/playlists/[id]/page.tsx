'use client';

import { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { TrackCard } from '@/components/TrackCard';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function PlaylistDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const utils = trpc.useUtils();

  const { data: playlist, isLoading } = trpc.playlists.getById.useQuery({ id });

  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editIsPublic, setEditIsPublic] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [exportId, setExportId] = useState<string | null>(null);
  const [exportStatus, setExportStatus] = useState<'idle' | 'exporting' | 'done' | 'failed'>('idle');
  const [exportResultUrl, setExportResultUrl] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const updatePlaylist = trpc.playlists.update.useMutation({
    onSuccess: () => {
      void utils.playlists.getById.invalidate({ id });
      setIsEditing(false);
    },
  });

  const deletePlaylist = trpc.playlists.delete.useMutation({
    onSuccess: () => router.push('/playlists'),
  });

  const removeTrack = trpc.playlists.removeTrack.useMutation({
    onSuccess: () => void utils.playlists.getById.invalidate({ id }),
  });

  const exportPlaylist = trpc.playlists.export.useMutation({
    onSuccess: async (data) => {
      setExportId(data.exportId);
      setExportStatus('exporting');

      // Poll getExportStatus every 2 seconds
      const poll = async () => {
        try {
          const status = await utils.playlists.getExportStatus.fetch({ exportId: data.exportId });
          if (status.status === 'done') {
            setExportStatus('done');
            setExportResultUrl(status.providerPlaylistId ?? null);
          } else if (status.status === 'failed') {
            setExportStatus('failed');
            setExportError(status.errorMessage ?? 'Export failed');
          } else {
            setTimeout(poll, 2000);
          }
        } catch {
          setExportStatus('failed');
          setExportError('Failed to check export status');
        }
      };

      setTimeout(poll, 2000);
    },
    onError: (err) => {
      setExportStatus('failed');
      setExportError(err.message);
    },
  });

  function startEditing() {
    if (!playlist) return;
    setEditTitle(playlist.title);
    setEditDescription(playlist.description ?? '');
    setEditIsPublic(playlist.isPublic);
    setIsEditing(true);
  }

  if (isLoading) {
    return (
      <div className="p-8 space-y-6 animate-pulse">
        <div className="flex gap-6">
          <div className="w-48 h-48 rounded-xl bg-[#262626]" />
          <div className="flex-1 space-y-3 pt-2">
            <div className="h-8 bg-[#262626] rounded w-1/2" />
            <div className="h-4 bg-[#262626] rounded w-1/3" />
          </div>
        </div>
      </div>
    );
  }

  if (!playlist) {
    return (
      <div className="p-8">
        <p className="text-[#a3a3a3]">Playlist not found.</p>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-6">
        {/* Cover */}
        <div className="w-48 h-48 shrink-0 rounded-xl overflow-hidden bg-[#262626]">
          {playlist.coverUrl ? (
            <img src={playlist.coverUrl} alt={playlist.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-5xl text-[#525252]">♫</div>
          )}
        </div>

        <div className="flex flex-col justify-end gap-3">
          {isEditing ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                updatePlaylist.mutate({ id, title: editTitle, description: editDescription || undefined, isPublic: editIsPublic });
              }}
              className="space-y-3"
            >
              <input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                required
                className="w-full rounded-xl px-4 py-3 bg-[#262626] border border-[#404040] text-white focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Description (optional)"
                rows={2}
                className="w-full rounded-xl px-4 py-3 bg-[#262626] border border-[#404040] text-white placeholder-[#525252] focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
              />
              <label className="flex items-center gap-2 text-sm text-[#a3a3a3] cursor-pointer">
                <input
                  type="checkbox"
                  checked={editIsPublic}
                  onChange={(e) => setEditIsPublic(e.target.checked)}
                  className="rounded"
                />
                Make public
              </label>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={updatePlaylist.isPending}
                  className="bg-green-500 hover:bg-green-400 disabled:opacity-50 text-black font-semibold rounded-full px-5 py-2 text-sm transition-colors"
                >
                  {updatePlaylist.isPending ? 'Saving...' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="border border-[#404040] hover:border-[#525252] text-white rounded-full px-5 py-2 text-sm transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-bold text-white">{playlist.title}</h1>
                  <span
                    className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                      playlist.isPublic
                        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                        : 'bg-[#262626] text-[#a3a3a3] border border-[#404040]'
                    }`}
                  >
                    {playlist.isPublic ? 'Public' : 'Private'}
                  </span>
                </div>
                {playlist.description && (
                  <p className="text-[#a3a3a3] mt-1 text-sm">{playlist.description}</p>
                )}
                <p className="text-[#525252] text-sm mt-1">
                  {playlist.tracks.length} track{playlist.tracks.length !== 1 ? 's' : ''}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={startEditing}
                  className="border border-[#404040] hover:border-[#525252] text-white rounded-full px-5 py-2 text-sm transition-colors"
                >
                  Edit
                </button>

                {/* Export to Spotify */}
                {exportStatus === 'idle' && (
                  <button
                    onClick={() => {
                      setExportStatus('exporting');
                      exportPlaylist.mutate({ playlistId: id, provider: 'spotify' });
                    }}
                    className="border border-[#404040] hover:border-green-500/50 text-white rounded-full px-5 py-2 text-sm transition-colors flex items-center gap-2"
                  >
                    Export to Spotify
                  </button>
                )}
                {exportStatus === 'exporting' && (
                  <span className="text-sm text-[#a3a3a3] flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-[#404040] border-t-green-500 rounded-full animate-spin inline-block" />
                    Exporting…
                  </span>
                )}
                {exportStatus === 'done' && (
                  <span className="text-sm text-green-400">
                    Exported!{' '}
                    {exportResultUrl && (
                      <a
                        href={`https://open.spotify.com/playlist/${exportResultUrl}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline"
                      >
                        Open in Spotify
                      </a>
                    )}
                  </span>
                )}
                {exportStatus === 'failed' && (
                  <span className="text-sm text-red-400">Export failed: {exportError}</span>
                )}

                {/* Delete */}
                {showDeleteConfirm ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-[#a3a3a3]">Delete playlist?</span>
                    <button
                      onClick={() => deletePlaylist.mutate({ id })}
                      disabled={deletePlaylist.isPending}
                      className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-full px-4 py-2 text-sm transition-colors"
                    >
                      {deletePlaylist.isPending ? 'Deleting…' : 'Confirm'}
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="border border-[#404040] text-white rounded-full px-4 py-2 text-sm transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="text-sm text-[#a3a3a3] hover:text-red-400 transition-colors"
                  >
                    Delete
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Track list */}
      <div className="space-y-2">
        {playlist.tracks.length === 0 && (
          <p className="text-[#a3a3a3] text-sm">No tracks yet. Explore music and add tracks here.</p>
        )}
        {playlist.tracks.map((item, idx) => (
          <div
            key={item.id}
            className="flex items-center gap-3 px-4 py-2 rounded-xl hover:bg-[#171717] group transition-colors"
          >
            <span className="text-sm text-[#525252] w-6 text-right shrink-0">{idx + 1}</span>
            <div className="flex-1 min-w-0">
              <TrackCard trackId={item.trackId} />
            </div>
            <button
              onClick={() => removeTrack.mutate({ playlistId: id, trackId: item.trackId })}
              className="opacity-0 group-hover:opacity-100 text-xs text-[#a3a3a3] hover:text-red-400 transition-all shrink-0"
              aria-label="Remove from playlist"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
