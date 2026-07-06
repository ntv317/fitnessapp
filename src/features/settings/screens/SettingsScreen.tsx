import { useCallback } from 'react';
import { View, TouchableOpacity, StyleSheet, Switch, ActionSheetIOS, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/core/ui/AppText';
import { Colors, Spacing, Radius, Fonts, FontSize } from '@/core/theme';
import { useUnit } from '@/core/context/UnitContext';
import { usePremium } from '@/core/context/PremiumContext';
import { useClearHistory, useClearAllData } from '@/features/workout/hooks/useExercises';

const APP_VERSION = '1.0.0';

export default function SettingsScreen() {
  const router = useRouter();
  const { unit, toggle, showConversion, toggleConversion, showPlateBreakdown, togglePlateBreakdown } = useUnit();
  const { isPro } = usePremium();
  const clearHistory = useClearHistory();
  const clearAll = useClearAllData();

  const confirmClearHistory = useCallback(() => {
    Alert.alert(
      'Clear workout history?',
      'This permanently deletes every logged session and your weekly progress. Your exercises and plan are kept. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete history', style: 'destructive', onPress: () => clearHistory.mutate() },
      ],
    );
  }, [clearHistory]);

  const confirmClearAll = useCallback(() => {
    Alert.alert(
      'Clear everything?',
      'This permanently deletes every exercise, workout day, and logged session. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete everything', style: 'destructive', onPress: () => clearAll.mutate() },
      ],
    );
  }, [clearAll]);

  const handleClearData = useCallback(() => {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: 'Clear Data',
        options: ['Cancel', 'Workout History', 'Everything'],
        cancelButtonIndex: 0,
        destructiveButtonIndex: [1, 2],
      },
      (index) => {
        // Defer so the action sheet finishes dismissing before the Alert
        // presents — presenting mid-dismissal swallows the Alert on iOS.
        if (index === 1) setTimeout(confirmClearHistory, 0);
        else if (index === 2) setTimeout(confirmClearAll, 0);
      },
    );
  }, [confirmClearHistory, confirmClearAll]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.appBar}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <AppText variant="labelMono" upper color={Colors.textMuted} style={styles.title}>
          Settings
        </AppText>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.content}>
        {/* Preferences */}
        <AppText variant="labelMono" upper color={Colors.textMuted} style={styles.sectionLabel}>
          Preferences
        </AppText>
        <View style={styles.group}>
          <View style={styles.row}>
            <AppText variant="bodyMd">Weight Unit</AppText>
            <View style={styles.unitRow}>
              <AppText variant="labelMono" color={unit === 'kg' ? Colors.primary : Colors.textMuted}>KG</AppText>
              <Switch
                value={unit === 'lbs'}
                onValueChange={toggle}
                trackColor={{ false: Colors.primaryTint, true: Colors.primaryTint }}
                thumbColor={Colors.primary}
              />
              <AppText variant="labelMono" color={unit === 'lbs' ? Colors.primary : Colors.textMuted}>LBS</AppText>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: Spacing.md }}>
              <AppText variant="bodyMd">Weight Conversion</AppText>
              <AppText variant="labelMono" color={Colors.textMuted} style={{ marginTop: 2 }}>
                {unit === 'kg' ? 'Show lbs hint alongside kg' : 'Show kg hint alongside lbs'}
              </AppText>
            </View>
            <Switch
              value={showConversion}
              onValueChange={toggleConversion}
              trackColor={{ false: Colors.surfaceAlt, true: Colors.primaryTint }}
              thumbColor={showConversion ? Colors.primary : Colors.textMuted}
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: Spacing.md }}>
              <AppText variant="bodyMd">Plate Breakdown</AppText>
              <AppText variant="labelMono" color={Colors.textMuted} style={{ marginTop: 2 }}>
                Show plates per side on watch
              </AppText>
            </View>
            <Switch
              value={showPlateBreakdown}
              onValueChange={togglePlateBreakdown}
              trackColor={{ false: Colors.surfaceAlt, true: Colors.primaryTint }}
              thumbColor={showPlateBreakdown ? Colors.primary : Colors.textMuted}
            />
          </View>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.row} onPress={() => router.push('/barbell-setup')}>
            <AppText variant="bodyMd">Barbell Setup</AppText>
            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Data */}
        <AppText variant="labelMono" upper color={Colors.textMuted} style={styles.sectionLabel}>
          Data
        </AppText>
        <View style={styles.group}>
          <TouchableOpacity
            style={styles.row}
            onPress={() => router.push((isPro ? '/backup' : '/paywall') as never)}
          >
            <View style={styles.iCloudRow}>
              <AppText variant="bodyMd">iCloud Backup</AppText>
              {!isPro && <Ionicons name="lock-closed" size={14} color={Colors.textMuted} />}
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.row} onPress={handleClearData}>
            <AppText variant="bodyMd" color={Colors.danger}>Clear Data</AppText>
            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* About */}
        <AppText variant="labelMono" upper color={Colors.textMuted} style={styles.sectionLabel}>
          About
        </AppText>
        <View style={styles.group}>
          <View style={styles.row}>
            <AppText variant="bodyMd">Version</AppText>
            <AppText variant="labelMono" color={Colors.textMuted}>{APP_VERSION}</AppText>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  title: { fontSize: FontSize.sm },
  content: { paddingHorizontal: Spacing.md, paddingTop: Spacing.md },
  sectionLabel: { marginBottom: Spacing.sm, marginLeft: 4 },
  group: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.xl,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
  },
  divider: { height: 1, backgroundColor: Colors.border, marginLeft: Spacing.md },
  unitRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  iCloudRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
});
