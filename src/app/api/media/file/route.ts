import { NextResponse } from "next/server";
import type { DownloadResolution } from "@/lib/config";
import { isAdminAuthenticated } from "@/lib/auth";
import { getMediaFile } from "@/lib/media";
import { resolveShareToken, shareCanAccessPhoto } from "@/lib/shares";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const photoPath = searchParams.get("path");
  const token = searchParams.get("token");
  const disposition =
    searchParams.get("download") === "1" ? "attachment" : "inline";

  if (!photoPath) {
    return NextResponse.json({ error: "Missing path" }, { status: 400 });
  }

  let resolution: DownloadResolution = "orig";
  const admin = await isAdminAuthenticated();

  if (!admin) {
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const share = resolveShareToken(token);
    if (!share || !shareCanAccessPhoto(share, photoPath)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    resolution = share.maxDownloadResolution;
  }

  try {
    const file = await getMediaFile(photoPath, resolution, disposition);
    const headers = new Headers({
      "Content-Type": file.contentType,
      "Cache-Control": "private, max-age=3600",
    });
    if (disposition === "attachment") {
      headers.set(
        "Content-Disposition",
        `attachment; filename="${file.filename.replace(/"/g, "")}"`,
      );
    } else {
      headers.set(
        "Content-Disposition",
        `inline; filename="${file.filename.replace(/"/g, "")}"`,
      );
    }
    return new NextResponse(new Uint8Array(file.buffer), { headers });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
