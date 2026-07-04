import React, { useMemo, useState } from 'react';
import { View, FlatList, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Spacing, Radius, Fonts } from '@/core/theme';
import { AppText } from '@/core/ui';
import { getMuscleGroups, search as searchCatalog } from '../services/ExerciseCatalog';
import { MuscleMapIcon } from '../components/MuscleMapIcon';
import type { CatalogExercise } from '../types';
import { useExercises } from '@/features/workout/hooks/useExercises';

const MARGIN = 20;

export default function MuscleGroupListScreen() {
  const router = useRouter();
  const { data: myExercises } = useExercises();
  const groups = useMemo(() => {
    const customCounts = new Map<string, number>();
    for (const e of myExercises ?? []) {
      if (e.catalogId === null && e.muscleGroup) {
        customCounts.set(e.muscleGroup, (customCounts.get(e.muscleGroup) ?? 0) + 1);
      }
    }
    return getMuscleGroups().map((g) => ({
      ...g,
      count: g.count + (customCounts.get(g.group) ?? 0),
    }));
  }, [myExercises]);
  const [query, setQuery] = useState('');
  const results = useMemo(() => (query.trim() ? searchCatalog(query).slice(0, 50) : null), [query]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.appBar}>
        <AppText variant="headlineLg">Exercises</AppText>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={Colors.textMuted} />
        <TextInput
          placeholder="Search all exercises"
          placeholderTextColor={Colors.textMuted}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          style={styles.searchInput}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={10}>
            <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {results ? (
        <FlatList<CatalogExercise>
          data={results}
          keyExtractor={(e) => e.id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <AppText variant="bodyMd" color={Colors.textMuted} style={{ paddingVertical: Spacing.lg }}>
              No exercises match “{query.trim()}”.
            </AppText>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              activeOpacity={0.6}
              onPress={() => router.push(`/library/exercise/${item.id}` as never)}
            >
              <View style={{ flex: 1 }}>
                <AppText variant="bodyLg">{item.name}</AppText>
                <AppText variant="labelMono" upper color={Colors.textMuted}>
                  {item.primaryMuscles[0] ?? ''}
                  {item.equipment ? ` · ${item.equipment}` : ''}
                </AppText>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        />
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(g) => g.group}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              activeOpacity={0.6}
              onPress={() => router.push(`/library/${item.group}` as never)}
            >
              <View style={styles.iconWrap}>
                <MuscleMapIcon group={item.group} size={34} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="bodyLg">{item.group}</AppText>
                <View style={styles.countPill}>
                  <AppText variant="labelMono" upper color={Colors.white}>
                    {item.count} exercises
                  </AppText>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  appBar: { paddingHorizontal: MARGIN, paddingVertical: Spacing.md },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: MARGIN,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontFamily: Fonts.sans,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  list: { paddingHorizontal: MARGIN, paddingBottom: 64 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countPill: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.textPrimary,
    borderRadius: 999,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    marginTop: 4,
  },
});
