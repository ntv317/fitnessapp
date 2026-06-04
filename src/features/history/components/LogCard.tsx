import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, Spacing, FontSize, Radius } from '@/core/theme';
import { formatTimestamp } from '@/core/utils/date';
import { formatWeight } from '@/core/utils/format';
import { useUnit } from '@/core/context/UnitContext';
import type { WorkoutLog } from '@/core/database/types';

interface Props {
  log: WorkoutLog;
  onDelete: () => void;
}

export function LogCard({ log, onDelete }: Props) {
  const { fromKg, unit, conversionHint } = useUnit();
  const totalVolume = log.sets.reduce((acc, s) => acc + s.reps * s.weight, 0);
  const topSet = log.sets.reduce(
    (best, s) => (s.weight > best.weight ? s : best),
    log.sets[0],
  );
  const topSetDisplay = formatWeight(fromKg(topSet?.weight ?? 0));
  const volumeDisplay = formatWeight(fromKg(totalVolume));
  const topHint = conversionHint(fromKg(topSet?.weight ?? 0));
  const volHint = conversionHint(fromKg(totalVolume));

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
        <Stat label="Top Set" value={`${topSet?.reps ?? 0} × ${topSetDisplay} ${unit}`} hint={topHint} />
        <Stat label="Volume" value={`${volumeDisplay} ${unit}`} hint={volHint} />
      </View>
    </View>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string | null }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      {hint ? <Text style={styles.statHint}>{hint}</Text> : null}
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
  statHint: { color: Colors.textMuted, fontSize: 10, marginTop: 1 },
  statLabel: { color: Colors.textMuted, fontSize: FontSize.xs, marginTop: 2 },
});
