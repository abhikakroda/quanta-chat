import { useState } from "react";
import { Code2, Loader2, Play, Copy, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";

export default function CodeAssistantTool() {
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"code" | "website">("code");
  const [previewHtml, setPreviewHtml] = useState("");
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError("");
    setResult("");
    setPreviewHtml("");

    const websitePrompt = mode === "website"
      ? "Generate a COMPLETE single-file HTML page with embedded CSS and JavaScript. Return ONLY the HTML code in a code block. Make it responsive and modern."
      : "";

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
          messages: [{ role: "user", content: `${websitePrompt}\n\n${prompt}` }],
          model: "qwen-coder",
          enableThinking: false,
          skillPrompt: "You are an expert coding assistant. Write clean, efficient, well-documented code. When asked to build a website, generate complete, working HTML with embedded CSS and JS.",
        }),
      });

      if (!resp.ok) throw new Error("Generation failed");
      const reader = resp.body?.getReader();
      if (!reader) throw new Error("No response");

      const decoder = new TextDecoder();
      let buffer = "";
      let fullResult = "";

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
            if (content) { fullResult += content; setResult(fullResult); }
          } catch { /* partial */ }
        }
      }

      // Extract HTML for preview in website mode
      if (mode === "website") {
        const htmlMatch = fullResult.match(/```html\n([\s\S]*?)```/);
        if (htmlMatch) setPreviewHtml(htmlMatch[1]);
      }
    } catch (err: any) {
      setError(err.message || "Generation failed");
    } finally {
      setLoading(false);
    }
  };

  const copyCode = () => {
    const codeMatch = result.match(/```(?:\w+)?\n([\s\S]*?)```/);
    navigator.clipboard.writeText(codeMatch ? codeMatch[1] : result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4 animate-fade-in">
      <div className="flex items-center gap-2 mb-2">
        <Code2 className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">Code Assistant</h2>
      </div>

      <div className="flex gap-2">
        <button onClick={() => setMode("code")} className={`px-4 py-2 rounded-xl text-sm transition-colors ${mode === "code" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
          Code Help
        </button>
        <button onClick={() => setMode("website")} className={`px-4 py-2 rounded-xl text-sm transition-colors ${mode === "website" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
          <span className="flex items-center gap-1.5"><Play className="w-3.5 h-3.5" /> Build Website</span>
        </button>
      </div>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder={mode === "website" ? "Describe the website you want to build..." : "Ask a coding question or describe what you need..."}
        className="w-full bg-muted/50 border border-border rounded-2xl outline-none text-sm text-foreground p-4 min-h-[120px] resize-none focus:border-primary/30 transition-colors font-mono"
      />

      <div className="flex items-center gap-3">
        <button onClick={handleGenerate} disabled={!prompt.trim() || loading} className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-30 transition-opacity">
          {loading ? <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Generating...</span> : mode === "website" ? "Build Website" : "Generate Code"}
        </button>
        {result && (
          <button onClick={copyCode} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground transition-colors">
            {copied ? <><Check className="w-4 h-4" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy Code</>}
          </button>
        )}
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      {previewHtml && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-foreground">Live Preview</h3>
          <div className="border border-border rounded-2xl overflow-hidden bg-white">
            <iframe srcDoc={previewHtml} className="w-full h-[400px]" sandbox="allow-scripts" title="Website Preview" />
          </div>
        </div>
      )}

      {result && (
        <div className="bg-muted/30 border border-border rounded-2xl p-4 overflow-x-auto">
          <div className="prose prose-sm max-w-none text-foreground">
            <ReactMarkdown>{result}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
