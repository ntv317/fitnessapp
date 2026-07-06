import { openDatabaseAsync, defaultDatabaseDirectory, type SQLiteDatabase } from 'expo-sqlite';
import { migrateDbIfNeeded } from './migrations';

let _db: SQLiteDatabase | null = null;

/**
 * Returns the single shared SQLite connection, creating it on first call.
 * Call this inside SQLiteProvider's onInit, or inject it directly in tests.
 */
export async function getDatabase(): Promise<SQLiteDatabase> {
  if (_db) return _db;
  _db = await openDatabaseAsync('fitness.db');
  await _db.execAsync('PRAGMA journal_mode = WAL;');
  await _db.execAsync('PRAGMA foreign_keys = ON;');
  await migrateDbIfNeeded(_db);
  return _db;
}

/** Closes the shared connection so the file can be replaced (iCloud restore). */
export async function closeDatabase(): Promise<void> {
  if (!_db) return;
  await _db.closeAsync();
  _db = null;
}

/** Absolute path of fitness.db on disk. */
export function getDatabasePath(): string {
  return `${defaultDatabaseDirectory}/fitness.db`;
}

export type { SQLiteDatabase };
