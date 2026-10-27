import type {
  IProviderAdapter, NormalizedTrack, NormalizedArtist, NormalizedAlbum,
  ProviderTokens, ExportOptions, ExportResult,
} from '@soundscape/types';
import jwt from 'jsonwebtoken';

const APPLE_API = 'https://api.music.apple.com/v1';

// ─── Apple API shapes ────────────────────────────────────────────────────────

type AppleImage = { url: string; width: number; height: number };

type AppleArtworkShape = { url: string; width: number; height: number };

type AppleArtistAttr = { name: string; genreNames: string[]; artwork?: AppleArtworkShape };
type AppleArtistObject = { id: string; attributes?: AppleArtistAttr };

type AppleAlbumAttr = {
  name: string; releaseDate?: string; albumType?: string;
  trackCount?: number; artwork?: AppleImage;
  artistName: string;
};
type AppleAlbumObject = { id: string; attributes?: AppleAlbumAttr };

type AppleSongAttr = {
  name: string; durationInMillis?: number; contentRating?: string;
  isrc?: string; previews?: { url: string }[]; url?: string;
  artistName: string; albumName?: string; artwork?: AppleImage;
  genreNames?: string[];
};
type AppleSongObject = { id: string; attributes?: AppleSongAttr };

// ─── Normalizers ─────────────────────────────────────────────────────────────

function artworkUrl(artwork?: AppleImage | AppleArtworkShape, size = 300): string | undefined {
  if (!artwork) return undefined;
  return artwork.url.replace('{w}', String(size)).replace('{h}', String(size));
}

function normalizeSong(s: AppleSongObject): NormalizedTrack {
  const a = s.attributes;
  return {
    id: s.id,
    isrc: a?.isrc,
    title: a?.name ?? '',
    durationMs: a?.durationInMillis,
    explicit: a?.contentRating === 'explicit',
    previewUrl: a?.previews?.[0]?.url,
    streamUrl: a?.url,
    providerTrackId: s.id,
    provider: 'apple_music',
    artists: [{ id: s.id, name: a?.artistName ?? '', genres: a?.genreNames ?? [] }],
    album: {
      id: s.id,
      title: a?.albumName ?? '',
      coverUrl: artworkUrl(a?.artwork),
      artists: [{ id: s.id, name: a?.artistName ?? '', genres: [] }],
    },
  };
}

function normalizeArtist(a: AppleArtistObject): NormalizedArtist {
  return {
    id: a.id,
    name: a.attributes?.name ?? '',
    imageUrl: artworkUrl(a.attributes?.artwork),
    genres: a.attributes?.genreNames ?? [],
  };
}

function normalizeAlbum(a: AppleAlbumObject): NormalizedAlbum {
  const attr = a.attributes;
  return {
    id: a.id,
    title: attr?.name ?? '',
    releaseDate: attr?.releaseDate,
    albumType: (attr?.albumType?.toLowerCase() as NormalizedAlbum['albumType']) ?? 'album',
    coverUrl: artworkUrl(attr?.artwork),
    totalTracks: attr?.trackCount,
    artists: [{ id: a.id, name: attr?.artistName ?? '', genres: [] }],
  };
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export class AppleMusicProvider implements IProviderAdapter {
  readonly provider = 'apple_music' as const;

  private _cachedDevToken: { token: string; expiresAt: number } | null = null;

  private developerToken(): string {
    const now = Math.floor(Date.now() / 1000);
    if (this._cachedDevToken && now < this._cachedDevToken.expiresAt - 3600) {
      return this._cachedDevToken.token;
    }

    const keyId = process.env.APPLE_MUSIC_KEY_ID;
    const teamId = process.env.APPLE_MUSIC_TEAM_ID;
    const privateKey = process.env.APPLE_MUSIC_PRIVATE_KEY;

    if (!keyId || !teamId || !privateKey) {
      throw new Error('Apple Music credentials not configured (APPLE_MUSIC_KEY_ID, APPLE_MUSIC_TEAM_ID, APPLE_MUSIC_PRIVATE_KEY)');
    }

    // 6 months in seconds
    const expiresIn = 15_777_000;

    const token = jwt.sign(
      { iss: teamId, iat: now, exp: now + expiresIn },
      privateKey,
      { algorithm: 'ES256', header: { alg: 'ES256', kid: keyId } } as jwt.SignOptions,
    );

    this._cachedDevToken = { token, expiresAt: now + expiresIn };
    return token;
  }

  private async get<T>(path: string, userToken?: string): Promise<T> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.developerToken()}`,
    };
    if (userToken) headers['Music-User-Token'] = userToken;

    const res = await fetch(`${APPLE_API}${path}`, { headers });
    if (!res.ok) throw new Error(`Apple Music API error ${res.status}: ${path}`);
    return res.json() as Promise<T>;
  }

  private async post<T>(path: string, body: unknown, userToken: string): Promise<T> {
    const res = await fetch(`${APPLE_API}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.developerToken()}`,
        'Music-User-Token': userToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Apple Music API error ${res.status}: ${path}`);
    return res.json() as Promise<T>;
  }

  async search(query: string, limit = 20): Promise<NormalizedTrack[]> {
    const storefront = 'us';
    const data = await this.get<{ results: { songs?: { data: AppleSongObject[] } } }>(
      `/catalog/${storefront}/search?term=${encodeURIComponent(query)}&types=songs&limit=${limit}`,
    );
    return (data.results.songs?.data ?? []).map(normalizeSong);
  }

  async getTrack(id: string): Promise<NormalizedTrack | null> {
    try {
      const data = await this.get<{ data: AppleSongObject[] }>(`/catalog/us/songs/${id}`);
      const song = data.data[0];
      return song ? normalizeSong(song) : null;
    } catch {
      return null;
    }
  }

  async getArtist(id: string): Promise<NormalizedArtist | null> {
    try {
      const data = await this.get<{ data: AppleArtistObject[] }>(`/catalog/us/artists/${id}`);
      const artist = data.data[0];
      return artist ? normalizeArtist(artist) : null;
    } catch {
      return null;
    }
  }

  async getAlbum(id: string): Promise<NormalizedAlbum | null> {
    try {
      const data = await this.get<{ data: AppleAlbumObject[] }>(`/catalog/us/albums/${id}`);
      const album = data.data[0];
      return album ? normalizeAlbum(album) : null;
    } catch {
      return null;
    }
  }

  async getUserTopTracks(tokens: ProviderTokens, limit = 50): Promise<NormalizedTrack[]> {
    const data = await this.get<{ data: AppleSongObject[] }>(
      `/me/library/songs?limit=${limit}`,
      tokens.accessToken,
    );
    return data.data.map(normalizeSong);
  }

  async getRecentlyPlayed(tokens: ProviderTokens, limit = 50): Promise<NormalizedTrack[]> {
    const data = await this.get<{ data: AppleSongObject[] }>(
      `/me/recent/played/tracks?limit=${limit}`,
      tokens.accessToken,
    );
    return data.data.map(normalizeSong);
  }

  async exportPlaylist(tokens: ProviderTokens, tracks: NormalizedTrack[], options: ExportOptions): Promise<ExportResult> {
    // 1. Create the playlist
    const created = await this.post<{ data: { id: string }[] }>(
      '/me/library/playlists',
      {
        attributes: {
          name: options.playlistName,
          description: options.description ?? '',
        },
      },
      tokens.accessToken,
    );

    const playlistId = created.data[0]?.id;
    if (!playlistId) throw new Error('Apple Music: failed to create playlist');

    // 2. Add tracks in batches of 100
    const unmatched: string[] = [];
    const trackObjects: { id: string; type: 'songs' }[] = [];

    for (const track of tracks) {
      if (track.provider === 'apple_music' && track.providerTrackId) {
        trackObjects.push({ id: track.providerTrackId, type: 'songs' });
      } else if (track.isrc) {
        // Try ISRC lookup on Apple catalog
        try {
          const results = await this.get<{ data: AppleSongObject[] }>(
            `/catalog/us/songs?filter[isrc]=${encodeURIComponent(track.isrc)}`,
          );
          const match = results.data[0];
          if (match) {
            trackObjects.push({ id: match.id, type: 'songs' });
          } else {
            unmatched.push(track.title);
          }
        } catch {
          unmatched.push(track.title);
        }
      } else {
        // Fall back to search
        const results = await this.search(`${track.title} ${track.artists[0]?.name ?? ''}`, 1);
        if (results[0]?.providerTrackId) {
          trackObjects.push({ id: results[0].providerTrackId, type: 'songs' });
        } else {
          unmatched.push(track.title);
        }
      }
    }

    for (let i = 0; i < trackObjects.length; i += 100) {
      await this.post(
        `/me/library/playlists/${playlistId}/tracks`,
        { data: trackObjects.slice(i, i + 100) },
        tokens.accessToken,
      );
    }

    return {
      providerPlaylistId: playlistId,
      url: `https://music.apple.com/library/playlist/${playlistId}`,
      tracksExported: trackObjects.length,
      unmatched,
    };
  }
}
