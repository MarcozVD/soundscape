// ─── Normalized music entities (provider-agnostic) ───────────────────────────

export interface NormalizedArtist {
  id: string;
  name: string;
  imageUrl?: string;
  genres: string[];
  popularity?: number;
}

export interface NormalizedAlbum {
  id: string;
  title: string;
  releaseDate?: string;
  albumType?: 'album' | 'single' | 'ep';
  coverUrl?: string;
  totalTracks?: number;
  artists: NormalizedArtist[];
}

export interface NormalizedTrack {
  id: string;
  isrc?: string;
  title: string;
  durationMs?: number;
  explicit: boolean;
  artists: NormalizedArtist[];
  album?: NormalizedAlbum;
  // Provider-specific
  previewUrl?: string;     // Spotify 30s MP3
  streamUrl?: string;      // deep link
  providerTrackId?: string;
  provider?: MusicProvider;
}

export type MusicProvider = 'spotify' | 'apple_music' | 'lastfm' | 'youtube';

// ─── User ─────────────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  email?: string | null;
  displayName: string;
  avatarUrl?: string | null;
  connectedProviders: MusicProvider[];
}

// ─── Recommendations ──────────────────────────────────────────────────────────

export interface RecommendationItem {
  track: NormalizedTrack;
  score: number;
  reason?: string;
}

// ─── Provider adapter interface ───────────────────────────────────────────────

export interface ProviderTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
}

export interface ExportOptions {
  playlistName: string;
  description?: string;
  isPublic?: boolean;
}

export interface ExportResult {
  providerPlaylistId: string;
  url: string;
  tracksExported: number;
  unmatched: string[];
}

export interface IProviderAdapter {
  readonly provider: MusicProvider;
  search(query: string, limit?: number): Promise<NormalizedTrack[]>;
  getTrack(id: string): Promise<NormalizedTrack | null>;
  getArtist(id: string): Promise<NormalizedArtist | null>;
  getAlbum(id: string): Promise<NormalizedAlbum | null>;
  getUserTopTracks(tokens: ProviderTokens, limit?: number): Promise<NormalizedTrack[]>;
  getRecentlyPlayed(tokens: ProviderTokens, limit?: number): Promise<NormalizedTrack[]>;
  exportPlaylist(tokens: ProviderTokens, tracks: NormalizedTrack[], options: ExportOptions): Promise<ExportResult>;
}
