import { useState, useRef, useEffect } from "react";
import { Menu, Moon, Sun, Brain, ChevronDown, Sparkles, PanelLeftOpen } from "lucide-react";
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
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center glow-primary animate-float">
            <Sparkles className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-sm text-muted-foreground">Loading...</span>
        </div>
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
        <header className="flex items-center gap-3 px-4 h-12 border-b border-border/60 bg-background/80 backdrop-blur-md shrink-0">
          {/* Mobile menu */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden p-1.5 rounded-lg hover:bg-accent transition-colors"
          >
            <Menu className="w-5 h-5 text-foreground/70" />
          </button>
          {/* Desktop sidebar toggle (only when collapsed) */}
          {sidebarCollapsed && (
            <button
              onClick={() => setSidebarCollapsed(false)}
              className="hidden md:flex p-1.5 rounded-lg hover:bg-accent transition-colors"
              title="Show sidebar"
            >
              <PanelLeftOpen className="w-5 h-5 text-foreground/70" />
            </button>
          )}

          <h2 className="text-sm font-medium text-foreground/80 truncate flex-1">
            {activeId ? conversations.find((c) => c.id === activeId)?.title || "Chat" : "New chat"}
          </h2>

          {/* Model selector */}
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setModelMenuOpen((o) => !o)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all duration-200"
            >
              {selectedModelLabel}
              <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${modelMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            {modelMenuOpen && (
              <div className="absolute right-0 top-full mt-1.5 bg-card border border-border rounded-xl shadow-float z-50 min-w-[160px] py-1 animate-message-in">
                {MODELS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => { setSelectedModel(m.id); setModelMenuOpen(false); }}
                    className={`w-full text-left px-3 py-2 text-xs transition-colors rounded-lg mx-0 ${
                      selectedModel === m.id
                        ? 'text-primary font-semibold bg-accent/50'
                        : 'text-foreground/70 hover:bg-accent/30 hover:text-foreground'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Thinking toggle - only for models that support it */}
          {modelSupportsThinking && (
            <button
              onClick={() => setThinkingEnabled((t) => !t)}
              className={`p-1.5 rounded-lg transition-all duration-200 ${
                thinkingEnabled
                  ? 'text-primary bg-primary/10'
                  : 'text-muted-foreground/50 hover:text-muted-foreground hover:bg-accent/50'
              }`}
              aria-label="Toggle thinking mode"
              title={thinkingEnabled ? "Thinking on" : "Thinking off"}
            >
              <Brain className="w-4 h-4" />
            </button>
          )}

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-lg text-muted-foreground/50 hover:text-muted-foreground hover:bg-accent/50 transition-all duration-200"
            aria-label="Toggle theme"
          >
            {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
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
            {streaming && !streamContent && !streamThinking && (
              <div className="py-5 px-4 bg-muted/30 animate-message-in">
                <div className="max-w-3xl mx-auto flex gap-4">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center">
                    <Sparkles className="w-3.5 h-3.5 text-primary-foreground" />
                  </div>
                  <div className="flex items-center gap-1.5 pt-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: "300ms" }} />
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
