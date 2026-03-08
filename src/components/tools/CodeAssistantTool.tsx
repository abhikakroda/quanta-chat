import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  Code2, Loader2, Send, Eye, CodeXml, Copy, Check, RotateCcw, Sparkles,
  AlertTriangle, Download, Smartphone, Monitor, Tablet, GripVertical,
  MessageSquare, Maximize2, Minimize2, FolderOpen, Plus, Trash2,
  Undo2, Redo2, MousePointer2, Type, Palette, Move, Layers, X,
  PaintBucket, ArrowUp, FileCode, Globe, Layout, PanelLeft,
  ChevronRight, Zap, ExternalLink, Settings2, Pencil, FilePlus2
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

type WebPage = {
  id: string;
  name: string;
  html: string;
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
  window.onerror = function(msg, url, line, col, err) {
    parent.postMessage({ type: 'iframe-error', message: 'Line ' + line + ': ' + msg }, '*');
    return true;
  };
  window.addEventListener('unhandledrejection', function(e) {
    parent.postMessage({ type: 'iframe-error', message: 'Promise: ' + (e.reason?.message || e.reason) }, '*');
  });

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
      color: cs.color, backgroundColor: cs.backgroundColor,
      fontSize: cs.fontSize, fontWeight: cs.fontWeight,
      padding: cs.padding, margin: cs.margin,
      borderRadius: cs.borderRadius, textAlign: cs.textAlign,
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
        selectedEl = null; hoverEl = null;
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
        parent.postMessage({ type: 'html-updated', html: document.documentElement.outerHTML }, '*');
      }
    }
    if (e.data?.type === 'apply-text-edit') {
      const { xpath, text } = e.data;
      const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      const target = result.singleNodeValue;
      if (target) {
        target.textContent = text;
        parent.postMessage({ type: 'html-updated', html: document.documentElement.outerHTML }, '*');
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
    e.preventDefault(); e.stopPropagation();
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || el.id === '__visual_select' || el.id === '__visual_hover') return;
    selectedEl = el;
    positionOverlay(overlay, el);
    const r = el.getBoundingClientRect();
    parent.postMessage({
      type: 'element-selected',
      data: {
        tagName: el.tagName.toLowerCase(), text: el.textContent?.slice(0, 200) || '',
        xpath: getXPath(el), styles: getComputedStyles(el),
        rect: { x: r.left, y: r.top, width: r.width, height: r.height },
      }
    }, '*');
  }, true);
</script>`;

const BUILDER_PROMPT = `You are an expert website builder AI that creates MULTI-PAGE websites. Your rules:
1. When asked to build a website, generate COMPLETE HTML pages. For multi-page sites, output EACH page in a separate code block labeled with the page name.
2. Format: \`\`\`html:pagename.html followed by the full HTML, then \`\`\`
   Example: \`\`\`html:index.html ... \`\`\` then \`\`\`html:about.html ... \`\`\`
3. If only one page is needed, use \`\`\`html:index.html ... \`\`\`
4. Use modern design: CSS Grid/Flexbox, gradients, shadows, smooth transitions, responsive breakpoints, clean typography (Google Fonts), beautiful animations.
5. For navigation between pages, use <a href="#pagename"> links — they'll be handled by the preview system.
6. When modifying, return ALL affected pages with their FULL HTML.
7. Before code, briefly say what you're building (1 sentence). After code, list changes as 2-3 bullet points.
8. Make it production-quality: real content, semantic HTML, accessibility, proper meta tags.
9. Be FAST. Focus on code over explanations.
10. Always include a consistent navigation bar across all pages with links to all pages.`;

const TEMPLATES = [
  { icon: "🚀", title: "Landing Page", desc: "Modern SaaS landing with hero, features & CTA", prompt: "Build a modern SaaS landing page with a bold hero section, feature grid, pricing cards, testimonials, and a CTA footer. Use a vibrant gradient color scheme." },
  { icon: "💼", title: "Portfolio", desc: "Creative portfolio with projects & about", prompt: "Build a multi-page creative portfolio website with pages: index.html (hero + featured work), about.html (bio + skills), projects.html (project grid with cards), contact.html (contact form). Use elegant dark theme." },
  { icon: "🛒", title: "E-Commerce", desc: "Product showcase with cart layout", prompt: "Build a multi-page e-commerce website with pages: index.html (hero + featured products), products.html (product grid with filters), about.html (brand story), contact.html. Use clean white design with accent colors." },
  { icon: "📝", title: "Blog", desc: "Clean blog layout with articles", prompt: "Build a multi-page blog website with pages: index.html (hero + recent posts grid), about.html (author bio), blog.html (articles list with categories). Use minimal typography-focused design." },
  { icon: "🍕", title: "Restaurant", desc: "Restaurant with menu & reservations", prompt: "Build a multi-page restaurant website with pages: index.html (hero with food imagery, hours), menu.html (food menu with categories and prices), about.html (our story), contact.html (reservation form + map placeholder). Use warm elegant colors." },
  { icon: "🏢", title: "Business", desc: "Corporate site with services & team", prompt: "Build a multi-page business website with pages: index.html (hero + services overview), services.html (detailed service cards), team.html (team member grid), contact.html. Use professional blue theme." },
];

export default function CodeAssistantTool() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [iframeErrors, setIframeErrors] = useState<string[]>([]);
  const [showErrors, setShowErrors] = useState(false);
  const [viewport, setViewport] = useState<ViewportSize>("desktop");
  const [buildProgress, setBuildProgress] = useState(0);
  const [chatWidth, setChatWidth] = useState(400);
  const [isDragging, setIsDragging] = useState(false);
  const [mobileTab, setMobileTab] = useState<"chat" | "preview">("chat");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>([]);
  const [showProjects, setShowProjects] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);

  // Multi-page state
  const [pages, setPages] = useState<WebPage[]>([]);
  const [activePageId, setActivePageId] = useState<string>("index");
  const [renamingPage, setRenamingPage] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

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

  const activeHtml = useMemo(() => {
    const page = pages.find(p => p.id === activePageId);
    return page?.html || "";
  }, [pages, activePageId]);

  const hasPreview = pages.length > 0 && pages.some(p => p.html);

  const setActiveHtml = useCallback((html: string) => {
    setPages(prev => prev.map(p => p.id === activePageId ? { ...p, html } : p));
  }, [activePageId]);

  // Push to undo history
  const pushHistory = useCallback((html: string) => {
    setHtmlHistory(prev => {
      const newHist = [...prev.slice(0, historyIndex + 1), html];
      return newHist.slice(-30);
    });
    setHistoryIndex(prev => Math.min(prev + 1, 29));
  }, [historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex <= 0) return;
    const newIndex = historyIndex - 1;
    setHistoryIndex(newIndex);
    setActiveHtml(htmlHistory[newIndex]);
  }, [historyIndex, htmlHistory, setActiveHtml]);

  const redo = useCallback(() => {
    if (historyIndex >= htmlHistory.length - 1) return;
    const newIndex = historyIndex + 1;
    setHistoryIndex(newIndex);
    setActiveHtml(htmlHistory[newIndex]);
  }, [historyIndex, htmlHistory, setActiveHtml]);

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
      // Handle page navigation from iframe links
      if (e.data?.type === "navigate-page") {
        const targetPage = e.data.page;
        const found = pages.find(p => p.name === targetPage || p.id === targetPage.replace('.html', ''));
        if (found) setActivePageId(found.id);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [pushHistory, pages, setActiveHtml]);

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
    if (isMobile && hasPreview && !loading) setMobileTab("preview");
  }, [hasPreview, isMobile, loading]);

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

  const saveProject = useCallback(async (msgs: ChatMsg[], projectId: string | null) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || msgs.length === 0) return;
    const title = msgs[0]?.content?.slice(0, 50) || "Untitled Project";
    const allHtml = pages.map(p => `<!-- PAGE:${p.name} -->\n${p.html}`).join("\n<!-- PAGEBREAK -->\n");
    if (projectId) {
      await supabase.from("website_builder_projects").update({ messages: msgs as any, active_html: allHtml, title }).eq("id", projectId);
    } else {
      const { data } = await supabase.from("website_builder_projects").insert({ user_id: session.user.id, messages: msgs as any, active_html: allHtml, title }).select("id").single();
      if (data) setCurrentProjectId(data.id);
    }
    loadProjects();
  }, [pages]);

  const debouncedSave = useCallback((msgs: ChatMsg[], projectId: string | null) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => saveProject(msgs, projectId), 1500);
  }, [saveProject]);

  const loadProject = (project: SavedProject) => {
    setMessages(project.messages);
    // Parse multi-page format
    const html = project.active_html || "";
    if (html.includes("<!-- PAGEBREAK -->")) {
      const parts = html.split("<!-- PAGEBREAK -->");
      const loadedPages: WebPage[] = parts.map(part => {
        const nameMatch = part.match(/<!-- PAGE:(.+?) -->/);
        const name = nameMatch ? nameMatch[1] : "index.html";
        const pageHtml = part.replace(/<!-- PAGE:.+? -->\n?/, "").trim();
        return { id: name.replace('.html', ''), name, html: pageHtml };
      }).filter(p => p.html);
      setPages(loadedPages);
      if (loadedPages.length > 0) setActivePageId(loadedPages[0].id);
    } else if (html) {
      setPages([{ id: "index", name: "index.html", html }]);
      setActivePageId("index");
    }
    setCurrentProjectId(project.id);
    setShowProjects(false);
    setShowCode(false);
    setError("");
    setIframeErrors([]);
    setHtmlHistory([html]);
    setHistoryIndex(0);
  };

  const deleteProject = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await supabase.from("website_builder_projects").delete().eq("id", id);
    if (currentProjectId === id) {
      setMessages([]); setPages([]); setCurrentProjectId(null);
    }
    loadProjects();
  };

  const extractPages = (text: string): WebPage[] => {
    const pageRegex = /```html:(\S+?)\n([\s\S]*?)```/g;
    const result: WebPage[] = [];
    let match;
    while ((match = pageRegex.exec(text)) !== null) {
      const name = match[1];
      const html = match[2].trim();
      result.push({ id: name.replace('.html', ''), name, html });
    }
    // Fallback: single unnamed html block
    if (result.length === 0) {
      const singleMatch = text.match(/```html\n([\s\S]*?)```/);
      if (singleMatch) {
        result.push({ id: "index", name: "index.html", html: singleMatch[1].trim() });
      }
    }
    return result;
  };

  const wrapHtml = (html: string): string => {
    // Inject navigation script for multi-page support
    const navScript = `
<script>
  document.addEventListener('click', function(e) {
    const link = e.target.closest('a');
    if (link) {
      const href = link.getAttribute('href');
      if (href && href.startsWith('#')) {
        e.preventDefault();
        parent.postMessage({ type: 'navigate-page', page: href.slice(1) }, '*');
      }
    }
  });
</script>`;
    if (html.includes("<head>")) {
      return html.replace("<head>", `<head>${VISUAL_EDIT_SCRIPT}${navScript}`);
    }
    return VISUAL_EDIT_SCRIPT + navScript + html;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isMobile) return;
    e.preventDefault();
    setIsDragging(true);
    dragRef.current = { startX: e.clientX, startWidth: chatWidth };
    const handleMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const diff = ev.clientX - dragRef.current.startX;
      setChatWidth(Math.max(320, Math.min(600, dragRef.current.startWidth + diff)));
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

  const addPage = () => {
    const pageNum = pages.length + 1;
    const name = `page${pageNum}.html`;
    const newPage: WebPage = { id: `page${pageNum}`, name, html: "" };
    setPages(prev => [...prev, newPage]);
    setActivePageId(newPage.id);
  };

  const deletePage = (pageId: string) => {
    if (pages.length <= 1) return;
    setPages(prev => prev.filter(p => p.id !== pageId));
    if (activePageId === pageId) {
      setActivePageId(pages.find(p => p.id !== pageId)?.id || "index");
    }
  };

  const startRenamePage = (pageId: string) => {
    const page = pages.find(p => p.id === pageId);
    if (page) {
      setRenamingPage(pageId);
      setRenameValue(page.name);
    }
  };

  const finishRenamePage = () => {
    if (renamingPage && renameValue.trim()) {
      setPages(prev => prev.map(p => p.id === renamingPage ? { ...p, name: renameValue.trim() } : p));
    }
    setRenamingPage(null);
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

      // Add context about existing pages
      let contextPrompt = BUILDER_PROMPT;
      if (pages.length > 0) {
        contextPrompt += `\n\nCurrent pages in the project: ${pages.map(p => p.name).join(', ')}. When modifying, return ALL pages that need changes.`;
      }

      const progressInterval = setInterval(() => {
        setBuildProgress(p => Math.min(p + Math.random() * 15, 92));
      }, 300);

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
          skillPrompt: contextPrompt,
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

      const extractedPages = extractPages(fullResult);
      if (extractedPages.length > 0) {
        // Merge with existing pages
        setPages(prev => {
          const merged = [...prev];
          extractedPages.forEach(newPage => {
            const existingIdx = merged.findIndex(p => p.id === newPage.id || p.name === newPage.name);
            if (existingIdx >= 0) {
              merged[existingIdx] = newPage;
            } else {
              merged.push(newPage);
            }
          });
          return merged.length > 0 ? merged : extractedPages;
        });
        if (!activePageId || !pages.find(p => p.id === activePageId)) {
          setActivePageId(extractedPages[0].id);
        }
        pushHistory(extractedPages[0].html);
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: fullResult, html: extractedPages[0].html };
          return updated;
        });
      }

      const finalMessages = [...messages, userMsg, { role: "assistant" as const, content: fullResult }];
      debouncedSave(finalMessages, currentProjectId);
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
    // Download all pages as a zip-like concat or single page
    if (pages.length === 1) {
      const blob = new Blob([activeHtml], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = pages[0]?.name || "website.html"; a.click();
      URL.revokeObjectURL(url);
    } else {
      // Download each page
      pages.forEach(p => {
        const blob = new Blob([p.html], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = p.name; a.click();
        URL.revokeObjectURL(url);
      });
    }
  };

  const handleReset = () => {
    setMessages([]); setPages([]); setShowCode(false);
    setError(""); setIframeErrors([]); setMobileTab("chat");
    setCurrentProjectId(null); setSelectedElement(null);
    setEditMode("chat"); setHtmlHistory([]); setHistoryIndex(-1);
    setActivePageId("index");
  };

  const applyStyleEdit = (property: string, value: string) => {
    if (!selectedElement) return;
    iframeRef.current?.contentWindow?.postMessage({
      type: "apply-edit", xpath: selectedElement.xpath, property, value,
    }, "*");
  };

  const applyTextEdit = () => {
    if (!selectedElement) return;
    iframeRef.current?.contentWindow?.postMessage({
      type: "apply-text-edit", xpath: selectedElement.xpath, text: editingText,
    }, "*");
    setSelectedElement(prev => prev ? { ...prev, text: editingText } : null);
  };

  const viewportStyles: Record<ViewportSize, string> = {
    desktop: "w-full h-full",
    tablet: "w-[768px] h-full mx-auto",
    mobile: "w-[375px] h-full mx-auto",
  };

  // ──────────── WELCOME SCREEN ────────────
  const welcomeScreen = (
    <div className="flex-1 flex flex-col items-center justify-center p-6 overflow-y-auto">
      <div className="max-w-2xl w-full space-y-8">
        {/* Hero */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-accent flex items-center justify-center mx-auto border border-border/50">
            <Globe className="w-8 h-8 text-foreground/70" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">What do you want to build?</h1>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Describe your website and I'll generate it instantly with multi-page support, responsive design, and modern aesthetics.
          </p>
        </div>

        {/* Templates grid */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Start from a template</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {TEMPLATES.map((t, i) => (
              <button
                key={i}
                onClick={() => { setInput(t.prompt); inputRef.current?.focus(); }}
                className="group flex flex-col items-start gap-2 p-4 rounded-xl border border-border/40 bg-card hover:bg-accent hover:border-border hover:shadow-lg hover:shadow-foreground/5 transition-all duration-200 text-left hover:-translate-y-0.5 press-scale"
              >
                <span className="text-2xl">{t.icon}</span>
                <div>
                  <p className="text-sm font-semibold text-foreground">{t.title}</p>
                  <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">{t.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  // ──────────── CHAT PANEL ────────────
  const chatPanel = (
    <div
      className={cn("flex flex-col min-h-0 bg-background", isMobile ? "flex-1" : hasPreview ? "border-r border-border/30" : "w-full")}
      style={!isMobile && hasPreview ? { width: `${chatWidth}px`, minWidth: 320, maxWidth: 600 } : undefined}
    >
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !hasPreview ? welcomeScreen : null}

        {messages.map((msg, i) => (
          <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
            <div className={cn(
              "max-w-[92%] text-[14px] leading-relaxed",
              msg.role === "user"
                ? "px-4 py-3 bg-foreground text-background rounded-2xl rounded-br-sm"
                : ""
            )}>
              {msg.role === "assistant" ? (
                <div className="prose prose-sm max-w-none text-foreground [&_pre]:hidden [&_code]:hidden prose-p:my-1.5 prose-ul:my-1 prose-li:my-0">
                  <ReactMarkdown>
                    {msg.content
                      .replace(/```html:\S+?\n[\s\S]*?```/g, "✅ *Page generated — see preview →*")
                      .replace(/```html\n[\s\S]*?```/g, "✅ *Website updated — see preview →*")}
                  </ReactMarkdown>
                </div>
              ) : (
                <span>{msg.content}</span>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="flex items-center gap-3 py-3">
              <div className="relative w-8 h-8">
                <div className="absolute inset-0 rounded-full border-2 border-foreground/10" />
                <div className="absolute inset-0 rounded-full border-2 border-foreground border-t-transparent animate-spin" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {buildProgress < 30 ? "Analyzing your request..." : buildProgress < 60 ? "Generating code..." : buildProgress < 90 ? "Building pages..." : "Finalizing..."}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="w-32 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-foreground rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${buildProgress}%` }}
                    />
                  </div>
                  <span className="text-[11px] text-muted-foreground font-mono">{Math.round(buildProgress)}%</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-destructive/10 text-destructive text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border/30 bg-card/30">
        <div className="flex gap-2 items-end bg-muted/30 border border-border/40 rounded-2xl p-1.5 focus-within:border-primary/30 focus-within:ring-2 focus-within:ring-primary/10 transition-all">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={hasPreview ? "Describe changes or add a new page..." : "Describe a website to build..."}
            rows={1}
            className="flex-1 bg-transparent px-3 py-2.5 text-[14px] text-foreground placeholder:text-muted-foreground/40 resize-none focus:outline-none max-h-[120px] overflow-y-auto"
            style={{ minHeight: "44px" }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="w-9 h-9 rounded-xl bg-foreground text-background flex items-center justify-center hover:opacity-80 disabled:opacity-20 transition-all shrink-0 mb-0.5"
          >
            <ArrowUp className="w-4 h-4" strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );

  // ──────────── VISUAL INSPECTOR PANEL ────────────
  const inspectorPanel = selectedElement && editMode === "visual" ? (
    <div className="w-[260px] shrink-0 border-l border-border/30 bg-card flex flex-col overflow-y-auto animate-slide-up">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/30">
        <div className="flex items-center gap-2">
          <Layers className="w-3.5 h-3.5 text-foreground/60" />
          <span className="text-xs font-semibold text-foreground">Inspector</span>
        </div>
        <button onClick={() => setSelectedElement(null)} className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="px-3 py-2 border-b border-border/20">
        <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">Element</span>
        <p className="text-xs font-mono text-foreground mt-0.5">&lt;{selectedElement.tagName}&gt;</p>
        <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{selectedElement.text.slice(0, 80)}</p>
      </div>

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
        <button onClick={applyTextEdit} className="w-full text-[11px] py-1.5 rounded-lg bg-foreground text-background hover:opacity-90 transition-opacity font-medium">
          Apply Text
        </button>
      </div>

      <div className="px-3 py-2.5 space-y-2.5">
        <div className="flex items-center gap-1.5">
          <Palette className="w-3 h-3 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">Styles</span>
        </div>

        {[
          { label: "Text Color", prop: "color", values: ["#000000", "#ffffff", "#ef4444", "#3b82f6", "#22c55e", "#f59e0b", "#8b5cf6", "#ec4899"] },
          { label: "Background", prop: "backgroundColor", values: ["transparent", "#ffffff", "#f3f4f6", "#1f2937", "#3b82f6", "#22c55e", "#f59e0b", "#8b5cf6"] },
        ].map(group => (
          <div key={group.prop} className="space-y-1">
            <span className="text-[10px] text-muted-foreground">{group.label}</span>
            <div className="flex gap-1 flex-wrap">
              {group.values.map(c => (
                <button
                  key={c}
                  onClick={() => applyStyleEdit(group.prop, c)}
                  className={cn("w-6 h-6 rounded-md border border-border/30 hover:scale-110 transition-transform", c === "transparent" && "bg-[conic-gradient(#ccc_25%,#fff_25%,#fff_50%,#ccc_50%,#ccc_75%,#fff_75%)] bg-[length:8px_8px]")}
                  style={c !== "transparent" ? { backgroundColor: c } : undefined}
                />
              ))}
            </div>
          </div>
        ))}

        {[
          { label: "Font Size", prop: "fontSize", values: ["12px", "14px", "16px", "18px", "20px", "24px", "32px", "48px"] },
          { label: "Font Weight", prop: "fontWeight", values: [{ l: "Light", v: "300" }, { l: "Normal", v: "400" }, { l: "Medium", v: "500" }, { l: "Bold", v: "700" }, { l: "Black", v: "900" }] },
          { label: "Padding", prop: "padding", values: ["0px", "4px", "8px", "12px", "16px", "24px", "32px", "48px"] },
          { label: "Border Radius", prop: "borderRadius", values: ["0", "4px", "8px", "12px", "16px", "9999px"] },
        ].map(group => (
          <div key={group.prop} className="space-y-1">
            <span className="text-[10px] text-muted-foreground">{group.label}</span>
            <div className="flex gap-1 flex-wrap">
              {(group.values as any[]).map((v: any) => {
                const label = typeof v === "string" ? v : v.l;
                const value = typeof v === "string" ? v : v.v;
                return (
                  <button
                    key={value}
                    onClick={() => applyStyleEdit(group.prop, value)}
                    className="px-2 py-1 text-[10px] rounded-md border border-border/30 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  ) : null;

  // ──────────── PAGE TABS ────────────
  const pageTabs = pages.length > 0 ? (
    <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border/30 bg-muted/20 overflow-x-auto">
      {pages.map(page => (
        <div key={page.id} className="flex items-center group">
          {renamingPage === page.id ? (
            <input
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onBlur={finishRenamePage}
              onKeyDown={e => e.key === "Enter" && finishRenamePage()}
              className="px-2 py-1 text-[11px] bg-background border border-primary/30 rounded-lg w-24 focus:outline-none text-foreground"
              autoFocus
            />
          ) : (
            <button
              onClick={() => setActivePageId(page.id)}
              onDoubleClick={() => startRenamePage(page.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all whitespace-nowrap",
                activePageId === page.id
                  ? "bg-background text-foreground shadow-sm border border-border/50"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <FileCode className="w-3 h-3" />
              {page.name}
              {pages.length > 1 && (
                <button
                  onClick={e => { e.stopPropagation(); deletePage(page.id); }}
                  className="ml-1 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              )}
            </button>
          )}
        </div>
      ))}
      <button
        onClick={addPage}
        className="p-1.5 rounded-lg text-muted-foreground/50 hover:text-foreground hover:bg-muted/50 transition-colors"
        title="Add page"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  ) : null;

  // ──────────── PREVIEW PANEL ────────────
  const previewPanel = hasPreview ? (
    <div className={cn("flex flex-col min-h-0", isMobile ? "flex-1" : "flex-1")}>
      {/* Page tabs */}
      {!showCode && pageTabs}

      {showCode ? (
        <div className="flex-1 flex flex-col min-h-0">
          {pageTabs}
          <div className="flex items-center justify-between px-4 py-2 border-b border-border/30 bg-card/50">
            <span className="text-xs text-muted-foreground font-mono">{pages.find(p => p.id === activePageId)?.name || "index.html"}</span>
            <div className="flex items-center gap-2">
              <button onClick={downloadHtml} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
                <Download className="w-3 h-3" /> Download
              </button>
              <button onClick={copyCode} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
                {copied ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-4 bg-card/30">
            <pre className="text-xs font-mono text-foreground/80 whitespace-pre-wrap leading-relaxed">{activeHtml}</pre>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex min-h-0">
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-hidden m-2 rounded-xl border border-border/30 bg-white shadow-sm">
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

          {inspectorPanel}
        </div>
      )}
    </div>
  ) : null;

  return (
    <div className="h-full flex flex-col">
      {/* ─── HEADER ─── */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 border-b border-border/30 glass-subtle">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-accent flex items-center justify-center border border-border/50">
            <Globe className="w-4 h-4 text-foreground/70" />
          </div>
          <div>
            <h2 className="text-[14px] font-bold text-foreground">Website Builder</h2>
            {loading && buildProgress > 0 && (
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="w-24 h-1 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-foreground rounded-full transition-all duration-300 ease-out" style={{ width: `${buildProgress}%` }} />
                </div>
                <span className="text-[9px] text-muted-foreground font-mono">{Math.round(buildProgress)}%</span>
              </div>
            )}
            {!loading && pages.length > 0 && (
              <p className="text-[10px] text-muted-foreground">{pages.length} page{pages.length > 1 ? 's' : ''}</p>
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
              <div className="w-px h-4 bg-border/40 mx-1" />
            </>
          )}

          {/* Projects */}
          <button onClick={() => { setShowProjects(p => !p); if (!showProjects) loadProjects(); }} className={cn("p-1.5 rounded-lg transition-colors", showProjects ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground hover:bg-muted/50")} title="Projects">
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
                  editMode === "visual" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
                title={editMode === "visual" ? "Exit visual edit" : "Visual edit mode"}
              >
                <MousePointer2 className="w-3.5 h-3.5" />
              </button>

              <div className="w-px h-4 bg-border/40 mx-1" />

              {/* Viewport */}
              <div className="flex items-center gap-0 bg-muted/40 rounded-lg p-0.5">
                {([
                  { id: "mobile" as ViewportSize, icon: Smartphone },
                  { id: "tablet" as ViewportSize, icon: Tablet },
                  { id: "desktop" as ViewportSize, icon: Monitor },
                ] as const).map(v => (
                  <button key={v.id} onClick={() => setViewport(v.id)} className={cn("p-1.5 rounded-md transition-colors", viewport === v.id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")} title={v.id}>
                    <v.icon className="w-3.5 h-3.5" />
                  </button>
                ))}
              </div>

              <div className="w-px h-4 bg-border/40 mx-1" />

              {/* Preview/Code toggle */}
              <div className="flex items-center bg-muted/40 rounded-lg p-0.5">
                <button onClick={() => setShowCode(false)} className={cn("flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-colors", !showCode ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>
                  <Eye className="w-3 h-3" /> Preview
                </button>
                <button onClick={() => setShowCode(true)} className={cn("flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-colors", showCode ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>
                  <CodeXml className="w-3 h-3" /> Code
                </button>
              </div>

              <button onClick={downloadHtml} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors" title="Download">
                <Download className="w-3.5 h-3.5" />
              </button>

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
              <button onClick={() => setShowCode(c => !c)} className={cn("p-2 rounded-lg transition-colors", showCode ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground hover:bg-muted/50")}>
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
            <button onClick={handleReset} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors ml-1" title="New project">
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Projects dropdown */}
      {showProjects && (
        <div className="border-b border-border/30 bg-card backdrop-blur-sm max-h-[220px] overflow-y-auto animate-slide-up">
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/20">
            <span className="text-xs font-semibold text-foreground">Your Projects</span>
            <button onClick={handleReset} className="flex items-center gap-1 text-xs text-foreground/70 hover:text-foreground transition-colors font-medium">
              <Plus className="w-3 h-3" /> New Project
            </button>
          </div>
          {loadingProjects ? (
            <div className="flex items-center justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
          ) : savedProjects.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">No projects yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Your websites will appear here</p>
            </div>
          ) : (
            <div className="p-1.5 space-y-0.5">
              {savedProjects.map(p => (
                <button key={p.id} onClick={() => loadProject(p)} className={cn("w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left text-xs transition-colors group", currentProjectId === p.id ? "bg-accent border border-border text-foreground" : "hover:bg-muted/50 text-foreground/70")}>
                  <div className="flex-1 min-w-0 flex items-center gap-2.5">
                    <Globe className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div>
                      <p className="truncate font-medium">{p.title}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{new Date(p.updated_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <button onClick={e => deleteProject(p.id, e)} className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all">
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
        <div className="flex border-b border-border/30 bg-card/50">
          <button onClick={() => setMobileTab("chat")} className={cn("flex-1 flex items-center justify-center gap-2 py-2.5 text-[13px] font-medium transition-colors", mobileTab === "chat" ? "text-foreground border-b-2 border-foreground" : "text-muted-foreground")}>
            <MessageSquare className="w-4 h-4" /> Chat
          </button>
          <button onClick={() => setMobileTab("preview")} className={cn("flex-1 flex items-center justify-center gap-2 py-2.5 text-[13px] font-medium transition-colors", mobileTab === "preview" ? "text-foreground border-b-2 border-foreground" : "text-muted-foreground")}>
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
              <div onMouseDown={handleMouseDown} className={cn("w-1.5 cursor-col-resize flex items-center justify-center hover:bg-blue-500/10 transition-colors shrink-0", isDragging && "bg-blue-500/10")}>
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
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/30 bg-card/50">
            <div className="flex items-center gap-3">
              <Globe className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-semibold text-foreground">Fullscreen Preview</span>
              {pages.length > 1 && (
                <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  {pages.find(p => p.id === activePageId)?.name}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Page selector in fullscreen */}
              {pages.length > 1 && (
                <div className="flex items-center gap-0.5 bg-muted/40 rounded-lg p-0.5 mr-2">
                  {pages.map(p => (
                    <button key={p.id} onClick={() => setActivePageId(p.id)} className={cn("px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors", activePageId === p.id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>
                      {p.name.replace('.html', '')}
                    </button>
                  ))}
                </div>
              )}
              {!isMobile && (
                <div className="flex items-center gap-0.5 bg-muted/30 rounded-lg p-0.5">
                  {([
                    { id: "mobile" as ViewportSize, icon: Smartphone },
                    { id: "tablet" as ViewportSize, icon: Tablet },
                    { id: "desktop" as ViewportSize, icon: Monitor },
                  ] as const).map(v => (
                    <button key={v.id} onClick={() => setViewport(v.id)} className={cn("p-1.5 rounded-md transition-colors", viewport === v.id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>
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
