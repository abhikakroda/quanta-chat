import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Sparkles, User, ChevronDown, ChevronRight, Brain } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  role: "user" | "assistant";
  content: string;
  thinking?: string;
  isThinking?: boolean;
};

export default function ChatMessage({ role, content, thinking, isThinking }: Props) {
  const isUser = role === "user";
  const [thinkingOpen, setThinkingOpen] = useState(false);

  return (
    <div className="animate-message-in">
      <div className={cn(
        "py-5 px-4",
        isUser ? "" : "bg-muted/30"
      )}>
        <div className="max-w-3xl mx-auto flex gap-4">
          {/* Avatar */}
          <div className="shrink-0 mt-0.5">
            {isUser ? (
              <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center">
                <User className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
            ) : (
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 text-primary-foreground" />
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-foreground/70 mb-1.5 uppercase tracking-wider">
              {isUser ? "You" : "Quanta"}
            </div>

            {isUser ? (
              <p className="text-[15px] text-foreground leading-relaxed whitespace-pre-wrap">{content}</p>
            ) : (
              <div className="space-y-3">
                {/* Thinking indicator */}
                {isThinking && !thinking && (
                  <div className="flex items-center gap-2 text-muted-foreground text-xs">
                    <Brain className="w-3.5 h-3.5 animate-pulse text-primary" />
                    <span className="animate-shimmer px-2 py-0.5 rounded-full">Thinking...</span>
                  </div>
                )}

                {/* Thinking block */}
                {thinking && (
                  <div className="rounded-lg border border-border/60 overflow-hidden bg-card/50">
                    <button
                      onClick={() => setThinkingOpen((o) => !o)}
                      className="flex items-center gap-2 w-full px-3 py-2 text-xs text-muted-foreground hover:bg-muted/50 transition-colors"
                    >
                      <Brain className="w-3.5 h-3.5 text-primary/60" />
                      <span className="font-medium">Reasoning</span>
                      {thinkingOpen ? (
                        <ChevronDown className="w-3.5 h-3.5 ml-auto" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 ml-auto" />
                      )}
                    </button>
                    {thinkingOpen && (
                      <div className="px-3 py-2.5 border-t border-border/60 text-xs text-muted-foreground max-h-60 overflow-y-auto bg-muted/20">
                        <div className="prose prose-xs max-w-none prose-p:my-0.5 prose-p:text-muted-foreground">
                          <ReactMarkdown>{thinking}</ReactMarkdown>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Main answer */}
                {content && (
                  <div className="prose prose-sm max-w-none prose-p:my-1.5 prose-p:leading-relaxed prose-headings:my-3 prose-pre:bg-muted prose-pre:rounded-lg prose-pre:border prose-pre:border-border prose-code:text-primary prose-code:font-mono prose-code:text-[13px] prose-a:text-primary prose-a:no-underline hover:prose-a:underline text-[15px]">
                    <ReactMarkdown>{content}</ReactMarkdown>
                  </div>
                )}

                {/* Loading dots when thinking is done but no answer yet */}
                {!content && !isThinking && thinking && (
                  <div className="flex gap-1.5 py-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "300ms" }} />
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