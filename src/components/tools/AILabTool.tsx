import { useState, useRef, useCallback } from "react";
import { FlaskConical, Play, Loader2, BarChart3, Zap, Clock, Type, CheckCircle2, XCircle, AlertTriangle, RotateCcw, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { MODELS, ModelId } from "@/lib/chat";

type Tab = "prompt-lab" | "quality-meter" | "latency-bench";

type PromptTestResult = {
  model: string;
  modelId: ModelId;
  response: string;
  latencyMs: number;
  tokenEstimate: number;
  status: "pending" | "streaming" | "done" | "error";
};

type QualityResult = {
  clarity: number;
  accuracy: number;
  completeness: number;
  conciseness: number;
  helpfulness: number;
  overall: number;
  feedback: string;
};

const TESTABLE_MODELS: { id: ModelId; label: string }[] = [
  { id: "gemini-flash", label: "Gemini Flash" },
  { id: "gemini-pro", label: "Gemini Pro" },
  { id: "gemini-flash-lite", label: "Flash Lite" },
  { id: "gpt5-mini", label: "GPT-5 Mini" },
  { id: "gpt5", label: "GPT-5" },
];

export default function AILabTool() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("prompt-lab");

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-border/40">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <FlaskConical className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              AI Lab
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">EXPERIMENTAL</span>
            </h2>
            <p className="text-[10px] text-muted-foreground">Advanced prompt testing & model analysis</p>
          </div>
        </div>
        <div className="flex gap-1">
          {([
            { id: "prompt-lab" as Tab, label: "Prompt Tester", icon: Zap },
            { id: "quality-meter" as Tab, label: "Quality Meter", icon: BarChart3 },
            { id: "latency-bench" as Tab, label: "Latency Bench", icon: Clock },
          ]).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors",
                tab === t.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
              )}
            >
              <t.icon className="w-3 h-3" />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === "prompt-lab" && <PromptLab />}
        {tab === "quality-meter" && <QualityMeter />}
        {tab === "latency-bench" && <LatencyBench />}
      </div>
    </div>
  );
}

// ─── Prompt Lab: Test a prompt against multiple models ───

function PromptLab() {
  const [prompt, setPrompt] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [selectedModels, setSelectedModels] = useState<ModelId[]>(["gemini-flash", "gemini-pro"]);
  const [results, setResults] = useState<PromptTestResult[]>([]);
  const [running, setRunning] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const toggleModel = (id: ModelId) => {
    setSelectedModels(prev =>
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
  };

  const callModel = useCallback(async (modelId: ModelId, prompt: string, systemPrompt: string): Promise<{ response: string; latencyMs: number }> => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) throw new Error("Not authenticated");

    const start = performance.now();
    const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: prompt }],
        model: modelId,
        enableThinking: false,
        skillPrompt: systemPrompt || undefined,
      }),
    });

    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const reader = resp.body?.getReader();
    if (!reader) throw new Error("No body");
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
          if (content) full += content;
        } catch { /* partial */ }
      }
    }
    const latencyMs = Math.round(performance.now() - start);
    return { response: full.trim(), latencyMs };
  }, []);

  const runTest = async () => {
    if (!prompt.trim() || selectedModels.length === 0 || running) return;
    setRunning(true);

    const initial: PromptTestResult[] = selectedModels.map(id => ({
      model: TESTABLE_MODELS.find(m => m.id === id)?.label || id,
      modelId: id,
      response: "",
      latencyMs: 0,
      tokenEstimate: 0,
      status: "pending",
    }));
    setResults(initial);

    // Run all models in parallel
    await Promise.allSettled(
      selectedModels.map(async (modelId, i) => {
        setResults(prev => prev.map((r, j) => j === i ? { ...r, status: "streaming" } : r));
        try {
          const { response, latencyMs } = await callModel(modelId, prompt, systemPrompt);
          const tokenEstimate = Math.round(response.split(/\s+/).length * 1.3);
          setResults(prev => prev.map((r, j) => j === i ? { ...r, response, latencyMs, tokenEstimate, status: "done" } : r));
        } catch (err) {
          setResults(prev => prev.map((r, j) => j === i ? { ...r, response: `Error: ${err}`, status: "error" } : r));
        }
      })
    );
    setRunning(false);
  };

  const copyResponse = (idx: number) => {
    navigator.clipboard.writeText(results[idx].response);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 1500);
  };

  return (
    <div className="p-4 space-y-4">
      {/* System prompt */}
      <div>
        <label className="text-[10px] text-muted-foreground/50 mb-1 block">System Prompt (optional)</label>
        <input
          value={systemPrompt}
          onChange={e => setSystemPrompt(e.target.value)}
          placeholder="e.g. You are a senior developer. Be concise."
          className="w-full px-3.5 py-2 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/30 transition-colors"
        />
      </div>

      {/* Prompt */}
      <div>
        <label className="text-[10px] text-muted-foreground/50 mb-1 block">Test Prompt</label>
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder="Enter the prompt you want to test across models..."
          className="w-full resize-none bg-card border border-border rounded-xl outline-none text-sm text-foreground p-3 min-h-[80px] max-h-[160px] focus:border-primary/30 transition-colors placeholder:text-muted-foreground/40"
        />
      </div>

      {/* Model picker */}
      <div>
        <label className="text-[10px] text-muted-foreground/50 mb-1.5 block">Models to test</label>
        <div className="flex flex-wrap gap-1.5">
          {TESTABLE_MODELS.map(m => (
            <button
              key={m.id}
              onClick={() => toggleModel(m.id)}
              className={cn(
                "px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-colors",
                selectedModels.includes(m.id)
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-muted"
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={runTest}
        disabled={!prompt.trim() || selectedModels.length === 0 || running}
        className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-30 flex items-center gap-2"
      >
        {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
        {running ? "Running..." : `Test ${selectedModels.length} Model${selectedModels.length > 1 ? "s" : ""}`}
      </button>

      {/* Results grid */}
      {results.length > 0 && (
        <div className={cn("grid gap-3", results.length > 1 ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1")}>
          {results.map((r, i) => (
            <div key={i} className="rounded-xl border border-border/40 bg-card overflow-hidden">
              <div className="px-3.5 py-2 border-b border-border/30 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-foreground">{r.model}</span>
                  {r.status === "streaming" && <Loader2 className="w-3 h-3 animate-spin text-primary" />}
                  {r.status === "done" && <CheckCircle2 className="w-3 h-3 text-green-500" />}
                  {r.status === "error" && <XCircle className="w-3 h-3 text-destructive" />}
                </div>
                {r.status === "done" && (
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span>{r.latencyMs}ms</span>
                    <span>~{r.tokenEstimate} tokens</span>
                    <button onClick={() => copyResponse(i)} className="p-1 rounded hover:bg-muted transition-colors">
                      {copiedIdx === i ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                )}
              </div>
              <div className="px-3.5 py-2.5 max-h-[300px] overflow-y-auto">
                {r.status === "pending" ? (
                  <span className="text-xs text-muted-foreground/50">Waiting...</span>
                ) : (
                  <p className="text-[13px] leading-relaxed text-foreground/80 whitespace-pre-wrap">{r.response || "..."}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Quality Meter: Analyze any AI response ───

function QualityMeter() {
  const [response, setResponse] = useState("");
  const [originalPrompt, setOriginalPrompt] = useState("");
  const [result, setResult] = useState<QualityResult | null>(null);
  const [loading, setLoading] = useState(false);

  const analyze = async () => {
    if (!response.trim() || loading) return;
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const prompt = `You are an AI response quality evaluator. Analyze this AI-generated response and score it.

${originalPrompt ? `Original prompt: "${originalPrompt}"` : ""}

AI Response to evaluate:
"""
${response}
"""

Score each dimension from 1-10 and provide brief feedback. Output EXACTLY in this format:
CLARITY: [1-10]
ACCURACY: [1-10]
COMPLETENESS: [1-10]
CONCISENESS: [1-10]
HELPFULNESS: [1-10]
FEEDBACK: [2-3 sentences about strengths and weaknesses]`;

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: prompt }],
          model: "mistral",
          enableThinking: false,
        }),
      });

      if (!resp.ok) throw new Error("Failed");
      const reader = resp.body?.getReader();
      if (!reader) throw new Error("No body");
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
            if (content) full += content;
          } catch { /* partial */ }
        }
      }

      const parse = (key: string) => {
        const m = full.match(new RegExp(`${key}:\\s*(\\d+)`, "i"));
        return m ? Math.min(10, Math.max(1, parseInt(m[1]))) : 5;
      };

      const clarity = parse("CLARITY");
      const accuracy = parse("ACCURACY");
      const completeness = parse("COMPLETENESS");
      const conciseness = parse("CONCISENESS");
      const helpfulness = parse("HELPFULNESS");
      const overall = Math.round((clarity + accuracy + completeness + conciseness + helpfulness) / 5 * 10) / 10;
      const fm = full.match(/FEEDBACK:\s*([\s\S]+)/i);
      const feedback = fm?.[1]?.trim() || "";

      setResult({ clarity, accuracy, completeness, conciseness, helpfulness, overall, feedback });
    } catch (err) {
      console.error("Quality analysis failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const getColor = (score: number) =>
    score >= 8 ? "text-green-500" : score >= 6 ? "text-amber-500" : "text-destructive";

  const getBarColor = (score: number) =>
    score >= 8 ? "bg-green-500" : score >= 6 ? "bg-amber-500" : "bg-destructive";

  return (
    <div className="p-4 space-y-4">
      <div>
        <label className="text-[10px] text-muted-foreground/50 mb-1 block">Original Prompt (optional — improves accuracy)</label>
        <input
          value={originalPrompt}
          onChange={e => setOriginalPrompt(e.target.value)}
          placeholder="What was the original question?"
          className="w-full px-3.5 py-2 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/30 transition-colors"
        />
      </div>

      <div>
        <label className="text-[10px] text-muted-foreground/50 mb-1 block">AI Response to Analyze</label>
        <textarea
          value={response}
          onChange={e => setResponse(e.target.value)}
          placeholder="Paste any AI-generated response here to analyze its quality..."
          className="w-full resize-none bg-card border border-border rounded-xl outline-none text-sm text-foreground p-3 min-h-[120px] max-h-[200px] focus:border-primary/30 transition-colors placeholder:text-muted-foreground/40"
        />
      </div>

      <button
        onClick={analyze}
        disabled={!response.trim() || loading}
        className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-30 flex items-center gap-2"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />}
        {loading ? "Analyzing..." : "Analyze Quality"}
      </button>

      {result && (
        <div className="space-y-4 animate-message-in">
          {/* Overall score */}
          <div className="text-center py-4">
            <div className={cn("text-4xl font-bold", getColor(result.overall))}>{result.overall}</div>
            <div className="text-xs text-muted-foreground mt-1">Overall Quality Score</div>
          </div>

          {/* Dimension bars */}
          <div className="space-y-2.5">
            {([
              { label: "Clarity", value: result.clarity },
              { label: "Accuracy", value: result.accuracy },
              { label: "Completeness", value: result.completeness },
              { label: "Conciseness", value: result.conciseness },
              { label: "Helpfulness", value: result.helpfulness },
            ]).map(d => (
              <div key={d.label} className="flex items-center gap-3">
                <span className="text-[11px] text-muted-foreground w-24 text-right">{d.label}</span>
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                  <div className={cn("h-full rounded-full transition-all duration-700", getBarColor(d.value))} style={{ width: `${d.value * 10}%` }} />
                </div>
                <span className={cn("text-xs font-bold w-8", getColor(d.value))}>{d.value}</span>
              </div>
            ))}
          </div>

          {/* Feedback */}
          {result.feedback && (
            <div className="px-3.5 py-2.5 rounded-xl border border-border/30 bg-card">
              <p className="text-[11px] text-muted-foreground leading-relaxed">{result.feedback}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Latency Bench: Benchmark response times ───

function LatencyBench() {
  const [benchPrompt, setBenchPrompt] = useState("Explain what a closure is in JavaScript in 2 sentences.");
  const [results, setResults] = useState<{ model: string; modelId: ModelId; latencyMs: number; status: "pending" | "running" | "done" | "error" }[]>([]);
  const [running, setRunning] = useState(false);

  const runBenchmark = async () => {
    if (running) return;
    setRunning(true);

    const models = TESTABLE_MODELS;
    const initial = models.map(m => ({ model: m.label, modelId: m.id, latencyMs: 0, status: "pending" as const }));
    setResults(initial);

    for (let i = 0; i < models.length; i++) {
      setResults(prev => prev.map((r, j) => j === i ? { ...r, status: "running" } : r));
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) throw new Error("Not authenticated");

        const start = performance.now();
        const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            messages: [{ role: "user", content: benchPrompt }],
            model: models[i].id,
            enableThinking: false,
          }),
        });

        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        // Read full stream to measure total time
        const reader = resp.body?.getReader();
        if (reader) {
          while (true) {
            const { done } = await reader.read();
            if (done) break;
          }
        }
        const latencyMs = Math.round(performance.now() - start);
        setResults(prev => prev.map((r, j) => j === i ? { ...r, latencyMs, status: "done" } : r));
      } catch {
        setResults(prev => prev.map((r, j) => j === i ? { ...r, status: "error" } : r));
      }
    }
    setRunning(false);
  };

  const maxLatency = Math.max(...results.filter(r => r.status === "done").map(r => r.latencyMs), 1);

  return (
    <div className="p-4 space-y-4">
      <div>
        <label className="text-[10px] text-muted-foreground/50 mb-1 block">Benchmark Prompt</label>
        <input
          value={benchPrompt}
          onChange={e => setBenchPrompt(e.target.value)}
          className="w-full px-3.5 py-2 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/30 transition-colors"
        />
      </div>

      <button
        onClick={runBenchmark}
        disabled={running || !benchPrompt.trim()}
        className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-30 flex items-center gap-2"
      >
        {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
        {running ? "Benchmarking..." : "Run Latency Benchmark"}
      </button>

      {results.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] text-muted-foreground/50 mb-2">Total response time (lower is better)</div>
          {results
            .slice()
            .sort((a, b) => {
              if (a.status !== "done") return 1;
              if (b.status !== "done") return -1;
              return a.latencyMs - b.latencyMs;
            })
            .map((r, i) => (
            <div key={r.modelId} className="flex items-center gap-3">
              <span className="text-[11px] font-medium text-foreground w-28 truncate">{r.model}</span>
              <div className="flex-1 h-5 rounded-lg bg-muted overflow-hidden relative">
                {r.status === "done" && (
                  <div
                    className={cn(
                      "h-full rounded-lg transition-all duration-700",
                      i === 0 ? "bg-green-500" : i === results.length - 1 ? "bg-destructive/60" : "bg-primary/40"
                    )}
                    style={{ width: `${Math.max(5, (r.latencyMs / maxLatency) * 100)}%` }}
                  />
                )}
                {r.status === "running" && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                  </div>
                )}
                {r.status === "pending" && (
                  <div className="absolute inset-0 flex items-center pl-2">
                    <span className="text-[9px] text-muted-foreground/40">waiting…</span>
                  </div>
                )}
                {r.status === "error" && (
                  <div className="absolute inset-0 flex items-center pl-2">
                    <span className="text-[9px] text-destructive">failed</span>
                  </div>
                )}
              </div>
              <span className={cn(
                "text-xs font-mono w-16 text-right",
                r.status === "done" ? "text-foreground" : "text-muted-foreground/40"
              )}>
                {r.status === "done" ? `${(r.latencyMs / 1000).toFixed(1)}s` : "—"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
