import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { format, isToday, isYesterday } from 'date-fns';
import { Colors, Spacing, FontSize, Radius } from '@/core/theme';
import { weekStartOf } from '@/core/utils/date';
import { dayColorForTag } from '@/features/workout/utils/dayColor';
import { useAllHistory, useDeleteLog } from '@/features/workout/hooks/useWorkoutLogs';
import { useExercises } from '@/features/workout/hooks/useExercises';
import { useUnit } from '@/core/context/UnitContext';
import type { Exercise, WorkoutLogWithExercise } from '@/core/database/types';

// ── Filter types & logic ───────────────────────────────────────────────────────

type DateFilter =
  | { type: 'all' }
  | { type: 'week' }
  | { type: 'month' }
  | { type: 'custom'; year: number; month: number }; // month 0-11

function dateFilterLabel(f: DateFilter): string {
  if (f.type === 'all') return 'All time';
  if (f.type === 'week') return 'This week';
  if (f.type === 'month') return 'This month';
  return format(new Date(f.year, f.month, 1), 'MMM yyyy');
}

function applyDateFilter(
  logs: WorkoutLogWithExercise[],
  f: DateFilter,
): WorkoutLogWithExercise[] {
  if (f.type === 'all') return logs;
  const now = new Date();
  if (f.type === 'week') {
    return logs.filter((l) => l.timestamp >= weekStartOf(Date.now()));
  }
  if (f.type === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    return logs.filter((l) => l.timestamp >= start);
  }
  const start = new Date(f.year, f.month, 1).getTime();
  const end = new Date(f.year, f.month + 1, 0, 23, 59, 59, 999).getTime();
  return logs.filter((l) => l.timestamp >= start && l.timestamp <= end);
}

// ── Grouping ───────────────────────────────────────────────────────────────────

function toLocalDateKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateHeader(ts: number): string {
  const d = new Date(ts);
  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'MMM d · EEEE');
}

type HistoryWorkout = {
  dayTag: string;
  color: string;
  exercises: WorkoutLogWithExercise[];
  workoutKey: string;
};

type HistoryDay = {
  dateKey: string;
  displayDate: string;
  sampleTs: number;
  workouts: HistoryWorkout[];
};

function groupLogs(logs: WorkoutLogWithExercise[]): HistoryDay[] {
  const dateMap = new Map<string, Map<string, WorkoutLogWithExercise[]>>();
  const sampleTs = new Map<string, number>();

  for (const log of logs) {
    const dk = toLocalDateKey(log.timestamp);
    if (!dateMap.has(dk)) {
      dateMap.set(dk, new Map());
      sampleTs.set(dk, log.timestamp);
    }
    const tag = log.dayTag ?? 'Other';
    const wm = dateMap.get(dk)!;
    if (!wm.has(tag)) wm.set(tag, []);
    wm.get(tag)!.push(log);
  }

  return Array.from(dateMap.entries())
    .sort(([a], [b]) => b.localeCompare(a)) // YYYY-MM-DD → lexicographic desc = newest first
    .map(([dk, wm]) => ({
      dateKey: dk,
      displayDate: formatDateHeader(sampleTs.get(dk)!),
      sampleTs: sampleTs.get(dk)!,
      workouts: Array.from(wm.entries()).map(([tag, exercises]) => ({
        dayTag: tag,
        color: dayColorForTag(tag),
        exercises,
        workoutKey: `${dk}::${tag}`,
      })),
    }));
}

// ── Date filter modal ──────────────────────────────────────────────────────────

function DateFilterModal({
  visible,
  current,
  onSelect,
  onClose,
}: {
  visible: boolean;
  current: DateFilter;
  onSelect: (f: DateFilter) => void;
  onClose: () => void;
}) {
  const now = new Date();
  const [py, setPy] = useState(now.getFullYear());
  const [pm, setPm] = useState(now.getMonth());

  useEffect(() => {
    if (!visible) return;
    if (current.type === 'custom') {
      setPy(current.year);
      setPm(current.month);
    } else {
      setPy(now.getFullYear());
      setPm(now.getMonth());
    }
  }, [visible]); // intentional: read current once on open

  function pick(f: DateFilter) {
    onSelect(f);
    onClose();
  }

  function prevMonth() {
    if (pm === 0) { setPm(11); setPy((y) => y - 1); }
    else setPm((m) => m - 1);
  }

  function nextMonth() {
    if (py === now.getFullYear() && pm === now.getMonth()) return;
    if (pm === 11) { setPm(0); setPy((y) => y + 1); }
    else setPm((m) => m + 1);
  }

  const atCurrentMonth = py === now.getFullYear() && pm === now.getMonth();
  const customSelected =
    current.type === 'custom' && current.year === py && current.month === pm;

  const PRESETS: Array<{ label: string; filter: DateFilter }> = [
    { label: 'All time', filter: { type: 'all' } },
    { label: 'This week', filter: { type: 'week' } },
    { label: 'This month', filter: { type: 'month' } },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1 }}>
        <TouchableOpacity
          style={[ms.backdrop]}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={ms.sheet}>
          <View style={ms.handle} />
          <Text style={ms.title}>Filter by date</Text>

          <View style={ms.presetRow}>
            {PRESETS.map(({ label, filter }) => {
              const on = filter.type === current.type && current.type !== 'custom';
              return (
                <TouchableOpacity
                  key={label}
                  style={[ms.chip, on && ms.chipOn]}
                  onPress={() => pick(filter)}
                  activeOpacity={0.7}
                >
                  <Text style={[ms.chipText, on && ms.chipTextOn]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={ms.divider} />
          <Text style={ms.sectionLabel}>SPECIFIC MONTH</Text>

          <View style={ms.stepper}>
            <TouchableOpacity style={ms.stepBtn} onPress={prevMonth} activeOpacity={0.7}>
              <Text style={ms.stepArrow}>‹</Text>
            </TouchableOpacity>
            <Text style={ms.stepMonth}>
              {format(new Date(py, pm, 1), 'MMMM yyyy')}
            </Text>
            <TouchableOpacity
              style={[ms.stepBtn, atCurrentMonth && ms.stepBtnDim]}
              onPress={nextMonth}
              activeOpacity={0.7}
              disabled={atCurrentMonth}
            >
              <Text style={[ms.stepArrow, atCurrentMonth && ms.stepArrowDim]}>›</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[ms.useBtn, customSelected && ms.useBtnOn]}
            onPress={() => pick({ type: 'custom', year: py, month: pm })}
            activeOpacity={0.8}
          >
            <Text style={[ms.useBtnText, customSelected && ms.useBtnTextOn]}>
              {customSelected
                ? `Showing ${format(new Date(py, pm, 1), 'MMM yyyy')}`
                : `Use ${format(new Date(py, pm, 1), 'MMM yyyy')}`}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── Exercise filter modal ──────────────────────────────────────────────────────

type ExItem = { id: number | null; name: string };

function ExerciseFilterModal({
  visible,
  exercises,
  selectedId,
  onSelect,
  onClose,
}: {
  visible: boolean;
  exercises: Exercise[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!visible) setQuery('');
  }, [visible]);

  const filtered = useMemo(
    () =>
      query.trim()
        ? exercises.filter((e) =>
            e.name.toLowerCase().includes(query.toLowerCase()),
          )
        : exercises,
    [exercises, query],
  );

  const items: ExItem[] = [
    { id: null, name: 'All exercises' },
    ...filtered.map((e) => ({ id: e.id, name: e.name })),
  ];

  function pick(id: number | null) {
    onSelect(id);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1 }}>
        <TouchableOpacity style={ms.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={[ms.sheet, ms.sheetTall]}>
          <View style={ms.handle} />
          <Text style={ms.title}>Filter by exercise</Text>

          <TextInput
            style={ef.search}
            placeholder="Search exercises…"
            placeholderTextColor={Colors.textMuted}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            clearButtonMode="while-editing"
          />

          <FlatList<ExItem>
            data={items}
            keyExtractor={(item) => String(item.id ?? 'all')}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const on = item.id === selectedId;
              return (
                <TouchableOpacity
                  style={[ef.row, on && ef.rowOn]}
                  onPress={() => pick(item.id)}
                  activeOpacity={0.7}
                >
                  <Text style={[ef.rowText, on && ef.rowTextOn]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {on && <Text style={ef.check}>✓</Text>}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

// ── Filter bar ─────────────────────────────────────────────────────────────────

function FilterBar({
  dateFilter,
  exerciseId,
  exerciseName,
  onDatePress,
  onExercisePress,
}: {
  dateFilter: DateFilter;
  exerciseId: number | null;
  exerciseName: string | null;
  onDatePress: () => void;
  onExercisePress: () => void;
}) {
  const dateOn = dateFilter.type !== 'all';
  const exOn = exerciseId !== null;

  return (
    <View style={fb.row}>
      <TouchableOpacity
        style={[fb.btn, dateOn && fb.btnOn]}
        onPress={onDatePress}
        activeOpacity={0.7}
      >
        <Text style={[fb.label, dateOn && fb.labelOn]} numberOfLines={1}>
          {dateFilterLabel(dateFilter)}
        </Text>
        <Text style={[fb.chevron, dateOn && fb.chevronOn]}>▾</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[fb.btn, exOn && fb.btnOn]}
        onPress={onExercisePress}
        activeOpacity={0.7}
      >
        <Text style={[fb.label, exOn && fb.labelOn]} numberOfLines={1}>
          {exOn && exerciseName ? exerciseName : 'All exercises'}
        </Text>
        <Text style={[fb.chevron, exOn && fb.chevronOn]}>▾</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Exercise row ───────────────────────────────────────────────────────────────

function ExerciseRow({
  log,
  color,
  onDelete,
}: {
  log: WorkoutLogWithExercise;
  color: string;
  onDelete: () => void;
}) {
  const { display, label: unit } = useUnit();
  if (log.sets.length === 0) return null;

  const totalVolume = log.sets.reduce((a, s) => a + s.reps * s.weight, 0);
  const topSet = log.sets.reduce(
    (best, s) => (s.weight > best.weight ? s : best),
    log.sets[0],
  );

  return (
    <View style={er.wrap}>
      <View style={[er.accent, { backgroundColor: color + '60' }]} />
      <View style={er.body}>
        <View style={er.nameRow}>
          <Text style={er.name} numberOfLines={1}>{log.exerciseName}</Text>
          <TouchableOpacity
            onPress={onDelete}
            hitSlop={{ top: 8, bottom: 8, left: 12, right: 4 }}
          >
            <Text style={er.del}>✕</Text>
          </TouchableOpacity>
        </View>
        <View style={er.chips}>
          <StatChip label={`${log.sets.length} sets`} />
          <StatChip
            label={`${display(topSet.weight)} ${unit} × ${topSet.reps}`}
            accent
            color={color}
          />
          <StatChip label={`${display(totalVolume)} ${unit} vol`} />
        </View>
      </View>
    </View>
  );
}

function StatChip({
  label,
  accent,
  color,
}: {
  label: string;
  accent?: boolean;
  color?: string;
}) {
  const c = color ?? Colors.primary;
  return (
    <View
      style={[
        ck.wrap,
        {
          backgroundColor: accent ? c + '18' : Colors.surfaceAlt,
          borderColor: accent ? c + '40' : Colors.border,
        },
      ]}
    >
      <Text
        style={[
          ck.text,
          { color: accent ? c : Colors.textSecondary, fontWeight: accent ? '700' : '400' },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────────

export default function HistoryScreen() {
  const router = useRouter();
  const { data: logs = [], isLoading } = useAllHistory();
  const { data: exercises = [] } = useExercises();
  const { mutate: deleteLog } = useDeleteLog();

  // Opening History from an exercise pre-filters to that exercise.
  const routeParams = useLocalSearchParams<{ exerciseId?: string }>();

  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const [collapsedWorkouts, setCollapsedWorkouts] = useState<Set<string>>(new Set());
  const [dateFilter, setDateFilter] = useState<DateFilter>({ type: 'all' });
  const [exerciseId, setExerciseId] = useState<number | null>(
    routeParams.exerciseId ? Number(routeParams.exerciseId) : null,
  );

  // Re-apply when navigated here with a (new) exerciseId param.
  useEffect(() => {
    if (routeParams.exerciseId) setExerciseId(Number(routeParams.exerciseId));
  }, [routeParams.exerciseId]);
  const [showDateModal, setShowDateModal] = useState(false);
  const [showExModal, setShowExModal] = useState(false);

  const exerciseName = useMemo(
    () =>
      exerciseId !== null
        ? exercises.find((e) => e.id === exerciseId)?.name ?? null
        : null,
    [exerciseId, exercises],
  );

  const filteredLogs = useMemo(() => {
    let result = logs;
    if (exerciseId !== null) result = result.filter((l) => l.exerciseId === exerciseId);
    return applyDateFilter(result, dateFilter);
  }, [logs, exerciseId, dateFilter]);

  const grouped = useMemo(() => groupLogs(filteredLogs), [filteredLogs]);

  const toggleDate = (key: string) =>
    setExpandedDates((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const toggleWorkout = (key: string) =>
    setCollapsedWorkouts((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const handleDelete = (logId: number) => {
    Alert.alert('Delete log?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteLog(logId) },
    ]);
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={s.title}>History</Text>
        {logs.length > 0 && (
          <Text style={s.sub}>
            {filteredLogs.length !== logs.length
              ? `${filteredLogs.length} of ${logs.length} sessions`
              : `${logs.length} sessions logged`}
          </Text>
        )}
      </View>

      <FilterBar
        dateFilter={dateFilter}
        exerciseId={exerciseId}
        exerciseName={exerciseName}
        onDatePress={() => setShowDateModal(true)}
        onExercisePress={() => setShowExModal(true)}
      />

      {isLoading ? (
        <View style={s.center}>
          <Text style={s.muted}>Loading…</Text>
        </View>
      ) : grouped.length === 0 ? (
        <View style={s.center}>
          <Text style={s.emptyTitle}>No workouts found</Text>
          <Text style={s.muted}>
            {logs.length > 0
              ? 'Try adjusting the filters above.'
              : 'Complete a workout to see history here.'}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.scroll}>
          {grouped.map((day) => {
            const dateOpen = expandedDates.has(day.dateKey);
            const totalEx = day.workouts.reduce((n, w) => n + w.exercises.length, 0);

            return (
              <View key={day.dateKey} style={s.dateCard}>
                <TouchableOpacity
                  style={s.dateRow}
                  onPress={() => toggleDate(day.dateKey)}
                  activeOpacity={0.7}
                >
                  <View style={s.dateMeta}>
                    <Text style={s.dateLabel}>{day.displayDate}</Text>
                    <Text style={s.dateSub}>
                      {day.workouts.map((w) => w.dayTag).join(' · ')}
                      {'  ·  '}{totalEx} exercises
                    </Text>
                  </View>
                  <Text style={s.chevron}>{dateOpen ? '▲' : '▼'}</Text>
                </TouchableOpacity>

                {dateOpen &&
                  day.workouts.map((workout) => {
                    const wkOpen = !collapsedWorkouts.has(workout.workoutKey);
                    return (
                      <View key={workout.workoutKey}>
                        <TouchableOpacity
                          style={[s.workoutRow, { borderLeftColor: workout.color }]}
                          onPress={() => toggleWorkout(workout.workoutKey)}
                          activeOpacity={0.7}
                        >
                          <View
                            style={[
                              s.badge,
                              {
                                backgroundColor: workout.color + '20',
                                borderColor: workout.color + '60',
                              },
                            ]}
                          >
                            <Text style={[s.badgeText, { color: workout.color }]}>
                              {workout.dayTag.slice(0, 3).toUpperCase()}
                            </Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[s.workoutName, { color: workout.color }]}>
                              {workout.dayTag}
                            </Text>
                            <Text style={s.workoutMeta}>
                              {workout.exercises.length} exercises
                            </Text>
                          </View>
                          <Text style={[s.chevron, { color: workout.color }]}>
                            {wkOpen ? '▲' : '▼'}
                          </Text>
                        </TouchableOpacity>

                        {wkOpen &&
                          workout.exercises.map((log) => (
                            <ExerciseRow
                              key={log.id}
                              log={log}
                              color={workout.color}
                              onDelete={() => handleDelete(log.id)}
                            />
                          ))}
                      </View>
                    );
                  })}
              </View>
            );
          })}
        </ScrollView>
      )}

      <DateFilterModal
        visible={showDateModal}
        current={dateFilter}
        onSelect={setDateFilter}
        onClose={() => setShowDateModal(false)}
      />

      <ExerciseFilterModal
        visible={showExModal}
        exercises={exercises}
        selectedId={exerciseId}
        onSelect={setExerciseId}
        onClose={() => setShowExModal(false)}
      />
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  backBtn: { marginBottom: Spacing.sm, alignSelf: 'flex-start' },
  title: { color: Colors.textPrimary, fontSize: FontSize.xxl, fontWeight: '800' },
  sub: { color: Colors.textMuted, fontSize: FontSize.sm, marginTop: 2 },
  scroll: { padding: Spacing.md, paddingBottom: 80 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xxl,
  },
  emptyTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: '700',
    marginBottom: Spacing.sm,
  },
  muted: { color: Colors.textMuted, fontSize: FontSize.sm, textAlign: 'center' },

  // Date card
  dateCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    marginBottom: Spacing.sm,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  dateMeta: { flex: 1 },
  dateLabel: { color: Colors.textPrimary, fontSize: FontSize.md, fontWeight: '700' },
  dateSub: { color: Colors.textMuted, fontSize: FontSize.xs, marginTop: 2 },
  chevron: { color: Colors.textMuted, fontSize: 11, marginLeft: Spacing.sm },

  // Workout type row
  workoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderLeftWidth: 3,
    gap: Spacing.sm,
    backgroundColor: Colors.surfaceAlt,
  },
  badge: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: FontSize.xs, fontWeight: '800', letterSpacing: 0.5 },
  workoutName: { fontSize: FontSize.sm, fontWeight: '800', letterSpacing: 0.3 },
  workoutMeta: { color: Colors.textMuted, fontSize: FontSize.xs, marginTop: 1 },
});

// Exercise row
const er = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  accent: {
    width: 3,
    borderRadius: 2,
    marginRight: Spacing.sm,
    alignSelf: 'stretch',
  },
  body: { flex: 1 },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  name: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: '600',
    flex: 1,
    marginRight: Spacing.sm,
  },
  del: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '700' },
  chips: { flexDirection: 'row', gap: 5, flexWrap: 'wrap' },
});

// Stat chip
const ck = StyleSheet.create({
  wrap: {
    borderRadius: Radius.full,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  text: { fontSize: FontSize.xs },
});

// Filter bar
const fb = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: 0,
    minHeight: 44,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  btnOn: {
    backgroundColor: Colors.primary + '10',
    borderColor: Colors.primary + '70',
  },
  label: { color: Colors.textSecondary, fontSize: FontSize.sm, flex: 1 },
  labelOn: { color: Colors.primary, fontWeight: '600' },
  chevron: { color: Colors.textMuted, fontSize: 12, marginLeft: 4 },
  chevronOn: { color: Colors.primary },
});

// Modal shared styles
const ms = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#00000055',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
    paddingTop: Spacing.sm,
  },
  sheetTall: { maxHeight: '70%' },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: Radius.full,
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: '800',
    marginBottom: Spacing.md,
  },
  // Date preset chips
  presetRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  chip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceAlt,
  },
  chipOn: {
    backgroundColor: Colors.primary + '15',
    borderColor: Colors.primary,
  },
  chipText: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: '600' },
  chipTextOn: { color: Colors.primary },
  divider: { height: 1, backgroundColor: Colors.border, marginBottom: Spacing.md },
  sectionLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: Spacing.sm,
  },
  // Month stepper
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  stepBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceAlt,
  },
  stepBtnDim: { opacity: 0.3 },
  stepArrow: { color: Colors.textPrimary, fontSize: 24, lineHeight: 28 },
  stepArrowDim: { color: Colors.textMuted },
  stepMonth: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    fontWeight: '700',
    textAlign: 'center',
  },
  useBtn: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.md,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  useBtnOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  useBtnText: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: '700' },
  useBtnTextOn: { color: Colors.white },
});

// Exercise filter modal
const ef = StyleSheet.create({
  search: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    marginBottom: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 2,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  rowOn: { backgroundColor: Colors.primary + '08' },
  rowText: { color: Colors.textPrimary, fontSize: FontSize.sm, flex: 1 },
  rowTextOn: { color: Colors.primary, fontWeight: '700' },
  check: { color: Colors.primary, fontWeight: '700', fontSize: FontSize.sm },
});
