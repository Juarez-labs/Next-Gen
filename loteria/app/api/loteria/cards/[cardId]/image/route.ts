// PATCH /api/loteria/cards/[cardId]/image
//
// Body: { imageUrl: string }
//
// Replaces the card image with a manually uploaded URL (the upload itself
// is expected to land in Supabase Storage; the client passes the public URL
// here). Bumps cards.version and clears `approved` so the user must re-OK
// the replacement.

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

  let body: { imageUrl?: string };
  try {
    body = (await req.json()) as { imageUrl?: string };
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (!body.imageUrl || typeof body.imageUrl !== "string") {
    return NextResponse.json(
      { error: "imageUrl required" },
      { status: 400 },
    );
  }
  try {
    // Reject obviously bad input early.
    const url = new URL(body.imageUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("non-http(s) URL");
    }
  } catch {
    return NextResponse.json(
      { error: "imageUrl must be a valid http(s) URL" },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { data: prev } = await supabase
    .from("cards")
    .select("version")
    .eq("id", cardId)
    .single();

  const { data, error } = await supabase
    .from("cards")
    .update({
      image_url: body.imageUrl,
      approved: false,
      version: (prev?.version ?? 1) + 1,
      is_custom_photo: true,
    })
    .eq("id", cardId)
    .select("id, image_url, approved, version, is_custom_photo")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: `failed: ${error?.message ?? "unknown"}` },
      { status: 500 },
    );
  }
  return NextResponse.json({ card: data });
}
