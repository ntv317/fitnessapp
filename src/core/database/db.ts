import { openDatabaseAsync, defaultDatabaseDirectory, type SQLiteDatabase } from 'expo-sqlite';
import { migrateDbIfNeeded } from './migrations';

// Memoizes the in-flight promise (not the instance) so concurrent first
// callers share one connection instead of racing to open two.
let _dbPromise: Promise<SQLiteDatabase> | null = null;

async function openAndMigrate(): Promise<SQLiteDatabase> {
  const db = await openDatabaseAsync('fitness.db');
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await migrateDbIfNeeded(db);
  return db;
}

/**
 * Returns the single shared SQLite connection, creating it on first call.
 * Call this inside SQLiteProvider's onInit, or inject it directly in tests.
 */
export function getDatabase(): Promise<SQLiteDatabase> {
  if (!_dbPromise) {
    _dbPromise = openAndMigrate().catch((e) => {
      _dbPromise = null;
      throw e;
    });
  }
  return _dbPromise;
}

/** Closes the shared connection so the file can be replaced (iCloud restore). */
export async function closeDatabase(): Promise<void> {
  if (!_dbPromise) return;
  const pending = _dbPromise;
  _dbPromise = null;
  const db = await pending.catch(() => null);
  await db?.closeAsync();
}

/** Absolute path of fitness.db on disk. */
export function getDatabasePath(): string {
  return `${defaultDatabaseDirectory}/fitness.db`;
}

export type { SQLiteDatabase };
