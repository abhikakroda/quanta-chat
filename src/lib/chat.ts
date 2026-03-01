import { supabase } from "@/integrations/supabase/client";

export type Message = { role: "user" | "assistant"; content: string };

export type ModelId = "auto" | "qwen" | "qwen-coder" | "mistral" | "minimax" | "deepseek" | "sarvam";

export const MODELS: { id: ModelId; label: string; supportsThinking?: boolean }[] = [
  { id: "auto", label: "Auto", supportsThinking: true },
  { id: "qwen", label: "Qwen 3.5", supportsThinking: true },
  { id: "qwen-coder", label: "Qwen3 Coder", supportsThinking: true },
  { id: "mistral", label: "Mistral Small" },
  { id: "minimax", label: "MiniMax M2.1" },
  { id: "deepseek", label: "DeepSeek V3.2", supportsThinking: true },
  { id: "sarvam", label: "Sarvam M", supportsThinking: true },
];

export function getModelLabel(modelId: ModelId): string {
  return MODELS.find((m) => m.id === modelId)?.label || modelId;
}

// Auto-select the best model based on the active skill/tool
const AUTO_MODEL_MAP: Record<string, ModelId> = {
  "code-assistant": "qwen-coder",
  "deep-research": "deepseek",
  "summarizer": "qwen",
  "writer": "mistral",
  
  "conversational-agent": "sarvam",
  "translator": "sarvam",
  "voice-chat": "sarvam",
  "calculator": "qwen",
  "image-describer": "qwen",
  "vision": "qwen",
  "task-scheduler": "mistral",
  "news": "mistral",
  "web-scraper": "qwen",
};

export function resolveAutoModel(model: ModelId, activeSkill?: string | null, lastMessage?: string): ModelId {
  if (model !== "auto") return model;
  if (activeSkill && AUTO_MODEL_MAP[activeSkill]) return AUTO_MODEL_MAP[activeSkill];
  
  // Smart routing: analyze query content
  if (lastMessage) {
    const lower = lastMessage.toLowerCase();
    // Code-related queries
    if (/\b(code|function|class|debug|error|bug|api|javascript|python|typescript|react|html|css|sql|algorithm|regex)\b/.test(lower)) {
      return "qwen-coder";
    }
    // Research/analysis queries
    if (/\b(research|analyze|compare|study|investigate|explain in detail|comprehensive|deep dive)\b/.test(lower)) {
      return "deepseek";
    }
    // Creative/writing queries
    if (/\b(write|essay|story|poem|article|blog|email|letter|creative|draft)\b/.test(lower)) {
      return "mistral";
    }
    // Math/calculation queries
    if (/\b(calculate|math|equation|formula|solve|compute|integral|derivative)\b/.test(lower)) {
      return "qwen";
    }
    // Indian languages or translation
    if (/[\u0900-\u097F\u0A00-\u0A7F\u0B00-\u0B7F\u0C00-\u0C7F\u0D00-\u0D7F]/.test(lower) || /\b(hindi|tamil|telugu|bengali|marathi|gujarati|kannada|malayalam)\b/.test(lower)) {
      return "sarvam";
    }
  }
  
  return "mistral"; // default fallback for general chat
}

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
  // Resolve auto model based on active skill and message content, then agent mode overrides
  const lastMsg = messages[messages.length - 1]?.content || "";
  const resolvedModel = resolveAutoModel(model || "auto", activeSkill, lastMsg);
  const effectiveModel = agentMode ? "qwen" : resolvedModel;
  const effectiveThinking = agentMode ? true : enableThinking;
  const effectiveSkillPrompt = agentMode
    ? (skillPrompt ? `${AGENT_SYSTEM_PROMPT}\n\nAdditional context: ${skillPrompt}` : AGENT_SYSTEM_PROMPT)
    : skillPrompt;

  // Fallback order: try different models if the primary one fails
  const FALLBACK_MODELS: ModelId[] = ["qwen", "mistral", "deepseek", "minimax"];
  
  const getFallbacks = (primary: ModelId): ModelId[] => {
    const others = FALLBACK_MODELS.filter((m) => m !== primary);
    return others;
  };

  let currentMessages = [...messages];
  let agentStep = 1;
  let maxSteps = 5; // Safety limit for auto-continuation
  let fullAgentContent = "";

  const runStep = async (modelToUse?: ModelId, fallbacksLeft?: ModelId[]): Promise<void> => {
    if (signal?.aborted) return;

    const currentModel = modelToUse || effectiveModel;
    const remainingFallbacks = fallbacksLeft ?? getFallbacks(currentModel);

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
      model: currentModel,
      skillPrompt: effectiveSkillPrompt,
    };
    // Only send imageData on the first step
    if (imageData && agentStep === 1) {
      bodyPayload.imageData = imageData;
    } else if (imageData && !agentMode) {
      bodyPayload.imageData = imageData;
    }

    let resp: Response;
    try {
      resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify(bodyPayload),
        signal,
      });
    } catch (fetchErr: any) {
      if (signal?.aborted) return;
      // Network error — try fallback
      if (remainingFallbacks.length > 0) {
        console.warn(`Model ${currentModel} network error, trying ${remainingFallbacks[0]}...`);
        return runStep(remainingFallbacks[0], remainingFallbacks.slice(1));
      }
      onError(fetchErr.message || "Network error");
      return;
    }

    if (!resp.ok) {
      // Model failed — try fallback
      if (remainingFallbacks.length > 0) {
        console.warn(`Model ${currentModel} returned ${resp.status}, trying ${remainingFallbacks[0]}...`);
        return runStep(remainingFallbacks[0], remainingFallbacks.slice(1));
      }
      const err = await resp.json().catch(() => ({ error: "Request failed" }));
      onError(err.error || "Request failed");
      return;
    }

    if (!resp.body) {
      if (remainingFallbacks.length > 0) {
        return runStep(remainingFallbacks[0], remainingFallbacks.slice(1));
      }
      onError("No response body");
      return;
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let inThinking = false;
    let thinkingDone = false;
    let stepContent = "";
    let gotContent = false;

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
            // If we got no content at all and have fallbacks, try next model
            if (!gotContent && remainingFallbacks.length > 0) {
              console.warn(`Model ${currentModel} returned empty, trying ${remainingFallbacks[0]}...`);
              return runStep(remainingFallbacks[0], remainingFallbacks.slice(1));
            }
            
            // Check for agent continuation
            if (agentMode && stepContent.trim().endsWith("[CONTINUE]") && agentStep < maxSteps) {
              const cleanContent = stepContent.replace(/\[CONTINUE\]\s*$/, "").trim();
              fullAgentContent = cleanContent + "\n\n";
              
              currentMessages = [
                ...currentMessages,
                { role: "assistant" as const, content: cleanContent },
                { role: "user" as const, content: "Continue with the next step." },
              ];
              agentStep++;
              
              await runStep(currentModel, getFallbacks(currentModel));
              return;
            }
            
            onDone();
            return;
          }
          try {
            const parsed = JSON.parse(json);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              gotContent = true;
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
          } catch { /* partial */ }
        }
      }
    } catch (streamErr: any) {
      if (signal?.aborted) return;
      // Stream error mid-way — if we got no content, try fallback
      if (!gotContent && remainingFallbacks.length > 0) {
        console.warn(`Model ${currentModel} stream error, trying ${remainingFallbacks[0]}...`);
        return runStep(remainingFallbacks[0], remainingFallbacks.slice(1));
      }
    }
    onDone();
  };

  await runStep();
}
