import React, { useMemo, useState } from 'react';
import { View, TouchableOpacity, Modal, ScrollView, TextInput, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Colors, Spacing, Radius, Fonts } from '@/core/theme';
import { AppText, Button, StepperInput, SegmentedTabs } from '@/core/ui';
import { useExercises, useUpsertExercise } from '@/features/workout/hooks/useExercises';
import { useAddPlanExercise } from '@/features/workout/hooks/usePlans';
import { useRepository } from '@/features/workout/hooks/useRepository';
import { search as searchCatalog, getAll as getAllCatalog, displayName } from '@/features/library/services/ExerciseCatalog';
import { useExerciseDisplayName } from '@/features/library/hooks/useExerciseDisplayName';

type PickedExercise =
  | { kind: 'existing'; exerciseId: number; name: string; label: string }
  | { kind: 'catalog'; catalogId: string; name: string; label: string; isCompound: boolean };

interface AddExerciseSheetProps {
  visible: boolean;
  onClose: () => void;
  planDayId: number;
}

export function AddExerciseSheet({ visible, onClose, planDayId }: AddExerciseSheetProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'library' | 'custom'>('library');
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<PickedExercise | null>(null);
  const [targetSets, setTargetSets] = useState('3');
  const [repMin, setRepMin] = useState('');
  const [repMax, setRepMax] = useState('');

  const { data: existingExercises = [] } = useExercises();
  const upsertExercise = useUpsertExercise();
  const addPlanExercise = useAddPlanExercise();
  const repo = useRepository();

  // Browsable before typing: an empty query shows the whole catalog A→Z
  // instead of a blank sheet that looks like search is broken.
  const catalogResults = useMemo(
    () => (query.trim() ? searchCatalog(query) : getAllCatalog()).slice(0, 50),
    [query],
  );
  const exerciseDisplayName = useExerciseDisplayName();
  const customResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    return existingExercises.filter(
      (e) => !q || e.name.toLowerCase().includes(q) || exerciseDisplayName(e).toLowerCase().includes(q),
    );
  }, [existingExercises, query, exerciseDisplayName]);

  const reset = () => {
    setPicked(null);
    setQuery('');
    setTargetSets('3');
    setRepMin('');
    setRepMax('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleAdd = async () => {
    if (!picked) return;
    try {
      let exerciseId: number;
      if (picked.kind === 'existing') {
        exerciseId = picked.exerciseId;
      } else {
        // The user may have renamed this catalog exercise's row since it was
        // first added, so it no longer holds the catalog's canonical name —
        // an upsert by that name would trip the partial-unique catalog_id
        // index and roll back. Reuse the existing row by catalog_id first.
        const existing = await repo.getExerciseByCatalogId(picked.catalogId);
        if (existing) {
          exerciseId = existing.id;
        } else {
          const ex = await upsertExercise.mutateAsync({
            name: picked.name,
            isCompound: picked.isCompound,
            isCustom: false,
            catalogId: picked.catalogId,
            defaultRestSeconds: picked.isCompound ? 150 : 75,
            keepExistingSettings: true,
          });
          exerciseId = ex.id;
        }
      }
      await addPlanExercise.mutateAsync({
        planDayId,
        exerciseId,
        targetSets: parseInt(targetSets, 10) || 3,
        repMin: repMin ? parseInt(repMin, 10) : null,
        repMax: repMax ? parseInt(repMax, 10) : null,
      });
      handleClose();
    } catch {
      Alert.alert(t('plans.addExerciseError'), t('plans.exerciseAlreadyInDay'));
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          <View style={styles.header}>
            <AppText variant="headlineMd">{t('plans.addExercise')}</AppText>
            <TouchableOpacity onPress={handleClose} hitSlop={10}>
              <Ionicons name="close" size={24} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          {!picked ? (
            <>
              <SegmentedTabs
                options={[
                  { value: 'library', label: t('plans.library') },
                  { value: 'custom', label: t('plans.customExercises') },
                ]}
                value={mode}
                onChange={setMode}
                style={{ marginBottom: Spacing.md }}
              />
              <TextInput
                placeholder={t('plans.searchExercises')}
                placeholderTextColor={Colors.textMuted}
                value={query}
                onChangeText={setQuery}
                style={styles.search}
              />
              <ScrollView style={styles.results} keyboardShouldPersistTaps="handled">
                {mode === 'library'
                  ? catalogResults.map((c) => (
                      <TouchableOpacity
                        key={c.id}
                        style={styles.resultRow}
                        onPress={() => setPicked({ kind: 'catalog', catalogId: c.id, name: c.name, label: displayName(c), isCompound: c.mechanic === 'compound' })}
                      >
                        <AppText variant="bodyMd">{displayName(c)}</AppText>
                      </TouchableOpacity>
                    ))
                  : customResults.map((e) => (
                      <TouchableOpacity
                        key={e.id}
                        style={styles.resultRow}
                        onPress={() => setPicked({ kind: 'existing', exerciseId: e.id, name: e.name, label: exerciseDisplayName(e) })}
                      >
                        <AppText variant="bodyMd">{exerciseDisplayName(e)}</AppText>
                      </TouchableOpacity>
                    ))}
                {mode === 'library' && query.trim() && catalogResults.length === 0 && (
                  <AppText variant="bodyMd" color={Colors.textMuted} style={{ paddingVertical: Spacing.md }}>
                    {t('plans.noMatches')}
                  </AppText>
                )}
              </ScrollView>
            </>
          ) : (
            <View style={{ gap: Spacing.md }}>
              <AppText variant="bodyLg" style={{ fontFamily: Fonts.sansBold }}>{picked.label}</AppText>
              <View>
                <AppText variant="labelMono" upper color={Colors.textMuted} style={{ marginBottom: 4 }}>
                  {t('plans.targetSets')}
                </AppText>
                <StepperInput value={targetSets} onChangeText={setTargetSets} step={1} min={1} />
              </View>
              <View style={{ flexDirection: 'row', gap: Spacing.md }}>
                <View style={{ flex: 1 }}>
                  <AppText variant="labelMono" upper color={Colors.textMuted} style={{ marginBottom: 4 }}>
                    {t('plans.repMin')}
                  </AppText>
                  <StepperInput value={repMin} onChangeText={setRepMin} step={1} min={0} placeholder="—" />
                </View>
                <View style={{ flex: 1 }}>
                  <AppText variant="labelMono" upper color={Colors.textMuted} style={{ marginBottom: 4 }}>
                    {t('plans.repMax')}
                  </AppText>
                  <StepperInput value={repMax} onChangeText={setRepMax} step={1} min={0} placeholder="—" />
                </View>
              </View>
              <Button label={t('plans.addToDay')} onPress={handleAdd} fullWidth />
              <Button label={t('plans.back')} variant="ghost" onPress={() => setPicked(null)} fullWidth />
            </View>
          )}
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
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  search: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    fontFamily: Fonts.sans,
    fontSize: 16,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  // Fixed height (not max) so the sheet keeps a stable, usable size even
  // while the result list is empty.
  results: { height: 320 },
  resultRow: {
    paddingVertical: Spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
});
