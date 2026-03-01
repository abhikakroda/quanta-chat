import { useState, useEffect, useCallback } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Props = {
  lastAssistantMessage: string;
  lastUserMessage: string;
  onSelect: (suggestion: string) => void;
  visible: boolean;
};

export default function FollowUpSuggestions({ lastAssistantMessage, lastUserMessage, onSelect, visible }: Props) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);

  const generateSuggestions = useCallback(async () => {
    if (!lastAssistantMessage || !lastUserMessage || generated) return;
    setLoading(true);
    setGenerated(true);

    try {
      const { data, error } = await supabase.functions.invoke("chat", {
        body: {
          messages: [
            {
              role: "user",
              content: `Based on this conversation, suggest exactly 3 short follow-up questions the user might ask next. Each should be under 10 words, natural, and diverse.

User asked: "${lastUserMessage.slice(0, 200)}"
Assistant replied: "${lastAssistantMessage.slice(0, 500)}"

Reply with ONLY 3 lines, one question per line, no numbering, no bullets.`,
            },
          ],
          model: "mistral",
          enableThinking: false,
          skillPrompt: "You generate concise follow-up suggestions. Output only the 3 questions, nothing else.",
        },
      });

      if (error) throw error;

      // Handle streaming response - read as text
      const text = typeof data === "string" ? data : JSON.stringify(data);
      
      // Parse SSE response to extract content
      let content = "";
      const lines = text.split("\n");
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const json = line.slice(6).trim();
          if (json === "[DONE]") continue;
          try {
            const parsed = JSON.parse(json);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) content += delta;
          } catch { /* partial */ }
        }
      }

      // If we got content from SSE, use it. Otherwise try direct content
      const finalContent = content || (typeof data === "object" && data?.choices?.[0]?.message?.content) || "";
      
      const parsed = finalContent
        .split("\n")
        .map((l: string) => l.replace(/^\d+[\.\)]\s*/, "").replace(/^[-•]\s*/, "").trim())
        .filter((l: string) => l.length > 5 && l.length < 80)
        .slice(0, 3);

      if (parsed.length > 0) setSuggestions(parsed);
    } catch (err) {
      console.error("Follow-up generation failed:", err);
    } finally {
      setLoading(false);
    }
  }, [lastAssistantMessage, lastUserMessage, generated]);

  useEffect(() => {
    if (visible && !generated) {
      const timer = setTimeout(generateSuggestions, 800);
      return () => clearTimeout(timer);
    }
  }, [visible, generated, generateSuggestions]);

  // Reset when messages change
  useEffect(() => {
    setSuggestions([]);
    setGenerated(false);
  }, [lastUserMessage]);

  if (!visible || (suggestions.length === 0 && !loading)) return null;

  return (
    <div className="max-w-[640px] mx-auto px-4 sm:px-6 pb-2 animate-fade-in">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Sparkles className="w-3 h-3 text-primary/50" />
        <span className="text-[10px] text-muted-foreground/50">Follow up</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {loading && suggestions.length === 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/50 text-xs text-muted-foreground">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Thinking…</span>
          </div>
        )}
        {suggestions.map((s, i) => (
          <button
            key={i}
            onClick={() => onSelect(s)}
            className="px-3 py-1.5 rounded-full border border-border/50 bg-card text-xs text-foreground/70 hover:bg-accent hover:text-foreground transition-colors touch-manipulation press-scale"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
