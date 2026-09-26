"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  copyShareUrl,
  EventCheckGrid,
  ResolutionSelect,
  ShareLinkField,
  type EventFolder,
  type Group,
  type Person,
  type Resolution,
} from "@/components/admin-ui";

export function AdminPersonEdit({ id }: { id: string }) {
  const router = useRouter();
  const [person, setPerson] = useState<Person | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [events, setEvents] = useState<EventFolder[]>([]);
  const [missing, setMissing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [resolution, setResolution] = useState<Resolution>("full");

  async function refresh() {
    const [groupsRes, peopleRes, eventsRes] = await Promise.all([
      fetch("/api/admin/groups"),
      fetch("/api/admin/people"),
      fetch("/api/admin/events"),
    ]);
    if (!groupsRes.ok || !peopleRes.ok || !eventsRes.ok) {
      throw new Error("Failed to load");
    }
    const groupsJson = await groupsRes.json();
    const peopleJson = await peopleRes.json();
    const eventsJson = await eventsRes.json();
    setEvents(eventsJson.events);
    const found = (peopleJson.people as Person[]).find((item) => item.id === id);
    setGroups(groupsJson.groups);
    setPerson(found ?? null);
    setMissing(!found);
    if (found) {
      setName(found.name);
      setResolution(found.max_download_resolution);
    }
  }

  useEffect(() => {
    void refresh().catch((err) => setMessage(String(err)));
  }, [id]);

  async function save(patch: {
    name?: string;
    maxDownloadResolution?: Resolution;
    groupIds?: string[];
    eventPaths?: string[];
  }) {
    if (!person) return;
    const next = {
      name: patch.name ?? name,
      maxDownloadResolution: patch.maxDownloadResolution ?? resolution,
      groupIds: patch.groupIds ?? person.groupIds,
      eventPaths: patch.eventPaths ?? person.eventPaths,
    };
    if (patch.groupIds || patch.eventPaths) {
      setPerson({
        ...person,
        groupIds: next.groupIds,
        eventPaths: next.eventPaths,
      });
    }
    const res = await fetch("/api/admin/people", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...next }),
    });
    if (!res.ok) {
      setMessage("Could not save the person.");
      await refresh();
      return;
    }
    await refresh();
  }

  async function roll() {
    const res = await fetch("/api/admin/people", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, rollToken: true }),
    });
    if (!res.ok) {
      setMessage("Could not roll the person link.");
      return;
    }
    await refresh();
    setMessage("Person link rolled. The old link no longer works.");
  }

  async function remove() {
    await fetch(`/api/admin/people?id=${id}`, { method: "DELETE" });
    router.push("/admin/people");
  }

  const inheritedPaths = useMemo(() => {
    if (!person) return [];
    const paths = new Set<string>();
    for (const group of groups) {
      if (!person.groupIds.includes(group.id)) continue;
      for (const path of group.eventPaths) paths.add(path);
    }
    return [...paths];
  }, [groups, person]);

  if (missing) {
    return (
      <p className="text-sm text-stone-600">
        Person not found.{" "}
        <Link href="/admin/people" className="underline">
          Back to people
        </Link>
      </p>
    );
  }

  if (!person) {
    return <p className="text-sm text-stone-500">Loading person…</p>;
  }

  return (
    <div className="space-y-6">
      <Link href="/admin/people" className="text-sm text-stone-500 hover:text-stone-800">
        All people
      </Link>

      {message && (
        <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700">
          {message}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Edit person</CardTitle>
          <CardDescription>
            Name, download cap, groups, and the personal share link.
            Folders below are extra access, including for people in no group.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="edit-person-name">Name</Label>
              <Input
                id="edit-person-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => {
                  if (name.trim() && name !== person.name) void save({ name });
                }}
              />
            </div>
            <div className="grid gap-2">
              <Label>Max download</Label>
              <ResolutionSelect
                value={resolution}
                onChange={(value) => {
                  setResolution(value);
                  void save({ maxDownloadResolution: value });
                }}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Groups</Label>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {groups.map((group) => {
                const checked = person.groupIds.includes(group.id);
                return (
                  <label
                    key={group.id}
                    className="flex items-center gap-1.5 text-sm"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) => {
                        const next = v
                          ? [...person.groupIds, group.id]
                          : person.groupIds.filter((item) => item !== group.id);
                        void save({ groupIds: next });
                      }}
                    />
                    {group.name}
                  </label>
                );
              })}
              {groups.length === 0 && (
                <p className="text-sm text-stone-500">No groups yet.</p>
              )}
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Share link</Label>
            <ShareLinkField
              shareUrl={person.shareUrl}
              onCopy={() => void copyShareUrl(person.shareUrl, setMessage)}
              onRoll={() => void roll()}
            />
          </div>
          <Button variant="outline" onClick={() => void remove()}>
            Delete person
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Folders</CardTitle>
          <CardDescription>
            Checked and locked folders come from their groups. Other folders
            can be added here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-sm text-stone-500">
              No event folders indexed yet. Click Scan now.
            </p>
          ) : (
            <EventCheckGrid
              events={events}
              selectedPaths={person.eventPaths}
              lockedPaths={inheritedPaths}
              onChange={(next) => void save({ eventPaths: next })}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
