import { NextResponse } from "next/server";
import { listPhotosForEvent } from "@/lib/admin-data";
import { resolveShareToken, shareCanAccessEvent } from "@/lib/shares";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  const eventPath = searchParams.get("event");

  if (!token || !eventPath) {
    return NextResponse.json({ error: "Missing token or event" }, { status: 400 });
  }

  const share = resolveShareToken(token);
  if (!share || !shareCanAccessEvent(share, eventPath)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const photos = listPhotosForEvent(eventPath);
  return NextResponse.json({
    shareName: share.name,
    maxDownloadResolution: share.maxDownloadResolution,
    photos,
  });
}
