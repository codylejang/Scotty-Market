import Database from 'better-sqlite3';
import path from 'path';
import { MIGRATIONS } from './schema';

let db: Database.Database | null = null;

export function getDb(dbPath?: string): Database.Database {
  if (db) return db;
  const resolvedPath = dbPath || process.env.DB_PATH || path.join(__dirname, '../../data/scotty.db');
  db = new Database(resolvedPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

export function initDb(dbPath?: string): Database.Database {
  const database = getDb(dbPath);
  runMigrations(database);
  return database;
}

export function resetDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

export function createTestDb(): Database.Database {
  resetDb();
  const database = new Database(':memory:');
  database.pragma('journal_mode = WAL');
  database.pragma('foreign_keys = ON');
  db = database;
  runMigrations(database);
  return database;
}

function runMigrations(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const applied = new Set(
    database.prepare('SELECT version FROM _migrations').all().map((r: any) => r.version)
  );

  for (const migration of MIGRATIONS) {
    if (!applied.has(migration.version)) {
      database.exec(migration.sql);
      database.prepare('INSERT INTO _migrations (version, name) VALUES (?, ?)').run(
        migration.version,
        migration.name
      );
    }
  }
}
