"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

type EventFolder = {
  relative_path: string;
  year: string;
  name: string;
  photo_count: number;
  cover_path: string | null;
  nsfw: number;
};

type Photo = {
  relative_path: string;
  filename: string;
};

type Props = {
  appName: string;
  token: string;
  shareName: string;
  shareExpiresAt: string | null;
  kind: "group" | "person" | "folder";
  maxDownloadResolution: "orig" | "2000px" | "1000px";
  events: EventFolder[];
};

export function ShareGallery({
  appName,
  token,
  shareName,
  shareExpiresAt,
  kind,
  maxDownloadResolution,
  events,
}: Props) {
  const [activeYear, setActiveYear] = useState<string | null>(null);
  const [activeEvent, setActiveEvent] = useState<EventFolder | null>(() => {
    if (kind !== "folder" || events.length !== 1) return null;
    return events[0].nsfw === 1 ? null : events[0];
  });
  const [pendingNsfw, setPendingNsfw] = useState<EventFolder | null>(() => {
    if (kind !== "folder" || events.length !== 1) return null;
    return events[0].nsfw === 1 ? events[0] : null;
  });
  const [revealed, setRevealed] = useState<string[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const yearGroups = useMemo(() => {
    const map = new Map<string, EventFolder[]>();
    for (const event of events) {
      const list = map.get(event.year) || [];
      list.push(event);
      map.set(event.year, list);
    }
    return Array.from(map.entries())
      .map(([year, yearEvents]) => ({
        year,
        events: yearEvents,
        photoCount: yearEvents.reduce((sum, event) => sum + event.photo_count, 0),
        coverPath:
          yearEvents.find((event) => event.cover_path && event.nsfw !== 1)
            ?.cover_path ||
          yearEvents.find((event) => event.cover_path)?.cover_path ||
          null,
        hasNsfw: yearEvents.some((event) => event.nsfw === 1),
      }))
      .sort((a, b) => a.year.localeCompare(b.year, undefined, { sensitivity: "base" }));
  }, [events]);

  const yearAlbums = useMemo(() => {
    if (!activeYear) return [];
    return yearGroups.find((group) => group.year === activeYear)?.events ?? [];
  }, [activeYear, yearGroups]);

  useEffect(() => {
    if (kind === "folder") return;
    if (yearGroups.length === 1 && !activeYear) {
      setActiveYear(yearGroups[0].year);
    }
  }, [kind, yearGroups, activeYear]);

  useEffect(() => {
    if (!activeEvent) return;
    let cancelled = false;
    setLoadingPhotos(true);
    setError(null);
    void fetch(
      `/api/share/photos?token=${encodeURIComponent(token)}&event=${encodeURIComponent(activeEvent.relative_path)}`,
    )
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load photos");
        if (!cancelled) setPhotos(json.photos);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Error");
      })
      .finally(() => {
        if (!cancelled) setLoadingPhotos(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeEvent, token]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (lightboxIndex === null) return;
      if (e.key === "Escape") setLightboxIndex(null);
      if (e.key === "ArrowRight") {
        setLightboxIndex((i) =>
          i === null ? null : Math.min(photos.length - 1, i + 1),
        );
      }
      if (e.key === "ArrowLeft") {
        setLightboxIndex((i) => (i === null ? null : Math.max(0, i - 1)));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxIndex, photos.length]);

  useEffect(() => {
    if (lightboxIndex === null) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [lightboxIndex]);

  const thumbUrl = (path: string) =>
    `/api/media/thumb?path=${encodeURIComponent(path)}&token=${encodeURIComponent(token)}`;
  const fileUrl = (path: string, download = false) =>
    `/api/media/file?path=${encodeURIComponent(path)}&token=${encodeURIComponent(token)}${download ? "&download=1" : ""}`;

  return (
    <div className="min-h-screen bg-[#0c0b0a] text-[#f4efe6]">
      <header className="border-b border-white/10 bg-[#12100e]/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-[#c4a574]">
              {appName}
            </p>
            <h1 className="mt-2 font-heading text-3xl tracking-tight sm:text-4xl">
              {shareName}
            </h1>
            <p className="mt-2 text-sm text-[#b7aea0]">
              {kind === "group"
                ? "Group link"
                : kind === "person"
                  ? "Personal link"
                  : "Album link"}{" "}
              · downloads up to {maxDownloadResolution}
              {shareExpiresAt && (
                <>
                  {" "}
                  · valid until{" "}
                  {new Date(shareExpiresAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    timeZone: "UTC",
                  })}
                </>
              )}
            </p>
          </div>
          {kind !== "folder" && (activeEvent || (activeYear && yearGroups.length > 1)) && (
            <Button
              variant="outline"
              className="border-white/20 bg-transparent text-[#f4efe6] hover:bg-white/10"
              onClick={() => {
                if (activeEvent) {
                  setActiveEvent(null);
                  setPhotos([]);
                  setLightboxIndex(null);
                  return;
                }
                setActiveYear(null);
              }}
            >
              {activeEvent ? "All albums" : "All folders"}
            </Button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {!activeEvent && events.length === 0 && (
          <div className="rounded-xl border border-white/10 bg-white/5 px-6 py-16 text-center">
            <h2 className="font-heading text-2xl">No albums yet</h2>
            <p className="mt-2 text-[#b7aea0]">
              This link has no visible folders assigned.
            </p>
          </div>
        )}

        {!activeEvent && kind !== "folder" && !activeYear && (
          <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {yearGroups.map((group, index) => (
              <button
                key={group.year}
                type="button"
                onClick={() => setActiveYear(group.year)}
                className="group overflow-hidden rounded-xl border border-white/10 bg-[#171411] text-left transition duration-300 hover:-translate-y-0.5 hover:border-[#c4a574]/50"
                style={{ animationDelay: `${index * 40}ms` }}
              >
                <div className="relative aspect-square overflow-hidden bg-[#1e1a16]">
                  {group.coverPath ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumbUrl(group.coverPath)}
                      alt=""
                      className={`h-full w-full object-cover transition duration-500 ${
                        group.hasNsfw
                          ? "scale-125 blur-2xl"
                          : "group-hover:scale-[1.03]"
                      }`}
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-[#8d8376]">
                      Empty folder
                    </div>
                  )}
                </div>
                <div className="px-3 py-2.5">
                  <h3 className="truncate font-medium text-[#f4efe6]">
                    {group.year}
                  </h3>
                  <p className="mt-0.5 text-sm text-[#9d9385]">
                    {group.events.length}{" "}
                    {group.events.length === 1 ? "album" : "albums"} ·{" "}
                    {group.photoCount} photos
                  </p>
                </div>
              </button>
            ))}
          </section>
        )}

        {!activeEvent && activeYear && (
          <section>
            <h2 className="mb-5 font-heading text-2xl text-[#efe6d8]">
              {activeYear}
            </h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {yearAlbums.map((folder, index) => {
                const nsfw = folder.nsfw === 1;
                const hidden =
                  nsfw && !revealed.includes(folder.relative_path);
                return (
                  <button
                    key={folder.relative_path}
                    type="button"
                    onClick={() => {
                      if (hidden) setPendingNsfw(folder);
                      else setActiveEvent(folder);
                    }}
                    className="group overflow-hidden rounded-xl border border-white/10 bg-[#171411] text-left transition duration-300 hover:-translate-y-0.5 hover:border-[#c4a574]/50"
                    style={{ animationDelay: `${index * 40}ms` }}
                  >
                    <div className="relative aspect-square overflow-hidden bg-[#1e1a16]">
                      {folder.cover_path ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={thumbUrl(folder.cover_path)}
                          alt=""
                          className={`h-full w-full object-cover transition duration-500 ${
                            nsfw
                              ? "scale-125 blur-2xl"
                              : "group-hover:scale-[1.03]"
                          }`}
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-sm text-[#8d8376]">
                          Empty album
                        </div>
                      )}
                      {nsfw && (
                        <span className="absolute inset-0 flex items-center justify-center text-xs font-medium tracking-[0.2em] text-white/90">
                          Sensitive album
                        </span>
                      )}
                    </div>
                    <div className="px-3 py-2.5">
                      <h3 className="truncate font-medium text-[#f4efe6]">
                        {folder.name}
                      </h3>
                      <p className="mt-0.5 text-sm text-[#9d9385]">
                        {folder.photo_count} photos
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {activeEvent && (
          <section>
            <div className="mb-6">
              <p className="text-sm text-[#9d9385]">{activeEvent.year}</p>
              <h2 className="font-heading text-3xl">{activeEvent.name}</h2>
            </div>
            {loadingPhotos && (
              <p className="text-[#b7aea0]">Loading photos…</p>
            )}
            {error && <p className="text-red-300">{error}</p>}
            {!loadingPhotos && photos.length === 0 && !error && (
              <p className="text-[#b7aea0]">No photos in this folder.</p>
            )}
            <div className="columns-2 gap-3 sm:columns-3 lg:columns-4">
              {photos.map((photo, index) => (
                <button
                  key={photo.relative_path}
                  type="button"
                  className="mb-3 block w-full overflow-hidden rounded-lg focus:outline-none focus:ring-2 focus:ring-[#c4a574]"
                  onClick={() => setLightboxIndex(index)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={thumbUrl(photo.relative_path)}
                    alt={photo.filename}
                    className="w-full object-cover transition duration-300 hover:brightness-110"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          </section>
        )}
      </main>

      {pendingNsfw && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm rounded-xl border border-white/15 bg-[#171411] px-5 py-5 text-center">
            <p className="text-xs uppercase tracking-[0.2em] text-[#c4a574]">
              NSFW
            </p>
            <h2 className="mt-2 font-heading text-2xl">{pendingNsfw.name}</h2>
            <p className="mt-2 text-sm text-[#b7aea0]">
              This album is marked sensitive. Show the photos?
            </p>
            <div className="mt-5 flex justify-center gap-2">
              <Button
                variant="outline"
                className="border-white/20 bg-transparent text-[#f4efe6] hover:bg-white/10"
                onClick={() => setPendingNsfw(null)}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  setRevealed((paths) =>
                    paths.includes(pendingNsfw.relative_path)
                      ? paths
                      : [...paths, pendingNsfw.relative_path],
                  );
                  setActiveEvent(pendingNsfw);
                  setPendingNsfw(null);
                }}
              >
                Show photos
              </Button>
            </div>
          </div>
        </div>
      )}

      {lightboxIndex !== null && photos[lightboxIndex] && (
        <div
          className="fixed inset-0 z-50 flex h-dvh max-h-dvh flex-col overflow-hidden bg-black"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
            <p className="truncate text-sm text-[#d8cfc1]">
              {photos[lightboxIndex].filename}
            </p>
            <div className="flex shrink-0 gap-2">
              <a
                href={fileUrl(photos[lightboxIndex].relative_path, true)}
                className="inline-flex h-8 items-center rounded-lg border border-white/20 px-2.5 text-sm hover:bg-white hover:text-black"
              >
                Download
              </a>
              <Button
                variant="outline"
                className="border-white/20 bg-transparent text-white/70 hover:bg-white hover:text-black"
                onClick={() => setLightboxIndex(null)}
              >
                Close
              </Button>
            </div>
          </div>
          <div className="relative min-h-0 flex-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={fileUrl(photos[lightboxIndex].relative_path)}
              alt={photos[lightboxIndex].filename}
              className="absolute inset-0 m-auto h-full w-full object-contain px-16 py-3 sm:px-24"
            />
            {lightboxIndex > 0 && (
              <button
                type="button"
                aria-label="Previous photo"
                className="absolute top-1/2 left-3 z-10 flex h-[2.1rem] w-[2.1rem] -translate-y-1/2 items-center justify-center rounded-full border border-white/40 bg-black/45 text-white/70 opacity-60 hover:text-white shadow-lg hover:opacity-100 sm:left-5 sm:h-[2.4rem] sm:w-[2.4rem]"
                onClick={() => setLightboxIndex((i) => (i === null ? null : i - 1))}
              >
                <ChevronLeft className="h-[1.2rem] w-[1.2rem] sm:h-[1.35rem] sm:w-[1.35rem]" strokeWidth={4} />
              </button>
            )}
            {lightboxIndex < photos.length - 1 && (
              <button
                type="button"
                aria-label="Next photo"
                className="absolute top-1/2 right-3 z-10 flex h-[2.1rem] w-[2.1rem] -translate-y-1/2 items-center justify-center rounded-full border border-white/40 bg-black/45 text-white/70 opacity-60 hover:text-white shadow-lg hover:opacity-100 sm:right-5 sm:h-[2.4rem] sm:w-[2.4rem]"
                onClick={() => setLightboxIndex((i) => (i === null ? null : i + 1))}
              >
                <ChevronRight className="h-[1.2rem] w-[1.2rem] sm:h-[1.35rem] sm:w-[1.35rem]" strokeWidth={4} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
