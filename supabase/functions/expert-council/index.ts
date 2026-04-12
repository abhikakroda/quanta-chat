import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EXPERT_MODELS = [
  { id: "gemini-pro", model: "google/gemini-2.5-pro", label: "Gemini Pro" },
  { id: "gpt5", model: "openai/gpt-5", label: "GPT-5" },
  { id: "gemini-flash", model: "google/gemini-3-flash-preview", label: "Gemini Flash" },
  { id: "gpt5-mini", model: "openai/gpt-5-mini", label: "GPT-5 Mini" },
  { id: "gemini-flash-lite", model: "google/gemini-2.5-flash-lite", label: "Flash Lite" },
  { id: "gemini-3-pro", model: "google/gemini-3.1-pro-preview", label: "Gemini 3.1 Pro" },
];

const SYSTEM_PROMPT = "You are OpenTropic, a powerful and helpful AI assistant created by Abhishek Meena. You provide clear, accurate, and thorough responses. Be comprehensive and detailed.";

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

    const { messages, skillPrompt } = await req.json();
    if (!messages?.length) {
      return new Response(JSON.stringify({ error: "Messages required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemContent = skillPrompt
      ? `${SYSTEM_PROMPT}\n\n${skillPrompt}`
      : SYSTEM_PROMPT;

    const allMessages = [
      { role: "system", content: systemContent },
      ...messages,
    ];

    // Run all models in parallel
    const results = await Promise.all(
      EXPERT_MODELS.map(async (expert) => {
        try {
          const isOpenAI = expert.model.startsWith("openai/");
          const body: any = {
            model: expert.model,
            messages: allMessages,
            stream: false,
          };
          if (isOpenAI) {
            body.max_completion_tokens = 16384;
          } else {
            body.max_tokens = 16384;
          }

          const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
          });

          if (!resp.ok) {
            console.error(`${expert.id} error: ${resp.status}`);
            return { ...expert, response: null, error: true };
          }

          const result = await resp.json();
          const content = result.choices?.[0]?.message?.content?.trim() || "";
          return { ...expert, response: content, error: false };
        } catch (e) {
          console.error(`${expert.id} error:`, e);
          return { ...expert, response: null, error: true };
        }
      })
    );

    const successfulResults = results.filter(r => !r.error && r.response);

    // Generate a synthesis from all responses
    let synthesis = "";
    if (successfulResults.length >= 2) {
      try {
        const summaryInput = successfulResults
          .map(r => `**${r.label}:**\n${r.response}`)
          .join("\n\n---\n\n");

        const synthResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-pro",
            messages: [
              {
                role: "system",
                content: `You are a master synthesizer. Multiple AI models answered the same question. Create the BEST possible answer by:
1. Taking the strongest points from each model
2. Resolving any contradictions with the most accurate information
3. Organizing into a clear, comprehensive response
4. Adding any missing details
Be thorough, well-structured with markdown, and provide the definitive answer.`,
              },
              {
                role: "user",
                content: `Original question: "${messages[messages.length - 1]?.content}"\n\nHere are the responses from ${successfulResults.length} AI models:\n\n${summaryInput}\n\nSynthesize the BEST possible comprehensive answer.`,
              },
            ],
            max_tokens: 16384,
          }),
        });

        if (synthResp.ok) {
          const synthResult = await synthResp.json();
          synthesis = synthResult.choices?.[0]?.message?.content?.trim() || "";
        }
      } catch { /* ignore synthesis failure */ }
    }

    return new Response(JSON.stringify({
      results: successfulResults.map(r => ({
        id: r.id,
        label: r.label,
        response: r.response,
      })),
      synthesis,
      totalModels: EXPERT_MODELS.length,
      successfulModels: successfulResults.length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("expert-council error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
