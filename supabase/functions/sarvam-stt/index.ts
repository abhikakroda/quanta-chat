import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth validation
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid authentication" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SARVAM_API_KEY = Deno.env.get("SARVAM_API_KEY");
    if (!SARVAM_API_KEY) throw new Error("Service not configured");

    const contentType = req.headers.get("content-type") || "";
    let audioFile: File | null = null;
    let languageCode = "en-IN";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      audioFile = formData.get("audio") as File;
      const langParam = formData.get("language") as string;
      if (langParam) languageCode = langParam;
    } else {
      const blob = await req.blob();
      if (blob.size > 0) {
        audioFile = new File([blob], "recording.webm", { type: "audio/webm" });
      }
    }
    if (!audioFile) throw new Error("Audio file is required");

    // Determine proper file extension from mime type
    const mimeType = audioFile.type || "audio/webm";
    const ext = mimeType.includes("wav") ? "wav" : mimeType.includes("mp4") || mimeType.includes("m4a") ? "m4a" : mimeType.includes("ogg") ? "ogg" : "webm";
    const fileName = `recording.${ext}`;

    const apiFormData = new FormData();
    apiFormData.append("file", new File([audioFile], fileName, { type: mimeType }), fileName);
    apiFormData.append("model", "saaras:v3");
    apiFormData.append("mode", "transcribe");
    apiFormData.append("language_code", languageCode);

    console.log("STT request:", { fileName, mimeType, size: audioFile.size, languageCode });

    const response = await fetch("https://api.sarvam.ai/speech-to-text", {
      method: "POST",
      headers: {
        "api-subscription-key": SARVAM_API_KEY,
      },
      body: apiFormData,
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error("Sarvam STT error:", response.status, errBody);
      throw new Error(`STT error: ${response.status}`);
    }

    const result = await response.json();

    return new Response(JSON.stringify({ transcript: result.transcript }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("STT error:", e);
    return new Response(JSON.stringify({ error: "Request failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
