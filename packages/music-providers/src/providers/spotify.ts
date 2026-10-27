import type {
  IProviderAdapter, NormalizedTrack, NormalizedArtist, NormalizedAlbum,
  ProviderTokens, ExportOptions, ExportResult,
} from '@soundscape/types';

const SPOTIFY_API = 'https://api.spotify.com/v1';

type SpotifyImage = { url: string; width: number; height: number };
type SpotifyArtistSimple = { id: string; name: string };
type SpotifyTrackFull = {
  id: string; name: string; duration_ms: number; explicit: boolean;
  preview_url: string | null; external_ids: { isrc?: string };
  artists: SpotifyArtistSimple[];
  album: { id: string; name: string; images: SpotifyImage[]; release_date: string; album_type: string; total_tracks: number; artists: SpotifyArtistSimple[] };
};

function normalizeTrack(t: SpotifyTrackFull): NormalizedTrack {
  return {
    id: t.id,
    isrc: t.external_ids.isrc,
    title: t.name,
    durationMs: t.duration_ms,
    explicit: t.explicit,
    previewUrl: t.preview_url ?? undefined,
    streamUrl: `https://open.spotify.com/track/${t.id}`,
    providerTrackId: t.id,
    provider: 'spotify',
    artists: t.artists.map((a) => ({ id: a.id, name: a.name, genres: [] })),
    album: {
      id: t.album.id,
      title: t.album.name,
      releaseDate: t.album.release_date,
      albumType: t.album.album_type as NormalizedAlbum['albumType'],
      coverUrl: t.album.images[0]?.url,
      totalTracks: t.album.total_tracks,
      artists: t.album.artists.map((a) => ({ id: a.id, name: a.name, genres: [] })),
    },
  };
}

export class SpotifyProvider implements IProviderAdapter {
  readonly provider = 'spotify' as const;
  private clientId = process.env.SPOTIFY_CLIENT_ID ?? '';
  private clientSecret = process.env.SPOTIFY_CLIENT_SECRET ?? '';
  private _appToken: { token: string; expiresAt: number } | null = null;

  private async appToken(): Promise<string> {
    if (this._appToken && Date.now() < this._appToken.expiresAt - 5000) return this._appToken.token;

    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
      },
      body: 'grant_type=client_credentials',
    });
    const data = (await res.json()) as { access_token: string; expires_in: number };
    this._appToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
    return this._appToken.token;
  }

  private async get<T>(path: string, token?: string): Promise<T> {
    const t = token ?? (await this.appToken());
    const res = await fetch(`${SPOTIFY_API}${path}`, { headers: { Authorization: `Bearer ${t}` } });
    if (!res.ok) throw new Error(`Spotify API error ${res.status}: ${path}`);
    return res.json() as Promise<T>;
  }

  async search(query: string, limit = 20): Promise<NormalizedTrack[]> {
    const data = await this.get<{ tracks: { items: SpotifyTrackFull[] } }>(
      `/search?type=track&q=${encodeURIComponent(query)}&limit=${limit}`
    );
    return data.tracks.items.map(normalizeTrack);
  }

  async getTrack(id: string): Promise<NormalizedTrack | null> {
    try {
      return normalizeTrack(await this.get<SpotifyTrackFull>(`/tracks/${id}`));
    } catch {
      return null;
    }
  }

  async getArtist(id: string): Promise<NormalizedArtist | null> {
    try {
      const a = await this.get<{ id: string; name: string; images: SpotifyImage[]; genres: string[]; popularity: number }>(`/artists/${id}`);
      return { id: a.id, name: a.name, imageUrl: a.images[0]?.url, genres: a.genres, popularity: a.popularity };
    } catch {
      return null;
    }
  }

  async getAlbum(id: string): Promise<NormalizedAlbum | null> {
    try {
      const a = await this.get<{
        id: string; name: string; release_date: string; album_type: string;
        total_tracks: number; images: SpotifyImage[];
        artists: SpotifyArtistSimple[];
      }>(`/albums/${id}`);
      return {
        id: a.id, title: a.name, releaseDate: a.release_date,
        albumType: a.album_type as NormalizedAlbum['albumType'],
        coverUrl: a.images[0]?.url, totalTracks: a.total_tracks,
        artists: a.artists.map((art) => ({ id: art.id, name: art.name, genres: [] })),
      };
    } catch {
      return null;
    }
  }

  async getUserTopTracks(tokens: ProviderTokens, limit = 50): Promise<NormalizedTrack[]> {
    const data = await this.get<{ items: SpotifyTrackFull[] }>(
      `/me/top/tracks?limit=${limit}&time_range=medium_term`,
      tokens.accessToken
    );
    return data.items.map(normalizeTrack);
  }

  async getRecentlyPlayed(tokens: ProviderTokens, limit = 50): Promise<NormalizedTrack[]> {
    const data = await this.get<{ items: { track: SpotifyTrackFull; played_at: string }[] }>(
      `/me/player/recently-played?limit=${limit}`,
      tokens.accessToken
    );
    return data.items.map((i) => normalizeTrack(i.track));
  }

  async exportPlaylist(tokens: ProviderTokens, tracks: NormalizedTrack[], options: ExportOptions): Promise<ExportResult> {
    // 1. Get user's Spotify ID
    const me = await this.get<{ id: string }>('/me', tokens.accessToken);

    // 2. Create playlist
    const playlist = await (
      await fetch(`${SPOTIFY_API}/users/${me.id}/playlists`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokens.accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: options.playlistName, description: options.description ?? '', public: options.isPublic ?? false }),
      })
    ).json() as { id: string; external_urls: { spotify: string } };

    // 3. Resolve Spotify track URIs (use ISRC search for unmatched tracks)
    const uris: string[] = [];
    const unmatched: string[] = [];

    for (const track of tracks) {
      const pid = track.provider === 'spotify' ? track.providerTrackId : undefined;
      if (pid) {
        uris.push(`spotify:track:${pid}`);
      } else if (track.isrc) {
        const results = await this.search(`isrc:${track.isrc}`, 1);
        if (results[0]?.providerTrackId) uris.push(`spotify:track:${results[0].providerTrackId}`);
        else unmatched.push(track.title);
      } else {
        const results = await this.search(`${track.title} ${track.artists[0]?.name ?? ''}`, 1);
        if (results[0]?.providerTrackId) uris.push(`spotify:track:${results[0].providerTrackId}`);
        else unmatched.push(track.title);
      }
    }

    // 4. Add tracks in batches of 100
    for (let i = 0; i < uris.length; i += 100) {
      await fetch(`${SPOTIFY_API}/playlists/${playlist.id}/tracks`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokens.accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ uris: uris.slice(i, i + 100) }),
      });
    }

    return {
      providerPlaylistId: playlist.id,
      url: playlist.external_urls.spotify,
      tracksExported: uris.length,
      unmatched,
    };
  }
}
