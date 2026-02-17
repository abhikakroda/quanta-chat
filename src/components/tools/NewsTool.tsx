import { useState, useEffect } from "react";
import { Newspaper, Loader2, ExternalLink, RefreshCw, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

type NewsItem = {
  title: string;
  description: string;
  url: string;
  source: string;
  publishedAt: string;
};

const CATEGORIES = [
  { id: "general", label: "Top Stories" },
  { id: "technology", label: "Technology" },
  { id: "science", label: "Science" },
  { id: "business", label: "Business" },
  { id: "health", label: "Health" },
  { id: "sports", label: "Sports" },
];

export default function NewsTool() {
  const [category, setCategory] = useState("general");
  const [articles, setArticles] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchNews = async (cat: string) => {
    setLoading(true);
    setError("");
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
          messages: [
            { role: "user", content: `Give me 8 current trending ${cat === "general" ? "" : cat + " "}news headlines from today. For each, provide a JSON array with objects having: title, description (1 sentence), source (news outlet name), url (make a plausible URL), publishedAt (ISO date string for today). Return ONLY valid JSON array, no other text.` },
          ],
          model: "mistral",
          enableThinking: false,
          skillPrompt: "You are a news aggregator. Return ONLY a valid JSON array of news articles. No markdown, no code blocks, just raw JSON.",
        }),
      });

      if (!resp.ok) throw new Error("Failed to fetch news");
      const reader = resp.body?.getReader();
      if (!reader) throw new Error("No response");

      const decoder = new TextDecoder();
      let buffer = "";
      let fullResp = "";

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
            if (content) fullResp += content;
          } catch { /* partial */ }
        }
      }

      // Parse the JSON response
      const jsonMatch = fullResp.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const newsData = JSON.parse(jsonMatch[0]);
        setArticles(newsData);
      } else {
        throw new Error("Could not parse news data");
      }
    } catch (err: any) {
      setError(err.message || "Failed to load news");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNews(category);
  }, [category]);

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4 animate-fade-in h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
            <Newspaper className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground tracking-tight">News</h2>
            <p className="text-[11px] text-muted-foreground">Trending stories powered by AI</p>
          </div>
        </div>
        <button
          onClick={() => fetchNews(category)}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs bg-muted/50 border border-border/50 text-foreground/70 hover:bg-muted transition-colors"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
          Refresh
        </button>
      </div>

      {/* Categories */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setCategory(cat.id)}
            className={cn(
              "px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-colors",
              category === cat.id
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {error && <p className="text-destructive text-xs text-center">{error}</p>}

      {/* Articles */}
      <div className="flex-1 overflow-y-auto space-y-3 min-h-0">
        {loading && articles.length === 0 && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {articles.map((article, i) => (
          <div
            key={i}
            className="bg-muted/20 border border-border/30 rounded-xl p-4 space-y-2 hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-sm font-semibold text-foreground leading-snug">{article.title}</h3>
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 p-1.5 rounded-lg text-muted-foreground/50 hover:text-primary hover:bg-primary/5 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
            {article.description && (
              <p className="text-xs text-muted-foreground leading-relaxed">{article.description}</p>
            )}
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground/60">
              <span className="flex items-center gap-1">
                <Globe className="w-3 h-3" />
                {article.source}
              </span>
              <span>
                {new Date(article.publishedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
