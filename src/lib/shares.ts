import { hashToken } from "./tokens";
import { getDb, type EventFolderRow, type GroupRow, type PersonRow } from "./db";
import type { DownloadResolution } from "./config";

export type ShareContext = {
  kind: "group" | "person" | "folder";
  id: string;
  name: string;
  maxDownloadResolution: DownloadResolution;
  watermark: boolean;
  shareExpiresAt: string | null;
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
        ORDER BY e.relative_path COLLATE NOCASE ASC
      `,
      )
      .all(group.id) as EventFolderRow[];

    return {
      kind: "group",
      id: group.id,
      name: group.name,
      maxDownloadResolution: group.max_download_resolution,
      watermark: false,
      shareExpiresAt: null,
      events,
    };
  }

  const person = db
    .prepare(`SELECT * FROM people WHERE token_hash = ?`)
    .get(tokenHash) as PersonRow | undefined;

  if (person) {
    const events = db
      .prepare(
        `
        SELECT DISTINCT e.*
        FROM event_folders e
        WHERE e.missing = 0 AND (
          e.relative_path IN (
            SELECT ge.event_path
            FROM group_events ge
            INNER JOIN person_groups pg ON pg.group_id = ge.group_id
            WHERE pg.person_id = ?
          )
          OR e.relative_path IN (
            SELECT pe.event_path FROM person_events pe WHERE pe.person_id = ?
          )
        )
        ORDER BY e.relative_path COLLATE NOCASE ASC
      `,
      )
      .all(person.id, person.id) as EventFolderRow[];

    return {
      kind: "person",
      id: person.id,
      name: person.name,
      maxDownloadResolution: person.max_download_resolution,
      watermark: false,
      shareExpiresAt: null,
      events,
    };
  }

  const folder = db
    .prepare(
      `SELECT * FROM event_folders WHERE token_hash = ? AND missing = 0`,
    )
    .get(tokenHash) as EventFolderRow | undefined;

  if (!folder) return null;

  if (
    !folder.share_expires_at ||
    Date.parse(folder.share_expires_at) <= Date.now()
  ) {
    return null;
  }

  return {
    kind: "folder",
    id: folder.relative_path,
    name: folder.name,
    maxDownloadResolution: "1000px",
    watermark: folder.watermark === 1,
    shareExpiresAt: folder.share_expires_at,
    events: [folder],
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
