import { useState, useRef } from "react";
import { Search, Loader2, RotateCcw, Globe } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";

export default function WebSearchTool() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSearch = async () => {
    const text = query.trim();
    if (!text || loading) return;

    setLoading(true);
    setError("");
    setResult("");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/web-search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ query: text }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Search failed" }));
        throw new Error(err.error || "Search failed");
      }

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
            if (content) {
              full += content;
              setResult(full);
            }
          } catch { /* partial */ }
        }
      }
    } catch (err: any) {
      setError(err.message || "Search failed");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setQuery("");
    setResult("");
    setError("");
    inputRef.current?.focus();
  };

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4 animate-fade-in h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
            <Globe className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground tracking-tight">Web Search</h2>
            <p className="text-[11px] text-muted-foreground">AI-powered web search</p>
          </div>
        </div>
        {result && (
          <button onClick={handleReset} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs bg-muted/50 border border-border/50 text-foreground/70 hover:bg-muted transition-colors">
            <RotateCcw className="w-3.5 h-3.5" />
            New Search
          </button>
        )}
      </div>

      <div className="flex gap-2">
        <div className="flex-1 flex items-center gap-2 bg-muted/30 border border-border/40 rounded-xl px-3.5 py-2.5 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
          <Search className="w-4 h-4 text-muted-foreground/50 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Search anything..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/40 outline-none"
          />
        </div>
        <button
          onClick={handleSearch}
          disabled={!query.trim() || loading}
          className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-30 transition-opacity shrink-0"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Search"}
        </button>
      </div>

      {error && <p className="text-destructive text-xs text-center">{error}</p>}

      {loading && !result && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary/40" />
          <p className="text-sm text-muted-foreground">Searching the web...</p>
        </div>
      )}

      {result && (
        <div className="flex-1 overflow-y-auto rounded-xl bg-muted/10 border border-border/30 p-5 min-h-0">
          <div className="prose prose-sm max-w-none text-foreground dark:prose-invert">
            <ReactMarkdown>{result}</ReactMarkdown>
          </div>
        </div>
      )}

      {!result && !loading && (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-12 space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-primary/5 flex items-center justify-center">
            <Search className="w-7 h-7 text-primary/30" />
          </div>
          <p className="text-sm text-foreground/60">Ask any question to search the web</p>
          <p className="text-xs text-muted-foreground/50">Get real-time AI-powered answers</p>
        </div>
      )}
    </div>
  );
}
