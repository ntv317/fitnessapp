import React, { useMemo, useState } from 'react';
import { View, FlatList, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Colors, Spacing, Radius, Fonts } from '@/core/theme';
import { AppText } from '@/core/ui';
import { getById, imageUrl, matchesQuery } from '../services/ExerciseCatalog';
import { useLibraryExercises, type LibraryExerciseView } from '../hooks/useLibraryExercise';
import type { MuscleGroup } from '../utils/muscleGroups';
import type { CatalogExercise } from '../types';
import type { Exercise } from '@/core/database/types';
import { useExercises } from '@/features/workout/hooks/useExercises';

const MARGIN = 20;

type Row =
  | { key: string; catalog: CatalogExercise; view: LibraryExerciseView; custom?: never }
  | { key: string; custom: Exercise; catalog?: never; view?: never };

export default function GroupExercisesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { group } = useLocalSearchParams<{ group: MuscleGroup }>();
  const [query, setQuery] = useState('');
  const { data: myExercises } = useExercises();
  const merged = useLibraryExercises(group);
  const rows = useMemo<Row[]>(() => {
    const q = query.trim().toLowerCase();
    const catalogRows = merged.filter((v) => {
      if (!q) return true;
      if (v.name.toLowerCase().includes(q)) return true;
      const cat = getById(v.catalogId);
      return !!cat && matchesQuery(cat, query);
    });
    // User's own exercises (AI-imported or custom) have no catalog link but
    // carry a muscle_group — list them alongside the bundled catalog.
    const custom = (myExercises ?? []).filter(
      (e) => e.catalogId === null && e.muscleGroup === group && (!q || e.name.toLowerCase().includes(q)),
    );
    return [
      ...custom.map((e): Row => ({ key: `db-${e.id}`, custom: e })),
      ...catalogRows.map((v): Row => ({ key: v.catalogId, view: v, catalog: getById(v.catalogId)! })),
    ];
  }, [group, query, myExercises, merged]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.appBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <AppText variant="headlineMd">{t(`muscleGroups.${group}`)}</AppText>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={Colors.textMuted} />
        <TextInput
          placeholder={t('library.searchGroup', { group: t(`muscleGroups.${group}`) })}
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

      <FlatList
        data={rows}
        keyExtractor={(r) => r.key}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) =>
          item.catalog ? (
            <TouchableOpacity
              style={styles.row}
              activeOpacity={0.6}
              onPress={() => router.push(`/library/exercise/${item.catalog.id}` as never)}
            >
              {item.catalog.images[0] ? (
                <Image
                  source={{ uri: imageUrl(item.catalog.images[0]) }}
                  style={styles.thumb}
                  contentFit="cover"
                  cachePolicy="disk"
                />
              ) : (
                <View style={styles.thumb} />
              )}
              <View style={{ flex: 1 }}>
                <AppText variant="bodyLg">{item.view.name}</AppText>
                <AppText variant="labelMono" upper color={Colors.textMuted}>
                  {t(item.view.isCompound ? 'exerciseMeta.mechanic.compound' : 'exerciseMeta.mechanic.isolation')}
                  {item.catalog.equipment ? ` · ${t(`exerciseMeta.equipment.${item.catalog.equipment}`, { defaultValue: item.catalog.equipment })}` : ''}
                </AppText>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.row}
              activeOpacity={0.6}
              onPress={() => router.push(`/exercise/${item.custom.id}` as never)}
            >
              <View style={styles.thumb} />
              <View style={{ flex: 1 }}>
                <AppText variant="bodyLg">{item.custom.name}</AppText>
                <AppText variant="labelMono" upper color={Colors.textMuted}>
                  {t(item.custom.isCompound ? 'exerciseMeta.mechanic.compound' : 'exerciseMeta.mechanic.isolation')} · {t('library.myExercise')}
                </AppText>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
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
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: MARGIN,
    paddingVertical: Spacing.md,
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
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: Colors.surfaceAlt,
  },
});
