import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as schema from './schema.js';
import { config, initConfig } from '@/config/loader.js';
import { logger } from '@/utils/logger.js';
import { ensureDir } from '@/utils/paths.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export type DrizzleDb = BetterSQLite3Database<typeof schema>;

export let db: DrizzleDb;
export let sqlite: Database.Database;

let initialized = false;

/**
 * Open the SQLite connection and run migrations. Idempotent: safe to call
 * more than once. Must run (directly or via main()) before any query executes.
 */
export function initDatabase(): DrizzleDb {
  if (initialized) return db;

  // Database settings live in config, so make sure it is loaded first.
  initConfig();

  const dbPath = config.database.path;
  ensureDir(path.dirname(dbPath));

  sqlite = new Database(dbPath);
  if (config.database.wal) {
    sqlite.pragma('journal_mode = WAL');
  }
  sqlite.pragma('foreign_keys = ON');

  db = drizzle(sqlite, { schema });

  // Migrations ship next to this module: src/database/migrations when run from
  // source (tsx) and dist/migrations after the build (see scripts/build.sh).
  const migrationsFolder = path.join(__dirname, 'migrations');
  try {
    migrate(db, { migrationsFolder });
    logger.info('Database migrations completed successfully');
  } catch (err) {
    logger.error({ err }, 'Failed to run database migrations');
    throw err;
  }

  logger.info(`Database connected at ${dbPath}${config.database.wal ? ' (WAL mode)' : ''}`);
  initialized = true;
  return db;
}

export function closeDatabase(): void {
  if (!initialized) return;
  sqlite.close();
  initialized = false;
  logger.info('Database connection closed');
}
