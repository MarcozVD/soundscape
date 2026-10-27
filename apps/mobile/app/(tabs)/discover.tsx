import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { trpc } from '../../lib/trpc';

const ALL_GENRES = [
  'Pop', 'Rock', 'Hip-Hop', 'Electronic',
  'Jazz', 'Classical', 'R&B', 'Metal', 'Folk', 'Latin',
];

export default function DiscoverScreen() {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const refreshMutation = trpc.recommendations.refresh.useMutation({
    onSuccess: () => {
      router.replace('/(tabs)');
    },
    onError: (err) => Alert.alert('Error', err.message),
  });

  const toggleGenre = (genre: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(genre)) next.delete(genre);
      else next.add(genre);
      return next;
    });
  };

  const handleContinue = () => {
    if (selected.size === 0) {
      Alert.alert('Select genres', 'Please select at least one genre to continue');
      return;
    }
    // Navigate forward — seed mutation may not be on the router yet
    refreshMutation.mutate();
  };

  const isPending = refreshMutation.isPending;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.inner}>
      <Text style={styles.title}>What do you like?</Text>
      <Text style={styles.subtitle}>Select genres to personalize your recommendations</Text>

      <View style={styles.grid}>
        {ALL_GENRES.map((genre) => {
          const isSelected = selected.has(genre);
          return (
            <Pressable
              key={genre}
              style={[styles.chip, isSelected && styles.chipSelected]}
              onPress={() => toggleGenre(genre)}
            >
              <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                {genre}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        style={[styles.continueButton, (isPending || selected.size === 0) && styles.buttonDisabled]}
        onPress={handleContinue}
        disabled={isPending || selected.size === 0}
      >
        {isPending ? (
          <ActivityIndicator color="#0a0a0a" size="small" />
        ) : (
          <Text style={styles.continueText}>Continue</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  inner: { padding: 24, paddingBottom: 48, gap: 24 },
  title: { color: '#fff', fontSize: 32, fontWeight: '800', marginTop: 16 },
  subtitle: { color: '#a3a3a3', fontSize: 15, marginTop: -12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    backgroundColor: '#171717',
    borderWidth: 1,
    borderColor: '#262626',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  chipSelected: {
    backgroundColor: '#22c55e',
    borderColor: '#22c55e',
  },
  chipText: { color: '#fff', fontSize: 14, fontWeight: '500' },
  chipTextSelected: { color: '#0a0a0a', fontWeight: '700' },
  continueButton: {
    backgroundColor: '#22c55e',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.5 },
  continueText: { color: '#0a0a0a', fontWeight: '700', fontSize: 16 },
});
