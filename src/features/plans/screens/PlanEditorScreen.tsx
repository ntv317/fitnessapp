import React, { useCallback, useState } from 'react';
import { View, ScrollView, TouchableOpacity, Alert, ActionSheetIOS, StyleSheet, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Colors, Spacing, Radius, Fonts } from '@/core/theme';
import { AppText, Button, StepperInput } from '@/core/ui';
import {
  usePlanDetail,
  useAddPlanDay,
  useRenamePlanDay,
  useDeletePlanDay,
  useRemovePlanExercise,
  useRenamePlan,
  useDeletePlan,
  useSetActivePlan,
  useUpdatePlanExercise,
} from '@/features/workout/hooks/usePlans';
import { formatRepRange } from '@/features/workout/utils/repRange';
import { AddExerciseSheet } from '../components/AddExerciseSheet';
import { useExercises } from '@/features/workout/hooks/useExercises';
import { useExerciseDisplayName } from '@/features/library/hooks/useExerciseDisplayName';
import type { PlanDayDetail, PlanExerciseDetail } from '@/core/database/types';

const MARGIN = 20;

// PlanExerciseDetail only carries the stored (English) name — resolve the
// localized one through the exercise row it points at.
function usePlanExerciseName(): (detail: PlanExerciseDetail) => string {
  const { data: exercises = [] } = useExercises();
  const exerciseDisplayName = useExerciseDisplayName();
  return (detail) => {
    const ex = exercises.find((e) => e.id === detail.exerciseId);
    return ex ? exerciseDisplayName(ex) : detail.exerciseName;
  };
}

function EditExerciseSheet({ exercise, onClose }: { exercise: PlanExerciseDetail; onClose: () => void }) {
  const { t } = useTranslation();
  const planExerciseName = usePlanExerciseName();
  const updatePlanExercise = useUpdatePlanExercise();
  const [targetSets, setTargetSets] = useState(String(exercise.targetSets));
  const [repMin, setRepMin] = useState(exercise.repMin != null ? String(exercise.repMin) : '');
  const [repMax, setRepMax] = useState(exercise.repMax != null ? String(exercise.repMax) : '');

  const handleSave = useCallback(() => {
    updatePlanExercise.mutate({
      id: exercise.id,
      targetSets: parseInt(targetSets, 10) || exercise.targetSets,
      repMin: repMin ? parseInt(repMin, 10) : null,
      repMax: repMax ? parseInt(repMax, 10) : null,
    });
    onClose();
  }, [updatePlanExercise, exercise.id, exercise.targetSets, targetSets, repMin, repMax, onClose]);

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <AppText variant="headlineMd">{t('plans.editExercise')}</AppText>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={24} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>
          <AppText variant="bodyLg" style={{ fontFamily: Fonts.sansBold, marginBottom: Spacing.md }}>
            {planExerciseName(exercise)}
          </AppText>
          <View style={{ gap: Spacing.md }}>
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
            <Button label={t('common.save')} onPress={handleSave} fullWidth />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function PlanEditorScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const planExerciseName = usePlanExerciseName();
  const { id } = useLocalSearchParams<{ id: string }>();
  const planId = Number(id);
  const { data: plan } = usePlanDetail(planId);

  const addPlanDay = useAddPlanDay();
  const renamePlanDay = useRenamePlanDay();
  const deletePlanDay = useDeletePlanDay();
  const removePlanExercise = useRemovePlanExercise();
  const renamePlan = useRenamePlan();
  const deletePlan = useDeletePlan();
  const setActivePlan = useSetActivePlan();

  const [sheetDayId, setSheetDayId] = useState<number | null>(null);
  const [editingExercise, setEditingExercise] = useState<PlanExerciseDetail | null>(null);

  const handleAddDay = useCallback(() => {
    Alert.prompt(t('plans.newDayTitle'), t('plans.newDaySubtitle'), (name) => {
      if (!name?.trim()) return;
      addPlanDay.mutate({ planId, name: name.trim() });
    });
  }, [addPlanDay, planId, t]);

  const handleDayMenu = useCallback(
    (day: PlanDayDetail) => {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: [t('common.cancel'), t('plans.renameDay'), t('plans.deleteDay')], cancelButtonIndex: 0, destructiveButtonIndex: 2 },
        (index) => {
          if (index === 1) {
            Alert.prompt(t('plans.renameDay'), undefined, (name) => {
              if (!name?.trim()) return;
              renamePlanDay.mutate(
                { planDayId: day.id, name: name.trim() },
                { onError: () => Alert.alert(t('plans.renameDayError'), t('plans.dayAlreadyExists')) },
              );
            }, 'plain-text', day.name);
          } else if (index === 2) {
            Alert.alert(t('plans.deleteDay'), t('plans.deleteDayBody', { dayName: day.name }), [
              { text: t('common.cancel'), style: 'cancel' },
              { text: t('plans.delete'), style: 'destructive', onPress: () => deletePlanDay.mutate(day.id) },
            ]);
          }
        },
      );
    },
    [renamePlanDay, deletePlanDay, t],
  );

  const handlePlanMenu = useCallback(() => {
    if (!plan) return;
    const options = [t('common.cancel'), t('plans.renamePlan'), ...(plan.isActive ? [] : [t('plans.setActive')]), t('plans.deletePlan')];
    const destructiveButtonIndex = options.length - 1;
    ActionSheetIOS.showActionSheetWithOptions(
      { options, cancelButtonIndex: 0, destructiveButtonIndex },
      (index) => {
        if (index === 1) {
          Alert.prompt(t('plans.renamePlan'), undefined, (name) => {
            if (!name?.trim()) return;
            renamePlan.mutate(
              { planId, name: name.trim() },
              { onError: () => Alert.alert(t('plans.renamePlanError'), t('plans.alreadyExists')) },
            );
          }, 'plain-text', plan.name);
        } else if (!plan.isActive && index === 2) {
          setActivePlan.mutate(planId);
        } else if (index === destructiveButtonIndex) {
          Alert.alert(t('plans.deletePlan'), t('plans.deletePlanBody', { planName: plan.name }), [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('plans.delete'), style: 'destructive', onPress: () => { deletePlan.mutate(planId); router.back(); } },
          ]);
        }
      },
    );
  }, [plan, planId, renamePlan, setActivePlan, deletePlan, router, t]);

  if (!plan) {
    return <SafeAreaView style={styles.safe} edges={['top']} />;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.appBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <AppText variant="headlineMd" style={{ flex: 1, marginLeft: Spacing.sm }} numberOfLines={1}>
          {plan.name}
        </AppText>
        <TouchableOpacity onPress={handlePlanMenu} hitSlop={10}>
          <Ionicons name="ellipsis-horizontal" size={22} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {plan.isActive && (
        <View style={styles.activeBanner}>
          <AppText variant="labelMono" upper color={Colors.white}>{t('plans.activePlan')}</AppText>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scroll}>
        {plan.days.map((day) => (
          <View key={day.id} style={styles.dayCard}>
            <View style={styles.dayHeader}>
              <AppText variant="headlineMd">{day.name}</AppText>
              <TouchableOpacity onPress={() => handleDayMenu(day)} hitSlop={10}>
                <Ionicons name="ellipsis-horizontal" size={18} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {day.exercises.map((ex) => {
              const range = formatRepRange(ex.repMin, ex.repMax, t('workout.repsUnit'));
              return (
                <View key={ex.id} style={styles.exRow}>
                  <TouchableOpacity style={{ flex: 1 }} onPress={() => setEditingExercise(ex)} activeOpacity={0.6}>
                    <AppText variant="bodyMd">{planExerciseName(ex)}</AppText>
                    <AppText variant="labelMono" upper color={Colors.textMuted}>
                      {t('plans.setsLabel', { count: ex.targetSets })}{range ? ` · ${range}` : ''}
                    </AppText>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => removePlanExercise.mutate(ex.id)} hitSlop={10}>
                    <Ionicons name="trash-outline" size={18} color={Colors.danger} />
                  </TouchableOpacity>
                </View>
              );
            })}

            <TouchableOpacity style={styles.addExRow} onPress={() => setSheetDayId(day.id)} activeOpacity={0.7}>
              <Ionicons name="add" size={18} color={Colors.textSecondary} />
              <AppText variant="labelMono" upper color={Colors.textSecondary}>{t('plans.addExercise')}</AppText>
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity style={styles.addDayBtn} onPress={handleAddDay} activeOpacity={0.7}>
          <Ionicons name="add" size={20} color={Colors.primary} />
          <AppText variant="bodyLg" color={Colors.primary}>{t('plans.addDay')}</AppText>
        </TouchableOpacity>
      </ScrollView>

      {sheetDayId != null && (
        <AddExerciseSheet visible planDayId={sheetDayId} onClose={() => setSheetDayId(null)} />
      )}

      {editingExercise && (
        <EditExerciseSheet exercise={editingExercise} onClose={() => setEditingExercise(null)} />
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
  activeBanner: {
    backgroundColor: Colors.tertiary,
    paddingVertical: 6,
    alignItems: 'center',
  },
  scroll: { padding: MARGIN, gap: Spacing.lg, paddingBottom: 80 },
  dayCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  exRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  addExRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm + 2,
    marginTop: Spacing.sm,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: Colors.border,
    borderRadius: Radius.sm,
  },
  addDayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: Colors.primaryTint,
    borderRadius: Radius.md,
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    padding: Spacing.lg,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
});
