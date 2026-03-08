import { memo, useState, useMemo } from "react";
import {
  SquarePen, Search, Trash2, LogOut, X, PanelLeftClose, PanelLeftOpen,
  Clock, Code2, FileText, Globe, ChevronDown, ChevronUp, Sparkles,
  Calculator, Languages, Image, Bug, Eye, Mic, CalendarDays, BookOpen, Phone,
  FilePen, Newspaper, Wand2, Columns2, Users, GraduationCap, Rocket, Flame, Swords, AlertTriangle, FlaskConical, Dna, TrendingUp, Zap, FileDown
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
};

export const SKILLS = [
  { id: "deep-research", icon: Globe, label: "Deep Research", badge: null, prompt: "You are a deep research assistant. Analyze topics thoroughly from multiple angles, provide comprehensive findings with citations and evidence. Structure your responses with clear sections, key findings, and actionable insights." },
  { id: "code-assistant", icon: Code2, label: "Code Assistant", badge: "Pro", prompt: "You are an expert coding assistant. Write clean, efficient, well-documented code. Explain your approach, suggest best practices, handle edge cases, and provide working examples. Support debugging and code review." },
  { id: "summarizer", icon: Sparkles, label: "Summarizer", badge: null, prompt: "You are a summarization expert. Condense long texts into clear, concise summaries. Preserve key points, main arguments, and critical details. Provide bullet-point summaries and brief overviews." },
  { id: "writer", icon: FileText, label: "Writer", badge: null, prompt: "You are a professional writer and editor. Help craft compelling content — articles, emails, essays, stories, and more. Focus on clarity, tone, structure, and engagement. Adapt your style to the user's needs." },
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
  { id: "ai-lab", icon: FlaskConical, label: "AI Lab", badge: "🧪", prompt: "Experimental AI tools.", category: "AI" },
  { id: "shadow-clone", icon: Dna, label: "Shadow Clone", badge: "🧬", prompt: "Your AI digital twin.", category: "AI" },
  { id: "future-projection", icon: TrendingUp, label: "Career Projection", badge: "New", prompt: "AI career path analysis.", category: "Career" },
  { id: "scenario-sim", icon: Zap, label: "Scenario Sim", badge: "🔥", prompt: "Real-world crisis simulator.", category: "Career" },
  { id: "career-battle", icon: Swords, label: "Career Battle", badge: "⚔️", prompt: "Competitive career battles.", category: "Career" },
  { id: "ai-council", icon: Users, label: "AI Council", badge: "🧠", prompt: "4 AI experts debate your question.", category: "AI" },
  { id: "file-processor", icon: FileText, label: "File Processor", badge: "📄", prompt: "Transform files into summaries, notes, flashcards, quizzes.", category: "Productivity" },
  { id: "task-executor", icon: FileDown, label: "Task Executor", badge: "⚡", prompt: "Generate documents from tasks.", category: "Productivity" },
] as const;

export type SkillId = typeof SKILLS[number]["id"];
export type ToolId = typeof ALL_TOOLS[number]["id"];

// Main sidebar items shown as top-level nav (Kimi-style)
const SIDEBAR_ITEMS = [
  { id: "deep-research", icon: Globe, label: "Deep Research" },
  { id: "code-assistant", icon: Code2, label: "Kode" },
  { id: "writer", icon: FileText, label: "Writer" },
  { id: "doc-analyzer", icon: FilePen, label: "Docs" },
  { id: "image-generator", icon: Wand2, label: "Create" },
] as const;

function ChatSidebar({ conversations, activeId, onSelect, onNew, onDelete, open, onClose, collapsed, onToggleCollapse, activeSkill, onSelectSkill, activeAvatar, onSelectAvatar }: Props) {
  const { user, signOut } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [historyOpen, setHistoryOpen] = useState(true);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter((c) => c.title.toLowerCase().includes(q));
  }, [conversations, searchQuery]);

  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-foreground/10 z-40 md:hidden" onClick={onClose} />
      )}

      <aside
        className={cn(
          "fixed md:relative z-50 md:z-auto flex flex-col h-full bg-sidebar border-r border-sidebar-border/50 transition-all duration-300 ease-out will-change-transform",
          open ? "translate-x-0" : "-translate-x-full",
          collapsed
            ? "md:w-[52px] md:translate-x-0"
            : "md:translate-x-0 w-[260px]"
        )}
      >
        <div className={cn("flex flex-col h-full", collapsed ? "w-[52px]" : "w-[260px]")}>

          {/* Header */}
          <div className={cn("flex items-center px-3 pt-3.5 pb-2", collapsed ? "flex-col gap-1 px-2" : "justify-between")}>
            {collapsed ? (
              <button onClick={onToggleCollapse} className="p-2 rounded-lg hover:bg-sidebar-accent text-sidebar-foreground/40 hover:text-sidebar-foreground transition-colors touch-manipulation" title="Expand">
                <PanelLeftOpen className="w-[18px] h-[18px]" />
              </button>
            ) : (
              <>
                <div className="flex items-center">
                  <span className="text-[20px] font-extrabold text-sidebar-foreground tracking-tight lowercase">opentropic</span>
                </div>
                <div className="flex items-center gap-0.5">
                  <button onClick={onToggleCollapse} className="hidden md:flex p-1.5 rounded-md hover:bg-sidebar-accent text-sidebar-foreground/30 hover:text-sidebar-foreground transition-colors">
                    <PanelLeftClose className="w-4 h-4" />
                  </button>
                  <button onClick={onClose} className="md:hidden p-1.5 rounded-md hover:bg-sidebar-accent text-sidebar-foreground/30 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </>
            )}
          </div>

          {/* New Chat */}
          {!collapsed ? (
            <div className="px-3 pt-1">
              <button
                onClick={() => { onNew(); onSelectSkill?.(null); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] text-sidebar-foreground hover:bg-sidebar-accent/60 transition-all duration-200 touch-manipulation text-left press-scale"
              >
                <SquarePen className="w-[18px] h-[18px] shrink-0 opacity-60" />
                <span className="flex-1 truncate font-medium">New Chat</span>
              </button>
            </div>
          ) : (
            <div className="px-1.5 pt-1">
              <button
                onClick={() => { onNew(); onSelectSkill?.(null); }}
                className="w-full flex items-center justify-center p-2 rounded-lg text-sidebar-foreground/40 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors touch-manipulation press-scale"
                title="New Chat"
              >
                <SquarePen className="w-[18px] h-[18px]" />
              </button>
            </div>
          )}

          <div className="mx-3 my-2 h-px bg-sidebar-border/40" />

          {/* Main nav items */}
          <div className="flex-1 overflow-y-auto">
            {!collapsed ? (
              <div className="px-3 space-y-0.5">
                {SIDEBAR_ITEMS.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      onSelectSkill?.(activeSkill === item.id ? null : item.id);
                      onNew();
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] transition-all duration-200 touch-manipulation text-left press-scale",
                      activeSkill === item.id
                        ? "bg-sidebar-accent text-sidebar-foreground font-medium"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                    )}
                  >
                    <item.icon className="w-[18px] h-[18px] shrink-0 opacity-70" />
                    <span className="flex-1 truncate">{item.label}</span>
                  </button>
                ))}

                {/* AI Labs */}
                <Link
                  to="/ai-labs"
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] transition-all duration-200 touch-manipulation text-left press-scale text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                >
                  <FlaskConical className="w-[18px] h-[18px] shrink-0 opacity-70" />
                  <span className="flex-1 truncate">AI Labs</span>
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">{ALL_TOOLS.length}</span>
                </Link>
              </div>
            ) : (
              <div className="px-1.5 space-y-0.5">
                {SIDEBAR_ITEMS.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      onSelectSkill?.(activeSkill === item.id ? null : item.id);
                      onNew();
                    }}
                    className={cn(
                      "w-full flex items-center justify-center p-2 rounded-lg transition-colors touch-manipulation press-scale",
                      activeSkill === item.id
                        ? "bg-sidebar-accent text-sidebar-foreground"
                        : "text-sidebar-foreground/40 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                    )}
                    title={item.label}
                  >
                    <item.icon className="w-[18px] h-[18px]" />
                  </button>
                ))}
                <Link
                  to="/ai-labs"
                  className="w-full flex items-center justify-center p-2 rounded-lg text-sidebar-foreground/40 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
                  title="AI Labs"
                >
                  <FlaskConical className="w-[18px] h-[18px]" />
                </Link>
              </div>
            )}

            <div className="mx-3 my-2 h-px bg-sidebar-border/40" />

            {/* Chat History */}
            {!collapsed ? (
              <div className="px-3">
                <button
                  onClick={() => setHistoryOpen((o) => !o)}
                  className="flex items-center gap-2 px-3 py-2 text-[13px] text-sidebar-foreground/40 hover:text-sidebar-foreground/60 transition-colors w-full"
                >
                  <Clock className="w-[16px] h-[16px] shrink-0" />
                  <span className="flex-1 text-left font-medium">Chat History</span>
                  {historyOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                {historyOpen && (
                  <div className="space-y-0.5 pb-2 mt-1">
                    {filteredConversations.length === 0 && (
                      <p className="text-[12px] text-muted-foreground/30 text-center py-3">
                        No conversations yet
                      </p>
                    )}
                    {filteredConversations.map((c) => (
                      <div
                        key={c.id}
                        className={cn(
                          "group flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-all duration-200 text-[13px]",
                          activeId === c.id
                            ? "bg-sidebar-accent text-sidebar-accent-foreground"
                            : "text-sidebar-foreground/50 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                        )}
                        onClick={() => onSelect(c.id)}
                      >
                        <span className="truncate flex-1">{c.title}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); onDelete(c.id); }}
                          className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:text-destructive transition-opacity"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="px-1.5">
                <button
                  onClick={() => onToggleCollapse()}
                  className="w-full flex items-center justify-center p-2 rounded-lg text-sidebar-foreground/40 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
                  title="Chat History"
                >
                  <Clock className="w-[18px] h-[18px]" />
                </button>
              </div>
            )}
          </div>

          {/* User section at bottom */}
          <div className="mt-auto border-t border-sidebar-border/40">
            {user ? (
              !collapsed ? (
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
                <div className="px-1.5 py-2">
                  <button
                    onClick={signOut}
                    className="w-full flex items-center justify-center p-2 rounded-lg text-sidebar-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors"
                    title="Sign Out"
                  >
                    <LogOut className="w-[18px] h-[18px]" />
                  </button>
                </div>
              )
            ) : (
              !collapsed ? (
                <div className="px-2 py-2">
                  <a
                    href="/auth"
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-primary text-primary-foreground text-[13px] font-medium hover:opacity-90 transition-opacity justify-center"
                  >
                    Sign In
                  </a>
                </div>
              ) : (
                <div className="px-1.5 py-2">
                  <a
                    href="/auth"
                    className="w-full flex items-center justify-center p-2 rounded-lg text-sidebar-foreground/40 hover:text-primary hover:bg-primary/10 transition-colors"
                    title="Sign In"
                  >
                    <LogOut className="w-[18px] h-[18px]" />
                  </a>
                </div>
              )
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

export default memo(ChatSidebar);
