// POST /api/loteria/export/caller-deck
//
// Body: { projectId: string, pageFormat?: "Letter" | "A4", cardsPerPage?: number }
//
// Returns the printable caller deck PDF (all cards in a multi-up layout).

import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { exportCallerDeckPdf, slugify } from "@/lib/loteria/pdf-exporter";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface RequestBody {
  projectId?: string;
  pageFormat?: "Letter" | "A4";
  cardsPerPage?: number;
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
  if (body.pageFormat && body.pageFormat !== "Letter" && body.pageFormat !== "A4") {
    return NextResponse.json(
      { error: "pageFormat must be 'Letter' or 'A4'" },
      { status: 400 },
    );
  }
  if (body.cardsPerPage !== undefined) {
    if (!Number.isInteger(body.cardsPerPage) || body.cardsPerPage <= 0) {
      return NextResponse.json(
        { error: "cardsPerPage must be a positive integer" },
        { status: 400 },
      );
    }
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

  let pdfBytes: Buffer;
  try {
    pdfBytes = await exportCallerDeckPdf(supabase, body.projectId, {
      pageFormat: body.pageFormat ?? "Letter",
      cardsPerPage: body.cardsPerPage,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }

  const slug = slugify(project.name);
  return new NextResponse(new Uint8Array(pdfBytes), {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${slug}_caller_deck.pdf"`,
      "content-length": pdfBytes.length.toString(),
    },
  });
}
