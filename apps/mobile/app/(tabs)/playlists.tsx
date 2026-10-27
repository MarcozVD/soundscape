import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Modal,
  TextInput,
  Switch,
  Alert,
} from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { trpc } from '../../lib/trpc';

export default function PlaylistsScreen() {
  const router = useRouter();
  const [modalVisible, setModalVisible] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [isPublic, setIsPublic] = useState(false);

  const { data: playlists, isLoading, refetch } = trpc.playlists.list.useQuery();

  const createMutation = trpc.playlists.create.useMutation({
    onSuccess: () => {
      setModalVisible(false);
      setNewTitle('');
      setIsPublic(false);
      refetch();
    },
    onError: (err) => Alert.alert('Error', err.message),
  });

  const handleCreate = () => {
    if (!newTitle.trim()) {
      Alert.alert('Error', 'Playlist title is required');
      return;
    }
    createMutation.mutate({ title: newTitle.trim(), isPublic });
  };

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
        <Text style={styles.title}>My Playlists</Text>
        <Pressable style={styles.addButton} onPress={() => setModalVisible(true)}>
          <Text style={styles.addButtonText}>+</Text>
        </Pressable>
      </View>

      {/* Playlists list */}
      <FlatList
        data={playlists ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No playlists yet. Tap + to create one.</Text>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.playlistRow}
            onPress={() => router.push(`/playlists/${item.id}`)}
          >
            <View style={styles.cover} />
            <View style={styles.playlistInfo}>
              <Text style={styles.playlistTitle} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.trackCount}>
                {(item as { _count?: { tracks?: number } })._count?.tracks ?? 0} tracks
                {item.isPublic ? ' · Public' : ''}
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        )}
      />

      {/* Create Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>New Playlist</Text>

            <TextInput
              style={styles.input}
              placeholder="Playlist title"
              placeholderTextColor="#737373"
              value={newTitle}
              onChangeText={setNewTitle}
              autoFocus
            />

            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Public</Text>
              <Switch
                value={isPublic}
                onValueChange={setIsPublic}
                trackColor={{ false: '#262626', true: '#22c55e' }}
                thumbColor="#fff"
              />
            </View>

            <View style={styles.modalActions}>
              <Pressable
                style={styles.cancelButton}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.createButton, createMutation.isPending && styles.buttonDisabled]}
                onPress={handleCreate}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? (
                  <ActivityIndicator color="#0a0a0a" size="small" />
                ) : (
                  <Text style={styles.createText}>Create</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0a' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  title: { color: '#fff', fontSize: 28, fontWeight: '700' },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#22c55e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: { color: '#0a0a0a', fontSize: 22, fontWeight: '700', lineHeight: 26 },
  playlistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#171717',
  },
  cover: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#262626',
  },
  playlistInfo: { flex: 1 },
  playlistTitle: { color: '#fff', fontSize: 15, fontWeight: '600' },
  trackCount: { color: '#a3a3a3', fontSize: 13, marginTop: 2 },
  chevron: { color: '#737373', fontSize: 20 },
  emptyText: { color: '#737373', textAlign: 'center', marginTop: 60, fontSize: 14 },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#171717',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    gap: 16,
  },
  modalTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  input: {
    backgroundColor: '#0a0a0a',
    borderWidth: 1,
    borderColor: '#262626',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 15,
  },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleLabel: { color: '#fff', fontSize: 15 },
  modalActions: { flexDirection: 'row', gap: 12 },
  cancelButton: {
    flex: 1,
    backgroundColor: '#262626',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelText: { color: '#fff', fontWeight: '600' },
  createButton: {
    flex: 1,
    backgroundColor: '#22c55e',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  createText: { color: '#0a0a0a', fontWeight: '700' },
});
