import { useEffect, useState } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Colors, Spacing, Radius, Fonts, FontSize } from '@/core/theme';
import { AppText } from '@/core/ui';
import { useUnit } from '@/core/context/UnitContext';
import { usePremium } from '@/core/context/PremiumContext';
import { getSession, clearSession } from '../utils/workoutSession';
import { formatWeight } from '@/core/utils/format';
import { useExercises } from '@/features/workout/hooks/useExercises';
import { useExerciseDisplayName } from '@/features/library/hooks/useExerciseDisplayName';

const HEADLINE_COUNT = 5;

const WORKOUT_COUNT_KEY = '@fitness/completedWorkouts';
const PRO_PROMPT_SHOWN_KEY = '@fitness/proMilestonePromptShown';
const PRO_PROMPT_THRESHOLD = 10;

export default function WorkoutSummaryScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ startTime?: string; color?: string; day?: string }>();
  const { unit, fromKg } = useUnit();

  const [endTime] = useState(Date.now);
  const startTime = parseInt(params.startTime ?? '0') || endTime;
  const accent = params.color || Colors.primary;
  const session = getSession();

  const { data: exercises = [] } = useExercises();
  const exerciseDisplayName = useExerciseDisplayName();
  // Session results carry the stored (English) name as identity — map back to
  // the exercise row for the localized display name.
  const localizedName = (name: string) => {
    const ex = exercises.find((e) => e.name === name);
    return ex ? exerciseDisplayName(ex) : name;
  };

  const durationMins = Math.max(1, Math.round((endTime - startTime) / 60000));
  const totalVolumeKg = session?.exercises.reduce((s, e) => s + e.volumeKg, 0) ?? 0;
  const exerciseCount = session?.exercises.length ?? 0;
  const prNames = session?.exercises.filter((e) => e.isPR).map((e) => localizedName(e.name)) ?? [];
  const [headlineIdx] = useState(() => Math.floor(Math.random() * HEADLINE_COUNT));
  const headline = t(`workout.headline${headlineIdx + 1}`);
  const { isPro } = usePremium();

  useEffect(() => {
    (async () => {
      try {
        const count = parseInt((await AsyncStorage.getItem(WORKOUT_COUNT_KEY)) ?? '0') + 1;
        await AsyncStorage.setItem(WORKOUT_COUNT_KEY, String(count));
        if (isPro || count < PRO_PROMPT_THRESHOLD) return;
        if (await AsyncStorage.getItem(PRO_PROMPT_SHOWN_KEY)) return;
        await AsyncStorage.setItem(PRO_PROMPT_SHOWN_KEY, 'true');
        Alert.alert(
          t('workout.backupPromptTitle', { count }),
          t('workout.backupPromptBody'),
          [
            { text: t('workout.notNow'), style: 'cancel' },
            { text: t('workout.seeProLabel'), onPress: () => router.push('/paywall' as never) },
          ],
        );
      } catch {}
    })();
    // Run once per summary view — counts this completed workout.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDone = () => {
    clearSession();
    router.replace('/(tabs)');
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
              {t('workout.dayComplete', { day: params.day })}
            </AppText>
          ) : null}
        </View>

        {/* PR celebration (Pro) */}
        {isPro && prNames.length > 0 && (
          <View style={[styles.prHero, { borderColor: accent }]}>
            <Ionicons name="trophy" size={28} color={accent} />
            <AppText variant="headlineMd" style={{ color: accent }}>
              {t(`workout.newPR_${prNames.length > 1 ? 'other' : 'one'}`)}
            </AppText>
            <AppText variant="bodyMd" color={Colors.textSecondary} center>
              {prNames.join(' · ')}
            </AppText>
          </View>
        )}

        {/* Stats card */}
        <View style={styles.statsCard}>
          <StatCol label={t('workout.duration')} value={`${durationMins}m`} />
          <View style={styles.statDivider} />
          <StatCol
            label={t('workout.volume')}
            value={formatWeight(fromKg(totalVolumeKg))}
            unit={unit}
          />
          <View style={styles.statDivider} />
          <StatCol label={t('workout.exercises')} value={String(exerciseCount)} />
        </View>

        {/* PR list */}
        {prNames.length > 0 && (
          <View style={styles.section}>
            <AppText variant="labelMono" upper color={Colors.textMuted} style={styles.sectionLabel}>
              {t('workout.personalRecords')}
            </AppText>
            {prNames.map((name) => (
              <View key={name} style={styles.prRow}>
                <View style={[styles.prDot, { backgroundColor: accent }]} />
                <AppText variant="bodyMd" color={Colors.textPrimary}>{name}</AppText>
                <View style={[styles.prBadge, { backgroundColor: accent }]}>
                  <AppText style={styles.prBadgeText}>{t('workout.pr')}</AppText>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Exercise list */}
        {(session?.exercises ?? []).length > 0 && (
          <View style={styles.section}>
            <AppText variant="labelMono" upper color={Colors.textMuted} style={styles.sectionLabel}>
              {t('workout.exercises')}
            </AppText>
            {session!.exercises.map((ex, i) => (
              <View key={i} style={styles.exRow}>
                <AppText variant="bodyMd" color={Colors.textSecondary} style={styles.exNum}>
                  {i + 1}
                </AppText>
                <AppText variant="bodyMd" style={{ flex: 1 }}>{localizedName(ex.name)}</AppText>
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
            {t('workout.done')}
          </AppText>
        </TouchableOpacity>
        <TouchableOpacity style={styles.shareBtn} disabled>
          <Ionicons name="share-outline" size={18} color={Colors.textMuted} />
          <AppText variant="labelMono" color={Colors.textMuted}>{t('common.share')}</AppText>
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

  prHero: {
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.surface,
    borderWidth: 2,
    borderRadius: Radius.md,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
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
