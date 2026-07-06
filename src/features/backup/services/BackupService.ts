import AsyncStorage from '@react-native-async-storage/async-storage';
import { openDatabaseAsync } from 'expo-sqlite';
import ICloudBackup, { type BackupInfo } from '../../../../modules/icloud-backup';
import { getDatabase, closeDatabase, getDatabasePath } from '@/core/database/db';
import { DATABASE_VERSION } from '@/core/database/migrations';

export const LAST_BACKUP_KEY = '@fitness/lastBackupAt';
export const AUTO_BACKUP_KEY = '@fitness/autoBackupEnabled';

const SNAPSHOT_NAME = 'fitness-snapshot.db';
const STAGING_NAME = 'fitness-restore.db';

// Serializes restore against backup: auto-backup on backgrounding must never
// snapshot (or reopen) the DB while a restore is mid-swap.
let restoring = false;

export function isICloudAvailable(): boolean {
  return ICloudBackup?.isICloudAvailable() ?? false;
}

function backupFileName(): string {
  return `fitness-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.db`;
}

/** VACUUM INTO a consistent snapshot (WAL-safe), upload it, prune to newest 3. */
export async function createBackup(): Promise<BackupInfo> {
  if (!ICloudBackup) throw new Error('iCloud backup is unavailable in this build');
  if (restoring) throw new Error('A restore is in progress');
  const dbDir = getDatabasePath().slice(0, getDatabasePath().lastIndexOf('/'));
  const snapshotPath = `${dbDir}/${SNAPSHOT_NAME}`;
  const db = await getDatabase();
  await ICloudBackup.removeLocalFile(snapshotPath);
  await db.execAsync(`VACUUM INTO '${snapshotPath}'`);
  try {
    const info = await ICloudBackup.uploadBackup(snapshotPath, backupFileName());
    await AsyncStorage.setItem(LAST_BACKUP_KEY, String(Date.now()));
    return info;
  } finally {
    await ICloudBackup.removeLocalFile(snapshotPath).catch(() => {});
  }
}

export async function listBackups(): Promise<BackupInfo[]> {
  if (!ICloudBackup) return [];
  return ICloudBackup.listBackups();
}

/**
 * Downloads the snapshot, verifies it, and swaps it in for fitness.db.
 * Caller must reloadDatabase() + queryClient.clear() afterwards — the shared
 * connection is closed here and older snapshots are migrated up on reopen.
 */
export async function restoreBackup(fileName: string): Promise<void> {
  if (!ICloudBackup) throw new Error('iCloud backup is unavailable in this build');
  if (restoring) throw new Error('A restore is already in progress');
  restoring = true;
  try {
    await doRestore(fileName);
  } finally {
    restoring = false;
  }
}

async function doRestore(fileName: string): Promise<void> {
  if (!ICloudBackup) throw new Error('iCloud backup is unavailable in this build');
  const dbPath = getDatabasePath();
  const dbDir = dbPath.slice(0, dbPath.lastIndexOf('/'));
  const stagingPath = `${dbDir}/${STAGING_NAME}`;

  await ICloudBackup.removeLocalFile(stagingPath);
  await ICloudBackup.downloadBackup(fileName, stagingPath);

  let version = 0;
  try {
    const staging = await openDatabaseAsync(STAGING_NAME);
    const row = await staging.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
    await staging.closeAsync();
    version = row?.user_version ?? 0;
  } catch {
    await cleanupStaging(stagingPath);
    throw new Error('This backup file is damaged and cannot be restored.');
  }
  if (version > DATABASE_VERSION) {
    await cleanupStaging(stagingPath);
    throw new Error('This backup was made with a newer version of LIFTREPS. Update the app, then restore.');
  }

  await closeDatabase();
  await ICloudBackup.replaceDatabaseFile(stagingPath, dbPath);
  await cleanupStaging(stagingPath);
}

async function cleanupStaging(stagingPath: string): Promise<void> {
  for (const suffix of ['', '-wal', '-shm']) {
    await ICloudBackup?.removeLocalFile(stagingPath + suffix).catch(() => {});
  }
}
