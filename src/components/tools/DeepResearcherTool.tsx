import { useState } from "react";
import { Globe, Loader2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";

export default function DeepResearcherTool() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleResearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError("");
    setResult("");

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
          messages: [{ role: "user", content: `Research the following topic in depth. Provide a comprehensive analysis with multiple perspectives, key findings, data points, and actionable insights. Structure with clear sections:\n\n${query}` }],
          model: "qwen",
          enableThinking: true,
          skillPrompt: "You are a deep research analyst. Provide exhaustive, well-structured research reports. Include: Executive Summary, Key Findings, Detailed Analysis, Multiple Perspectives, Data & Evidence, Conclusions, and Recommendations. Be thorough and cite reasoning.",
        }),
      });

      if (!resp.ok) throw new Error("Research failed");
      const reader = resp.body?.getReader();
      if (!reader) throw new Error("No response");

      const decoder = new TextDecoder();
      let buffer = "";
      let fullResult = "";
      let inThink = false;

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
              let remaining = content as string;
              while (remaining.length > 0) {
                if (!inThink) {
                  const ts = remaining.indexOf("<think>");
                  if (ts !== -1) { fullResult += remaining.slice(0, ts); inThink = true; remaining = remaining.slice(ts + 7); continue; }
                }
                if (inThink) {
                  const te = remaining.indexOf("</think>");
                  if (te !== -1) { inThink = false; remaining = remaining.slice(te + 8); continue; }
                  remaining = ""; continue;
                }
                fullResult += remaining;
                remaining = "";
              }
              setResult(fullResult);
            }
          } catch { /* partial */ }
        }
      }
    } catch (err: any) {
      setError(err.message || "Research failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4 animate-fade-in">
      <div className="flex items-center gap-2 mb-2">
        <Globe className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">Deep Researcher</h2>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleResearch()}
          placeholder="Enter a topic to research deeply..."
          className="w-full bg-muted/50 border border-border rounded-2xl outline-none text-sm text-foreground pl-11 pr-4 py-3 focus:border-primary/30 transition-colors"
        />
      </div>

      <button
        onClick={handleResearch}
        disabled={!query.trim() || loading}
        className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-30 transition-opacity"
      >
        {loading ? <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Researching...</span> : "Start Research"}
      </button>

      {error && <p className="text-destructive text-sm">{error}</p>}
      {result && (
        <div className="bg-muted/30 border border-border rounded-2xl p-5">
          <div className="prose prose-sm max-w-none text-foreground">
            <ReactMarkdown>{result}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
