import type {
  IProviderAdapter, NormalizedTrack, NormalizedArtist, NormalizedAlbum,
  ProviderTokens, ExportOptions, ExportResult,
} from '@soundscape/types';
import crypto from 'crypto';

const LASTFM_API = 'https://ws.audioscrobbler.com/2.0/';

// ─── Last.fm response shapes ──────────────────────────────────────────────────

type LfmImage = { '#text': string; size: string };

type LfmTrackSearchResult = {
  name: string; artist: string; mbid?: string; url: string;
  streamable?: string; listeners?: string;
  image?: LfmImage[];
};

type LfmTrackInfo = {
  name: string; mbid?: string; url?: string;
  duration?: string;
  artist: { name: string; mbid?: string; url?: string };
  album?: { title: string; mbid?: string; image?: LfmImage[] };
  toptags?: { tag: { name: string }[] };
};

type LfmArtistInfo = {
  name: string; mbid?: string; url?: string;
  image?: LfmImage[];
  tags?: { tag: { name: string }[] };
  stats?: { listeners?: string; playcount?: string };
};

type LfmAlbumInfo = {
  name: string; mbid?: string; url?: string;
  artist: string;
  image?: LfmImage[];
  tracks?: { track: LfmTrackInfo | LfmTrackInfo[] };
  releasedate?: string;
};

type LfmUserTopTrack = {
  name: string; mbid?: string; url?: string;
  duration?: string;
  artist: { name: string; mbid?: string; url?: string };
  image?: LfmImage[];
  '@attr'?: { rank?: string };
};

type LfmRecentTrack = {
  name: string; mbid?: string; url?: string;
  artist: { '#text': string; mbid?: string };
  album?: { '#text': string };
  image?: LfmImage[];
  '@attr'?: { nowplaying?: string };
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Encode a compound Last.fm ID: "artist::track" or "artist::album" */
function encodeCompoundId(artist: string, title: string): string {
  return `${encodeURIComponent(artist)}::${encodeURIComponent(title)}`;
}

/** Decode a compound ID back to [artist, title] */
function decodeCompoundId(id: string): [string, string] {
  const [artist = '', title = ''] = id.split('::').map(decodeURIComponent);
  return [artist, title];
}

function bestImage(images?: LfmImage[]): string | undefined {
  if (!images) return undefined;
  const preferred = ['extralarge', 'large', 'medium', 'small'];
  for (const size of preferred) {
    const found = images.find((i) => i.size === size && i['#text']);
    if (found) return found['#text'];
  }
  return images[0]?.['#text'] || undefined;
}

// ─── Normalizers ─────────────────────────────────────────────────────────────

function normalizeTrackInfo(t: LfmTrackInfo | LfmUserTopTrack | LfmRecentTrack): NormalizedTrack {
  // Unify the different shapes
  let artistName: string;
  let trackName: string;
  let albumTitle: string | undefined;
  let durationMs: number | undefined;
  let images: LfmImage[] | undefined;

  if ('artist' in t && typeof (t as LfmTrackInfo).artist === 'object' && 'name' in (t as LfmTrackInfo).artist) {
    const ti = t as LfmTrackInfo;
    artistName = ti.artist.name;
    trackName = ti.name;
    albumTitle = ti.album?.title;
    durationMs = ti.duration ? parseInt(ti.duration) * 1000 : undefined;
  } else if ('artist' in t && typeof (t as LfmRecentTrack).artist === 'object' && '#text' in (t as LfmRecentTrack).artist) {
    const rt = t as LfmRecentTrack;
    artistName = rt.artist['#text'];
    trackName = rt.name;
    albumTitle = rt.album?.['#text'];
    images = rt.image;
  } else {
    const ut = t as LfmUserTopTrack;
    artistName = ut.artist.name;
    trackName = ut.name;
    durationMs = ut.duration ? parseInt(ut.duration) * 1000 : undefined;
    images = ut.image;
  }

  const id = encodeCompoundId(artistName, trackName);

  return {
    id,
    title: trackName,
    durationMs: durationMs ?? undefined,
    explicit: false,
    previewUrl: undefined,
    streamUrl: ('url' in t && typeof t.url === 'string') ? t.url : undefined,
    providerTrackId: id,
    provider: 'lastfm',
    artists: [{ id: encodeCompoundId('artist', artistName), name: artistName, genres: [] }],
    album: albumTitle
      ? {
          id: encodeCompoundId(artistName, albumTitle),
          title: albumTitle,
          coverUrl: bestImage(images),
          artists: [{ id: encodeCompoundId('artist', artistName), name: artistName, genres: [] }],
        }
      : undefined,
  };
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export class LastFmProvider implements IProviderAdapter {
  readonly provider = 'lastfm' as const;
  private apiKey = process.env.LASTFM_API_KEY ?? '';
  private secret = process.env.LASTFM_SECRET ?? '';

  /** Build signed API signature (md5 of sorted params + secret) */
  private sign(params: Record<string, string>): string {
    const sorted = Object.keys(params)
      .filter((k) => k !== 'format')
      .sort()
      .map((k) => `${k}${params[k]}`)
      .join('');
    return crypto.createHash('md5').update(sorted + this.secret, 'utf8').digest('hex');
  }

  private async call<T>(params: Record<string, string>, signed = false): Promise<T> {
    const base: Record<string, string> = {
      api_key: this.apiKey,
      format: 'json',
      ...params,
    };
    if (signed) {
      base.api_sig = this.sign(base);
    }

    const url = `${LASTFM_API}?${new URLSearchParams(base).toString()}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Last.fm API error ${res.status}: ${params.method}`);
    const json = (await res.json()) as { error?: number; message?: string } & T;
    if (json.error) throw new Error(`Last.fm error ${json.error}: ${json.message}`);
    return json;
  }

  async search(query: string, limit = 20): Promise<NormalizedTrack[]> {
    const data = await this.call<{
      results: { trackmatches: { track: LfmTrackSearchResult[] } };
    }>({ method: 'track.search', track: query, limit: String(limit) });

    const tracks = data.results.trackmatches.track;
    return tracks.map((t) =>
      normalizeTrackInfo({
        name: t.name,
        artist: { name: t.artist },
        url: t.url,
      } as LfmTrackInfo),
    );
  }

  async getTrack(id: string): Promise<NormalizedTrack | null> {
    try {
      const [artist, track] = decodeCompoundId(id);
      const data = await this.call<{ track: LfmTrackInfo }>({
        method: 'track.getInfo',
        artist,
        track,
      });
      return normalizeTrackInfo(data.track);
    } catch {
      return null;
    }
  }

  async getArtist(id: string): Promise<NormalizedArtist | null> {
    try {
      const [, artist] = decodeCompoundId(id);
      const data = await this.call<{ artist: LfmArtistInfo }>({
        method: 'artist.getInfo',
        artist,
      });
      const a = data.artist;
      return {
        id,
        name: a.name,
        imageUrl: bestImage(a.image),
        genres: (a.tags?.tag ?? []).map((t) => t.name),
        popularity: a.stats?.listeners ? parseInt(a.stats.listeners) : undefined,
      };
    } catch {
      return null;
    }
  }

  async getAlbum(id: string): Promise<NormalizedAlbum | null> {
    try {
      const [artist, album] = decodeCompoundId(id);
      const data = await this.call<{ album: LfmAlbumInfo }>({
        method: 'album.getInfo',
        artist,
        album,
      });
      const a = data.album;
      return {
        id,
        title: a.name,
        releaseDate: a.releasedate?.trim() || undefined,
        coverUrl: bestImage(a.image),
        artists: [{ id: encodeCompoundId('artist', a.artist), name: a.artist, genres: [] }],
      };
    } catch {
      return null;
    }
  }

  async getUserTopTracks(tokens: ProviderTokens, limit = 50): Promise<NormalizedTrack[]> {
    // tokens.accessToken holds the Last.fm username
    const username = tokens.accessToken;
    const data = await this.call<{
      toptracks: { track: LfmUserTopTrack[] };
    }>({ method: 'user.getTopTracks', user: username, period: 'overall', limit: String(limit) });

    return (data.toptracks.track ?? []).map(normalizeTrackInfo);
  }

  async getRecentlyPlayed(tokens: ProviderTokens, limit = 50): Promise<NormalizedTrack[]> {
    const username = tokens.accessToken;
    const data = await this.call<{
      recenttracks: { track: LfmRecentTrack[] };
    }>({ method: 'user.getRecentTracks', user: username, limit: String(limit) });

    // Filter out "nowplaying" track if present
    const tracks = (data.recenttracks.track ?? []).filter(
      (t) => !t['@attr']?.nowplaying,
    );
    return tracks.map(normalizeTrackInfo);
  }

  async exportPlaylist(_tokens: ProviderTokens, _tracks: NormalizedTrack[], _options: ExportOptions): Promise<ExportResult> {
    throw new Error('Last.fm does not support playlist export');
  }
}
