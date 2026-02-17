import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type DBMessage = {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

export function useMessages(conversationId: string | null) {
  const [messages, setMessages] = useState<DBMessage[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchMessages = useCallback(async () => {
    if (!conversationId) { setMessages([]); return; }
    setLoading(true);
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    if (data) setMessages(data as DBMessage[]);
    setLoading(false);
  }, [conversationId]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  const addMessage = async (role: "user" | "assistant", content: string) => {
    if (!conversationId) return;
    const { data } = await supabase
      .from("messages")
      .insert({ conversation_id: conversationId, role, content })
      .select()
      .single();
    if (data) setMessages((prev) => [...prev, data as DBMessage]);
    return data;
  };

  return { messages, loading, addMessage, setMessages, refetch: fetchMessages };
}
