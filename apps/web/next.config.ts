import type { NextConfig } from 'next';

const config: NextConfig = {
  // 'standalone' requires symlink capability (Linux/Docker). Remove for local Windows dev.
  // output: 'standalone',
  transpilePackages: ['@soundscape/ui', '@soundscape/types', '@soundscape/api-client'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'i.scdn.co' },          // Spotify images
      { protocol: 'https', hostname: '*.mzstatic.com' },      // Apple Music images
      { protocol: 'https', hostname: 'lastfm.freetls.fastly.net' }, // Last.fm
    ],
  },
};

export default config;
