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
  eventPaths: string[];
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

type FolderNode = {
  name: string;
  path: string;
  event?: EventFolder;
  children: FolderNode[];
};

type BuildNode = {
  name: string;
  path: string;
  event?: EventFolder;
  children: Map<string, BuildNode>;
};

function compareFolderName(a: string, b: string) {
  return a.localeCompare(b, undefined, { sensitivity: "base" });
}

function folderTree(events: EventFolder[]): FolderNode[] {
  const roots = new Map<string, BuildNode>();

  for (const event of events) {
    const parts = event.relative_path ? event.relative_path.split("/") : [event.name];
    let siblings = roots;
    let path = "";
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      path = path ? `${path}/${part}` : part;
      let node = siblings.get(part);
      if (!node) {
        node = { name: part, path, children: new Map() };
        siblings.set(part, node);
      }
      if (i === parts.length - 1) node.event = event;
      siblings = node.children;
    }
  }

  function toSorted(nodes: Map<string, BuildNode>): FolderNode[] {
    return [...nodes.values()]
      .sort((a, b) => compareFolderName(a.name, b.name))
      .map((node) => ({
        name: node.name,
        path: node.path,
        event: node.event,
        children: toSorted(node.children),
      }));
  }

  return toSorted(roots);
}

function FolderTree({
  nodes,
  selectedPaths,
  lockedPaths,
  onChange,
}: {
  nodes: FolderNode[];
  selectedPaths: string[];
  lockedPaths: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="space-y-1">
      {nodes.map((node) => {
        const event = node.event;
        const locked = event ? lockedPaths.includes(event.relative_path) : false;
        const checked = event
          ? locked || selectedPaths.includes(event.relative_path)
          : false;
        return (
          <div key={node.path}>
            {event ? (
              <label
                className={`flex items-center gap-2 rounded-md border border-stone-200 px-2 py-1 text-sm ${
                  locked ? "bg-stone-50 text-stone-500" : "hover:bg-stone-50"
                }`}
                title={
                  locked
                    ? `Included by a group · ${event.photo_count} photos · ${event.relative_path || event.name}`
                    : `${event.photo_count} photos · ${event.relative_path || event.name}`
                }
              >
                <Checkbox
                  checked={checked}
                  disabled={locked}
                  onCheckedChange={(v) => {
                    if (locked) return;
                    const next = v
                      ? [...selectedPaths, event.relative_path]
                      : selectedPaths.filter((p) => p !== event.relative_path);
                    onChange(next);
                  }}
                />
                <span className="min-w-0 flex-1 break-all">{node.name}</span>
                <span className="shrink-0 text-xs text-stone-400">
                  {event.photo_count}
                </span>
              </label>
            ) : (
              <div className="px-2 py-1 text-sm font-medium text-stone-500">
                {node.name}
              </div>
            )}
            {node.children.length > 0 && (
              <div className="mt-1 ml-4 border-l border-stone-200 pl-2">
                <FolderTree
                  nodes={node.children}
                  selectedPaths={selectedPaths}
                  lockedPaths={lockedPaths}
                  onChange={onChange}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function EventCheckGrid({
  events,
  selectedPaths,
  lockedPaths = [],
  onChange,
}: {
  events: EventFolder[];
  selectedPaths: string[];
  lockedPaths?: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <FolderTree
      nodes={folderTree(events)}
      selectedPaths={selectedPaths}
      lockedPaths={lockedPaths}
      onChange={onChange}
    />
  );
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
