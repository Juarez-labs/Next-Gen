// Supabase Edge Function: generates a card image via OpenAI gpt-image-1
// and uploads it to the `card-art` storage bucket. Returns a public URL.
//
// Required secrets (set in Supabase dashboard or `supabase secrets set`):
//   OPENAI_API_KEY
//
// Required storage bucket: `card-art` (public).
//
// Deploy: `supabase functions deploy generate-card --no-verify-jwt false`

// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) return json({ error: "unauthorized" }, 401);

    const { cardName, prompt, cardIndex } = (await req.json()) as {
      cardName: string;
      prompt: string;
      cardIndex: number;
    };

    const fullPrompt = `Lotería card illustration of "${cardName}". ${prompt}. Family-friendly, vibrant, slightly humorous, flat illustrated style with a thick decorative border. Square 1:1.`;

    const imgRes = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt: fullPrompt,
        size: "1024x1024",
        n: 1,
      }),
    });
    if (!imgRes.ok) return json({ error: await imgRes.text() }, 500);

    const imgJson: any = await imgRes.json();
    const b64 = imgJson.data?.[0]?.b64_json;
    if (!b64) return json({ error: "no image returned" }, 500);

    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const path = `${user.id}/${cardIndex}-${Date.now()}.png`;

    const { error: upErr } = await supabase.storage
      .from("card-art")
      .upload(path, bytes, { contentType: "image/png", upsert: true });
    if (upErr) return json({ error: upErr.message }, 500);

    const { data: pub } = supabase.storage.from("card-art").getPublicUrl(path);
    return json({ imageUrl: pub.publicUrl });
  } catch (e: any) {
    return json({ error: e.message ?? String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}
