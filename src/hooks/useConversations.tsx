import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type Conversation = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

export function useConversations() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConversations = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("conversations")
      .select("*")
      .order("updated_at", { ascending: false });
    if (data) setConversations(data);
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
    setConversations((prev) => [data, ...prev]);
    return data;
  };

  const updateTitle = async (id: string, title: string) => {
    await supabase.from("conversations").update({ title }).eq("id", id);
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, title } : c)));
  };

  const deleteConversation = async (id: string) => {
    await supabase.from("conversations").delete().eq("id", id);
    setConversations((prev) => prev.filter((c) => c.id !== id));
  };

  return { conversations, loading, createConversation, updateTitle, deleteConversation, refetch: fetchConversations };
}
