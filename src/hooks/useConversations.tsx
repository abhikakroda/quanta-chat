import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type Conversation = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  starred: boolean;
};

const CACHE_KEY = "quanta-conversations-cache";

function getCachedConversations(): Conversation[] {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) return JSON.parse(cached);
  } catch { /* ignore */ }
  return [];
}

function setCachedConversations(conversations: Conversation[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(conversations));
  } catch { /* ignore quota errors */ }
}

export function useConversations() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>(() => getCachedConversations());
  const [loading, setLoading] = useState(true);

  const fetchConversations = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("conversations")
      .select("*")
      .order("updated_at", { ascending: false });
    if (data) {
      setConversations(data as Conversation[]);
      setCachedConversations(data as Conversation[]);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  const createConversation = async (title = "New Chat") => {
    if (!user) return null;
    const { data, error } = await supabase
      .from("conversations")
      .insert({ user_id: user.id, title })
      .select()
      .single();
    if (error || !data) return null;
    const conv = data as Conversation;
    setConversations((prev) => {
      const next = [conv, ...prev];
      setCachedConversations(next);
      return next;
    });
    return conv;
  };

  const updateTitle = async (id: string, title: string) => {
    await supabase.from("conversations").update({ title }).eq("id", id);
    setConversations((prev) => {
      const next = prev.map((c) => (c.id === id ? { ...c, title } : c));
      setCachedConversations(next);
      return next;
    });
  };

  const toggleStar = async (id: string) => {
    const conv = conversations.find(c => c.id === id);
    if (!conv) return;
    const newStarred = !conv.starred;
    await supabase.from("conversations").update({ starred: newStarred }).eq("id", id);
    setConversations((prev) => {
      const next = prev.map((c) => (c.id === id ? { ...c, starred: newStarred } : c));
      setCachedConversations(next);
      return next;
    });
  };

  const deleteConversation = async (id: string) => {
    await supabase.from("conversations").delete().eq("id", id);
    setConversations((prev) => {
      const next = prev.filter((c) => c.id !== id);
      setCachedConversations(next);
      return next;
    });
  };

  return { conversations, loading, createConversation, updateTitle, deleteConversation, toggleStar, refetch: fetchConversations };
}
