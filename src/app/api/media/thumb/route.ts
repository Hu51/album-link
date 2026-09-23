import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { getThumbnail } from "@/lib/media";
import { resolveShareToken, shareCanAccessPhoto } from "@/lib/shares";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const photoPath = searchParams.get("path");
  const token = searchParams.get("token");

  if (!photoPath) {
    return NextResponse.json({ error: "Missing path" }, { status: 400 });
  }

  const admin = await isAdminAuthenticated();
  if (!admin) {
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const share = resolveShareToken(token);
    if (!share || !shareCanAccessPhoto(share, photoPath)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  try {
    const { buffer, contentType } = await getThumbnail(photoPath);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
