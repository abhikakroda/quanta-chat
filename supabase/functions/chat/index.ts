import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = "You are OpenTropic, a powerful and helpful AI assistant created by Abhishek Meena. When anyone asks who made you or who created you, always answer: 'I was created by Abhishek Meena.' You provide clear, accurate, and thoughtful responses. You can help with coding, writing, analysis, math, and general knowledge. Be concise but thorough.";

// Google AI Studio model mapping — use stable model names
const GOOGLE_MODEL_MAP: Record<string, string> = {
  "gemini-flash": "gemini-2.5-flash",
  "gemini-pro": "gemini-2.5-pro",
  "gemini-flash-lite": "gemini-2.0-flash-lite",
  "gpt5-mini": "gemini-2.5-flash",
  "gpt5": "gemini-2.5-pro",
};

// Lovable AI gateway fallback model mapping
const LOVABLE_MODEL_MAP: Record<string, string> = {
  "gemini-flash": "google/gemini-3-flash-preview",
  "gemini-pro": "google/gemini-2.5-pro",
  "gemini-flash-lite": "google/gemini-2.5-flash-lite",
  "gpt5-mini": "openai/gpt-5-mini",
  "gpt5": "openai/gpt-5",
  "mistral": "google/gemini-3-flash-preview",
  "minimax": "google/gemini-3-flash-preview",
  "glm": "google/gemini-3-flash-preview",
  "kimi": "google/gemini-3-flash-preview",
  "swan": "google/gemini-3-flash-preview",
};

// Mistral model mapping
const MISTRAL_MODEL = "mistral-small-latest";

// NVIDIA NIM model mapping (build.nvidia.com)
const NVIDIA_MODEL_MAP: Record<string, string> = {
  "minimax": "minimaxi/minimax-m1-80k",
  "glm": "thudm/glm-4-32b-instruct",
  "kimi": "moonshotai/kimi-k2-instruct",
  "swan": "snowflake/arctic",
  "nemotron": "nvidia/llama-3.3-nemotron-super-49b-v1",
  "nemotron-70b": "nvidia/llama-3.1-nemotron-70b-instruct",
};

// Which models route through which provider
const MISTRAL_MODELS = new Set(["mistral"]);
const NVIDIA_MODELS = new Set(["minimax", "glm", "kimi", "swan", "nemotron", "nemotron-70b"]);


async function callMistralAI(apiKey: string, messages: any[], stream: boolean, maxTokens: number) {
  return await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MISTRAL_MODEL,
      messages,
      stream,
      max_tokens: maxTokens,
    }),
  });
}

async function callNvidiaAI(apiKey: string, model: string, messages: any[], stream: boolean, maxTokens: number) {
  const nvidiaModel = NVIDIA_MODEL_MAP[model] || "minimaxi/minimax-m1-80k";
  return await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: nvidiaModel,
      messages,
      stream,
      max_tokens: maxTokens,
    }),
  });
}

async function callGoogleAI(apiKey: string, model: string, messages: any[], stream: boolean, maxTokens: number) {
  const googleModel = GOOGLE_MODEL_MAP[model] || "gemini-2.5-flash";
  
  // Convert OpenAI-style messages to Google Generative AI format
  const systemInstruction = messages.find((m: any) => m.role === "system");
  const chatMessages = messages.filter((m: any) => m.role !== "system");

  const contents = chatMessages.map((m: any) => {
    if (Array.isArray(m.content)) {
      // Multimodal message
      const parts = m.content.map((c: any) => {
        if (c.type === "text") return { text: c.text };
        if (c.type === "image_url") {
          const url = c.image_url?.url || "";
          if (url.startsWith("data:")) {
            const match = url.match(/^data:([^;]+);base64,(.+)$/);
            if (match) {
              return { inlineData: { mimeType: match[1], data: match[2] } };
            }
          }
          return { text: `[Image: ${url}]` };
        }
        return { text: JSON.stringify(c) };
      });
      return { role: m.role === "assistant" ? "model" : "user", parts };
    }
    return { role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] };
  });

  const endpoint = stream
    ? `https://generativelanguage.googleapis.com/v1beta/models/${googleModel}:streamGenerateContent?alt=sse&key=${apiKey}`
    : `https://generativelanguage.googleapis.com/v1beta/models/${googleModel}:generateContent?key=${apiKey}`;

  const body: any = {
    contents,
    generationConfig: { maxOutputTokens: maxTokens },
  };
  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction.content }] };
  }

  return await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function callLovableAI(apiKey: string, model: string, messages: any[], stream: boolean, maxTokens: number) {
  const lovableModel = LOVABLE_MODEL_MAP[model] || "google/gemini-3-flash-preview";
  const isOpenAI = lovableModel.startsWith("openai/");
  const body: any = {
    model: lovableModel,
    messages,
    stream,
  };
  if (isOpenAI) {
    body.max_completion_tokens = maxTokens;
  } else {
    body.max_tokens = maxTokens;
  }
  return await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

// Transform Google SSE stream to OpenAI-compatible SSE stream
function transformGoogleStream(googleBody: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const reader = googleBody.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  return new ReadableStream({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
          return;
        }

        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ") || line.trim() === "") continue;

          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          try {
            const parsed = JSON.parse(jsonStr);
            const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text || "";
            if (text) {
              const openaiChunk = {
                choices: [{ delta: { content: text }, index: 0 }],
              };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(openaiChunk)}\n\n`));
            }
          } catch { /* skip malformed */ }
        }
      } catch (err) {
        controller.error(err);
      }
    },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    
    // Support guest mode (first 5 free messages without auth)
    const bodyText = await req.text();
    const bodyJson = JSON.parse(bodyText);
    const isGuest = bodyJson.guest === true;
    
    if (!isGuest) {
      if (!authHeader?.startsWith("Bearer ")) throw new Error("Not authenticated");
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("Not authenticated");
    }

    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const MISTRAL_API_KEY = Deno.env.get("MISTRAL_API_KEY");
    const NVIDIA_API_KEY = Deno.env.get("NVIDIA_API_KEY");

    const { messages, enableThinking = true, model = "gemini-flash", skillPrompt, imageData } = bodyJson;

    const systemContent = skillPrompt
      ? `${SYSTEM_PROMPT}\n\nAdditional skill context: ${skillPrompt}`
      : SYSTEM_PROMPT;

    // Build messages array
    const allMessages = [
      { role: "system", content: systemContent },
      ...messages,
    ];

    // If image is attached, build multimodal messages
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

      // Try Google first for vision
      if (GOOGLE_API_KEY) {
        try {
          const googleResp = await callGoogleAI(GOOGLE_API_KEY, model, visionMessages, true, 4096);
          if (googleResp.ok && googleResp.body) {
            console.log("✅ Vision: Using Google AI Studio");
            const transformedStream = transformGoogleStream(googleResp.body);
            return new Response(transformedStream, {
              headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
            });
          }
          console.warn("⚠️ Google vision failed:", googleResp.status, await googleResp.text());
        } catch (e) {
          console.warn("⚠️ Google vision error:", e);
        }
      }

      // Fallback to Lovable AI for vision
      if (LOVABLE_API_KEY) {
        console.log("🔄 Vision: Falling back to Lovable AI");
        const lovableResp = await callLovableAI(LOVABLE_API_KEY, model, visionMessages, true, 4096);
        if (!lovableResp.ok) {
          if (lovableResp.status === 429) {
            return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
              status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          if (lovableResp.status === 402) {
            return new Response(JSON.stringify({ error: "Credits exhausted." }), {
              status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          const errText = await lovableResp.text();
          console.error("Lovable AI vision error:", lovableResp.status, errText);
          return new Response(JSON.stringify({ error: "Vision service error" }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(lovableResp.body, {
          headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
        });
      }

      throw new Error("No AI API key configured");
    }

    // ── Route by model provider ──

    // Mistral models → Mistral API
    if (MISTRAL_MODELS.has(model) && MISTRAL_API_KEY) {
      try {
        const resp = await callMistralAI(MISTRAL_API_KEY, allMessages, true, 4096);
        if (resp.ok && resp.body) {
          console.log("✅ Chat: Using Mistral API");
          return new Response(resp.body, {
            headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
          });
        }
        console.warn("⚠️ Mistral failed:", resp.status, await resp.text());
      } catch (e) {
        console.warn("⚠️ Mistral error:", e);
      }
    }

    // NVIDIA models (Minimax, GLM, Kimi, Swan) → NVIDIA NIM API
    if (NVIDIA_MODELS.has(model) && NVIDIA_API_KEY) {
      try {
        const resp = await callNvidiaAI(NVIDIA_API_KEY, model, allMessages, true, 4096);
        if (resp.ok && resp.body) {
          console.log("✅ Chat: Using NVIDIA NIM -", NVIDIA_MODEL_MAP[model] || model);
          return new Response(resp.body, {
            headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
          });
        }
        console.warn("⚠️ NVIDIA failed:", resp.status, await resp.text());
      } catch (e) {
        console.warn("⚠️ NVIDIA error:", e);
      }
    }

    // Google Gemini models → Google AI Studio (primary for gemini-* and gpt5-*)
    if (GOOGLE_API_KEY && !MISTRAL_MODELS.has(model) && !NVIDIA_MODELS.has(model)) {
      try {
        const googleResp = await callGoogleAI(GOOGLE_API_KEY, model, allMessages, true, 4096);
        if (googleResp.ok && googleResp.body) {
          console.log("✅ Chat: Using Google AI Studio -", GOOGLE_MODEL_MAP[model] || model);
          const transformedStream = transformGoogleStream(googleResp.body);
          return new Response(transformedStream, {
            headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
          });
        }
        console.warn("⚠️ Google chat failed:", googleResp.status, await googleResp.text());
      } catch (e) {
        console.warn("⚠️ Google chat error:", e);
      }
    }

    // Fallback to Lovable AI for any model
    if (LOVABLE_API_KEY) {
      console.log("🔄 Chat: Falling back to Lovable AI for model:", model);
      const lovableResp = await callLovableAI(LOVABLE_API_KEY, model, allMessages, true, 4096);
      if (!lovableResp.ok) {
        if (lovableResp.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (lovableResp.status === 402) {
          return new Response(JSON.stringify({ error: "Credits exhausted." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const errText = await lovableResp.text();
        console.error("Lovable AI error:", lovableResp.status, errText);
        return new Response(JSON.stringify({ error: `AI error: ${lovableResp.status}` }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(lovableResp.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    throw new Error("No AI API key configured");
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
