import { useState, useRef, useEffect } from "react";
import { Globe, Loader2, Link2, FileText, Image as ImageIcon, Heading, Copy, Check, Wand2, RotateCcw, ExternalLink, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

type CrawlResult = {
  url: string;
  title: string;
  description: string;
  text: string;
  links: { url: string; text: string }[];
  headings: { level: number; text: string }[];
  images: { src: string; alt: string }[];
  wordCount: number;
  charCount: number;
};

type Tab = "content" | "links" | "headings" | "images" | "ai-summary";

export default function WebScraperTool() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CrawlResult | null>(null);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("content");
  const [copied, setCopied] = useState(false);
  const [aiSummary, setAiSummary] = useState("");
  const [summarizing, setSummarizing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleCrawl = async () => {
    const target = url.trim();
    if (!target) return;

    setLoading(true);
    setError("");
    setResult(null);
    setAiSummary("");

    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/web-crawl`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ url: target }),
      });

      const data = await resp.json();
      if (!data.success) throw new Error(data.error || "Crawl failed");

      setResult(data.data);
      setActiveTab("content");
    } catch (err: any) {
      setError(err.message || "Failed to crawl website");
    } finally {
      setLoading(false);
    }
  };

  const handleAiSummarize = async () => {
    if (!result?.text || summarizing) return;
    setSummarizing(true);
    setAiSummary("");
    setActiveTab("ai-summary");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          messages: [{
            role: "user",
            content: `Analyze and summarize this website content. Provide:
1. A brief overview (2-3 sentences)
2. Key topics/themes covered
3. Important facts or data points
4. Target audience
5. Overall assessment

Website: ${result.title} (${result.url})
Description: ${result.description}

Content:
${result.text.slice(0, 8000)}`,
          }],
          model: "mistral",
          enableThinking: false,
          skillPrompt: "You are a web content analyst. Provide clear, structured summaries of website content. Use markdown formatting with headers and bullet points.",
        }),
      });

      if (!resp.ok) throw new Error("AI summary failed");
      const reader = resp.body?.getReader();
      if (!reader) throw new Error("No response");

      const decoder = new TextDecoder();
      let buffer = "";
      let full = "";

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
            if (content) { full += content; setAiSummary(full); }
          } catch { /* partial */ }
        }
      }
    } catch (err: any) {
      setError(err.message || "Summarization failed");
    } finally {
      setSummarizing(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    setUrl("");
    setResult(null);
    setError("");
    setAiSummary("");
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleCrawl();
  };

  const TABS: { id: Tab; label: string; icon: typeof Globe; count?: number }[] = [
    { id: "content", label: "Content", icon: FileText },
    { id: "headings", label: "Structure", icon: Heading, count: result?.headings.length },
    { id: "links", label: "Links", icon: Link2, count: result?.links.length },
    { id: "images", label: "Images", icon: ImageIcon, count: result?.images.length },
    { id: "ai-summary", label: "AI Summary", icon: Wand2 },
  ];

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4 animate-fade-in h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
            <Globe className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground tracking-tight">Open Claw</h2>
            <p className="text-[11px] text-muted-foreground">Web crawler & content extractor</p>
          </div>
        </div>
        {result && (
          <button onClick={handleReset} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs bg-muted/50 border border-border/50 text-foreground/70 hover:bg-muted transition-colors">
            <RotateCcw className="w-3.5 h-3.5" />
            New Crawl
          </button>
        )}
      </div>

      {/* URL Input */}
      <div className="flex gap-2">
        <div className="flex-1 flex items-center gap-2 bg-muted/30 border border-border/40 rounded-xl px-3.5 py-2.5 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
          <Search className="w-4 h-4 text-muted-foreground/50 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter URL to crawl (e.g. example.com)"
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/40 outline-none"
          />
        </div>
        <button
          onClick={handleCrawl}
          disabled={!url.trim() || loading}
          className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-30 transition-opacity shrink-0"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Crawl"}
        </button>
      </div>

      {error && <p className="text-destructive text-xs text-center">{error}</p>}

      {/* Results */}
      {result && (
        <div className="flex-1 flex flex-col min-h-0 space-y-3">
          {/* Page info card */}
          <div className="bg-muted/20 border border-border/30 rounded-xl p-4 space-y-1.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-foreground truncate">{result.title || "Untitled"}</h3>
                <a href={result.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary/70 hover:text-primary flex items-center gap-1 truncate">
                  {result.url} <ExternalLink className="w-3 h-3 shrink-0" />
                </a>
              </div>
              <div className="flex gap-3 text-xs text-muted-foreground shrink-0">
                <span>{result.wordCount.toLocaleString()} words</span>
                <span>{result.links.length} links</span>
              </div>
            </div>
            {result.description && (
              <p className="text-xs text-muted-foreground line-clamp-2">{result.description}</p>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 overflow-x-auto pb-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  if (tab.id === "ai-summary" && !aiSummary && !summarizing) handleAiSummarize();
                }}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-colors",
                  activeTab === tab.id
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
                {tab.count !== undefined && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted">{tab.count}</span>
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto rounded-xl bg-muted/10 border border-border/30 min-h-0">
            {activeTab === "content" && (
              <div className="p-4">
                <div className="flex justify-end mb-2">
                  <button onClick={() => handleCopy(result.text)} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
                <pre className="text-sm text-foreground/80 whitespace-pre-wrap font-sans leading-relaxed">{result.text}</pre>
              </div>
            )}

            {activeTab === "headings" && (
              <div className="p-4 space-y-1.5">
                {result.headings.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No headings found</p>
                ) : (
                  result.headings.map((h, i) => (
                    <div key={i} className="flex items-center gap-2" style={{ paddingLeft: `${(h.level - 1) * 16}px` }}>
                      <span className="text-[10px] font-mono text-muted-foreground/50 w-5 shrink-0">H{h.level}</span>
                      <span className={cn("text-sm", h.level <= 2 ? "font-semibold text-foreground" : "text-foreground/70")}>{h.text}</span>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === "links" && (
              <div className="p-4 space-y-1">
                {result.links.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No links found</p>
                ) : (
                  result.links.map((l, i) => (
                    <a
                      key={i}
                      href={l.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs hover:bg-muted/50 transition-colors group"
                    >
                      <Link2 className="w-3 h-3 text-muted-foreground/40 shrink-0" />
                      <span className="text-primary/70 group-hover:text-primary truncate flex-1">{l.text}</span>
                      <ExternalLink className="w-3 h-3 text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </a>
                  ))
                )}
              </div>
            )}

            {activeTab === "images" && (
              <div className="p-4">
                {result.images.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No images found</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {result.images.map((img, i) => (
                      <a key={i} href={img.src} target="_blank" rel="noopener noreferrer" className="group">
                        <div className="aspect-video rounded-lg overflow-hidden bg-muted/30 border border-border/20">
                          <img src={img.src} alt={img.alt} className="w-full h-full object-cover" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        </div>
                        {img.alt && <p className="text-[10px] text-muted-foreground mt-1 truncate">{img.alt}</p>}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "ai-summary" && (
              <div className="p-4">
                {summarizing && !aiSummary && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analyzing content...
                  </div>
                )}
                {aiSummary && (
                  <div className="prose prose-sm max-w-none text-foreground">
                    <ReactMarkdown>{aiSummary}</ReactMarkdown>
                  </div>
                )}
                {!summarizing && !aiSummary && (
                  <button onClick={handleAiSummarize} className="mx-auto flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
                    <Wand2 className="w-4 h-4" />
                    Summarize with AI
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!result && !loading && (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-12 space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-primary/5 flex items-center justify-center">
            <Globe className="w-7 h-7 text-primary/30" />
          </div>
          <p className="text-sm text-foreground/60">Enter a URL to extract content</p>
          <p className="text-xs text-muted-foreground/50">Extracts text, links, headings, images & AI summaries</p>
        </div>
      )}
    </div>
  );
}
