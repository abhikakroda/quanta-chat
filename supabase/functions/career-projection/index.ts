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

    const { goal, currentSkills, experience } = await req.json();
    if (!goal?.trim()) {
      return new Response(JSON.stringify({ error: "Goal is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Fetch user memories for context
    const { data: memories } = await supabase
      .from("user_memories")
      .select("key, value, category")
      .limit(40);

    const memoryContext = memories?.length
      ? memories.map((m: any) => `${m.category}/${m.key}: ${m.value}`).join("\n")
      : "";

    const prompt = `You are a career intelligence engine. Analyze this career goal and provide a comprehensive projection.

GOAL: "${goal}"
${currentSkills ? `CURRENT SKILLS: ${currentSkills}` : ""}
${experience ? `EXPERIENCE: ${experience}` : ""}
${memoryContext ? `USER PROFILE:\n${memoryContext}` : ""}

Provide analysis in EXACTLY this structured format. Use real market data and realistic estimates.

===SKILL_GAPS===
List 5-7 specific skills they need. For each:
SKILL: [name]
CURRENT: [0-100 estimated current level]
REQUIRED: [0-100 required level]
PRIORITY: [critical/high/medium]
TIME: [estimated weeks to learn]
---

===MARKET_ANALYSIS===
DIFFICULTY: [1-100]
COMPETITION: [low/medium/high/extreme]
SALARY_RANGE: [realistic range in USD]
DEMAND_TREND: [declining/stable/growing/booming]
OPENINGS_ESTIMATE: [approximate monthly job openings globally]
MARKET_SUMMARY: [2-3 sentences about market reality]

===PROBABILITY===
PROBABILITY_6M: [0-100]
PROBABILITY_1Y: [0-100]
PROBABILITY_2Y: [0-100]
FACTORS_FOR: [3 factors increasing chances, comma separated]
FACTORS_AGAINST: [3 factors that could block them, comma separated]

===ALTERNATIVES===
List 3 alternative career paths. For each:
ALT_TITLE: [job title]
ALT_COMPANY_TYPES: [types of companies]
ALT_DIFFICULTY: [1-100, relative to main goal]
ALT_SALARY: [range]
ALT_WHY: [1 sentence why this is a good alternative]
---

===RISK_SIMULATION===
BEST_CASE: [2 sentences - everything goes right]
LIKELY_CASE: [2 sentences - realistic outcome]
WORST_CASE: [2 sentences - things go wrong]
PIVOT_TRIGGER: [1 sentence - when should they pivot]

===ROADMAP===
MONTH_1_3: [key actions, comma separated]
MONTH_4_6: [key actions, comma separated]
MONTH_7_12: [key actions, comma separated]
YEAR_2: [key actions, comma separated]`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a career intelligence analyst with deep knowledge of tech industry hiring, skill requirements, and market trends. Be realistic and data-driven. Never sugarcoat." },
          { role: "user", content: prompt },
        ],
        max_tokens: 4096,
        temperature: 0.5,
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
      console.error("Projection error:", response.status);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content?.trim() || "";

    return new Response(JSON.stringify({ result: content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("career-projection error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
