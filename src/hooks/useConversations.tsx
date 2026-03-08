import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type Conversation = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
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
  const deletingRef = useRef<Set<string>>(new Set());

  const fetchConversations = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("conversations")
      .select("*")
      .order("updated_at", { ascending: false });
    if (data) {
      setConversations(data);
      setCachedConversations(data);
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
    setConversations((prev) => {
      const next = [data, ...prev];
      setCachedConversations(next);
      return next;
    });
    return data;
  };

  const updateTitle = async (id: string, title: string) => {
    await supabase.from("conversations").update({ title }).eq("id", id);
    setConversations((prev) => {
      const next = prev.map((c) => (c.id === id ? { ...c, title } : c));
      setCachedConversations(next);
      return next;
    });
  };

  const deleteConversation = async (id: string) => {
    // Guard against duplicate delete calls
    if (deletingRef.current.has(id)) return;
    deletingRef.current.add(id);
    
    // Optimistic removal from UI first
    setConversations((prev) => {
      const next = prev.filter((c) => c.id !== id);
      setCachedConversations(next);
      return next;
    });
    
    try {
      await supabase.from("conversations").delete().eq("id", id);
    } finally {
      deletingRef.current.delete(id);
    }
  };

  return { conversations, loading, createConversation, updateTitle, deleteConversation, refetch: fetchConversations };
}