import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CATEGORIES = [
  { id: "system-design", label: "System Design", questions: [
    "Design a URL shortener like bit.ly that handles 100M daily requests.",
    "Design a real-time chat system for 10M concurrent users.",
    "Design a distributed cache system with automatic eviction.",
    "Design a notification system that handles 1B push notifications daily.",
    "Design an e-commerce inventory system that prevents overselling.",
  ]},
  { id: "debugging", label: "Production Debugging", questions: [
    "Your API latency jumped from 50ms to 2s at 3 AM. Database CPU is at 95%. What do you do?",
    "Users report intermittent 502 errors. Your monitoring shows no server errors. Investigate.",
    "Memory usage is climbing 1% per hour in production. How do you find and fix the leak?",
    "A deployment caused 30% of payments to fail silently. How do you investigate and rollback safely?",
    "Your microservice mesh has a cascading failure. 3 services are down. Prioritize recovery.",
  ]},
  { id: "architecture", label: "Architecture Decisions", questions: [
    "Monolith vs microservices for a 10-person startup with 50K users. Defend your choice.",
    "SQL vs NoSQL for a social media feed with 100M posts. Justify with trade-offs.",
    "Should you build or buy an authentication system? Your team has 4 engineers.",
    "Event-driven vs request-response for an order processing pipeline. Argue your case.",
    "Kubernetes vs serverless for a variable-traffic SaaS product. Make the call.",
  ]},
  { id: "leadership", label: "Engineering Leadership", questions: [
    "Your best engineer wants to rewrite the entire backend in Rust. The current Python stack works. How do you handle it?",
    "Two senior engineers have conflicting architectural visions. The team is split. Resolve it.",
    "You need to cut 30% of planned features to hit the launch date. How do you decide what stays?",
    "A junior dev shipped a bug that cost $50K. The team wants consequences. What do you do?",
    "Your team's velocity dropped 40% after going remote. Morale is low. Fix it.",
  ]},
  { id: "startup", label: "Startup Survival", questions: [
    "You have 3 months of runway. Revenue is growing 5% MoM but you need 15%. What's your play?",
    "A competitor just raised $50M and is copying your product. You have $2M. Strategy?",
    "Your co-founder wants to pivot. You disagree. The board is split. Navigate this.",
    "Your biggest client (40% revenue) threatens to leave unless you build a custom feature. Decide.",
    "You got a $10M acquisition offer. Your startup is 18 months old with $500K ARR. Take it or not?",
  ]},
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) throw new Error("Not authenticated");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    // User client for auth
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: authData, error: authError } = await userClient.auth.getClaims(token);
    if (authError || !authData?.claims?.sub) throw new Error("Not authenticated");
    const userId = authData.claims.sub as string;

    // Service client for admin operations
    const adminClient = createClient(supabaseUrl, serviceKey);

    const { action, battleId, category, answer } = await req.json();

    if (action === "create") {
      const cat = CATEGORIES.find(c => c.id === category) || CATEGORIES[0];
      const question = cat.questions[Math.floor(Math.random() * cat.questions.length)];

      const { data: battle, error } = await adminClient
        .from("battles")
        .insert({ creator_id: userId, category: cat.id, question, difficulty: "medium" })
        .select()
        .single();

      if (error) throw error;
      return new Response(JSON.stringify({ battle }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "join") {
      const { data: battle, error: fetchErr } = await adminClient
        .from("battles")
        .select("*")
        .eq("id", battleId)
        .single();

      if (fetchErr || !battle) throw new Error("Battle not found");
      if (battle.status !== "waiting") throw new Error("Battle already started");
      if (battle.creator_id === userId) throw new Error("Can't join your own battle");

      const { error: updateErr } = await adminClient
        .from("battles")
        .update({ opponent_id: userId, status: "active" })
        .eq("id", battleId);

      if (updateErr) throw updateErr;
      return new Response(JSON.stringify({ battle: { ...battle, opponent_id: userId, status: "active" } }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "submit") {
      // Check battle exists and user is participant
      const { data: battle } = await adminClient.from("battles").select("*").eq("id", battleId).single();
      if (!battle) throw new Error("Battle not found");
      if (battle.creator_id !== userId && battle.opponent_id !== userId) throw new Error("Not a participant");

      // Check if already submitted
      const { data: existing } = await adminClient
        .from("battle_submissions")
        .select("id")
        .eq("battle_id", battleId)
        .eq("user_id", userId);
      if (existing && existing.length > 0) throw new Error("Already submitted");

      // Insert submission
      await adminClient.from("battle_submissions").insert({ battle_id: battleId, user_id: userId, answer });

      // Check if both submitted
      const { data: allSubs } = await adminClient
        .from("battle_submissions")
        .select("*")
        .eq("battle_id", battleId);

      if (allSubs && allSubs.length >= 2) {
        // Both submitted - judge!
        const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
        if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

        const sub1 = allSubs[0];
        const sub2 = allSubs[1];

        const judgePrompt = `You are an expert technical judge for a career battle competition. 
Judge these two answers to the same question fairly and objectively.

QUESTION: "${battle.question}"
CATEGORY: ${battle.category}

ANSWER A:
${sub1.answer}

ANSWER B:
${sub2.answer}

Score each answer 0-100 based on:
- Technical accuracy (30%)
- Depth of reasoning (25%)
- Practical applicability (25%)
- Communication clarity (20%)

Respond in EXACTLY this format:
SCORE_A: [0-100]
SCORE_B: [0-100]
FEEDBACK_A: [2-3 sentences about Answer A's strengths and weaknesses]
FEEDBACK_B: [2-3 sentences about Answer B's strengths and weaknesses]
WINNER: [A or B or DRAW]
VERDICT: [1 sentence dramatic verdict]`;

        const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              { role: "system", content: "You are a fair, precise technical judge. Never show bias." },
              { role: "user", content: judgePrompt },
            ],
            max_tokens: 1000,
            temperature: 0.3,
          }),
        });

        if (!aiResp.ok) throw new Error("AI judging failed");

        const aiResult = await aiResp.json();
        const judgeText = aiResult.choices?.[0]?.message?.content?.trim() || "";

        const gv = (key: string) => judgeText.match(new RegExp(`${key}:\\s*(.+)`, "i"))?.[1]?.trim() || "";
        const scoreA = parseInt(gv("SCORE_A")) || 50;
        const scoreB = parseInt(gv("SCORE_B")) || 50;
        const feedbackA = gv("FEEDBACK_A");
        const feedbackB = gv("FEEDBACK_B");
        const winnerLetter = gv("WINNER").toUpperCase();

        // Update submissions with scores
        await adminClient.from("battle_submissions").update({ score: scoreA, feedback: feedbackA }).eq("id", sub1.id);
        await adminClient.from("battle_submissions").update({ score: scoreB, feedback: feedbackB }).eq("id", sub2.id);

        // Determine winner
        let winnerId: string | null = null;
        if (winnerLetter === "A") winnerId = sub1.user_id;
        else if (winnerLetter === "B") winnerId = sub2.user_id;

        // Update battle
        await adminClient.from("battles").update({
          status: "completed",
          winner_id: winnerId,
        }).eq("id", battleId);

        // Update leaderboard for both
        for (const sub of allSubs) {
          const isWinner = sub.user_id === winnerId;
          const isDraw = winnerId === null;

          // Upsert leaderboard
          const { data: existing } = await adminClient
            .from("battle_leaderboard")
            .select("*")
            .eq("user_id", sub.user_id)
            .single();

          if (existing) {
            await adminClient.from("battle_leaderboard").update({
              wins: existing.wins + (isWinner ? 1 : 0),
              losses: existing.losses + (!isWinner && !isDraw ? 1 : 0),
              draws: existing.draws + (isDraw ? 1 : 0),
              total_score: existing.total_score + sub.score,
              streak: isWinner ? existing.streak + 1 : isDraw ? existing.streak : 0,
            }).eq("user_id", sub.user_id);
          } else {
            await adminClient.from("battle_leaderboard").insert({
              user_id: sub.user_id,
              wins: isWinner ? 1 : 0,
              losses: !isWinner && !isDraw ? 1 : 0,
              draws: isDraw ? 1 : 0,
              total_score: sub.score,
              streak: isWinner ? 1 : 0,
            });
          }
        }

        return new Response(JSON.stringify({
          judged: true,
          verdict: gv("VERDICT"),
          winner: winnerLetter,
          scores: { a: scoreA, b: scoreB },
          feedback: { a: feedbackA, b: feedbackB },
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ judged: false, message: "Waiting for opponent" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "leaderboard") {
      const { data } = await adminClient
        .from("battle_leaderboard")
        .select("*")
        .order("wins", { ascending: false })
        .limit(20);

      return new Response(JSON.stringify({ leaderboard: data || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "list-open") {
      const { data } = await adminClient
        .from("battles")
        .select("*")
        .eq("status", "waiting")
        .neq("creator_id", userId)
        .order("created_at", { ascending: false })
        .limit(10);

      return new Response(JSON.stringify({ battles: data || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "status") {
      const { data: battle } = await adminClient.from("battles").select("*").eq("id", battleId).single();
      const { data: subs } = await adminClient.from("battle_submissions").select("*").eq("battle_id", battleId);
      return new Response(JSON.stringify({ battle, submissions: subs || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Invalid action");
  } catch (e) {
    console.error("battle error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
