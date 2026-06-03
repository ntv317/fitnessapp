import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
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

export type { SQLiteDatabase };
