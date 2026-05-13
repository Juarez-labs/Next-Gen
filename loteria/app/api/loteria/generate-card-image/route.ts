// POST /api/loteria/generate-card-image
//
// Body:
//   { cardId: string, mode?: 'text_to_image' | 'image_to_image',
//     referenceImageUrl?: string, stylePreset?: string }
//
// Resolves the card row, builds the playbook 3.5 prompt, submits a
// Higgsfield job, and persists a `card_generation_jobs` row tied to the
// card. Returns the new job record so the client can poll /api/loteria/
// job-status/{jobId}.

import { NextRequest, NextResponse } from "next/server";

import {
  buildCardPrompt,
  createHiggsfieldClientFromEnv,
  type HiggsfieldJob,
} from "@/lib/loteria/higgsfield";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Mode = "text_to_image" | "image_to_image";

interface RequestBody {
  cardId?: string;
  mode?: Mode;
  referenceImageUrl?: string;
  stylePreset?: string;
}

export async function POST(req: NextRequest) {
  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  if (!body.cardId) {
    return NextResponse.json({ error: "cardId is required" }, { status: 400 });
  }
  const mode: Mode = body.mode ?? "text_to_image";
  if (mode === "image_to_image" && !body.referenceImageUrl) {
    return NextResponse.json(
      { error: "referenceImageUrl required for image_to_image mode" },
      { status: 400 },
    );
  }

  const supabase = await createClient();

  const { data: card, error: cardErr } = await supabase
    .from("cards")
    .select("id, project_id, card_number, english_name, spanish_name, description, prompt")
    .eq("id", body.cardId)
    .single();

  if (cardErr || !card) {
    return NextResponse.json(
      { error: `card not found: ${cardErr?.message ?? body.cardId}` },
      { status: 404 },
    );
  }

  // Prefer a stored per-card prompt override; fall back to the template.
  const prompt =
    card.prompt && card.prompt.trim().length > 0
      ? card.prompt
      : buildCardPrompt(card, { stylePreset: body.stylePreset });

  let providerJob: HiggsfieldJob;
  try {
    const client = createHiggsfieldClientFromEnv();
    providerJob =
      mode === "image_to_image"
        ? await client.submitImageToImage({
            prompt,
            referenceImageUrl: body.referenceImageUrl!,
          })
        : await client.submitTextToImage({ prompt });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "higgsfield submission failed",
      },
      { status: 502 },
    );
  }

  const { data: job, error: insertErr } = await supabase
    .from("card_generation_jobs")
    .insert({
      card_id: card.id,
      project_id: card.project_id,
      mode,
      provider: "higgsfield",
      provider_job_id: providerJob.jobId,
      prompt,
      reference_image_url: body.referenceImageUrl ?? null,
      status: providerJob.status,
      image_url: providerJob.imageUrl ?? null,
      error: providerJob.error ?? null,
    })
    .select(
      "id, card_id, project_id, mode, provider, provider_job_id, status, image_url, error, created_at, updated_at",
    )
    .single();

  if (insertErr || !job) {
    return NextResponse.json(
      { error: `failed to persist job: ${insertErr?.message ?? "unknown"}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ job }, { status: 201 });
}
