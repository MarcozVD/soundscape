import type {
  IProviderAdapter, NormalizedTrack, NormalizedArtist, NormalizedAlbum,
  ProviderTokens, ExportOptions, ExportResult,
} from '@soundscape/types';

const YOUTUBE_API = 'https://www.googleapis.com/youtube/v3';

// ─── YouTube API shapes ───────────────────────────────────────────────────────

type YtThumbnails = {
  default?: { url: string }; medium?: { url: string }; high?: { url: string };
  standard?: { url: string }; maxres?: { url: string };
};

type YtSnippet = {
  title: string;
  channelId: string;
  channelTitle: string;
  description?: string;
  publishedAt?: string;
  thumbnails?: YtThumbnails;
};

type YtVideoItem = {
  id: string;
  snippet: YtSnippet;
  contentDetails?: { duration?: string };
};

type YtChannelItem = {
  id: string;
  snippet: { title: string; description?: string; thumbnails?: YtThumbnails };
};

type YtPlaylistItem = {
  id: string;
  snippet: { title: string; description?: string; thumbnails?: YtThumbnails; channelTitle: string };
};

type YtPlaylistVideoItem = {
  snippet: { resourceId: { videoId: string }; title: string; thumbnails?: YtThumbnails; channelTitle: string };
};

type YtSearchItem = {
  id: { videoId?: string };
  snippet: YtSnippet;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Parse ISO 8601 duration (PT4M33S) into milliseconds */
function parseDuration(iso?: string): number | undefined {
  if (!iso) return undefined;
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return undefined;
  const [, h = '0', m = '0', s = '0'] = match;
  return (parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(s)) * 1000;
}

function bestThumbnail(thumbnails?: YtThumbnails): string | undefined {
  if (!thumbnails) return undefined;
  return (
    thumbnails.maxres?.url ??
    thumbnails.standard?.url ??
    thumbnails.high?.url ??
    thumbnails.medium?.url ??
    thumbnails.default?.url
  );
}

// ─── Normalizers ─────────────────────────────────────────────────────────────

function normalizeVideoItem(item: YtVideoItem): NormalizedTrack {
  return {
    id: item.id,
    title: item.snippet.title,
    durationMs: parseDuration(item.contentDetails?.duration),
    explicit: false,
    previewUrl: undefined,
    streamUrl: `https://www.youtube.com/watch?v=${item.id}`,
    providerTrackId: item.id,
    provider: 'youtube',
    artists: [{ id: item.snippet.channelId, name: item.snippet.channelTitle, genres: [] }],
    album: undefined,
  };
}

function normalizeSearchItem(item: YtSearchItem): NormalizedTrack {
  const videoId = item.id.videoId ?? '';
  return {
    id: videoId,
    title: item.snippet.title,
    explicit: false,
    previewUrl: undefined,
    streamUrl: `https://www.youtube.com/watch?v=${videoId}`,
    providerTrackId: videoId,
    provider: 'youtube',
    artists: [{ id: item.snippet.channelId, name: item.snippet.channelTitle, genres: [] }],
    album: {
      id: item.snippet.channelId,
      title: item.snippet.channelTitle,
      coverUrl: bestThumbnail(item.snippet.thumbnails),
      artists: [{ id: item.snippet.channelId, name: item.snippet.channelTitle, genres: [] }],
    },
  };
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export class YouTubeMusicProvider implements IProviderAdapter {
  readonly provider = 'youtube' as const;
  private apiKey = process.env.YOUTUBE_API_KEY ?? '';

  private async get<T>(path: string, userToken?: string): Promise<T> {
    const url = new URL(`${YOUTUBE_API}${path}`);
    if (!userToken) {
      // Public endpoints require API key
      url.searchParams.set('key', this.apiKey);
    }
    const headers: Record<string, string> = {};
    if (userToken) headers['Authorization'] = `Bearer ${userToken}`;

    const res = await fetch(url.toString(), { headers });
    if (!res.ok) throw new Error(`YouTube API error ${res.status}: ${path}`);
    return res.json() as Promise<T>;
  }

  private async post<T>(path: string, body: unknown, userToken: string): Promise<T> {
    const url = new URL(`${YOUTUBE_API}${path}`);
    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${userToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`YouTube API error ${res.status}: ${path}`);
    return res.json() as Promise<T>;
  }

  async search(query: string, limit = 20): Promise<NormalizedTrack[]> {
    // videoCategoryId=10 = Music
    const data = await this.get<{ items: YtSearchItem[] }>(
      `/search?part=snippet&type=video&videoCategoryId=10&q=${encodeURIComponent(query)}&maxResults=${limit}`,
    );
    return (data.items ?? [])
      .filter((i) => i.id.videoId)
      .map(normalizeSearchItem);
  }

  async getTrack(id: string): Promise<NormalizedTrack | null> {
    try {
      const data = await this.get<{ items: YtVideoItem[] }>(
        `/videos?part=snippet,contentDetails&id=${id}`,
      );
      const item = data.items[0];
      return item ? normalizeVideoItem(item) : null;
    } catch {
      return null;
    }
  }

  async getArtist(id: string): Promise<NormalizedArtist | null> {
    try {
      const data = await this.get<{ items: YtChannelItem[] }>(
        `/channels?part=snippet&id=${id}`,
      );
      const ch = data.items[0];
      if (!ch) return null;
      return {
        id: ch.id,
        name: ch.snippet.title,
        imageUrl: bestThumbnail(ch.snippet.thumbnails),
        genres: [],
      };
    } catch {
      return null;
    }
  }

  async getAlbum(id: string): Promise<NormalizedAlbum | null> {
    try {
      const data = await this.get<{ items: YtPlaylistItem[] }>(
        `/playlists?part=snippet&id=${id}`,
      );
      const pl = data.items[0];
      if (!pl) return null;
      return {
        id: pl.id,
        title: pl.snippet.title,
        coverUrl: bestThumbnail(pl.snippet.thumbnails),
        artists: [{ id: id, name: pl.snippet.channelTitle, genres: [] }],
      };
    } catch {
      return null;
    }
  }

  async getUserTopTracks(_tokens: ProviderTokens, _limit?: number): Promise<NormalizedTrack[]> {
    // YouTube does not expose a "top tracks" endpoint
    return [];
  }

  async getRecentlyPlayed(tokens: ProviderTokens, limit = 50): Promise<NormalizedTrack[]> {
    // Uses the liked videos playlist (caller must pass likedPlaylistId in token extras)
    const likedPlaylistId = (tokens as ProviderTokens & { likedPlaylistId?: string }).likedPlaylistId;
    if (!likedPlaylistId) return [];

    const data = await this.get<{ items: YtPlaylistVideoItem[] }>(
      `/playlistItems?part=snippet&playlistId=${encodeURIComponent(likedPlaylistId)}&maxResults=${limit}`,
      tokens.accessToken,
    );

    return (data.items ?? []).map((item) => ({
      id: item.snippet.resourceId.videoId,
      title: item.snippet.title,
      explicit: false,
      previewUrl: undefined,
      streamUrl: `https://www.youtube.com/watch?v=${item.snippet.resourceId.videoId}`,
      providerTrackId: item.snippet.resourceId.videoId,
      provider: 'youtube' as const,
      artists: [{ id: '', name: item.snippet.channelTitle, genres: [] }],
      album: {
        id: likedPlaylistId,
        title: 'Liked Videos',
        coverUrl: bestThumbnail(item.snippet.thumbnails),
        artists: [{ id: '', name: item.snippet.channelTitle, genres: [] }],
      },
    }));
  }

  async exportPlaylist(tokens: ProviderTokens, tracks: NormalizedTrack[], options: ExportOptions): Promise<ExportResult> {
    // 1. Create the YouTube playlist
    const playlist = await this.post<{ id: string; status: { privacyStatus: string } }>(
      '/playlists?part=snippet,status',
      {
        snippet: {
          title: options.playlistName,
          description: options.description ?? '',
        },
        status: {
          privacyStatus: options.isPublic ? 'public' : 'private',
        },
      },
      tokens.accessToken,
    );

    const playlistId = playlist.id;
    const unmatched: string[] = [];
    let exported = 0;

    for (const track of tracks) {
      // Resolve video ID
      let videoId: string | undefined;

      if (track.provider === 'youtube' && track.providerTrackId) {
        videoId = track.providerTrackId;
      } else {
        // Search YouTube for the track
        const results = await this.search(`${track.title} ${track.artists[0]?.name ?? ''}`, 1);
        videoId = results[0]?.providerTrackId;
      }

      if (!videoId) {
        unmatched.push(track.title);
        continue;
      }

      try {
        await this.post(
          '/playlistItems?part=snippet',
          {
            snippet: {
              playlistId,
              resourceId: { kind: 'youtube#video', videoId },
            },
          },
          tokens.accessToken,
        );
        exported++;
      } catch {
        unmatched.push(track.title);
      }
    }

    return {
      providerPlaylistId: playlistId,
      url: `https://www.youtube.com/playlist?list=${playlistId}`,
      tracksExported: exported,
      unmatched,
    };
  }
}
