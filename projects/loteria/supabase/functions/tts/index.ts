// Supabase Edge Function: turns a verse into Spanish TTS audio via OpenAI.
// Returns base64 mp3 the client plays with expo-av.
//
// Required secret: OPENAI_API_KEY
// Deploy: `supabase functions deploy tts`

// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const { text, voice = "alloy" } = (await req.json()) as {
      text: string;
      voice?: string;
    };

    const res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini-tts",
        voice,
        input: text,
        format: "mp3",
        instructions:
          "Habla en español mexicano, con tono de cantador de lotería: entonación juguetona, pausada y musical.",
      }),
    });
    if (!res.ok) {
      return new Response(JSON.stringify({ error: await res.text() }), {
        status: 500,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const buf = new Uint8Array(await res.arrayBuffer());
    let bin = "";
    for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    const b64 = btoa(bin);
    return new Response(JSON.stringify({ audioBase64: b64 }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message ?? String(e) }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
