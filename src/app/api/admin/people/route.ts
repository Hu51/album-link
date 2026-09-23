import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdminAuthenticated } from "@/lib/auth";
import {
  createPerson,
  deletePerson,
  listPeople,
  rollPersonToken,
  updatePerson,
} from "@/lib/admin-data";

const resolutionSchema = z.enum(["orig", "2000px", "1000px"]);

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const people = listPeople().map((p) => ({
    ...p,
    groupIds: p.group_ids ? p.group_ids.split(",") : [],
  }));
  return NextResponse.json({ people });
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = z
    .object({
      name: z.string().min(1),
      maxDownloadResolution: resolutionSchema.default("orig"),
      groupIds: z.array(z.string()).default([]),
    })
    .parse(await request.json());
  try {
    const created = createPerson(
      body.name,
      body.maxDownloadResolution,
      body.groupIds,
    );
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
      groupIds: z.array(z.string()).optional(),
      rollToken: z.boolean().optional(),
    })
    .parse(await request.json());

  if (body.rollToken) {
    return NextResponse.json(rollPersonToken(body.id));
  }

  const current = listPeople().find((p) => p.id === body.id);
  if (!current) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  updatePerson(body.id, {
    name: body.name ?? current.name,
    maxDownloadResolution:
      body.maxDownloadResolution ?? current.max_download_resolution,
    groupIds:
      body.groupIds ?? (current.group_ids ? current.group_ids.split(",") : []),
  });

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
  deletePerson(id);
  return NextResponse.json({ ok: true });
}
