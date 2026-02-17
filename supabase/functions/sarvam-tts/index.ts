import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SARVAM_API_KEY = Deno.env.get("SARVAM_API_KEY");
    if (!SARVAM_API_KEY) throw new Error("SARVAM_API_KEY not configured");

    const { text, language = "en-IN" } = await req.json();
    if (!text) throw new Error("Text is required");

    // Sarvam TTS has a 1000 char limit, truncate if needed
    const truncatedText = text.slice(0, 1000);

    const response = await fetch("https://api.sarvam.ai/text-to-speech", {
      method: "POST",
      headers: {
        "api-subscription-key": SARVAM_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: truncatedText,
        target_language_code: language,
        model: "bulbul:v3",
        audio_format: "mp3",
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Sarvam TTS error:", response.status, errText);
      throw new Error(`TTS API error: ${response.status}`);
    }

    const data = await response.json();

    return new Response(JSON.stringify({ audio: data.audios?.[0] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("TTS error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
