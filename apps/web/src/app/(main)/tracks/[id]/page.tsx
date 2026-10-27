'use client';

import { useState, use } from 'react';
import { trpc } from '@/lib/trpc';
import { usePlayerStore } from '@/store/player';
import { RatingWidget } from '@/components/RatingWidget';

interface PageProps {
  params: Promise<{ id: string }>;
}

function formatDuration(ms: number | null | undefined): string {
  if (!ms) return '--:--';
  const totalSecs = Math.floor(ms / 1000);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function TrackDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const play = usePlayerStore((s) => s.play);
  const utils = trpc.useUtils();

  const { data: track, isLoading: trackLoading } = trpc.tracks.getById.useQuery({ id });
  const { data: commentsData } = trpc.comments.list.useQuery(
    { entityType: 'track', entityId: id },
    { enabled: !!id }
  );
  const { data: playlists } = trpc.playlists.list.useQuery();
  const { data: me } = trpc.auth.me.useQuery();

  const [commentBody, setCommentBody] = useState('');
  const [playlistDropdownOpen, setPlaylistDropdownOpen] = useState(false);
  const [addedToPlaylist, setAddedToPlaylist] = useState<string | null>(null);

  const createComment = trpc.comments.create.useMutation({
    onSuccess: () => {
      setCommentBody('');
      void utils.comments.list.invalidate({ entityType: 'track', entityId: id });
    },
  });

  const deleteComment = trpc.comments.delete.useMutation({
    onSuccess: () => {
      void utils.comments.list.invalidate({ entityType: 'track', entityId: id });
    },
  });

  const addToPlaylist = trpc.playlists.addTrack.useMutation({
    onSuccess: (_, vars) => {
      setAddedToPlaylist(vars.playlistId);
      setPlaylistDropdownOpen(false);
      setTimeout(() => setAddedToPlaylist(null), 2000);
    },
  });

  if (trackLoading) {
    return (
      <div className="p-8 space-y-6 animate-pulse">
        <div className="flex gap-6">
          <div className="w-52 h-52 rounded-xl bg-[#262626]" />
          <div className="flex-1 space-y-3 pt-2">
            <div className="h-8 bg-[#262626] rounded w-2/3" />
            <div className="h-5 bg-[#262626] rounded w-1/3" />
            <div className="h-4 bg-[#262626] rounded w-1/4" />
          </div>
        </div>
      </div>
    );
  }

  if (!track) {
    return (
      <div className="p-8">
        <p className="text-[#a3a3a3]">Track not found.</p>
      </div>
    );
  }

  const artists = track.trackArtists.map((ta) => ta.artist.name).join(', ');
  const album = track.albumTracks[0]?.album;
  const cover = album?.coverUrl ?? null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const previewUrl = (track.providerIds as any[]).find((p: { provider: string }) => p.provider === 'spotify')?.previewUrl as string | null ?? null;

  return (
    <div className="p-8 space-y-8 max-w-4xl">
      {/* Hero */}
      <div className="flex flex-col sm:flex-row gap-6">
        <div className="w-52 h-52 shrink-0 rounded-xl overflow-hidden bg-[#262626]">
          {cover ? (
            <img src={cover} alt={track.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-5xl text-[#525252]">♪</div>
          )}
        </div>

        <div className="flex flex-col justify-end gap-3">
          <div>
            <h1 className="text-3xl font-bold text-white">{track.title}</h1>
            <p className="text-lg text-[#a3a3a3] mt-1">{artists}</p>
            {album && <p className="text-sm text-[#525252] mt-0.5">{album.title}</p>}
          </div>

          <div className="flex items-center gap-3 text-sm text-[#a3a3a3]">
            <span>{formatDuration(track.durationMs)}</span>
            {track.releaseDate && (
              <>
                <span className="w-1 h-1 rounded-full bg-[#525252]" />
                <span>{formatDate(track.releaseDate)}</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {previewUrl && (
              <button
                onClick={() =>
                  play({
                    id: track.id,
                    title: track.title,
                    artist: artists,
                    coverUrl: cover ?? undefined,
                    previewUrl,
                  })
                }
                className="bg-green-500 hover:bg-green-400 text-black font-semibold rounded-full px-6 py-2.5 transition-colors flex items-center gap-2"
              >
                <span>&#9654;</span> Play preview
              </button>
            )}

            {/* Add to playlist dropdown */}
            <div className="relative">
              <button
                onClick={() => setPlaylistDropdownOpen((o) => !o)}
                className="border border-[#404040] hover:border-[#525252] text-white rounded-full px-5 py-2.5 text-sm transition-colors"
              >
                {addedToPlaylist ? 'Added!' : '+ Add to playlist'}
              </button>

              {playlistDropdownOpen && (
                <div className="absolute left-0 mt-2 w-56 bg-[#171717] border border-[#262626] rounded-xl overflow-hidden shadow-xl z-10">
                  {playlists && playlists.length > 0 ? (
                    playlists.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => addToPlaylist.mutate({ playlistId: p.id, trackId: track.id })}
                        className="w-full text-left px-4 py-3 text-sm text-white hover:bg-[#262626] transition-colors"
                      >
                        {p.title}
                      </button>
                    ))
                  ) : (
                    <p className="px-4 py-3 text-sm text-[#a3a3a3]">No playlists yet</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Rating */}
      <div className="bg-[#171717] border border-[#262626] rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Rate this track</h2>
        <RatingWidget trackId={track.id} />
      </div>

      {/* Comments */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-white">
          Comments
          {commentsData && (
            <span className="text-[#a3a3a3] text-base font-normal ml-2">
              ({commentsData.items.length})
            </span>
          )}
        </h2>

        {/* Add comment form */}
        <div className="bg-[#171717] border border-[#262626] rounded-xl p-4 space-y-3">
          <textarea
            value={commentBody}
            onChange={(e) => setCommentBody(e.target.value)}
            placeholder="Add a comment..."
            rows={3}
            className="w-full rounded-xl px-4 py-3 bg-[#262626] border border-[#404040] text-white placeholder-[#525252] focus:outline-none focus:ring-2 focus:ring-green-500 resize-none transition"
          />
          <button
            onClick={() => {
              if (!commentBody.trim()) return;
              createComment.mutate({ entityType: 'track', entityId: id, body: commentBody.trim() });
            }}
            disabled={createComment.isPending || !commentBody.trim()}
            className="bg-green-500 hover:bg-green-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-semibold rounded-full px-6 py-2.5 text-sm transition-colors"
          >
            {createComment.isPending ? 'Posting...' : 'Post comment'}
          </button>
        </div>

        {/* Comment list */}
        <div className="space-y-3">
          {commentsData?.items.map((comment) => (
            <div key={comment.id} className="bg-[#171717] border border-[#262626] rounded-xl p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-[#262626] flex items-center justify-center text-xs font-medium text-[#a3a3a3] shrink-0">
                    {comment.user.displayName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <span className="text-sm font-medium text-white">{comment.user.displayName}</span>
                    <span className="text-xs text-[#525252] ml-2">
                      {formatDate(comment.createdAt)}
                    </span>
                  </div>
                </div>
                {me && comment.user.id === me.id && (
                  <button
                    onClick={() => deleteComment.mutate({ id: comment.id })}
                    className="text-xs text-[#a3a3a3] hover:text-red-400 transition-colors shrink-0"
                  >
                    Delete
                  </button>
                )}
              </div>
              <p className="text-sm text-[#a3a3a3] mt-2 ml-10">{comment.body}</p>

              {/* Replies */}
              {comment.replies && comment.replies.length > 0 && (
                <div className="ml-10 mt-3 space-y-2 border-l-2 border-[#262626] pl-4">
                  {comment.replies.map((reply) => (
                    <div key={reply.id} className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-xs font-medium text-white">{reply.user.displayName}</span>
                        <span className="text-xs text-[#525252] ml-2">{formatDate(reply.createdAt)}</span>
                        <p className="text-xs text-[#a3a3a3] mt-1">{reply.body}</p>
                      </div>
                      {me && reply.user.id === me.id && (
                        <button
                          onClick={() => deleteComment.mutate({ id: reply.id })}
                          className="text-xs text-[#a3a3a3] hover:text-red-400 transition-colors shrink-0"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {commentsData?.items.length === 0 && (
            <p className="text-[#a3a3a3] text-sm">No comments yet. Be the first!</p>
          )}
        </div>
      </div>
    </div>
  );
}
