import React, { useMemo, useState } from 'react';
import {
  View,
  TouchableOpacity,
  Modal,
  FlatList,
  ScrollView,
  TextInput,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Colors, Spacing, Radius, Fonts } from '@/core/theme';
import { AppText } from '@/core/ui';
import { useExercises, useUpsertExercise } from '@/features/workout/hooks/useExercises';
import { useRepository } from '@/features/workout/hooks/useRepository';
import {
  getByGroup,
  getAll,
  search as searchCatalog,
  displayName,
} from '@/features/library/services/ExerciseCatalog';
import { GROUP_ORDER, groupOf, type MuscleGroup } from '@/features/library/utils/muscleGroups';
import { normalizeName } from '@/features/import/services/catalogMatch';
import type { CatalogExercise } from '@/features/library/types';

type GroupFilter = MuscleGroup | 'All';

type Row =
  | { key: string; kind: 'custom'; id: number; name: string; isCompound: boolean; group: string | null }
  | { key: string; kind: 'catalog'; catalog: CatalogExercise; name: string; isCompound: boolean; group: string | null };

interface ExerciseSwitchSheetProps {
  visible: boolean;
  onClose: () => void;
  currentExerciseId: number;
  currentCatalogId: string | null;
  currentMuscleGroup: string | null;
  onSwitch: (exerciseId: number) => void;
}

// Name-match relevance for search ranking: exact > prefix > word-boundary >
// substring. normalizeName folds diacritics and punctuation so "bench-press"
// scores against "Bench Press".
function scoreName(name: string, normalizedQuery: string): number {
  if (!normalizedQuery) return 0;
  const n = normalizeName(name);
  if (n === normalizedQuery) return 4;
  if (n.startsWith(normalizedQuery)) return 3;
  if ((' ' + n).includes(' ' + normalizedQuery)) return 2;
  if (n.includes(normalizedQuery)) return 1;
  return 0;
}

export function ExerciseSwitchSheet({
  visible,
  onClose,
  currentExerciseId,
  currentCatalogId,
  currentMuscleGroup,
  onSwitch,
}: ExerciseSwitchSheetProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const repo = useRepository();
  const upsertExercise = useUpsertExercise();
  const { data: myExercises = [] } = useExercises();

  const initialGroup: GroupFilter =
    currentMuscleGroup && (GROUP_ORDER as readonly string[]).includes(currentMuscleGroup)
      ? (currentMuscleGroup as MuscleGroup)
      : 'All';
  const [group, setGroup] = useState<GroupFilter>(initialGroup);
  const [query, setQuery] = useState('');

  const rows = useMemo<Row[]>(() => {
    const nq = normalizeName(query);

    const customRows: Row[] = myExercises
      .filter((e) => e.catalogId === null && e.id !== currentExerciseId)
      .filter((e) => group === 'All' || e.muscleGroup === group)
      .filter((e) => !nq || scoreName(e.name, nq) > 0)
      .map((e) => ({
        key: `db-${e.id}`,
        kind: 'custom',
        id: e.id,
        name: e.name,
        isCompound: e.isCompound,
        group: e.muscleGroup,
      }));

    const catalogList =
      group === 'All' ? (nq ? searchCatalog(query) : getAll()) : getByGroup(group);
    const catalogRows: Row[] = catalogList
      .filter((c) => c.id !== currentCatalogId)
      .filter((c) => !nq || scoreName(displayName(c), nq) > 0 || scoreName(c.name, nq) > 0)
      .map((c) => ({
        key: c.id,
        kind: 'catalog',
        catalog: c,
        name: displayName(c),
        isCompound: c.mechanic === 'compound',
        group: groupOf(c.primaryMuscles),
      }));

    const all = [...customRows, ...catalogRows];
    if (!nq) return all;
    return all
      .map((r) => ({
        r,
        score: r.kind === 'catalog'
          ? Math.max(scoreName(r.name, nq), scoreName(r.catalog.name, nq))
          : scoreName(r.name, nq),
      }))
      .sort((a, b) => b.score - a.score || a.r.name.localeCompare(b.r.name))
      .map((x) => x.r);
  }, [myExercises, group, query, currentExerciseId, currentCatalogId]);

  const reset = () => {
    setGroup(initialGroup);
    setQuery('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleCreate = () => {
    handleClose();
    router.push('/library/exercise-form' as never);
  };

  const handlePick = async (row: Row) => {
    try {
      if (row.kind === 'custom') {
        reset();
        onSwitch(row.id);
        return;
      }
      const existing = await repo.getExerciseByCatalogId(row.catalog.id);
      let exerciseId: number;
      if (existing) {
        exerciseId = existing.id;
      } else {
        const ex = await upsertExercise.mutateAsync({
          name: row.catalog.name,
          isCompound: row.catalog.mechanic === 'compound',
          isCustom: false,
          catalogId: row.catalog.id,
          defaultRestSeconds: row.catalog.mechanic === 'compound' ? 150 : 75,
          keepExistingSettings: true,
        });
        exerciseId = ex.id;
      }
      reset();
      onSwitch(exerciseId);
    } catch {
      Alert.alert(t('workout.switchFailed'));
    }
  };

  const chips: GroupFilter[] = ['All', ...GROUP_ORDER];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          <View style={styles.header}>
            <AppText variant="headlineMd">{t('workout.switchExercise')}</AppText>
            <TouchableOpacity onPress={handleClose} hitSlop={10}>
              <Ionicons name="close" size={24} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.createRow} onPress={handleCreate} activeOpacity={0.6}>
            <Ionicons name="add-circle-outline" size={22} color={Colors.primary} />
            <AppText variant="bodyMd" color={Colors.primary}>
              {t('workout.createNewExercise')}
            </AppText>
          </TouchableOpacity>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.chipRow}
          >
            {chips.map((g) => {
              const selected = g === group;
              return (
                <TouchableOpacity
                  key={g}
                  style={[styles.chip, selected && styles.chipSelected]}
                  onPress={() => setGroup(g)}
                  activeOpacity={0.7}
                >
                  <AppText
                    variant="labelMono"
                    upper
                    color={selected ? Colors.white : Colors.textSecondary}
                  >
                    {g === 'All' ? t('workout.allGroups') : t(`muscleGroups.${g}`)}
                  </AppText>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.searchWrap}>
            <Ionicons name="search" size={18} color={Colors.textMuted} />
            <TextInput
              placeholder={t('workout.switchExerciseSearch')}
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
            style={styles.results}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <AppText variant="bodyMd" color={Colors.textMuted} style={{ paddingVertical: Spacing.lg }}>
                {t('library.noExercisesMatch', { query: query.trim() })}
              </AppText>
            }
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.row} activeOpacity={0.6} onPress={() => handlePick(item)}>
                <View style={{ flex: 1 }}>
                  <AppText variant="bodyLg">{item.name}</AppText>
                  <AppText variant="labelMono" upper color={Colors.textMuted}>
                    {item.isCompound ? t('workout.compound') : t('workout.isolation')}
                    {item.group ? ` · ${t(`muscleGroups.${item.group}`, { defaultValue: item.group })}` : ''}
                    {item.kind === 'custom' ? ` · ${t('library.myExercise')}` : ''}
                  </AppText>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            )}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    padding: Spacing.lg,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  createRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  chipRow: { gap: Spacing.sm, paddingBottom: Spacing.sm },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.sm,
    marginBottom: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontFamily: Fonts.sans,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  results: { height: 360 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
});
