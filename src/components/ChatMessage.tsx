import { useState, memo } from "react";
import ReactMarkdown from "react-markdown";
import { ChevronDown, ChevronRight, Brain } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  role: "user" | "assistant";
  content: string;
  thinking?: string;
  isThinking?: boolean;
};

function ChatMessage({ role, content, thinking, isThinking }: Props) {
  const isUser = role === "user";
  const [thinkingOpen, setThinkingOpen] = useState(false);

  return (
    <div className="animate-message-in">
      <div className={cn("py-4 px-4", isUser ? "" : "")}>
        <div className="max-w-2xl mx-auto flex gap-3">
          {/* Avatar - tiny dot */}
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
              <p className="text-[14px] text-foreground leading-relaxed whitespace-pre-wrap">{content}</p>
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