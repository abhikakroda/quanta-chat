import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Bot, User, ChevronDown, ChevronRight, Brain } from "lucide-react";
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
    <div className={cn("flex gap-3 px-4 py-4 max-w-3xl mx-auto w-full", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0 mt-0.5">
          <Bot className="w-4 h-4 text-primary-foreground" />
        </div>
      )}
      <div
        className={cn(
          "rounded-2xl px-4 py-3 max-w-[80%] text-sm leading-relaxed",
          isUser
            ? "bg-chat-user text-chat-user-foreground rounded-br-md"
            : "bg-chat-ai text-chat-ai-foreground rounded-bl-md shadow-sm border border-border"
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{content}</p>
        ) : (
          <div className="space-y-2">
            {/* Thinking indicator while streaming thinking */}
            {isThinking && !thinking && (
              <div className="flex items-center gap-2 text-muted-foreground text-xs">
                <Brain className="w-3.5 h-3.5 animate-pulse" />
                <span>Thinking...</span>
              </div>
            )}

            {/* Thinking block */}
            {thinking && (
              <div className="border border-border rounded-lg overflow-hidden">
                <button
                  onClick={() => setThinkingOpen((o) => !o)}
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs text-muted-foreground hover:bg-muted/50 transition-colors"
                >
                  <Brain className="w-3.5 h-3.5" />
                  <span className="font-medium">Reasoning</span>
                  {thinkingOpen ? (
                    <ChevronDown className="w-3.5 h-3.5 ml-auto" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 ml-auto" />
                  )}
                </button>
                {thinkingOpen && (
                  <div className="px-3 py-2 border-t border-border bg-muted/30 text-xs text-muted-foreground max-h-60 overflow-y-auto">
                    <div className="prose prose-xs max-w-none prose-p:my-0.5 prose-p:text-muted-foreground">
                      <ReactMarkdown>{thinking}</ReactMarkdown>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Main answer */}
            {content && (
              <div className="prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2 prose-pre:bg-muted prose-pre:rounded-lg prose-code:text-primary">
                <ReactMarkdown>{content}</ReactMarkdown>
              </div>
            )}

            {/* Loading dots when thinking is done but no answer yet */}
            {!content && !isThinking && thinking && (
              <div className="flex gap-1 py-1">
                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            )}
          </div>
        )}
      </div>
      {isUser && (
        <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0 mt-0.5">
          <User className="w-4 h-4 text-secondary-foreground" />
        </div>
      )}
    </div>
  );
}
