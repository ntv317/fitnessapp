import React, { useMemo, useState } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Polyline, Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Colors, Spacing, Fonts } from '@/core/theme';
import { AppText, Button, StepperInput } from '@/core/ui';
import { useUnit } from '@/core/context/UnitContext';
import { useBodyWeight, useLogBodyWeight, useDeleteBodyWeight } from '@/features/workout/hooks/useBodyWeight';
import { formatWeight } from '@/core/utils/format';

const MARGIN = 20;
const CHART_H = 120;

function TrendChart({ points }: { points: number[] }) {
  const [width, setWidth] = useState(0);
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const pad = 6;
  const coords = points.map((v, i) => {
    const x = pad + (i / (points.length - 1)) * (width - pad * 2);
    const y = pad + (1 - (v - min) / span) * (CHART_H - pad * 2);
    return { x, y };
  });
  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height: CHART_H }}>
      {width > 0 && (
        <Svg width={width} height={CHART_H}>
          <Polyline
            points={coords.map((c) => `${c.x},${c.y}`).join(' ')}
            fill="none"
            stroke={Colors.primary}
            strokeWidth={2}
          />
          <Circle cx={coords[coords.length - 1].x} cy={coords[coords.length - 1].y} r={4} fill={Colors.primary} />
        </Svg>
      )}
    </View>
  );
}

export default function BodyWeightScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { unit, toKg, fromKg } = useUnit();
  const { data: entries = [] } = useBodyWeight();
  const logBodyWeight = useLogBodyWeight();
  const deleteBodyWeight = useDeleteBodyWeight();

  const latest = entries[0];
  const [input, setInput] = useState('');
  const displayValue = input !== '' ? input : latest ? String(Math.round(fromKg(latest.weightKg) * 10) / 10) : '';

  const handleLog = () => {
    const value = parseFloat(displayValue);
    if (!value || value <= 0) return;
    logBodyWeight.mutate(toKg(value));
    setInput('');
  };

  // Oldest → newest for the chart, latest 30 entries.
  const chartPoints = useMemo(
    () => entries.slice(0, 30).map((e) => e.weightKg).reverse(),
    [entries],
  );
  const chartMin = chartPoints.length ? Math.min(...chartPoints) : 0;
  const chartMax = chartPoints.length ? Math.max(...chartPoints) : 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.appBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <AppText variant="headlineMd" style={{ flex: 1, marginLeft: Spacing.sm }}>{t('bodyweight.title')}</AppText>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Input */}
        <View style={styles.card}>
          <View style={[styles.accentBar, { backgroundColor: Colors.primary }]} />
          <AppText variant="labelMono" upper color={Colors.textSecondary} style={{ marginBottom: Spacing.sm }}>
            {t('common.today')} ({unit})
          </AppText>
          <StepperInput value={displayValue} onChangeText={setInput} step={0.1} min={0} placeholder="—" />
          <View style={{ marginTop: Spacing.md }}>
            <Button label={t('bodyweight.logWeight')} onPress={handleLog} fullWidth />
          </View>
        </View>

        {/* Trend */}
        {chartPoints.length >= 2 && (
          <View style={styles.card}>
            <View style={[styles.accentBar, { backgroundColor: Colors.tertiary }]} />
            <View style={styles.trendHead}>
              <AppText variant="labelMono" upper color={Colors.textSecondary}>{t('bodyweight.trend')}</AppText>
              <AppText variant="labelMono" upper color={Colors.textMuted}>
                {formatWeight(fromKg(chartMin))}–{formatWeight(fromKg(chartMax))} {unit}
              </AppText>
            </View>
            <TrendChart points={chartPoints} />
          </View>
        )}

        {/* History */}
        {entries.length > 0 && (
          <View style={styles.section}>
            <AppText variant="labelMono" upper color={Colors.textMuted} style={{ marginBottom: Spacing.sm }}>
              {t('bodyweight.history')}
            </AppText>
            {entries.map((entry, i) => {
              const prev = entries[i + 1];
              const deltaKg = prev ? entry.weightKg - prev.weightKg : null;
              const delta = deltaKg != null ? Math.round(fromKg(deltaKg) * 10) / 10 : null;
              return (
                <View key={entry.id} style={styles.row}>
                  <AppText variant="labelMono" upper color={Colors.textSecondary} style={{ width: 108 }}>
                    {new Date(entry.timestamp).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </AppText>
                  <AppText variant="bodyLg" style={{ flex: 1, fontFamily: Fonts.sansBold }}>
                    {formatWeight(fromKg(entry.weightKg))} {unit}
                  </AppText>
                  {delta != null && delta !== 0 && (
                    <AppText variant="labelMono" color={delta < 0 ? Colors.tertiary : Colors.textMuted}>
                      {delta > 0 ? '+' : ''}{delta}
                    </AppText>
                  )}
                  <TouchableOpacity onPress={() => deleteBodyWeight.mutate(entry.id)} hitSlop={10} style={{ marginLeft: Spacing.md }}>
                    <Ionicons name="trash-outline" size={16} color={Colors.textMuted} />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
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
  scroll: { paddingHorizontal: MARGIN, paddingBottom: 64 },
  card: {
    position: 'relative',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    paddingLeft: Spacing.lg + 4,
    marginBottom: Spacing.md,
  },
  accentBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  trendHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.sm },
  section: { marginTop: Spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
});
