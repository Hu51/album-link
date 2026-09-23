"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
type Resolution = "full" | "2k" | "hd";

type Group = {
  id: string;
  name: string;
  max_download_resolution: Resolution;
  eventPaths: string[];
};

type Person = {
  id: string;
  name: string;
  max_download_resolution: Resolution;
  groupIds: string[];
};

type EventFolder = {
  relative_path: string;
  year: string;
  name: string;
  photo_count: number;
};

function ResolutionSelect({
  value,
  onChange,
}: {
  value: Resolution;
  onChange: (v: Resolution) => void;
}) {
  return (
    <select
      className="h-8 w-full rounded-lg border border-stone-300 bg-white px-2.5 text-sm"
      value={value}
      onChange={(e) => onChange(e.target.value as Resolution)}
    >
      <option value="full">Full (original)</option>
      <option value="2k">2K (≤ 2560px)</option>
      <option value="hd">HD (≤ 1920px)</option>
    </select>
  );
}

export function AdminDashboard() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [events, setEvents] = useState<EventFolder[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [lastToken, setLastToken] = useState<string | null>(null);

  const [groupName, setGroupName] = useState("");
  const [groupRes, setGroupRes] = useState<Resolution>("full");
  const [personName, setPersonName] = useState("");
  const [personRes, setPersonRes] = useState<Resolution>("full");
  const [personGroups, setPersonGroups] = useState<string[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");

  const selectedGroup = useMemo(
    () => groups.find((g) => g.id === selectedGroupId) || null,
    [groups, selectedGroupId],
  );

  const years = useMemo(
    () => Array.from(new Set(events.map((e) => e.year))).sort().reverse(),
    [events],
  );

  async function refresh() {
    const [gRes, pRes, eRes] = await Promise.all([
      fetch("/api/admin/groups"),
      fetch("/api/admin/people"),
      fetch("/api/admin/events"),
    ]);
    if (!gRes.ok || !pRes.ok || !eRes.ok) throw new Error("Failed to load");
    const gJson = await gRes.json();
    const pJson = await pRes.json();
    const eJson = await eRes.json();
    setGroups(gJson.groups);
    setPeople(pJson.people);
    setEvents(eJson.events);
    if (!selectedGroupId && gJson.groups[0]) {
      setSelectedGroupId(gJson.groups[0].id);
    }
  }

  useEffect(() => {
    void refresh().catch((err) => setMessage(String(err)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runScan() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/scan", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Scan failed");
      setMessage(
        `Scan done: ${json.eventsFound} events, ${json.photosFound} photos` +
          (json.eventsMissing || json.photosMissing
            ? ` (${json.eventsMissing} events / ${json.photosMissing} photos missing from disk)`
            : ""),
      );
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setBusy(false);
    }
  }

  async function addGroup() {
    if (!groupName.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: groupName,
          maxDownloadResolution: groupRes,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Create failed");
      setLastToken(json.shareUrl);
      setGroupName("");
      await refresh();
      setSelectedGroupId(json.id);
      setMessage(`Group created. Share link ready below.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function addPerson() {
    if (!personName.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/people", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: personName,
          maxDownloadResolution: personRes,
          groupIds: personGroups,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Create failed");
      setLastToken(json.shareUrl);
      setPersonName("");
      setPersonGroups([]);
      await refresh();
      setMessage(`Person created. Share link ready below.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveGroupEvents(eventPaths: string[]) {
    if (!selectedGroup) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/groups", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedGroup.id, eventPaths }),
      });
      if (!res.ok) throw new Error("Save failed");
      await refresh();
      setMessage("Assignments saved.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function updateGroupMeta(patch: {
    name?: string;
    maxDownloadResolution?: Resolution;
  }) {
    if (!selectedGroup) return;
    await fetch("/api/admin/groups", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: selectedGroup.id, ...patch }),
    });
    await refresh();
  }

  async function rollSelectedGroup() {
    if (!selectedGroup) return;
    const res = await fetch("/api/admin/groups", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: selectedGroup.id, rollToken: true }),
    });
    const json = await res.json();
    setLastToken(json.shareUrl);
    setMessage("Group token rolled. Old link no longer works.");
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/admin";
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-stone-500">
            Album Link
          </p>
          <h1 className="mt-1 font-heading text-4xl text-stone-900">Admin</h1>
          <p className="mt-2 max-w-xl text-stone-600">
            Scan your Photos folders, assign events to groups, and hand out
            revocable links. Files stay on disk.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => void runScan()} disabled={busy}>
            Scan now
          </Button>
          <Button variant="outline" onClick={() => void logout()}>
            Log out
          </Button>
        </div>
      </header>

      {message && (
        <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700">
          {message}
        </div>
      )}

      {lastToken && (
        <Card>
          <CardHeader>
            <CardTitle>Latest share link</CardTitle>
            <CardDescription>
              Copy this now — the plain token is only shown after create or roll.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 sm:flex-row">
            <Input readOnly value={lastToken} className="font-mono text-sm" />
            <Button
              type="button"
              onClick={() => void navigator.clipboard.writeText(lastToken)}
            >
              Copy
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Groups</CardTitle>
            <CardDescription>
              One link per group chat. Cap download resolution for that link.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              <div className="grid gap-2">
                <Label htmlFor="group-name">Name</Label>
                <Input
                  id="group-name"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="Family"
                />
              </div>
              <div className="grid gap-2">
                <Label>Max download</Label>
                <ResolutionSelect value={groupRes} onChange={setGroupRes} />
              </div>
              <Button onClick={() => void addGroup()} disabled={busy}>
                Create group
              </Button>
            </div>
            <Separator />
            <ul className="space-y-2">
              {groups.map((g) => (
                <li key={g.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedGroupId(g.id)}
                    className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition ${
                      selectedGroupId === g.id
                        ? "border-stone-900 bg-stone-900 text-stone-50"
                        : "border-stone-200 hover:bg-stone-50"
                    }`}
                  >
                    <span>{g.name}</span>
                    <Badge variant="secondary">{g.max_download_resolution}</Badge>
                  </button>
                </li>
              ))}
              {groups.length === 0 && (
                <p className="text-sm text-stone-500">No groups yet.</p>
              )}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>People</CardTitle>
            <CardDescription>
              Personal link shows the union of their groups, with their own
              download cap.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              <div className="grid gap-2">
                <Label htmlFor="person-name">Name</Label>
                <Input
                  id="person-name"
                  value={personName}
                  onChange={(e) => setPersonName(e.target.value)}
                  placeholder="Alex"
                />
              </div>
              <div className="grid gap-2">
                <Label>Max download</Label>
                <ResolutionSelect value={personRes} onChange={setPersonRes} />
              </div>
              <div className="grid gap-2">
                <Label>Groups</Label>
                <div className="max-h-40 space-y-2 overflow-auto rounded-md border border-stone-200 p-3">
                  {groups.map((g) => {
                    const checked = personGroups.includes(g.id);
                    return (
                      <label
                        key={g.id}
                        className="flex items-center gap-2 text-sm"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => {
                            setPersonGroups((prev) =>
                              v
                                ? [...prev, g.id]
                                : prev.filter((id) => id !== g.id),
                            );
                          }}
                        />
                        {g.name}
                      </label>
                    );
                  })}
                  {groups.length === 0 && (
                    <p className="text-sm text-stone-500">Create a group first.</p>
                  )}
                </div>
              </div>
              <Button onClick={() => void addPerson()} disabled={busy}>
                Create person
              </Button>
            </div>
            <Separator />
            <ul className="space-y-3">
              {people.map((p) => (
                <li
                  key={p.id}
                  className="rounded-md border border-stone-200 px-3 py-2 text-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{p.name}</span>
                    <Badge variant="secondary">
                      {p.max_download_resolution}
                    </Badge>
                  </div>
                  <p className="mt-1 text-stone-500">
                    {p.groupIds
                      .map((id) => groups.find((g) => g.id === id)?.name || id)
                      .join(", ") || "No groups"}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        const res = await fetch("/api/admin/people", {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ id: p.id, rollToken: true }),
                        });
                        const json = await res.json();
                        setLastToken(json.shareUrl);
                        setMessage("Person token rolled.");
                      }}
                    >
                      Roll token
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        await fetch(`/api/admin/people?id=${p.id}`, {
                          method: "DELETE",
                        });
                        await refresh();
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </li>
              ))}
              {people.length === 0 && (
                <p className="text-sm text-stone-500">No people yet.</p>
              )}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Assign events to a group</CardTitle>
          <CardDescription>
            New folders from a scan start unassigned. Check the events this group
            may see.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!selectedGroup && (
            <p className="text-sm text-stone-500">Select or create a group.</p>
          )}
          {selectedGroup && (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="grid gap-2 sm:col-span-1">
                  <Label>Selected group</Label>
                  <Input
                    defaultValue={selectedGroup.name}
                    key={selectedGroup.id + "-name"}
                    onBlur={(e) =>
                      void updateGroupMeta({ name: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Max download</Label>
                  <ResolutionSelect
                    value={selectedGroup.max_download_resolution}
                    onChange={(v) =>
                      void updateGroupMeta({ maxDownloadResolution: v })
                    }
                  />
                </div>
                <div className="flex items-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => void rollSelectedGroup()}
                  >
                    Roll group token
                  </Button>
                  <Button
                    variant="outline"
                    onClick={async () => {
                      await fetch(`/api/admin/groups?id=${selectedGroup.id}`, {
                        method: "DELETE",
                      });
                      setSelectedGroupId("");
                      await refresh();
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </div>

              {events.length === 0 ? (
                <p className="text-sm text-stone-500">
                  No event folders indexed yet. Click Scan now.
                </p>
              ) : (
                <div className="space-y-6">
                  {years.map((year) => (
                    <div key={year}>
                      <h3 className="mb-2 font-heading text-lg text-stone-800">
                        {year}
                      </h3>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {events
                          .filter((e) => e.year === year)
                          .map((event) => {
                            const checked = selectedGroup.eventPaths.includes(
                              event.relative_path,
                            );
                            return (
                              <label
                                key={event.relative_path}
                                className="flex items-start gap-3 rounded-md border border-stone-200 px-3 py-2 text-sm hover:bg-stone-50"
                              >
                                <Checkbox
                                  className="mt-0.5"
                                  checked={checked}
                                  onCheckedChange={(v) => {
                                    const next = v
                                      ? [
                                          ...selectedGroup.eventPaths,
                                          event.relative_path,
                                        ]
                                      : selectedGroup.eventPaths.filter(
                                          (p) => p !== event.relative_path,
                                        );
                                    void saveGroupEvents(next);
                                  }}
                                />
                                <span>
                                  <span className="font-medium">
                                    {event.name}
                                  </span>
                                  <span className="mt-0.5 block text-stone-500">
                                    {event.photo_count} photos ·{" "}
                                    {event.relative_path}
                                  </span>
                                </span>
                              </label>
                            );
                          })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
