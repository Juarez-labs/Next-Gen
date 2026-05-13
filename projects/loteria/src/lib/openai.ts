// Thin client for OpenAI image generation + TTS, called via Supabase Edge Functions
// (we never ship the OpenAI key to the device). The edge functions live under
// supabase/functions/{generate-card,tts}.
//
// Until the keys are wired up, every call here will fail gracefully and the UI
// will fall back to defaults / native expo-speech.

import { supabase } from "./supabase";

export async function generateCardImage(args: {
  cardName: string;
  prompt: string;
  cardIndex: number;
}): Promise<{ imageUrl: string } | null> {
  try {
    const { data, error } = await supabase.functions.invoke("generate-card", {
      body: args,
    });
    if (error) throw error;
    return data as { imageUrl: string };
  } catch (e) {
    console.warn("[openai] generateCardImage failed", e);
    return null;
  }
}

export async function ttsVerse(args: {
  text: string;
  voice?: string; // e.g. "alloy"
}): Promise<{ audioBase64: string } | null> {
  try {
    const { data, error } = await supabase.functions.invoke("tts", {
      body: { text: args.text, voice: args.voice ?? "alloy" },
    });
    if (error) throw error;
    return data as { audioBase64: string };
  } catch (e) {
    console.warn("[openai] ttsVerse failed", e);
    return null;
  }
}
