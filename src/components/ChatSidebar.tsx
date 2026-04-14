import { memo, useState, useMemo, useEffect } from "react";
import {
  SquarePen, Search, Trash2, LogOut, X, PanelLeftClose,
  Clock, Code2, FileText, Globe, ChevronDown, ChevronUp, Sparkles,
  Calculator, Languages, Image, Bug, Eye, Mic, CalendarDays, BookOpen, Phone,
  FilePen, Newspaper, Wand2, Columns2, Users, GraduationCap, Rocket, Flame, Swords, AlertTriangle, FlaskConical, Dna, TrendingUp, Zap, FileDown, Pin, Cpu, Keyboard, MoreHorizontal, Plus, BookMarked
} from "lucide-react";
import { Conversation } from "@/hooks/useConversations";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { AVATARS, Avatar } from "@/lib/avatars";

type Props = {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  open: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  activeSkill?: string | null;
  onSelectSkill?: (skill: string | null) => void;
  activeAvatar?: string | null;
  onSelectAvatar?: (avatarId: string | null) => void;
  projectMemory?: string;
  onOpenMemory?: () => void;
};

export const SKILLS = [
  { id: "deep-research", icon: Globe, label: "Deep Research", badge: null, prompt: "You are a deep research assistant. Analyze topics thoroughly from multiple angles, provide comprehensive findings with citations and evidence. Structure your responses with clear sections, key findings, and actionable insights." },
  { id: "code-assistant", icon: Code2, label: "Code Assistant", badge: "Pro", prompt: "You are an expert coding assistant. Write clean, efficient, well-documented code. Explain your approach, suggest best practices, handle edge cases, and provide working examples. Support debugging and code review." },
  { id: "summarizer", icon: Sparkles, label: "Summarizer", badge: null, prompt: "You are a summarization expert. Condense long texts into clear, concise summaries. Preserve key points, main arguments, and critical details. Provide bullet-point summaries and brief overviews." },
  
] as const;

export const ALL_TOOLS = [
  { id: "conversational-agent", icon: Phone, label: "Conversational Agent", badge: null, prompt: "You are a conversational AI agent.", category: "Chat" },
  { id: "web-search", icon: Search, label: "Web Search", badge: "New", prompt: "You are a web search assistant.", category: "Search" },
  { id: "compare-models", icon: Columns2, label: "Compare Models", badge: "New", prompt: "Compare AI models.", category: "AI" },
  { id: "image-generator", icon: Wand2, label: "Image Generator", badge: "New", prompt: "You generate images from text.", category: "Creative" },
  { id: "doc-analyzer", icon: FilePen, label: "Doc Analyzer", badge: "New", prompt: "You analyze documents.", category: "Productivity" },
  { id: "code-runner", icon: Bug, label: "Code Runner", badge: "New", prompt: "You execute JavaScript code.", category: "Code" },
  { id: "calculator", icon: Calculator, label: "Calculator", prompt: "You are a math and calculation assistant.", category: "Utility" },
  { id: "translator", icon: Languages, label: "Translator", prompt: "You are a multilingual translator.", category: "Utility" },
  { id: "news", icon: Newspaper, label: "News", badge: "Live", prompt: "You are a news assistant.", category: "Search" },
  { id: "image-describer", icon: Image, label: "Image Describer", prompt: "You are an image analysis assistant.", category: "AI" },
  { id: "voice-chat", icon: Mic, label: "Voice Chat", badge: null, prompt: "You are a voice assistant.", category: "Chat" },
  { id: "vision", icon: Eye, label: "Vision (Text→PDF)", prompt: "You convert text to documents.", category: "Productivity" },
  { id: "task-scheduler", icon: CalendarDays, label: "Task Scheduler", prompt: "You help schedule tasks.", category: "Productivity" },
  { id: "interview-simulator", icon: GraduationCap, label: "Interview Sim", badge: "New", prompt: "You are a technical interviewer.", category: "Career" },
  { id: "tutor-mode", icon: BookOpen, label: "Tutor Mode", badge: "New", prompt: "You are a Socratic tutor.", category: "Learning" },
  { id: "startup-converter", icon: Rocket, label: "Startup Plan", badge: "New", prompt: "You convert projects into startup plans.", category: "Career" },
  { id: "weakness-heatmap", icon: Flame, label: "Skill Heatmap", badge: "New", prompt: "Weakness analysis dashboard.", category: "Learning" },
  { id: "debate-mode", icon: Swords, label: "Debate Mode", badge: "New", prompt: "You are a debate opponent.", category: "Learning" },
  { id: "failure-simulator", icon: AlertTriangle, label: "Failure Sim", badge: "New", prompt: "You simulate rejection and stress scenarios.", category: "Career" },
  { id: "ai-lab", icon: FlaskConical, label: "AI Playground", badge: "🧪", prompt: "Experimental AI tools.", category: "AI" },
  { id: "shadow-clone", icon: Dna, label: "Shadow Clone", badge: "🧬", prompt: "Your AI digital twin.", category: "AI" },
  { id: "future-projection", icon: TrendingUp, label: "Career Projection", badge: "New", prompt: "AI career path analysis.", category: "Career" },
  { id: "scenario-sim", icon: Zap, label: "Scenario Sim", badge: "🔥", prompt: "Real-world crisis simulator.", category: "Career" },
  { id: "career-battle", icon: Swords, label: "Career Battle", badge: "⚔️", prompt: "Competitive career battles.", category: "Career" },
  { id: "ai-council", icon: Users, label: "AI Council", badge: "🧠", prompt: "4 AI experts debate your question.", category: "AI" },
  { id: "file-processor", icon: FileText, label: "File Processor", badge: "📄", prompt: "Transform files into summaries, notes, flashcards, quizzes.", category: "Productivity" },
  { id: "task-executor", icon: FileDown, label: "Task Executor", badge: "⚡", prompt: "Generate documents from tasks.", category: "Productivity" },
  { id: "student-ai", icon: GraduationCap, label: "Student AI", badge: "🎓", prompt: "AI study companion: explain topics, quiz, summarize notes, solve homework.", category: "Learning" },
  { id: "world-map", icon: Globe, label: "World Map", badge: "Live", prompt: "Interactive world map for UPSC & competitive exam geography preparation.", category: "Learning" },
  { id: "ssc-hub", icon: GraduationCap, label: "SSC Exam Prep", badge: "🎓", prompt: "Complete SSC CGL/CHSL preparation: English, Math, Reasoning, GK & Mock Tests.", category: "Learning" },
  { id: "engineering-hub", icon: Cpu, label: "Engineering Hub", badge: "🔧", prompt: "ECE Engineering, GATE ECE, IES/ESE & PCB Design — all in one place.", category: "Learning" },
  { id: "custom-skill", icon: BookOpen, label: "My Skills", badge: "✨", prompt: "Create and study your own custom skills and topics.", category: "Learning" },
  { id: "custom-skill", icon: BookOpen, label: "My Skills", badge: "✨", prompt: "Create and study your own custom skills and topics.", category: "Learning" },
  { id: "typing-speed", icon: Keyboard, label: "Typing Speed", badge: "New", prompt: "Practice typing speed with a visual keyboard and WPM tracking.", category: "Utility" },
] as const;

export type SkillId = typeof SKILLS[number]["id"];
export type ToolId = typeof ALL_TOOLS[number]["id"];

// Main sidebar items shown as top-level nav (Kimi-style)
const SIDEBAR_ITEMS = [
  { id: "deep-research", icon: Globe, label: "Deep Research" },
  { id: "code-assistant", icon: Code2, label: "Website Builder" },
  
  { id: "doc-analyzer", icon: FilePen, label: "Docs" },
  { id: "image-generator", icon: Wand2, label: "Create" },
] as const;

function ChatSidebar({ conversations, activeId, onSelect, onNew, onDelete, open, onClose, collapsed, onToggleCollapse, activeSkill, onSelectSkill, activeAvatar, onSelectAvatar, projectMemory, onOpenMemory }: Props) {
  const { user, signOut } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [historyOpen, setHistoryOpen] = useState(true);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [pinnedToolIds, setPinnedToolIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("pinned_tools") || "[]"); } catch { return []; }
  });

  useEffect(() => { localStorage.setItem("pinned_tools", JSON.stringify(pinnedToolIds)); }, [pinnedToolIds]);

  const pinnedTools = useMemo(() => ALL_TOOLS.filter(t => pinnedToolIds.includes(t.id)), [pinnedToolIds]);

  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter((c) => c.title.toLowerCase().includes(q));
  }, [conversations, searchQuery]);

  // Group conversations by date
  const groupedConversations = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 86400000);
    const weekAgo = new Date(today.getTime() - 7 * 86400000);

    const groups: { label: string; items: typeof filteredConversations }[] = [];
    const todayItems: typeof filteredConversations = [];
    const yesterdayItems: typeof filteredConversations = [];
    const weekItems: typeof filteredConversations = [];
    const olderMap = new Map<string, typeof filteredConversations>();

    for (const c of filteredConversations) {
      const d = new Date(c.updated_at || c.created_at);
      if (d >= today) {
        todayItems.push(c);
      } else if (d >= yesterday) {
        yesterdayItems.push(c);
      } else if (d >= weekAgo) {
        weekItems.push(c);
      } else {
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (!olderMap.has(key)) olderMap.set(key, []);
        olderMap.get(key)!.push(c);
      }
    }

    if (todayItems.length) groups.push({ label: "Today", items: todayItems });
    if (yesterdayItems.length) groups.push({ label: "Yesterday", items: yesterdayItems });
    if (weekItems.length) groups.push({ label: "7 Days", items: weekItems });
    for (const [key, items] of olderMap) {
      groups.push({ label: key, items });
    }
    return groups;
  }, [filteredConversations]);

  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-foreground/10 z-40 md:hidden" onClick={onClose} />
      )}

      <aside
        className={cn(
          "fixed md:relative z-50 md:z-auto flex flex-col h-full bg-sidebar border-r border-sidebar-border transition-all duration-300 ease-out will-change-transform",
          open ? "translate-x-0 w-[280px]" : "-translate-x-full",
          collapsed
            ? "md:w-0 md:-translate-x-full md:border-0 md:overflow-hidden"
            : "md:translate-x-0 md:w-[280px]"
        )}
      >
        <div className={cn("flex flex-col h-full w-[280px]")}>

          {/* Header */}
          <div className="flex items-center px-4 pt-4 pb-3 justify-between">
            <span className="text-xl font-bold text-primary tracking-tight lowercase">opentropic</span>
            <button onClick={onToggleCollapse} className="hidden md:flex p-1.5 rounded-lg hover:bg-sidebar-accent text-sidebar-foreground/30 hover:text-sidebar-foreground transition-colors">
              <PanelLeftClose className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="md:hidden p-1.5 rounded-lg hover:bg-sidebar-accent text-sidebar-foreground/30 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* New Chat button */}
          <div className="px-3 mb-2">
            <button
              onClick={() => { onNew(); onSelectSkill?.(null); }}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-[14px] font-medium text-sidebar-foreground border border-sidebar-border hover:bg-sidebar-accent/60 transition-all duration-200 touch-manipulation press-scale"
            >
              <Plus className="w-4 h-4" />
              New chat
            </button>
          </div>

          {/* Search bar */}
          <div className="px-3 mb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search chats…"
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-sidebar-accent/50 border-0 text-[13px] text-sidebar-foreground placeholder:text-muted-foreground/40 outline-none focus:bg-sidebar-accent transition-colors"
              />
            </div>
          </div>

          {/* Scrollable area: nav + conversations */}
          <div className="flex-1 overflow-y-auto px-1">
            {/* Main nav items */}
            <div className="px-2 space-y-0.5 mb-1">
              {SIDEBAR_ITEMS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    onSelectSkill?.(activeSkill === item.id ? null : item.id);
                    onNew();
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] transition-all duration-200 touch-manipulation text-left",
                    activeSkill === item.id
                      ? "bg-sidebar-accent text-primary font-medium"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground"
                  )}
                >
                  <item.icon className="w-[18px] h-[18px] shrink-0" />
                  <span className="flex-1 truncate">{item.label}</span>
                </button>
              ))}

              {/* AI Playground */}
              <Link
                to="/ai-playground"
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] transition-all duration-200 touch-manipulation text-left text-sidebar-foreground/70 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground"
              >
                <FlaskConical className="w-[18px] h-[18px] shrink-0" />
                <span className="flex-1 truncate">AI Playground</span>
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">{ALL_TOOLS.length}</span>
              </Link>
            </div>

            {/* Pinned Tools */}
            {pinnedTools.length > 0 && (
              <div className="px-2 mt-1 mb-1">
                <span className="flex items-center gap-2 px-3 py-1.5 text-[11px] text-sidebar-foreground/30 font-semibold uppercase tracking-wider">
                  <Pin className="w-3 h-3" /> Pinned
                </span>
                {pinnedTools.map((tool) => (
                  <button
                    key={tool.id}
                    onClick={() => { onSelectSkill?.(tool.id); onNew(); }}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] transition-all duration-200 text-left group",
                      activeSkill === tool.id
                        ? "bg-sidebar-accent text-primary font-medium"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground"
                    )}
                  >
                    <tool.icon className="w-4 h-4 shrink-0 opacity-70" />
                    <span className="flex-1 truncate">{tool.label}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); setPinnedToolIds(prev => prev.filter(id => id !== tool.id)); }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:text-destructive transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </button>
                ))}
              </div>
            )}

            {/* Conversation history — date grouped */}
            {groupedConversations.length > 0 && (
              <div className="mt-1">
                {groupedConversations.map((group) => (
                  <div key={group.label} className="mb-1">
                    <div className="px-5 py-2 text-[11px] font-medium text-muted-foreground/50 uppercase tracking-wide">
                      {group.label}
                    </div>
                    <div className="px-2 space-y-0.5">
                      {group.items.map((c) => (
                        <div
                          key={c.id}
                          className={cn(
                            "group flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 text-[14px]",
                            activeId === c.id
                              ? "bg-sidebar-accent text-primary font-medium"
                              : "text-sidebar-foreground/80 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground"
                          )}
                          onClick={() => onSelect(c.id)}
                        >
                          <span className="truncate flex-1">{c.title}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); onDelete(c.id); }}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-sidebar-accent hover:text-destructive transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {filteredConversations.length === 0 && !searchQuery && (
              <p className="text-[13px] text-muted-foreground/30 text-center py-6">
                No conversations yet
              </p>
            )}
            {filteredConversations.length === 0 && searchQuery && (
              <p className="text-[13px] text-muted-foreground/30 text-center py-6">
                No results for "{searchQuery}"
              </p>
            )}
          </div>

          {/* Memory button */}
          <div className="px-2 py-1.5 border-t border-sidebar-border/40">
            <button
              onClick={onOpenMemory}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] transition-colors",
                projectMemory
                  ? "text-primary bg-primary/5 hover:bg-primary/10"
                  : "text-sidebar-foreground/60 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground"
              )}
            >
              <BookMarked className="w-4 h-4" />
              <span>Project Memory</span>
              {projectMemory && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
            </button>
          </div>

          {/* User section at bottom */}
          <div className="border-t border-sidebar-border/40">
            {user ? (
              <div className="px-2 py-2">
                {userMenuOpen && (
                  <button
                    onClick={() => { signOut(); setUserMenuOpen(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] text-destructive hover:bg-destructive/10 transition-colors mb-1"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                )}
                <button
                  onClick={() => setUserMenuOpen((o) => !o)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-sidebar-accent/70 transition-colors"
                >
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-semibold">
                    {user?.email?.[0]?.toUpperCase() || "U"}
                  </div>
                  <span className="text-[12px] text-sidebar-foreground/60 truncate flex-1 text-left">{user?.email || "User"}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-sidebar-foreground/30" />
                </button>
              </div>
            ) : (
              <div className="px-2 py-2">
                <a
                  href="/auth"
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-primary text-primary-foreground text-[13px] font-medium hover:opacity-90 transition-opacity justify-center"
                >
                  Sign In
                </a>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

export default memo(ChatSidebar);
