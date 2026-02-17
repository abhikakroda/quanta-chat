import { useState, useRef, useEffect } from "react";
import { Menu, Moon, Sun, Brain, ChevronDown, PanelLeftOpen } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { useConversations } from "@/hooks/useConversations";
import { useMessages } from "@/hooks/useMessages";
import { streamChat, Message, MODELS, ModelId } from "@/lib/chat";
import ChatSidebar from "@/components/ChatSidebar";
import ChatMessage from "@/components/ChatMessage";
import ChatInput from "@/components/ChatInput";
import WelcomeScreen from "@/components/WelcomeScreen";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export default function Index() {
  const { user, loading: authLoading } = useAuth();
  const { conversations, createConversation, deleteConversation, updateTitle, refetch } = useConversations();
  const [activeId, setActiveId] = useState<string | null>(null);
  const { messages, addMessage, setMessages } = useMessages(activeId);
  const [streaming, setStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState("");
  const [streamThinking, setStreamThinking] = useState("");
  const [isThinkingPhase, setIsThinkingPhase] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [thinkingEnabled, setThinkingEnabled] = useState(true);
  const [selectedModel, setSelectedModel] = useState<ModelId>("qwen");
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const { dark, toggle: toggleTheme } = useTheme();
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamContent, streamThinking]);

  // Close model menu on outside click
  useEffect(() => {
    if (!modelMenuOpen) return;
    const handler = () => setModelMenuOpen(false);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [modelMenuOpen]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <span className="text-sm text-muted-foreground animate-pulse">Loading…</span>
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;

  const handleSend = async (input: string) => {
    let convId = activeId;

    if (!convId) {
      const conv = await createConversation(input.slice(0, 50));
      if (!conv) return;
      convId = conv.id;
      setActiveId(conv.id);
    }

    await supabase.from("messages").insert({ conversation_id: convId, role: "user" as const, content: input });

    const allMessages: Message[] = [
      ...messages.map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: input },
    ];

    setMessages((prev: any) => [...prev, { id: crypto.randomUUID(), conversation_id: convId!, role: "user", content: input, created_at: new Date().toISOString() }]);

    const controller = new AbortController();
    abortRef.current = controller;
    setStreaming(true);
    setStreamContent("");
    setStreamThinking("");
    setIsThinkingPhase(thinkingEnabled);
    let fullContent = "";
    let fullThinking = "";

    await streamChat({
      messages: allMessages,
      model: selectedModel,
      enableThinking: thinkingEnabled,
      signal: controller.signal,
      onThinkingDelta: (text) => {
        fullThinking += text;
        setStreamThinking(fullThinking);
      },
      onDelta: (text) => {
        setIsThinkingPhase(false);
        fullContent += text;
        setStreamContent(fullContent);
      },
      onDone: async () => {
        const savedContent = fullThinking
          ? `<!--thinking:${btoa(encodeURIComponent(fullThinking))}-->${fullContent}`
          : fullContent;
        const { data } = await supabase
          .from("messages")
          .insert({ conversation_id: convId!, role: "assistant" as const, content: savedContent })
          .select()
          .single();
        if (data) {
          setMessages((prev) => [...prev, data as any]);
        }
        setStreamContent("");
        setStreamThinking("");
        setIsThinkingPhase(false);
        setStreaming(false);

        if (messages.length === 0) {
          await updateTitle(convId!, input.slice(0, 50));
        }
      },
      onError: (err) => {
        setStreamContent("");
        setStreamThinking("");
        setIsThinkingPhase(false);
        setStreaming(false);
        console.error(err);
      },
    });
  };

  const handleStop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
    setStreamContent("");
    setStreamThinking("");
    setIsThinkingPhase(false);
  };

  const handleNewChat = async () => {
    setActiveId(null);
    setSidebarOpen(false);
  };

  const handleSelectConv = (id: string) => {
    setActiveId(id);
    setSidebarOpen(false);
  };

  const handleDelete = async (id: string) => {
    await deleteConversation(id);
    if (activeId === id) setActiveId(null);
  };

  const handleEditMessage = async (messageIndex: number, newContent: string) => {
    if (!activeId || streaming) return;
    // Remove this message and all after it from DB
    const toDelete = messages.slice(messageIndex);
    for (const m of toDelete) {
      await supabase.from("messages").delete().eq("id", m.id);
    }
    // Update local state
    setMessages(messages.slice(0, messageIndex));
    // Resend with edited content
    handleSend(newContent);
  };

  const handleRegenerate = async (assistantIndex: number) => {
    if (!activeId || streaming) return;
    // Find the user message before this assistant message
    const userMsg = messages.slice(0, assistantIndex).reverse().find((m) => m.role === "user");
    if (!userMsg) return;
    // Delete the assistant message from DB and local state
    await supabase.from("messages").delete().eq("id", messages[assistantIndex].id);
    setMessages(messages.filter((_, i) => i !== assistantIndex));
    // Resend the previous user message
    // Build history up to (but not including) the deleted assistant message
    const history: Message[] = messages
      .slice(0, assistantIndex)
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    const controller = new AbortController();
    abortRef.current = controller;
    setStreaming(true);
    setStreamContent("");
    setStreamThinking("");
    setIsThinkingPhase(thinkingEnabled);
    let fullContent = "";
    let fullThinking = "";

    await streamChat({
      messages: history,
      model: selectedModel,
      enableThinking: thinkingEnabled,
      signal: controller.signal,
      onThinkingDelta: (text) => { fullThinking += text; setStreamThinking(fullThinking); },
      onDelta: (text) => { setIsThinkingPhase(false); fullContent += text; setStreamContent(fullContent); },
      onDone: async () => {
        const savedContent = fullThinking
          ? `<!--thinking:${btoa(encodeURIComponent(fullThinking))}-->${fullContent}`
          : fullContent;
        const { data } = await supabase
          .from("messages")
          .insert({ conversation_id: activeId!, role: "assistant" as const, content: savedContent })
          .select()
          .single();
        if (data) setMessages((prev) => [...prev, data as any]);
        setStreamContent(""); setStreamThinking(""); setIsThinkingPhase(false); setStreaming(false);
      },
      onError: (err) => {
        setStreamContent(""); setStreamThinking(""); setIsThinkingPhase(false); setStreaming(false);
        console.error(err);
      },
    });
  };

  const hasMessages = messages.length > 0 || streaming;
  const selectedModelLabel = MODELS.find((m) => m.id === selectedModel)?.label;
  const modelSupportsThinking = MODELS.find((m) => m.id === selectedModel)?.supportsThinking ?? false;

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <ChatSidebar
        conversations={conversations}
        activeId={activeId}
        onSelect={handleSelectConv}
        onNew={handleNewChat}
        onDelete={handleDelete}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="flex items-center gap-2 px-3 h-11 border-b border-border shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="md:hidden p-1 rounded-md hover:bg-accent transition-colors">
            <Menu className="w-4 h-4 text-muted-foreground" />
          </button>
          {sidebarCollapsed && (
            <button onClick={() => setSidebarCollapsed(false)} className="hidden md:flex p-1 rounded-md hover:bg-accent transition-colors">
              <PanelLeftOpen className="w-4 h-4 text-muted-foreground" />
            </button>
          )}

          <span className="text-[13px] text-muted-foreground truncate flex-1">
            {activeId ? conversations.find((c) => c.id === activeId)?.title || "Chat" : ""}
          </span>

          {/* Model selector */}
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setModelMenuOpen((o) => !o)}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              {selectedModelLabel}
              <ChevronDown className={`w-3 h-3 transition-transform duration-150 ${modelMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            {modelMenuOpen && (
              <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-lg shadow-float z-50 min-w-[140px] py-0.5 animate-message-in">
                {MODELS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => { setSelectedModel(m.id); setModelMenuOpen(false); }}
                    className={`w-full text-left px-2.5 py-1.5 text-xs transition-colors ${
                      selectedModel === m.id ? 'text-foreground font-medium bg-accent' : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {modelSupportsThinking && (
            <button
              onClick={() => setThinkingEnabled((t) => !t)}
              className={`p-1 rounded-md transition-colors ${thinkingEnabled ? 'text-foreground' : 'text-muted-foreground/40 hover:text-muted-foreground'}`}
              title={thinkingEnabled ? "Thinking on" : "Thinking off"}
            >
              <Brain className="w-3.5 h-3.5" />
            </button>
          )}

          <button onClick={toggleTheme} className="p-1 rounded-md text-muted-foreground/40 hover:text-muted-foreground transition-colors">
            {dark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>
        </header>

        {/* Messages */}
        {hasMessages ? (
          <div ref={scrollRef} className="flex-1 overflow-y-auto">
            {messages.map((m, i) => {
              let thinking: string | undefined;
              let displayContent = m.content;

              // Handle <!--thinking:base64--> format
              const thinkMatch = m.content.match(/^<!--thinking:(.+?)-->(.*)$/s);
              if (thinkMatch) {
                try { thinking = decodeURIComponent(atob(thinkMatch[1])); } catch { /* ignore */ }
                displayContent = thinkMatch[2];
              }

              // Handle raw <think>...</think> tags in stored content
              const rawThinkMatch = displayContent.match(/^<think>([\s\S]*?)<\/think>([\s\S]*)$/);
              if (rawThinkMatch) {
                thinking = rawThinkMatch[1].trim();
                displayContent = rawThinkMatch[2].trim();
              }

              return (
                <ChatMessage
                  key={m.id}
                  role={m.role}
                  content={displayContent}
                  thinking={thinking}
                  onEdit={m.role === "user" && !streaming ? (newContent) => handleEditMessage(i, newContent) : undefined}
                  onRegenerate={m.role === "assistant" && !streaming ? () => handleRegenerate(i) : undefined}
                />
              );
            })}
            {streaming && (streamThinking || streamContent) && (
              <ChatMessage
                role="assistant"
                content={streamContent}
                thinking={streamThinking || undefined}
                isThinking={isThinkingPhase}
              />
            )}
            {streaming && !streamContent && !streamThinking && (
              <div className="py-4 px-4 animate-message-in">
                <div className="max-w-2xl mx-auto flex gap-3">
                  <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-semibold text-muted-foreground">Q</div>
                  <div className="flex items-center gap-1 pt-1">
                    <div className="w-1 h-1 rounded-full bg-muted-foreground/30 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-1 h-1 rounded-full bg-muted-foreground/30 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-1 h-1 rounded-full bg-muted-foreground/30 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <WelcomeScreen onSuggestion={handleSend} />
        )}

        <ChatInput onSend={handleSend} onStop={handleStop} disabled={streaming} streaming={streaming} />
      </div>
    </div>
  );
}
