import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, Spacing, FontSize, Radius } from '@/core/theme';
import { formatTimestamp } from '@/core/utils/date';
import { formatWeight } from '@/core/utils/format';
import type { WorkoutLog } from '@/core/database/types';

interface Props {
  log: WorkoutLog;
  onDelete: () => void;
}

export function LogCard({ log, onDelete }: Props) {
  const totalVolume = log.sets.reduce((acc, s) => acc + s.reps * s.weight, 0);
  const topSet = log.sets.reduce(
    (best, s) => (s.weight > best.weight ? s : best),
    log.sets[0],
  );

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.date}>{formatTimestamp(log.timestamp)}</Text>
        <TouchableOpacity onPress={onDelete}>
          <Text style={styles.delete}>Delete</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.stats}>
        <Stat label="Sets" value={String(log.sets.length)} />
        <Stat label="Top Set" value={`${topSet?.reps ?? 0} × ${formatWeight(topSet?.weight ?? 0)} kg`} />
        <Stat label="Volume" value={`${formatWeight(totalVolume)} kg`} />
      </View>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.sm },
  date: { color: Colors.textSecondary, fontSize: FontSize.sm },
  delete: { color: Colors.danger, fontSize: FontSize.sm },
  stats: { flexDirection: 'row', justifyContent: 'space-around' },
  stat: { alignItems: 'center' },
  statValue: { color: Colors.textPrimary, fontSize: FontSize.md, fontWeight: '700' },
  statLabel: { color: Colors.textMuted, fontSize: FontSize.xs, marginTop: 2 },
});
