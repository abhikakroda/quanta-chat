import { useState, useRef, useEffect, lazy, Suspense } from "react";
import { useSearchParams } from "react-router-dom";
import { Moon, Sun, Menu, Atom, BookMarked, Ghost } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { useConversations } from "@/hooks/useConversations";
import { useMessages } from "@/hooks/useMessages";
import { streamChat, Message, MODELS, ModelId, resolveAutoModel, getModelLabel, ThinkingLevel } from "@/lib/chat";
import { useUserMemories, extractMemories } from "@/hooks/useUserMemories";
import { useSkillLevel } from "@/hooks/useSkillLevel";
import ChatSidebar, { SKILLS, ALL_TOOLS, SkillId } from "@/components/ChatSidebar";
import { AVATARS } from "@/lib/avatars";
import ChatMessage from "@/components/ChatMessage";
import ChatInput from "@/components/ChatInput";
import WelcomeScreen from "@/components/WelcomeScreen";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

import { Dialog, DialogContent } from "@/components/ui/dialog";

// Lazy load all tool components
const TranslatorTool = lazy(() => import("@/components/tools/TranslatorTool"));
const CalculatorTool = lazy(() => import("@/components/tools/CalculatorTool"));
const SummarizerTool = lazy(() => import("@/components/tools/SummarizerTool"));
const DeepResearcherTool = lazy(() => import("@/components/tools/DeepResearcherTool"));
const CodeAssistantTool = lazy(() => import("@/components/tools/CodeAssistantTool"));
const WriterTool = lazy(() => import("@/components/tools/WriterTool"));
const TaskSchedulerTool = lazy(() => import("@/components/tools/TaskSchedulerTool"));
const ImageDescriberTool = lazy(() => import("@/components/tools/ImageDescriberTool"));
const VisionTool = lazy(() => import("@/components/tools/VisionTool"));
const VoiceChatTool = lazy(() => import("@/components/tools/VoiceChatTool"));
const ConversationalAgentTool = lazy(() => import("@/components/tools/ConversationalAgentTool"));

const WebScraperTool = lazy(() => import("@/components/tools/WebScraperTool"));
const NewsTool = lazy(() => import("@/components/tools/NewsTool"));
const WebSearchTool = lazy(() => import("@/components/tools/WebSearchTool"));
const ImageGeneratorTool = lazy(() => import("@/components/tools/ImageGeneratorTool"));
const DocAnalyzerTool = lazy(() => import("@/components/tools/DocAnalyzerTool"));
const CodeRunnerTool = lazy(() => import("@/components/tools/CodeRunnerTool"));
const CompareModelsTool = lazy(() => import("@/components/tools/CompareModelsTool"));
const InterviewSimulatorTool = lazy(() => import("@/components/tools/InterviewSimulatorTool"));
const TutorModeTool = lazy(() => import("@/components/tools/TutorModeTool"));
const StartupConverterTool = lazy(() => import("@/components/tools/StartupConverterTool"));
const WeaknessHeatmapTool = lazy(() => import("@/components/tools/WeaknessHeatmapTool"));
const DebateModeTool = lazy(() => import("@/components/tools/DebateModeTool"));
const FailureSimulatorTool = lazy(() => import("@/components/tools/FailureSimulatorTool"));
const AILabTool = lazy(() => import("@/components/tools/AILabTool"));
const ShadowCloneTool = lazy(() => import("@/components/tools/ShadowCloneTool"));
const FutureProjectionTool = lazy(() => import("@/components/tools/FutureProjectionTool"));
const ScenarioSimTool = lazy(() => import("@/components/tools/ScenarioSimTool"));
const CareerBattleTool = lazy(() => import("@/components/tools/CareerBattleTool"));
const CouncilTool = lazy(() => import("@/components/tools/CouncilTool"));
const FileProcessorTool = lazy(() => import("@/components/tools/FileProcessorTool"));
const TaskExecutorTool = lazy(() => import("@/components/tools/TaskExecutorTool"));
const StudentAITool = lazy(() => import("@/components/tools/StudentAITool"));
const WorldMapTool = lazy(() => import("@/components/tools/WorldMapTool"));
const SSCEnglishTool = lazy(() => import("@/components/tools/SSCEnglishTool"));
const SSCMathTool = lazy(() => import("@/components/tools/SSCMathTool"));
const SSCReasoningTool = lazy(() => import("@/components/tools/SSCReasoningTool"));
const GKTool = lazy(() => import("@/components/tools/GKTool"));
const SSCMockTestTool = lazy(() => import("@/components/tools/SSCMockTestTool"));
const ECETool = lazy(() => import("@/components/tools/ECETool"));
const CustomSkillTool = lazy(() => import("@/components/tools/CustomSkillTool"));
const IESETTool = lazy(() => import("@/components/tools/IESETTool"));
const GATEECETool = lazy(() => import("@/components/tools/GATEECETool"));


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
  "conversational-agent": ConversationalAgentTool,
  "web-scraper": WebScraperTool,
  "news": NewsTool,
  "web-search": WebSearchTool,
  "image-generator": ImageGeneratorTool,
  "doc-analyzer": DocAnalyzerTool,
  "code-runner": CodeRunnerTool,
  "compare-models": CompareModelsTool,
  "interview-simulator": InterviewSimulatorTool,
  "tutor-mode": TutorModeTool,
  "startup-converter": StartupConverterTool,
  "weakness-heatmap": WeaknessHeatmapTool,
  "debate-mode": DebateModeTool,
  "failure-simulator": FailureSimulatorTool,
  "ai-lab": AILabTool,
  "shadow-clone": ShadowCloneTool,
  "future-projection": FutureProjectionTool,
  "scenario-sim": ScenarioSimTool,
  "career-battle": CareerBattleTool,
  "ai-council": CouncilTool,
  "file-processor": FileProcessorTool,
  "task-executor": TaskExecutorTool,
  "student-ai": StudentAITool,
  "world-map": WorldMapTool,
  "ssc-english": SSCEnglishTool,
  "ssc-math": SSCMathTool,
  "ssc-reasoning": SSCReasoningTool,
  "gk-tool": GKTool,
  "ssc-mock-test": SSCMockTestTool,
  "ece-tool": ECETool,
  "custom-skill": CustomSkillTool,
  "ies-et": IESETTool,
  "gate-ece": GATEECETool,
};

export default function Index() {
  const { user, loading: authLoading, signIn, signUp } = useAuth();
  const { conversations, createConversation, deleteConversation, updateTitle, refetch } = useConversations();
  const [activeId, setActiveId] = useState<string | null>(null);
  const { messages, addMessage, setMessages } = useMessages(activeId);
  const [messageImages, setMessageImages] = useState<Record<string, string>>({});
  const [messageModels, setMessageModels] = useState<Record<string, string>>({});
  const [streaming, setStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState("");
  const [streamThinking, setStreamThinking] = useState("");
  const [isThinkingPhase, setIsThinkingPhase] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem("quanta-sidebar-collapsed");
    return saved !== null ? saved === "true" : false; // default open
  });
  const [thinkingEnabled, setThinkingEnabled] = useState(false);
  const [thinkingLevel, setThinkingLevel] = useState<ThinkingLevel>("off");
  const [selfVerify, setSelfVerify] = useState(false);
  const [smartPrompt, setSmartPrompt] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [projectMemory, setProjectMemory] = useState<string>("");
  const [memoryDialogOpen, setMemoryDialogOpen] = useState(false);
  const [memoryDraft, setMemoryDraft] = useState("");
  const [agentStep, setAgentStep] = useState<number | null>(null);
  const [selectedModel, setSelectedModel] = useState<ModelId>(() => {
    const saved = localStorage.getItem("quanta-selected-model");
    return (saved as ModelId) || "mistral";
  });

  useEffect(() => {
    localStorage.setItem("quanta-selected-model", selectedModel);
  }, [selectedModel]);

  useEffect(() => {
    localStorage.setItem("quanta-sidebar-collapsed", String(sidebarCollapsed));
  }, [sidebarCollapsed]);
  
  const [agentMode, setAgentMode] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeSkill, setActiveSkill] = useState<string | null>(() => searchParams.get("tool"));
  const [activeAvatar, setActiveAvatar] = useState<string | null>(null);

  // Clear URL param after reading
  useEffect(() => {
    if (searchParams.has("tool")) {
      setSearchParams({}, { replace: true });
    }
  }, []);
  const [ghostMode, setGhostMode] = useState(false);
  const [ghostMessages, setGhostMessages] = useState<any[]>([]);
  const { dark, toggle: toggleTheme } = useTheme();
  const scrollRef = useRef<HTMLDivElement>(null);
  const { memories, upsertMemory, getMemoryContext } = useUserMemories(user?.id);
  const { skills, awardXP, xpGained } = useSkillLevel(user?.id);
  const abortRef = useRef<AbortController | null>(null);

  // Free chat counter (5 free messages without sign-in)
  const FREE_CHAT_LIMIT = 5;
  const [freeChatCount, setFreeChatCount] = useState<number>(() => {
    const saved = localStorage.getItem("opentropic-free-chats");
    return saved ? parseInt(saved, 10) : 0;
  });

  useEffect(() => {
    localStorage.setItem("opentropic-free-chats", String(freeChatCount));
  }, [freeChatCount]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'auto' });
    }
  }, [messages, streamContent, streamThinking]);

  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [authIsSignUp, setAuthIsSignUp] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authSubmitting, setAuthSubmitting] = useState(false);

  const needsAuth = (_action: string) => {
    if (ghostMode) return false;
    if (!user) {
      if (freeChatCount >= FREE_CHAT_LIMIT) {
        setShowAuthDialog(true);
        return true;
      }
      // Allow free chat, increment counter
      setFreeChatCount((c) => c + 1);
      return false;
    }
    return false;
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthSubmitting(true);
    const result = authIsSignUp ? await signUp(authEmail, authPassword) : await signIn(authEmail, authPassword);
    if (result.error) {
      setAuthError(result.error);
    } else {
      setShowAuthDialog(false);
      setAuthEmail("");
      setAuthPassword("");
    }
    setAuthSubmitting(false);
  };




  if (authLoading) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-background">
        <span className="text-sm text-muted-foreground animate-pulse">Loading…</span>
      </div>
    );
  }

  const ToolUIComponent = activeSkill ? TOOL_UI_MAP[activeSkill] : null;

  const handleSend = async (input: string, files?: { name: string; content: string; type: string; dataUrl?: string }[]) => {
    if (needsAuth('chat')) return;

    // Smart Prompt: optimize the user's prompt before sending
    let finalInput = input;
    if (smartPrompt && input.trim().length >= 10 && !ghostMode) {
      try {
        setOptimizing(true);
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (token) {
          const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/optimize-prompt`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
            body: JSON.stringify({ prompt: input }),
          });
          if (resp.ok) {
            const result = await resp.json();
            if (result.optimized && result.optimized !== input) {
              finalInput = result.optimized;
            }
          }
        }
      } catch (err) {
        console.error("Prompt optimization failed, using original:", err);
      } finally {
        setOptimizing(false);
      }
    }

    // Ghost mode: skip all DB operations
    const isGhost = ghostMode;

    let convId = activeId;
    if (!isGhost) {
      if (!convId) {
        const conv = await createConversation(input.slice(0, 50));
        if (!conv) return;
        convId = conv.id;
        setActiveId(conv.id);
      }
    }

    // Extract image data if any image files are attached
    let imageData: { base64: string; mimeType: string } | undefined;
    let userContent = finalInput;
    if (files && files.length > 0) {
      const imageFile = files.find((f) => f.dataUrl && f.type.startsWith("image/"));
      // Also treat PDFs with dataUrl as images (scanned/photo PDFs)
      const pdfImageFile = !imageFile ? files.find((f) => f.dataUrl && (f.type === "application/pdf" || f.name.endsWith(".pdf"))) : null;
      const effectiveImageFile = imageFile || pdfImageFile;
      
      if (effectiveImageFile && effectiveImageFile.dataUrl) {
        const base64Match = effectiveImageFile.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (base64Match) {
          imageData = { mimeType: base64Match[1], base64: base64Match[2] };
        }
      }
      
      // Only include text content from non-image text files that have real content
      const textFiles = files.filter((f) => !f.type.startsWith("image/") && !f.dataUrl);
      const validTextFiles = textFiles.filter((f) => 
        f.content && 
        !f.content.startsWith("[PDF contained no extractable text]") &&
        !f.content.startsWith("[Could not read") &&
        !f.content.startsWith("[Image:")
      );
      if (validTextFiles.length > 0) {
        const fileSection = validTextFiles.map((f) => `--- File: ${f.name} ---\n${f.content}`).join("\n\n");
        userContent = `${fileSection}\n\n${input}`;
      }
      if (effectiveImageFile && !input.trim()) {
        userContent = "Describe this image in detail.";
      } else if (effectiveImageFile) {
        userContent = input; // Just use the user's typed message, don't add metadata
      }
    }

    // Optimistic: add user message immediately
    const tempId = crypto.randomUUID();
    const optimisticMsg = { id: tempId, conversation_id: convId || "ghost", role: "user" as const, content: userContent, created_at: new Date().toISOString() };
    
    if (isGhost) {
      setGhostMessages((prev) => [...prev, optimisticMsg]);
    } else {
      setMessages((prev: any) => [...prev, optimisticMsg]);
    }

    // Store image URL for display
    const imageFile = files?.find((f) => f.dataUrl && f.type.startsWith("image/"));
    if (imageFile?.dataUrl) {
      setMessageImages((prev) => ({ ...prev, [tempId]: imageFile.dataUrl! }));
    }

    // Fire-and-forget DB insert (skip in ghost mode)
    if (!isGhost && convId) {
      supabase.from("messages").insert({ conversation_id: convId, role: "user" as const, content: userContent }).select().single().then(({ data }) => {
        if (data) {
          setMessages((prev: any) => prev.map((m: any) => m.id === tempId ? data : m));
          if (imageFile?.dataUrl) {
            setMessageImages((prev) => {
              const next = { ...prev, [data.id]: prev[tempId] };
              delete next[tempId];
              return next;
            });
          }
        }
      });
    }

    const currentMessages = isGhost ? ghostMessages : messages;
    const allMessages: Message[] = [
      ...currentMessages.map((m: any) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: userContent },
    ];

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
    const avatarDef = activeAvatar ? AVATARS.find((a) => a.id === activeAvatar) : null;
    const skillDef = avatarDef
      ? { prompt: avatarDef.systemPrompt }
      : activeSkill === "web-scraper"
        ? { prompt: WEB_SCRAPER_PROMPT }
        : activeSkill ? (SKILLS.find((s) => s.id === activeSkill) || ALL_TOOLS.find((t) => t.id === activeSkill)) : null;

    // Skip memory extraction & XP in ghost mode
    if (!isGhost) {
      const extracted = extractMemories(userContent);
      for (const mem of extracted) {
        upsertMemory(mem.key, mem.value, mem.category);
      }
      awardXP(activeSkill ? "tool_use" : "message");
    }

    // Build combined memory context (skip in ghost mode)
    const memoryContext = isGhost ? undefined : [projectMemory, getMemoryContext()].filter(Boolean).join("\n\n") || undefined;

    await streamChat({
      messages: allMessages,
      model: selectedModel,
      enableThinking: thinkingEnabled,
      thinkingLevel,
      selfVerify,
      projectMemory: memoryContext,
      skillPrompt: skillDef?.prompt,
      activeSkill,
      agentMode,
      imageData,
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
        const cleanContent = fullContent.replace(/\[(CONTINUE|DONE)\]\s*/g, "").trim();
        
        if (isGhost) {
          // Ghost mode: just add to local state, no DB
          const ghostAssistant = {
            id: crypto.randomUUID(),
            conversation_id: "ghost",
            role: "assistant" as const,
            content: cleanContent,
            created_at: new Date().toISOString(),
          };
          const effectiveModel = agentMode ? "qwen" : resolveAutoModel(selectedModel, activeSkill);
          setMessageModels((prev) => ({ ...prev, [ghostAssistant.id]: getModelLabel(effectiveModel) }));
          setGhostMessages((prev) => [...prev, ghostAssistant]);
        } else {
          const savedContent = fullThinking
            ? `<!--thinking:${btoa(encodeURIComponent(fullThinking))}-->${cleanContent}`
            : cleanContent;
          const { data } = await supabase
            .from("messages")
            .insert({ conversation_id: convId!, role: "assistant" as const, content: savedContent })
            .select()
            .single();
          if (data) {
            const effectiveModel = agentMode ? "qwen" : resolveAutoModel(selectedModel, activeSkill);
            setMessageModels((prev) => ({ ...prev, [data.id]: getModelLabel(effectiveModel) }));
            setMessages((prev) => [...prev, data as any]);
          }
          if (messages.length === 0) {
            await updateTitle(convId!, input.slice(0, 50));
          }
        }
        setStreamContent("");
        setStreamThinking("");
        setIsThinkingPhase(false);
        setStreaming(false);
        setAgentStep(null);
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
    setMessageImages({});
    setGhostMessages([]);
    setSidebarOpen(false);
  };

  const handleSelectConv = (id: string) => {
    setActiveId(id);
    setMessageImages({});
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

    const avatarDef2 = activeAvatar ? AVATARS.find((a) => a.id === activeAvatar) : null;
    const skillDef2 = avatarDef2
      ? { prompt: avatarDef2.systemPrompt }
      : activeSkill === "web-scraper"
        ? { prompt: "You are a web search and crawling assistant." }
        : activeSkill ? (SKILLS.find((s) => s.id === activeSkill) || ALL_TOOLS.find((t) => t.id === activeSkill)) : null;

    await streamChat({
      messages: history,
      model: selectedModel,
      enableThinking: thinkingEnabled,
      thinkingLevel,
      selfVerify,
      projectMemory: [projectMemory, getMemoryContext()].filter(Boolean).join("\n\n") || undefined,
      skillPrompt: skillDef2?.prompt,
      activeSkill,
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
        if (data) {
          const effectiveModel = agentMode ? "qwen" : resolveAutoModel(selectedModel, activeSkill);
          setMessageModels((prev) => ({ ...prev, [data.id]: getModelLabel(effectiveModel) }));
          setMessages((prev) => [...prev, data as any]);
        }
        setStreamContent(""); setStreamThinking(""); setIsThinkingPhase(false); setStreaming(false); setAgentStep(null);
      },
      onError: (err) => {
        setStreamContent(""); setStreamThinking(""); setIsThinkingPhase(false); setStreaming(false); setAgentStep(null);
        console.error(err);
      },
    });
  };

  const displayMessages = ghostMode ? ghostMessages : messages;
  const hasMessages = displayMessages.length > 0 || streaming;
  const resolvedModel = resolveAutoModel(selectedModel, activeSkill);
  const modelSupportsThinking = true;

  return (
    <div className="flex h-[100dvh] bg-background overflow-hidden">
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
        onSelectSkill={(s) => { setActiveSkill(s); setActiveAvatar(null); }}
        activeAvatar={activeAvatar}
        onSelectAvatar={setActiveAvatar}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar — ChatGPT style: model name left, actions right */}
        <div className="h-12 shrink-0 flex items-center justify-between px-3 sm:px-4 border-b border-border/40">
          <div className="flex items-center gap-2">
            {sidebarCollapsed && (
              <button onClick={() => setSidebarCollapsed(false)} className="hidden md:flex p-1.5 rounded-md hover:bg-accent transition-colors touch-manipulation">
                <Menu className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
            <button onClick={() => setSidebarOpen(true)} className="md:hidden p-1.5 rounded-md hover:bg-accent transition-colors touch-manipulation">
              <Menu className="w-4 h-4 text-muted-foreground" />
            </button>
            {ghostMode && (
              <span className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/40">
                <Ghost className="w-3 h-3" />
                Ghost
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => { setMemoryDraft(projectMemory); setMemoryDialogOpen(true); }}
              className={cn(
                "shrink-0 p-1.5 rounded-md transition-colors touch-manipulation",
                projectMemory ? "text-primary" : "text-muted-foreground/40 hover:text-muted-foreground"
              )}
              title="Project Memory"
            >
              <BookMarked className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setGhostMode(g => {
                  if (!g) { setGhostMessages([]); setActiveId(null); }
                  return !g;
                });
              }}
              className={cn(
                "shrink-0 p-1.5 rounded-md transition-colors touch-manipulation",
                ghostMode ? "text-foreground bg-muted" : "text-muted-foreground/40 hover:text-muted-foreground"
              )}
              title={ghostMode ? "Ghost Mode ON" : "Ghost Mode"}
            >
              <Ghost className="w-4 h-4" />
            </button>
            <button onClick={toggleTheme} className="shrink-0 p-1.5 rounded-md text-muted-foreground/40 hover:text-muted-foreground transition-colors touch-manipulation">
              {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Content */}
        {ToolUIComponent ? (
          <Suspense fallback={<div className="flex-1 flex items-center justify-center"><span className="text-sm text-muted-foreground animate-pulse">Loading…</span></div>}>
            <div className="flex-1 overflow-y-auto">
              <ToolUIComponent />
            </div>
          </Suspense>
        ) : hasMessages ? (
          <>
            {ghostMode && (
              <div className="shrink-0 flex items-center justify-center gap-2 px-3 py-1.5 bg-muted/50 border-b border-border/30 text-[11px] text-muted-foreground">
                <Ghost className="w-3 h-3" />
                <span>Ghost Mode — messages are temporary and won't be saved</span>
              </div>
            )}
            <div ref={scrollRef} className="flex-1 overflow-y-auto smooth-scroll">
              {displayMessages.map((m, i) => {
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
                    imageUrl={messageImages[m.id]}
                    modelLabel={m.role === "assistant" ? messageModels[m.id] : undefined}
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
                  isStreaming={true}
                />
              )}
              {streaming && !streamContent && !streamThinking && (
                <div className="py-5 px-4 sm:px-6 animate-message-in">
                  <div className="max-w-[720px] mx-auto">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30 animate-fast-bounce" style={{ animationDelay: "0ms" }} />
                      <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30 animate-fast-bounce" style={{ animationDelay: "100ms" }} />
                      <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30 animate-fast-bounce" style={{ animationDelay: "200ms" }} />
                    </div>
                  </div>
                </div>
              )}
            </div>
            <ChatInput onSend={handleSend} onStop={handleStop} disabled={streaming || optimizing} streaming={streaming} agentMode={agentMode} onToggleAgent={() => setAgentMode((a) => !a)} selectedModel={selectedModel} onSelectModel={setSelectedModel} activeSkillLabel={activeSkill ? (SKILLS.find(s => s.id === activeSkill)?.label || ALL_TOOLS.find(t => t.id === activeSkill)?.label || null) : null} />
          </>
        ) : (
          <WelcomeScreen onSend={handleSend} onStop={handleStop} disabled={streaming} streaming={streaming} agentMode={agentMode} onToggleAgent={() => setAgentMode((a) => !a)} selectedModel={selectedModel} onSelectModel={setSelectedModel} onSelectSkill={(skill) => { setActiveSkill(skill); handleNewChat(); }} activeSkillLabel={activeSkill ? (SKILLS.find(s => s.id === activeSkill)?.label || ALL_TOOLS.find(t => t.id === activeSkill)?.label || null) : null} />
        )}
      </div>

      {/* Auth Dialog */}
      <Dialog open={showAuthDialog} onOpenChange={setShowAuthDialog}>
        <DialogContent className="sm:max-w-sm p-0 gap-0 border-border bg-background">
          <div className="p-6 space-y-6">
            <div className="text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                <span className="text-2xl font-bold text-primary lowercase">o</span>
              </div>
              <h2 className="text-xl font-bold text-foreground">
                {authIsSignUp ? "Create Account" : "Welcome Back"}
              </h2>
              <p className="text-muted-foreground text-sm">
                {!user && freeChatCount >= FREE_CHAT_LIMIT
                  ? "You've used your 5 free messages. Sign in to continue chatting."
                  : authIsSignUp ? "Sign up to get started" : "Sign in to continue"}
              </p>
            </div>




            <form onSubmit={handleAuthSubmit} className="space-y-3">
              <input
                type="email"
                placeholder="Email"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                required
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-card text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <input
                type="password"
                placeholder="Password"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-card text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {authError && <p className="text-destructive text-xs text-center">{authError}</p>}
              <button
                type="submit"
                disabled={authSubmitting}
                className="w-full px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {authSubmitting ? "..." : authIsSignUp ? "Sign Up" : "Sign In"}
              </button>
            </form>

            <p className="text-center text-xs text-muted-foreground">
              {authIsSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
              <button onClick={() => { setAuthIsSignUp(!authIsSignUp); setAuthError(""); }} className="text-primary hover:underline">
                {authIsSignUp ? "Sign In" : "Sign Up"}
              </button>
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Project Memory Dialog */}
      <Dialog open={memoryDialogOpen} onOpenChange={setMemoryDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-foreground">Project Memory</h3>
              <p className="text-sm text-muted-foreground mt-1">Set persistent context that will be included in every message.</p>
            </div>
            <textarea
              value={memoryDraft}
              onChange={(e) => setMemoryDraft(e.target.value)}
              placeholder="e.g. I'm building a SaaS app using React and Node.js..."
              className="w-full min-h-[120px] rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              {projectMemory && (
                <button
                  onClick={() => { setProjectMemory(""); setMemoryDialogOpen(false); }}
                  className="px-3 py-1.5 text-sm rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
                >
                  Clear
                </button>
              )}
              <button
                onClick={() => setMemoryDialogOpen(false)}
                className="px-3 py-1.5 text-sm rounded-lg text-muted-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => { setProjectMemory(memoryDraft); setMemoryDialogOpen(false); }}
                className="px-4 py-1.5 text-sm rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity font-medium"
              >
                Save
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
