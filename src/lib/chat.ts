import { supabase } from "@/integrations/supabase/client";

export type Message = { role: "user" | "assistant"; content: string };

export type ModelId = "qwen" | "mistral" | "minimax" | "deepseek" | "sarvam";

export const MODELS: { id: ModelId; label: string; supportsThinking?: boolean }[] = [
  { id: "qwen", label: "Qwen 3.5", supportsThinking: true },
  { id: "mistral", label: "Mistral Small" },
  { id: "minimax", label: "MiniMax M2.1" },
  { id: "deepseek", label: "DeepSeek V3.2", supportsThinking: true },
  { id: "sarvam", label: "Sarvam M" },
];

export async function streamChat({
  messages,
  model = "qwen",
  enableThinking = true,
  onThinkingDelta,
  onDelta,
  onDone,
  onError,
  signal,
}: {
  messages: Message[];
  model?: ModelId;
  enableThinking?: boolean;
  onThinkingDelta?: (text: string) => void;
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
  signal?: AbortSignal;
}) {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) { onError("Not authenticated"); return; }

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify({ messages, enableThinking, model }),
    signal,
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: "Request failed" }));
    onError(err.error || "Request failed");
    return;
  }

  if (!resp.body) {
    onError("No response body");
    return;
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let inThinking = false;
  let thinkingDone = false;

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
      if (json === "[DONE]") { onDone(); return; }
      try {
        const parsed = JSON.parse(json);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) {
          // Parse <think>...</think> tags from the stream
          let remaining = content as string;

          while (remaining.length > 0) {
            if (!inThinking && !thinkingDone) {
              // Look for <think> opening tag
              const thinkStart = remaining.indexOf("<think>");
              if (thinkStart !== -1) {
                // Text before <think> goes to answer
                const before = remaining.slice(0, thinkStart);
                if (before) onDelta(before);
                inThinking = true;
                remaining = remaining.slice(thinkStart + 7);
                continue;
              }
            }

            if (inThinking) {
              // Look for </think> closing tag
              const thinkEnd = remaining.indexOf("</think>");
              if (thinkEnd !== -1) {
                const thinkContent = remaining.slice(0, thinkEnd);
                if (thinkContent && onThinkingDelta) onThinkingDelta(thinkContent);
                inThinking = false;
                thinkingDone = true;
                remaining = remaining.slice(thinkEnd + 8);
                continue;
              } else {
                // All remaining is thinking content
                if (onThinkingDelta) onThinkingDelta(remaining);
                remaining = "";
                continue;
              }
            }

            // Normal answer content
            onDelta(remaining);
            remaining = "";
          }
        }
      } catch { /* partial */ }
    }
  }
  onDone();
}
