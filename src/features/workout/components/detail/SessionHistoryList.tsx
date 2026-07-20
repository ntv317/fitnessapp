import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { Colors, Spacing, Radius, Fonts } from '@/core/theme';
import { AppText } from '@/core/ui';
import { useUnit } from '@/core/context/UnitContext';
import { dateFnsLocale } from '@/core/utils/date';
import type { WorkoutLog } from '@/core/database/types';

interface SessionHistoryListProps {
  logs: WorkoutLog[];
  accent: string;
  onEditSet: (log: WorkoutLog, setOrder: number) => void;
}

/** Every logged session for this exercise, newest first, grouped by date. Tap a set row to edit it. */
export function SessionHistoryList({ logs, accent, onEditSet }: SessionHistoryListProps) {
  const { t } = useTranslation();
  const { fromKg, unit } = useUnit();

  if (logs.length === 0) return null;

  return (
    <View style={{ marginTop: Spacing.xl, gap: Spacing.md }}>
      {logs.map((log) => (
        <View key={log.id} style={styles.card}>
          <View style={[styles.dateBlock, { backgroundColor: accent }]}>
            <AppText variant="headlineMd" color={Colors.white} style={{ fontFamily: Fonts.sansBold }}>
              {format(new Date(log.timestamp), 'dd', { locale: dateFnsLocale() })}
            </AppText>
            <AppText variant="labelMono" upper color={Colors.white}>
              {format(new Date(log.timestamp), 'MMM', { locale: dateFnsLocale() })}
            </AppText>
          </View>

          <View style={styles.setsBlock}>
            <View style={styles.headRow}>
              <AppText variant="labelMono" upper color={Colors.textMuted} style={styles.col}>
                {t('workout.weight')} ({unit})
              </AppText>
              <AppText variant="labelMono" upper color={Colors.textMuted} style={styles.col}>
                {t('workout.reps')}
              </AppText>
            </View>
            {log.sets.map((s) => (
              <TouchableOpacity
                key={s.setOrder}
                style={styles.setRow}
                activeOpacity={0.6}
                onPress={() => onEditSet(log, s.setOrder)}
              >
                <View style={styles.valuesRow}>
                  <AppText variant="bodyLg" style={styles.col}>
                    {Math.round(fromKg(s.weight) * 10) / 10}
                  </AppText>
                  <View style={[styles.col, styles.repsCell]}>
                    <AppText variant="bodyLg">{s.reps}</AppText>
                    {s.rpe != null && (
                      <View style={[styles.rpeBadge, { borderColor: accent }]}>
                        <AppText variant="labelMono" color={accent}>@{s.rpe}</AppText>
                      </View>
                    )}
                  </View>
                </View>
                {s.note ? (
                  <AppText variant="labelMono" color={Colors.textMuted} numberOfLines={1}>
                    {s.note}
                  </AppText>
                ) : null}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceSunken,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  dateBlock: {
    width: 64,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
  },
  setsBlock: { flex: 1, padding: Spacing.md },
  headRow: { flexDirection: 'row', marginBottom: Spacing.xs },
  setRow: { paddingVertical: 4 },
  valuesRow: { flexDirection: 'row' },
  col: { flex: 1 },
  repsCell: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  rpeBadge: {
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
});
