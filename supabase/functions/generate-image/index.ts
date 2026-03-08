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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) throw new Error("Not authenticated");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Not authenticated");

    const { prompt } = await req.json();
    if (!prompt) throw new Error("Prompt is required");

    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    // Try Google AI Studio first for image generation
    if (GOOGLE_API_KEY) {
      try {
        console.log("🎨 Image gen: Trying Google AI Studio...");
        const googleResp = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent?key=${GOOGLE_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: `Generate a high-quality image: ${prompt}` }] }],
              generationConfig: {
                responseModalities: ["TEXT", "IMAGE"],
              },
            }),
          }
        );

        if (googleResp.ok) {
          const result = await googleResp.json();
          const parts = result.candidates?.[0]?.content?.parts || [];
          let text = "";
          const images: any[] = [];

          for (const part of parts) {
            if (part.text) text += part.text;
            if (part.inlineData) {
              images.push({
                type: "image_url",
                image_url: { url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}` },
              });
            }
          }

          if (images.length > 0) {
            console.log("✅ Image gen: Google AI Studio success");
            return new Response(JSON.stringify({ success: true, text, images }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          console.warn("⚠️ Google returned no images, trying fallback...");
        } else {
          const errText = await googleResp.text();
          console.warn("⚠️ Google image gen failed:", googleResp.status, errText);
        }
      } catch (e) {
        console.warn("⚠️ Google image gen error:", e);
      }
    }

    // Fallback to Lovable AI
    if (LOVABLE_API_KEY) {
      console.log("🔄 Image gen: Falling back to Lovable AI");
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-pro-image-preview",
          messages: [{ role: "user", content: `Generate a high-quality image: ${prompt}` }],
          modalities: ["image", "text"],
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: "Credits exhausted." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const errText = await response.text();
        console.error("Lovable AI image error:", response.status, errText);
        return new Response(JSON.stringify({ error: "Image generation failed" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const result = await response.json();
      const message = result.choices?.[0]?.message;
      const text = message?.content || "";
      const images = message?.images || [];

      console.log("✅ Image gen: Lovable AI success");
      return new Response(JSON.stringify({ success: true, text, images }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("No AI API key configured for image generation");
  } catch (e) {
    console.error("generate-image error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
