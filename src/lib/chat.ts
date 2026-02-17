import { supabase } from "@/integrations/supabase/client";

export type Message = { role: "user" | "assistant"; content: string };

export type ModelId = "qwen" | "qwen-coder" | "mistral" | "minimax" | "deepseek" | "sarvam";

export const MODELS: { id: ModelId; label: string; supportsThinking?: boolean }[] = [
  { id: "qwen", label: "Qwen 3.5", supportsThinking: true },
  { id: "qwen-coder", label: "Qwen3 Coder", supportsThinking: true },
  { id: "mistral", label: "Mistral Small" },
  { id: "minimax", label: "MiniMax M2.1" },
  { id: "deepseek", label: "DeepSeek V3.2", supportsThinking: true },
  { id: "sarvam", label: "Sarvam M", supportsThinking: true },
];

const AGENT_SYSTEM_PROMPT = `You are an advanced AI agent capable of multi-step reasoning. When given a complex task:

1. Break it down into clear numbered steps: **Step 1:**, **Step 2:**, etc.
2. Execute each step thoroughly before moving to the next.
3. Show your work and reasoning for each step.
4. If you need to continue working, end your response with exactly: [CONTINUE]
5. If you are done with all steps, end with: [DONE]

Always think step-by-step. Use the best tool/approach for each sub-task. Be thorough and professional.`;

export async function streamChat({
  messages,
  model = "qwen",
  enableThinking = true,
  skillPrompt,
  agentMode = false,
  imageData,
  onThinkingDelta,
  onDelta,
  onDone,
  onError,
  onAgentStep,
  signal,
}: {
  messages: Message[];
  model?: ModelId;
  enableThinking?: boolean;
  skillPrompt?: string;
  agentMode?: boolean;
  imageData?: { base64: string; mimeType: string };
  onThinkingDelta?: (text: string) => void;
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
  onAgentStep?: (step: number, total: number | null) => void;
  signal?: AbortSignal;
}) {
  // Agent mode forces best model and thinking
  const effectiveModel = agentMode ? "qwen" : model;
  const effectiveThinking = agentMode ? true : enableThinking;
  const effectiveSkillPrompt = agentMode
    ? (skillPrompt ? `${AGENT_SYSTEM_PROMPT}\n\nAdditional context: ${skillPrompt}` : AGENT_SYSTEM_PROMPT)
    : skillPrompt;

  let currentMessages = [...messages];
  let agentStep = 1;
  let maxSteps = 5; // Safety limit for auto-continuation
  let fullAgentContent = "";

  const runStep = async (): Promise<void> => {
    if (signal?.aborted) return;

    if (agentMode) {
      onAgentStep?.(agentStep, null);
    }

    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) { onError("Not authenticated"); return; }

    const bodyPayload: any = {
      messages: currentMessages,
      enableThinking: effectiveThinking,
      model: effectiveModel,
      skillPrompt: effectiveSkillPrompt,
    };
    // Only send imageData on the first step
    if (imageData && agentStep === 1) {
      bodyPayload.imageData = imageData;
    } else if (imageData && !agentMode) {
      bodyPayload.imageData = imageData;
    }

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify(bodyPayload),
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
    let stepContent = "";

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
        if (json === "[DONE]") {
          // Check for agent continuation
          if (agentMode && stepContent.trim().endsWith("[CONTINUE]") && agentStep < maxSteps) {
            // Remove [CONTINUE] marker from displayed content
            const cleanContent = stepContent.replace(/\[CONTINUE\]\s*$/, "").trim();
            const delta = cleanContent.slice(fullAgentContent.length);
            if (delta) {
              // Already sent via onDelta, just track
            }
            fullAgentContent = cleanContent + "\n\n";
            
            // Add assistant response to messages for context
            currentMessages = [
              ...currentMessages,
              { role: "assistant" as const, content: cleanContent },
              { role: "user" as const, content: "Continue with the next step." },
            ];
            agentStep++;
            
            // Run next step
            await runStep();
            return;
          }
          
          // Clean up [DONE] marker if present
          if (agentMode && stepContent.trim().endsWith("[DONE]")) {
            // Already streamed, we just finish
          }
          
          onDone();
          return;
        }
        try {
          const parsed = JSON.parse(json);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            let remaining = content as string;

            while (remaining.length > 0) {
              if (!inThinking && !thinkingDone) {
                const thinkStart = remaining.indexOf("<think>");
                if (thinkStart !== -1) {
                  const before = remaining.slice(0, thinkStart);
                  if (before) { onDelta(before); stepContent += before; }
                  inThinking = true;
                  remaining = remaining.slice(thinkStart + 7);
                  continue;
                }
              }

              if (inThinking) {
                const thinkEnd = remaining.indexOf("</think>");
                if (thinkEnd !== -1) {
                  if (effectiveThinking) {
                    const thinkContent = remaining.slice(0, thinkEnd);
                    if (thinkContent && onThinkingDelta) onThinkingDelta(thinkContent);
                  }
                  inThinking = false;
                  thinkingDone = true;
                  remaining = remaining.slice(thinkEnd + 8);
                  continue;
                } else {
                  if (effectiveThinking && onThinkingDelta) onThinkingDelta(remaining);
                  remaining = "";
                  continue;
                }
              }

              // Filter out [CONTINUE] and [DONE] markers from display
              const markerMatch = remaining.match(/\[(CONTINUE|DONE)\]\s*$/);
              if (markerMatch) {
                const before = remaining.slice(0, markerMatch.index);
                if (before) { onDelta(before); stepContent += before; }
                stepContent += markerMatch[0]; // Track but don't display
                remaining = "";
              } else {
                onDelta(remaining);
                stepContent += remaining;
                remaining = "";
              }
            }
          }
        } catch { /* partial */ }
      }
    }
    onDone();
  };

  await runStep();
}
