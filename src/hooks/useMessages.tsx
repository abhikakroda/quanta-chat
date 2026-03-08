import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type DBMessage = {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

const MSG_CACHE_PREFIX = "quanta-msgs-";

function getCachedMessages(convId: string): DBMessage[] {
  try {
    const cached = localStorage.getItem(MSG_CACHE_PREFIX + convId);
    if (cached) return JSON.parse(cached);
  } catch { /* ignore */ }
  return [];
}

function setCachedMessages(convId: string, messages: DBMessage[]) {
  try {
    // Keep only last 20 conversations cached to avoid quota issues
    const keys = Object.keys(localStorage).filter((k) => k.startsWith(MSG_CACHE_PREFIX));
    if (keys.length > 20) {
      // Remove oldest cached conversation
      localStorage.removeItem(keys[0]);
    }
    localStorage.setItem(MSG_CACHE_PREFIX + convId, JSON.stringify(messages));
  } catch { /* ignore quota errors */ }
}

export function useMessages(conversationId: string | null) {
  const [messages, setMessages] = useState<DBMessage[]>(() =>
    conversationId ? getCachedMessages(conversationId) : []
  );
  const [loading, setLoading] = useState(false);
  const skipNextFetchRef = useRef(false);

  const skipNextFetch = useCallback(() => {
    skipNextFetchRef.current = true;
  }, []);

  const fetchMessages = useCallback(async () => {
    if (!conversationId) { setMessages([]); return; }
    if (skipNextFetchRef.current) {
      skipNextFetchRef.current = false;
      return;
    }
    // Show cached immediately
    const cached = getCachedMessages(conversationId);
    if (cached.length > 0) setMessages(cached);
    
    setLoading(true);
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    if (data) {
      setMessages(data as DBMessage[]);
      setCachedMessages(conversationId, data as DBMessage[]);
    }
    setLoading(false);
  }, [conversationId]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  // Wrapper to also update cache when messages change
  const setMessagesWithCache = useCallback((updater: DBMessage[] | ((prev: DBMessage[]) => DBMessage[])) => {
    setMessages((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      if (conversationId) setCachedMessages(conversationId, next);
      return next;
    });
  }, [conversationId]);

  const addMessage = async (role: "user" | "assistant", content: string) => {
    if (!conversationId) return;
    const { data } = await supabase
      .from("messages")
      .insert({ conversation_id: conversationId, role, content })
      .select()
      .single();
    if (data) {
      setMessagesWithCache((prev) => [...prev, data as DBMessage]);
    }
    return data;
  };

  return { messages, loading, addMessage, setMessages: setMessagesWithCache, refetch: fetchMessages };
}
