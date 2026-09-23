"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ADMIN_REFRESH } from "@/components/admin-ui";

const links = [
  { href: "/admin/groups", label: "Groups" },
  { href: "/admin/people", label: "People" },
];

export function AdminShell({
  appName,
  children,
}: {
  appName: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function runScan() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/scan", { method: "POST" });
      const text = await res.text();
      let json: {
        error?: string;
        code?: string;
        stack?: string;
        photosRoot?: string;
        eventsFound?: number;
        photosFound?: number;
        eventsMissing?: number;
        photosMissing?: number;
      } = {};
      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        throw new Error(text || `Scan failed (${res.status})`);
      }
      if (!res.ok) {
        throw new Error(
          [json.error, json.code, json.stack].filter(Boolean).join("\n") ||
            text ||
            `Scan failed (${res.status})`,
        );
      }
      setMessage(
        `Scan done from ${json.photosRoot}: ${json.eventsFound} events, ${json.photosFound} photos` +
          (json.eventsMissing || json.photosMissing
            ? ` (${json.eventsMissing} events / ${json.photosMissing} photos missing from disk)`
            : ""),
      );
      window.dispatchEvent(new Event(ADMIN_REFRESH));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setBusy(false);
    }
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
            {appName}
          </p>
          <h1 className="mt-1 font-heading text-4xl text-stone-900">Admin</h1>
          <nav className="mt-4 flex gap-2">
            {links.map((link) => {
              const active =
                pathname === link.href || pathname.startsWith(`${link.href}/`);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`inline-flex h-8 items-center rounded-lg px-3 text-sm ${
                    active
                      ? "bg-stone-900 text-stone-50"
                      : "border border-stone-300 text-stone-700 hover:bg-white"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
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
        <div className="whitespace-pre-wrap rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700">
          {message}
        </div>
      )}

      {children}
    </div>
  );
}
