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
    const token = authHeader.replace("Bearer ", "");
    const { data, error: authError } = await supabase.auth.getClaims(token);
    if (authError || !data?.claims?.sub) throw new Error("Not authenticated");
    const userId = data.claims.sub as string;

    const { mode, topic, question } = await req.json();
    // mode: "analyze" | "tone-mirror" | "interview-clone" | "future-you" | "predict"

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Fetch user's message history (their messages only)
    const { data: convos } = await supabase
      .from("conversations")
      .select("id")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(20);

    let userMessages: string[] = [];
    if (convos && convos.length > 0) {
      const convoIds = convos.map((c: any) => c.id);
      const { data: msgs } = await supabase
        .from("messages")
        .select("content, role")
        .in("conversation_id", convoIds)
        .eq("role", "user")
        .order("created_at", { ascending: false })
        .limit(100);
      if (msgs) userMessages = msgs.map((m: any) => m.content);
    }

    // Fetch user memories
    const { data: memories } = await supabase
      .from("user_memories")
      .select("key, value, category")
      .limit(50);

    const memoryContext = memories && memories.length > 0
      ? memories.map((m: any) => `${m.key}: ${m.value}`).join("\n")
      : "No memories stored yet.";

    const messageSample = userMessages.slice(0, 40).join("\n---\n");
    const messageCount = userMessages.length;

    if (messageCount < 5) {
      return new Response(JSON.stringify({
        error: "insufficient_data",
        message: "Need at least 5 messages to build your Shadow Clone. Keep chatting!",
        progress: Math.round((messageCount / 5) * 100),
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let systemPrompt = "";
    let userPrompt = "";

    if (mode === "analyze") {
      systemPrompt = `You are a behavioral psychologist and communication analyst. Analyze the user's writing patterns and create a detailed profile.`;
      userPrompt = `Analyze these ${messageCount} messages from a user and create their digital twin profile.

Messages:
${messageSample}

Memories:
${memoryContext}

Output in EXACTLY this format:
TONE: [1-2 word descriptor, e.g. "casual-analytical", "formal-precise", "enthusiastic-curious"]
VOCABULARY: [common words/phrases they use, comma separated]
SENTENCE_STYLE: [short/medium/long, simple/complex, active/passive]
TOPICS: [their main interests, comma separated]
PERSONALITY: [2-3 sentence personality summary]
COMMUNICATION_STYLE: [2-3 sentences about how they communicate]
STRENGTHS: [what they're good at based on their messages]
GROWTH_AREAS: [where they could improve]`;
    } else if (mode === "tone-mirror") {
      systemPrompt = `You are a writing assistant that perfectly mimics a specific user's communication style. You write EXACTLY like them — same tone, vocabulary, sentence structure, quirks, and personality. You ARE their digital clone.`;
      userPrompt = `Here are sample messages from the user whose style you must clone:
${messageSample}

Their stored profile:
${memoryContext}

Now, write a response to this topic AS THE USER (in their exact style, tone, vocabulary):
"${topic || "Introduce yourself and your interests"}"

Write naturally as them. Don't explain that you're mimicking — just BE them.`;
    } else if (mode === "interview-clone") {
      systemPrompt = `You are simulating how a specific person would answer in a job interview, based on their communication patterns, knowledge, and personality. Answer EXACTLY as they would — with their strengths AND weaknesses showing.`;
      userPrompt = `User's message history (showing their knowledge and style):
${messageSample}

Their profile:
${memoryContext}

Interview question: "${question || "Tell me about yourself and your experience."}"

Answer this EXACTLY as this user would — same style, knowledge level, confidence level. Include their typical phrases and patterns. Be realistic — show both their strengths and where they'd struggle.

Then on a new line write:
CLONE_SCORE: [1-10 how well they'd do]
CLONE_FEEDBACK: [what the real person should improve to answer this better]`;
    } else if (mode === "future-you") {
      systemPrompt = `You are creating a "6-months-improved" version of a specific user. You know their current level, weaknesses, and style. You respond as the UPGRADED version of them — same personality but with improved skills, deeper knowledge, more confidence, and better articulation.`;
      userPrompt = `Current user's messages (showing their current level):
${messageSample}

Their profile and weak areas:
${memoryContext}

Topic/Question: "${topic || "How would you explain your expertise?"}"

Write TWO responses:
1. **CURRENT YOU**: How they'd respond right now (realistic, with their current limitations)
2. **FUTURE YOU (6 months)**: How they'd respond after 6 months of focused improvement — same personality but sharper, more confident, deeper knowledge, better structured

Make both feel authentic to the person. The gap should be motivating, not discouraging.`;
    } else if (mode === "predict") {
      systemPrompt = `You are predicting how a specific user would respond to a message, based on their communication history. You know their style, opinions, knowledge, and personality deeply.`;
      userPrompt = `User's message history:
${messageSample}

Their profile:
${memoryContext}

Someone asks them: "${question || "What do you think about AI?"}"

Predict 3 possible responses this user would give, from most likely to least likely:
PREDICTION_1: [most likely response, 2-3 sentences in their style]
CONFIDENCE_1: [0-100%]
PREDICTION_2: [alternative response]
CONFIDENCE_2: [0-100%]
PREDICTION_3: [least likely but possible]
CONFIDENCE_3: [0-100%]`;
    } else {
      return new Response(JSON.stringify({ error: "Invalid mode" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 2048,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("Shadow clone error:", response.status, errText);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content?.trim() || "";

    return new Response(JSON.stringify({ result: content, messageCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("shadow-clone error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
