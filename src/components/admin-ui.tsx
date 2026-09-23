"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

export type Resolution = "orig" | "2000px" | "1000px";

export type Group = {
  id: string;
  name: string;
  max_download_resolution: Resolution;
  eventPaths: string[];
  shareUrl: string | null;
};

export type Person = {
  id: string;
  name: string;
  max_download_resolution: Resolution;
  groupIds: string[];
  shareUrl: string | null;
};

export type EventFolder = {
  relative_path: string;
  year: string;
  name: string;
  photo_count: number;
};

export const ADMIN_REFRESH = "album-admin-refresh";

export function ResolutionSelect({
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
      <option value="orig">orig (original file)</option>
      <option value="2000px">2000px</option>
      <option value="1000px">1000px</option>
    </select>
  );
}

export function ShareLinkField({
  shareUrl,
  onCopy,
  onRoll,
}: {
  shareUrl: string | null;
  onCopy: () => void;
  onRoll?: () => void;
}) {
  return (
    <div className="flex gap-1">
      <Input
        readOnly
        value={shareUrl ?? ""}
        placeholder="Roll to issue a link"
        className="h-8 font-mono text-xs"
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={!shareUrl}
        onClick={onCopy}
      >
        Copy
      </Button>
      {onRoll && (
        <Button type="button" size="sm" variant="outline" onClick={onRoll}>
          Roll
        </Button>
      )}
    </div>
  );
}

export function EventCheckGrid({
  events,
  selectedPaths,
  onChange,
}: {
  events: EventFolder[];
  selectedPaths: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-4">
      {events.map((event) => {
        const checked = selectedPaths.includes(event.relative_path);
        return (
          <label
            key={event.relative_path}
            className="flex items-center gap-2 rounded-md border border-stone-200 px-2 py-1 text-sm hover:bg-stone-50"
            title={`${event.photo_count} photos · ${event.relative_path}`}
          >
            <Checkbox
              checked={checked}
              onCheckedChange={(v) => {
                const next = v
                  ? [...selectedPaths, event.relative_path]
                  : selectedPaths.filter((p) => p !== event.relative_path);
                onChange(next);
              }}
            />
            <span className="min-w-0 flex-1 truncate">{event.name}</span>
            <span className="shrink-0 text-xs text-stone-400">
              {event.photo_count}
            </span>
          </label>
        );
      })}
    </div>
  );
}

export function groupEventSections(events: EventFolder[]) {
  const byYear = new Map<string, EventFolder[]>();
  for (const event of events) {
    const list = byYear.get(event.year) ?? [];
    list.push(event);
    byYear.set(event.year, list);
  }

  const loose: EventFolder[] = [];
  const grouped: { year: string; items: EventFolder[] }[] = [];
  for (const [year, items] of byYear) {
    items.sort((a, b) => a.name.localeCompare(b.name));
    const repeatsName = items.length === 1 && items[0].name === year;
    if (repeatsName) loose.push(items[0]);
    else grouped.push({ year, items });
  }
  loose.sort((a, b) => a.name.localeCompare(b.name));
  grouped.sort((a, b) => b.year.localeCompare(a.year));
  return { loose, grouped };
}

export async function copyShareUrl(
  shareUrl: string | null,
  setMessage: (message: string) => void,
) {
  if (!shareUrl) return;
  try {
    await navigator.clipboard.writeText(shareUrl);
    setMessage("Link copied.");
  } catch {
    setMessage("Select the link and copy it.");
  }
}
