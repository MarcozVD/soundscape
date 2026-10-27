import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

interface AuthStore {
  accessToken: string | null;
  refreshToken: string | null;
  setTokens(access: string, refresh: string): Promise<void>;
  clearTokens(): Promise<void>;
  loadTokens(): Promise<void>;
}

export const useAuthStore = create<AuthStore>((set) => ({
  accessToken: null,
  refreshToken: null,

  async setTokens(access: string, refresh: string) {
    await Promise.all([
      SecureStore.setItemAsync('access_token', access),
      SecureStore.setItemAsync('refresh_token', refresh),
    ]);
    set({ accessToken: access, refreshToken: refresh });
  },

  async clearTokens() {
    await Promise.all([
      SecureStore.deleteItemAsync('access_token'),
      SecureStore.deleteItemAsync('refresh_token'),
    ]);
    set({ accessToken: null, refreshToken: null });
  },

  async loadTokens() {
    const [access, refresh] = await Promise.all([
      SecureStore.getItemAsync('access_token'),
      SecureStore.getItemAsync('refresh_token'),
    ]);
    set({ accessToken: access, refreshToken: refresh });
  },
}));
