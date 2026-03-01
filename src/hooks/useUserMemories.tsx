import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type UserMemory = {
  id: string;
  key: string;
  value: string;
  category: string;
  updated_at: string;
};

export type MemoryCategory =
  | "identity"
  | "learning_style"
  | "weak_topics"
  | "writing_tone"
  | "coding_patterns"
  | "interview_performance"
  | "preference";

export function useUserMemories(userId: string | undefined) {
  const [memories, setMemories] = useState<UserMemory[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchMemories = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data } = await supabase
      .from("user_memories")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(80);
    if (data) setMemories(data as UserMemory[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchMemories(); }, [fetchMemories]);

  const upsertMemory = useCallback(async (key: string, value: string, category: MemoryCategory = "preference") => {
    if (!userId) return;
    const { data } = await supabase
      .from("user_memories")
      .upsert({ user_id: userId, key, value, category }, { onConflict: "user_id,key" })
      .select()
      .single();
    if (data) {
      setMemories(prev => {
        const filtered = prev.filter(m => m.key !== key);
        return [data as UserMemory, ...filtered];
      });
    }
  }, [userId]);

  const deleteMemory = useCallback(async (key: string) => {
    if (!userId) return;
    await supabase.from("user_memories").delete().eq("user_id", userId).eq("key", key);
    setMemories(prev => prev.filter(m => m.key !== key));
  }, [userId]);

  const getMemoriesByCategory = useCallback((category: MemoryCategory): UserMemory[] => {
    return memories.filter(m => m.category === category);
  }, [memories]);

  const getMemoryContext = useCallback((): string => {
    if (memories.length === 0) return "";

    const sections: string[] = [];

    const grouped: Record<string, UserMemory[]> = {};
    for (const m of memories) {
      if (!grouped[m.category]) grouped[m.category] = [];
      grouped[m.category].push(m);
    }

    const categoryLabels: Record<string, string> = {
      identity: "🪪 Identity",
      learning_style: "📚 Learning Style",
      weak_topics: "⚠️ Weak Areas (needs improvement)",
      writing_tone: "✍️ Writing Style",
      coding_patterns: "💻 Coding Patterns & Mistakes",
      interview_performance: "🎤 Interview Performance",
      preference: "⚙️ Preferences",
    };

    const categoryOrder: string[] = [
      "identity", "learning_style", "weak_topics",
      "coding_patterns", "interview_performance",
      "writing_tone", "preference",
    ];

    for (const cat of categoryOrder) {
      const items = grouped[cat];
      if (!items?.length) continue;
      const label = categoryLabels[cat] || cat;
      const lines = items.map(m => `  • ${m.key}: ${m.value}`);
      sections.push(`${label}\n${lines.join("\n")}`);
    }

    if (sections.length === 0) return "";
    return `**🧠 AI Memory Persona (remembered about this user):**\n\n${sections.join("\n\n")}`;
  }, [memories]);

  return { memories, loading, upsertMemory, deleteMemory, fetchMemories, getMemoryContext, getMemoriesByCategory };
}

// ---- Persona extraction patterns ----

const IDENTITY_PATTERNS: { regex: RegExp; key: string }[] = [
  { regex: /(?:my name is|i'm called|call me)\s+([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/i, key: "user_name" },
  { regex: /(?:i work (?:at|for|in)|my company is)\s+(.{3,40}?)(?:\.|,|$)/i, key: "workplace" },
  { regex: /(?:i'm a|i am a|my role is|i work as)\s+(.{3,40}?)(?:\.|,|$)/i, key: "role" },
  { regex: /(?:i use|i'm using|my stack is)\s+(.{3,60}?)(?:\.|,|$)/i, key: "tech_stack" },
  { regex: /(?:my language is|i speak|respond in)\s+(\w+)/i, key: "preferred_language" },
  { regex: /(?:my timezone is|i'm in)\s+([A-Z]{2,5}[+-]?\d*|[A-Za-z/]+)/i, key: "timezone" },
];

const LEARNING_PATTERNS: { regex: RegExp; key: string }[] = [
  { regex: /(?:i learn (?:best|better) (?:by|with|through))\s+(.{3,60}?)(?:\.|,|$)/i, key: "learning_method" },
  { regex: /(?:explain (?:things? )?(?:like|as if) i'm|eli5|keep it simple)/i, key: "explanation_level" },
  { regex: /(?:i'm (?:a )?beginner (?:in|at|with))\s+(.{3,40}?)(?:\.|,|$)/i, key: "beginner_in" },
  { regex: /(?:i'm (?:an? )?(?:expert|advanced) (?:in|at|with))\s+(.{3,40}?)(?:\.|,|$)/i, key: "expert_in" },
  { regex: /(?:i prefer|give me)\s+(?:more\s+)?(?:examples|code examples|visual|diagrams)/i, key: "prefers_examples" },
];

const WRITING_PATTERNS: { regex: RegExp; key: string }[] = [
  { regex: /(?:i write in a|my tone is|use a)\s+(formal|casual|professional|friendly|technical|concise|verbose)\s+(?:tone|style|way)/i, key: "writing_tone" },
  { regex: /(?:keep (?:responses?|answers?) )(short|concise|brief|detailed|thorough)/i, key: "response_length" },
];

const CODING_PATTERNS: { regex: RegExp; key: string }[] = [
  { regex: /(?:i always forget|i struggle with|i'm bad at)\s+(.{3,60}?)(?:\.|,|$)/i, key: "struggles_with" },
  { regex: /(?:i keep making|my common mistake is)\s+(.{3,60}?)(?:\.|,|$)/i, key: "common_mistake" },
];

export function extractMemories(userMessage: string): { key: string; value: string; category: MemoryCategory }[] {
  const found: { key: string; value: string; category: MemoryCategory }[] = [];

  const tryExtract = (patterns: { regex: RegExp; key: string }[], category: MemoryCategory) => {
    for (const { regex, key } of patterns) {
      const match = userMessage.match(regex);
      if (match) {
        const value = match[1]?.trim() || "yes";
        if (value.length >= 2 && value.length <= 100) {
          const uniqueKey = key === "preference"
            ? `pref_${value.slice(0, 20).replace(/\s+/g, "_").toLowerCase()}`
            : key;
          found.push({ key: uniqueKey, value, category });
        }
      }
    }
  };

  tryExtract(IDENTITY_PATTERNS, "identity");
  tryExtract(LEARNING_PATTERNS, "learning_style");
  tryExtract(WRITING_PATTERNS, "writing_tone");
  tryExtract(CODING_PATTERNS, "coding_patterns");

  // Generic preference fallback
  const prefMatch = userMessage.match(/(?:i prefer|i like|i love)\s+(.{3,60}?)(?:\.|,|$)/i);
  if (prefMatch?.[1]) {
    const val = prefMatch[1].trim();
    if (val.length >= 2 && val.length <= 100) {
      found.push({ key: `pref_${val.slice(0, 20).replace(/\s+/g, "_").toLowerCase()}`, value: val, category: "preference" });
    }
  }

  return found;
}

// ---- Interview performance tracker ----
export function buildInterviewMemory(
  topic: string,
  level: string,
  avgScore: number,
  weakQuestions: string[]
): { key: string; value: string; category: MemoryCategory }[] {
  const mems: { key: string; value: string; category: MemoryCategory }[] = [];

  mems.push({
    key: `interview_${topic}_${level}`,
    value: `Score: ${avgScore}/10 (${level} level)`,
    category: "interview_performance",
  });

  if (avgScore < 6) {
    mems.push({
      key: `weak_${topic}`,
      value: `Scored ${avgScore}/10 at ${level} level — needs practice`,
      category: "weak_topics",
    });
  }

  for (const q of weakQuestions.slice(0, 2)) {
    mems.push({
      key: `weak_q_${q.slice(0, 30).replace(/\s+/g, "_").toLowerCase()}`,
      value: q.slice(0, 100),
      category: "weak_topics",
    });
  }

  return mems;
}
