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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { action, scenarioType, history, decision } = await req.json();

    let prompt: string;

    if (action === "start") {
      prompt = `You are a real-world professional scenario simulator. Create an immersive, high-pressure scenario for the user.

SCENARIO TYPE: ${scenarioType}

Generate a scenario in EXACTLY this format:

===SCENARIO===
TITLE: [dramatic, specific title]
TYPE: ${scenarioType}
SETTING: [where/when this happens - be vivid]
STAKES: [what's at risk]
PRESSURE: [1-10 pressure level]

===SITUATION===
[2-3 paragraphs describing the situation in second person ("You are..."). Make it vivid, realistic, and stressful. Include specific details like names, numbers, deadlines. End on a cliffhanger moment where a decision is needed NOW.]

===CHOICES===
CHOICE_A: [first option - the safe/conventional route]
RISK_A: [what could go wrong]
CHOICE_B: [second option - the bold/creative route]
RISK_B: [what could go wrong]
CHOICE_C: [third option - the unconventional/risky route]
RISK_C: [what could go wrong]

Do NOT include any other text outside this format.`;
    } else if (action === "decide") {
      const historyText = history.map((h: any) => 
        `ROUND ${h.round}: Situation: ${h.situation}\nUser chose: ${h.decision}`
      ).join("\n\n");

      prompt = `You are a real-world professional scenario simulator continuing an interactive scenario.

SCENARIO HISTORY:
${historyText}

LATEST DECISION: ${decision}

Continue the scenario based on this decision. Show realistic consequences - don't always make things work out. Sometimes good decisions have bad luck, sometimes risky moves pay off.

Generate the next beat in EXACTLY this format:

===CONSEQUENCE===
[1-2 paragraphs showing immediate consequences of their decision. Be specific about what happens. Reference previous events. Make it dramatic.]

===NEW_SITUATION===
[1-2 paragraphs presenting the new challenge that has emerged from their decision. The stakes should escalate. End on another decision point.]

===METRICS===
TEAM_MORALE: [0-100]
REPUTATION: [0-100]  
BUDGET_REMAINING: [0-100]
TIME_PRESSURE: [0-100, higher = more urgent]
OVERALL_SCORE: [0-100]

===CHOICES===
CHOICE_A: [first option]
RISK_A: [risk]
CHOICE_B: [second option]
RISK_B: [risk]
CHOICE_C: [third option]
RISK_C: [risk]

If after 4+ rounds, or if the scenario should end naturally, instead use:

===CONSEQUENCE===
[final outcome]

===FINALE===
OUTCOME: [success/partial_success/failure]
SUMMARY: [2-3 sentences summarizing the journey]
KEY_LESSON: [the main takeaway]
PERFORMANCE_GRADE: [A/B/C/D/F]
STRENGTHS: [2-3 things user did well, comma separated]
WEAKNESSES: [2-3 things to improve, comma separated]`;
    } else {
      throw new Error("Invalid action");
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a ruthlessly realistic scenario simulator. Never sugarcoat. Make consequences feel real. Maintain tension." },
          { role: "user", content: prompt },
        ],
        max_tokens: 3000,
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limit. Try again later." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "Credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      console.error("Scenario sim error:", response.status);
      return new Response(JSON.stringify({ error: "AI service error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content?.trim() || "";

    return new Response(JSON.stringify({ result: content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("scenario-sim error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
