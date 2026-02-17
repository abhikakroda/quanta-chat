import { memo, useState, useMemo } from "react";
import {
  SquarePen, Search, Trash2, LogOut, X, PanelLeftClose, PanelLeftOpen,
  Zap, Activity, Clock, Code2, FileText, Globe, ChevronDown, ChevronUp, Sparkles,
  Wrench, Calculator, Languages, Image, Bug, Eye, Mic, CalendarDays, BookOpen, BadgeInfo
} from "lucide-react";
import { Conversation } from "@/hooks/useConversations";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

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
  onOpenCrawl?: () => void;
};

export const SKILLS = [
  { id: "deep-research", icon: Globe, label: "Deep Research", badge: null, prompt: "You are a deep research assistant. Analyze topics thoroughly from multiple angles, provide comprehensive findings with citations and evidence. Structure your responses with clear sections, key findings, and actionable insights." },
  { id: "code-assistant", icon: Code2, label: "Code Assistant", badge: "Pro", prompt: "You are an expert coding assistant. Write clean, efficient, well-documented code. Explain your approach, suggest best practices, handle edge cases, and provide working examples. Support debugging and code review." },
  { id: "summarizer", icon: Sparkles, label: "Summarizer", badge: null, prompt: "You are a summarization expert. Condense long texts into clear, concise summaries. Preserve key points, main arguments, and critical details. Provide bullet-point summaries and brief overviews." },
  { id: "writer", icon: FileText, label: "Writer", badge: null, prompt: "You are a professional writer and editor. Help craft compelling content — articles, emails, essays, stories, and more. Focus on clarity, tone, structure, and engagement. Adapt your style to the user's needs." },
  { id: "quick-tasks", icon: Zap, label: "Quick Tasks", badge: null, prompt: "You are a quick task assistant optimized for speed. Provide direct, concise answers. Handle translations, calculations, conversions, quick lookups, and simple tasks with minimal explanation unless asked." },
] as const;

export const TOOLS = [
  { id: "calculator", icon: Calculator, label: "Calculator", prompt: "You are a math and calculation assistant." },
  { id: "translator", icon: Languages, label: "Translator", prompt: "You are a multilingual translator." },
  { id: "image-describer", icon: Image, label: "Image Describer", prompt: "You are an image analysis assistant." },
  { id: "voice-chat", icon: Mic, label: "Voice Chat", badge: "Sarvam", prompt: "You are a voice assistant." },
  { id: "vision", icon: Eye, label: "Vision (Text→PDF)", prompt: "You convert text to documents." },
  { id: "task-scheduler", icon: CalendarDays, label: "Task Scheduler", prompt: "You help schedule tasks." },
] as const;

export const OPENCLAW_ITEMS = [
  { id: "crawl", icon: Globe, label: "Crawl a Website", comingSoon: false },
  { id: "auto-agent", icon: Zap, label: "Auto Agent", comingSoon: true },
  { id: "web-pilot", icon: BookOpen, label: "Web Pilot", comingSoon: true },
  { id: "data-extractor", icon: Activity, label: "Data Extractor", comingSoon: true },
] as const;

export type SkillId = typeof SKILLS[number]["id"];
export type ToolId = typeof TOOLS[number]["id"];

function ChatSidebar({ conversations, activeId, onSelect, onNew, onDelete, open, onClose, collapsed, onToggleCollapse, activeSkill, onSelectSkill, onOpenCrawl }: Props) {
  const { user, signOut } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [historyOpen, setHistoryOpen] = useState(true);
  const [skillsOpen, setSkillsOpen] = useState(true);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [openClawOpen, setOpenClawOpen] = useState(false);
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
              <>
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-sm mb-1">Q</div>
                <button onClick={onToggleCollapse} className="p-2 rounded-lg hover:bg-sidebar-accent text-sidebar-foreground/40 hover:text-sidebar-foreground transition-colors touch-manipulation" title="Expand">
                  <PanelLeftOpen className="w-[18px] h-[18px]" />
                </button>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">Q</div>
                  <span className="text-[15px] font-semibold text-sidebar-foreground tracking-tight">Quanta</span>
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

          {/* New Chat button */}
          {!collapsed ? (
            <div className="px-3 pt-2">
              <button
                onClick={() => { onNew(); onSelectSkill?.(null); }}
                className="w-full flex items-center gap-3.5 px-3 py-2.5 rounded-2xl text-[15px] text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-all duration-200 hover:translate-x-0.5 touch-manipulation text-left press-scale tracking-tight"
              >
                <SquarePen className="w-[20px] h-[20px] shrink-0 opacity-70" />
                <span className="flex-1 truncate">New Chat</span>
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

          <div className="mx-3 my-1.5 h-px bg-sidebar-border/50" />

          {/* Scrollable sections */}
          <div className="flex-1 overflow-y-auto">

            {/* Skills section */}
            {!collapsed ? (
              <div className="px-3 mt-2">
                <p className="px-2 py-2.5 text-[13px] font-normal tracking-wide text-sidebar-foreground/35">
                  Skills
                </p>
                <div className="space-y-1">
                    {SKILLS.map((skill) => (
                      <button
                        key={skill.id}
                        onClick={() => {
                          onSelectSkill?.(activeSkill === skill.id ? null : skill.id);
                          onNew();
                        }}
                        className={cn(
                          "w-full flex items-center gap-3.5 px-3 py-2.5 rounded-2xl text-[15px] font-normal transition-all duration-200 hover:translate-x-0.5 touch-manipulation text-left press-scale tracking-tight",
                          activeSkill === skill.id
                            ? "bg-sidebar-accent text-sidebar-foreground"
                            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                        )}
                      >
                        <skill.icon className="w-[22px] h-[22px] shrink-0 opacity-70" />
                        <span className="flex-1 truncate">{skill.label}</span>
                        {skill.badge && (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">{skill.badge}</span>
                        )}
                      </button>
                    ))}
                </div>
              </div>
            ) : (
              <div className="px-1.5 space-y-0.5">
                {SKILLS.map((skill) => (
                  <button
                    key={skill.id}
                    onClick={() => {
                      onSelectSkill?.(activeSkill === skill.id ? null : skill.id);
                      onNew();
                    }}
                    className={cn(
                      "w-full flex items-center justify-center p-2 rounded-lg transition-colors touch-manipulation press-scale",
                      activeSkill === skill.id
                        ? "bg-primary/10 text-primary"
                        : "text-sidebar-foreground/40 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                    )}
                    title={skill.label}
                  >
                    <skill.icon className="w-[18px] h-[18px]" />
                  </button>
                ))}
              </div>
            )}

            {/* Tools section */}
            {!collapsed ? (
              <div className="px-3 mt-1">
                <p className="px-2 py-2.5 text-[13px] font-normal tracking-wide text-sidebar-foreground/35">
                  Tools
                </p>
                <div className="space-y-1">
                    {TOOLS.map((tool) => (
                      <button
                        key={tool.id}
                        onClick={() => {
                          onSelectSkill?.(activeSkill === tool.id ? null : tool.id);
                          onNew();
                        }}
                        className={cn(
                          "w-full flex items-center gap-3.5 px-3 py-2.5 rounded-2xl text-[15px] font-normal transition-all duration-200 hover:translate-x-0.5 touch-manipulation text-left press-scale tracking-tight",
                          activeSkill === tool.id
                            ? "bg-sidebar-accent text-sidebar-foreground"
                            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                        )}
                      >
                        <tool.icon className="w-[22px] h-[22px] shrink-0 opacity-70" />
                        <span className="flex-1 truncate">{tool.label}</span>
                        {"badge" in tool && (tool as any).badge && (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">{(tool as any).badge}</span>
                        )}
                      </button>
                    ))}
                </div>
              </div>
            ) : (
              <div className="px-1.5 space-y-0.5 mt-1">
                {TOOLS.map((tool) => (
                  <button
                    key={tool.id}
                    onClick={() => {
                      onSelectSkill?.(activeSkill === tool.id ? null : tool.id);
                      onNew();
                    }}
                    className={cn(
                      "w-full flex items-center justify-center p-2 rounded-lg transition-colors touch-manipulation press-scale",
                      activeSkill === tool.id
                        ? "bg-primary/10 text-primary"
                        : "text-sidebar-foreground/40 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                    )}
                    title={tool.label}
                  >
                    <tool.icon className="w-[18px] h-[18px]" />
                  </button>
                ))}
              </div>
            )}

            {/* Open Claw section */}
            {!collapsed ? (
              <div className="px-3 mt-1">
                <div className="flex items-center gap-2 px-2 py-2.5">
                  <span className="text-[13px] font-normal tracking-wide text-sidebar-foreground/35">Open Claw</span>
                  <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">NEW</span>
                </div>
                <div className="space-y-1">
                    {OPENCLAW_ITEMS.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          if (!item.comingSoon) {
                            if (item.id === "crawl") { onOpenCrawl?.(); }
                          }
                        }}
                        disabled={item.comingSoon}
                        className={cn(
                          "w-full flex items-center gap-3.5 px-3 py-2.5 rounded-2xl text-[15px] font-normal transition-all duration-200 touch-manipulation text-left tracking-tight",
                          item.comingSoon
                            ? "text-sidebar-foreground/25 cursor-not-allowed"
                            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground hover:translate-x-0.5 press-scale"
                        )}
                      >
                        <item.icon className="w-[22px] h-[22px] shrink-0 opacity-70" />
                        <span className="flex-1 truncate">{item.label}</span>
                        {item.comingSoon && (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Soon</span>
                        )}
                      </button>
                    ))}
                </div>
              </div>
            ) : (
              <div className="px-1.5 space-y-0.5 mt-1">
                <button
                  onClick={onOpenCrawl}
                  className="w-full flex items-center justify-center p-2 rounded-lg text-sidebar-foreground/40 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors touch-manipulation press-scale"
                  title="Open Claw"
                >
                  <Bug className="w-[18px] h-[18px]" />
                </button>
              </div>
            )}

            <div className="mx-3 my-2 h-px bg-sidebar-border/50" />

            {/* Chat History section */}
            {!collapsed ? (
              <div className="px-3">
                <button
                  onClick={() => setHistoryOpen((o) => !o)}
                  className="flex items-center gap-2 px-2 py-2.5 text-[13px] font-normal tracking-wide text-sidebar-foreground/35 hover:text-sidebar-foreground/50 transition-colors w-full"
                >
                  <span className="flex-1 text-left">History</span>
                  {historyOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                {historyOpen && (
                  <div className="space-y-0.5 pb-2">
                    {/* Search */}
                    <div className="relative px-1 mb-1">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/30" />
                      <input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search…"
                        className="w-full bg-sidebar-accent/40 border-0 rounded-lg pl-8 pr-3 py-1.5 text-[12px] text-sidebar-foreground placeholder:text-muted-foreground/30 outline-none focus:bg-sidebar-accent transition-colors"
                      />
                    </div>

                    {filteredConversations.length === 0 && (
                      <p className="text-[12px] text-muted-foreground/30 text-center py-4">
                        {searchQuery ? "No matches" : "No conversations yet"}
                      </p>
                    )}
                    {filteredConversations.map((c) => (
                      <div
                        key={c.id}
                        className={cn(
                          "group flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-all duration-200 text-[13px] hover:translate-x-0.5",
                          activeId === c.id
                            ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-elegant"
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
                  onClick={() => { onToggleCollapse(); }}
                  className="w-full flex items-center justify-center p-2 rounded-lg text-sidebar-foreground/40 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
                  title="Chat History"
                >
                  <Clock className="w-[18px] h-[18px]" />
                </button>
              </div>
            )}
          </div>

          {/* User section */}
          <div className="mt-auto border-t border-sidebar-border/50">
            {!collapsed ? (
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
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

export default memo(ChatSidebar);
