import { useState, useRef, useEffect, useCallback } from "react";
import { Code2, Loader2, Send, Eye, CodeXml, Copy, Check, RotateCcw, Sparkles, AlertTriangle, Download, Smartphone, Monitor, Tablet, GripVertical, MessageSquare, Maximize2, Minimize2, FolderOpen, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

type ChatMsg = {
  role: "user" | "assistant";
  content: string;
  html?: string;
};

type ViewportSize = "desktop" | "tablet" | "mobile";

type SavedProject = {
  id: string;
  title: string;
  messages: ChatMsg[];
  active_html: string;
  updated_at: string;
};

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
  const [mobileTab, setMobileTab] = useState<"chat" | "preview">("chat");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>([]);
  const [showProjects, setShowProjects] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const isMobile = useIsMobile();
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load saved projects on mount
  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    setLoadingProjects(true);
    const { data } = await supabase
      .from("website_builder_projects")
      .select("id, title, messages, active_html, updated_at")
      .order("updated_at", { ascending: false });
    if (data) setSavedProjects(data as unknown as SavedProject[]);
    setLoadingProjects(false);
  };

  // Auto-save current project (debounced)
  const saveProject = useCallback(async (msgs: ChatMsg[], html: string, projectId: string | null) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || msgs.length === 0) return;

    const title = msgs[0]?.content?.slice(0, 50) || "Untitled Project";

    if (projectId) {
      await supabase
        .from("website_builder_projects")
        .update({ messages: msgs as any, active_html: html, title })
        .eq("id", projectId);
    } else {
      const { data } = await supabase
        .from("website_builder_projects")
        .insert({ user_id: session.user.id, messages: msgs as any, active_html: html, title })
        .select("id")
        .single();
      if (data) setCurrentProjectId(data.id);
    }
    loadProjects();
  }, []);

  const debouncedSave = useCallback((msgs: ChatMsg[], html: string, projectId: string | null) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => saveProject(msgs, html, projectId), 1500);
  }, [saveProject]);

  const loadProject = (project: SavedProject) => {
    setMessages(project.messages);
    setActiveHtml(project.active_html || "");
    setCurrentProjectId(project.id);
    setShowProjects(false);
    setShowCode(false);
    setError("");
    setIframeErrors([]);
  };

  const deleteProject = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await supabase.from("website_builder_projects").delete().eq("id", id);
    if (currentProjectId === id) {
      setMessages([]);
      setActiveHtml("");
      setCurrentProjectId(null);
    }
    loadProjects();
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

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

  // Auto-switch to preview on mobile when HTML is generated
  useEffect(() => {
    if (isMobile && activeHtml && !loading) {
      setMobileTab("preview");
    }
  }, [activeHtml, isMobile, loading]);

  const extractHtml = (text: string): string => {
    const match = text.match(/```html\n([\s\S]*?)```/);
    return match ? match[1] : "";
  };

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

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isMobile) return;
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
      const finalMessages = [...messages, userMsg, { role: "assistant" as const, content: fullResult, html: html || undefined }];
      if (html) {
        setActiveHtml(html);
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: fullResult, html };
          return updated;
        });
      }
      // Auto-save after response
      debouncedSave(finalMessages, html || activeHtml, currentProjectId);
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
    setMobileTab("chat");
    setCurrentProjectId(null);
  };

  const hasPreview = !!activeHtml;

  const viewportStyles: Record<ViewportSize, string> = {
    desktop: "w-full h-full",
    tablet: "w-[768px] h-full mx-auto",
    mobile: "w-[375px] h-full mx-auto",
  };

  const chatPanel = (
    <div className={cn("flex flex-col min-h-0", isMobile ? "flex-1" : hasPreview ? "border-r border-border/30" : "w-full")}
      style={!isMobile && hasPreview ? { width: `${chatWidth}px`, minWidth: 280, maxWidth: 600 } : undefined}
    >
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-16 space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-primary/5 flex items-center justify-center">
              <Sparkles className="w-7 h-7 text-primary/40" />
            </div>
            <div>
              <p className="text-[15px] sm:text-sm font-medium text-foreground/70">Describe a website</p>
              <p className="text-[13px] sm:text-xs text-muted-foreground mt-1">I'll build it live with a preview</p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center max-w-sm">
              {["Portfolio site", "Landing page", "Dashboard UI", "E-commerce store", "Blog layout", "Restaurant site"].map((s) => (
                <button
                  key={s}
                  onClick={() => { setInput(`Build a modern ${s.toLowerCase()}`); inputRef.current?.focus(); }}
                  className="px-3 py-2 sm:py-1.5 rounded-full text-[13px] sm:text-xs bg-muted/50 border border-border/30 text-foreground/60 hover:bg-muted hover:text-foreground transition-colors"
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
              "max-w-[90%] px-3.5 py-2.5 text-[15px] sm:text-sm leading-relaxed",
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
            <div className="flex items-center gap-2 px-3.5 py-2.5 text-[15px] sm:text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Building...
            </div>
          </div>
        )}

        {error && <p className="text-destructive text-[13px] sm:text-xs text-center">{error}</p>}
        <div ref={chatEndRef} />
      </div>

      <div className="p-3 border-t border-border/30">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={hasPreview ? "Describe changes..." : "Describe a website to build..."}
            rows={1}
            className="flex-1 bg-muted/30 border border-border/30 rounded-xl px-3.5 py-2.5 text-[15px] sm:text-sm text-foreground placeholder:text-muted-foreground/40 resize-none focus:outline-none focus:ring-1 focus:ring-primary/20 max-h-[100px] overflow-y-auto"
            style={{ minHeight: "44px" }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="w-10 h-10 sm:w-9 sm:h-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 disabled:opacity-30 transition-opacity shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  const previewPanel = hasPreview ? (
    <div className={cn("flex flex-col min-h-0 bg-muted/10", isMobile ? "flex-1" : "flex-1")}>
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
            <pre className="text-[13px] sm:text-xs font-mono text-foreground/80 whitespace-pre-wrap leading-relaxed">{activeHtml}</pre>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 rounded-lg overflow-hidden m-2 border border-border/30 bg-white flex items-start justify-center">
            <div className={cn("h-full transition-all duration-300", isMobile ? "w-full h-full" : viewportStyles[viewport])}>
              <iframe
                ref={iframeRef}
                srcDoc={wrapHtmlWithErrorCatcher(activeHtml)}
                className="w-full h-full"
                sandbox="allow-scripts"
                title="Live Preview"
              />
            </div>
          </div>

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
  ) : null;

  return (
    <div className="h-full flex flex-col animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 border-b border-border/30">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Code2 className="w-4 h-4 text-primary" />
          </div>
          <h2 className="text-[15px] sm:text-sm font-semibold text-foreground tracking-tight">Website Builder</h2>
          {loading && buildProgress > 0 && (
            <div className="flex items-center gap-2 ml-1">
              <div className="w-16 sm:w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${buildProgress}%` }} />
              </div>
              <span className="text-[10px] text-muted-foreground">{Math.round(buildProgress)}%</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => { setShowProjects((p) => !p); if (!showProjects) loadProjects(); }} className={cn("p-1.5 rounded-lg transition-colors", showProjects ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/50")} title="Projects">
            <FolderOpen className="w-3.5 h-3.5" />
          </button>
          {hasPreview && !isMobile && (
            <>
              <div className="flex items-center gap-0.5 bg-muted/30 rounded-lg p-0.5">
                <button onClick={() => setViewport("mobile")} className={cn("p-1.5 rounded-md transition-colors", viewport === "mobile" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")} title="Mobile">
                  <Smartphone className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setViewport("tablet")} className={cn("p-1.5 rounded-md transition-colors", viewport === "tablet" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")} title="Tablet">
                  <Tablet className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setViewport("desktop")} className={cn("p-1.5 rounded-md transition-colors", viewport === "desktop" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")} title="Desktop">
                  <Monitor className="w-3.5 h-3.5" />
                </button>
              </div>
              <button onClick={() => setShowCode(false)} className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors", !showCode ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/50")}>
                <Eye className="w-3.5 h-3.5" /> Preview
              </button>
              <button onClick={() => setShowCode(true)} className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors", showCode ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/50")}>
                <CodeXml className="w-3.5 h-3.5" /> Code
              </button>
              <button onClick={downloadHtml} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors" title="Download HTML">
                <Download className="w-3.5 h-3.5" />
              </button>
              {iframeErrors.length > 0 && (
                <button onClick={() => setShowErrors(!showErrors)} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors">
                  <AlertTriangle className="w-3 h-3" /> {iframeErrors.length}
                </button>
              )}
              <button onClick={() => setIsFullscreen(true)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors" title="Fullscreen preview">
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          {hasPreview && isMobile && (
            <>
              <button onClick={() => setShowCode((c) => !c)} className={cn("p-2 rounded-lg transition-colors", showCode ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/50")} title="Toggle code">
                <CodeXml className="w-4 h-4" />
              </button>
              <button onClick={downloadHtml} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors" title="Download">
                <Download className="w-4 h-4" />
              </button>
              <button onClick={() => setIsFullscreen(true)} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors" title="Fullscreen">
                <Maximize2 className="w-4 h-4" />
              </button>
            </>
          )}
          {messages.length > 0 && (
            <button onClick={handleReset} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors ml-0.5" title="New project">
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Mobile tab switcher */}
      {/* Projects panel */}
      {showProjects && (
        <div className="border-b border-border/30 bg-muted/20 max-h-[240px] overflow-y-auto animate-fade-in">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border/20">
            <span className="text-xs font-medium text-muted-foreground">Saved Projects ({savedProjects.length})</span>
            <button onClick={handleReset} className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors">
              <Plus className="w-3 h-3" /> New
            </button>
          </div>
          {loadingProjects ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          ) : savedProjects.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">No saved projects yet</p>
          ) : (
            <div className="p-1.5 space-y-0.5">
              {savedProjects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => loadProject(p)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-xs transition-colors group",
                    currentProjectId === p.id ? "bg-primary/10 text-foreground" : "hover:bg-muted/50 text-foreground/70"
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium">{p.title}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {new Date(p.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={(e) => deleteProject(p.id, e)}
                    className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {isMobile && hasPreview && (
        <div className="flex border-b border-border/30">
          <button
            onClick={() => setMobileTab("chat")}
            className={cn("flex-1 flex items-center justify-center gap-2 py-2.5 text-[13px] font-medium transition-colors",
              mobileTab === "chat" ? "text-foreground border-b-2 border-primary" : "text-muted-foreground"
            )}
          >
            <MessageSquare className="w-4 h-4" /> Chat
          </button>
          <button
            onClick={() => setMobileTab("preview")}
            className={cn("flex-1 flex items-center justify-center gap-2 py-2.5 text-[13px] font-medium transition-colors",
              mobileTab === "preview" ? "text-foreground border-b-2 border-primary" : "text-muted-foreground"
            )}
          >
            <Eye className="w-4 h-4" /> Preview
          </button>
        </div>
      )}

      {/* Main area */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {isMobile ? (
          // Mobile: show one panel at a time
          hasPreview ? (
            mobileTab === "chat" ? chatPanel : previewPanel
          ) : chatPanel
        ) : (
          // Desktop: side by side
          <>
            {chatPanel}
            {hasPreview && (
              <div
                onMouseDown={handleMouseDown}
                className={cn("w-2 cursor-col-resize flex items-center justify-center hover:bg-primary/10 transition-colors shrink-0", isDragging && "bg-primary/10")}
              >
                <GripVertical className="w-3 h-3 text-muted-foreground/30" />
              </div>
            )}
            {previewPanel}
          </>
        )}
      </div>

      {/* Fullscreen overlay */}
      {isFullscreen && activeHtml && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col animate-fade-in">
          <div className="flex items-center justify-between px-4 py-2 border-b border-border/30">
            <span className="text-sm font-medium text-foreground">Fullscreen Preview</span>
            <div className="flex items-center gap-2">
              {!isMobile && (
                <div className="flex items-center gap-0.5 bg-muted/30 rounded-lg p-0.5">
                  <button onClick={() => setViewport("mobile")} className={cn("p-1.5 rounded-md transition-colors", viewport === "mobile" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}><Smartphone className="w-3.5 h-3.5" /></button>
                  <button onClick={() => setViewport("tablet")} className={cn("p-1.5 rounded-md transition-colors", viewport === "tablet" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}><Tablet className="w-3.5 h-3.5" /></button>
                  <button onClick={() => setViewport("desktop")} className={cn("p-1.5 rounded-md transition-colors", viewport === "desktop" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}><Monitor className="w-3.5 h-3.5" /></button>
                </div>
              )}
              <button onClick={downloadHtml} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"><Download className="w-4 h-4" /></button>
              <button onClick={() => setIsFullscreen(false)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors" title="Exit fullscreen"><Minimize2 className="w-4 h-4" /></button>
            </div>
          </div>
          <div className="flex-1 bg-white flex items-start justify-center overflow-hidden">
            <div className={cn("h-full transition-all duration-300", isMobile ? "w-full" : viewportStyles[viewport])}>
              <iframe srcDoc={wrapHtmlWithErrorCatcher(activeHtml)} className="w-full h-full" sandbox="allow-scripts" title="Fullscreen Preview" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
