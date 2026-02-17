import { useState } from "react";
import { FileText, Loader2, Copy, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";

const TEMPLATES = [
  { id: "article", label: "Article", prompt: "Write a well-structured article about:" },
  { id: "email", label: "Email", prompt: "Write a professional email about:" },
  { id: "essay", label: "Essay", prompt: "Write a thoughtful essay about:" },
  { id: "story", label: "Story", prompt: "Write a creative story about:" },
  { id: "blog", label: "Blog Post", prompt: "Write an engaging blog post about:" },
  { id: "custom", label: "Custom", prompt: "" },
];

export default function WriterTool() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [template, setTemplate] = useState("article");
  const [copied, setCopied] = useState(false);

  const handleWrite = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setError("");
    setResult("");

    const tpl = TEMPLATES.find((t) => t.id === template);
    const userPrompt = tpl?.prompt ? `${tpl.prompt} ${input}` : input;

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
          messages: [{ role: "user", content: userPrompt }],
          model: "mistral",
          enableThinking: false,
          skillPrompt: "You are a professional writer. Craft compelling, well-structured content. Focus on clarity, engagement, and proper tone. Adapt your style based on the content type requested.",
        }),
      });

      if (!resp.ok) throw new Error("Writing failed");
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
    } catch (err: any) {
      setError(err.message || "Writing failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4 animate-fade-in">
      <div className="flex items-center gap-2 mb-2">
        <FileText className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">AI Writer</h2>
      </div>

      <div className="flex flex-wrap gap-2">
        {TEMPLATES.map((t) => (
          <button key={t.id} onClick={() => setTemplate(t.id)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${template === t.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
            {t.label}
          </button>
        ))}
      </div>

      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="What would you like me to write about?"
        className="w-full bg-muted/50 border border-border rounded-2xl outline-none text-sm text-foreground p-4 min-h-[120px] resize-none focus:border-primary/30 transition-colors"
      />

      <div className="flex items-center gap-3">
        <button onClick={handleWrite} disabled={!input.trim() || loading} className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-30 transition-opacity">
          {loading ? <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Writing...</span> : "Write"}
        </button>
        {result && (
          <button onClick={() => { navigator.clipboard.writeText(result); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground transition-colors">
            {copied ? <><Check className="w-4 h-4" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy</>}
          </button>
        )}
      </div>

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
