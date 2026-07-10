import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { AppText } from '@/core/ui/AppText';
import { Colors, Spacing, Radius } from '@/core/theme';
import { usePremium } from '@/core/context/PremiumContext';

export default function ProfileScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { isPro } = usePremium();

  const ROWS: { label: string; icon: React.ComponentProps<typeof Ionicons>['name']; href: string }[] = [
    { label: t('profile.settings'), icon: 'settings-outline', href: '/settings' },
    { label: t('profile.thisWeek'), icon: 'stats-chart-outline', href: '/stats' },
    { label: t('profile.bodyWeight'), icon: 'body-outline', href: '/bodyweight' },
    { label: t('profile.aiImport'), icon: 'sparkles-outline', href: '/import' },
    { label: t('profile.allHistory'), icon: 'time-outline', href: '/history' },
  ];

  const rows = isPro
    ? ROWS
    : [{ label: t('profile.proLabel'), icon: 'star-outline', href: '/paywall' } as const, ...ROWS];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.appBar}>
        <AppText variant="headlineLg">{t('profile.title')}</AppText>
      </View>

      <View style={styles.content}>
        <View style={styles.group}>
          {rows.map((row, i) => (
            <View key={row.href}>
              <TouchableOpacity style={styles.row} onPress={() => router.push(row.href as never)}>
                <View style={styles.rowLeft}>
                  <Ionicons name={row.icon} size={20} color={Colors.primary} />
                  <AppText variant="bodyMd">{row.label}</AppText>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
              </TouchableOpacity>
              {i < rows.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  appBar: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  content: { paddingHorizontal: Spacing.md },
  group: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  divider: { height: 1, backgroundColor: Colors.border, marginLeft: Spacing.md },
});
