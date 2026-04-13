import { useState, useRef } from "react";
import { Columns2, Loader2, Send, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { MODELS, ModelId } from "@/lib/chat";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

type ModelResponse = {
  model: ModelId;
  label: string;
  content: string;
  loading: boolean;
  error?: string;
};

const COMPARE_MODELS: { id: ModelId; label: string }[] = [
  { id: "gemini-flash", label: "Gemini Flash" },
  { id: "gemini-pro", label: "Gemini Pro" },
  { id: "gemini-flash-lite", label: "Flash Lite" },
];

export default function CompareModelsTool() {
  const [prompt, setPrompt] = useState("");
  const [selectedModels, setSelectedModels] = useState<ModelId[]>(["gemini-flash", "gemini-pro"]);
  const [responses, setResponses] = useState<ModelResponse[]>([]);
  const [running, setRunning] = useState(false);
  const abortRefs = useRef<AbortController[]>([]);

  const toggleModel = (id: ModelId) => {
    setSelectedModels((prev) => {
      if (prev.includes(id)) return prev.length > 1 ? prev.filter((m) => m !== id) : prev;
      if (prev.length >= 4) return prev;
      return [...prev, id];
    });
  };

  const handleCompare = async () => {
    const text = prompt.trim();
    if (!text || running || selectedModels.length < 2) return;

    setRunning(true);

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      setRunning(false);
      return;
    }

    // Initialize responses
    const initial: ModelResponse[] = selectedModels.map((id) => ({
      model: id,
      label: COMPARE_MODELS.find((m) => m.id === id)?.label || id,
      content: "",
      loading: true,
    }));
    setResponses(initial);

    // Cancel previous
    abortRefs.current.forEach((c) => c.abort());
    abortRefs.current = [];

    // Fire all model requests in parallel
    const promises = selectedModels.map(async (modelId, idx) => {
      const controller = new AbortController();
      abortRefs.current.push(controller);

      try {
        const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            messages: [{ role: "user", content: text }],
            model: modelId,
            enableThinking: false,
          }),
          signal: controller.signal,
        });

        if (!resp.ok) throw new Error(`Error ${resp.status}`);

        const reader = resp.body?.getReader();
        if (!reader) throw new Error("No body");

        const decoder = new TextDecoder();
        let buffer = "";
        let full = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let lineIdx: number;
          while ((lineIdx = buffer.indexOf("\n")) !== -1) {
            let line = buffer.slice(0, lineIdx);
            buffer = buffer.slice(lineIdx + 1);
            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (!line.startsWith("data: ")) continue;
            const json = line.slice(6).trim();
            if (json === "[DONE]") break;
            try {
              const parsed = JSON.parse(json);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                // Strip thinking tags
                const clean = content.replace(/<\/?think>/g, "");
                if (clean) {
                  full += clean;
                  setResponses((prev) =>
                    prev.map((r, i) => (i === idx ? { ...r, content: full } : r))
                  );
                }
              }
            } catch { /* partial */ }
          }
        }

        setResponses((prev) =>
          prev.map((r, i) => (i === idx ? { ...r, loading: false } : r))
        );
      } catch (err: any) {
        if (err.name === "AbortError") return;
        setResponses((prev) =>
          prev.map((r, i) =>
            i === idx ? { ...r, loading: false, error: err.message } : r
          )
        );
      }
    });

    await Promise.allSettled(promises);
    setRunning(false);
  };

  const handleReset = () => {
    abortRefs.current.forEach((c) => c.abort());
    setPrompt("");
    setResponses([]);
    setRunning(false);
  };

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-4 animate-fade-in h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
            <Columns2 className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground tracking-tight">Compare Models</h2>
            <p className="text-[11px] text-muted-foreground">Side-by-side AI model comparison</p>
          </div>
        </div>
        {responses.length > 0 && (
          <button onClick={handleReset} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs bg-muted/50 border border-border/50 text-foreground/70 hover:bg-muted transition-colors">
            <RotateCcw className="w-3.5 h-3.5" />
            New Compare
          </button>
        )}
      </div>

      {/* Model selector chips */}
      <div className="flex flex-wrap gap-2">
        {COMPARE_MODELS.map((m) => (
          <button
            key={m.id}
            onClick={() => toggleModel(m.id)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
              selectedModels.includes(m.id)
                ? "bg-primary/10 text-primary border-primary/30"
                : "bg-muted/30 text-muted-foreground border-border/40 hover:bg-muted/50"
            )}
          >
            {m.label}
          </button>
        ))}
        <span className="text-[10px] text-muted-foreground/50 self-center ml-1">
          Select 2-4 models
        </span>
      </div>

      {/* Prompt input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCompare()}
          placeholder="Enter a prompt to compare across models..."
          className="flex-1 bg-muted/30 border border-border/40 rounded-xl px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:ring-1 focus:ring-primary/20 transition-all"
        />
        <button
          onClick={handleCompare}
          disabled={!prompt.trim() || running || selectedModels.length < 2}
          className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-30 transition-opacity shrink-0"
        >
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>

      {/* Results grid */}
      {responses.length > 0 && (
        <div className={cn(
          "flex-1 grid gap-3 min-h-0 overflow-y-auto",
          responses.length === 2 ? "grid-cols-1 md:grid-cols-2" :
          responses.length === 3 ? "grid-cols-1 md:grid-cols-3" :
          "grid-cols-1 md:grid-cols-2"
        )}>
          {responses.map((r) => (
            <div key={r.model} className="rounded-xl border border-border/30 bg-muted/10 flex flex-col min-h-[200px]">
              <div className="px-3 py-2 border-b border-border/20 flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">{r.label}</span>
                {r.loading && <Loader2 className="w-3 h-3 animate-spin text-primary" />}
                {r.error && <span className="text-[10px] text-destructive">{r.error}</span>}
              </div>
              <div className="flex-1 p-3 overflow-y-auto">
                {r.content ? (
                  <div className="prose prose-sm max-w-none text-foreground dark:prose-invert text-xs leading-relaxed">
                    <ReactMarkdown>{r.content}</ReactMarkdown>
                  </div>
                ) : r.loading ? (
                  <div className="flex items-center gap-1.5 text-muted-foreground/40 text-xs">
                    <Loader2 className="w-3 h-3 animate-spin" /> Generating...
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {responses.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-12 space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-primary/5 flex items-center justify-center">
            <Columns2 className="w-7 h-7 text-primary/30" />
          </div>
          <p className="text-sm text-foreground/60">Compare AI model responses side-by-side</p>
          <p className="text-xs text-muted-foreground/50">Select models and enter a prompt</p>
        </div>
      )}
    </div>
  );
}
