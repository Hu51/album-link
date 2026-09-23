import { hashToken } from "./tokens";
import { getDb, type EventFolderRow, type GroupRow, type PersonRow } from "./db";
import type { DownloadResolution } from "./config";

export type ShareContext = {
  kind: "group" | "person";
  id: string;
  name: string;
  maxDownloadResolution: DownloadResolution;
  events: EventFolderRow[];
};

export function resolveShareToken(token: string): ShareContext | null {
  const db = getDb();
  const tokenHash = hashToken(token);

  const group = db
    .prepare(`SELECT * FROM groups WHERE token_hash = ?`)
    .get(tokenHash) as GroupRow | undefined;

  if (group) {
    const events = db
      .prepare(
        `
        SELECT e.*
        FROM event_folders e
        INNER JOIN group_events ge ON ge.event_path = e.relative_path
        WHERE ge.group_id = ? AND e.missing = 0
        ORDER BY e.year DESC, e.name ASC
      `,
      )
      .all(group.id) as EventFolderRow[];

    return {
      kind: "group",
      id: group.id,
      name: group.name,
      maxDownloadResolution: group.max_download_resolution,
      events,
    };
  }

  const person = db
    .prepare(`SELECT * FROM people WHERE token_hash = ?`)
    .get(tokenHash) as PersonRow | undefined;

  if (!person) return null;

  const events = db
    .prepare(
      `
      SELECT DISTINCT e.*
      FROM event_folders e
      INNER JOIN group_events ge ON ge.event_path = e.relative_path
      INNER JOIN person_groups pg ON pg.group_id = ge.group_id
      WHERE pg.person_id = ? AND e.missing = 0
      ORDER BY e.year DESC, e.name ASC
    `,
    )
    .all(person.id) as EventFolderRow[];

  return {
    kind: "person",
    id: person.id,
    name: person.name,
    maxDownloadResolution: person.max_download_resolution,
    events,
  };
}

export function shareCanAccessEvent(
  share: ShareContext,
  eventPath: string,
): boolean {
  return share.events.some((e) => e.relative_path === eventPath);
}

export function shareCanAccessPhoto(
  share: ShareContext,
  photoRelativePath: string,
): boolean {
  const db = getDb();
  const photo = db
    .prepare(
      `SELECT event_path FROM photos WHERE relative_path = ? AND missing = 0`,
    )
    .get(photoRelativePath) as { event_path: string } | undefined;
  if (!photo) return false;
  return shareCanAccessEvent(share, photo.event_path);
}
