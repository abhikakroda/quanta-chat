import { supabase } from "@/integrations/supabase/client";

export type Message = { role: "user" | "assistant"; content: string };

export type ModelId = "auto" | "gemini-flash" | "gemini-pro" | "gemini-flash-lite" | "gpt5-mini" | "gpt5" | "mistral" | "minimax" | "glm" | "kimi" | "swan";

export const MODELS: { id: ModelId; label: string; supportsThinking?: boolean; premium?: boolean }[] = [
  { id: "auto", label: "Auto", supportsThinking: true },
  { id: "gemini-flash", label: "Gemini Flash", supportsThinking: true },
  { id: "gemini-pro", label: "Gemini Pro", supportsThinking: true },
  { id: "gemini-flash-lite", label: "Flash Lite" },
  { id: "mistral", label: "Mistral", supportsThinking: true },
  { id: "minimax", label: "MiniMax" },
  { id: "glm", label: "GLM" },
  { id: "kimi", label: "Kimi", supportsThinking: true },
  { id: "swan", label: "Swan" },
  { id: "gpt5-mini", label: "GPT-5 Mini", supportsThinking: true },
  { id: "gpt5", label: "GPT-5", supportsThinking: true },
];

export function getModelLabel(modelId: ModelId): string {
  return MODELS.find((m) => m.id === modelId)?.label || modelId;
}

// Auto-select the best model based on the active skill/tool
const AUTO_MODEL_MAP: Record<string, ModelId> = {
  "code-assistant": "gemini-pro",
  "deep-research": "gemini-pro",
  "summarizer": "gemini-flash",
  "writer": "gemini-flash",
  "conversational-agent": "gemini-flash",
  "translator": "gemini-flash",
  "voice-chat": "gemini-flash",
  "calculator": "gemini-flash",
  "image-describer": "gemini-flash",
  "vision": "gemini-flash",
  "task-scheduler": "gemini-flash",
  "news": "gemini-flash-lite",
  "web-scraper": "gemini-flash",
};

export function resolveAutoModel(model: ModelId, activeSkill?: string | null, lastMessage?: string): ModelId {
  if (model !== "auto") return model;
  if (activeSkill && AUTO_MODEL_MAP[activeSkill]) return AUTO_MODEL_MAP[activeSkill];
  
  if (lastMessage) {
    const lower = lastMessage.toLowerCase();
    if (/\b(code|function|class|debug|error|bug|api|javascript|python|typescript|react|html|css|sql|algorithm|regex)\b/.test(lower)) {
      return "gemini-pro";
    }
    if (/\b(research|analyze|compare|study|investigate|explain in detail|comprehensive|deep dive)\b/.test(lower)) {
      return "gemini-pro";
    }
    if (/\b(calculate|math|equation|formula|solve|compute|integral|derivative)\b/.test(lower)) {
      return "gemini-flash";
    }
  }
  
  return "gemini-flash";
}

const AGENT_SYSTEM_PROMPT = `You are an advanced AI agent capable of multi-step reasoning and task chaining. When given a complex task:

1. Break it down into clear numbered steps: **Step 1:**, **Step 2:**, etc.
2. Execute each step thoroughly before moving to the next.
3. Show your work and reasoning for each step.
4. If you need to continue working, end your response with exactly: [CONTINUE]
5. If you are done with all steps, end with: [DONE]

**Task Chaining:** When the user chains multiple tasks (e.g., "summarize X, then extract insights, then draft tweets"), execute them sequentially in numbered steps, building each output on the previous one. Never skip a chained task.

Always think step-by-step. Use the best tool/approach for each sub-task. Be thorough and professional.`;

const VERIFY_PROMPT = `\n\n**IMPORTANT - Self-Verification Mode is ON:**
Before providing your final answer, you MUST:
1. Complete your initial response
2. Add a "---" separator
3. Add a **✅ Verification** section where you:
   - Re-check all facts and claims for accuracy
   - Verify any code compiles/runs logically
   - Confirm calculations are correct
   - Flag any uncertainties with ⚠️
   - Rate your confidence: 🟢 High | 🟡 Medium | 🔴 Low
Only then present the verified answer.`;

export type ThinkingLevel = "off" | "normal" | "deep";

const THINKING_LEVEL_CONFIG: Record<ThinkingLevel, { enabled: boolean; prompt?: string }> = {
  off: { enabled: false },
  normal: { enabled: true },
  deep: { enabled: true, prompt: "\n\nThink VERY deeply and thoroughly about this. Consider multiple angles, edge cases, potential issues, and alternative approaches before responding. Take your time — quality over speed." },
};

export async function streamChat({
  messages,
  model = "gemini-flash",
  enableThinking = true,
  thinkingLevel = "off",
  selfVerify = false,
  projectMemory,
  skillPrompt,
  activeSkill,
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
  thinkingLevel?: ThinkingLevel;
  selfVerify?: boolean;
  projectMemory?: string;
  skillPrompt?: string;
  activeSkill?: string | null;
  agentMode?: boolean;
  imageData?: { base64: string; mimeType: string };
  onThinkingDelta?: (text: string) => void;
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
  onAgentStep?: (step: number, total: number | null) => void;
  signal?: AbortSignal;
}) {
  const lastMsg = messages[messages.length - 1]?.content || "";
  const resolvedModel = resolveAutoModel(model || "auto", activeSkill, lastMsg);
  const effectiveModel = agentMode ? "gemini-pro" : resolvedModel;
  
  const thinkingConfig = thinkingLevel !== "off" ? THINKING_LEVEL_CONFIG[thinkingLevel] : { enabled: enableThinking };
  const effectiveThinking = agentMode ? true : thinkingConfig.enabled;
  
  let basePrompt = skillPrompt || "";
  if (thinkingConfig.prompt) basePrompt += thinkingConfig.prompt;
  if (selfVerify) basePrompt += VERIFY_PROMPT;
  if (projectMemory) basePrompt = `**Project Memory (persistent context):**\n${projectMemory}\n\n${basePrompt}`;
  
  const effectiveSkillPrompt = agentMode
    ? (basePrompt ? `${AGENT_SYSTEM_PROMPT}\n\nAdditional context: ${basePrompt}` : AGENT_SYSTEM_PROMPT)
    : (basePrompt || undefined);

  let currentMessages = [...messages];
  let agentStep = 1;
  const maxSteps = 5;

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
    if (imageData && agentStep === 1) {
      bodyPayload.imageData = imageData;
    } else if (imageData && !agentMode) {
      bodyPayload.imageData = imageData;
    }

    let resp: Response;
    try {
      const fetchController = new AbortController();
      const timeoutId = setTimeout(() => fetchController.abort(), 60000);
      signal?.addEventListener("abort", () => fetchController.abort());
      
      resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify(bodyPayload),
        signal: fetchController.signal,
      });
      
      clearTimeout(timeoutId);
    } catch (fetchErr: any) {
      if (signal?.aborted) return;
      onError(fetchErr.message || "Network error");
      return;
    }

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: "Request failed" }));
      onError(err.error || `Request failed (${resp.status})`);
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

    try {
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
            if (agentMode && stepContent.trim().endsWith("[CONTINUE]") && agentStep < maxSteps) {
              const cleanContent = stepContent.replace(/\[CONTINUE\]\s*$/, "").trim();
              currentMessages = [
                ...currentMessages,
                { role: "assistant" as const, content: cleanContent },
                { role: "user" as const, content: "Continue with the next step." },
              ];
              agentStep++;
              await runStep();
              return;
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

                const markerMatch = remaining.match(/\[(CONTINUE|DONE)\]\s*$/);
                if (markerMatch) {
                  const before = remaining.slice(0, markerMatch.index);
                  if (before) { onDelta(before); stepContent += before; }
                  stepContent += markerMatch[0];
                  remaining = "";
                } else {
                  onDelta(remaining);
                  stepContent += remaining;
                  remaining = "";
                }
              }
            }
          } catch { /* partial JSON */ }
        }
      }
    } catch (streamErr: any) {
      if (signal?.aborted) return;
    }
    onDone();
  };

  await runStep();
}
