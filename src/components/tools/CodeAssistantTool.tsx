import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  Code2, Loader2, Send, Eye, CodeXml, Copy, Check, RotateCcw, Sparkles,
  AlertTriangle, Download, Smartphone, Monitor, Tablet, GripVertical,
  MessageSquare, Maximize2, Minimize2, FolderOpen, Plus, Trash2,
  Undo2, Redo2, MousePointer2, Type, Palette, Move, Layers, X,
  PaintBucket, ArrowUp
} from "lucide-react";
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

type SelectedElement = {
  tagName: string;
  text: string;
  xpath: string;
  styles: Record<string, string>;
  rect: { x: number; y: number; width: number; height: number };
};

type EditMode = "chat" | "visual";

const VISUAL_EDIT_SCRIPT = `
<script>
  // Error catcher
  window.onerror = function(msg, url, line, col, err) {
    parent.postMessage({ type: 'iframe-error', message: 'Line ' + line + ': ' + msg }, '*');
    return true;
  };
  window.addEventListener('unhandledrejection', function(e) {
    parent.postMessage({ type: 'iframe-error', message: 'Promise: ' + (e.reason?.message || e.reason) }, '*');
  });

  // Visual edit mode
  let visualMode = false;
  let selectedEl = null;
  let hoverEl = null;
  let overlay = null;
  let hoverOverlay = null;

  function createOverlay(color, id) {
    const el = document.createElement('div');
    el.id = id;
    el.style.cssText = 'position:fixed;pointer-events:none;z-index:99999;border:2px solid ' + color + ';border-radius:4px;transition:all 0.15s ease;';
    document.body.appendChild(el);
    return el;
  }

  function positionOverlay(el, target) {
    if (!target) { el.style.display = 'none'; return; }
    const r = target.getBoundingClientRect();
    el.style.display = 'block';
    el.style.left = r.left + 'px';
    el.style.top = r.top + 'px';
    el.style.width = r.width + 'px';
    el.style.height = r.height + 'px';
  }

  function getXPath(el) {
    if (!el || el === document.body) return '/body';
    const parent = el.parentElement;
    if (!parent) return '/' + el.tagName.toLowerCase();
    const siblings = Array.from(parent.children).filter(c => c.tagName === el.tagName);
    const idx = siblings.indexOf(el) + 1;
    return getXPath(parent) + '/' + el.tagName.toLowerCase() + (siblings.length > 1 ? '[' + idx + ']' : '');
  }

  function getComputedStyles(el) {
    const cs = window.getComputedStyle(el);
    return {
      color: cs.color,
      backgroundColor: cs.backgroundColor,
      fontSize: cs.fontSize,
      fontWeight: cs.fontWeight,
      padding: cs.padding,
      margin: cs.margin,
      borderRadius: cs.borderRadius,
      textAlign: cs.textAlign,
    };
  }

  window.addEventListener('message', function(e) {
    if (e.data?.type === 'toggle-visual-mode') {
      visualMode = e.data.enabled;
      if (!overlay) overlay = createOverlay('#3b82f6', '__visual_select');
      if (!hoverOverlay) hoverOverlay = createOverlay('rgba(59,130,246,0.3)', '__visual_hover');
      if (!visualMode) {
        overlay.style.display = 'none';
        hoverOverlay.style.display = 'none';
        document.body.style.cursor = '';
        selectedEl = null;
        hoverEl = null;
      } else {
        document.body.style.cursor = 'crosshair';
      }
    }

    if (e.data?.type === 'apply-edit') {
      const { xpath, property, value } = e.data;
      const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      const target = result.singleNodeValue;
      if (target && target.style) {
        target.style[property] = value;
        // Send back updated HTML
        parent.postMessage({
          type: 'html-updated',
          html: document.documentElement.outerHTML
        }, '*');
      }
    }

    if (e.data?.type === 'apply-text-edit') {
      const { xpath, text } = e.data;
      const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      const target = result.singleNodeValue;
      if (target) {
        target.textContent = text;
        parent.postMessage({
          type: 'html-updated',
          html: document.documentElement.outerHTML
        }, '*');
      }
    }
  });

  document.addEventListener('mousemove', function(e) {
    if (!visualMode) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || el === hoverEl || el.id === '__visual_select' || el.id === '__visual_hover') return;
    hoverEl = el;
    positionOverlay(hoverOverlay, el);
  });

  document.addEventListener('click', function(e) {
    if (!visualMode) return;
    e.preventDefault();
    e.stopPropagation();
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || el.id === '__visual_select' || el.id === '__visual_hover') return;
    selectedEl = el;
    positionOverlay(overlay, el);
    const r = el.getBoundingClientRect();
    parent.postMessage({
      type: 'element-selected',
      data: {
        tagName: el.tagName.toLowerCase(),
        text: el.textContent?.slice(0, 200) || '',
        xpath: getXPath(el),
        styles: getComputedStyles(el),
        rect: { x: r.left, y: r.top, width: r.width, height: r.height },
      }
    }, '*');
  }, true);
</script>`;

const BUILDER_PROMPT = `You are an expert website builder AI. Your job:
1. When asked to build/create a website, generate a COMPLETE single-file HTML page with embedded CSS and JS inside a \`\`\`html code block.
2. Use modern design: CSS Grid/Flexbox, gradients, shadows, smooth transitions, responsive breakpoints, clean typography (Google Fonts), and animations.
3. When asked to modify, return the FULL updated HTML in a \`\`\`html code block. Never return partial snippets.
4. Before the code, briefly say what you're building (1 sentence max).
5. After the code, list changes as 2-3 bullet points.
6. Make it production-quality — real content, proper semantic HTML, accessibility.
7. IMPORTANT: Generate fast. Be concise in explanations. Focus on the code.`;

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
  const [chatWidth, setChatWidth] = useState(380);
  const [isDragging, setIsDragging] = useState(false);
  const [mobileTab, setMobileTab] = useState<"chat" | "preview">("chat");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>([]);
  const [showProjects, setShowProjects] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);

  // Visual edit state
  const [editMode, setEditMode] = useState<EditMode>("chat");
  const [selectedElement, setSelectedElement] = useState<SelectedElement | null>(null);
  const [editingText, setEditingText] = useState("");
  const [htmlHistory, setHtmlHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const isMobile = useIsMobile();
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Push to undo history
  const pushHistory = useCallback((html: string) => {
    setHtmlHistory(prev => {
      const newHist = [...prev.slice(0, historyIndex + 1), html];
      return newHist.slice(-30); // Keep last 30 states
    });
    setHistoryIndex(prev => Math.min(prev + 1, 29));
  }, [historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex <= 0) return;
    const newIndex = historyIndex - 1;
    setHistoryIndex(newIndex);
    setActiveHtml(htmlHistory[newIndex]);
  }, [historyIndex, htmlHistory]);

  const redo = useCallback(() => {
    if (historyIndex >= htmlHistory.length - 1) return;
    const newIndex = historyIndex + 1;
    setHistoryIndex(newIndex);
    setActiveHtml(htmlHistory[newIndex]);
  }, [historyIndex, htmlHistory]);

  // Listen for messages from iframe
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "iframe-error") {
        setIframeErrors(prev => [...prev.slice(-19), e.data.message]);
      }
      if (e.data?.type === "element-selected") {
        setSelectedElement(e.data.data);
        setEditingText(e.data.data.text);
      }
      if (e.data?.type === "html-updated") {
        const newHtml = e.data.html;
        setActiveHtml(newHtml);
        pushHistory(newHtml);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [pushHistory]);

  // Toggle visual mode in iframe
  useEffect(() => {
    iframeRef.current?.contentWindow?.postMessage({
      type: "toggle-visual-mode",
      enabled: editMode === "visual"
    }, "*");
  }, [editMode, activeHtml]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (isMobile && activeHtml && !loading) setMobileTab("preview");
  }, [activeHtml, isMobile, loading]);

  useEffect(() => { loadProjects(); }, []);

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

  const saveProject = useCallback(async (msgs: ChatMsg[], html: string, projectId: string | null) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || msgs.length === 0) return;
    const title = msgs[0]?.content?.slice(0, 50) || "Untitled Project";
    if (projectId) {
      await supabase.from("website_builder_projects").update({ messages: msgs as any, active_html: html, title }).eq("id", projectId);
    } else {
      const { data } = await supabase.from("website_builder_projects").insert({ user_id: session.user.id, messages: msgs as any, active_html: html, title }).select("id").single();
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
    setHtmlHistory([project.active_html || ""]);
    setHistoryIndex(0);
  };

  const deleteProject = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await supabase.from("website_builder_projects").delete().eq("id", id);
    if (currentProjectId === id) {
      setMessages([]); setActiveHtml(""); setCurrentProjectId(null);
    }
    loadProjects();
  };

  const extractHtml = (text: string): string => {
    const match = text.match(/```html\n([\s\S]*?)```/);
    return match ? match[1] : "";
  };

  const wrapHtml = (html: string): string => {
    if (html.includes("<head>")) {
      return html.replace("<head>", `<head>${VISUAL_EDIT_SCRIPT}`);
    }
    return VISUAL_EDIT_SCRIPT + html;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isMobile) return;
    e.preventDefault();
    setIsDragging(true);
    dragRef.current = { startX: e.clientX, startWidth: chatWidth };
    const handleMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const diff = ev.clientX - dragRef.current.startX;
      setChatWidth(Math.max(280, Math.min(600, dragRef.current.startWidth + diff)));
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
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const history = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));

      const progressInterval = setInterval(() => {
        setBuildProgress(p => Math.min(p + Math.random() * 18, 92));
      }, 400);

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
          skillPrompt: BUILDER_PROMPT,
        }),
      });

      if (!resp.ok) throw new Error("Generation failed");
      const reader = resp.body?.getReader();
      if (!reader) throw new Error("No response");

      const decoder = new TextDecoder();
      let buffer = "";
      let fullResult = "";

      setMessages(prev => [...prev, { role: "assistant", content: "" }]);

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
              setMessages(prev => {
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
      setTimeout(() => setBuildProgress(0), 800);

      const html = extractHtml(fullResult);
      const finalMessages = [...messages, userMsg, { role: "assistant" as const, content: fullResult, html: html || undefined }];
      if (html) {
        setActiveHtml(html);
        pushHistory(html);
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: fullResult, html };
          return updated;
        });
      }
      debouncedSave(finalMessages, html || activeHtml, currentProjectId);
    } catch (err: any) {
      setError(err.message || "Generation failed");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
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
    a.href = url; a.download = "website.html"; a.click();
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    setMessages([]); setActiveHtml(""); setShowCode(false);
    setError(""); setIframeErrors([]); setMobileTab("chat");
    setCurrentProjectId(null); setSelectedElement(null);
    setEditMode("chat"); setHtmlHistory([]); setHistoryIndex(-1);
  };

  // Visual edit actions
  const applyStyleEdit = (property: string, value: string) => {
    if (!selectedElement) return;
    iframeRef.current?.contentWindow?.postMessage({
      type: "apply-edit",
      xpath: selectedElement.xpath,
      property,
      value,
    }, "*");
  };

  const applyTextEdit = () => {
    if (!selectedElement) return;
    iframeRef.current?.contentWindow?.postMessage({
      type: "apply-text-edit",
      xpath: selectedElement.xpath,
      text: editingText,
    }, "*");
    setSelectedElement(prev => prev ? { ...prev, text: editingText } : null);
  };

  const hasPreview = !!activeHtml;

  const viewportStyles: Record<ViewportSize, string> = {
    desktop: "w-full h-full",
    tablet: "w-[768px] h-full mx-auto",
    mobile: "w-[375px] h-full mx-auto",
  };

  // ──────────── CHAT PANEL ────────────
  const chatPanel = (
    <div
      className={cn("flex flex-col min-h-0", isMobile ? "flex-1" : hasPreview ? "border-r border-border/30" : "w-full")}
      style={!isMobile && hasPreview ? { width: `${chatWidth}px`, minWidth: 280, maxWidth: 600 } : undefined}
    >
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-16 space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center border border-primary/10">
              <Sparkles className="w-8 h-8 text-primary/50" />
            </div>
            <div>
              <p className="text-base font-semibold text-foreground/80">Build a website</p>
              <p className="text-sm text-muted-foreground mt-1">Describe what you want. I'll generate it live.</p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center max-w-sm">
              {["Portfolio site", "Landing page", "Dashboard UI", "E-commerce store", "Blog layout", "Restaurant menu"].map(s => (
                <button
                  key={s}
                  onClick={() => { setInput(`Build a modern ${s.toLowerCase()}`); inputRef.current?.focus(); }}
                  className="px-3.5 py-2 rounded-xl text-[13px] bg-muted/50 border border-border/30 text-foreground/60 hover:bg-muted hover:text-foreground transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
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
              "max-w-[90%] text-[14px] leading-relaxed",
              msg.role === "user"
                ? "px-4 py-2.5 bg-muted rounded-2xl rounded-br-md"
                : ""
            )}>
              {msg.role === "assistant" ? (
                <div className="prose prose-sm max-w-none text-foreground [&_pre]:hidden [&_code]:hidden prose-p:my-1 prose-ul:my-1 prose-li:my-0">
                  <ReactMarkdown>
                    {msg.content.replace(/```html\n[\s\S]*?```/g, hasPreview ? "✅ *Website updated — see preview →*" : "")}
                  </ReactMarkdown>
                </div>
              ) : (
                <span className="text-foreground">{msg.content}</span>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Building{buildProgress > 0 ? ` (${Math.round(buildProgress)}%)` : "..."}</span>
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
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={hasPreview ? "Describe changes..." : "Describe a website to build..."}
            rows={1}
            className="flex-1 bg-muted/30 border border-border/30 rounded-2xl px-4 py-3 text-[14px] text-foreground placeholder:text-muted-foreground/40 resize-none focus:outline-none focus:border-primary/20 max-h-[120px] overflow-y-auto transition-colors"
            style={{ minHeight: "48px" }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="w-10 h-10 rounded-xl bg-foreground text-background flex items-center justify-center hover:opacity-80 disabled:opacity-20 transition-opacity shrink-0"
          >
            <ArrowUp className="w-4 h-4" strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );

  // ──────────── VISUAL INSPECTOR PANEL ────────────
  const inspectorPanel = selectedElement && editMode === "visual" ? (
    <div className="w-[260px] shrink-0 border-l border-border/30 bg-card flex flex-col overflow-y-auto animate-fade-in">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/30">
        <div className="flex items-center gap-2">
          <Layers className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-semibold text-foreground">Inspector</span>
        </div>
        <button onClick={() => { setSelectedElement(null); }} className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Element info */}
      <div className="px-3 py-2 border-b border-border/20">
        <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">Element</span>
        <p className="text-xs font-mono text-foreground mt-0.5">&lt;{selectedElement.tagName}&gt;</p>
        <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{selectedElement.text.slice(0, 80)}</p>
      </div>

      {/* Text edit */}
      <div className="px-3 py-2.5 border-b border-border/20 space-y-1.5">
        <div className="flex items-center gap-1.5">
          <Type className="w-3 h-3 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">Text</span>
        </div>
        <textarea
          value={editingText}
          onChange={e => setEditingText(e.target.value)}
          className="w-full text-xs bg-muted/30 border border-border/30 rounded-lg px-2.5 py-2 resize-none focus:outline-none focus:border-primary/20 min-h-[50px] max-h-[100px] text-foreground"
        />
        <button onClick={applyTextEdit} className="w-full text-[11px] py-1.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity font-medium">
          Apply Text
        </button>
      </div>

      {/* Quick style edits */}
      <div className="px-3 py-2.5 space-y-2.5">
        <div className="flex items-center gap-1.5">
          <Palette className="w-3 h-3 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">Styles</span>
        </div>

        {/* Color */}
        <div className="space-y-1">
          <span className="text-[10px] text-muted-foreground">Text Color</span>
          <div className="flex gap-1 flex-wrap">
            {["#000000", "#ffffff", "#ef4444", "#3b82f6", "#22c55e", "#f59e0b", "#8b5cf6", "#ec4899"].map(c => (
              <button
                key={c}
                onClick={() => applyStyleEdit("color", c)}
                className="w-6 h-6 rounded-md border border-border/30 hover:scale-110 transition-transform"
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        {/* Background */}
        <div className="space-y-1">
          <span className="text-[10px] text-muted-foreground">Background</span>
          <div className="flex gap-1 flex-wrap">
            {["transparent", "#ffffff", "#f3f4f6", "#1f2937", "#3b82f6", "#22c55e", "#f59e0b", "#8b5cf6"].map(c => (
              <button
                key={c}
                onClick={() => applyStyleEdit("backgroundColor", c)}
                className={cn("w-6 h-6 rounded-md border border-border/30 hover:scale-110 transition-transform", c === "transparent" && "bg-[conic-gradient(#ccc_25%,#fff_25%,#fff_50%,#ccc_50%,#ccc_75%,#fff_75%)] bg-[length:8px_8px]")}
                style={c !== "transparent" ? { backgroundColor: c } : undefined}
              />
            ))}
          </div>
        </div>

        {/* Font size */}
        <div className="space-y-1">
          <span className="text-[10px] text-muted-foreground">Font Size</span>
          <div className="flex gap-1 flex-wrap">
            {["12px", "14px", "16px", "18px", "20px", "24px", "32px", "48px"].map(s => (
              <button
                key={s}
                onClick={() => applyStyleEdit("fontSize", s)}
                className="px-2 py-1 text-[10px] rounded-md border border-border/30 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Font weight */}
        <div className="space-y-1">
          <span className="text-[10px] text-muted-foreground">Font Weight</span>
          <div className="flex gap-1 flex-wrap">
            {[
              { label: "Light", val: "300" },
              { label: "Normal", val: "400" },
              { label: "Medium", val: "500" },
              { label: "Bold", val: "700" },
              { label: "Black", val: "900" },
            ].map(w => (
              <button
                key={w.val}
                onClick={() => applyStyleEdit("fontWeight", w.val)}
                className="px-2 py-1 text-[10px] rounded-md border border-border/30 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                {w.label}
              </button>
            ))}
          </div>
        </div>

        {/* Padding */}
        <div className="space-y-1">
          <span className="text-[10px] text-muted-foreground">Padding</span>
          <div className="flex gap-1 flex-wrap">
            {["0px", "4px", "8px", "12px", "16px", "24px", "32px", "48px"].map(p => (
              <button
                key={p}
                onClick={() => applyStyleEdit("padding", p)}
                className="px-2 py-1 text-[10px] rounded-md border border-border/30 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Border radius */}
        <div className="space-y-1">
          <span className="text-[10px] text-muted-foreground">Border Radius</span>
          <div className="flex gap-1 flex-wrap">
            {["0", "4px", "8px", "12px", "16px", "9999px"].map(r => (
              <button
                key={r}
                onClick={() => applyStyleEdit("borderRadius", r)}
                className="px-2 py-1 text-[10px] rounded-md border border-border/30 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  ) : null;

  // ──────────── PREVIEW PANEL ────────────
  const previewPanel = hasPreview ? (
    <div className={cn("flex flex-col min-h-0", isMobile ? "flex-1" : "flex-1")}>
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
        <div className="flex-1 flex min-h-0">
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 rounded-lg overflow-hidden m-2 border border-border/30 bg-white flex items-start justify-center">
              <div className={cn("h-full transition-all duration-300", isMobile ? "w-full h-full" : viewportStyles[viewport])}>
                <iframe
                  ref={iframeRef}
                  srcDoc={wrapHtml(activeHtml)}
                  className="w-full h-full"
                  sandbox="allow-scripts allow-same-origin"
                  title="Live Preview"
                />
              </div>
            </div>

            {/* Error console */}
            {showErrors && iframeErrors.length > 0 && (
              <div className="border-t border-border/30 bg-destructive/5 max-h-[100px] overflow-y-auto">
                <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/20">
                  <span className="text-[10px] font-medium text-destructive flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Console ({iframeErrors.length})
                  </span>
                  <button onClick={() => { setIframeErrors([]); setShowErrors(false); }} className="text-[10px] text-muted-foreground hover:text-foreground">Clear</button>
                </div>
                <div className="p-2 space-y-0.5">
                  {iframeErrors.map((err, i) => (
                    <p key={i} className="text-[10px] font-mono text-destructive/80">{err}</p>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Inspector sidebar */}
          {inspectorPanel}
        </div>
      )}
    </div>
  ) : null;

  return (
    <div className="h-full flex flex-col animate-fade-in">
      {/* ─── HEADER ─── */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2 border-b border-border/30 bg-card/50">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center border border-primary/10">
            <Code2 className="w-3.5 h-3.5 text-primary" />
          </div>
          <div>
            <h2 className="text-[13px] font-semibold text-foreground">Website Builder</h2>
            {loading && buildProgress > 0 && (
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="w-20 h-1 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all duration-300 ease-out" style={{ width: `${buildProgress}%` }} />
                </div>
                <span className="text-[9px] text-muted-foreground font-mono">{Math.round(buildProgress)}%</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-0.5">
          {/* Undo/Redo */}
          {hasPreview && (
            <>
              <button onClick={undo} disabled={historyIndex <= 0} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-20" title="Undo">
                <Undo2 className="w-3.5 h-3.5" />
              </button>
              <button onClick={redo} disabled={historyIndex >= htmlHistory.length - 1} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-20" title="Redo">
                <Redo2 className="w-3.5 h-3.5" />
              </button>
              <div className="w-px h-4 bg-border/40 mx-0.5" />
            </>
          )}

          {/* Projects */}
          <button onClick={() => { setShowProjects(p => !p); if (!showProjects) loadProjects(); }} className={cn("p-1.5 rounded-lg transition-colors", showProjects ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/50")} title="Projects">
            <FolderOpen className="w-3.5 h-3.5" />
          </button>

          {hasPreview && !isMobile && (
            <>
              {/* Visual edit toggle */}
              <button
                onClick={() => {
                  const next = editMode === "visual" ? "chat" : "visual";
                  setEditMode(next);
                  if (next !== "visual") setSelectedElement(null);
                }}
                className={cn(
                  "p-1.5 rounded-lg transition-colors",
                  editMode === "visual" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
                title={editMode === "visual" ? "Exit visual edit" : "Visual edit mode"}
              >
                <MousePointer2 className="w-3.5 h-3.5" />
              </button>

              <div className="w-px h-4 bg-border/40 mx-0.5" />

              {/* Viewport */}
              <div className="flex items-center gap-0 bg-muted/30 rounded-lg p-0.5">
                {([
                  { id: "mobile" as ViewportSize, icon: Smartphone },
                  { id: "tablet" as ViewportSize, icon: Tablet },
                  { id: "desktop" as ViewportSize, icon: Monitor },
                ] as const).map(v => (
                  <button key={v.id} onClick={() => setViewport(v.id)} className={cn("p-1.5 rounded-md transition-colors", viewport === v.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")} title={v.id}>
                    <v.icon className="w-3.5 h-3.5" />
                  </button>
                ))}
              </div>

              {/* Preview/Code toggle */}
              <button onClick={() => setShowCode(false)} className={cn("flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors", !showCode ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/50")}>
                <Eye className="w-3 h-3" /> Preview
              </button>
              <button onClick={() => setShowCode(true)} className={cn("flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors", showCode ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/50")}>
                <CodeXml className="w-3 h-3" /> Code
              </button>

              <button onClick={downloadHtml} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors" title="Download"><Download className="w-3.5 h-3.5" /></button>

              {iframeErrors.length > 0 && (
                <button onClick={() => setShowErrors(!showErrors)} className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors">
                  <AlertTriangle className="w-3 h-3" /> {iframeErrors.length}
                </button>
              )}

              <button onClick={() => setIsFullscreen(true)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors" title="Fullscreen">
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          {hasPreview && isMobile && (
            <>
              <button onClick={() => setShowCode(c => !c)} className={cn("p-2 rounded-lg transition-colors", showCode ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/50")}>
                <CodeXml className="w-4 h-4" />
              </button>
              <button onClick={downloadHtml} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
                <Download className="w-4 h-4" />
              </button>
              <button onClick={() => setIsFullscreen(true)} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
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

      {/* Projects dropdown */}
      {showProjects && (
        <div className="border-b border-border/30 bg-muted/20 max-h-[200px] overflow-y-auto animate-fade-in">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border/20">
            <span className="text-xs font-medium text-muted-foreground">Projects ({savedProjects.length})</span>
            <button onClick={handleReset} className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors">
              <Plus className="w-3 h-3" /> New
            </button>
          </div>
          {loadingProjects ? (
            <div className="flex items-center justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
          ) : savedProjects.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">No saved projects</p>
          ) : (
            <div className="p-1.5 space-y-0.5">
              {savedProjects.map(p => (
                <button key={p.id} onClick={() => loadProject(p)} className={cn("w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-xs transition-colors group", currentProjectId === p.id ? "bg-primary/10 text-foreground" : "hover:bg-muted/50 text-foreground/70")}>
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium">{p.title}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{new Date(p.updated_at).toLocaleDateString()}</p>
                  </div>
                  <button onClick={e => deleteProject(p.id, e)} className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Mobile tab switcher */}
      {isMobile && hasPreview && (
        <div className="flex border-b border-border/30">
          <button onClick={() => setMobileTab("chat")} className={cn("flex-1 flex items-center justify-center gap-2 py-2.5 text-[13px] font-medium transition-colors", mobileTab === "chat" ? "text-foreground border-b-2 border-primary" : "text-muted-foreground")}>
            <MessageSquare className="w-4 h-4" /> Chat
          </button>
          <button onClick={() => setMobileTab("preview")} className={cn("flex-1 flex items-center justify-center gap-2 py-2.5 text-[13px] font-medium transition-colors", mobileTab === "preview" ? "text-foreground border-b-2 border-primary" : "text-muted-foreground")}>
            <Eye className="w-4 h-4" /> Preview
          </button>
        </div>
      )}

      {/* Main area */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {isMobile ? (
          hasPreview ? (mobileTab === "chat" ? chatPanel : previewPanel) : chatPanel
        ) : (
          <>
            {chatPanel}
            {hasPreview && (
              <div onMouseDown={handleMouseDown} className={cn("w-1.5 cursor-col-resize flex items-center justify-center hover:bg-primary/10 transition-colors shrink-0", isDragging && "bg-primary/10")}>
                <GripVertical className="w-3 h-3 text-muted-foreground/20" />
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
                  {([
                    { id: "mobile" as ViewportSize, icon: Smartphone },
                    { id: "tablet" as ViewportSize, icon: Tablet },
                    { id: "desktop" as ViewportSize, icon: Monitor },
                  ] as const).map(v => (
                    <button key={v.id} onClick={() => setViewport(v.id)} className={cn("p-1.5 rounded-md transition-colors", viewport === v.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                      <v.icon className="w-3.5 h-3.5" />
                    </button>
                  ))}
                </div>
              )}
              <button onClick={downloadHtml} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"><Download className="w-4 h-4" /></button>
              <button onClick={() => setIsFullscreen(false)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"><Minimize2 className="w-4 h-4" /></button>
            </div>
          </div>
          <div className="flex-1 bg-white flex items-start justify-center overflow-hidden">
            <div className={cn("h-full transition-all duration-300", isMobile ? "w-full" : viewportStyles[viewport])}>
              <iframe srcDoc={wrapHtml(activeHtml)} className="w-full h-full" sandbox="allow-scripts allow-same-origin" title="Fullscreen Preview" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
