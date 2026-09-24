import { nanoid } from "nanoid";
import { APP_URL, type DownloadResolution } from "./config";
import { getDb, type EventFolderRow, type GroupRow, type PersonRow } from "./db";
import { createShareToken, hashToken } from "./tokens";

export function shareUrlFor(token: string | null): string | null {
  return token ? `${APP_URL}/share/${token}` : null;
}

/** Album links expire one calendar month after issue/roll. */
export function folderShareExpiresAt(from = new Date()): string {
  const expires = new Date(from.getTime());
  expires.setMonth(expires.getMonth() + 1);
  return expires.toISOString();
}

export function listGroups(): GroupRow[] {
  return getDb()
    .prepare(`SELECT * FROM groups ORDER BY name ASC`)
    .all() as GroupRow[];
}

export function listPeople(): (PersonRow & { group_ids: string })[] {
  return getDb()
    .prepare(
      `
      SELECT p.*, GROUP_CONCAT(pg.group_id) AS group_ids
      FROM people p
      LEFT JOIN person_groups pg ON pg.person_id = p.id
      GROUP BY p.id
      ORDER BY p.name ASC
    `,
    )
    .all() as (PersonRow & { group_ids: string })[];
}

export function listEvents(): EventFolderRow[] {
  ensureEventShareTokens();
  return getDb()
    .prepare(
      `SELECT * FROM event_folders WHERE missing = 0 ORDER BY relative_path COLLATE NOCASE ASC`,
    )
    .all() as EventFolderRow[];
}

function ensureEventShareTokens() {
  const db = getDb();
  const missing = db
    .prepare(
      `SELECT relative_path FROM event_folders
       WHERE share_token IS NULL OR token_hash IS NULL OR share_expires_at IS NULL`,
    )
    .all() as { relative_path: string }[];
  if (missing.length === 0) return;
  const insertToken = db.prepare(
    `UPDATE event_folders SET share_token = ?, token_hash = ?, share_expires_at = ?
     WHERE relative_path = ? AND (share_token IS NULL OR token_hash IS NULL)`,
  );
  const insertExpiry = db.prepare(
    `UPDATE event_folders SET share_expires_at = ? WHERE relative_path = ? AND share_expires_at IS NULL`,
  );
  const tx = db.transaction(() => {
    for (const row of missing) {
      const expires = folderShareExpiresAt();
      const current = db
        .prepare(
          `SELECT share_token, token_hash FROM event_folders WHERE relative_path = ?`,
        )
        .get(row.relative_path) as {
        share_token: string | null;
        token_hash: string | null;
      };
      if (!current.share_token || !current.token_hash) {
        const token = createShareToken();
        insertToken.run(token, hashToken(token), expires, row.relative_path);
      } else {
        insertExpiry.run(expires, row.relative_path);
      }
    }
  });
  tx();
}

export function setEventNsfw(eventPath: string, nsfw: boolean) {
  getDb()
    .prepare(`UPDATE event_folders SET nsfw = ? WHERE relative_path = ?`)
    .run(nsfw ? 1 : 0, eventPath);
}

export function setEventWatermark(eventPath: string, watermark: boolean) {
  getDb()
    .prepare(`UPDATE event_folders SET watermark = ? WHERE relative_path = ?`)
    .run(watermark ? 1 : 0, eventPath);
}

export function rollEventToken(eventPath: string) {
  const token = createShareToken();
  const expiresAt = folderShareExpiresAt();
  getDb()
    .prepare(
      `UPDATE event_folders SET share_token = ?, token_hash = ?, share_expires_at = ?
       WHERE relative_path = ?`,
    )
    .run(token, hashToken(token), expiresAt, eventPath);
  return { token, shareUrl: `${APP_URL}/share/${token}`, expiresAt };
}

export function listPersonEventPaths(personId: string): string[] {
  return (
    getDb()
      .prepare(`SELECT event_path FROM person_events WHERE person_id = ?`)
      .all(personId) as { event_path: string }[]
  ).map((r) => r.event_path);
}

export function setPersonEvents(personId: string, eventPaths: string[]) {
  const db = getDb();
  const del = db.prepare(`DELETE FROM person_events WHERE person_id = ?`);
  const ins = db.prepare(
    `INSERT INTO person_events (person_id, event_path) VALUES (?, ?)`,
  );
  const tx = db.transaction(() => {
    del.run(personId);
    for (const eventPath of eventPaths) {
      ins.run(personId, eventPath);
    }
  });
  tx();
}

export function listGroupEventPaths(groupId: string): string[] {
  return (
    getDb()
      .prepare(`SELECT event_path FROM group_events WHERE group_id = ?`)
      .all(groupId) as { event_path: string }[]
  ).map((r) => r.event_path);
}

export function createGroup(name: string, maxDownloadResolution: DownloadResolution) {
  const id = nanoid();
  const token = createShareToken();
  getDb()
    .prepare(
      `INSERT INTO groups (id, name, token_hash, share_token, max_download_resolution, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      name.trim(),
      hashToken(token),
      token,
      maxDownloadResolution,
      new Date().toISOString(),
    );
  return { id, token, shareUrl: `${APP_URL}/share/${token}` };
}

export function updateGroup(
  id: string,
  data: { name: string; maxDownloadResolution: DownloadResolution },
) {
  getDb()
    .prepare(
      `UPDATE groups SET name = ?, max_download_resolution = ? WHERE id = ?`,
    )
    .run(data.name.trim(), data.maxDownloadResolution, id);
}

export function rollGroupToken(id: string) {
  const token = createShareToken();
  getDb()
    .prepare(`UPDATE groups SET token_hash = ?, share_token = ? WHERE id = ?`)
    .run(hashToken(token), token, id);
  return { token, shareUrl: `${APP_URL}/share/${token}` };
}

export function deleteGroup(id: string) {
  getDb().prepare(`DELETE FROM groups WHERE id = ?`).run(id);
}

export function setGroupEvents(groupId: string, eventPaths: string[]) {
  const db = getDb();
  const del = db.prepare(`DELETE FROM group_events WHERE group_id = ?`);
  const ins = db.prepare(
    `INSERT INTO group_events (group_id, event_path) VALUES (?, ?)`,
  );
  const tx = db.transaction(() => {
    del.run(groupId);
    for (const eventPath of eventPaths) {
      ins.run(groupId, eventPath);
    }
  });
  tx();
}

export function createPerson(
  name: string,
  maxDownloadResolution: DownloadResolution,
  groupIds: string[],
) {
  const id = nanoid();
  const token = createShareToken();
  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO people (id, name, token_hash, share_token, max_download_resolution, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      name.trim(),
      hashToken(token),
      token,
      maxDownloadResolution,
      new Date().toISOString(),
    );
    const ins = db.prepare(
      `INSERT INTO person_groups (person_id, group_id) VALUES (?, ?)`,
    );
    for (const groupId of groupIds) {
      ins.run(id, groupId);
    }
  });
  tx();
  return { id, token, shareUrl: `${APP_URL}/share/${token}` };
}

export function updatePerson(
  id: string,
  data: {
    name: string;
    maxDownloadResolution: DownloadResolution;
    groupIds: string[];
  },
) {
  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE people SET name = ?, max_download_resolution = ? WHERE id = ?`,
    ).run(data.name.trim(), data.maxDownloadResolution, id);
    db.prepare(`DELETE FROM person_groups WHERE person_id = ?`).run(id);
    const ins = db.prepare(
      `INSERT INTO person_groups (person_id, group_id) VALUES (?, ?)`,
    );
    for (const groupId of data.groupIds) {
      ins.run(id, groupId);
    }
  });
  tx();
}

export function rollPersonToken(id: string) {
  const token = createShareToken();
  getDb()
    .prepare(`UPDATE people SET token_hash = ?, share_token = ? WHERE id = ?`)
    .run(hashToken(token), token, id);
  return { token, shareUrl: `${APP_URL}/share/${token}` };
}

export function deletePerson(id: string) {
  getDb().prepare(`DELETE FROM people WHERE id = ?`).run(id);
}

export function listPhotosForEvent(eventPath: string) {
  return getDb()
    .prepare(
      `
      SELECT relative_path, filename, mtime_ms, size_bytes
      FROM photos
      WHERE event_path = ? AND missing = 0
      ORDER BY filename ASC
    `,
    )
    .all(eventPath) as {
    relative_path: string;
    filename: string;
    mtime_ms: number;
    size_bytes: number;
  }[];
}
