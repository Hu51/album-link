import Database from "better-sqlite3";
import fs from "node:fs";
import { DATA_DIR, DB_PATH, type DownloadResolution } from "./config";

export type GroupRow = {
  id: string;
  name: string;
  token_hash: string;
  max_download_resolution: DownloadResolution;
  created_at: string;
};

export type PersonRow = {
  id: string;
  name: string;
  token_hash: string;
  max_download_resolution: DownloadResolution;
  created_at: string;
};

export type EventFolderRow = {
  relative_path: string;
  year: string;
  name: string;
  photo_count: number;
  cover_path: string | null;
  last_seen_at: string;
  missing: number;
};

export type PhotoRow = {
  relative_path: string;
  event_path: string;
  filename: string;
  mtime_ms: number;
  size_bytes: number;
  last_seen_at: string;
  missing: number;
};

declare global {
  // eslint-disable-next-line no-var
  var __albumLinkDb: Database.Database | undefined;
}

function migrate(db: Database.Database) {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      token_hash TEXT NOT NULL UNIQUE,
      max_download_resolution TEXT NOT NULL DEFAULT 'full'
        CHECK (max_download_resolution IN ('full', '2k', 'hd')),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS people (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      token_hash TEXT NOT NULL UNIQUE,
      max_download_resolution TEXT NOT NULL DEFAULT 'full'
        CHECK (max_download_resolution IN ('full', '2k', 'hd')),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS person_groups (
      person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
      group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      PRIMARY KEY (person_id, group_id)
    );

    CREATE TABLE IF NOT EXISTS event_folders (
      relative_path TEXT PRIMARY KEY,
      year TEXT NOT NULL,
      name TEXT NOT NULL,
      photo_count INTEGER NOT NULL DEFAULT 0,
      cover_path TEXT,
      last_seen_at TEXT NOT NULL,
      missing INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS group_events (
      group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      event_path TEXT NOT NULL REFERENCES event_folders(relative_path) ON DELETE CASCADE,
      PRIMARY KEY (group_id, event_path)
    );

    CREATE TABLE IF NOT EXISTS photos (
      relative_path TEXT PRIMARY KEY,
      event_path TEXT NOT NULL REFERENCES event_folders(relative_path) ON DELETE CASCADE,
      filename TEXT NOT NULL,
      mtime_ms INTEGER NOT NULL,
      size_bytes INTEGER NOT NULL,
      last_seen_at TEXT NOT NULL,
      missing INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_photos_event ON photos(event_path);
    CREATE INDEX IF NOT EXISTS idx_group_events_event ON group_events(event_path);
  `);
}

export function getDb(): Database.Database {
  if (globalThis.__albumLinkDb) {
    return globalThis.__albumLinkDb;
  }
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new Database(DB_PATH);
  migrate(db);
  globalThis.__albumLinkDb = db;
  return db;
}
