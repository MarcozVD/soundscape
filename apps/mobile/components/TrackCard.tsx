import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { Audio } from 'expo-av';
import { useRef } from 'react';
import { trpc } from '../lib/trpc';

interface TrackCardProps {
  trackId: string;
  score?: number;
}

export function TrackCard({ trackId, score }: TrackCardProps) {
  const { data: track } = trpc.tracks.getById.useQuery({ id: trackId });
  const soundRef = useRef<Audio.Sound | null>(null);

  if (!track) {
    return <View style={[styles.card, styles.skeleton]} />;
  }

  const artist = track.trackArtists[0]?.artist;
  const cover = track.albumTracks[0]?.album?.coverUrl;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const previewUrl = (track.providerIds as any[]).find((p: { provider: string }) => p.provider === 'spotify')?.previewUrl as string | null | undefined;

  const handlePlay = async () => {
    if (!previewUrl) return;
    await soundRef.current?.unloadAsync();
    const { sound } = await Audio.Sound.createAsync({ uri: previewUrl }, { shouldPlay: true });
    soundRef.current = sound;
  };

  return (
    <Pressable style={styles.card} onPress={handlePlay}>
      {cover ? (
        <Image source={{ uri: cover }} style={styles.cover} />
      ) : (
        <View style={[styles.cover, styles.coverPlaceholder]} />
      )}
      <Text style={styles.title} numberOfLines={1}>{track.title}</Text>
      <Text style={styles.artist} numberOfLines={1}>{artist?.name}</Text>
      {score !== undefined && (
        <Text style={styles.score}>{Math.round(score * 100)}% match</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, backgroundColor: '#171717', borderRadius: 12, padding: 12 },
  skeleton: { minHeight: 160, opacity: 0.4 },
  cover: { width: '100%', aspectRatio: 1, borderRadius: 8, marginBottom: 8 },
  coverPlaceholder: { backgroundColor: '#404040' },
  title: { color: '#fff', fontSize: 13, fontWeight: '600' },
  artist: { color: '#a3a3a3', fontSize: 12, marginTop: 2 },
  score: { color: '#22c55e', fontSize: 11, marginTop: 4 },
});
