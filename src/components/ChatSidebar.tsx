import { Plus, MessageSquare, Trash2, LogOut, X } from "lucide-react";
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
};

export default function ChatSidebar({ conversations, activeId, onSelect, onNew, onDelete, open, onClose }: Props) {
  const { user, signOut } = useAuth();

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 bg-foreground/20 z-40 md:hidden" onClick={onClose} />
      )}
      <aside
        className={cn(
          "fixed md:relative z-50 md:z-auto flex flex-col h-full bg-sidebar border-r border-sidebar-border transition-transform duration-300 w-72",
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">Q</span>
            </div>
            <span className="font-semibold text-sidebar-foreground">Quanta AI</span>
          </div>
          <button onClick={onClose} className="md:hidden p-1 rounded-md hover:bg-sidebar-accent text-sidebar-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* New chat */}
        <div className="p-3">
          <button
            onClick={onNew}
            className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity font-medium text-sm"
          >
            <Plus className="w-4 h-4" />
            New Chat
          </button>
        </div>

        {/* Chat list */}
        <div className="flex-1 overflow-y-auto px-3 space-y-0.5">
          {conversations.map((c) => (
            <div
              key={c.id}
              className={cn(
                "group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors text-sm",
                activeId === c.id
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}
              onClick={() => onSelect(c.id)}
            >
              <MessageSquare className="w-4 h-4 shrink-0 opacity-60" />
              <span className="truncate flex-1">{c.title}</span>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(c.id); }}
                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 text-destructive transition-opacity"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        {/* User */}
        <div className="p-3 border-t border-sidebar-border">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-sm">
              {user?.email?.[0]?.toUpperCase() || "U"}
            </div>
            <span className="text-sm truncate flex-1 text-sidebar-foreground">{user?.email}</span>
            <button onClick={signOut} className="p-1.5 rounded-md hover:bg-sidebar-accent text-sidebar-foreground/60">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
