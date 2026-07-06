import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usePremium } from '@/core/context/PremiumContext';
import { useDatabaseLifecycle } from '@/core/context/DatabaseLifecycleContext';
import {
  createBackup,
  listBackups,
  restoreBackup,
  isICloudAvailable,
  LAST_BACKUP_KEY,
  AUTO_BACKUP_KEY,
} from '../services/BackupService';

const AUTO_BACKUP_MIN_INTERVAL = 24 * 60 * 60 * 1000;

export function useBackups() {
  const { isPro } = usePremium();
  return useQuery({
    queryKey: ['backups'],
    queryFn: listBackups,
    enabled: isPro && isICloudAvailable(),
  });
}

export function useCreateBackup() {
  const queryClient = useQueryClient();
  const { isPro } = usePremium();
  return useMutation({
    mutationFn: () => {
      if (!isPro) throw new Error('LIFTREPS Pro required');
      return createBackup();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backups'] });
    },
  });
}

export function useRestoreBackup() {
  const queryClient = useQueryClient();
  const { isPro } = usePremium();
  const { suspendDatabase, reloadDatabase } = useDatabaseLifecycle();
  return useMutation({
    mutationFn: (fileName: string) => {
      if (!isPro) throw new Error('LIFTREPS Pro required');
      // Quiesce writers before the file swap; reloadDatabase in onSettled
      // reopens whichever DB is on disk (restored, or the old one on failure).
      suspendDatabase();
      return restoreBackup(fileName);
    },
    onSuccess: () => {
      queryClient.clear();
    },
    onSettled: () => {
      reloadDatabase();
    },
  });
}

export function useBackupSettings() {
  const [autoBackup, setAutoBackup] = useState(true);
  const [lastBackupAt, setLastBackupAt] = useState<number | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(AUTO_BACKUP_KEY)
      .then((v) => { if (v === 'false') setAutoBackup(false); })
      .catch(() => {});
    AsyncStorage.getItem(LAST_BACKUP_KEY)
      .then((v) => { if (v) setLastBackupAt(parseInt(v)); })
      .catch(() => {});
  }, []);

  const toggleAutoBackup = useCallback(() => {
    setAutoBackup((prev) => {
      const next = !prev;
      AsyncStorage.setItem(AUTO_BACKUP_KEY, String(next)).catch(() => {});
      return next;
    });
  }, []);

  const refreshLastBackup = useCallback(() => {
    AsyncStorage.getItem(LAST_BACKUP_KEY)
      .then((v) => { if (v) setLastBackupAt(parseInt(v)); })
      .catch(() => {});
  }, []);

  return { autoBackup, toggleAutoBackup, lastBackupAt, refreshLastBackup };
}

/** Mounted once in the root layout: backs up on background if stale (>24h). */
export function useAutoBackup() {
  const { isPro } = usePremium();

  useEffect(() => {
    if (!isPro) return;
    const sub = AppState.addEventListener('change', async (state) => {
      if (state !== 'background') return;
      try {
        if ((await AsyncStorage.getItem(AUTO_BACKUP_KEY)) === 'false') return;
        if (!isICloudAvailable()) return;
        const last = parseInt((await AsyncStorage.getItem(LAST_BACKUP_KEY)) ?? '0');
        if (Date.now() - last < AUTO_BACKUP_MIN_INTERVAL) return;
        await createBackup();
      } catch {
        // Silent: auto-backup retries on the next backgrounding.
      }
    });
    return () => sub.remove();
  }, [isPro]);
}
