import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Alert,
  ScrollView,
} from 'react-native';
import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Audio } from 'expo-av';
import { useRef } from 'react';
import { trpc } from '../../lib/trpc';

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <View style={styles.stars}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Pressable key={star} onPress={() => onChange(star)} hitSlop={6}>
          <Text style={[styles.star, star <= value && styles.starFilled]}>
            {star <= value ? '★' : '☆'}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function TrackDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const soundRef = useRef<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [rating, setRating] = useState(0);
  const [commentText, setCommentText] = useState('');

  const { data: track, isLoading } = trpc.tracks.getById.useQuery(
    { id: id ?? '' },
    { enabled: !!id }
  );

  const { data: commentsData, refetch: refetchComments } = trpc.comments.list.useQuery(
    { entityType: 'track', entityId: id ?? '', limit: 20 },
    { enabled: !!id }
  );

  const ratingMutation = trpc.ratings.submit.useMutation({
    onError: (err) => Alert.alert('Error', err.message),
  });

  const commentMutation = trpc.comments.create.useMutation({
    onSuccess: () => {
      setCommentText('');
      refetchComments();
    },
    onError: (err) => Alert.alert('Error', err.message),
  });

  const handlePlay = async () => {
    if (!track) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const previewUrl = (track.providerIds as any[]).find((p: { provider: string }) => p.provider === 'spotify')?.previewUrl as string | null | undefined;
    if (!previewUrl) {
      Alert.alert('No preview available');
      return;
    }

    if (isPlaying) {
      await soundRef.current?.pauseAsync();
      setIsPlaying(false);
      return;
    }

    try {
      await soundRef.current?.unloadAsync();
      const { sound } = await Audio.Sound.createAsync(
        { uri: previewUrl },
        { shouldPlay: true }
      );
      soundRef.current = sound;
      setIsPlaying(true);
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) setIsPlaying(false);
      });
    } catch (err) {
      Alert.alert('Playback error', 'Could not play preview');
    }
  };

  const handleRating = (stars: number) => {
    setRating(stars);
    if (id) ratingMutation.mutate({ trackId: id, stars });
  };

  const handleComment = () => {
    if (!commentText.trim() || !id) return;
    commentMutation.mutate({ entityType: 'track', entityId: id, body: commentText.trim() });
  };

  if (isLoading || !track) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#22c55e" size="large" />
      </View>
    );
  }

  const artist = track.trackArtists[0]?.artist;
  const album = track.albumTracks[0]?.album;
  const coverUrl = album?.coverUrl;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Back */}
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backText}>‹ Back</Text>
        </Pressable>

        {/* Cover */}
        <View style={styles.coverWrapper}>
          <View style={[styles.cover, !coverUrl && styles.coverPlaceholder]} />
        </View>

        {/* Track info */}
        <Text style={styles.trackTitle}>{track.title}</Text>
        <Text style={styles.artistName}>{artist?.name ?? 'Unknown Artist'}</Text>
        {album && <Text style={styles.albumName}>{album.title}</Text>}

        {/* Play button */}
        <Pressable style={styles.playButton} onPress={handlePlay}>
          <Text style={styles.playButtonText}>{isPlaying ? '⏸ Pause' : '▶ Play Preview'}</Text>
        </Pressable>

        {/* Rating */}
        <View style={styles.ratingSection}>
          <Text style={styles.sectionLabel}>Your Rating</Text>
          <StarRating value={rating} onChange={handleRating} />
          {ratingMutation.isPending && (
            <ActivityIndicator color="#22c55e" size="small" style={{ marginTop: 4 }} />
          )}
        </View>

        {/* Comments */}
        <View style={styles.commentsSection}>
          <Text style={styles.sectionLabel}>
            Comments ({commentsData?.items?.length ?? 0})
          </Text>

          {commentsData?.items?.map((comment) => (
            <View key={comment.id} style={styles.commentItem}>
              <Text style={styles.commentAuthor}>
                {comment.user?.displayName ?? 'Anonymous'}
              </Text>
              <Text style={styles.commentBody}>{comment.body}</Text>
            </View>
          ))}

          {/* Add comment */}
          <View style={styles.commentInput}>
            <TextInput
              style={styles.commentTextInput}
              placeholder="Add a comment…"
              placeholderTextColor="#737373"
              value={commentText}
              onChangeText={setCommentText}
              multiline
            />
            <Pressable
              style={[styles.sendButton, commentMutation.isPending && styles.buttonDisabled]}
              onPress={handleComment}
              disabled={commentMutation.isPending || !commentText.trim()}
            >
              {commentMutation.isPending ? (
                <ActivityIndicator color="#0a0a0a" size="small" />
              ) : (
                <Text style={styles.sendText}>Send</Text>
              )}
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0a' },
  scroll: { padding: 16, paddingBottom: 60 },
  backButton: { marginBottom: 16 },
  backText: { color: '#22c55e', fontSize: 16, fontWeight: '500' },
  coverWrapper: { alignItems: 'center', marginBottom: 20 },
  cover: { width: '100%', aspectRatio: 1, borderRadius: 16, backgroundColor: '#262626' },
  coverPlaceholder: { backgroundColor: '#262626' },
  trackTitle: { color: '#fff', fontSize: 26, fontWeight: '800', textAlign: 'center' },
  artistName: { color: '#a3a3a3', fontSize: 16, textAlign: 'center', marginTop: 4 },
  albumName: { color: '#737373', fontSize: 13, textAlign: 'center', marginTop: 2, marginBottom: 20 },
  playButton: {
    backgroundColor: '#22c55e',
    borderRadius: 30,
    paddingVertical: 14,
    paddingHorizontal: 40,
    alignSelf: 'center',
    marginBottom: 24,
  },
  playButtonText: { color: '#0a0a0a', fontWeight: '700', fontSize: 16 },
  ratingSection: { marginBottom: 24 },
  sectionLabel: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 10 },
  stars: { flexDirection: 'row', gap: 8 },
  star: { fontSize: 30, color: '#737373' },
  starFilled: { color: '#22c55e' },
  commentsSection: { gap: 12 },
  commentItem: {
    backgroundColor: '#171717',
    borderRadius: 10,
    padding: 12,
    gap: 4,
  },
  commentAuthor: { color: '#22c55e', fontSize: 13, fontWeight: '600' },
  commentBody: { color: '#e5e5e5', fontSize: 14 },
  commentInput: { flexDirection: 'row', gap: 10, alignItems: 'flex-end', marginTop: 8 },
  commentTextInput: {
    flex: 1,
    backgroundColor: '#171717',
    borderWidth: 1,
    borderColor: '#262626',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 14,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: '#22c55e',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  sendText: { color: '#0a0a0a', fontWeight: '700' },
});
