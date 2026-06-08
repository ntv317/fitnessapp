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

function chipDiameter(plateKg: number): number {
  const MIN_D = 20, MAX_D = 52, MIN_KG = 1.25, MAX_KG = 20;
  const clamped = Math.max(MIN_KG, Math.min(MAX_KG, plateKg));
  return Math.round(MIN_D + ((clamped - MIN_KG) / (MAX_KG - MIN_KG)) * (MAX_D - MIN_D));
}

function chipColor(plateKg: number): string {
  return plateKg >= 15 ? Colors.primary : Colors.textSecondary;
}

export function PlateChips({ plates, barWeight, totalWeight, exact, unit }: Props) {
  const { conversionHint, fromKg } = useUnit();
  if (plates.length === 0) return null;

  const totalRounded = Math.round(totalWeight * 10) / 10;
  const hint = conversionHint(totalWeight);

  return (
    <View style={styles.card}>
      {/* Header: label left, total weight right */}
      <View style={styles.header}>
        <AppText variant="labelMono" upper color={Colors.textMuted} style={styles.label}>
          Plates per side
        </AppText>
        <AppText variant="labelMono" color={Colors.textSecondary}>
          {totalRounded} {unit}{hint ? `  ${hint}` : ''}
        </AppText>
      </View>

      {/* Proportional circular plate chips */}
      <View style={styles.chipsRow}>
        {plates.map((p, i) => {
          const d = chipDiameter(p);
          const color = chipColor(p);
          const displayVal = fromKg(p);
          const label =
            displayVal % 1 === 0
              ? String(Math.round(displayVal))
              : String(Math.round(displayVal * 100) / 100);
          const fontSize = d >= 40 ? 12 : d >= 30 ? 11 : 10;
          return (
            <View
              key={i}
              style={[styles.chip, { width: d, height: d, borderRadius: d / 2, borderColor: color, backgroundColor: color + '1a' }]}
            >
              <AppText style={[styles.chipText, { fontSize, color, lineHeight: d }]}>
                {label}
              </AppText>
            </View>
          );
        })}
      </View>

      {/* Footer: bar weight + nearest indicator */}
      <View style={styles.footer}>
        <AppText variant="labelMono" color={Colors.textMuted}>
          Bar {barWeight} {unit}
        </AppText>
        {!exact && (
          <AppText variant="labelMono" color={Colors.warning}>
            · nearest
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
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm + 2,
    gap: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: { fontSize: 11 },
  chipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  chipText: {
    fontFamily: Fonts.monoBold,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
});
