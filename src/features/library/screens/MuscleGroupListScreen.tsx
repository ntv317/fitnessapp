import React, { useMemo, useState } from 'react';
import { View, FlatList, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Colors, Spacing, Radius, Fonts } from '@/core/theme';
import { AppText } from '@/core/ui';
import { getMuscleGroups, search as searchCatalog } from '../services/ExerciseCatalog';
import { MuscleMapIcon } from '../components/MuscleMapIcon';
import type { MuscleGroup } from '../utils/muscleGroups';
import { useCatalogIdMap, mergeLibraryExercise } from '../hooks/useLibraryExercise';
import { useExercises } from '@/features/workout/hooks/useExercises';

const MARGIN = 20;
const MY_EXERCISES_GROUP = '__my_exercises__';

interface SearchResult {
  key: string;
  name: string;
  muscleGroup: string | null;
  equipment: string | null;
  onPress: () => void;
}

export default function MuscleGroupListScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { data: myExercises } = useExercises();
  const catalogIdMap = useCatalogIdMap();
  const myExercisesCount = useMemo(
    () => (myExercises ?? []).filter((e) => e.catalogId === null).length,
    [myExercises],
  );
  const groups = useMemo(() => {
    const customCounts = new Map<string, number>();
    for (const e of myExercises ?? []) {
      if (e.catalogId === null && e.muscleGroup) {
        customCounts.set(e.muscleGroup, (customCounts.get(e.muscleGroup) ?? 0) + 1);
      }
    }
    const base = getMuscleGroups().map((g) => ({
      group: g.group as string,
      count: g.count + (customCounts.get(g.group) ?? 0),
    }));
    return myExercisesCount > 0 ? [{ group: MY_EXERCISES_GROUP, count: myExercisesCount }, ...base] : base;
  }, [myExercises, myExercisesCount]);
  const [query, setQuery] = useState('');
  const results = useMemo<SearchResult[] | null>(() => {
    if (!query.trim()) return null;
    const q = query.trim().toLowerCase();
    const catalogResults = searchCatalog(query)
      .slice(0, 50)
      .map((cat): SearchResult => {
        const view = mergeLibraryExercise(cat, catalogIdMap.get(cat.id));
        return {
          key: cat.id,
          name: view.name,
          muscleGroup: view.muscleGroup,
          equipment: cat.equipment,
          onPress: () => router.push(`/library/exercise/${cat.id}` as never),
        };
      });
    const customResults = (myExercises ?? [])
      .filter((e) => e.catalogId === null && e.name.toLowerCase().includes(q))
      .map((e): SearchResult => ({
        key: `db-${e.id}`,
        name: e.name,
        muscleGroup: e.muscleGroup,
        equipment: null,
        onPress: () => router.push(`/exercise/${e.id}` as never),
      }));
    return [...customResults, ...catalogResults];
  }, [query, myExercises, catalogIdMap, router]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.appBar}>
        <AppText variant="headlineLg" style={{ flex: 1 }}>{t('library.exercises')}</AppText>
        <TouchableOpacity onPress={() => router.push('/library/exercise-form' as never)} hitSlop={10}>
          <Ionicons name="add" size={26} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={Colors.textMuted} />
        <TextInput
          placeholder={t('library.searchAllExercises')}
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
        <FlatList<SearchResult>
          data={results}
          keyExtractor={(r) => r.key}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <AppText variant="bodyMd" color={Colors.textMuted} style={{ paddingVertical: Spacing.lg }}>
              {t('library.noExercisesMatch', { query: query.trim() })}
            </AppText>
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.row} activeOpacity={0.6} onPress={item.onPress}>
              <View style={{ flex: 1 }}>
                <AppText variant="bodyLg">{item.name}</AppText>
                <AppText variant="labelMono" upper color={Colors.textMuted}>
                  {item.muscleGroup ? t(`muscleGroups.${item.muscleGroup}`) : ''}
                  {item.equipment ? ` · ${t(`exerciseMeta.equipment.${item.equipment}`, { defaultValue: item.equipment })}` : ''}
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
          renderItem={({ item }) => {
            const isMyExercises = item.group === MY_EXERCISES_GROUP;
            return (
              <TouchableOpacity
                style={styles.row}
                activeOpacity={0.6}
                onPress={() =>
                  router.push((isMyExercises ? '/library/my-exercises' : `/library/${item.group}`) as never)
                }
              >
                <View style={styles.iconWrap}>
                  {isMyExercises ? (
                    <Ionicons name="person-circle-outline" size={34} color={Colors.textPrimary} />
                  ) : (
                    <MuscleMapIcon group={item.group as MuscleGroup} size={34} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <AppText variant="bodyLg">
                    {isMyExercises ? t('library.myExercises') : t(`muscleGroups.${item.group}`)}
                  </AppText>
                  <View style={styles.countPill}>
                    <AppText variant="labelMono" upper color={Colors.white}>
                      {t('library.exerciseCount', { count: item.count })}
                    </AppText>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: MARGIN,
    paddingVertical: Spacing.md,
  },
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
