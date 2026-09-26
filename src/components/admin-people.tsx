"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
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
  ResolutionSelect,
  type Group,
  type Person,
  type Resolution,
} from "@/components/admin-ui";

export function AdminPeople() {
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [resolution, setResolution] = useState<Resolution>("full");
  const [groupIds, setGroupIds] = useState<string[]>([]);

  async function refresh() {
    const [groupsRes, peopleRes] = await Promise.all([
      fetch("/api/admin/groups"),
      fetch("/api/admin/people"),
    ]);
    if (!groupsRes.ok || !peopleRes.ok) throw new Error("Failed to load");
    const groupsJson = await groupsRes.json();
    const peopleJson = await peopleRes.json();
    setGroups(groupsJson.groups);
    setPeople(peopleJson.people);
  }

  useEffect(() => {
    void refresh().catch((err) => setMessage(String(err)));
  }, []);

  async function addPerson() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/people", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          maxDownloadResolution: resolution,
          groupIds,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Create failed");
      router.push(`/admin/people/${json.id}`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Create failed");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {message && (
        <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700">
          {message}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>New person</CardTitle>
          <CardDescription>
            A personal link shows the union of the groups you check.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="person-name">Name</Label>
              <Input
                id="person-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Alex"
              />
            </div>
            <div className="grid gap-2">
              <Label>Max download</Label>
              <ResolutionSelect value={resolution} onChange={setResolution} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Groups</Label>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {groups.map((group) => {
                const checked = groupIds.includes(group.id);
                return (
                  <label
                    key={group.id}
                    className="flex items-center gap-1.5 text-sm"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) => {
                        setGroupIds((prev) =>
                          v
                            ? [...prev, group.id]
                            : prev.filter((id) => id !== group.id),
                        );
                      }}
                    />
                    {group.name}
                  </label>
                );
              })}
              {groups.length === 0 && (
                <p className="text-sm text-stone-500">Create a group first.</p>
              )}
            </div>
          </div>
          <Button onClick={() => void addPerson()} disabled={busy} className="w-fit">
            Create person
          </Button>
        </CardContent>
      </Card>

      <ul className="space-y-2">
        {people.map((person) => (
          <li
            key={person.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-stone-200 bg-white/70 px-3 py-2"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium">{person.name}</span>
                <Badge variant="secondary">
                  {person.max_download_resolution}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-stone-500">
                {person.groupIds
                  .map((id) => groups.find((group) => group.id === id)?.name || id)
                  .join(", ") || "No groups"}
              </p>
              <p className="mt-1 truncate font-mono text-xs text-stone-500">
                {person.shareUrl || "No link yet"}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={!person.shareUrl}
                onClick={() => void copyShareUrl(person.shareUrl, setMessage)}
              >
                Copy
              </Button>
              <Link
                href={`/admin/people/${person.id}`}
                className="inline-flex h-7 items-center rounded-lg bg-stone-900 px-2.5 text-sm text-stone-50"
              >
                Edit
              </Link>
            </div>
          </li>
        ))}
        {people.length === 0 && (
          <p className="text-sm text-stone-500">No people yet.</p>
        )}
      </ul>
    </div>
  );
}
