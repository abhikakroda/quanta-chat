import { useState, useCallback } from "react";
import { Users, Loader2, Brain, Mic, Sparkles, Target, RotateCcw, Dna, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Tab = "analyze" | "tone-mirror" | "interview-clone" | "future-you" | "predict";

export default function ShadowCloneTool() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("analyze");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [messageCount, setMessageCount] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [copied, setCopied] = useState(false);

  const callClone = useCallback(async (mode: string, extra: Record<string, string> = {}) => {
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/shadow-clone`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ mode, ...extra }),
      });

      const data = await resp.json();

      if (data.error === "insufficient_data") {
        setError(`${data.message} (${data.progress}% ready)`);
        return;
      }
      if (data.error) {
        setError(data.error);
        return;
      }

      setResult(data.result);
      setMessageCount(data.messageCount);
    } catch (err) {
      setError("Failed to reach Shadow Clone service");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const copyResult = () => {
    if (result) {
      navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const tabs: { id: Tab; label: string; icon: typeof Brain; description: string }[] = [
    { id: "analyze", label: "Profile", icon: Dna, description: "Build your digital twin profile" },
    { id: "tone-mirror", label: "Tone Mirror", icon: Mic, description: "AI writes as you" },
    { id: "interview-clone", label: "Interview Clone", icon: Target, description: "Simulates your interview style" },
    { id: "future-you", label: "Future You", icon: Sparkles, description: "6-months-improved version" },
    { id: "predict", label: "Predict", icon: Brain, description: "How you'd respond" },
  ];

  const handleRun = () => {
    switch (tab) {
      case "analyze":
        callClone("analyze");
        break;
      case "tone-mirror":
        callClone("tone-mirror", { topic: input || "Introduce yourself and your interests" });
        break;
      case "interview-clone":
        callClone("interview-clone", { question: input || "Tell me about yourself." });
        break;
      case "future-you":
        callClone("future-you", { topic: input || "How would you explain your expertise?" });
        break;
      case "predict":
        callClone("predict", { question: input || "What do you think about AI?" });
        break;
    }
  };

  const getPlaceholder = () => {
    switch (tab) {
      case "tone-mirror": return "Topic to write about in your style…";
      case "interview-clone": return "Interview question to simulate…";
      case "future-you": return "Question for current vs future you…";
      case "predict": return "What would someone ask you?";
      default: return "";
    }
  };

  const getButtonLabel = () => {
    switch (tab) {
      case "analyze": return "Build My Profile";
      case "tone-mirror": return "Write As Me";
      case "interview-clone": return "Simulate Interview";
      case "future-you": return "Show Future Me";
      case "predict": return "Predict My Response";
    }
  };

  // Parse analyze results for nice display
  const renderAnalysis = (text: string) => {
    const lines = text.split("\n");
    const sections: { label: string; value: string }[] = [];
    
    for (const line of lines) {
      const match = line.match(/^([A-Z_]+):\s*(.+)$/);
      if (match) {
        const label = match[1].replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
        sections.push({ label, value: match[2] });
      }
    }

    if (sections.length === 0) return <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">{text}</p>;

    return (
      <div className="space-y-3">
        {sections.map((s, i) => (
          <div key={i}>
            <div className="text-[10px] font-bold text-primary uppercase tracking-wider mb-0.5">{s.label}</div>
            <p className="text-sm text-foreground/80 leading-relaxed">{s.value}</p>
          </div>
        ))}
      </div>
    );
  };

  // Parse future-you for side-by-side
  const renderFutureYou = (text: string) => {
    const currentMatch = text.match(/\*\*CURRENT YOU\*\*:?\s*([\s\S]*?)(?=\*\*FUTURE YOU|$)/i);
    const futureMatch = text.match(/\*\*FUTURE YOU[^*]*\*\*:?\s*([\s\S]*?)$/i);

    if (!currentMatch && !futureMatch) {
      return <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">{text}</p>;
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-xl border border-border/40 bg-card p-3.5">
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Users className="w-3 h-3" />
            Current You
          </div>
          <p className="text-[13px] text-foreground/70 leading-relaxed whitespace-pre-wrap">{currentMatch?.[1]?.trim() || "—"}</p>
        </div>
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5">
          <div className="text-[10px] font-bold text-primary uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Sparkles className="w-3 h-3" />
            Future You (6 months)
          </div>
          <p className="text-[13px] text-foreground/80 leading-relaxed whitespace-pre-wrap">{futureMatch?.[1]?.trim() || "—"}</p>
        </div>
      </div>
    );
  };

  // Parse predictions
  const renderPredictions = (text: string) => {
    const predictions: { text: string; confidence: string }[] = [];
    for (let i = 1; i <= 3; i++) {
      const pm = text.match(new RegExp(`PREDICTION_${i}:\\s*([\\s\\S]*?)(?=CONFIDENCE_${i}|PREDICTION_${i+1}|$)`, "i"));
      const cm = text.match(new RegExp(`CONFIDENCE_${i}:\\s*(\\d+)`, "i"));
      if (pm) {
        predictions.push({ text: pm[1].trim(), confidence: cm?.[1] || "?" });
      }
    }

    if (predictions.length === 0) return <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">{text}</p>;

    return (
      <div className="space-y-3">
        {predictions.map((p, i) => (
          <div key={i} className="rounded-xl border border-border/40 bg-card p-3.5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold text-muted-foreground uppercase">Prediction {i + 1}</span>
              <span className={cn(
                "text-[10px] font-bold px-2 py-0.5 rounded-full",
                parseInt(p.confidence) >= 70 ? "bg-green-500/10 text-green-500" :
                parseInt(p.confidence) >= 40 ? "bg-amber-500/10 text-amber-500" :
                "bg-muted text-muted-foreground"
              )}>
                {p.confidence}% likely
              </span>
            </div>
            <p className="text-[13px] text-foreground/80 leading-relaxed">{p.text}</p>
          </div>
        ))}
      </div>
    );
  };

  const renderResult = () => {
    if (!result) return null;
    switch (tab) {
      case "analyze": return renderAnalysis(result);
      case "future-you": return renderFutureYou(result);
      case "predict": return renderPredictions(result);
      default: return <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">{result}</p>;
    }
  };

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-border/40">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Users className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              Shadow Clone
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">DIGITAL TWIN</span>
            </h2>
            <p className="text-[10px] text-muted-foreground">
              AI learns your style, predicts your responses, shows your future self
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto pb-0.5">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setResult(null); setError(null); }}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors whitespace-nowrap shrink-0",
                tab === t.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
              )}
            >
              <t.icon className="w-3 h-3" />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Description */}
        <div className="rounded-xl border border-border/30 bg-card px-3.5 py-2.5">
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {tabs.find(t => t.id === tab)?.description}
            {tab === "analyze" && " — Analyzes your messages to build a communication profile."}
            {tab === "tone-mirror" && " — Give it any topic and it writes a response in YOUR exact style."}
            {tab === "interview-clone" && " — Simulates how YOU would answer, showing strengths and gaps."}
            {tab === "future-you" && " — Compares your current answer vs a 6-months-improved version of you."}
            {tab === "predict" && " — Predicts 3 ways you'd likely respond to any question."}
          </p>
        </div>

        {/* Input (not needed for analyze) */}
        {tab !== "analyze" && (
          <div>
            <label className="text-[10px] text-muted-foreground/50 mb-1 block">
              {tab === "tone-mirror" ? "Topic" : "Question"}
            </label>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={getPlaceholder()}
              className="w-full resize-none bg-card border border-border rounded-xl outline-none text-sm text-foreground p-3 min-h-[70px] max-h-[140px] focus:border-primary/30 transition-colors placeholder:text-muted-foreground/40"
            />
          </div>
        )}

        {/* Run button */}
        <button
          onClick={handleRun}
          disabled={loading}
          className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-30 flex items-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
          {loading ? "Building clone..." : getButtonLabel()}
        </button>

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-3.5 py-2.5 animate-message-in">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="animate-message-in space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  {tab === "analyze" ? "Your Digital Profile" : 
                   tab === "tone-mirror" ? "Written As You" :
                   tab === "interview-clone" ? "Your Clone's Answer" :
                   tab === "future-you" ? "Current vs Future" :
                   "Predicted Responses"}
                </span>
                {messageCount && (
                  <span className="text-[9px] text-muted-foreground/50">
                    Based on {messageCount} messages
                  </span>
                )}
              </div>
              <button
                onClick={copyResult}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
                title="Copy"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            <div className="rounded-xl border border-border/30 bg-card p-4">
              {renderResult()}
            </div>

            {/* Interview clone score */}
            {tab === "interview-clone" && result && (() => {
              const scoreMatch = result.match(/CLONE_SCORE:\s*(\d+)/i);
              const feedbackMatch = result.match(/CLONE_FEEDBACK:\s*([\s\S]+)/i);
              if (!scoreMatch) return null;
              const score = parseInt(scoreMatch[1]);
              return (
                <div className="rounded-xl border border-border/30 bg-card p-3.5 space-y-2">
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      "text-lg font-bold",
                      score >= 7 ? "text-green-500" : score >= 5 ? "text-amber-500" : "text-destructive"
                    )}>
                      {score}/10
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {score >= 7 ? "You'd nail this!" : score >= 5 ? "Decent, but room to grow" : "Needs significant work"}
                    </span>
                  </div>
                  {feedbackMatch && (
                    <p className="text-[11px] text-muted-foreground leading-relaxed">{feedbackMatch[1].trim()}</p>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
