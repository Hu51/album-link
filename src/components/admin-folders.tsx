"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ADMIN_REFRESH,
  copyShareUrl,
  FolderThumbs,
  folderTree,
  ShareLinkField,
  type EventFolder,
  type FolderNode,
  type Group,
  type Person,
} from "@/components/admin-ui";

export function AdminFolders() {
  const [events, setEvents] = useState<EventFolder[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<EventFolder | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  async function refresh() {
    const [groupsRes, peopleRes, eventsRes] = await Promise.all([
      fetch("/api/admin/groups"),
      fetch("/api/admin/people"),
      fetch("/api/admin/events"),
    ]);
    if (!groupsRes.ok || !peopleRes.ok || !eventsRes.ok) {
      throw new Error("Failed to load folders");
    }
    const groupsJson = await groupsRes.json();
    const peopleJson = await peopleRes.json();
    const eventsJson = await eventsRes.json();
    setGroups(groupsJson.groups);
    setPeople(peopleJson.people);
    setEvents(eventsJson.events);
  }

  useEffect(() => {
    void refresh().catch((err) => setMessage(String(err)));
    function onRefresh() {
      void refresh().catch((err) => setMessage(String(err)));
    }
    window.addEventListener(ADMIN_REFRESH, onRefresh);
    return () => window.removeEventListener(ADMIN_REFRESH, onRefresh);
  }, []);

  function inherited(person: Person, eventPath: string) {
    return groups.some(
      (group) =>
        person.groupIds.includes(group.id) &&
        group.eventPaths.includes(eventPath),
    );
  }

  async function toggleGroup(group: Group, eventPath: string, on: boolean) {
    const key = `group:${group.id}:${eventPath}`;
    const eventPaths = on
      ? [...new Set([...group.eventPaths, eventPath])]
      : group.eventPaths.filter((path) => path !== eventPath);
    setSaving(key);
    setGroups((current) =>
      current.map((item) =>
        item.id === group.id ? { ...item, eventPaths } : item,
      ),
    );
    const res = await fetch("/api/admin/groups", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: group.id, eventPaths }),
    });
    setSaving(null);
    if (!res.ok) {
      setMessage("Could not update group access.");
      await refresh();
    }
  }

  async function toggleNsfw(event: EventFolder, on: boolean) {
    const key = `nsfw:${event.relative_path}`;
    setSaving(key);
    setEvents((current) =>
      current.map((item) =>
        item.relative_path === event.relative_path
          ? { ...item, nsfw: on ? 1 : 0 }
          : item,
      ),
    );
    const res = await fetch("/api/admin/events", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: event.relative_path, nsfw: on }),
    });
    setSaving(null);
    if (!res.ok) {
      setMessage("Could not update the NSFW flag.");
      await refresh();
    }
  }

  async function toggleWatermark(event: EventFolder, on: boolean) {
    const key = `wm:${event.relative_path}`;
    setSaving(key);
    setEvents((current) =>
      current.map((item) =>
        item.relative_path === event.relative_path
          ? { ...item, watermark: on ? 1 : 0 }
          : item,
      ),
    );
    const res = await fetch("/api/admin/events", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: event.relative_path, watermark: on }),
    });
    setSaving(null);
    if (!res.ok) {
      setMessage("Could not update the watermark flag.");
      await refresh();
    }
  }

  async function rollShare(event: EventFolder) {
    const key = `roll:${event.relative_path}`;
    setSaving(key);
    const res = await fetch("/api/admin/events", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: event.relative_path, rollToken: true }),
    });
    setSaving(null);
    if (!res.ok) {
      setMessage("Could not roll the album link.");
      return;
    }
    const json = (await res.json()) as { shareUrl?: string };
    setEvents((current) =>
      current.map((item) =>
        item.relative_path === event.relative_path
          ? { ...item, shareUrl: json.shareUrl ?? item.shareUrl }
          : item,
      ),
    );
    setMessage("Album link rolled.");
  }

  async function togglePerson(person: Person, eventPath: string, on: boolean) {
    const key = `person:${person.id}:${eventPath}`;
    const eventPaths = on
      ? [...new Set([...person.eventPaths, eventPath])]
      : person.eventPaths.filter((path) => path !== eventPath);
    setSaving(key);
    setPeople((current) =>
      current.map((item) =>
        item.id === person.id ? { ...item, eventPaths } : item,
      ),
    );
    const res = await fetch("/api/admin/people", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: person.id, eventPaths }),
    });
    setSaving(null);
    if (!res.ok) {
      setMessage("Could not update person access.");
      await refresh();
    }
  }

  return (
    <div className="space-y-4">
      {message && (
        <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700">
          {message}
        </div>
      )}
      <p className="text-sm text-stone-600">
        Each album has its own link (downloads capped at 1000px). Watermark only
        applies to that album link — group and person links stay clean. Check a
        group to share the folder with everyone in it. A person checked through a
        group stays locked.
      </p>
      <AccessTree
        nodes={folderTree(events)}
        groups={groups}
        people={people}
        saving={saving}
        inherited={inherited}
        onPreview={setPreview}
        onToggleGroup={(group, eventPath, on) =>
          void toggleGroup(group, eventPath, on)
        }
        onTogglePerson={(person, eventPath, on) =>
          void togglePerson(person, eventPath, on)
        }
        onToggleNsfw={(event, on) => void toggleNsfw(event, on)}
        onToggleWatermark={(event, on) => void toggleWatermark(event, on)}
        onRollShare={(event) => void rollShare(event)}
        onCopyShare={(event) => void copyShareUrl(event.shareUrl, setMessage)}
      />
      <Dialog
        open={preview !== null}
        onOpenChange={(open) => !open && setPreview(null)}
      >
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {preview?.relative_path || preview?.name}
            </DialogTitle>
          </DialogHeader>
          {preview && <FolderThumbs eventPath={preview.relative_path} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AccessTree({
  nodes,
  groups,
  people,
  saving,
  inherited,
  onPreview,
  onToggleGroup,
  onTogglePerson,
  onToggleNsfw,
  onToggleWatermark,
  onRollShare,
  onCopyShare,
}: {
  nodes: FolderNode[];
  groups: Group[];
  people: Person[];
  saving: string | null;
  inherited: (person: Person, eventPath: string) => boolean;
  onPreview: (event: EventFolder) => void;
  onToggleGroup: (group: Group, eventPath: string, on: boolean) => void;
  onTogglePerson: (person: Person, eventPath: string, on: boolean) => void;
  onToggleNsfw: (event: EventFolder, on: boolean) => void;
  onToggleWatermark: (event: EventFolder, on: boolean) => void;
  onRollShare: (event: EventFolder) => void;
  onCopyShare: (event: EventFolder) => void;
}) {
  return (
    <div className="space-y-3">
      {nodes.map((node) => (
        <div key={node.path}>
          {node.event ? (
            <FolderAccess
              name={node.name}
              event={node.event}
              groups={groups}
              people={people}
              saving={saving}
              inherited={inherited}
              onPreview={onPreview}
              onToggleGroup={onToggleGroup}
              onTogglePerson={onTogglePerson}
              onToggleNsfw={onToggleNsfw}
              onToggleWatermark={onToggleWatermark}
              onRollShare={onRollShare}
              onCopyShare={onCopyShare}
            />
          ) : (
            <div className="px-2 py-1 text-sm font-medium text-stone-500">
              {node.name}
            </div>
          )}
          {node.children.length > 0 && (
            <div className="mt-2 ml-4 border-l border-stone-200 pl-3">
              <AccessTree
                nodes={node.children}
                groups={groups}
                people={people}
                saving={saving}
                inherited={inherited}
                onPreview={onPreview}
                onToggleGroup={onToggleGroup}
                onTogglePerson={onTogglePerson}
                onToggleNsfw={onToggleNsfw}
                onToggleWatermark={onToggleWatermark}
                onRollShare={onRollShare}
                onCopyShare={onCopyShare}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function FolderAccess({
  name,
  event,
  groups,
  people,
  saving,
  inherited,
  onPreview,
  onToggleGroup,
  onTogglePerson,
  onToggleNsfw,
  onToggleWatermark,
  onRollShare,
  onCopyShare,
}: {
  name: string;
  event: EventFolder;
  groups: Group[];
  people: Person[];
  saving: string | null;
  inherited: (person: Person, eventPath: string) => boolean;
  onPreview: (event: EventFolder) => void;
  onToggleGroup: (group: Group, eventPath: string, on: boolean) => void;
  onTogglePerson: (person: Person, eventPath: string, on: boolean) => void;
  onToggleNsfw: (event: EventFolder, on: boolean) => void;
  onToggleWatermark: (event: EventFolder, on: boolean) => void;
  onRollShare: (event: EventFolder) => void;
  onCopyShare: (event: EventFolder) => void;
}) {
  const path = event.relative_path;

  return (
    <div className="rounded-lg border border-stone-200 bg-white/70 px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-0 flex-1 break-all text-sm font-medium text-stone-900">
          {name}
        </span>
        <span className="shrink-0 text-xs text-stone-400">
          {event.photo_count}
        </span>
        <label className="inline-flex shrink-0 items-center gap-1.5 text-sm text-stone-700">
          <Checkbox
            checked={event.nsfw === 1}
            disabled={saving === `nsfw:${path}`}
            onCheckedChange={(value) => onToggleNsfw(event, Boolean(value))}
          />
          NSFW
        </label>
        <label className="inline-flex shrink-0 items-center gap-1.5 text-sm text-stone-700">
          <Checkbox
            checked={event.watermark === 1}
            disabled={saving === `wm:${path}`}
            onCheckedChange={(value) =>
              onToggleWatermark(event, Boolean(value))
            }
          />
          Watermark
        </label>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onPreview(event)}
        >
          Photos
        </Button>
      </div>
      <div className="mt-2">
        <ShareLinkField
          shareUrl={event.shareUrl}
          onCopy={() => onCopyShare(event)}
          onRoll={() => onRollShare(event)}
        />
        <p className="mt-1 text-xs text-stone-400">
          Album link · max download 1000px
        </p>
      </div>
      <AccessRow label="Groups">
        {groups.length === 0 && (
          <span className="text-sm text-stone-400">No groups</span>
        )}
        {groups.map((group) => {
          const checked = group.eventPaths.includes(path);
          return (
            <label
              key={group.id}
              className="inline-flex items-center gap-1.5 text-sm text-stone-800"
            >
              <Checkbox
                checked={checked}
                disabled={saving === `group:${group.id}:${path}`}
                onCheckedChange={(value) =>
                  onToggleGroup(group, path, Boolean(value))
                }
              />
              {group.name}
            </label>
          );
        })}
      </AccessRow>
      <AccessRow label="People">
        {people.length === 0 && (
          <span className="text-sm text-stone-400">No people</span>
        )}
        {people.map((person) => {
          const locked = inherited(person, path);
          const checked = locked || person.eventPaths.includes(path);
          return (
            <label
              key={person.id}
              title={locked ? "Included by a group" : undefined}
              className={`inline-flex items-center gap-1.5 text-sm ${
                locked ? "text-stone-400" : "text-stone-800"
              }`}
            >
              <Checkbox
                checked={checked}
                disabled={locked || saving === `person:${person.id}:${path}`}
                onCheckedChange={(value) => {
                  if (locked) return;
                  onTogglePerson(person, path, Boolean(value));
                }}
              />
              {person.name}
            </label>
          );
        })}
      </AccessRow>
    </div>
  );
}

function AccessRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="w-16 shrink-0 text-xs uppercase tracking-wide text-stone-400">
        {label}
      </span>
      {children}
    </div>
  );
}
