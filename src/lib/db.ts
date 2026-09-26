import Database from "better-sqlite3";
import fs from "node:fs";
import { DATA_DIR, DB_PATH, type DownloadResolution } from "./config";

export type GroupRow = {
  id: string;
  name: string;
  token_hash: string;
  share_token: string | null;
  max_download_resolution: DownloadResolution;
  created_at: string;
};

export type PersonRow = {
  id: string;
  name: string;
  token_hash: string;
  share_token: string | null;
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
  nsfw: number;
  watermark: number;
  share_token: string | null;
  token_hash: string | null;
  share_expires_at: string | null;
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

function mapLegacyResolution(value: string): DownloadResolution {
  switch (value) {
    case "full":
    case "orig":
      return "full";
    case "2k":
    case "2000px":
      return "2000px";
    case "hd":
    case "1000px":
      return "1000px";
    default:
      return "full";
  }
}

function migrate(db: Database.Database) {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      token_hash TEXT NOT NULL UNIQUE,
      share_token TEXT,
      max_download_resolution TEXT NOT NULL DEFAULT 'full'
        CHECK (max_download_resolution IN ('full', '2000px', '1000px')),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS people (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      token_hash TEXT NOT NULL UNIQUE,
      share_token TEXT,
      max_download_resolution TEXT NOT NULL DEFAULT 'full'
        CHECK (max_download_resolution IN ('full', '2000px', '1000px')),
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
      missing INTEGER NOT NULL DEFAULT 0,
      nsfw INTEGER NOT NULL DEFAULT 0,
      watermark INTEGER NOT NULL DEFAULT 0,
      share_token TEXT,
      token_hash TEXT,
      share_expires_at TEXT
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

    CREATE TABLE IF NOT EXISTS person_events (
      person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
      event_path TEXT NOT NULL REFERENCES event_folders(relative_path) ON DELETE CASCADE,
      PRIMARY KEY (person_id, event_path)
    );

    CREATE INDEX IF NOT EXISTS idx_photos_event ON photos(event_path);
    CREATE INDEX IF NOT EXISTS idx_group_events_event ON group_events(event_path);
    CREATE INDEX IF NOT EXISTS idx_person_events_event ON person_events(event_path);
  `);

  ensureShareToken(db);
  ensurePersonEvents(db);
  ensureEventNsfw(db);
  ensureEventShare(db);
  ensureFullResolution(db);
}

function ensureFullResolution(db: Database.Database) {
  const groupSql = (
    db
      .prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'groups'`)
      .get() as { sql: string } | undefined
  )?.sql;
  if (!groupSql || groupSql.includes("'full'")) return;

  const groupColumns = db.prepare(`PRAGMA table_info(groups)`).all() as {
    name: string;
  }[];
  const hasShareToken = groupColumns.some((c) => c.name === "share_token");
  const groups = db
    .prepare(
      hasShareToken
        ? `SELECT id, name, token_hash, share_token, max_download_resolution, created_at FROM groups`
        : `SELECT id, name, token_hash, NULL AS share_token, max_download_resolution, created_at FROM groups`,
    )
    .all() as {
    id: string;
    name: string;
    token_hash: string;
    share_token: string | null;
    max_download_resolution: string;
    created_at: string;
  }[];
  const people = db
    .prepare(
      hasShareToken
        ? `SELECT id, name, token_hash, share_token, max_download_resolution, created_at FROM people`
        : `SELECT id, name, token_hash, NULL AS share_token, max_download_resolution, created_at FROM people`,
    )
    .all() as {
    id: string;
    name: string;
    token_hash: string;
    share_token: string | null;
    max_download_resolution: string;
    created_at: string;
  }[];
  const personGroups = db
    .prepare(`SELECT person_id, group_id FROM person_groups`)
    .all() as { person_id: string; group_id: string }[];
  const groupEvents = db
    .prepare(`SELECT group_id, event_path FROM group_events`)
    .all() as { group_id: string; event_path: string }[];

  db.exec(`PRAGMA foreign_keys = OFF;`);
  db.exec(`
    DROP TABLE IF EXISTS person_groups;
    DROP TABLE IF EXISTS group_events;
    DROP TABLE IF EXISTS groups;
    DROP TABLE IF EXISTS people;
  `);
  db.exec(`
    CREATE TABLE groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      token_hash TEXT NOT NULL UNIQUE,
      share_token TEXT,
      max_download_resolution TEXT NOT NULL DEFAULT 'full'
        CHECK (max_download_resolution IN ('full', '2000px', '1000px')),
      created_at TEXT NOT NULL
    );
    CREATE TABLE people (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      token_hash TEXT NOT NULL UNIQUE,
      share_token TEXT,
      max_download_resolution TEXT NOT NULL DEFAULT 'full'
        CHECK (max_download_resolution IN ('full', '2000px', '1000px')),
      created_at TEXT NOT NULL
    );
    CREATE TABLE person_groups (
      person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
      group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      PRIMARY KEY (person_id, group_id)
    );
    CREATE TABLE group_events (
      group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      event_path TEXT NOT NULL REFERENCES event_folders(relative_path) ON DELETE CASCADE,
      PRIMARY KEY (group_id, event_path)
    );
  `);

  const insertGroup = db.prepare(
    `INSERT INTO groups (id, name, token_hash, share_token, max_download_resolution, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  const insertPerson = db.prepare(
    `INSERT INTO people (id, name, token_hash, share_token, max_download_resolution, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  const insertPg = db.prepare(
    `INSERT INTO person_groups (person_id, group_id) VALUES (?, ?)`,
  );
  const insertGe = db.prepare(
    `INSERT INTO group_events (group_id, event_path) VALUES (?, ?)`,
  );

  for (const g of groups) {
    insertGroup.run(
      g.id,
      g.name,
      g.token_hash,
      g.share_token,
      mapLegacyResolution(g.max_download_resolution),
      g.created_at,
    );
  }
  for (const p of people) {
    insertPerson.run(
      p.id,
      p.name,
      p.token_hash,
      p.share_token,
      mapLegacyResolution(p.max_download_resolution),
      p.created_at,
    );
  }
  for (const row of personGroups) {
    insertPg.run(row.person_id, row.group_id);
  }
  for (const row of groupEvents) {
    insertGe.run(row.group_id, row.event_path);
  }
  db.exec(`PRAGMA foreign_keys = ON;`);
}

function ensurePersonEvents(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS person_events (
      person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
      event_path TEXT NOT NULL REFERENCES event_folders(relative_path) ON DELETE CASCADE,
      PRIMARY KEY (person_id, event_path)
    );
    CREATE INDEX IF NOT EXISTS idx_person_events_event ON person_events(event_path);
  `);
}

function ensureEventNsfw(db: Database.Database) {
  const columns = db.prepare(`PRAGMA table_info(event_folders)`).all() as {
    name: string;
  }[];
  if (!columns.some((column) => column.name === "nsfw")) {
    db.exec(`ALTER TABLE event_folders ADD COLUMN nsfw INTEGER NOT NULL DEFAULT 0`);
  }
}

function ensureEventShare(db: Database.Database) {
  const columns = db.prepare(`PRAGMA table_info(event_folders)`).all() as {
    name: string;
  }[];
  if (!columns.some((column) => column.name === "watermark")) {
    db.exec(
      `ALTER TABLE event_folders ADD COLUMN watermark INTEGER NOT NULL DEFAULT 0`,
    );
  }
  if (!columns.some((column) => column.name === "share_token")) {
    db.exec(`ALTER TABLE event_folders ADD COLUMN share_token TEXT`);
  }
  if (!columns.some((column) => column.name === "token_hash")) {
    db.exec(`ALTER TABLE event_folders ADD COLUMN token_hash TEXT`);
  }
  if (!columns.some((column) => column.name === "share_expires_at")) {
    db.exec(`ALTER TABLE event_folders ADD COLUMN share_expires_at TEXT`);
  }
}

function ensureShareToken(db: Database.Database) {
  for (const table of ["groups", "people"] as const) {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all() as {
      name: string;
    }[];
    if (!columns.some((column) => column.name === "share_token")) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN share_token TEXT`);
    }
  }
}

export function getDb(): Database.Database {
  if (globalThis.__albumLinkDb) {
    ensureShareToken(globalThis.__albumLinkDb);
    ensurePersonEvents(globalThis.__albumLinkDb);
    ensureEventNsfw(globalThis.__albumLinkDb);
    ensureEventShare(globalThis.__albumLinkDb);
    ensureFullResolution(globalThis.__albumLinkDb);
    return globalThis.__albumLinkDb;
  }
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new Database(DB_PATH);
  migrate(db);
  globalThis.__albumLinkDb = db;
  ensureShareToken(db);
  ensurePersonEvents(db);
  ensureEventNsfw(db);
  ensureEventShare(db);
  ensureFullResolution(db);
  return db;
}
