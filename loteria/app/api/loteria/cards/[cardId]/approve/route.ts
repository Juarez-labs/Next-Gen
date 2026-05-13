// PATCH /api/loteria/cards/[cardId]/approve
//
// Body: { approved: boolean }
//
// Sets cards.approved without touching the artwork — used by CardEditor's
// approve button.

import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ cardId: string }> },
) {
  const { cardId } = await ctx.params;
  if (!cardId) {
    return NextResponse.json({ error: "cardId required" }, { status: 400 });
  }

  let body: { approved?: boolean };
  try {
    body = (await req.json()) as { approved?: boolean };
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (typeof body.approved !== "boolean") {
    return NextResponse.json(
      { error: "approved must be a boolean" },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cards")
    .update({ approved: body.approved })
    .eq("id", cardId)
    .select("id, approved, version, image_url")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: `failed: ${error?.message ?? "unknown"}` },
      { status: 500 },
    );
  }
  return NextResponse.json({ card: data });
}
