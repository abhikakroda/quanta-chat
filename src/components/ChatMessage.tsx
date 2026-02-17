import { useState, memo, useCallback, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import hljs from "highlight.js/lib/core";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import python from "highlight.js/lib/languages/python";
import css from "highlight.js/lib/languages/css";
import xml from "highlight.js/lib/languages/xml";
import json from "highlight.js/lib/languages/json";
import bash from "highlight.js/lib/languages/bash";
import sql from "highlight.js/lib/languages/sql";
import markdown from "highlight.js/lib/languages/markdown";

hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("js", javascript);
hljs.registerLanguage("jsx", javascript);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("ts", typescript);
hljs.registerLanguage("tsx", typescript);
hljs.registerLanguage("python", python);
hljs.registerLanguage("css", css);
hljs.registerLanguage("html", xml);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("json", json);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("sh", bash);
hljs.registerLanguage("sql", sql);
hljs.registerLanguage("markdown", markdown);
hljs.registerLanguage("md", markdown);
import { ChevronDown, ChevronRight, Brain, Copy, Check, Pencil, RefreshCw, Clipboard, ClipboardCheck, Volume2, Loader2, User } from "lucide-react";
import { cn } from "@/lib/utils";

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const codeRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (codeRef.current) {
      codeRef.current.removeAttribute("data-highlighted");
      if (lang && hljs.getLanguage(lang)) {
        hljs.highlightElement(codeRef.current);
      } else {
        hljs.highlightElement(codeRef.current);
      }
    }
  }, [code, lang]);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="relative group/code rounded-xl glass-card overflow-hidden my-2">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/30 bg-muted/40">
        <span className="text-[11px] text-muted-foreground font-mono">{lang || "code"}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors touch-manipulation"
        >
          {copied ? <ClipboardCheck className="w-3.5 h-3.5" /> : <Clipboard className="w-3.5 h-3.5" />}
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
      <pre className="overflow-x-auto p-3 text-[14px] sm:text-[13px] leading-relaxed !bg-transparent"><code ref={codeRef} className={lang ? `language-${lang}` : ""}>{code}</code></pre>
    </div>
  );
}

type Props = {
  role: "user" | "assistant";
  content: string;
  thinking?: string;
  isThinking?: boolean;
  isStreaming?: boolean;
  onEdit?: (newContent: string) => void;
  onRegenerate?: () => void;
};

function ChatMessage({ role, content, thinking, isThinking, isStreaming, onEdit, onRegenerate }: Props) {
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
  const [speaking, setSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleSpeak = useCallback(async (text: string) => {
    if (speaking) {
      audioRef.current?.pause();
      audioRef.current = null;
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sarvam-tts`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ text: text.slice(0, 2500) }),
        }
      );
      if (!resp.ok) throw new Error("TTS failed");
      const data = await resp.json();
      if (data.audio) {
        const audio = new Audio(`data:audio/mp3;base64,${data.audio}`);
        audioRef.current = audio;
        audio.onended = () => { setSpeaking(false); audioRef.current = null; };
        await audio.play();
      }
    } catch (err) {
      console.error("TTS error:", err);
      setSpeaking(false);
    }
  }, [speaking]);

  return (
    <div className="group animate-message-in">
      <div className="py-2 sm:py-3 px-3 sm:px-4">
        <div className={cn(
          "max-w-3xl mx-auto flex gap-2.5 sm:gap-3",
          isUser ? "flex-row-reverse" : "flex-row"
        )}>
          {/* Avatar */}
          <div className="shrink-0 mt-1">
            <div className={cn(
              "w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold",
              isUser ? "bg-white/90 text-muted-foreground" : "bg-muted text-muted-foreground"
            )}>
              {isUser ? <User className="w-4 h-4 text-muted-foreground" /> : "Q"}
            </div>
          </div>

          {/* Content */}
          <div className={cn("max-w-[85%] sm:max-w-[75%] min-w-0", isUser ? "flex flex-col items-end" : "")}>
            {isUser ? (
              editing ? (
                <div className="space-y-2 w-full">
                  <textarea
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleEditSubmit(); } }}
                    className="w-full resize-none bg-muted/50 border border-border rounded-2xl outline-none text-[14px] text-foreground p-3 min-h-[60px] focus:border-foreground/20 transition-colors"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button onClick={handleEditSubmit} className="px-3 py-1.5 text-xs rounded-lg bg-primary text-primary-foreground hover:opacity-80 transition-opacity">Send</button>
                    <button onClick={() => { setEditing(false); setEditValue(content); }} className="px-3 py-1.5 text-xs rounded-lg text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-1">
                  {onEdit && (
                    <button
                      onClick={() => { setEditValue(content); setEditing(true); }}
                      className="shrink-0 p-1.5 rounded-md text-muted-foreground/40 sm:text-muted-foreground/0 sm:group-hover:text-muted-foreground/60 hover:!text-foreground active:text-foreground transition-colors mt-1"
                      title="Edit message"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                  )}
                  <div className="px-4 py-2.5 rounded-2xl rounded-tr-md bg-chat-user text-chat-user-foreground">
                    <p className="text-[15px] sm:text-[14px] leading-relaxed whitespace-pre-wrap break-words">{content}</p>
                  </div>
                </div>
              )
            ) : (
              <div className="space-y-2">
                <div className={cn("px-4 py-3 rounded-2xl rounded-tl-md bg-muted/60 glass-subtle", isStreaming && "streaming-text")}>
                  {isThinking && !thinking && (
                    <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                      <Brain className="w-3 h-3" />
                      <span>Thinking…</span>
                    </div>
                  )}

                  {thinking && (
                    <button
                      onClick={() => setThinkingOpen((o) => !o)}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-1"
                    >
                      <Brain className="w-3 h-3" />
                      <span>Reasoning</span>
                      {thinkingOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    </button>
                  )}
                  {thinking && thinkingOpen && (
                    <div className="pl-3 sm:pl-4 border-l-2 border-border text-xs text-muted-foreground max-h-48 overflow-y-auto mb-2">
                      <div className="prose prose-xs max-w-none prose-p:my-0.5 prose-p:text-muted-foreground break-words">
                        <ReactMarkdown>{thinking}</ReactMarkdown>
                      </div>
                    </div>
                  )}

                  {content && (
                    <div className="prose prose-sm max-w-none prose-p:my-1 prose-p:leading-relaxed prose-headings:my-2 prose-pre:my-2 prose-pre:p-0 prose-pre:bg-transparent prose-pre:border-0 prose-code:text-foreground prose-code:font-mono prose-code:text-[13px] sm:prose-code:text-[13px] text-[15px] sm:text-[14px] break-words overflow-hidden">
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
                              <code className="px-1.5 py-0.5 rounded bg-muted text-[14px] sm:text-[13px]" {...props}>
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

                  {!content && !isThinking && thinking && (
                    <div className="flex gap-1 py-1">
                      <div className="w-1 h-1 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <div className="w-1 h-1 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <div className="w-1 h-1 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                {content && !isThinking && (
                  <div className="flex items-center gap-3 ml-1">
                    <button
                      onClick={handleCopy}
                      className="flex items-center gap-1 text-[11px] text-muted-foreground/50 sm:text-muted-foreground/0 sm:group-hover:text-muted-foreground/60 hover:!text-foreground active:text-foreground transition-colors touch-manipulation"
                      title="Copy response"
                    >
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? "Copied" : "Copy"}</span>
                    </button>
                    <button
                      onClick={() => handleSpeak(content)}
                      className="flex items-center gap-1 text-[11px] text-muted-foreground/50 sm:text-muted-foreground/0 sm:group-hover:text-muted-foreground/60 hover:!text-foreground active:text-foreground transition-colors touch-manipulation"
                      title={speaking ? "Stop speaking" : "Read aloud"}
                    >
                      {speaking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Volume2 className="w-3.5 h-3.5" />}
                      <span>{speaking ? "Speaking" : "Listen"}</span>
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
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(ChatMessage);
