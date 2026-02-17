import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = "You are Quanta AI, a powerful and helpful AI assistant. You provide clear, accurate, and thoughtful responses. You can help with coding, writing, analysis, math, and general knowledge. Be concise but thorough.";

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
    const token = authHeader.replace("Bearer ", "");
    const { data, error: authError } = await supabase.auth.getClaims(token);
    if (authError || !data?.claims?.sub) throw new Error("Not authenticated");

    const { messages, enableThinking = true, model = "qwen" } = await req.json();

    const allMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages,
    ];

    let response: Response;

    if (model === "mistral") {
      const MISTRAL_API_KEY = Deno.env.get("MISTRAL_API_KEY");
      if (!MISTRAL_API_KEY) throw new Error("MISTRAL_API_KEY not configured");

      response = await fetch("https://api.mistral.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${MISTRAL_API_KEY}`,
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          model: "mistral-small-latest",
          messages: allMessages,
          stream: true,
          max_tokens: 4096,
          temperature: 0.6,
          top_p: 0.95,
        }),
      });
    } else {
      // Default: NVIDIA Qwen
      const NVIDIA_API_KEY = Deno.env.get("NVIDIA_API_KEY");
      if (!NVIDIA_API_KEY) throw new Error("NVIDIA_API_KEY not configured");

      response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${NVIDIA_API_KEY}`,
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          model: "qwen/qwen3.5-397b-a17b",
          messages: allMessages,
          stream: true,
          max_tokens: 4096,
          temperature: 0.60,
          top_p: 0.95,
          top_k: 20,
          presence_penalty: 0,
          repetition_penalty: 1,
          chat_template_kwargs: { enable_thinking: enableThinking },
        }),
      });
    }

    if (!response.ok) {
      const errText = await response.text();
      console.error("API error:", response.status, errText);
      return new Response(JSON.stringify({ error: `API error: ${response.status}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
