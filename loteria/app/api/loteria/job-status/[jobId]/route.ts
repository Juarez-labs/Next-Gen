// GET /api/loteria/job-status/[jobId]
//
// Polls Higgsfield for the latest job status. When the provider reports
// `succeeded`, this route also writes the resulting image_url onto the
// originating card (cards.image_url, cards.approved=false, cards.version++).
//
// `jobId` here is the *local* card_generation_jobs.id, not the provider id —
// the provider id lives in the row and is opaque to clients.

import { NextRequest, NextResponse } from "next/server";

import { createHiggsfieldClientFromEnv } from "@/lib/loteria/higgsfield";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await ctx.params;
  if (!jobId) {
    return NextResponse.json({ error: "jobId required" }, { status: 400 });
  }

  const supabase = await createClient();

  const { data: job, error: jobErr } = await supabase
    .from("card_generation_jobs")
    .select(
      "id, card_id, project_id, mode, provider, provider_job_id, status, image_url, error, created_at, updated_at",
    )
    .eq("id", jobId)
    .single();

  if (jobErr || !job) {
    return NextResponse.json(
      { error: `job not found: ${jobErr?.message ?? jobId}` },
      { status: 404 },
    );
  }

  // Terminal states do not need to be re-polled.
  if (
    job.status === "succeeded" ||
    job.status === "failed" ||
    job.status === "cancelled"
  ) {
    return NextResponse.json({ job });
  }

  if (!job.provider_job_id) {
    return NextResponse.json(
      { error: "job is missing provider_job_id" },
      { status: 500 },
    );
  }

  let providerJob;
  try {
    const client = createHiggsfieldClientFromEnv();
    providerJob = await client.getJobStatus(job.provider_job_id);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "higgsfield poll failed",
      },
      { status: 502 },
    );
  }

  // Persist the latest status onto the job row.
  const { data: updated, error: updateErr } = await supabase
    .from("card_generation_jobs")
    .update({
      status: providerJob.status,
      image_url: providerJob.imageUrl ?? job.image_url,
      error: providerJob.error ?? null,
    })
    .eq("id", job.id)
    .select(
      "id, card_id, project_id, mode, provider, provider_job_id, status, image_url, error, created_at, updated_at",
    )
    .single();

  if (updateErr || !updated) {
    return NextResponse.json(
      { error: `failed to update job: ${updateErr?.message ?? "unknown"}` },
      { status: 500 },
    );
  }

  // On success, write the image URL onto the originating card and reset
  // approval so the user has to re-approve the new artwork.
  if (providerJob.status === "succeeded" && providerJob.imageUrl) {
    const { data: prev } = await supabase
      .from("cards")
      .select("version")
      .eq("id", job.card_id)
      .single();
    const nextVersion = (prev?.version ?? 1) + 1;
    await supabase
      .from("cards")
      .update({
        image_url: providerJob.imageUrl,
        approved: false,
        version: nextVersion,
      })
      .eq("id", job.card_id);
  }

  return NextResponse.json({ job: updated });
}
