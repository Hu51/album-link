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

function childRelative(parentRel: string, name: string): string {
  return parentRel ? toPosix(path.join(parentRel, name)) : name;
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

  // First path segment is only a group label (stored as year).
  // Any directory that contains images is an event, at any depth.
  function indexDirectory(absDir: string, relDir: string) {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(absDir, { withFileTypes: true });
    } catch {
      return;
    }

    const filenames = entries
      .filter((entry) => entry.isFile() && isImageFile(entry.name))
      .map((entry) => entry.name)
      .sort();

    if (filenames.length > 0) {
      const segments = relDir ? relDir.split("/") : [];
      const group = segments[0] || path.basename(PHOTOS_ROOT) || "photos";
      const name = segments.at(-1) || group;
      let coverPath: string | null = null;

      upsertEvent.run({
        relative_path: relDir,
        year: group,
        name,
        photo_count: 0,
        cover_path: null,
        last_seen_at: now,
      });

      for (const filename of filenames) {
        const photoRel = childRelative(relDir, filename);
        const stat = fs.statSync(path.join(absDir, filename));
        upsertPhoto.run({
          relative_path: photoRel,
          event_path: relDir,
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
        relative_path: relDir,
        year: group,
        name,
        photo_count: filenames.length,
        cover_path: coverPath,
        last_seen_at: now,
      });
      seenEvents.add(relDir);
      eventsFound += 1;
    }

    const directories = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

    for (const directory of directories) {
      indexDirectory(
        path.join(absDir, directory),
        childRelative(relDir, directory),
      );
    }
  }

  const markEventsMissing = db.prepare(
    `UPDATE event_folders SET missing = 1 WHERE relative_path = ?`,
  );
  const markPhotosMissing = db.prepare(
    `UPDATE photos SET missing = 1 WHERE relative_path = ?`,
  );

  let eventsMissing = 0;
  let photosMissing = 0;

  const apply = db.transaction(() => {
    indexDirectory(PHOTOS_ROOT, "");

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
  });

  apply();

  return { eventsFound, photosFound, eventsMissing, photosMissing };
}
