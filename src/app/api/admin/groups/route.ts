import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdminAuthenticated } from "@/lib/auth";
import {
  createGroup,
  deleteGroup,
  listGroupEventPaths,
  listGroups,
  rollGroupToken,
  setGroupEvents,
  updateGroup,
} from "@/lib/admin-data";

const resolutionSchema = z.enum(["full", "2k", "hd"]);

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const groups = listGroups().map((g) => ({
    ...g,
    eventPaths: listGroupEventPaths(g.id),
  }));
  return NextResponse.json({ groups });
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = z
    .object({
      name: z.string().min(1),
      maxDownloadResolution: resolutionSchema.default("full"),
    })
    .parse(await request.json());
  try {
    const created = createGroup(body.name, body.maxDownloadResolution);
    return NextResponse.json(created);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = z
    .object({
      id: z.string(),
      name: z.string().min(1).optional(),
      maxDownloadResolution: resolutionSchema.optional(),
      eventPaths: z.array(z.string()).optional(),
      rollToken: z.boolean().optional(),
    })
    .parse(await request.json());

  if (body.rollToken) {
    const rolled = rollGroupToken(body.id);
    return NextResponse.json(rolled);
  }

  if (body.name !== undefined || body.maxDownloadResolution !== undefined) {
    const current = listGroups().find((g) => g.id === body.id);
    if (!current) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    updateGroup(body.id, {
      name: body.name ?? current.name,
      maxDownloadResolution:
        body.maxDownloadResolution ?? current.max_download_resolution,
    });
  }

  if (body.eventPaths) {
    setGroupEvents(body.id, body.eventPaths);
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  deleteGroup(id);
  return NextResponse.json({ ok: true });
}
