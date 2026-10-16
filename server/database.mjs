import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
export function openDatabase(directory) {
  mkdirSync(directory, { recursive: true });
  const db = new DatabaseSync(join(directory, 'synko.sqlite'));
  db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
  db.exec('CREATE TABLE IF NOT EXISTS migrations(name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');
  const folder = new URL('./migrations/', import.meta.url);
  for (const name of readdirSync(folder)
    .filter((n) => n.endsWith('.sql'))
    .sort()) {
    if (db.prepare('SELECT name FROM migrations WHERE name=?').get(name)) continue;
    transaction(db, () => {
      db.exec(readFileSync(new URL(name, folder), 'utf8'));
      db.prepare('INSERT INTO migrations VALUES (?,?)').run(name, new Date().toISOString());
    });
  }
  return db;
}
export function transaction(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
