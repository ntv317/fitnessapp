import { useState } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors, Spacing, Radius, Fonts, FontSize } from '@/core/theme';
import { AppText } from '@/core/ui';
import { useUnit } from '@/core/context/UnitContext';
import { getSession, clearSession } from '../utils/workoutSession';
import { formatWeight } from '@/core/utils/format';

const HEADLINES = ['Day done.', 'Strong.', 'Work in.', 'Keep going.', 'One more done.'];

export default function WorkoutSummaryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ startTime?: string; color?: string; day?: string }>();
  const { unit, fromKg } = useUnit();

  const [endTime] = useState(Date.now);
  const startTime = parseInt(params.startTime ?? '0') || endTime;
  const accent = params.color ?? Colors.primary;
  const session = getSession();

  const durationMins = Math.max(1, Math.round((endTime - startTime) / 60000));
  const totalVolumeKg = session?.exercises.reduce((s, e) => s + e.volumeKg, 0) ?? 0;
  const exerciseCount = session?.exercises.length ?? 0;
  const prNames = session?.exercises.filter((e) => e.isPR).map((e) => e.name) ?? [];
  const [headline] = useState(() => HEADLINES[Math.floor(Math.random() * HEADLINES.length)]);

  const handleDone = () => {
    clearSession();
    router.back();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Big headline */}
        <View style={styles.heroSection}>
          <View style={[styles.checkCircle, { borderColor: accent }]}>
            <Ionicons name="checkmark" size={40} color={accent} />
          </View>
          <AppText style={[styles.headline, { color: accent }]}>{headline}</AppText>
          {params.day ? (
            <AppText variant="labelMono" upper color={Colors.textSecondary}>
              Day {params.day} Complete
            </AppText>
          ) : null}
        </View>

        {/* Stats card */}
        <View style={styles.statsCard}>
          <StatCol label="Duration" value={`${durationMins}m`} />
          <View style={styles.statDivider} />
          <StatCol
            label="Volume"
            value={formatWeight(fromKg(totalVolumeKg))}
            unit={unit}
          />
          <View style={styles.statDivider} />
          <StatCol label="Exercises" value={String(exerciseCount)} />
        </View>

        {/* PR list */}
        {prNames.length > 0 && (
          <View style={styles.section}>
            <AppText variant="labelMono" upper color={Colors.textMuted} style={styles.sectionLabel}>
              Personal Records
            </AppText>
            {prNames.map((name) => (
              <View key={name} style={styles.prRow}>
                <View style={[styles.prDot, { backgroundColor: accent }]} />
                <AppText variant="bodyMd" color={Colors.textPrimary}>{name}</AppText>
                <View style={[styles.prBadge, { backgroundColor: accent }]}>
                  <AppText style={styles.prBadgeText}>PR</AppText>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Exercise list */}
        {(session?.exercises ?? []).length > 0 && (
          <View style={styles.section}>
            <AppText variant="labelMono" upper color={Colors.textMuted} style={styles.sectionLabel}>
              Exercises
            </AppText>
            {session!.exercises.map((ex, i) => (
              <View key={i} style={styles.exRow}>
                <AppText variant="bodyMd" color={Colors.textSecondary} style={styles.exNum}>
                  {i + 1}
                </AppText>
                <AppText variant="bodyMd" style={{ flex: 1 }}>{ex.name}</AppText>
                <AppText variant="labelMono" color={Colors.textMuted}>
                  {formatWeight(fromKg(ex.volumeKg))} {unit}
                </AppText>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Footer actions */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.doneBtn, { backgroundColor: accent }]}
          onPress={handleDone}
          activeOpacity={0.85}
        >
          <AppText variant="bodyMd" color={Colors.white} style={{ fontFamily: Fonts.sansBold }}>
            Done
          </AppText>
        </TouchableOpacity>
        <TouchableOpacity style={styles.shareBtn} disabled>
          <Ionicons name="share-outline" size={18} color={Colors.textMuted} />
          <AppText variant="labelMono" color={Colors.textMuted}>Share</AppText>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function StatCol({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <View style={styles.statCol}>
      <AppText style={styles.statValue}>{value}{unit ? <AppText style={styles.statUnit}> {unit}</AppText> : null}</AppText>
      <AppText variant="labelMono" upper color={Colors.textMuted} style={styles.statLabel}>{label}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingHorizontal: 24, paddingTop: 32, paddingBottom: 24 },

  heroSection: { alignItems: 'center', gap: 12, marginBottom: 32 },
  checkCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headline: {
    fontFamily: Fonts.sansBold,
    fontSize: 42,
    lineHeight: 46,
    letterSpacing: -1,
  },

  statsCard: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingVertical: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  statCol: { flex: 1, alignItems: 'center', gap: 4 },
  statDivider: { width: 1, backgroundColor: Colors.border, marginVertical: Spacing.sm },
  statValue: {
    fontFamily: Fonts.sansBold,
    fontSize: 22,
    color: Colors.textPrimary,
  },
  statUnit: {
    fontFamily: Fonts.mono,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  statLabel: { fontSize: 10 },

  section: { marginBottom: Spacing.xl },
  sectionLabel: { marginBottom: Spacing.sm, fontSize: 11 },

  prRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  prDot: { width: 6, height: 6, borderRadius: 3 },
  prBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  prBadgeText: {
    fontFamily: Fonts.monoBold,
    fontSize: 9,
    color: Colors.white,
    letterSpacing: 0.5,
  },

  exRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  exNum: { width: 20, textAlign: 'right', fontSize: FontSize.sm },

  footer: {
    padding: Spacing.md,
    gap: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  doneBtn: {
    borderRadius: Radius.sm,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
  },
});
