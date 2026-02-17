import { useState, memo, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { ChevronDown, ChevronRight, Brain, Copy, Check, Pencil, RefreshCw, Clipboard, ClipboardCheck } from "lucide-react";
import { cn } from "@/lib/utils";

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="relative group/code rounded-lg border border-border bg-muted overflow-hidden my-2">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-muted/80">
        <span className="text-[11px] text-muted-foreground font-mono">{lang || "code"}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors touch-manipulation"
        >
          {copied ? <ClipboardCheck className="w-3.5 h-3.5" /> : <Clipboard className="w-3.5 h-3.5" />}
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
      <pre className="overflow-x-auto p-3 text-[13px] leading-relaxed"><code>{code}</code></pre>
    </div>
  );
}

type Props = {
  role: "user" | "assistant";
  content: string;
  thinking?: string;
  isThinking?: boolean;
  onEdit?: (newContent: string) => void;
  onRegenerate?: () => void;
};

function ChatMessage({ role, content, thinking, isThinking, onEdit, onRegenerate }: Props) {
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
      <div className="py-3 sm:py-4 px-3 sm:px-4">
        <div className="max-w-2xl mx-auto flex gap-2.5 sm:gap-3">
          {/* Avatar */}
          <div className="shrink-0 mt-1">
            <div className={cn(
              "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold",
              isUser ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
            )}>
              {isUser ? "Y" : "Q"}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 overflow-hidden">
            {isUser ? (
              editing ? (
                <div className="space-y-2">
                  <textarea
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleEditSubmit(); } }}
                    className="w-full resize-none bg-muted/50 border border-border rounded-lg outline-none text-[14px] text-foreground p-2.5 min-h-[60px] focus:border-foreground/20 transition-colors"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button onClick={handleEditSubmit} className="px-3 py-1.5 text-xs rounded-md bg-foreground text-background hover:opacity-80 transition-opacity">Send</button>
                    <button onClick={() => { setEditing(false); setEditValue(content); }} className="px-3 py-1.5 text-xs rounded-md text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-1">
                  <p className="text-[14px] text-foreground leading-relaxed whitespace-pre-wrap flex-1 min-w-0 break-words">{content}</p>
                  {onEdit && (
                    <button
                      onClick={() => { setEditValue(content); setEditing(true); }}
                      className="shrink-0 p-1.5 rounded-md text-muted-foreground/40 sm:text-muted-foreground/0 sm:group-hover:text-muted-foreground/60 hover:!text-foreground active:text-foreground transition-colors"
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
                  <div className="pl-3 sm:pl-4 border-l-2 border-border text-xs text-muted-foreground max-h-48 overflow-y-auto">
                    <div className="prose prose-xs max-w-none prose-p:my-0.5 prose-p:text-muted-foreground break-words">
                      <ReactMarkdown>{thinking}</ReactMarkdown>
                    </div>
                  </div>
                )}

                {content && (
                  <div className="prose prose-sm max-w-none prose-p:my-1 prose-p:leading-relaxed prose-headings:my-2 prose-pre:my-2 prose-pre:p-0 prose-pre:bg-transparent prose-pre:border-0 prose-code:text-foreground prose-code:font-mono prose-code:text-[13px] text-[14px] break-words overflow-hidden">
                    <ReactMarkdown
                      components={{
                        code({ className, children, ...props }) {
                          const match = /language-(\w+)/.exec(className || "");
                          const isBlock = match || (typeof children === "string" && children.includes("\n"));
                          if (isBlock) {
                            const lang = match?.[1] || "";
                            const codeStr = String(children).replace(/\n$/, "");
                            return <CodeBlock lang={lang} code={codeStr} />;
                          }
                          return (
                            <code className="px-1.5 py-0.5 rounded bg-muted text-[13px]" {...props}>
                              {children}
                            </code>
                          );
                        },
                        pre({ children }) {
                          return <>{children}</>;
                        },
                      }}
                    >
                      {content}
                    </ReactMarkdown>
                  </div>
                )}

                {/* Action buttons - always visible on mobile, hover on desktop */}
                {content && !isThinking && (
                  <div className="flex items-center gap-3 mt-1.5">
                    <button
                      onClick={handleCopy}
                      className="flex items-center gap-1 text-[11px] text-muted-foreground/50 sm:text-muted-foreground/0 sm:group-hover:text-muted-foreground/60 hover:!text-foreground active:text-foreground transition-colors touch-manipulation"
                      title="Copy response"
                    >
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? "Copied" : "Copy"}</span>
                    </button>
                    {onRegenerate && (
                      <button
                        onClick={onRegenerate}
                        className="flex items-center gap-1 text-[11px] text-muted-foreground/50 sm:text-muted-foreground/0 sm:group-hover:text-muted-foreground/60 hover:!text-foreground active:text-foreground transition-colors touch-manipulation"
                        title="Regenerate response"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Regenerate</span>
                      </button>
                    )}
                  </div>
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
