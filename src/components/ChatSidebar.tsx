import { memo } from "react";
import { Plus, MessageSquare, Trash2, LogOut, X, Sparkles, PanelLeftClose } from "lucide-react";
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

function ChatSidebar({ conversations, activeId, onSelect, onNew, onDelete, open, onClose, collapsed, onToggleCollapse }: Props) {
  const { user, signOut } = useAuth();

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-40 md:hidden" onClick={onClose} />
      )}
      <aside
        className={cn(
          "fixed md:relative z-50 md:z-auto flex flex-col h-full bg-sidebar border-r border-sidebar-border transition-all duration-300 ease-out will-change-transform",
          // Mobile: slide in/out
          open ? "translate-x-0" : "-translate-x-full",
          // Desktop: collapse or show
          collapsed ? "md:w-0 md:border-r-0 md:overflow-hidden md:translate-x-0" : "md:translate-x-0 w-[280px]"
        )}
      >
        <div className="w-[280px] flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-semibold text-sidebar-foreground tracking-tight">Quanta</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={onToggleCollapse}
                className="hidden md:flex p-1.5 rounded-lg hover:bg-sidebar-accent text-sidebar-foreground/60 transition-colors"
                title="Hide sidebar"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
              <button onClick={onClose} className="md:hidden p-1.5 rounded-lg hover:bg-sidebar-accent text-sidebar-foreground/60 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* New chat */}
          <div className="px-3 pb-3">
            <button
              onClick={onNew}
              className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl border border-border/60 bg-card hover:bg-accent/50 hover:border-primary/20 transition-all duration-200 font-medium text-sm text-sidebar-foreground"
            >
              <Plus className="w-4 h-4" />
              New chat
            </button>
          </div>

          {/* Chat list */}
          <div className="flex-1 overflow-y-auto px-3 space-y-0.5">
            {conversations.length === 0 && (
              <p className="text-xs text-muted-foreground/50 text-center py-8">No conversations yet</p>
            )}
            {conversations.map((c) => (
              <div
                key={c.id}
                className={cn(
                  "group flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer transition-colors duration-150 text-sm",
                  activeId === c.id
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
                onClick={() => onSelect(c.id)}
              >
                <MessageSquare className="w-4 h-4 shrink-0 opacity-50" />
                <span className="truncate flex-1">{c.title}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(c.id); }}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-opacity"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* User */}
          <div className="p-3 border-t border-sidebar-border">
            <div className="flex items-center gap-3 px-2 py-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-primary-glow/20 flex items-center justify-center text-primary font-semibold text-sm">
                {user?.email?.[0]?.toUpperCase() || "U"}
              </div>
              <span className="text-xs truncate flex-1 text-sidebar-foreground/70">{user?.email}</span>
              <button
                onClick={signOut}
                className="p-1.5 rounded-lg hover:bg-sidebar-accent text-sidebar-foreground/40 hover:text-sidebar-foreground transition-colors"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

export default memo(ChatSidebar);