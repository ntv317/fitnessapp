import { View, ScrollView, TouchableOpacity, StyleSheet, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { format, isToday } from 'date-fns';
import { AppText, Button } from '@/core/ui';
import { Colors, Spacing, Radius, FontSize } from '@/core/theme';
import { usePremium } from '@/core/context/PremiumContext';
import { isICloudAvailable } from '../services/BackupService';
import { useBackups, useCreateBackup, useRestoreBackup, useBackupSettings } from '../hooks/useBackups';
import type { BackupInfo } from '../../../../modules/icloud-backup';

function formatBackupDate(ms: number): string {
  if (!ms) return 'Unknown';
  const d = new Date(ms);
  return isToday(d) ? `Today, ${format(d, 'HH:mm')}` : format(d, 'MMM d, yyyy');
}

function formatSize(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function BackupScreen() {
  const router = useRouter();
  // Route is deep-linkable (trakfitness://backup) — the Settings-row gate is
  // not enough; enforce here too.
  const { isPro, isLoading: premiumLoading } = usePremium();
  const available = isICloudAvailable();
  const { data: backups = [], isLoading } = useBackups();
  const createBackup = useCreateBackup();
  const restoreBackup = useRestoreBackup();
  const { autoBackup, toggleAutoBackup, lastBackupAt, refreshLastBackup } = useBackupSettings();

  if (premiumLoading) return null;
  if (!isPro) return <Redirect href={'/paywall' as never} />;

  const handleBackupNow = () => {
    createBackup.mutate(undefined, {
      onSuccess: refreshLastBackup,
      onError: (e) => Alert.alert('Backup failed', e.message),
    });
  };

  const confirmRestore = (backup: BackupInfo) => {
    Alert.alert(
      'Restore this backup?',
      `Your data will be replaced with the backup from ${formatBackupDate(backup.modifiedAt)}. Anything logged since then is lost. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'destructive',
          onPress: () =>
            restoreBackup.mutate(backup.fileName, {
              onError: (e) => Alert.alert('Restore failed', e.message),
            }),
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.appBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <AppText variant="labelMono" upper color={Colors.textMuted} style={styles.title}>
          iCloud Backup
        </AppText>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {!available && (
          <View style={styles.group}>
            <View style={styles.row}>
              <AppText variant="bodyMd" color={Colors.textSecondary}>
                Sign in to iCloud in the iOS Settings app to enable backups.
              </AppText>
            </View>
          </View>
        )}

        <View style={styles.group}>
          <View style={styles.statusRow}>
            <Ionicons name="cloud-outline" size={28} color={Colors.primary} />
            <View>
              <AppText variant="labelMono" upper color={Colors.textMuted}>
                Last backup
              </AppText>
              <AppText variant="bodyLg">{lastBackupAt ? formatBackupDate(lastBackupAt) : 'Never'}</AppText>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <AppText variant="bodyMd">Automatic backup</AppText>
            <Switch
              value={autoBackup}
              onValueChange={toggleAutoBackup}
              trackColor={{ false: Colors.surfaceAlt, true: Colors.primaryTint }}
              thumbColor={autoBackup ? Colors.primary : Colors.textMuted}
            />
          </View>
        </View>

        <Button
          label={createBackup.isPending ? 'Backing Up…' : 'Back Up Now'}
          onPress={handleBackupNow}
          disabled={!available || createBackup.isPending || restoreBackup.isPending}
          fullWidth
          style={styles.backupButton}
        />

        <AppText variant="labelMono" upper color={Colors.textMuted} style={styles.sectionLabel}>
          Backups
        </AppText>
        <View style={styles.group}>
          {backups.length === 0 && (
            <View style={styles.row}>
              <AppText variant="bodyMd" color={Colors.textMuted}>
                {isLoading ? 'Loading…' : 'No backups yet'}
              </AppText>
            </View>
          )}
          {backups.map((b, i) => (
            <View key={b.fileName}>
              <View style={styles.row}>
                <View>
                  <AppText variant="bodyMd">{formatBackupDate(b.modifiedAt)}</AppText>
                  <AppText variant="labelMono" color={Colors.textMuted} style={{ marginTop: 2 }}>
                    {formatSize(b.size)}
                  </AppText>
                </View>
                <TouchableOpacity
                  onPress={() => confirmRestore(b)}
                  disabled={restoreBackup.isPending || createBackup.isPending}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <AppText variant="bodyMd" color={Colors.primary}>
                    {restoreBackup.isPending ? 'Restoring…' : 'Restore'}
                  </AppText>
                </TouchableOpacity>
              </View>
              {i < backups.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
        </View>

        <AppText variant="labelMono" color={Colors.textMuted} center style={styles.footnote}>
          Restoring replaces all current data on this device.
        </AppText>
      </ScrollView>
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
  content: { paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: Spacing.xl },
  sectionLabel: { marginBottom: Spacing.sm, marginLeft: 4 },
  group: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.lg,
    overflow: 'hidden',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
  },
  divider: { height: 1, backgroundColor: Colors.border, marginLeft: Spacing.md },
  backupButton: { marginBottom: Spacing.xl },
  footnote: { marginTop: Spacing.sm },
});
