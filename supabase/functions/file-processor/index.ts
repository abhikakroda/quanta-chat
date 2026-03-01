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

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data, error: authError } = await supabase.auth.getClaims(token);
    if (authError || !data?.claims?.sub) throw new Error("Not authenticated");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { content, fileName, fileType, mode } = await req.json();
    if (!content?.trim()) throw new Error("File content is required");

    const truncatedContent = content.slice(0, 30000);

    const modePrompts: Record<string, string> = {
      summary: `Analyze this file and create a comprehensive summary.

FILE: "${fileName}" (${fileType})
CONTENT:
${truncatedContent}

Provide in this EXACT format:

===OVERVIEW===
[2-3 sentence overview of what this file/document contains]

===KEY_POINTS===
- [Key point 1]
- [Key point 2]
- [Key point 3]
- [Key point 4]
- [Key point 5]
(list 5-10 key points)

===STRUCTURE===
[Describe the structure/organization of the content]

===STATISTICS===
TYPE: [document type - code/data/text/config]
COMPLEXITY: [low/medium/high]
TOPICS: [comma-separated main topics]
WORD_COUNT: [approximate]
SECTIONS: [number of sections/functions/tables]`,

      notes: `Transform this file into structured study notes.

FILE: "${fileName}" (${fileType})
CONTENT:
${truncatedContent}

Create structured notes in this EXACT format:

===TITLE===
[Clear title for the notes]

===SECTIONS===
Each section should follow this pattern (create 3-8 sections):

HEADING: [section title]
NOTES:
- [concise note point]
- [concise note point]
- [concise note point]
KEY_TAKEAWAY: [one sentence takeaway]
---

===CONNECTIONS===
- [How concept A relates to concept B]
- [How concept C builds on concept D]
(list 3-5 connections between topics)

===ACTION_ITEMS===
- [What to study/practice further]
- [What to research more]`,

      flashcards: `Create flashcards from this file content for effective memorization.

FILE: "${fileName}" (${fileType})
CONTENT:
${truncatedContent}

Generate 8-15 flashcards in this EXACT format:

===FLASHCARDS===
For each card:
Q: [clear, specific question]
A: [concise, accurate answer]
DIFFICULTY: [easy/medium/hard]
---

Make questions test understanding, not just recall. Cover the most important concepts.`,

      quiz: `Create a quiz from this file content to test comprehension.

FILE: "${fileName}" (${fileType})
CONTENT:
${truncatedContent}

Generate a quiz in this EXACT format:

===QUIZ===
TITLE: [quiz title]
TOTAL: [number of questions]

For each question:
Q[number]: [question text]
A) [option A]
B) [option B]
C) [option C]
D) [option D]
CORRECT: [A/B/C/D]
EXPLANATION: [why this is correct - 1 sentence]
---

Create 8-12 questions. Mix difficulty levels. Include conceptual and applied questions.`,
    };

    const prompt = modePrompts[mode] || modePrompts.summary;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are an expert document analyst and educator. Extract maximum value from files. Be precise and thorough." },
          { role: "user", content: prompt },
        ],
        max_tokens: 4096,
        temperature: 0.4,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limit. Try again later." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "Credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error("AI service error");
    }

    const result = await response.json();
    const output = result.choices?.[0]?.message?.content?.trim() || "";

    return new Response(JSON.stringify({ result: output }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("file-processor error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
