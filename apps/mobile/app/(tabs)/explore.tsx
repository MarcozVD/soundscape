import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { trpc } from '../../lib/trpc';

const GENRES = ['Pop', 'Rock', 'Electronic'];

interface SearchResultItem {
  id: string;
  score?: number;
  title?: string;
  artists?: string | string[];
  album?: string;
}

function SearchTrackRow({ item }: { item: SearchResultItem }) {
  const title = item.title ?? 'Unknown Track';
  const artistRaw = item.artists;
  const artist = Array.isArray(artistRaw)
    ? artistRaw[0]
    : typeof artistRaw === 'string'
    ? artistRaw
    : 'Unknown Artist';

  return (
    <View style={styles.resultRow}>
      <View style={styles.resultCover} />
      <View style={styles.resultInfo}>
        <Text style={styles.resultTitle} numberOfLines={1}>{title}</Text>
        <Text style={styles.resultArtist} numberOfLines={1}>{artist}</Text>
      </View>
    </View>
  );
}

export default function ExploreScreen() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 300);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query]);

  const isSearching = debouncedQuery.length > 0;

  const { data: results, isFetching } = trpc.search.query.useQuery(
    { q: debouncedQuery, limit: 20 },
    { enabled: isSearching }
  );

  return (
    <View style={styles.container}>
      {/* Search bar */}
      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search tracks, artists, albums…"
          placeholderTextColor="#737373"
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery('')}>
            <Text style={styles.clearIcon}>✕</Text>
          </Pressable>
        )}
      </View>

      {/* Trending or results */}
      {!isSearching ? (
        <View style={styles.trendingSection}>
          <Text style={styles.sectionTitle}>Trending</Text>
          <View style={styles.genreChips}>
            {GENRES.map((genre) => (
              <Pressable
                key={genre}
                style={styles.genreChip}
                onPress={() => setQuery(genre)}
              >
                <Text style={styles.genreChipText}>{genre}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : (
        <>
          {isFetching && (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#22c55e" size="small" />
              <Text style={styles.loadingText}>Searching…</Text>
            </View>
          )}
          <FlatList
            data={(results as SearchResultItem[] | undefined) ?? []}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <SearchTrackRow item={item} />}
            contentContainerStyle={{ paddingBottom: 100 }}
            ListEmptyComponent={
              !isFetching ? (
                <Text style={styles.emptyText}>No results for "{debouncedQuery}"</Text>
              ) : null
            }
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', paddingTop: 16 },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#171717',
    borderWidth: 1,
    borderColor: '#262626',
    borderRadius: 12,
    marginHorizontal: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    marginBottom: 16,
  },
  searchIcon: { color: '#737373', fontSize: 18 },
  searchInput: { flex: 1, color: '#fff', fontSize: 15 },
  clearIcon: { color: '#737373', fontSize: 14, paddingHorizontal: 4 },
  trendingSection: { paddingHorizontal: 16 },
  sectionTitle: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 12 },
  genreChips: { flexDirection: 'row', gap: 10 },
  genreChip: {
    backgroundColor: '#171717',
    borderWidth: 1,
    borderColor: '#262626',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  genreChipText: { color: '#fff', fontSize: 14, fontWeight: '500' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, marginBottom: 12 },
  loadingText: { color: '#737373', fontSize: 13 },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#171717',
  },
  resultCover: {
    width: 48,
    height: 48,
    borderRadius: 6,
    backgroundColor: '#262626',
  },
  resultInfo: { flex: 1 },
  resultTitle: { color: '#fff', fontSize: 14, fontWeight: '600' },
  resultArtist: { color: '#a3a3a3', fontSize: 12, marginTop: 2 },
  emptyText: { color: '#737373', textAlign: 'center', marginTop: 40, fontSize: 14 },
});
