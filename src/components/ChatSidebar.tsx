import { memo, useState, useMemo } from "react";
import {
  SquarePen, Search, Trash2, LogOut, X, PanelLeftClose, PanelLeftOpen,
  Zap, Activity, MessageSquare, Clock, Code2, FileText, Globe, ChevronDown, ChevronUp, Sparkles
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
};

const FEATURES = [
  { icon: SquarePen, label: "New Chat", action: "new" as const },
  { icon: Globe, label: "Deep Research", badge: null, action: "skill" as const },
  { icon: Code2, label: "Code Assistant", badge: "Pro", action: "skill" as const },
  { icon: Sparkles, label: "Summarizer", badge: null, action: "skill" as const },
  { icon: FileText, label: "Writer", badge: null, action: "skill" as const },
  { icon: Zap, label: "Quick Tasks", badge: null, action: "skill" as const },
];

function ChatSidebar({ conversations, activeId, onSelect, onNew, onDelete, open, onClose, collapsed, onToggleCollapse }: Props) {
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
          "fixed md:relative z-50 md:z-auto flex flex-col h-full bg-sidebar border-r border-sidebar-border transition-all duration-200 ease-out will-change-transform",
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

          {/* Feature list */}
          {!collapsed ? (
            <div className="px-2 space-y-0.5 pt-1">
              {FEATURES.map((item) => (
                <button
                  key={item.label}
                  onClick={() => {
                    if (item.action === "new") { onNew(); return; }
                    navigator.clipboard.writeText(item.label);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors touch-manipulation text-left group"
                >
                  <item.icon className="w-[18px] h-[18px] shrink-0" />
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.badge && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary/15 text-primary">{item.badge}</span>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="px-1.5 space-y-0.5 pt-1">
              {FEATURES.map((item) => (
                <button
                  key={item.label}
                  onClick={() => {
                    if (item.action === "new") { onNew(); return; }
                  }}
                  className="w-full flex items-center justify-center p-2 rounded-lg text-sidebar-foreground/40 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors touch-manipulation"
                  title={item.label}
                >
                  <item.icon className="w-[18px] h-[18px]" />
                </button>
              ))}
            </div>
          )}

          {/* Divider */}
          <div className="mx-3 my-2 h-px bg-sidebar-border" />

          {/* Chat History section */}
          {!collapsed ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              <button
                onClick={() => setHistoryOpen((o) => !o)}
                className="flex items-center gap-3 px-5 py-2 text-[14px] font-medium text-sidebar-foreground/80 hover:text-sidebar-foreground transition-colors touch-manipulation"
              >
                <Clock className="w-[18px] h-[18px]" />
                <span className="flex-1 text-left">Chat History</span>
                {historyOpen ? <ChevronUp className="w-3.5 h-3.5 text-sidebar-foreground/30" /> : <ChevronDown className="w-3.5 h-3.5 text-sidebar-foreground/30" />}
              </button>

              {historyOpen && (
                <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
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
                    <p className="text-[12px] text-muted-foreground/30 text-center py-6">
                      {searchQuery ? "No matches" : "No conversations yet"}
                    </p>
                  )}
                  {filteredConversations.map((c) => (
                    <div
                      key={c.id}
                      className={cn(
                        "group flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-colors duration-100 text-[13px]",
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
            <div className="flex-1 flex flex-col items-center px-1.5 space-y-0.5">
              <button className="p-2 rounded-lg text-sidebar-foreground/40 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors" title="Chat History">
                <Clock className="w-[18px] h-[18px]" />
              </button>
              <button className="p-2 rounded-lg text-sidebar-foreground/40 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors" title="Stats">
                <Activity className="w-[18px] h-[18px]" />
              </button>
            </div>
          )}

          {/* User section */}
          <div className={cn("border-t border-sidebar-border", collapsed ? "px-1.5 py-2" : "px-2 py-2")}>
            {collapsed ? (
              <div className="flex flex-col items-center gap-1">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-[12px] font-semibold">
                  {user?.email?.[0]?.toUpperCase() || "U"}
                </div>
                <button onClick={signOut} className="p-2 rounded-lg hover:bg-sidebar-accent text-sidebar-foreground/30 hover:text-sidebar-foreground transition-colors touch-manipulation" title="Sign out">
                  <LogOut className="w-[16px] h-[16px]" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen((o) => !o)}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-sidebar-accent transition-colors touch-manipulation"
                >
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-[12px] font-semibold shrink-0">
                    {user?.email?.[0]?.toUpperCase() || "U"}
                  </div>
                  <span className="text-[13px] truncate flex-1 text-left text-sidebar-foreground/70 font-medium">
                    {user?.email?.split("@")[0] || "User"}
                  </span>
                  {userMenuOpen ? <ChevronUp className="w-3.5 h-3.5 text-sidebar-foreground/30" /> : <ChevronDown className="w-3.5 h-3.5 text-sidebar-foreground/30" />}
                </button>
                {userMenuOpen && (
                  <div className="absolute bottom-full left-2 right-2 mb-1 bg-card border border-border rounded-xl shadow-float z-50 py-1 animate-message-in">
                    <div className="px-3 py-2 border-b border-border">
                      <p className="text-[12px] text-muted-foreground truncate">{user?.email}</p>
                    </div>
                    <button
                      onClick={() => { signOut(); setUserMenuOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-sidebar-foreground/70 hover:bg-accent hover:text-foreground transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign out</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

export default memo(ChatSidebar);
