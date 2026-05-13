// POST /api/loteria/export/boards
//
// Body: { projectId: string, batchSize?: number, pageFormat?: "Letter" | "A4" }
//
// Renders all boards for the project as Puppeteer-printed PDFs, batched at
// `batchSize` boards per file (default 5 per playbook 5.7), and returns them
// bundled in a ZIP. Returning a ZIP keeps the API one round-trip even when
// a project has many batches.

import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { exportBoardsAsPdfs, slugify } from "@/lib/loteria/pdf-exporter";

export const dynamic = "force-dynamic";
// Puppeteer is heavy; force the Node.js runtime.
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

  // Resolve project name for the zip filename.
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

  let files;
  try {
    files = await exportBoardsAsPdfs(supabase, body.projectId, {
      batchSize: body.batchSize ?? 5,
      pageFormat: body.pageFormat ?? "Letter",
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }

  // Bundle the batch PDFs into a single ZIP for one-shot download.
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  for (const file of files) {
    zip.file(file.fileName, file.bytes);
  }
  const zipBytes = await zip.generateAsync({ type: "nodebuffer" });

  const slug = slugify(project.name);
  return new NextResponse(new Uint8Array(zipBytes), {
    status: 200,
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${slug}_boards.zip"`,
      "content-length": zipBytes.length.toString(),
    },
  });
}
