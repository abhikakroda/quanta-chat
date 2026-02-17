import { useState, memo, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { ChevronDown, ChevronRight, Brain, Copy, Check, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  role: "user" | "assistant";
  content: string;
  thinking?: string;
  isThinking?: boolean;
  onEdit?: (newContent: string) => void;
};

function ChatMessage({ role, content, thinking, isThinking, onEdit }: Props) {
  const isUser = role === "user";
  const [thinkingOpen, setThinkingOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(content);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [content]);

  const handleEditSubmit = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== content && onEdit) {
      onEdit(trimmed);
    }
    setEditing(false);
  };

  return (
    <div className="group animate-message-in">
      <div className={cn("py-4 px-4", isUser ? "" : "")}>
        <div className="max-w-2xl mx-auto flex gap-3">
          {/* Avatar */}
          <div className="shrink-0 mt-1.5">
            <div className={cn(
              "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold",
              isUser ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
            )}>
              {isUser ? "Y" : "Q"}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {isUser ? (
              editing ? (
                <div className="space-y-2">
                  <textarea
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleEditSubmit(); } }}
                    className="w-full resize-none bg-muted/50 border border-border rounded-lg outline-none text-[14px] text-foreground p-2 min-h-[60px] focus:border-foreground/20"
                    autoFocus
                  />
                  <div className="flex gap-1.5">
                    <button onClick={handleEditSubmit} className="px-2.5 py-1 text-xs rounded-md bg-foreground text-background hover:opacity-80 transition-opacity">Send</button>
                    <button onClick={() => { setEditing(false); setEditValue(content); }} className="px-2.5 py-1 text-xs rounded-md text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <p className="text-[14px] text-foreground leading-relaxed whitespace-pre-wrap pr-7">{content}</p>
                  {onEdit && (
                    <button
                      onClick={() => { setEditValue(content); setEditing(true); }}
                      className="absolute top-0 right-0 p-1 rounded-md text-muted-foreground/0 group-hover:text-muted-foreground/60 hover:!text-foreground transition-colors"
                      title="Edit message"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )
            ) : (
              <div className="space-y-2">
                {isThinking && !thinking && (
                  <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                    <Brain className="w-3 h-3" />
                    <span>Thinking…</span>
                  </div>
                )}

                {thinking && (
                  <button
                    onClick={() => setThinkingOpen((o) => !o)}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Brain className="w-3 h-3" />
                    <span>Reasoning</span>
                    {thinkingOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  </button>
                )}
                {thinking && thinkingOpen && (
                  <div className="pl-4 border-l-2 border-border text-xs text-muted-foreground max-h-48 overflow-y-auto">
                    <div className="prose prose-xs max-w-none prose-p:my-0.5 prose-p:text-muted-foreground">
                      <ReactMarkdown>{thinking}</ReactMarkdown>
                    </div>
                  </div>
                )}

                {content && (
                  <div className="prose prose-sm max-w-none prose-p:my-1 prose-p:leading-relaxed prose-headings:my-2 prose-pre:bg-muted prose-pre:rounded-lg prose-pre:border prose-pre:border-border prose-code:text-foreground prose-code:font-mono prose-code:text-[13px] text-[14px]">
                    <ReactMarkdown>{content}</ReactMarkdown>
                  </div>
                )}

                {/* Copy button for assistant */}
                {content && !isThinking && (
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1 text-[11px] text-muted-foreground/0 group-hover:text-muted-foreground/60 hover:!text-foreground transition-colors mt-1"
                    title="Copy response"
                  >
                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copied ? "Copied" : "Copy"}</span>
                  </button>
                )}

                {!content && !isThinking && thinking && (
                  <div className="flex gap-1 py-1">
                    <div className="w-1 h-1 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-1 h-1 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-1 h-1 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(ChatMessage);
