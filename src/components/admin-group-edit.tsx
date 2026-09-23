"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
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
  ADMIN_REFRESH,
  copyShareUrl,
  EventCheckGrid,
  ResolutionSelect,
  ShareLinkField,
  type EventFolder,
  type Group,
  type Resolution,
} from "@/components/admin-ui";

export function AdminGroupEdit({ id }: { id: string }) {
  const router = useRouter();
  const [group, setGroup] = useState<Group | null>(null);
  const [events, setEvents] = useState<EventFolder[]>([]);
  const [missing, setMissing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [resolution, setResolution] = useState<Resolution>("orig");

  async function refresh() {
    const [groupsRes, eventsRes] = await Promise.all([
      fetch("/api/admin/groups"),
      fetch("/api/admin/events"),
    ]);
    if (!groupsRes.ok || !eventsRes.ok) throw new Error("Failed to load");
    const groupsJson = await groupsRes.json();
    const eventsJson = await eventsRes.json();
    const found = (groupsJson.groups as Group[]).find((item) => item.id === id);
    setEvents(eventsJson.events);
    setGroup(found ?? null);
    setMissing(!found);
    if (found) {
      setName(found.name);
      setResolution(found.max_download_resolution);
    }
  }

  useEffect(() => {
    void refresh().catch((err) => setMessage(String(err)));
    function onRefresh() {
      void refresh().catch((err) => setMessage(String(err)));
    }
    window.addEventListener(ADMIN_REFRESH, onRefresh);
    return () => window.removeEventListener(ADMIN_REFRESH, onRefresh);
  }, [id]);

  async function saveMeta(patch: {
    name?: string;
    maxDownloadResolution?: Resolution;
  }) {
    const res = await fetch("/api/admin/groups", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    });
    if (!res.ok) {
      setMessage("Could not save the group.");
      return;
    }
    await refresh();
  }

  async function saveEvents(eventPaths: string[]) {
    if (!group) return;
    setGroup({ ...group, eventPaths });
    const res = await fetch("/api/admin/groups", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, eventPaths }),
    });
    if (!res.ok) {
      setMessage("Could not save albums.");
      await refresh();
    }
  }

  async function roll() {
    const res = await fetch("/api/admin/groups", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, rollToken: true }),
    });
    if (!res.ok) {
      setMessage("Could not roll the group link.");
      return;
    }
    await refresh();
    setMessage("Group link rolled. The old link no longer works.");
  }

  async function remove() {
    await fetch(`/api/admin/groups?id=${id}`, { method: "DELETE" });
    router.push("/admin/groups");
  }

  if (missing) {
    return (
      <p className="text-sm text-stone-600">
        Group not found.{" "}
        <Link href="/admin/groups" className="underline">
          Back to groups
        </Link>
      </p>
    );
  }

  if (!group) {
    return <p className="text-sm text-stone-500">Loading group…</p>;
  }

  return (
    <div className="space-y-6">
      <Link href="/admin/groups" className="text-sm text-stone-500 hover:text-stone-800">
        All groups
      </Link>

      {message && (
        <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700">
          {message}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Edit group</CardTitle>
          <CardDescription>
            Name, download cap, share link, and the albums this group can see.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="edit-group-name">Name</Label>
              <Input
                id="edit-group-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => {
                  if (name.trim() && name !== group.name) {
                    void saveMeta({ name });
                  }
                }}
              />
            </div>
            <div className="grid gap-2">
              <Label>Max download</Label>
              <ResolutionSelect
                value={resolution}
                onChange={(value) => {
                  setResolution(value);
                  void saveMeta({ maxDownloadResolution: value });
                }}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Share link</Label>
            <ShareLinkField
              shareUrl={group.shareUrl}
              onCopy={() => void copyShareUrl(group.shareUrl, setMessage)}
              onRoll={() => void roll()}
            />
          </div>
          <Button variant="outline" onClick={() => void remove()}>
            Delete group
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Albums</CardTitle>
          <CardDescription>
            New folders from a scan start unassigned.
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
              selectedPaths={group.eventPaths}
              onChange={(next) => void saveEvents(next)}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
