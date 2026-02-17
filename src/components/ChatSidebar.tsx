import { memo, useState, useMemo } from "react";
import { SquarePen, Search, Trash2, LogOut, X, PanelLeftClose, PanelLeftOpen, Zap, Activity, MessageSquare } from "lucide-react";
import { Conversation } from "@/hooks/useConversations";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

type SidebarPanel = "chats" | "skills" | "health" | null;

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
};

const SKILLS = [
  { emoji: "💻", name: "Code Assistant", prompt: "You are a coding expert. Help me write, debug, and optimize code." },
  { emoji: "📝", name: "Writer", prompt: "You are a professional writer. Help me draft, edit, and improve text." },
  { emoji: "🌐", name: "Translator", prompt: "You are a translator. Translate the following text accurately." },
  { emoji: "📊", name: "Data Analyst", prompt: "You are a data analyst. Help me analyze and interpret data." },
  { emoji: "🧮", name: "Math Tutor", prompt: "You are a math tutor. Explain concepts clearly and solve problems step by step." },
  { emoji: "📚", name: "Summarizer", prompt: "Summarize the following content concisely while keeping key points." },
];

function ChatSidebar({ conversations, activeId, onSelect, onNew, onDelete, open, onClose, collapsed, onToggleCollapse }: Props) {
  const { user, signOut } = useAuth();
  const [activePanel, setActivePanel] = useState<SidebarPanel>("chats");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter((c) => c.title.toLowerCase().includes(q));
  }, [conversations, searchQuery]);

  const handlePanelToggle = (panel: SidebarPanel) => {
    if (collapsed) {
      onToggleCollapse();
      setActivePanel(panel);
    } else {
      setActivePanel((prev) => (prev === panel ? null : panel));
    }
  };

  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-foreground/10 z-40 md:hidden" onClick={onClose} />
      )}

      <aside
        className={cn(
          "fixed md:relative z-50 md:z-auto flex flex-col h-full bg-sidebar border-r border-sidebar-border transition-all duration-200 ease-out will-change-transform",
          open ? "translate-x-0" : "-translate-x-full",
          collapsed
            ? "md:w-[52px] md:translate-x-0"
            : "md:translate-x-0 w-[260px]"
        )}
      >
        <div className={cn("flex flex-col h-full", collapsed ? "w-[52px]" : "w-[260px]")}>

          {/* Top icons / header */}
          <div className={cn("flex items-center px-2 pt-3 pb-1", collapsed ? "flex-col gap-1" : "justify-between px-3")}>
            {collapsed ? (
              <>
                <button onClick={onToggleCollapse} className="p-2 rounded-lg hover:bg-sidebar-accent text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors touch-manipulation" title="Expand sidebar">
                  <PanelLeftOpen className="w-[18px] h-[18px]" />
                </button>
                <button onClick={onNew} className="p-2 rounded-lg hover:bg-sidebar-accent text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors touch-manipulation" title="New chat">
                  <SquarePen className="w-[18px] h-[18px]" />
                </button>
                <div className="w-full h-px bg-sidebar-border my-1" />
                <button onClick={() => handlePanelToggle("chats")} className={cn("p-2 rounded-lg transition-colors touch-manipulation", activePanel === "chats" ? "bg-sidebar-accent text-sidebar-foreground" : "text-sidebar-foreground/40 hover:bg-sidebar-accent hover:text-sidebar-foreground")} title="Chats">
                  <MessageSquare className="w-[18px] h-[18px]" />
                </button>
                <button onClick={() => handlePanelToggle("skills")} className={cn("p-2 rounded-lg transition-colors touch-manipulation", activePanel === "skills" ? "bg-sidebar-accent text-sidebar-foreground" : "text-sidebar-foreground/40 hover:bg-sidebar-accent hover:text-sidebar-foreground")} title="Skills">
                  <Zap className="w-[18px] h-[18px]" />
                </button>
                <button onClick={() => handlePanelToggle("health")} className={cn("p-2 rounded-lg transition-colors touch-manipulation", activePanel === "health" ? "bg-sidebar-accent text-sidebar-foreground" : "text-sidebar-foreground/40 hover:bg-sidebar-accent hover:text-sidebar-foreground")} title="Usage Stats">
                  <Activity className="w-[18px] h-[18px]" />
                </button>
              </>
            ) : (
              <>
                <span className="text-sm font-medium text-sidebar-foreground tracking-tight pl-1">Quanta</span>
                <div className="flex items-center gap-0.5">
                  <button onClick={onNew} className="p-1.5 rounded-md hover:bg-sidebar-accent text-sidebar-foreground/40 hover:text-sidebar-foreground transition-colors touch-manipulation" title="New chat">
                    <SquarePen className="w-4 h-4" />
                  </button>
                  <button onClick={onToggleCollapse} className="hidden md:flex p-1.5 rounded-md hover:bg-sidebar-accent text-sidebar-foreground/40 hover:text-sidebar-foreground transition-colors">
                    <PanelLeftClose className="w-4 h-4" />
                  </button>
                  <button onClick={onClose} className="md:hidden p-1.5 rounded-md hover:bg-sidebar-accent text-sidebar-foreground/40 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Panel tabs (expanded) */}
          {!collapsed && (
            <div className="flex items-center gap-0.5 px-2 pt-1 pb-1">
              {([
                { id: "chats" as const, icon: MessageSquare, label: "Chats" },
                { id: "skills" as const, icon: Zap, label: "Skills" },
                { id: "health" as const, icon: Activity, label: "Stats" },
              ]).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActivePanel(tab.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium transition-colors touch-manipulation",
                    activePanel === tab.id
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/40 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  )}
                >
                  <tab.icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* Panels content */}
          {!collapsed && (
            <div className="flex-1 overflow-y-auto px-2 pt-1">
              {/* Chats panel */}
              {activePanel === "chats" && (
                <div className="space-y-1">
                  {/* Search */}
                  <div className="relative mb-2">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40" />
                    <input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search chats…"
                      className="w-full bg-sidebar-accent/50 border-0 rounded-lg pl-8 pr-3 py-1.5 text-[12px] text-sidebar-foreground placeholder:text-muted-foreground/40 outline-none focus:bg-sidebar-accent transition-colors"
                    />
                  </div>
                  {filteredConversations.length === 0 && (
                    <p className="text-xs text-muted-foreground/40 text-center py-6">
                      {searchQuery ? "No matches" : "No conversations yet"}
                    </p>
                  )}
                  {filteredConversations.map((c) => (
                    <div
                      key={c.id}
                      className={cn(
                        "group flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-colors duration-100 text-[13px]",
                        activeId === c.id
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
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

              {/* Skills panel */}
              {activePanel === "skills" && (
                <div className="space-y-1">
                  <p className="text-[11px] text-muted-foreground/50 px-1 py-1">Custom prompt presets</p>
                  {SKILLS.map((skill) => (
                    <button
                      key={skill.name}
                      onClick={() => {
                        navigator.clipboard.writeText(skill.prompt);
                      }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors touch-manipulation text-left"
                    >
                      <span className="text-base">{skill.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <span className="block truncate font-medium text-sidebar-foreground/80">{skill.name}</span>
                        <span className="block truncate text-[11px] text-muted-foreground/50">{skill.prompt.slice(0, 40)}…</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Health / Stats panel */}
              {activePanel === "health" && (
                <div className="space-y-3 pt-1">
                  <p className="text-[11px] text-muted-foreground/50 px-1">Usage overview</p>
                  <div className="space-y-2">
                    <StatCard label="Conversations" value={conversations.length.toString()} />
                    <StatCard label="Active Chat" value={activeId ? "Yes" : "None"} />
                    <StatCard label="Account" value={user?.email?.split("@")[0] || "—"} />
                  </div>
                  <div className="pt-2">
                    <p className="text-[11px] text-muted-foreground/50 px-1 mb-2">Model Status</p>
                    <div className="space-y-1">
                      {["Qwen 3.5", "Mistral", "DeepSeek", "MiniMax", "Sarvam"].map((name) => (
                        <div key={name} className="flex items-center gap-2 px-2.5 py-1.5 text-[12px] text-sidebar-foreground/60">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                          <span>{name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {collapsed && <div className="flex-1" />}

          {/* User section */}
          <div className={cn("border-t border-sidebar-border", collapsed ? "px-1 py-2" : "px-2 py-2")}>
            {collapsed ? (
              <div className="flex flex-col items-center gap-1">
                <button onClick={signOut} className="p-2 rounded-lg hover:bg-sidebar-accent text-sidebar-foreground/40 hover:text-sidebar-foreground transition-colors touch-manipulation" title="Sign out">
                  <LogOut className="w-[18px] h-[18px]" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-2.5 py-1.5">
                <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-[10px] font-medium">
                  {user?.email?.[0]?.toUpperCase() || "U"}
                </div>
                <span className="text-xs truncate flex-1 text-sidebar-foreground/60">{user?.email}</span>
                <button onClick={signOut} className="p-1 rounded hover:bg-sidebar-accent text-sidebar-foreground/30 hover:text-sidebar-foreground transition-colors" title="Sign out">
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-2.5 py-2 rounded-lg bg-sidebar-accent/30">
      <p className="text-[11px] text-muted-foreground/50">{label}</p>
      <p className="text-sm font-medium text-sidebar-foreground/80">{value}</p>
    </div>
  );
}

export default memo(ChatSidebar);
