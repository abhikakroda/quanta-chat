import { useState, useRef, useEffect } from "react";
import { Code2, Loader2, Send, Eye, CodeXml, Copy, Check, RotateCcw, Sparkles, AlertTriangle, Download, Smartphone, Monitor, Tablet, GripVertical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

type ChatMsg = {
  role: "user" | "assistant";
  content: string;
  html?: string;
};

type ViewportSize = "desktop" | "tablet" | "mobile";

export default function CodeAssistantTool() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeHtml, setActiveHtml] = useState("");
  const [iframeErrors, setIframeErrors] = useState<string[]>([]);
  const [showErrors, setShowErrors] = useState(false);
  const [viewport, setViewport] = useState<ViewportSize>("desktop");
  const [buildProgress, setBuildProgress] = useState(0);
  const [chatWidth, setChatWidth] = useState(360);
  const [isDragging, setIsDragging] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Listen for iframe errors
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "iframe-error") {
        setIframeErrors((prev) => [...prev.slice(-19), e.data.message]);
        setShowErrors(true);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  const extractHtml = (text: string): string => {
    const match = text.match(/```html\n([\s\S]*?)```/);
    return match ? match[1] : "";
  };

  // Inject error catcher script into HTML
  const wrapHtmlWithErrorCatcher = (html: string): string => {
    const errorScript = `<script>
      window.onerror = function(msg, url, line, col, err) {
        parent.postMessage({ type: 'iframe-error', message: 'Line ' + line + ': ' + msg }, '*');
        return true;
      };
      window.addEventListener('unhandledrejection', function(e) {
        parent.postMessage({ type: 'iframe-error', message: 'Promise: ' + (e.reason?.message || e.reason) }, '*');
      });
    </script>`;
    if (html.includes("<head>")) {
      return html.replace("<head>", `<head>${errorScript}`);
    }
    return errorScript + html;
  };

  // Drag to resize chat panel
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragRef.current = { startX: e.clientX, startWidth: chatWidth };
    const handleMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const diff = ev.clientX - dragRef.current.startX;
      const newWidth = Math.max(280, Math.min(600, dragRef.current.startWidth + diff));
      setChatWidth(newWidth);
    };
    const handleUp = () => {
      setIsDragging(false);
      dragRef.current = null;
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleUp);
    };
    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleUp);
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    setError("");
    setIframeErrors([]);
    setBuildProgress(0);
    const userMsg: ChatMsg = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const history = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      // Simulate build progress
      const progressInterval = setInterval(() => {
        setBuildProgress((p) => Math.min(p + Math.random() * 15, 90));
      }, 500);

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          messages: history,
          model: "qwen-coder",
          enableThinking: false,
          skillPrompt: `You are an expert website builder AI. 
When the user asks to build or create a website/page/app, generate a COMPLETE single-file HTML page with embedded CSS and JavaScript inside a \`\`\`html code block.
Make it modern, responsive, visually appealing with gradients, animations, and clean typography.
When the user asks to modify the existing website, update the full HTML code and return it in a \`\`\`html code block.
Always return the FULL updated HTML — never partial snippets.
Before the code block, briefly describe what you're building (1-2 sentences).
After the code block, list what was added/changed as bullet points.`,
        }),
      });

      if (!resp.ok) throw new Error("Generation failed");
      const reader = resp.body?.getReader();
      if (!reader) throw new Error("No response");

      const decoder = new TextDecoder();
      let buffer = "";
      let fullResult = "";

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") break;
          try {
            const parsed = JSON.parse(json);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullResult += content;
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: "assistant", content: fullResult };
                return updated;
              });
            }
          } catch { /* partial */ }
        }
      }

      clearInterval(progressInterval);
      setBuildProgress(100);
      setTimeout(() => setBuildProgress(0), 1000);

      const html = extractHtml(fullResult);
      if (html) {
        setActiveHtml(html);
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: fullResult, html };
          return updated;
        });
      }
    } catch (err: any) {
      setError(err.message || "Generation failed");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(activeHtml);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadHtml = () => {
    const blob = new Blob([activeHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "website.html";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    setMessages([]);
    setActiveHtml("");
    setShowCode(false);
    setError("");
    setIframeErrors([]);
  };

  const hasPreview = !!activeHtml;

  const viewportStyles: Record<ViewportSize, string> = {
    desktop: "w-full h-full",
    tablet: "w-[768px] h-full mx-auto",
    mobile: "w-[375px] h-full mx-auto",
  };

  return (
    <div className="h-full flex flex-col animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Code2 className="w-4 h-4 text-primary" />
          </div>
          <h2 className="text-sm font-semibold text-foreground tracking-tight">Website Builder</h2>
          {loading && buildProgress > 0 && (
            <div className="flex items-center gap-2 ml-2">
              <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{ width: `${buildProgress}%` }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground">{Math.round(buildProgress)}%</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {hasPreview && (
            <>
              {/* Viewport toggle */}
              <div className="flex items-center gap-0.5 bg-muted/30 rounded-lg p-0.5">
                <button
                  onClick={() => setViewport("mobile")}
                  className={cn("p-1.5 rounded-md transition-colors", viewport === "mobile" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
                  title="Mobile"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setViewport("tablet")}
                  className={cn("p-1.5 rounded-md transition-colors", viewport === "tablet" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
                  title="Tablet"
                >
                  <Tablet className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setViewport("desktop")}
                  className={cn("p-1.5 rounded-md transition-colors", viewport === "desktop" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
                  title="Desktop"
                >
                  <Monitor className="w-3.5 h-3.5" />
                </button>
              </div>

              <button
                onClick={() => setShowCode(false)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                  !showCode ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <Eye className="w-3.5 h-3.5" />
                Preview
              </button>
              <button
                onClick={() => setShowCode(true)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                  showCode ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <CodeXml className="w-3.5 h-3.5" />
                Code
              </button>

              {/* Download button */}
              <button
                onClick={downloadHtml}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                title="Download HTML"
              >
                <Download className="w-3.5 h-3.5" />
              </button>

              {/* Error indicator */}
              {iframeErrors.length > 0 && (
                <button
                  onClick={() => setShowErrors(!showErrors)}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                >
                  <AlertTriangle className="w-3 h-3" />
                  {iframeErrors.length}
                </button>
              )}
            </>
          )}
          {messages.length > 0 && (
            <button onClick={handleReset} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors ml-1" title="New project">
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Chat panel - resizable */}
        <div
          className={cn("flex flex-col min-h-0 transition-all", hasPreview ? "border-r border-border/30" : "w-full")}
          style={hasPreview ? { width: `${chatWidth}px`, minWidth: 280, maxWidth: 600 } : undefined}
        >
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-16 space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-primary/5 flex items-center justify-center">
                  <Sparkles className="w-7 h-7 text-primary/40" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground/70">Describe a website</p>
                  <p className="text-xs text-muted-foreground mt-1">I'll build it live with a preview</p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center max-w-sm">
                  {["Portfolio site", "Landing page", "Dashboard UI", "E-commerce store", "Blog layout", "Restaurant site"].map((s) => (
                    <button
                      key={s}
                      onClick={() => { setInput(`Build a modern ${s.toLowerCase()}`); inputRef.current?.focus(); }}
                      className="px-3 py-1.5 rounded-full text-xs bg-muted/50 border border-border/30 text-foreground/60 hover:bg-muted hover:text-foreground transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cn(
                  "max-w-[90%] px-3.5 py-2.5 text-sm leading-relaxed",
                  msg.role === "user"
                    ? "bg-chat-user text-chat-user-foreground rounded-2xl rounded-br-md"
                    : "text-foreground"
                )}>
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm max-w-none text-foreground [&_pre]:hidden [&_code]:hidden">
                      <ReactMarkdown>
                        {msg.content.replace(/```html\n[\s\S]*?```/g, hasPreview ? "✅ *Website updated — see preview →*" : "")}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 px-3.5 py-2.5 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Building...
                </div>
              </div>
            )}

            {error && <p className="text-destructive text-xs text-center">{error}</p>}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-border/30">
            <div className="flex gap-2 items-end">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={hasPreview ? "Describe changes..." : "Describe a website to build..."}
                rows={1}
                className="flex-1 bg-muted/30 border border-border/30 rounded-xl px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 resize-none focus:outline-none focus:ring-1 focus:ring-primary/20 max-h-[100px] overflow-y-auto"
                style={{ minHeight: "40px" }}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || loading}
                className="w-9 h-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 disabled:opacity-30 transition-opacity shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Resize handle */}
        {hasPreview && (
          <div
            onMouseDown={handleMouseDown}
            className={cn(
              "w-2 cursor-col-resize flex items-center justify-center hover:bg-primary/10 transition-colors shrink-0",
              isDragging && "bg-primary/10"
            )}
          >
            <GripVertical className="w-3 h-3 text-muted-foreground/30" />
          </div>
        )}

        {/* Preview / Code panel */}
        {hasPreview && (
          <div className="flex-1 flex flex-col min-h-0 bg-muted/10">
            {showCode ? (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between px-4 py-2 border-b border-border/30">
                  <span className="text-xs text-muted-foreground font-mono">index.html</span>
                  <div className="flex items-center gap-2">
                    <button onClick={downloadHtml} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
                      <Download className="w-3 h-3" /> Download
                    </button>
                    <button onClick={copyCode} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
                      {copied ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-auto p-4">
                  <pre className="text-xs font-mono text-foreground/80 whitespace-pre-wrap leading-relaxed">{activeHtml}</pre>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col min-h-0">
                {/* Live preview */}
                <div className="flex-1 rounded-lg overflow-hidden m-2 border border-border/30 bg-white flex items-start justify-center">
                  <div className={cn("h-full transition-all duration-300", viewportStyles[viewport])}>
                    <iframe
                      ref={iframeRef}
                      srcDoc={wrapHtmlWithErrorCatcher(activeHtml)}
                      className="w-full h-full"
                      sandbox="allow-scripts"
                      title="Live Preview"
                    />
                  </div>
                </div>

                {/* Error console */}
                {showErrors && iframeErrors.length > 0 && (
                  <div className="border-t border-border/30 bg-destructive/5 max-h-[120px] overflow-y-auto">
                    <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/20">
                      <span className="text-[10px] font-medium text-destructive flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Console ({iframeErrors.length} errors)
                      </span>
                      <button onClick={() => { setIframeErrors([]); setShowErrors(false); }} className="text-[10px] text-muted-foreground hover:text-foreground">
                        Clear
                      </button>
                    </div>
                    <div className="p-2 space-y-1">
                      {iframeErrors.map((err, i) => (
                        <p key={i} className="text-[10px] font-mono text-destructive/80">{err}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
