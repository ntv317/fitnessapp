import React, { useEffect, useRef, useState } from 'react';
import { View, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { format } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Fonts } from '@/core/theme';
import { AppText, StepperInput } from '@/core/ui';
import { PlateChips } from '@/core/ui/PlateChips';
import { useUnit } from '@/core/context/UnitContext';
import { useBarbellConfig } from '../../hooks/useBarbellConfig';
import { calculatePlates } from '@/core/utils/plateCalculator';
import { dateFnsLocale } from '@/core/utils/date';

export interface EditingSetData {
  logId: number;
  setOrder: number;
  timestamp: number;
  weightKg: number;
  reps: number;
  rpe: number | null;
  note: string | null;
}

interface SetInputCardProps {
  accent: string;
  loggedCount: number;
  target: number;
  prefillWeightKg: number;
  prefillReps: number;
  editing: EditingSetData | null;
  onLog: (weightKg: number, reps: number, rpe: number | null, note: string | null) => void;
  onUpdate: (weightKg: number, reps: number, rpe: number | null, note: string | null) => void;
  onDelete: () => void;
  onCancelEdit: () => void;
}

/**
 * Two modes sharing one input:
 *  - Log: the next set to record — pre-filled from the last session, "+" appends it.
 *  - Edit: a past set was tapped in the history list — pre-filled with its values,
 *    "+" becomes an update, plus a delete action and a Cancel back to log mode.
 */
export function SetInputCard({
  accent,
  loggedCount,
  target,
  prefillWeightKg,
  prefillReps,
  editing,
  onLog,
  onUpdate,
  onDelete,
  onCancelEdit,
}: SetInputCardProps) {
  const { unit, toKg, fromKg, showPlateBreakdown, conversionHint } = useUnit();
  const weightStep = unit === 'kg' ? 2.5 : 5;
  const { config: barbellConfig } = useBarbellConfig();
  const [weightText, setWeightText] = useState('');
  const [repsText, setRepsText] = useState('');
  const [rpeText, setRpeText] = useState('');
  const [noteText, setNoteText] = useState('');
  const [extrasOpen, setExtrasOpen] = useState(false);
  // Tracks whether the user has typed into this slot since it was last seeded.
  // Prefill values can arrive asynchronously (history query still loading) — if
  // the user starts typing during that gap, a late-arriving prefill must not
  // clobber what they already entered.
  const touchedSinceSeedRef = useRef(false);

  // Re-seed on a genuine slot change: switching which set is being edited, or
  // (in log mode) a new set just got logged. Resets the touch guard.
  useEffect(() => {
    touchedSinceSeedRef.current = false;
    if (editing) {
      setWeightText(String(Math.round(fromKg(editing.weightKg) * 10) / 10));
      setRepsText(String(editing.reps));
      setRpeText(editing.rpe != null ? String(editing.rpe) : '');
      setNoteText(editing.note ?? '');
      setExtrasOpen(editing.rpe != null || !!editing.note);
    } else {
      setWeightText(prefillWeightKg > 0 ? String(Math.round(fromKg(prefillWeightKg) * 10) / 10) : '');
      setRepsText(prefillReps > 0 ? String(prefillReps) : '');
      setRpeText('');
      setNoteText('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing?.logId, editing?.setOrder, loggedCount]);

  // Apply late-arriving prefill values for the SAME slot — but only if the user
  // hasn't started typing here yet.
  useEffect(() => {
    if (editing || touchedSinceSeedRef.current) return;
    setWeightText(prefillWeightKg > 0 ? String(Math.round(fromKg(prefillWeightKg) * 10) / 10) : '');
    setRepsText(prefillReps > 0 ? String(prefillReps) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillWeightKg, prefillReps]);

  const handleWeightChange = (v: string) => {
    touchedSinceSeedRef.current = true;
    setWeightText(v);
  };
  const handleRepsChange = (v: string) => {
    touchedSinceSeedRef.current = true;
    setRepsText(v);
  };

  // If the user switches kg/lbs mid-entry, convert the not-yet-saved typed
  // weight so the physical load stays the same instead of silently changing.
  const prevUnitRef = useRef(unit);
  useEffect(() => {
    const prevUnit = prevUnitRef.current;
    prevUnitRef.current = unit;
    if (prevUnit === unit) return;
    const typed = parseFloat(weightText);
    if (!typed) return;
    const KG_PER_LB = 0.45359237;
    const oldToKg = (v: number) => (prevUnit === 'kg' ? v : v * KG_PER_LB);
    setWeightText(String(Math.round(fromKg(oldToKg(typed)) * 10) / 10));
    // fromKg already reflects the new unit; prevUnitRef tracks the old one
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unit]);

  const typedWeightKg = toKg(parseFloat(weightText) || 0);
  const typedReps = parseInt(repsText, 10) || 0;
  const plateResult =
    typedWeightKg > 0 && barbellConfig.plates.length > 0
      ? calculatePlates(typedWeightKg, barbellConfig.barWeight, barbellConfig.plates)
      : null;
  const showPlates = plateResult && plateResult.plates.length > 0 && showPlateBreakdown;
  const hint = !showPlates ? conversionHint(parseFloat(weightText) || 0) : null;

  const handlePrimary = () => {
    if (!typedReps) return;
    const rpeRaw = parseFloat(rpeText);
    const rpe = rpeRaw >= 1 && rpeRaw <= 10 ? rpeRaw : null;
    const note = noteText.trim() || null;
    if (editing) {
      onUpdate(typedWeightKg, typedReps, rpe, note);
    } else {
      onLog(typedWeightKg, typedReps, rpe, note);
    }
  };

  return (
    <View style={styles.wrap}>
      {editing && (
        <View style={[styles.editHeader, { backgroundColor: accent }]}>
          <View style={styles.editHeaderLeft}>
            <Ionicons name="calendar-outline" size={16} color={Colors.white} />
            <AppText variant="labelMono" upper color={Colors.white}>
              {format(new Date(editing.timestamp), 'd MMM yyyy', { locale: dateFnsLocale() })}
            </AppText>
          </View>
          <TouchableOpacity onPress={onCancelEdit} hitSlop={10}>
            <AppText variant="labelMono" upper color={Colors.white} style={{ fontFamily: Fonts.sansBold }}>
              Cancel
            </AppText>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.row}>
        <View style={styles.field}>
          <AppText variant="labelMono" upper color={Colors.textMuted}>Weight ({unit})</AppText>
          <StepperInput value={weightText} onChangeText={handleWeightChange} step={weightStep} decimal color={accent} style={styles.stepper} />
        </View>
        <View style={styles.field}>
          <AppText variant="labelMono" upper color={Colors.textMuted}>Reps</AppText>
          <StepperInput value={repsText} onChangeText={handleRepsChange} step={1} color={accent} style={styles.stepper} />
        </View>

        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: editing ? accent : Colors.white, borderColor: accent, borderWidth: editing ? 0 : 2 }]}
          onPress={handlePrimary}
          activeOpacity={0.8}
        >
          <Ionicons name={editing ? 'checkmark' : 'add'} size={26} color={editing ? Colors.white : accent} />
        </TouchableOpacity>

        {editing && (
          <TouchableOpacity style={styles.deleteBtn} onPress={onDelete} activeOpacity={0.7} hitSlop={10}>
            <Ionicons name="trash-outline" size={20} color={Colors.danger} />
          </TouchableOpacity>
        )}
      </View>

      {!editing && (
        <AppText variant="labelMono" upper color={Colors.textMuted} style={{ marginTop: Spacing.sm }}>
          {loggedCount} of {target} sets
        </AppText>
      )}

      <TouchableOpacity style={styles.extrasToggle} onPress={() => setExtrasOpen((o) => !o)} hitSlop={6}>
        <AppText variant="labelMono" upper color={Colors.textSecondary}>RPE / Note</AppText>
        <Ionicons name={extrasOpen ? 'chevron-up' : 'chevron-down'} size={14} color={Colors.textSecondary} />
      </TouchableOpacity>
      {extrasOpen && (
        <View style={styles.extrasRow}>
          <View style={styles.rpeField}>
            <AppText variant="labelMono" upper color={Colors.textMuted}>RPE</AppText>
            <StepperInput value={rpeText} onChangeText={setRpeText} step={0.5} min={0} decimal color={accent} placeholder="—" style={styles.rpeStepper} />
          </View>
          <View style={styles.noteField}>
            <AppText variant="labelMono" upper color={Colors.textMuted}>Note</AppText>
            <TextInput
              value={noteText}
              onChangeText={setNoteText}
              placeholder="e.g. felt heavy"
              placeholderTextColor={Colors.textMuted}
              style={styles.noteInput}
              maxLength={120}
            />
          </View>
        </View>
      )}

      {showPlates ? (
        <PlateChips
          plates={plateResult!.plates}
          barWeight={Math.round(fromKg(barbellConfig.barWeight) * 10) / 10}
          totalWeight={fromKg(plateResult!.achievable)}
          exact={plateResult!.exact}
          unit={unit}
        />
      ) : hint ? (
        <AppText variant="labelMono" color={Colors.textMuted} style={{ marginTop: 4 }}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginTop: Spacing.lg,
  },
  editHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
  },
  editHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm },
  field: { flex: 1, gap: 4 },
  // Same height as actionBtn so the row's bottom-aligned children line up flush.
  stepper: { height: 52 },
  rpeStepper: { height: 44 },
  actionBtn: {
    width: 52,
    height: 52,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: {
    width: 44,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  extrasToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: Spacing.sm,
    alignSelf: 'flex-start',
  },
  extrasRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  rpeField: { width: 132, gap: 4 },
  noteField: { flex: 1, gap: 4 },
  noteInput: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    height: 44,
    fontFamily: Fonts.sans,
    fontSize: 15,
    color: Colors.textPrimary,
  },
});
