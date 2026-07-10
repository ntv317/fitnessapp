import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActionSheetIOS,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Colors, Spacing, Radius, Fonts } from '@/core/theme';
import { AppText, Button, SegmentedTabs } from '@/core/ui';
import {
  useExercises,
  useExerciseByCatalogId,
  useCreateCustomExercise,
  useUpdateExercise,
  useCreateOrUpdateCatalogOverride,
  useResetExerciseOverride,
  useDeleteCustomExercise,
} from '@/features/workout/hooks/useExercises';
import { useRepository } from '@/features/workout/hooks/useRepository';
import { useLibraryExercise } from '../hooks/useLibraryExercise';
import { getById } from '../services/ExerciseCatalog';
import { GROUP_ORDER, groupOf } from '../utils/muscleGroups';
import { NameTakenError } from '@/core/database/types';

const MARGIN = 20;
const NAME_CHECK_DELAY = 400;

type Mode = 'create' | 'editCatalog' | 'editExercise';

export default function ExerciseFormScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const repo = useRepository();
  const { catalogId, exerciseId: exerciseIdParam } = useLocalSearchParams<{
    catalogId?: string;
    exerciseId?: string;
  }>();
  const exerciseId = exerciseIdParam ? Number(exerciseIdParam) : undefined;
  const mode: Mode = catalogId ? 'editCatalog' : exerciseId !== undefined ? 'editExercise' : 'create';

  const { data: exercises = [], isLoading: exercisesLoading } = useExercises();
  const existingExercise = mode === 'editExercise' ? exercises.find((e) => e.id === exerciseId) : undefined;
  const libraryView = useLibraryExercise(catalogId ?? '');
  const { data: linkedExercise } = useExerciseByCatalogId(catalogId);
  const catalogExercise = catalogId ? getById(catalogId) : undefined;

  const createCustom = useCreateCustomExercise();
  const updateExercise = useUpdateExercise();
  const upsertOverride = useCreateOrUpdateCatalogOverride();
  const resetOverride = useResetExerciseOverride();
  const deleteCustom = useDeleteCustomExercise();

  const [seeded, setSeeded] = useState(false);
  const [name, setName] = useState('');
  const [muscleGroup, setMuscleGroup] = useState<string | null>(null);
  const [isCompound, setIsCompound] = useState(true);
  const [instructions, setInstructions] = useState<string[]>(['']);
  const [nameError, setNameError] = useState<string | null>(null);
  const [groupError, setGroupError] = useState<string | null>(null);

  // Seed form state once from the relevant source — never re-seed after,
  // so it doesn't clobber in-progress edits when the underlying query refetches.
  useEffect(() => {
    if (seeded) return;
    if (mode === 'create') {
      setSeeded(true);
    } else if (mode === 'editCatalog') {
      if (!libraryView) return;
      setName(libraryView.name);
      setIsCompound(libraryView.isCompound);
      setMuscleGroup(libraryView.muscleGroup);
      setInstructions(libraryView.instructions.length > 0 ? libraryView.instructions : ['']);
      setSeeded(true);
    } else if (mode === 'editExercise') {
      if (!existingExercise) return;
      setName(existingExercise.name);
      setIsCompound(existingExercise.isCompound);
      setMuscleGroup(existingExercise.muscleGroup);
      setInstructions(
        existingExercise.instructions && existingExercise.instructions.length > 0
          ? existingExercise.instructions
          : [''],
      );
      setSeeded(true);
    }
  }, [seeded, mode, libraryView, existingExercise]);

  const excludeId = mode === 'editExercise' ? exerciseId : mode === 'editCatalog' ? linkedExercise?.id : undefined;

  // Debounced name-collision check, excluding the row being edited.
  useEffect(() => {
    if (!seeded) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError(null);
      return;
    }
    const handle = setTimeout(() => {
      repo.checkNameAvailable(trimmed, excludeId).then((available) => {
        setNameError(available ? null : t('library.form.nameTaken'));
      });
    }, NAME_CHECK_DELAY);
    return () => clearTimeout(handle);
  }, [name, excludeId, seeded, repo, t]);

  const handlePickMuscleGroup = useCallback(() => {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: t('library.form.muscleGroup'),
        options: [t('common.cancel'), ...GROUP_ORDER.map((g) => t(`muscleGroups.${g}`))],
        cancelButtonIndex: 0,
      },
      (index) => {
        if (index > 0) {
          setMuscleGroup(GROUP_ORDER[index - 1]);
          setGroupError(null);
        }
      },
    );
  }, [t]);

  const updateInstruction = (i: number, text: string) =>
    setInstructions((prev) => prev.map((s, idx) => (idx === i ? text : s)));
  const removeInstruction = (i: number) => setInstructions((prev) => prev.filter((_, idx) => idx !== i));
  const addInstruction = () => setInstructions((prev) => [...prev, '']);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError(t('library.form.nameRequired'));
      return;
    }
    if (!muscleGroup) {
      setGroupError(t('library.form.muscleGroupRequired'));
      return;
    }
    if (nameError) return;

    const cleanInstructions = instructions.map((s) => s.trim()).filter(Boolean);
    const patch = {
      name: trimmed,
      isCompound,
      muscleGroup,
      instructions: cleanInstructions.length > 0 ? cleanInstructions : null,
    };

    try {
      if (mode === 'create') {
        await createCustom.mutateAsync(patch);
      } else if (mode === 'editCatalog' && catalogId) {
        await upsertOverride.mutateAsync({ catalogId, patch });
      } else if (mode === 'editExercise' && exerciseId !== undefined) {
        await updateExercise.mutateAsync({ id: exerciseId, patch });
      }
      router.back();
    } catch (e) {
      if (e instanceof NameTakenError) {
        setNameError(t('library.form.nameTaken'));
      }
    }
  };

  const confirmDelete = async () => {
    if (exerciseId === undefined) return;
    const result = await deleteCustom.mutateAsync(exerciseId);
    if (result.blocked) {
      Alert.alert(
        t('library.form.deleteExercise'),
        t(result.reason === 'logged' ? 'library.form.deleteBlockedLogged' : 'library.form.deleteBlockedPlanned'),
      );
    } else {
      router.back();
    }
  };

  const handleDelete = () => {
    Alert.alert(t('library.form.deleteConfirmTitle'), t('library.form.deleteConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('library.form.deleteExercise'), style: 'destructive', onPress: confirmDelete },
    ]);
  };

  const confirmReset = async () => {
    if (!linkedExercise || !catalogExercise) return;
    await resetOverride.mutateAsync({
      id: linkedExercise.id,
      canonical: {
        name: catalogExercise.name,
        isCompound: catalogExercise.mechanic === 'compound',
        muscleGroup: groupOf(catalogExercise.primaryMuscles),
      },
    });
    router.back();
  };

  const handleReset = () => {
    Alert.alert(t('library.form.resetConfirmTitle'), t('library.form.resetConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('library.form.resetToDefault'), style: 'destructive', onPress: confirmReset },
    ]);
  };

  const notFound =
    (mode === 'editCatalog' && !catalogExercise) ||
    (mode === 'editExercise' && !exercisesLoading && !existingExercise);

  const showDelete = mode === 'editExercise' && existingExercise?.catalogId == null;
  const showReset = mode === 'editCatalog' && !!libraryView?.hasOverride;
  const saving = createCustom.isPending || upsertOverride.isPending || updateExercise.isPending;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.appBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <AppText variant="headlineMd" style={{ flex: 1, marginLeft: Spacing.sm }} numberOfLines={1}>
          {mode === 'create' ? t('library.createExercise') : t('library.editExercise')}
        </AppText>
      </View>

      {notFound ? (
        <View style={styles.notFound}>
          <AppText variant="bodyMd" color={Colors.textMuted} center>
            {t('library.exerciseNotFound')}
          </AppText>
        </View>
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <View style={styles.field}>
              <AppText variant="labelMono" upper color={Colors.textMuted} style={styles.label}>
                {t('library.form.name')}
              </AppText>
              <TextInput
                value={name}
                onChangeText={(v) => {
                  setName(v);
                  setNameError(null);
                }}
                placeholder={t('library.form.namePlaceholder')}
                placeholderTextColor={Colors.textMuted}
                style={styles.input}
              />
              {nameError && (
                <AppText variant="labelMono" color={Colors.danger} style={styles.errorText}>
                  {nameError}
                </AppText>
              )}
            </View>

            <View style={styles.field}>
              <AppText variant="labelMono" upper color={Colors.textMuted} style={styles.label}>
                {t('library.form.muscleGroup')}
              </AppText>
              <TouchableOpacity style={styles.pickerRow} onPress={handlePickMuscleGroup}>
                <AppText variant="bodyMd">
                  {muscleGroup ? t(`muscleGroups.${muscleGroup}`) : t('library.form.muscleGroupRequired')}
                </AppText>
                <Ionicons name="chevron-down" size={18} color={Colors.textMuted} />
              </TouchableOpacity>
              {groupError && (
                <AppText variant="labelMono" color={Colors.danger} style={styles.errorText}>
                  {groupError}
                </AppText>
              )}
            </View>

            <View style={styles.field}>
              <AppText variant="labelMono" upper color={Colors.textMuted} style={styles.label}>
                {t('library.form.compound')}
              </AppText>
              <SegmentedTabs<'compound' | 'isolation'>
                options={[
                  { value: 'compound', label: t('library.form.compound') },
                  { value: 'isolation', label: t('library.form.isolation') },
                ]}
                value={isCompound ? 'compound' : 'isolation'}
                onChange={(v) => setIsCompound(v === 'compound')}
              />
            </View>

            <View style={styles.field}>
              <AppText variant="labelMono" upper color={Colors.textMuted} style={styles.label}>
                {t('library.form.instructions')}
              </AppText>
              {instructions.map((step, i) => (
                <View key={i} style={styles.stepRow}>
                  <AppText variant="labelMono" color={Colors.textMuted} style={styles.stepIndex}>
                    {i + 1}
                  </AppText>
                  <TextInput
                    value={step}
                    onChangeText={(v) => updateInstruction(i, v)}
                    style={[styles.input, styles.stepInput]}
                    multiline
                  />
                  <TouchableOpacity onPress={() => removeInstruction(i)} hitSlop={10}>
                    <Ionicons name="close-circle" size={20} color={Colors.textMuted} />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity onPress={addInstruction} style={styles.addStepRow}>
                <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
                <AppText variant="bodyMd" color={Colors.primary}>
                  {t('library.form.addStep')}
                </AppText>
              </TouchableOpacity>
            </View>

            <View style={styles.saveRow}>
              <Button label={t('common.cancel')} variant="ghost" onPress={() => router.back()} style={{ flex: 1 }} />
              <Button
                label={t('common.save')}
                onPress={handleSave}
                disabled={saving}
                style={{ flex: 1 }}
              />
            </View>

            {showReset && (
              <Button
                label={t('library.form.resetToDefault')}
                variant="ghost"
                onPress={handleReset}
                fullWidth
                style={{ marginTop: Spacing.md }}
              />
            )}
            {showDelete && (
              <Button
                label={t('library.form.deleteExercise')}
                variant="ghost"
                color={Colors.danger}
                onPress={handleDelete}
                fullWidth
                style={{ marginTop: Spacing.md }}
              />
            )}
          </ScrollView>
        </KeyboardAvoidingView>
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
  scroll: { paddingHorizontal: MARGIN, paddingBottom: 64 },
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: MARGIN },
  field: { marginBottom: Spacing.lg },
  label: { marginBottom: Spacing.xs },
  errorText: { marginTop: 4 },
  input: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    fontFamily: Fonts.sans,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  stepIndex: { paddingTop: 12, width: 16 },
  stepInput: { flex: 1 },
  addStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
  },
  saveRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
});
