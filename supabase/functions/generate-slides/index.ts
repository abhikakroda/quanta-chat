import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SLIDE_SYSTEM_PROMPT = `You are an expert presentation designer. Generate a slide deck from the given content.

OUTPUT FORMAT: Return ONLY a valid JSON array of slide objects. No markdown, no code fences, no explanation.

Each slide object must have:
- "title": string (slide heading)
- "subtitle": string (optional subheading, can be empty)
- "content": array of strings (bullet points or text blocks, 3-6 items max)
- "layout": one of "title", "content", "two-column", "quote", "image-text", "stats"
- "notes": string (presenter notes)
- "accent": one of "blue", "purple", "green", "orange", "red", "teal" (color theme for the slide)

RULES:
- First slide MUST be layout "title" with the presentation title and subtitle
- Last slide should be a summary or conclusion
- Keep bullet points concise (under 15 words each)
- Use varied layouts for visual interest
- Generate 6-12 slides depending on content depth
- For "stats" layout, content items should be "Label: Value" format
- For "quote" layout, first content item is the quote, second is attribution
- For "two-column" layout, content alternates between left and right columns`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { documentText, fileName, slideCount, style } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const userPrompt = `Create a ${slideCount || "8-10"} slide presentation from this document.
Style: ${style || "professional"}
Document: "${fileName || "Document"}"

Content:
${(documentText || "").slice(0, 15000)}

Return ONLY the JSON array of slides. No other text.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SLIDE_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 8192,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted. Please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("Slide gen error:", response.status, errText);
      throw new Error("Slide generation failed");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    
    // Extract JSON from response (handle potential markdown code blocks)
    let jsonStr = content.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }
    
    const slides = JSON.parse(jsonStr);

    return new Response(JSON.stringify({ slides }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-slides error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
