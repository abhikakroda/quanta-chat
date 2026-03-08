import { useState, memo, useCallback, useEffect, useRef, lazy, Suspense } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
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
import { ChevronDown, ChevronRight, Brain, Copy, Check, Pencil, RefreshCw, Clipboard, ClipboardCheck, Volume2, Loader2, ThumbsUp, ThumbsDown, Share } from "lucide-react";
import { cn } from "@/lib/utils";

const MermaidDiagram = lazy(() => import("@/components/MermaidDiagram"));

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const codeRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (codeRef.current) {
      codeRef.current.removeAttribute("data-highlighted");
      hljs.highlightElement(codeRef.current);
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
  imageUrl?: string;
  modelLabel?: string;
  onEdit?: (newContent: string) => void;
  onRegenerate?: () => void;
  feedback?: string | null;
  onFeedback?: (type: "up" | "down") => void;
};

function ChatMessage({ role, content, thinking, isThinking, isStreaming, imageUrl, modelLabel, onEdit, onRegenerate, feedback, onFeedback }: Props) {
  const isUser = role === "user";
  const [thinkingOpen, setThinkingOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(content);
  const [speaking, setSpeaking] = useState(false);
  const [localFeedback, setLocalFeedback] = useState<string | null>(feedback || null);

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

  const handleSpeak = useCallback(async (text: string) => {
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    const utterance = new SpeechSynthesisUtterance(text.slice(0, 3000));
    utterance.rate = 1;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }, [speaking]);

  const handleFeedback = (type: "up" | "down") => {
    setLocalFeedback(localFeedback === type ? null : type);
    onFeedback?.(type);
  };

  return (
    <div className="group animate-message-in">
      <div className="py-3 sm:py-5 px-3 sm:px-6">
        <div className="max-w-[720px] mx-auto">
          {isUser ? (
            /* ── User message: right-aligned bubble, no avatar ── */
            editing ? (
              <div className="space-y-2 ml-auto max-w-[85%]">
                <textarea
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleEditSubmit(); } }}
                  className="w-full resize-none bg-muted/50 border border-border rounded-2xl outline-none text-sm text-foreground p-3 min-h-[60px] focus:border-primary/30 transition-colors"
                  autoFocus
                />
                <div className="flex gap-2 justify-end">
                  <button onClick={() => { setEditing(false); setEditValue(content); }} className="px-3 py-1.5 text-xs rounded-lg text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
                  <button onClick={handleEditSubmit} className="px-3 py-1.5 text-xs rounded-lg bg-primary text-primary-foreground hover:opacity-80 transition-opacity">Save</button>
                </div>
              </div>
            ) : (
              <div className="flex justify-end items-start gap-1.5">
                {onEdit && (
                  <button
                    onClick={() => { setEditValue(content); setEditing(true); }}
                    className="shrink-0 p-1.5 rounded-md text-transparent group-hover:text-muted-foreground/50 hover:!text-foreground transition-colors mt-1"
                    title="Edit message"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                )}
                <div className="px-5 py-3 rounded-3xl bg-muted max-w-[80%]">
                  {imageUrl && (
                    <div className="mb-2">
                      <img
                        src={imageUrl}
                        alt="Attached image"
                        className="rounded-xl max-w-[240px] sm:max-w-[280px] max-h-[200px] object-cover"
                      />
                    </div>
                  )}
                  <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words text-foreground">{content}</p>
                </div>
              </div>
            )
          ) : (
            /* ── Assistant message: left-aligned, no avatar, no bubble ── */
            <div className="space-y-1">
              <div className={cn(isStreaming && "streaming-text")}>
                {isThinking && !thinking && (
                  <div className="flex items-center gap-2 text-muted-foreground text-xs py-2">
                    <Brain className="w-3.5 h-3.5 animate-pulse" />
                    <span>Thinking…</span>
                  </div>
                )}

                {thinking && (
                  <button
                    onClick={() => setThinkingOpen((o) => !o)}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2 py-1 px-2 rounded-lg bg-muted/50"
                  >
                    <Brain className="w-3 h-3" />
                    <span>Reasoning</span>
                    {thinkingOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  </button>
                )}
                {thinking && thinkingOpen && (
                  <div className="pl-3 border-l-2 border-border/50 text-xs text-muted-foreground max-h-48 overflow-y-auto mb-3">
                    <div className="prose prose-xs max-w-none prose-p:my-0.5 prose-p:text-muted-foreground break-words">
                      <ReactMarkdown>{thinking}</ReactMarkdown>
                    </div>
                  </div>
                )}

                {content && (
                  <div className="prose prose-sm max-w-none prose-p:my-3 prose-p:leading-[1.8] prose-headings:my-4 prose-headings:text-foreground prose-h1:text-xl prose-h2:text-lg prose-h3:text-base prose-h3:font-semibold prose-pre:my-3 prose-pre:p-0 prose-pre:bg-transparent prose-pre:border-0 prose-code:text-foreground prose-code:font-mono prose-code:text-[13px] text-[15px] leading-[1.8] break-words overflow-hidden prose-li:my-1 prose-li:leading-[1.8] prose-ul:my-3 prose-ol:my-3 prose-ul:pl-5 prose-ol:pl-5 prose-strong:text-foreground prose-strong:font-semibold [&_.katex-display]:my-3 [&_.katex-display]:overflow-x-auto [&_.katex]:text-foreground text-foreground prose-blockquote:border-l-2 prose-blockquote:border-primary/30 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-muted-foreground prose-hr:my-6 prose-hr:border-border/50">
                    <ReactMarkdown
                      remarkPlugins={[remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                      components={{
                        code({ className, children, ...props }) {
                          const match = /language-(\w+)/.exec(className || "");
                          const lang = match?.[1] || "";
                          const codeStr = String(children).replace(/\n$/, "");
                          const isBlock = match || (typeof children === "string" && children.includes("\n"));

                          if (lang === "mermaid") {
                            return (
                              <Suspense fallback={<div className="py-4 text-xs text-muted-foreground animate-pulse">Rendering diagram…</div>}>
                                <MermaidDiagram chart={codeStr} />
                              </Suspense>
                            );
                          }

                          if (isBlock) {
                            return <CodeBlock lang={lang} code={codeStr} />;
                          }
                          return (
                            <code className="px-1.5 py-0.5 rounded-md bg-muted text-[13px] font-mono" {...props}>
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
                  <div className="flex gap-1.5 py-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30 animate-fast-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30 animate-fast-bounce" style={{ animationDelay: "100ms" }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30 animate-fast-bounce" style={{ animationDelay: "200ms" }} />
                  </div>
                )}
              </div>

              {/* Action icons row — ChatGPT style */}
              {content && !isThinking && !isStreaming && (
                <div className="flex items-center gap-0.5 pt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <button
                    onClick={handleCopy}
                    className="p-1.5 rounded-lg text-muted-foreground/60 hover:text-foreground hover:bg-muted/50 transition-colors touch-manipulation"
                    title={copied ? "Copied" : "Copy"}
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => handleFeedback("up")}
                    className={cn(
                      "p-1.5 rounded-lg transition-colors touch-manipulation",
                      localFeedback === "up" ? "text-foreground bg-muted/50" : "text-muted-foreground/60 hover:text-foreground hover:bg-muted/50"
                    )}
                    title="Good response"
                  >
                    <ThumbsUp className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleFeedback("down")}
                    className={cn(
                      "p-1.5 rounded-lg transition-colors touch-manipulation",
                      localFeedback === "down" ? "text-foreground bg-muted/50" : "text-muted-foreground/60 hover:text-foreground hover:bg-muted/50"
                    )}
                    title="Bad response"
                  >
                    <ThumbsDown className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleSpeak(content)}
                    className={cn(
                      "p-1.5 rounded-lg transition-colors touch-manipulation",
                      speaking ? "text-foreground bg-muted/50" : "text-muted-foreground/60 hover:text-foreground hover:bg-muted/50"
                    )}
                    title={speaking ? "Stop" : "Read aloud"}
                  >
                    {speaking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Volume2 className="w-4 h-4" />}
                  </button>
                  {onRegenerate && (
                    <button
                      onClick={onRegenerate}
                      className="p-1.5 rounded-lg text-muted-foreground/60 hover:text-foreground hover:bg-muted/50 transition-colors touch-manipulation"
                      title="Regenerate"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  )}
                  {modelLabel && (
                    <span className="text-[10px] text-muted-foreground/40 ml-auto font-mono">
                      {modelLabel}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(ChatMessage);
