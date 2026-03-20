import { supabase } from "@/integrations/supabase/client";

/**
 * Shared streaming AI helper for tool components.
 * Properly calls the chat edge function with SSE parsing.
 */
export async function streamAI(
  prompt: string,
  systemPrompt: string,
  onChunk: (text: string) => void,
  model = "gemini-flash"
): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) { onChunk("Error: Not authenticated"); return ""; }

  const resp = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: prompt }],
        model,
        enableThinking: false,
        skillPrompt: systemPrompt,
      }),
    }
  );

  if (!resp.ok || !resp.body) { onChunk("Error: Failed to get response"); return ""; }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let idx: number;
    while ((idx = buffer.indexOf("\n")) !== -1) {
      let line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (!line.startsWith("data: ")) continue;
      const json = line.slice(6).trim();
      if (json === "[DONE]") break;
      try {
        const parsed = JSON.parse(json);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) {
          fullText += content;
          onChunk(fullText);
        }
      } catch { /* partial JSON chunk */ }
    }
  }

  return fullText;
}
