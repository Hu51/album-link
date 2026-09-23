import fs from "node:fs";
import path from "node:path";
import { IMAGE_EXTENSIONS, PHOTOS_ROOT } from "./config";
import { getDb } from "./db";
import { toPosix } from "./paths";

export type ScanResult = {
  photosRoot: string;
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
  const seenInodes = new Set<string>();
  let eventsFound = 0;
  let photosFound = 0;
  let directoriesSeen = 0;
  let unreadable = 0;
  let topLevel: string[] = [];
  const otherFiles = new Map<string, number>();

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

  try {
    fs.accessSync(PHOTOS_ROOT, fs.constants.R_OK | fs.constants.X_OK);
  } catch (err) {
    const detail = err instanceof Error ? err.message : "unreadable";
    throw new Error(`Cannot read photos folder ${PHOTOS_ROOT}: ${detail}`);
  }

  // First path segment is only a group label (stored as year).
  // Any directory that contains images is an event, at any depth.
  function statEntry(absPath: string): fs.Stats | null {
    try {
      const linked = fs.lstatSync(absPath);
      if (!linked.isSymbolicLink()) return linked;
      return fs.statSync(absPath);
    } catch {
      return null;
    }
  }

  function indexDirectory(absDir: string, relDir: string) {
    const dirStat = statEntry(absDir);
    if (!dirStat?.isDirectory()) return;
    const inode = `${dirStat.dev}:${dirStat.ino}`;
    if (seenInodes.has(inode)) return;
    seenInodes.add(inode);
    directoriesSeen += 1;

    let names: string[];
    try {
      names = fs.readdirSync(absDir);
    } catch {
      unreadable += 1;
      return;
    }
    if (!relDir) topLevel = [...names].sort();

    const files: { name: string; stat: fs.Stats }[] = [];
    const directories: string[] = [];
    for (const name of names) {
      const stat = statEntry(path.join(absDir, name));
      if (!stat) continue;
      if (stat.isDirectory()) directories.push(name);
      else if (stat.isFile() && isImageFile(name)) files.push({ name, stat });
      else if (stat.isFile()) {
        const ext = path.extname(name).toLowerCase() || "(no extension)";
        otherFiles.set(ext, (otherFiles.get(ext) ?? 0) + 1);
      }
    }
    files.sort((a, b) => a.name.localeCompare(b.name));
    directories.sort((a, b) => a.localeCompare(b));

    if (files.length > 0) {
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

      for (const file of files) {
        const photoRel = childRelative(relDir, file.name);
        upsertPhoto.run({
          relative_path: photoRel,
          event_path: relDir,
          filename: file.name,
          mtime_ms: Math.floor(file.stat.mtimeMs),
          size_bytes: file.stat.size,
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
        photo_count: files.length,
        cover_path: coverPath,
        last_seen_at: now,
      });
      seenEvents.add(relDir);
      eventsFound += 1;
    }

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

    if (eventsFound === 0 && photosFound === 0) {
      const extras: string[] = [];
      if (directoriesSeen) extras.push(`${directoriesSeen} folders`);
      if (unreadable) extras.push(`${unreadable} unreadable`);
      const kinds = [...otherFiles.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([ext, count]) => `${ext} ${count}`);
      if (kinds.length) extras.push(`other files: ${kinds.join(", ")}`);
      const detail = extras.length ? ` (${extras.join("; ")})` : "";
      const listed = topLevel.slice(0, 30).join(", ") || "(none)";
      throw new Error(
        `No images in ${PHOTOS_ROOT}. Folders here: ${listed}${detail}`,
      );
    }

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

  return { photosRoot: PHOTOS_ROOT, eventsFound, photosFound, eventsMissing, photosMissing };
}
