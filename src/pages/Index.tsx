import { useState, useRef, useEffect } from "react";
import { Moon, Sun, Menu, Atom } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { useConversations } from "@/hooks/useConversations";
import { useMessages } from "@/hooks/useMessages";
import { streamChat, Message, MODELS, ModelId } from "@/lib/chat";
import ChatSidebar, { SKILLS, TOOLS, SkillId } from "@/components/ChatSidebar";
import ChatMessage from "@/components/ChatMessage";
import ChatInput from "@/components/ChatInput";
import WelcomeScreen from "@/components/WelcomeScreen";
import TranslatorTool from "@/components/tools/TranslatorTool";
import CalculatorTool from "@/components/tools/CalculatorTool";
import SummarizerTool from "@/components/tools/SummarizerTool";
import DeepResearcherTool from "@/components/tools/DeepResearcherTool";
import CodeAssistantTool from "@/components/tools/CodeAssistantTool";
import WriterTool from "@/components/tools/WriterTool";
import TaskSchedulerTool from "@/components/tools/TaskSchedulerTool";
import ImageDescriberTool from "@/components/tools/ImageDescriberTool";
import VisionTool from "@/components/tools/VisionTool";
import VoiceChatTool from "@/components/tools/VoiceChatTool";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const TOOL_UI_MAP: Record<string, React.ComponentType> = {
  "calculator": CalculatorTool,
  "translator": TranslatorTool,
  "summarizer": SummarizerTool,
  "deep-research": DeepResearcherTool,
  "code-assistant": CodeAssistantTool,
  "writer": WriterTool,
  "task-scheduler": TaskSchedulerTool,
  "image-describer": ImageDescriberTool,
  "vision": VisionTool,
  "voice-chat": VoiceChatTool,
};

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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [thinkingEnabled, setThinkingEnabled] = useState(true);
  const [agentStep, setAgentStep] = useState<number | null>(null);
  const [selectedModel, setSelectedModel] = useState<ModelId>(() => {
    const saved = localStorage.getItem("quanta-selected-model");
    return (saved as ModelId) || "mistral";
  });

  useEffect(() => {
    localStorage.setItem("quanta-selected-model", selectedModel);
  }, [selectedModel]);
  
  const [agentMode, setAgentMode] = useState(false);
  const [activeSkill, setActiveSkill] = useState<string | null>(null);
  const { dark, toggle: toggleTheme } = useTheme();
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamContent, streamThinking]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <span className="text-sm text-muted-foreground animate-pulse">Loading…</span>
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;

  const ToolUIComponent = activeSkill ? TOOL_UI_MAP[activeSkill] : null;

  const handleSend = async (input: string, files?: { name: string; content: string; type: string }[]) => {
    let convId = activeId;

    if (!convId) {
      const conv = await createConversation(input.slice(0, 50));
      if (!conv) return;
      convId = conv.id;
      setActiveId(conv.id);
    }

    let userContent = input;
    if (files && files.length > 0) {
      const fileSection = files.map((f) => `--- File: ${f.name} ---\n${f.content}`).join("\n\n");
      userContent = `${fileSection}\n\n${input}`;
    }

    await supabase.from("messages").insert({ conversation_id: convId, role: "user" as const, content: userContent });

    const allMessages: Message[] = [
      ...messages.map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: userContent },
    ];

    setMessages((prev: any) => [...prev, { id: crypto.randomUUID(), conversation_id: convId!, role: "user", content: userContent, created_at: new Date().toISOString() }]);

    const controller = new AbortController();
    abortRef.current = controller;
    setStreaming(true);
    setStreamContent("");
    setStreamThinking("");
    setIsThinkingPhase(thinkingEnabled || agentMode);
    setAgentStep(agentMode ? 1 : null);
    let fullContent = "";
    let fullThinking = "";

    const WEB_SCRAPER_PROMPT = "You are a web search and crawling assistant. Help users find information from the web, summarize web pages, extract data from URLs, and perform web research tasks.";
    const skillDef = activeSkill === "web-scraper"
      ? { prompt: WEB_SCRAPER_PROMPT }
      : activeSkill ? (SKILLS.find((s) => s.id === activeSkill) || TOOLS.find((t) => t.id === activeSkill)) : null;

    await streamChat({
      messages: allMessages,
      model: selectedModel,
      enableThinking: thinkingEnabled,
      skillPrompt: skillDef?.prompt,
      agentMode,
      signal: controller.signal,
      onAgentStep: (step) => {
        setAgentStep(step);
      },
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
        // Clean up agent markers from final content
        const cleanContent = fullContent.replace(/\[(CONTINUE|DONE)\]\s*/g, "").trim();
        
        const savedContent = fullThinking
          ? `<!--thinking:${btoa(encodeURIComponent(fullThinking))}-->${cleanContent}`
          : cleanContent;
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
        setAgentStep(null);

        if (messages.length === 0) {
          await updateTitle(convId!, input.slice(0, 50));
        }
      },
      onError: (err) => {
        setStreamContent("");
        setStreamThinking("");
        setIsThinkingPhase(false);
        setStreaming(false);
        setAgentStep(null);
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
    setAgentStep(null);
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
    const toDelete = messages.slice(messageIndex);
    for (const m of toDelete) {
      await supabase.from("messages").delete().eq("id", m.id);
    }
    setMessages(messages.slice(0, messageIndex));
    handleSend(newContent);
  };

  const handleRegenerate = async (assistantIndex: number) => {
    if (!activeId || streaming) return;
    const userMsg = messages.slice(0, assistantIndex).reverse().find((m) => m.role === "user");
    if (!userMsg) return;
    await supabase.from("messages").delete().eq("id", messages[assistantIndex].id);
    setMessages(messages.filter((_, i) => i !== assistantIndex));
    const history: Message[] = messages
      .slice(0, assistantIndex)
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    const controller = new AbortController();
    abortRef.current = controller;
    setStreaming(true);
    setStreamContent("");
    setStreamThinking("");
    setIsThinkingPhase(thinkingEnabled || agentMode);
    setAgentStep(agentMode ? 1 : null);
    let fullContent = "";
    let fullThinking = "";

    const skillDef2 = activeSkill === "web-scraper"
      ? { prompt: "You are a web search and crawling assistant." }
      : activeSkill ? (SKILLS.find((s) => s.id === activeSkill) || TOOLS.find((t) => t.id === activeSkill)) : null;

    await streamChat({
      messages: history,
      model: selectedModel,
      enableThinking: thinkingEnabled,
      skillPrompt: skillDef2?.prompt,
      agentMode,
      signal: controller.signal,
      onAgentStep: (step) => setAgentStep(step),
      onThinkingDelta: (text) => { fullThinking += text; setStreamThinking(fullThinking); },
      onDelta: (text) => { setIsThinkingPhase(false); fullContent += text; setStreamContent(fullContent); },
      onDone: async () => {
        const cleanContent = fullContent.replace(/\[(CONTINUE|DONE)\]\s*/g, "").trim();
        const savedContent = fullThinking
          ? `<!--thinking:${btoa(encodeURIComponent(fullThinking))}-->${cleanContent}`
          : cleanContent;
        const { data } = await supabase
          .from("messages")
          .insert({ conversation_id: activeId!, role: "assistant" as const, content: savedContent })
          .select()
          .single();
        if (data) setMessages((prev) => [...prev, data as any]);
        setStreamContent(""); setStreamThinking(""); setIsThinkingPhase(false); setStreaming(false); setAgentStep(null);
      },
      onError: (err) => {
        setStreamContent(""); setStreamThinking(""); setIsThinkingPhase(false); setStreaming(false); setAgentStep(null);
        console.error(err);
      },
    });
  };

  const hasMessages = messages.length > 0 || streaming;
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
        activeSkill={activeSkill}
        onSelectSkill={setActiveSkill}
        onOpenCrawl={() => {
          setActiveSkill("web-scraper");
          handleNewChat();
        }}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 h-11 shrink-0 glass-subtle border-b border-border/30">
          <button onClick={() => setSidebarOpen(true)} className="md:hidden p-1.5 rounded-md hover:bg-accent active:bg-accent transition-colors touch-manipulation">
            <Menu className="w-4 h-4 text-muted-foreground" />
          </button>

          <span className="text-sm font-medium text-foreground pl-1 hidden md:block">Quanta</span>

          <div className="flex-1" />

          {/* Agent step indicator */}
          {agentStep !== null && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 animate-pulse">
              <Atom className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-medium text-primary">Agent Step {agentStep}</span>
            </div>
          )}

          {activeId && !agentStep && (
            <span className="text-xs text-muted-foreground truncate max-w-[200px]">
              {conversations.find((c) => c.id === activeId)?.title || "Chat"}
            </span>
          )}

          <div className="flex-1" />

          {agentMode && !streaming && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 hidden sm:block">
              Agent ON
            </span>
          )}

          <button onClick={toggleTheme} className="shrink-0 p-1.5 rounded-md text-muted-foreground/40 hover:text-muted-foreground transition-colors touch-manipulation">
            {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </header>

        {/* Content */}
        {ToolUIComponent ? (
          <div className="flex-1 overflow-y-auto">
            <ToolUIComponent />
          </div>
        ) : hasMessages ? (
          <>
            <div ref={scrollRef} className="flex-1 overflow-y-auto">
              {messages.map((m, i) => {
                let thinking: string | undefined;
                let displayContent = m.content;

                const thinkMatch = m.content.match(/^<!--thinking:(.+?)-->(.*)$/s);
                if (thinkMatch) {
                  try { thinking = decodeURIComponent(atob(thinkMatch[1])); } catch { /* ignore */ }
                  displayContent = thinkMatch[2];
                }

                const rawThinkMatch = displayContent.match(/([\s\S]*?)<think>([\s\S]*?)<\/think>([\s\S]*)$/);
                if (rawThinkMatch) {
                  thinking = rawThinkMatch[2].trim();
                  displayContent = (rawThinkMatch[1] + rawThinkMatch[3]).trim();
                }

                if (!thinking && displayContent.includes('</think>')) {
                  const parts = displayContent.split('</think>');
                  thinking = parts[0].trim();
                  displayContent = parts.slice(1).join('').trim();
                }

                // Clean agent markers from display
                displayContent = displayContent.replace(/\[(CONTINUE|DONE)\]\s*/g, "").trim();

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
                  content={streamContent.replace(/\[(CONTINUE|DONE)\]\s*/g, "")}
                  thinking={streamThinking || undefined}
                  isThinking={isThinkingPhase}
                />
              )}
              {streaming && !streamContent && !streamThinking && (
                <div className="py-2 sm:py-3 px-3 sm:px-4 animate-message-in">
                  <div className="max-w-2xl mx-auto flex gap-2.5 sm:gap-3">
                    <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-[11px] font-semibold text-muted-foreground">
                      {agentMode ? <Atom className="w-3.5 h-3.5" /> : "Q"}
                    </div>
                    <div className="px-4 py-3 rounded-2xl rounded-tl-md bg-muted/60 glass-subtle">
                      <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30 animate-bounce" style={{ animationDelay: "0ms" }} />
                        <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30 animate-bounce" style={{ animationDelay: "150ms" }} />
                        <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30 animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <ChatInput onSend={handleSend} onStop={handleStop} disabled={streaming} streaming={streaming} agentMode={agentMode} onToggleAgent={() => setAgentMode((a) => !a)} thinkingEnabled={thinkingEnabled} onToggleThinking={() => setThinkingEnabled((t) => !t)} selectedModel={selectedModel} onSelectModel={setSelectedModel} modelSupportsThinking={modelSupportsThinking} />
          </>
        ) : (
          <WelcomeScreen onSend={handleSend} onStop={handleStop} disabled={streaming} streaming={streaming} agentMode={agentMode} onToggleAgent={() => setAgentMode((a) => !a)} thinkingEnabled={thinkingEnabled} onToggleThinking={() => setThinkingEnabled((t) => !t)} selectedModel={selectedModel} onSelectModel={setSelectedModel} modelSupportsThinking={modelSupportsThinking} />
        )}
      </div>
    </div>
  );
}
