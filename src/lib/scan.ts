import fs from "node:fs";
import path from "node:path";
import { IMAGE_EXTENSIONS, PHOTOS_ROOT } from "./config";
import { getDb } from "./db";
import { toPosix } from "./paths";

export type ScanResult = {
  eventsFound: number;
  photosFound: number;
  eventsMissing: number;
  photosMissing: number;
};

function isImageFile(filename: string): boolean {
  return IMAGE_EXTENSIONS.has(path.extname(filename).toLowerCase());
}

export function scanPhotos(): ScanResult {
  const db = getDb();
  const now = new Date().toISOString();
  const seenEvents = new Set<string>();
  const seenPhotos = new Set<string>();
  let eventsFound = 0;
  let photosFound = 0;

  const upsertEvent = db.prepare(`
    INSERT INTO event_folders (relative_path, year, name, photo_count, cover_path, last_seen_at, missing)
    VALUES (@relative_path, @year, @name, @photo_count, @cover_path, @last_seen_at, 0)
    ON CONFLICT(relative_path) DO UPDATE SET
      year = excluded.year,
      name = excluded.name,
      photo_count = excluded.photo_count,
      cover_path = excluded.cover_path,
      last_seen_at = excluded.last_seen_at,
      missing = 0
  `);

  const upsertPhoto = db.prepare(`
    INSERT INTO photos (relative_path, event_path, filename, mtime_ms, size_bytes, last_seen_at, missing)
    VALUES (@relative_path, @event_path, @filename, @mtime_ms, @size_bytes, @last_seen_at, 0)
    ON CONFLICT(relative_path) DO UPDATE SET
      event_path = excluded.event_path,
      filename = excluded.filename,
      mtime_ms = excluded.mtime_ms,
      size_bytes = excluded.size_bytes,
      last_seen_at = excluded.last_seen_at,
      missing = 0
  `);

  if (!fs.existsSync(PHOTOS_ROOT)) {
    fs.mkdirSync(PHOTOS_ROOT, { recursive: true });
  }

  const years = fs
    .readdirSync(PHOTOS_ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  for (const year of years) {
    const yearPath = path.join(PHOTOS_ROOT, year);
    const events = fs
      .readdirSync(yearPath, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();

    for (const eventName of events) {
      const eventAbs = path.join(yearPath, eventName);
      const eventRel = toPosix(path.join(year, eventName));

      // Event row must exist before photos (FK).
      upsertEvent.run({
        relative_path: eventRel,
        year,
        name: eventName,
        photo_count: 0,
        cover_path: null,
        last_seen_at: now,
      });

      const files = fs
        .readdirSync(eventAbs, { withFileTypes: true })
        .filter((d) => d.isFile() && isImageFile(d.name))
        .map((d) => d.name)
        .sort();

      let coverPath: string | null = null;
      for (const filename of files) {
        const photoRel = toPosix(path.join(year, eventName, filename));
        const abs = path.join(eventAbs, filename);
        const stat = fs.statSync(abs);
        upsertPhoto.run({
          relative_path: photoRel,
          event_path: eventRel,
          filename,
          mtime_ms: Math.floor(stat.mtimeMs),
          size_bytes: stat.size,
          last_seen_at: now,
        });
        seenPhotos.add(photoRel);
        photosFound += 1;
        if (!coverPath) coverPath = photoRel;
      }

      upsertEvent.run({
        relative_path: eventRel,
        year,
        name: eventName,
        photo_count: files.length,
        cover_path: coverPath,
        last_seen_at: now,
      });
      seenEvents.add(eventRel);
      eventsFound += 1;
    }
  }

  const markEventsMissing = db.prepare(
    `UPDATE event_folders SET missing = 1 WHERE relative_path = ?`,
  );
  const markPhotosMissing = db.prepare(`UPDATE photos SET missing = 1 WHERE relative_path = ?`);

  let eventsMissing = 0;
  let photosMissing = 0;

  for (const row of db
    .prepare(`SELECT relative_path FROM event_folders WHERE missing = 0`)
    .all() as { relative_path: string }[]) {
    if (!seenEvents.has(row.relative_path)) {
      markEventsMissing.run(row.relative_path);
      eventsMissing += 1;
    }
  }

  for (const row of db
    .prepare(`SELECT relative_path FROM photos WHERE missing = 0`)
    .all() as { relative_path: string }[]) {
    if (!seenPhotos.has(row.relative_path)) {
      markPhotosMissing.run(row.relative_path);
      photosMissing += 1;
    }
  }

  return { eventsFound, photosFound, eventsMissing, photosMissing };
}
