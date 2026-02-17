import { memo } from "react";
import { SquarePen, Search, MessageSquare, Trash2, LogOut, X, PanelLeftClose, PanelLeftOpen } from "lucide-react";
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
        <div className="fixed inset-0 bg-foreground/10 z-40 md:hidden" onClick={onClose} />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed md:relative z-50 md:z-auto flex flex-col h-full bg-sidebar border-r border-sidebar-border transition-all duration-200 ease-out will-change-transform",
          open ? "translate-x-0" : "-translate-x-full",
          collapsed
            ? "md:w-[52px] md:translate-x-0"
            : "md:translate-x-0 w-[260px]"
        )}
      >
        {/* Icon rail (collapsed) or full sidebar */}
        <div className={cn("flex flex-col h-full", collapsed ? "w-[52px]" : "w-[260px]")}>

          {/* Top icons / header */}
          <div className={cn("flex items-center px-2 pt-3 pb-1", collapsed ? "flex-col gap-2" : "justify-between px-3")}>
            {collapsed ? (
              <>
                <button
                  onClick={onToggleCollapse}
                  className="p-2 rounded-lg hover:bg-sidebar-accent text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors touch-manipulation"
                  title="Expand sidebar"
                >
                  <PanelLeftOpen className="w-[18px] h-[18px]" />
                </button>
                <button
                  onClick={onNew}
                  className="p-2 rounded-lg hover:bg-sidebar-accent text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors touch-manipulation"
                  title="New chat"
                >
                  <SquarePen className="w-[18px] h-[18px]" />
                </button>
              </>
            ) : (
              <>
                <span className="text-sm font-medium text-sidebar-foreground tracking-tight pl-1">Quanta</span>
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={onNew}
                    className="p-1.5 rounded-md hover:bg-sidebar-accent text-sidebar-foreground/40 hover:text-sidebar-foreground transition-colors touch-manipulation"
                    title="New chat"
                  >
                    <SquarePen className="w-4 h-4" />
                  </button>
                  <button
                    onClick={onToggleCollapse}
                    className="hidden md:flex p-1.5 rounded-md hover:bg-sidebar-accent text-sidebar-foreground/40 hover:text-sidebar-foreground transition-colors"
                  >
                    <PanelLeftClose className="w-4 h-4" />
                  </button>
                  <button onClick={onClose} className="md:hidden p-1.5 rounded-md hover:bg-sidebar-accent text-sidebar-foreground/40 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Conversation list (hidden when collapsed) */}
          {!collapsed && (
            <div className="flex-1 overflow-y-auto px-2 pt-2 space-y-px">
              {conversations.length === 0 && (
                <p className="text-xs text-muted-foreground/40 text-center py-8">No conversations yet</p>
              )}
              {conversations.map((c) => (
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

          {/* Spacer when collapsed */}
          {collapsed && <div className="flex-1" />}

          {/* User section */}
          <div className={cn("border-t border-sidebar-border", collapsed ? "px-1 py-2" : "px-2 py-2")}>
            {collapsed ? (
              <div className="flex flex-col items-center gap-1">
                <button
                  onClick={signOut}
                  className="p-2 rounded-lg hover:bg-sidebar-accent text-sidebar-foreground/40 hover:text-sidebar-foreground transition-colors touch-manipulation"
                  title="Sign out"
                >
                  <LogOut className="w-[18px] h-[18px]" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-2.5 py-1.5">
                <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-[10px] font-medium">
                  {user?.email?.[0]?.toUpperCase() || "U"}
                </div>
                <span className="text-xs truncate flex-1 text-sidebar-foreground/60">{user?.email}</span>
                <button
                  onClick={signOut}
                  className="p-1 rounded hover:bg-sidebar-accent text-sidebar-foreground/30 hover:text-sidebar-foreground transition-colors"
                  title="Sign out"
                >
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

export default memo(ChatSidebar);
