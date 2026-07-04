import React, { useCallback, useState } from 'react';
import { View, ScrollView, TouchableOpacity, Alert, ActionSheetIOS, StyleSheet, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
import type { PlanDayDetail, PlanExerciseDetail } from '@/core/database/types';

const MARGIN = 20;

function EditExerciseSheet({ exercise, onClose }: { exercise: PlanExerciseDetail; onClose: () => void }) {
  const updatePlanExercise = useUpdatePlanExercise();
  const [targetSets, setTargetSets] = useState(String(exercise.targetSets));
  const [repMin, setRepMin] = useState(exercise.repMin != null ? String(exercise.repMin) : '');
  const [repMax, setRepMax] = useState(exercise.repMax != null ? String(exercise.repMax) : '');

  const handleSave = () => {
    updatePlanExercise.mutate({
      id: exercise.id,
      targetSets: parseInt(targetSets, 10) || exercise.targetSets,
      repMin: repMin ? parseInt(repMin, 10) : null,
      repMax: repMax ? parseInt(repMax, 10) : null,
    });
    onClose();
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <AppText variant="headlineMd">Edit Exercise</AppText>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={24} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>
          <AppText variant="bodyLg" style={{ fontFamily: Fonts.sansBold, marginBottom: Spacing.md }}>
            {exercise.exerciseName}
          </AppText>
          <View style={{ gap: Spacing.md }}>
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
            <Button label="Save" onPress={handleSave} fullWidth />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function PlanEditorScreen() {
  const router = useRouter();
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
    Alert.prompt('New Day', 'Name this day (e.g. "Push")', (name) => {
      if (!name?.trim()) return;
      addPlanDay.mutate({ planId, name: name.trim() });
    });
  }, [addPlanDay, planId]);

  const handleDayMenu = useCallback(
    (day: PlanDayDetail) => {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancel', 'Rename Day', 'Delete Day'], cancelButtonIndex: 0, destructiveButtonIndex: 2 },
        (index) => {
          if (index === 1) {
            Alert.prompt('Rename Day', undefined, (name) => {
              if (!name?.trim()) return;
              renamePlanDay.mutate(
                { planDayId: day.id, name: name.trim() },
                { onError: () => Alert.alert('Could not rename day', 'This plan already has a day with that name.') },
              );
            }, 'plain-text', day.name);
          } else if (index === 2) {
            Alert.alert('Delete day?', `This removes "${day.name}" and its exercises from the plan.`, [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: () => deletePlanDay.mutate(day.id) },
            ]);
          }
        },
      );
    },
    [renamePlanDay, deletePlanDay],
  );

  const handlePlanMenu = useCallback(() => {
    if (!plan) return;
    const options = ['Cancel', 'Rename Plan', ...(plan.isActive ? [] : ['Set Active']), 'Delete Plan'];
    const destructiveButtonIndex = options.length - 1;
    ActionSheetIOS.showActionSheetWithOptions(
      { options, cancelButtonIndex: 0, destructiveButtonIndex },
      (index) => {
        if (index === 1) {
          Alert.prompt('Rename Plan', undefined, (name) => {
            if (!name?.trim()) return;
            renamePlan.mutate(
              { planId, name: name.trim() },
              { onError: () => Alert.alert('Could not rename plan', 'A plan with that name already exists.') },
            );
          }, 'plain-text', plan.name);
        } else if (!plan.isActive && index === 2) {
          setActivePlan.mutate(planId);
        } else if (index === destructiveButtonIndex) {
          Alert.alert('Delete plan?', `This permanently deletes "${plan.name}". Logged history is kept.`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => { deletePlan.mutate(planId); router.back(); } },
          ]);
        }
      },
    );
  }, [plan, planId, renamePlan, setActivePlan, deletePlan, router]);

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
          <AppText variant="labelMono" upper color={Colors.white}>Active Plan</AppText>
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
              const range = formatRepRange(ex.repMin, ex.repMax);
              return (
                <View key={ex.id} style={styles.exRow}>
                  <TouchableOpacity style={{ flex: 1 }} onPress={() => setEditingExercise(ex)} activeOpacity={0.6}>
                    <AppText variant="bodyMd">{ex.exerciseName}</AppText>
                    <AppText variant="labelMono" upper color={Colors.textMuted}>
                      {ex.targetSets} sets{range ? ` · ${range}` : ''}
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
              <AppText variant="labelMono" upper color={Colors.textSecondary}>Add Exercise</AppText>
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity style={styles.addDayBtn} onPress={handleAddDay} activeOpacity={0.7}>
          <Ionicons name="add" size={20} color={Colors.primary} />
          <AppText variant="bodyLg" color={Colors.primary}>Add Day</AppText>
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
