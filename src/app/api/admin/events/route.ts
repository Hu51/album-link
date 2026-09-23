import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { listEvents, listGroupEventPaths, listGroups } from "@/lib/admin-data";

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
