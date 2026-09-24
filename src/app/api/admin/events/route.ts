import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdminAuthenticated } from "@/lib/auth";
import {
  listEvents,
  listGroupEventPaths,
  listGroups,
  rollEventToken,
  setEventNsfw,
  setEventWatermark,
  shareUrlFor,
} from "@/lib/admin-data";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const events = listEvents().map((event) => ({
    relative_path: event.relative_path,
    year: event.year,
    name: event.name,
    photo_count: event.photo_count,
    nsfw: event.nsfw,
    watermark: event.watermark,
    shareUrl: shareUrlFor(event.share_token),
    shareExpiresAt: event.share_expires_at,
  }));
  const groups = listGroups().map((g) => ({
    id: g.id,
    name: g.name,
    eventPaths: listGroupEventPaths(g.id),
  }));
  return NextResponse.json({ events, groups });
}

export async function PATCH(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = z
    .object({
      path: z.string(),
      nsfw: z.boolean().optional(),
      watermark: z.boolean().optional(),
      rollToken: z.boolean().optional(),
    })
    .parse(await request.json());

  if (body.rollToken) {
    return NextResponse.json(rollEventToken(body.path));
  }
  if (body.nsfw !== undefined) setEventNsfw(body.path, body.nsfw);
  if (body.watermark !== undefined) setEventWatermark(body.path, body.watermark);
  return NextResponse.json({ ok: true });
}
