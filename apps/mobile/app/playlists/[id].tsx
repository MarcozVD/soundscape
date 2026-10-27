import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  ScrollView,
} from 'react-native';
import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { trpc } from '../../lib/trpc';

function TrackRow({
  track,
  onRemove,
}: {
  track: { id: string; title: string; artistName?: string };
  onRemove: () => void;
}) {
  return (
    <View style={styles.trackRow}>
      <View style={styles.trackCover} />
      <View style={styles.trackInfo}>
        <Text style={styles.trackTitle} numberOfLines={1}>{track.title}</Text>
        {track.artistName ? (
          <Text style={styles.trackArtist} numberOfLines={1}>{track.artistName}</Text>
        ) : null}
      </View>
      <Pressable style={styles.removeButton} onPress={onRemove} hitSlop={8}>
        <Text style={styles.removeText}>✕</Text>
      </Pressable>
    </View>
  );
}

export default function PlaylistDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [exportStatus, setExportStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [exportUrl, setExportUrl] = useState<string | null>(null);

  const { data: playlist, isLoading, refetch } = trpc.playlists.getById.useQuery(
    { id: id ?? '' },
    { enabled: !!id }
  );

  const removeTrackMutation = trpc.playlists.removeTrack.useMutation({
    onSuccess: () => refetch(),
    onError: (err) => Alert.alert('Error', err.message),
  });

  const exportMutation = trpc.playlists.export.useMutation({
    onSuccess: async (data) => {
      setExportStatus('loading');
      // Poll for completion
      pollExport(data.exportId);
    },
    onError: (err) => {
      setExportStatus('error');
      Alert.alert('Export failed', err.message);
    },
  });

  const getExportStatus = trpc.playlists.getExportStatus.useQuery(
    { exportId: exportUrl ?? '' },
    { enabled: false }
  );

  const pollExport = async (exportId: string) => {
    const maxAttempts = 30;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      try {
        const result = await (getExportStatus as { refetch: (opts: object) => Promise<{ data: { status: string } | null }> }).refetch({ queryKey: [{ exportId }] });
        if (result.data?.status === 'done') {
          setExportStatus('done');
          return;
        }
        if (result.data?.status === 'failed') {
          setExportStatus('error');
          return;
        }
      } catch { /* keep polling */ }
    }
    setExportStatus('error');
  };

  const { data: searchResults, isFetching: isSearching } = trpc.search.query.useQuery(
    { q: debouncedSearch, limit: 20 },
    { enabled: debouncedSearch.length > 0 }
  );

  const addTrackMutation = trpc.playlists.addTrack.useMutation({
    onSuccess: () => {
      refetch();
      setSearchModalVisible(false);
      setSearchQuery('');
      setDebouncedSearch('');
    },
    onError: (err) => Alert.alert('Error', err.message),
  });

  if (isLoading || !playlist) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#22c55e" size="large" />
      </View>
    );
  }

  const tracks = playlist.tracks.map((pt) => ({
    id: pt.track.id,
    title: pt.track.title,
    artistName: pt.track.trackArtists[0]?.artist?.name,
  }));

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Back button */}
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backText}>‹ Back</Text>
        </Pressable>

        {/* Playlist cover + info */}
        <View style={styles.coverContainer}>
          <View style={styles.coverArt} />
        </View>

        <Text style={styles.playlistTitle}>{playlist.title}</Text>
        {playlist.description ? (
          <Text style={styles.playlistDesc}>{playlist.description}</Text>
        ) : null}
        <Text style={styles.trackCountText}>{tracks.length} tracks</Text>

        {/* Export button */}
        <Pressable
          style={[styles.exportButton, exportStatus === 'loading' && styles.buttonDisabled]}
          onPress={() => exportMutation.mutate({ playlistId: playlist.id, provider: 'spotify' })}
          disabled={exportStatus === 'loading' || exportMutation.isPending}
        >
          {exportStatus === 'loading' || exportMutation.isPending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.exportText}>
              {exportStatus === 'done' ? '✓ Exported to Spotify' : 'Export to Spotify'}
            </Text>
          )}
        </Pressable>

        {/* Tracks list */}
        <View style={styles.tracksSection}>
          <Text style={styles.sectionTitle}>Tracks</Text>
          {tracks.map((track) => (
            <TrackRow
              key={track.id}
              track={track}
              onRemove={() =>
                removeTrackMutation.mutate({ playlistId: playlist.id, trackId: track.id })
              }
            />
          ))}
        </View>

        {/* Add tracks button */}
        <Pressable
          style={styles.addTracksButton}
          onPress={() => setSearchModalVisible(true)}
        >
          <Text style={styles.addTracksText}>+ Add Tracks</Text>
        </Pressable>
      </ScrollView>

      {/* Search modal */}
      <Modal
        visible={searchModalVisible}
        animationType="slide"
        onRequestClose={() => setSearchModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Tracks</Text>
            <Pressable onPress={() => setSearchModalVisible(false)}>
              <Text style={styles.modalClose}>✕</Text>
            </Pressable>
          </View>

          <TextInput
            style={styles.searchInput}
            placeholder="Search tracks…"
            placeholderTextColor="#737373"
            value={searchQuery}
            onChangeText={(text) => {
              setSearchQuery(text);
              clearTimeout((globalThis as { _st?: ReturnType<typeof setTimeout> })._st);
              (globalThis as { _st?: ReturnType<typeof setTimeout> })._st = setTimeout(
                () => setDebouncedSearch(text.trim()),
                300
              );
            }}
            autoFocus
          />

          {isSearching && <ActivityIndicator color="#22c55e" style={{ marginTop: 16 }} />}

          <FlatList
            data={(searchResults as Array<{ id: string; title?: string; artists?: string | string[] }> | undefined) ?? []}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <Pressable
                style={styles.searchResult}
                onPress={() => addTrackMutation.mutate({ playlistId: playlist.id, trackId: item.id })}
              >
                <View style={styles.resultCover} />
                <View style={styles.resultInfo}>
                  <Text style={styles.resultTitle} numberOfLines={1}>{item.title ?? 'Unknown'}</Text>
                  <Text style={styles.resultArtist} numberOfLines={1}>
                    {Array.isArray(item.artists) ? item.artists[0] : item.artists ?? ''}
                  </Text>
                </View>
                <Text style={styles.addIcon}>+</Text>
              </Pressable>
            )}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0a' },
  scroll: { padding: 16, paddingBottom: 60 },
  backButton: { marginBottom: 16 },
  backText: { color: '#22c55e', fontSize: 16, fontWeight: '500' },
  coverContainer: { alignItems: 'center', marginBottom: 16 },
  coverArt: {
    width: 200,
    height: 200,
    borderRadius: 16,
    backgroundColor: '#262626',
  },
  playlistTitle: { color: '#fff', fontSize: 26, fontWeight: '700', textAlign: 'center' },
  playlistDesc: { color: '#a3a3a3', fontSize: 14, textAlign: 'center', marginTop: 4 },
  trackCountText: { color: '#737373', fontSize: 13, textAlign: 'center', marginTop: 4, marginBottom: 16 },
  exportButton: {
    backgroundColor: '#1DB954',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 24,
  },
  buttonDisabled: { opacity: 0.6 },
  exportText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  tracksSection: { gap: 2, marginBottom: 16 },
  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: '600', marginBottom: 8 },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#171717',
  },
  trackCover: { width: 44, height: 44, borderRadius: 6, backgroundColor: '#262626' },
  trackInfo: { flex: 1 },
  trackTitle: { color: '#fff', fontSize: 14, fontWeight: '500' },
  trackArtist: { color: '#a3a3a3', fontSize: 12, marginTop: 2 },
  removeButton: { padding: 4 },
  removeText: { color: '#737373', fontSize: 13 },
  addTracksButton: {
    borderWidth: 1,
    borderColor: '#262626',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  addTracksText: { color: '#22c55e', fontWeight: '600', fontSize: 15 },
  // Modal
  modalContainer: { flex: 1, backgroundColor: '#0a0a0a', paddingTop: 48 },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  modalTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  modalClose: { color: '#737373', fontSize: 20 },
  searchInput: {
    backgroundColor: '#171717',
    borderWidth: 1,
    borderColor: '#262626',
    borderRadius: 12,
    marginHorizontal: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 15,
    marginBottom: 8,
  },
  searchResult: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#171717',
  },
  resultCover: { width: 44, height: 44, borderRadius: 6, backgroundColor: '#262626' },
  resultInfo: { flex: 1 },
  resultTitle: { color: '#fff', fontSize: 14, fontWeight: '500' },
  resultArtist: { color: '#a3a3a3', fontSize: 12, marginTop: 2 },
  addIcon: { color: '#22c55e', fontSize: 22, fontWeight: '600' },
});
