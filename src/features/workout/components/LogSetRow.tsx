import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, Spacing, FontSize, Radius } from '@/core/theme';

interface Props {
  index: number;
  reps: number;
  weight: number;
  onChangeReps: (value: number) => void;
  onChangeWeight: (value: number) => void;
  onRemove: () => void;
}

export function LogSetRow({ index, reps, weight, onChangeReps, onChangeWeight, onRemove }: Props) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>Set {index + 1}</Text>

      <View style={styles.field}>
        <Text style={styles.fieldLabel}>Reps</Text>
        <TextInput
          style={styles.input}
          keyboardType="number-pad"
          value={String(reps)}
          onChangeText={(v) => onChangeReps(Number(v) || 0)}
          selectTextOnFocus
          placeholderTextColor={Colors.textMuted}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.fieldLabel}>kg</Text>
        <TextInput
          style={styles.input}
          keyboardType="decimal-pad"
          value={String(weight)}
          onChangeText={(v) => onChangeWeight(parseFloat(v) || 0)}
          selectTextOnFocus
          placeholderTextColor={Colors.textMuted}
        />
      </View>

      <TouchableOpacity onPress={onRemove} style={styles.remove} hitSlop={8}>
        <Text style={styles.removeText}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  label: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    width: 44,
  },
  field: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  fieldLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: '600',
    textAlign: 'center',
    width: '100%',
    paddingVertical: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  remove: {
    padding: Spacing.xs,
  },
  removeText: {
    color: Colors.danger,
    fontSize: FontSize.md,
  },
});
