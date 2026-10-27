import { create } from 'zustand';

interface Track {
  id: string;
  title: string;
  artist: string;
  coverUrl?: string;
  previewUrl: string;
}

interface PlayerState {
  currentTrack: Track | null;
  isPlaying: boolean;
  audio: HTMLAudioElement | null;
  play: (track: Track) => void;
  pause: () => void;
  toggle: () => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentTrack: null,
  isPlaying: false,
  audio: null,

  play(track) {
    const { audio: prev } = get();
    prev?.pause();

    const audio = new Audio(track.previewUrl);
    audio.play().catch(() => {});
    audio.addEventListener('ended', () => set({ isPlaying: false }));

    set({ currentTrack: track, isPlaying: true, audio });
  },

  pause() {
    get().audio?.pause();
    set({ isPlaying: false });
  },

  toggle() {
    const { isPlaying, audio } = get();
    if (isPlaying) {
      audio?.pause();
      set({ isPlaying: false });
    } else {
      audio?.play().catch(() => {});
      set({ isPlaying: true });
    }
  },
}));
