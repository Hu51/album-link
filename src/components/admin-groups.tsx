"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
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
  copyShareUrl,
  ResolutionSelect,
  type Group,
  type Resolution,
} from "@/components/admin-ui";

export function AdminGroups() {
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [resolution, setResolution] = useState<Resolution>("full");

  async function refresh() {
    const res = await fetch("/api/admin/groups");
    if (!res.ok) throw new Error("Failed to load groups");
    const json = await res.json();
    setGroups(json.groups);
  }

  useEffect(() => {
    void refresh().catch((err) => setMessage(String(err)));
  }, []);

  async function addGroup() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, maxDownloadResolution: resolution }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Create failed");
      router.push(`/admin/groups/${json.id}`);
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
          <CardTitle>New group</CardTitle>
          <CardDescription>
            One link per group chat. Cap download resolution for that link.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-[1fr_12rem_auto] sm:items-end">
          <div className="grid gap-2">
            <Label htmlFor="group-name">Name</Label>
            <Input
              id="group-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Family"
            />
          </div>
          <div className="grid gap-2">
            <Label>Max download</Label>
            <ResolutionSelect value={resolution} onChange={setResolution} />
          </div>
          <Button onClick={() => void addGroup()} disabled={busy}>
            Create group
          </Button>
        </CardContent>
      </Card>

      <ul className="space-y-2">
        {groups.map((group) => (
          <li
            key={group.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-stone-200 bg-white/70 px-3 py-2"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium">{group.name}</span>
                <Badge variant="secondary">
                  {group.max_download_resolution}
                </Badge>
              </div>
              <p className="mt-1 truncate font-mono text-xs text-stone-500">
                {group.shareUrl || "No link yet"}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={!group.shareUrl}
                onClick={() => void copyShareUrl(group.shareUrl, setMessage)}
              >
                Copy
              </Button>
              <Link
                href={`/admin/groups/${group.id}`}
                className="inline-flex h-7 items-center rounded-lg bg-stone-900 px-2.5 text-sm text-stone-50"
              >
                Edit
              </Link>
            </div>
          </li>
        ))}
        {groups.length === 0 && (
          <p className="text-sm text-stone-500">No groups yet.</p>
        )}
      </ul>
    </div>
  );
}
