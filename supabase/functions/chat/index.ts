import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = "You are OpenTropic, a powerful and helpful AI assistant created by Abhishek Meena. When anyone asks who made you or who created you, always answer: 'I was created by Abhishek Meena.' You provide clear, accurate, and thoughtful responses. You can help with coding, writing, analysis, math, and general knowledge. Be concise but thorough.";

// Model mapping to Lovable AI gateway models
const MODEL_MAP: Record<string, string> = {
  "gemini-flash": "google/gemini-3-flash-preview",
  "gemini-pro": "google/gemini-2.5-pro",
  "gemini-flash-lite": "google/gemini-2.5-flash-lite",
  "gpt5-mini": "openai/gpt-5-mini",
  "gpt5": "openai/gpt-5",
  // Legacy model IDs → map to Google equivalents
  "qwen": "google/gemini-3-flash-preview",
  "qwen-coder": "google/gemini-2.5-pro",
  "mistral": "google/gemini-2.5-flash",
  "minimax": "google/gemini-2.5-flash",
  "deepseek": "google/gemini-2.5-pro",
  "sarvam": "google/gemini-2.5-flash",
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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { messages, enableThinking = true, model = "gemini-flash", skillPrompt, imageData } = await req.json();

    const systemContent = skillPrompt
      ? `${SYSTEM_PROMPT}\n\nAdditional skill context: ${skillPrompt}`
      : SYSTEM_PROMPT;

    // Resolve model
    const gatewayModel = MODEL_MAP[model] || "google/gemini-3-flash-preview";

    // If image is attached, use multimodal vision
    if (imageData && imageData.base64 && imageData.mimeType) {
      const textHistory = messages.slice(0, -1).map((m: any) => ({
        role: m.role,
        content: typeof m.content === "string" ? m.content : m.content,
      }));
      const lastUserMsg = messages[messages.length - 1];
      const userText = typeof lastUserMsg.content === "string" ? lastUserMsg.content : "Describe this image.";

      const visionMessages = [
        { role: "system", content: systemContent },
        ...textHistory,
        {
          role: "user",
          content: [
            { type: "text", text: userText },
            { type: "image_url", image_url: { url: `data:${imageData.mimeType};base64,${imageData.base64}` } },
          ],
        },
      ];

      const visionResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: visionMessages,
          stream: true,
          max_tokens: 4096,
        }),
      });

      if (!visionResp.ok) {
        if (visionResp.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (visionResp.status === 402) {
          return new Response(JSON.stringify({ error: "Credits exhausted. Please add funds." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const errText = await visionResp.text();
        console.error("Vision API error:", visionResp.status, errText);
        return new Response(JSON.stringify({ error: "Vision service error" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(visionResp.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // Standard text chat via Lovable AI gateway
    const allMessages = [
      { role: "system", content: systemContent },
      ...messages,
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: gatewayModel,
        messages: allMessages,
        stream: true,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted. Please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      return new Response(JSON.stringify({ error: `AI gateway error: ${response.status}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
