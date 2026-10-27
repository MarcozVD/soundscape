import { FlatList, Text, View, StyleSheet, ActivityIndicator } from 'react-native';
import { trpc } from '../../lib/trpc';
import { TrackCard } from '../../components/TrackCard';

export default function ForYouScreen() {
  const { data, isLoading } = trpc.recommendations.forUser.useQuery({ limit: 20 });

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#22c55e" size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>For You</Text>
      <FlatList
        data={data?.tracks ?? []}
        keyExtractor={(item) => (item as { trackId: string }).trackId}
        numColumns={2}
        columnWrapperStyle={styles.row}
        renderItem={({ item }) => (
          <TrackCard
            trackId={(item as { trackId: string }).trackId}
            score={(item as { score: number }).score}
          />
        )}
        contentContainerStyle={{ paddingBottom: 100 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0a' },
  title: { color: '#fff', fontSize: 28, fontWeight: '700', marginBottom: 16 },
  row: { gap: 12, marginBottom: 12 },
});
