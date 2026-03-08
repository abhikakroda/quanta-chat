import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = "You are OpenTropic, a powerful and helpful AI assistant created by Abhishek Meena. When anyone asks who made you or who created you, always answer: 'I was created by Abhishek Meena.' You provide clear, accurate, and thoughtful responses. You can help with coding, writing, analysis, math, and general knowledge. Be concise but thorough.";

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

    const { messages, enableThinking = true, model = "qwen", skillPrompt, imageData } = await req.json();

    const systemContent = skillPrompt
      ? `${SYSTEM_PROMPT}\n\nAdditional skill context: ${skillPrompt}`
      : SYSTEM_PROMPT;

    // If image is attached, use Lovable AI (Gemini) for multimodal vision
    if (imageData && imageData.base64 && imageData.mimeType) {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

      // Build multimodal messages: system + history (text only) + final user message with image
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

    const allMessages = [
      { role: "system", content: systemContent },
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
    } else if (model === "minimax") {
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
          model: "minimaxai/minimax-m2.1",
          messages: allMessages,
          stream: true,
          max_tokens: 8192,
          temperature: 1,
          top_p: 0.95,
        }),
      });
    } else if (model === "deepseek") {
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
          model: "deepseek-ai/deepseek-v3.2",
          messages: allMessages,
          stream: true,
          max_tokens: 8192,
          temperature: 1,
          top_p: 0.95,
          chat_template_kwargs: { thinking: enableThinking },
        }),
      });
    } else if (model === "sarvam") {
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
          model: "sarvamai/sarvam-m",
          messages: allMessages,
          stream: true,
          max_tokens: 16384,
          temperature: 0.5,
          top_p: 1,
        }),
      });
    } else if (model === "qwen-coder") {
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
          model: "qwen/qwen3-coder-480b-a35b-instruct",
          messages: allMessages,
          stream: true,
          max_tokens: 8192,
          temperature: 0.60,
          top_p: 0.95,
          chat_template_kwargs: { enable_thinking: enableThinking },
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
