import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type UserMemory = {
  id: string;
  key: string;
  value: string;
  category: string;
  updated_at: string;
};

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
      .limit(50);
    if (data) setMemories(data as UserMemory[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchMemories(); }, [fetchMemories]);

  const upsertMemory = useCallback(async (key: string, value: string, category = "preference") => {
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

  const getMemoryContext = useCallback((): string => {
    if (memories.length === 0) return "";
    const lines = memories.map(m => `• ${m.key}: ${m.value}`);
    return `**User Memory (remembered preferences):**\n${lines.join("\n")}`;
  }, [memories]);

  return { memories, loading, upsertMemory, deleteMemory, fetchMemories, getMemoryContext };
}

// Extract memory-worthy facts from AI responses
const MEMORY_PATTERNS = [
  { regex: /(?:my name is|i'm called|call me)\s+([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/i, key: "user_name" },
  { regex: /(?:i prefer|i like|i love)\s+(.{3,60}?)(?:\.|,|$)/i, key: "preference" },
  { regex: /(?:i work (?:at|for|in)|my company is)\s+(.{3,40}?)(?:\.|,|$)/i, key: "workplace" },
  { regex: /(?:i'm a|i am a|my role is|i work as)\s+(.{3,40}?)(?:\.|,|$)/i, key: "role" },
  { regex: /(?:i use|i'm using|my stack is)\s+(.{3,60}?)(?:\.|,|$)/i, key: "tech_stack" },
  { regex: /(?:my language is|i speak|respond in)\s+(\w+)/i, key: "language" },
  { regex: /(?:my timezone is|i'm in)\s+([A-Z]{2,5}[+-]?\d*|[A-Za-z\/]+)/i, key: "timezone" },
];

export function extractMemories(userMessage: string): { key: string; value: string }[] {
  const found: { key: string; value: string }[] = [];
  for (const { regex, key } of MEMORY_PATTERNS) {
    const match = userMessage.match(regex);
    if (match?.[1]) {
      const value = match[1].trim();
      if (value.length >= 2 && value.length <= 100) {
        // Make keys unique for generic ones
        const uniqueKey = key === "preference" ? `preference_${value.slice(0, 20).replace(/\s+/g, "_").toLowerCase()}` : key;
        found.push({ key: uniqueKey, value });
      }
    }
  }
  return found;
}
