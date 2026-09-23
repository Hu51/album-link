import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { scanPhotos } from "@/lib/scan";

export async function POST() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = scanPhotos();
  return NextResponse.json(result);
}
