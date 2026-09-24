import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdminAuthenticated } from "@/lib/auth";
import {
  listEvents,
  listGroupEventPaths,
  listGroups,
  setEventNsfw,
} from "@/lib/admin-data";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const events = listEvents();
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
      nsfw: z.boolean(),
    })
    .parse(await request.json());
  setEventNsfw(body.path, body.nsfw);
  return NextResponse.json({ ok: true });
}
