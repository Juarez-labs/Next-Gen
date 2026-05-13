// POST /api/loteria/export/zip
//
// Body: { projectId: string, batchSize?: number, pageFormat?: "Letter" | "A4" }
//
// Returns the full project ZIP package — board PDFs (batched), caller deck
// PDF, card index CSV, and project metadata. Mirrors playbook 5.10 layout.

import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { exportProjectZip, slugify } from "@/lib/loteria/pdf-exporter";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface RequestBody {
  projectId?: string;
  batchSize?: number;
  pageFormat?: "Letter" | "A4";
}

export async function POST(req: NextRequest) {
  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (!body.projectId || typeof body.projectId !== "string") {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }
  if (body.batchSize !== undefined) {
    if (!Number.isInteger(body.batchSize) || body.batchSize <= 0) {
      return NextResponse.json(
        { error: "batchSize must be a positive integer" },
        { status: 400 },
      );
    }
  }
  if (body.pageFormat && body.pageFormat !== "Letter" && body.pageFormat !== "A4") {
    return NextResponse.json(
      { error: "pageFormat must be 'Letter' or 'A4'" },
      { status: 400 },
    );
  }

  const supabase = await createClient();

  const { data: project, error: projErr } = await supabase
    .from("projects")
    .select("name")
    .eq("id", body.projectId)
    .single();
  if (projErr || !project) {
    return NextResponse.json(
      { error: `project not found: ${projErr?.message ?? "unknown"}` },
      { status: 404 },
    );
  }

  let zipBytes: Buffer;
  try {
    zipBytes = await exportProjectZip(supabase, body.projectId, {
      batchSize: body.batchSize ?? 5,
      pageFormat: body.pageFormat ?? "Letter",
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }

  const slug = slugify(project.name);
  return new NextResponse(new Uint8Array(zipBytes), {
    status: 200,
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${slug}_project.zip"`,
      "content-length": zipBytes.length.toString(),
    },
  });
}
