"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  nsfw: number;
  watermark: number;
  shareUrl: string | null;
  shareExpiresAt: string | null;
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

export type FolderNode = {
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

export function folderTree(events: EventFolder[]): FolderNode[] {
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

const PREVIEW_PAGE = 50;

export function FolderThumbs({ eventPath }: { eventPath: string }) {
  const [photos, setPhotos] = useState<
    { relative_path: string; filename: string }[] | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [visible, setVisible] = useState(PREVIEW_PAGE);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setPhotos(null);
    setError(null);
    setVisible(PREVIEW_PAGE);
    fetch(`/api/admin/photos?event=${encodeURIComponent(eventPath)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Could not load photos");
        return res.json() as Promise<{
          photos: { relative_path: string; filename: string }[];
        }>;
      })
      .then((json) => {
        if (!cancelled) setPhotos(json.photos);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load photos");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [eventPath]);

  if (error) return <p className="text-sm text-stone-500">{error}</p>;
  if (!photos) return <p className="text-sm text-stone-500">Loading photos…</p>;
  if (photos.length === 0) {
    return <p className="text-sm text-stone-500">No photos in this folder.</p>;
  }

  const shown = photos.slice(0, visible);
  const total = photos.length;
  const hasMore = visible < total;

  function onScroll() {
    const el = scrollRef.current;
    if (!el || !hasMore) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 80) {
      setVisible((n) => Math.min(n + PREVIEW_PAGE, total));
    }
  }

  return (
    <div
      ref={scrollRef}
      className="max-h-[70vh] overflow-y-auto"
      onScroll={onScroll}
    >
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
        {shown.map((photo) => (
          <img
            key={photo.relative_path}
            src={`/api/media/thumb?path=${encodeURIComponent(photo.relative_path)}`}
            alt={photo.filename}
            loading="lazy"
            className="aspect-square w-full rounded-md bg-stone-100 object-cover"
          />
        ))}
      </div>
      {hasMore && (
        <p className="mt-3 text-xs text-stone-500">
          {shown.length} of {total}
        </p>
      )}
    </div>
  );
}

function FolderTree({
  nodes,
  selectedPaths,
  lockedPaths,
  onPreview,
  onChange,
}: {
  nodes: FolderNode[];
  selectedPaths: string[];
  lockedPaths: string[];
  onPreview: (event: EventFolder) => void;
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
              <div
                className={`flex items-center gap-2 rounded-md border border-stone-200 px-2 py-1 text-sm ${
                  locked ? "bg-stone-50 text-stone-500" : "hover:bg-stone-50"
                }`}
              >
                <label className="flex min-w-0 flex-1 items-center gap-2">
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
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onPreview(event)}
                >
                  Photos
                </Button>
              </div>
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
                  onPreview={onPreview}
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
  const [preview, setPreview] = useState<EventFolder | null>(null);

  return (
    <>
      <FolderTree
        nodes={folderTree(events)}
        selectedPaths={selectedPaths}
        lockedPaths={lockedPaths}
        onPreview={setPreview}
        onChange={onChange}
      />
      <Dialog open={preview !== null} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{preview?.relative_path || preview?.name}</DialogTitle>
          </DialogHeader>
          {preview && <FolderThumbs eventPath={preview.relative_path} />}
        </DialogContent>
      </Dialog>
    </>
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
