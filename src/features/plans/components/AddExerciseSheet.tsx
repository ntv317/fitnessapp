import React, { useMemo, useState } from 'react';
import { View, TouchableOpacity, Modal, ScrollView, TextInput, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Fonts } from '@/core/theme';
import { AppText, Button, StepperInput, SegmentedTabs } from '@/core/ui';
import { useExercises, useUpsertExercise } from '@/features/workout/hooks/useExercises';
import { useAddPlanExercise } from '@/features/workout/hooks/usePlans';
import { search as searchCatalog, getAll as getAllCatalog } from '@/features/library/services/ExerciseCatalog';

type PickedExercise =
  | { kind: 'existing'; exerciseId: number; name: string }
  | { kind: 'catalog'; catalogId: string; name: string; isCompound: boolean };

interface AddExerciseSheetProps {
  visible: boolean;
  onClose: () => void;
  planDayId: number;
}

export function AddExerciseSheet({ visible, onClose, planDayId }: AddExerciseSheetProps) {
  const [mode, setMode] = useState<'library' | 'custom'>('library');
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<PickedExercise | null>(null);
  const [targetSets, setTargetSets] = useState('3');
  const [repMin, setRepMin] = useState('');
  const [repMax, setRepMax] = useState('');

  const { data: existingExercises = [] } = useExercises();
  const upsertExercise = useUpsertExercise();
  const addPlanExercise = useAddPlanExercise();

  // Browsable before typing: an empty query shows the whole catalog A→Z
  // instead of a blank sheet that looks like search is broken.
  const catalogResults = useMemo(
    () => (query.trim() ? searchCatalog(query) : getAllCatalog()).slice(0, 50),
    [query],
  );
  const customResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    return existingExercises.filter((e) => !q || e.name.toLowerCase().includes(q));
  }, [existingExercises, query]);

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
      await addPlanExercise.mutateAsync({
        planDayId,
        exerciseId,
        targetSets: parseInt(targetSets, 10) || 3,
        repMin: repMin ? parseInt(repMin, 10) : null,
        repMax: repMax ? parseInt(repMax, 10) : null,
      });
      handleClose();
    } catch {
      Alert.alert('Could not add exercise', 'That exercise is already in this day.');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      {/* Without this, the bottom-anchored sheet sits under the keyboard the
          moment the search field focuses — with an empty result list the whole
          sheet fit below the keyboard line, which made search look broken. */}
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          <View style={styles.header}>
            <AppText variant="headlineMd">Add Exercise</AppText>
            <TouchableOpacity onPress={handleClose} hitSlop={10}>
              <Ionicons name="close" size={24} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          {!picked ? (
            <>
              <SegmentedTabs
                options={[
                  { value: 'library', label: 'Library' },
                  { value: 'custom', label: 'Your Exercises' },
                ]}
                value={mode}
                onChange={setMode}
                style={{ marginBottom: Spacing.md }}
              />
              <TextInput
                placeholder="Search exercises"
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
                        onPress={() => setPicked({ kind: 'catalog', catalogId: c.id, name: c.name, isCompound: c.mechanic === 'compound' })}
                      >
                        <AppText variant="bodyMd">{c.name}</AppText>
                      </TouchableOpacity>
                    ))
                  : customResults.map((e) => (
                      <TouchableOpacity
                        key={e.id}
                        style={styles.resultRow}
                        onPress={() => setPicked({ kind: 'existing', exerciseId: e.id, name: e.name })}
                      >
                        <AppText variant="bodyMd">{e.name}</AppText>
                      </TouchableOpacity>
                    ))}
                {mode === 'library' && query.trim() && catalogResults.length === 0 && (
                  <AppText variant="bodyMd" color={Colors.textMuted} style={{ paddingVertical: Spacing.md }}>
                    No matches.
                  </AppText>
                )}
              </ScrollView>
            </>
          ) : (
            <View style={{ gap: Spacing.md }}>
              <AppText variant="bodyLg" style={{ fontFamily: Fonts.sansBold }}>{picked.name}</AppText>
              <View>
                <AppText variant="labelMono" upper color={Colors.textMuted} style={{ marginBottom: 4 }}>
                  Target Sets
                </AppText>
                <StepperInput value={targetSets} onChangeText={setTargetSets} step={1} min={1} />
              </View>
              <View style={{ flexDirection: 'row', gap: Spacing.md }}>
                <View style={{ flex: 1 }}>
                  <AppText variant="labelMono" upper color={Colors.textMuted} style={{ marginBottom: 4 }}>
                    Rep Min
                  </AppText>
                  <StepperInput value={repMin} onChangeText={setRepMin} step={1} min={0} placeholder="—" />
                </View>
                <View style={{ flex: 1 }}>
                  <AppText variant="labelMono" upper color={Colors.textMuted} style={{ marginBottom: 4 }}>
                    Rep Max
                  </AppText>
                  <StepperInput value={repMax} onChangeText={setRepMax} step={1} min={0} placeholder="—" />
                </View>
              </View>
              <Button label="Add to day" onPress={handleAdd} fullWidth />
              <Button label="Back" variant="ghost" onPress={() => setPicked(null)} fullWidth />
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
