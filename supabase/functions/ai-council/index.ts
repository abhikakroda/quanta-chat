import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PERSONAS = {
  engineer: {
    name: "Practical Engineer",
    emoji: "🔧",
    system: `You are a pragmatic senior engineer with 15+ years of experience shipping products. You care about:
- What actually works in production
- Technical debt and maintainability
- Realistic timelines and engineering effort
- Battle-tested solutions over trendy ones
You're skeptical of over-engineering and theoretical solutions. You speak directly, use concrete examples, and always consider edge cases. You push back on impractical ideas.`,
  },
  professor: {
    name: "Theoretical Professor",
    emoji: "🎓",
    system: `You are a computer science professor and researcher with deep theoretical knowledge. You care about:
- Algorithmic correctness and complexity analysis
- Design patterns and architectural purity
- Long-term scalability and formal reasoning
- Research-backed approaches
You reference papers, use precise terminology, and think in abstractions. You sometimes clash with practical shortcuts but bring rigorous analysis.`,
  },
  founder: {
    name: "Startup Founder",
    emoji: "🚀",
    system: `You are a serial startup founder who has built and sold 3 companies. You care about:
- Speed to market and MVP thinking
- Customer value and business impact
- Resource constraints and prioritization
- Growth metrics and competitive advantage
You're impatient with perfection, obsessed with shipping fast, and always thinking about the business angle. You challenge over-engineering and academic approaches.`,
  },
  manager: {
    name: "Corporate Manager",
    emoji: "👔",
    system: `You are a VP of Engineering at a Fortune 500 company. You care about:
- Team dynamics and organizational impact
- Risk management and compliance
- Process, documentation, and knowledge transfer
- Stakeholder alignment and communication
You think about people, politics, and process. You bring the "enterprise" perspective and often see risks others miss. You sometimes frustrate engineers with process requirements.`,
  },
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

    const { question, debateHistory } = await req.json();
    if (!question?.trim()) {
      return new Response(JSON.stringify({ error: "Question is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build context from previous debate rounds
    const historyContext = debateHistory?.length
      ? "\n\nPREVIOUS DEBATE ROUNDS:\n" + debateHistory.map((round: any) =>
          `${round.persona} said: "${round.response}"`
        ).join("\n")
      : "";

    // Get all 4 persona responses in parallel
    const personaKeys = Object.keys(PERSONAS) as (keyof typeof PERSONAS)[];
    const responses = await Promise.all(
      personaKeys.map(async (key) => {
        const persona = PERSONAS[key];
        const prompt = `The following question/topic has been brought to a council of experts for debate.

QUESTION: "${question}"
${historyContext}

Give your perspective in 2-3 paragraphs. Be opinionated and specific. If other council members have spoken, directly reference and challenge or build on their points. Don't be generic - take a clear stance.

End with a one-line VERDICT that summarizes your position in a punchy way.`;

        try {
          const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-3-flash-preview",
              messages: [
                { role: "system", content: persona.system },
                { role: "user", content: prompt },
              ],
              max_tokens: 1000,
              temperature: 0.8,
            }),
          });

          if (!resp.ok) {
            console.error(`${key} persona error:`, resp.status);
            return { key, name: persona.name, emoji: persona.emoji, response: "Failed to generate response.", error: true };
          }

          const result = await resp.json();
          const content = result.choices?.[0]?.message?.content?.trim() || "No response generated.";
          return { key, name: persona.name, emoji: persona.emoji, response: content, error: false };
        } catch (e) {
          console.error(`${key} error:`, e);
          return { key, name: persona.name, emoji: persona.emoji, response: "Error generating response.", error: true };
        }
      })
    );

    // Generate a synthesis/moderator summary
    const allResponses = responses.map(r => `${r.name}: ${r.response}`).join("\n\n");
    let synthesis = "";
    try {
      const synthResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: "You are a neutral moderator synthesizing a debate between 4 experts. Identify areas of agreement, key disagreements, and provide a balanced recommendation. Be concise." },
            { role: "user", content: `QUESTION: "${question}"\n\nDEBATE:\n${allResponses}\n\nProvide:\n1. CONSENSUS: What all/most agree on (1-2 sentences)\n2. KEY DISAGREEMENT: The main point of contention (1-2 sentences)\n3. RECOMMENDATION: Your balanced advice considering all perspectives (2-3 sentences)` },
          ],
          max_tokens: 500,
          temperature: 0.3,
        }),
      });
      if (synthResp.ok) {
        const synthResult = await synthResp.json();
        synthesis = synthResult.choices?.[0]?.message?.content?.trim() || "";
      }
    } catch { /* ignore synthesis failure */ }

    return new Response(JSON.stringify({ responses, synthesis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("council error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
