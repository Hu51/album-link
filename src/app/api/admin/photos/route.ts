import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { listPhotosForEvent } from "@/lib/admin-data";

export async function GET(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const event = new URL(request.url).searchParams.get("event");
  if (event === null) {
    return NextResponse.json({ error: "Missing event" }, { status: 400 });
  }
  return NextResponse.json({ photos: listPhotosForEvent(event) });
}
