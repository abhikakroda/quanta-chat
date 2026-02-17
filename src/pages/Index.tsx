import { useState, useRef, useEffect, useCallback } from "react";
import { Menu, Moon, Sun, Brain, ChevronDown } from "lucide-react";
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
  const [thinkingEnabled, setThinkingEnabled] = useState(true);
  const [selectedModel, setSelectedModel] = useState<ModelId>("qwen");
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const { dark, toggle: toggleTheme } = useTheme();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamContent, streamThinking]);

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-pulse text-muted-foreground">Loading...</div></div>;
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

    // Save user message
    await supabase.from("messages").insert({ conversation_id: convId, role: "user" as const, content: input });

    // Build messages for API
    const allMessages: Message[] = [
      ...messages.map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: input },
    ];

    // Optimistically show user message
    setMessages((prev: any) => [...prev, { id: crypto.randomUUID(), conversation_id: convId!, role: "user", content: input, created_at: new Date().toISOString() }]);

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
        // Save assistant message (store thinking as metadata prefix)
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

        // Update conversation title if first message
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

  const hasMessages = messages.length > 0 || streaming;

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
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="flex items-center gap-3 px-4 py-3 border-b border-border bg-background/80 backdrop-blur-sm">
          <button onClick={() => setSidebarOpen(true)} className="md:hidden p-2 rounded-lg hover:bg-accent">
            <Menu className="w-5 h-5 text-foreground" />
          </button>
          <h2 className="font-semibold text-foreground truncate flex-1">
            {activeId ? conversations.find((c) => c.id === activeId)?.title || "Chat" : "Quanta AI"}
          </h2>
          <div className="relative">
            <button
              onClick={() => setModelMenuOpen((o) => !o)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border bg-card hover:bg-accent transition-colors text-foreground"
            >
              {MODELS.find((m) => m.id === selectedModel)?.label}
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            {modelMenuOpen && (
              <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-lg shadow-lg z-50 min-w-[140px] py-1">
                {MODELS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => { setSelectedModel(m.id); setModelMenuOpen(false); }}
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-accent transition-colors ${selectedModel === m.id ? 'text-primary font-medium' : 'text-foreground'}`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => setThinkingEnabled((t) => !t)}
            className={`p-2 rounded-lg transition-colors ${thinkingEnabled ? 'bg-primary/15 text-primary' : 'hover:bg-accent text-muted-foreground'}`}
            aria-label="Toggle thinking mode"
            title={thinkingEnabled ? "Thinking mode on" : "Thinking mode off"}
          >
            <Brain className="w-5 h-5" />
          </button>
          <button onClick={toggleTheme} className="p-2 rounded-lg hover:bg-accent transition-colors" aria-label="Toggle theme">
            {dark ? <Sun className="w-5 h-5 text-foreground" /> : <Moon className="w-5 h-5 text-foreground" />}
          </button>
        </header>

        {/* Messages */}
        {hasMessages ? (
          <div ref={scrollRef} className="flex-1 overflow-y-auto">
            {messages.map((m) => {
              let thinking: string | undefined;
              let displayContent = m.content;
              const thinkMatch = m.content.match(/^<!--thinking:(.+?)-->(.*)$/s);
              if (thinkMatch) {
                try { thinking = decodeURIComponent(atob(thinkMatch[1])); } catch { /* ignore */ }
                displayContent = thinkMatch[2];
              }
              return <ChatMessage key={m.id} role={m.role} content={displayContent} thinking={thinking} />;
            })}
            {streaming && (streamThinking || streamContent) && (
              <ChatMessage
                role="assistant"
                content={streamContent}
                thinking={streamThinking || undefined}
                isThinking={isThinkingPhase}
              />
            )}
            {streaming && !streamContent && (
              <div className="flex gap-3 px-4 py-4 max-w-3xl mx-auto">
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
                  <div className="w-2 h-2 rounded-full bg-primary-foreground animate-pulse" />
                </div>
                <div className="rounded-2xl px-4 py-3 bg-chat-ai border border-border rounded-bl-md">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <WelcomeScreen onSuggestion={handleSend} />
        )}

        <ChatInput onSend={handleSend} disabled={streaming} />
      </div>
    </div>
  );
}
