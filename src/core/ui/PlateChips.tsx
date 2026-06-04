import { View, StyleSheet } from 'react-native';
import { AppText } from './AppText';
import { Colors, Fonts, Spacing, Radius } from '@/core/theme';
import { useUnit } from '@/core/context/UnitContext';

interface Props {
  plates: number[];
  barWeight: number;
  totalWeight: number;
  exact: boolean;
  unit: 'kg' | 'lbs';
}

export function PlateChips({ plates, barWeight, totalWeight, exact, unit }: Props) {
  const { conversionHint } = useUnit();
  if (plates.length === 0) return null;

  return (
    <View style={styles.card}>
      <AppText variant="labelMono" upper color={Colors.textMuted} style={styles.label}>
        Plates per side
      </AppText>
      <View style={styles.row}>
        {plates.map((p, i) => (
          <View key={i} style={styles.chip}>
            <AppText style={styles.chipText}>
              {p % 1 === 0 ? String(p) : String(p)}
            </AppText>
          </View>
        ))}
      </View>
      <View style={styles.footer}>
        <AppText variant="labelMono" color={Colors.textMuted}>
          Bar {barWeight} {unit} · Total {Math.round(totalWeight * 10) / 10} {unit}
          {conversionHint(totalWeight) ? `  ${conversionHint(totalWeight)}` : ''}
        </AppText>
        {!exact && (
          <AppText variant="labelMono" color={Colors.warning} style={{ marginLeft: Spacing.sm }}>
            (nearest)
          </AppText>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surfaceSunken,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    gap: 4,
  },
  label: {
    fontSize: 11,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  chip: {
    backgroundColor: Colors.primaryTint,
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  chipText: {
    fontFamily: Fonts.monoBold,
    fontSize: 12,
    color: Colors.primary,
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
