import { SpotifyProvider } from './providers/spotify';
import { AppleMusicProvider } from './providers/apple';
import { LastFmProvider } from './providers/lastfm';
import { YouTubeMusicProvider } from './providers/youtube';
import type { IProviderAdapter, MusicProvider } from '@soundscape/types';

export { SpotifyProvider } from './providers/spotify';
export { AppleMusicProvider } from './providers/apple';   // Phase 3
export { LastFmProvider } from './providers/lastfm';      // Phase 3
export { YouTubeMusicProvider } from './providers/youtube'; // Phase 3
export type { IProviderAdapter, MusicProvider } from '@soundscape/types';

// ─── Eager singletons for always-available providers ─────────────────────────
const registry = new Map<MusicProvider, IProviderAdapter>([
  ['spotify', new SpotifyProvider()],
]);

// ─── Phase 3: Lazily-initialised providers ────────────────────────────────────
// Missing env vars do NOT crash at startup; errors surface only when used.
const lazyFactories: Partial<Record<MusicProvider, () => IProviderAdapter>> = {
  apple_music: () => new AppleMusicProvider(),
  lastfm: () => new LastFmProvider(),
  youtube: () => new YouTubeMusicProvider(),
};

export function getProvider(provider: MusicProvider): IProviderAdapter {
  const existing = registry.get(provider);
  if (existing) return existing;

  const factory = lazyFactories[provider];
  if (factory) {
    const instance = factory();
    registry.set(provider, instance);
    return instance;
  }

  throw new Error(`Provider not implemented: ${provider}`);
}
