import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { trpc } from '../../lib/trpc';
import { useAuthStore } from '../../store/auth';

WebBrowser.maybeCompleteAuthSession();

const SPOTIFY_CLIENT_ID = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID ?? '';
const SPOTIFY_SCOPES = [
  'user-read-private',
  'user-read-email',
  'user-top-read',
  'user-read-recently-played',
  'playlist-modify-public',
  'playlist-modify-private',
];

const PROVIDER_LABELS: Record<string, string> = {
  spotify: 'Spotify',
  apple_music: 'Apple Music',
  lastfm: 'Last.fm',
  youtube: 'YouTube',
};

export default function ConnectionsScreen() {
  const router = useRouter();
  const { accessToken } = useAuthStore();

  const { data: providers, isLoading, refetch } = trpc.providers.list.useQuery();

  const disconnectMutation = trpc.providers.disconnect.useMutation({
    onSuccess: () => refetch(),
    onError: (err) => Alert.alert('Error', err.message),
  });

  const importMutation = trpc.providers.importHistory.useMutation({
    onSuccess: (data) => {
      Alert.alert('Import started', `Job ID: ${data.jobId}\nThis may take a few minutes.`);
    },
    onError: (err) => Alert.alert('Error', err.message),
  });

  const redirectUri = AuthSession.makeRedirectUri({ scheme: 'soundscape', path: 'auth/spotify' });

  const [spotifyRequest, spotifyResponse, promptSpotifyAsync] = AuthSession.useAuthRequest(
    {
      clientId: SPOTIFY_CLIENT_ID,
      scopes: SPOTIFY_SCOPES,
      usePKCE: true,
      redirectUri,
    },
    {
      authorizationEndpoint: 'https://accounts.spotify.com/authorize',
      tokenEndpoint: 'https://accounts.spotify.com/api/token',
    }
  );

  const handleConnectSpotify = async () => {
    const result = await promptSpotifyAsync();
    if (result?.type === 'success') {
      // The OAuth callback is handled server-side; show success
      Alert.alert('Spotify connected', 'Your Spotify account has been connected.');
      refetch();
    } else if (result?.type === 'error') {
      Alert.alert('Connection failed', result.error?.message ?? 'Unknown error');
    }
  };

  const connectedProviders = new Set(providers?.map((p) => p.provider) ?? []);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#22c55e" size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.backText}>‹ Back</Text>
        </Pressable>
        <Text style={styles.title}>Connected Accounts</Text>
      </View>

      {/* Connected providers list */}
      {providers && providers.length > 0 ? (
        <FlatList
          data={providers}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.providerRow}>
              <View style={styles.providerInfo}>
                <Text style={styles.providerName}>{PROVIDER_LABELS[item.provider] ?? item.provider}</Text>
                <Text style={styles.connectedLabel}>Connected</Text>
              </View>
              <View style={styles.providerActions}>
                {(item.provider === 'spotify' || item.provider === 'lastfm') && (
                  <Pressable
                    style={[styles.actionButton, styles.importButton]}
                    onPress={() =>
                      importMutation.mutate({
                        provider: item.provider as 'spotify' | 'lastfm',
                      })
                    }
                    disabled={importMutation.isPending}
                  >
                    <Text style={styles.importText}>Import</Text>
                  </Pressable>
                )}
                <Pressable
                  style={[styles.actionButton, styles.disconnectButton]}
                  onPress={() =>
                    Alert.alert(
                      'Disconnect',
                      `Disconnect ${PROVIDER_LABELS[item.provider] ?? item.provider}?`,
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Disconnect',
                          style: 'destructive',
                          onPress: () =>
                            disconnectMutation.mutate({
                              provider: item.provider as 'spotify' | 'apple_music' | 'lastfm' | 'youtube',
                            }),
                        },
                      ]
                    )
                  }
                >
                  <Text style={styles.disconnectText}>Disconnect</Text>
                </Pressable>
              </View>
            </View>
          )}
        />
      ) : (
        <Text style={styles.emptyText}>No accounts connected yet.</Text>
      )}

      {/* Connect Spotify */}
      {!connectedProviders.has('spotify') && (
        <View style={styles.connectSection}>
          <Pressable
            style={[styles.connectButton, !spotifyRequest && styles.buttonDisabled]}
            onPress={handleConnectSpotify}
            disabled={!spotifyRequest}
          >
            <Text style={styles.connectText}>Connect Spotify</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0a' },
  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, gap: 4 },
  backText: { color: '#22c55e', fontSize: 16, fontWeight: '500', marginBottom: 8 },
  title: { color: '#fff', fontSize: 28, fontWeight: '700' },
  list: { paddingHorizontal: 16, paddingTop: 8 },
  providerRow: {
    backgroundColor: '#171717',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#262626',
  },
  providerInfo: { gap: 2 },
  providerName: { color: '#fff', fontSize: 16, fontWeight: '600' },
  connectedLabel: { color: '#22c55e', fontSize: 12 },
  providerActions: { flexDirection: 'row', gap: 8 },
  actionButton: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  importButton: { backgroundColor: '#262626' },
  importText: { color: '#fff', fontSize: 13, fontWeight: '500' },
  disconnectButton: { backgroundColor: '#3f1111' },
  disconnectText: { color: '#f87171', fontSize: 13, fontWeight: '500' },
  emptyText: { color: '#737373', textAlign: 'center', marginTop: 40, fontSize: 14 },
  connectSection: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#171717',
    marginTop: 'auto',
  },
  connectButton: {
    backgroundColor: '#1DB954',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  connectText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
