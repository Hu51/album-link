import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { scanPhotos } from "@/lib/scan";

export const dynamic = "force-dynamic";

function scanError(err: unknown) {
  const error = err instanceof Error ? err : new Error(String(err));
  const code =
    err && typeof err === "object" && "code" in err
      ? String((err as { code?: unknown }).code ?? "")
      : undefined;
  return {
    error: error.message,
    name: error.name,
    code: code || undefined,
    stack: error.stack,
  };
}

export async function POST() {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(scanPhotos());
  } catch (err) {
    console.error("scan failed:", err);
    const body = scanError(err);
    return new Response(JSON.stringify(body, null, 2), {
      status: 500,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  }
}
