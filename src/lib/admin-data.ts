import { nanoid } from "nanoid";
import { APP_URL, type DownloadResolution } from "./config";
import { getDb, type EventFolderRow, type GroupRow, type PersonRow } from "./db";
import { createShareToken, hashToken } from "./tokens";

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
  return getDb()
    .prepare(
      `SELECT * FROM event_folders WHERE missing = 0 ORDER BY year DESC, name ASC`,
    )
    .all() as EventFolderRow[];
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
      `INSERT INTO groups (id, name, token_hash, max_download_resolution, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(id, name.trim(), hashToken(token), maxDownloadResolution, new Date().toISOString());
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
    .prepare(`UPDATE groups SET token_hash = ? WHERE id = ?`)
    .run(hashToken(token), id);
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
      `INSERT INTO people (id, name, token_hash, max_download_resolution, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(
      id,
      name.trim(),
      hashToken(token),
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
    .prepare(`UPDATE people SET token_hash = ? WHERE id = ?`)
    .run(hashToken(token), id);
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
