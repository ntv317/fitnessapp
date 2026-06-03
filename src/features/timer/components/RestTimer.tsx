import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, Spacing, FontSize, Radius } from '@/core/theme';
import { formatDuration } from '@/core/utils/format';
import { useRestTimer } from '../hooks/useRestTimer';

interface Props {
  /** Default rest in seconds (from the selected exercise). */
  defaultSeconds: number;
}

/**
 * Inline rest timer shown on every exercise logging screen.
 * Starts automatically after a set is saved; user can restart or skip.
 */
export function RestTimer({ defaultSeconds }: Props) {
  const { seconds, isRunning, start, pause, reset } = useRestTimer();

  const progress = defaultSeconds > 0 ? seconds / defaultSeconds : 0;
  const done = !isRunning && seconds === 0;

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {/* Circular-ish progress indicator */}
        <View style={styles.dial}>
          <Text style={[styles.dialText, done && styles.dialTextDone]}>
            {done ? '✓' : formatDuration(seconds)}
          </Text>
          {/* Simple progress ring via border trick */}
          <View
            style={[
              styles.ring,
              {
                borderColor: done
                  ? Colors.success
                  : isRunning
                  ? Colors.primary
                  : Colors.surfaceAlt,
                opacity: progress,
              },
            ]}
          />
        </View>

        <View style={styles.controls}>
          <Text style={styles.label}>Rest Timer</Text>
          <Text style={styles.sub}>{defaultSeconds}s default</Text>

          <View style={styles.btnRow}>
            {isRunning ? (
              <TimerBtn label="Pause" onPress={pause} color={Colors.warning} />
            ) : (
              <TimerBtn label="Start" onPress={() => start(defaultSeconds)} color={Colors.primary} />
            )}
            <TimerBtn label="Reset" onPress={reset} color={Colors.surfaceAlt} />
          </View>
        </View>
      </View>
    </View>
  );
}

function TimerBtn({
  label,
  onPress,
  color,
}: {
  label: string;
  onPress: () => void;
  color: string;
}) {
  return (
    <TouchableOpacity
      style={[styles.btn, { backgroundColor: color }]}
      onPress={onPress}
      hitSlop={8}
    >
      <Text style={styles.btnText}>{label}</Text>
    </TouchableOpacity>
  );
}

const DIAL = 72;

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginTop: Spacing.md,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  dial: {
    width: DIAL,
    height: DIAL,
    borderRadius: DIAL / 2,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: DIAL,
    height: DIAL,
    borderRadius: DIAL / 2,
    borderWidth: 3,
  },
  dialText: { color: Colors.textPrimary, fontSize: FontSize.md, fontWeight: '700' },
  dialTextDone: { color: Colors.success, fontSize: FontSize.xl },
  controls: { flex: 1 },
  label: { color: Colors.textPrimary, fontSize: FontSize.md, fontWeight: '700' },
  sub: { color: Colors.textMuted, fontSize: FontSize.xs, marginBottom: Spacing.sm },
  btnRow: { flexDirection: 'row', gap: Spacing.sm },
  btn: {
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  btnText: { color: Colors.white, fontSize: FontSize.sm, fontWeight: '600' },
});
