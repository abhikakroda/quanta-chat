import { useState, useCallback } from "react";
import { Loader2, Zap, AlertTriangle, Trophy, RotateCcw, Shield, Clock, Users, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

type Choice = { label: string; risk: string };
type Metrics = { morale: number; reputation: number; budget: number; timePressure: number; overall: number };
type HistoryEntry = { round: number; situation: string; decision: string; consequence?: string };
type Finale = { outcome: string; summary: string; lesson: string; grade: string; strengths: string[]; weaknesses: string[] };

const SCENARIOS = [
  { id: "startup-crisis", icon: "🚀", label: "Startup Crisis", desc: "Your startup is burning cash. Investors are calling." },
  { id: "production-bug", icon: "🐛", label: "2 AM Production Bug", desc: "Prod is down. CEO is awake. Users are tweeting." },
  { id: "client-pressure", icon: "😤", label: "Client From Hell", desc: "The client changed scope. Again. Deadline is tomorrow." },
  { id: "design-failure", icon: "🎨", label: "Design Disaster", desc: "The redesign launched. Users hate it. Metrics tanked." },
  { id: "team-conflict", icon: "⚔️", label: "Team Meltdown", desc: "Two senior engineers quit. Sprint deadline is Friday." },
  { id: "security-breach", icon: "🔓", label: "Security Breach", desc: "User data leaked. Press is calling. Board wants answers." },
];

function parseStart(raw: string) {
  const g = (section: string, key: string) => {
    const s = raw.match(new RegExp(`===${section}===([\\s\\S]*?)(?:===|$)`))?.[1] || "";
    return s.match(new RegExp(`${key}:\\s*(.+)`, "i"))?.[1]?.trim() || "";
  };
  const title = g("SCENARIO", "TITLE");
  const setting = g("SCENARIO", "SETTING");
  const stakes = g("SCENARIO", "STAKES");
  const pressure = parseInt(g("SCENARIO", "PRESSURE")) || 7;
  const situation = raw.match(/===SITUATION===\s*([\s\S]*?)===CHOICES/)?.[1]?.trim() || "";
  const choices = parseChoices(raw);
  return { title, setting, stakes, pressure, situation, choices };
}

function parseChoices(raw: string): Choice[] {
  const section = raw.match(/===CHOICES===\s*([\s\S]*?)$/)?.[1] || "";
  const choices: Choice[] = [];
  for (const letter of ["A", "B", "C"]) {
    const label = section.match(new RegExp(`CHOICE_${letter}:\\s*(.+)`, "i"))?.[1]?.trim();
    const risk = section.match(new RegExp(`RISK_${letter}:\\s*(.+)`, "i"))?.[1]?.trim();
    if (label) choices.push({ label, risk: risk || "Unknown" });
  }
  return choices;
}

function parseContinuation(raw: string) {
  const consequence = raw.match(/===CONSEQUENCE===\s*([\s\S]*?)(?:===NEW_SITUATION|===FINALE)/)?.[1]?.trim() || "";

  // Check for finale
  const finaleSection = raw.match(/===FINALE===\s*([\s\S]*?)$/)?.[1];
  if (finaleSection) {
    const gf = (key: string) => finaleSection.match(new RegExp(`${key}:\\s*(.+)`, "i"))?.[1]?.trim() || "";
    const finale: Finale = {
      outcome: gf("OUTCOME"),
      summary: gf("SUMMARY"),
      lesson: gf("KEY_LESSON"),
      grade: gf("PERFORMANCE_GRADE"),
      strengths: gf("STRENGTHS").split(",").map(s => s.trim()).filter(Boolean),
      weaknesses: gf("WEAKNESSES").split(",").map(s => s.trim()).filter(Boolean),
    };
    return { consequence, finale, newSituation: "", choices: [] as Choice[], metrics: null };
  }

  const newSituation = raw.match(/===NEW_SITUATION===\s*([\s\S]*?)===METRICS/)?.[1]?.trim() || "";
  const metricsSection = raw.match(/===METRICS===\s*([\s\S]*?)===CHOICES/)?.[1] || "";
  const gm = (key: string) => parseInt(metricsSection.match(new RegExp(`${key}:\\s*(\\d+)`, "i"))?.[1] || "50");
  const metrics: Metrics = {
    morale: gm("TEAM_MORALE"),
    reputation: gm("REPUTATION"),
    budget: gm("BUDGET_REMAINING"),
    timePressure: gm("TIME_PRESSURE"),
    overall: gm("OVERALL_SCORE"),
  };
  const choices = parseChoices(raw);
  return { consequence, finale: null, newSituation, choices, metrics };
}

function MetricBar({ icon: Icon, label, value }: { icon: typeof Shield; label: string; value: number }) {
  const color = value >= 60 ? "bg-green-500" : value >= 30 ? "bg-amber-500" : "bg-destructive";
  return (
    <div className="flex items-center gap-2">
      <Icon className="w-3 h-3 text-muted-foreground shrink-0" />
      <span className="text-[10px] text-muted-foreground w-14 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full rounded-full transition-all duration-700", color)} style={{ width: `${value}%` }} />
      </div>
      <span className={cn("text-[10px] font-bold w-7 text-right", value >= 60 ? "text-green-500" : value >= 30 ? "text-amber-500" : "text-destructive")}>{value}</span>
    </div>
  );
}

export default function ScenarioSimTool() {
  const [phase, setPhase] = useState<"select" | "playing" | "finale">("select");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [currentSituation, setCurrentSituation] = useState("");
  const [choices, setChoices] = useState<Choice[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [finale, setFinale] = useState<Finale | null>(null);
  const [consequence, setConsequence] = useState<string | null>(null);
  const [round, setRound] = useState(0);

  const callAPI = useCallback(async (body: any) => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) throw new Error("Not authenticated");
    const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scenario-sim`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify(body),
    });
    const result = await resp.json();
    if (result.error) throw new Error(result.error);
    return result.result;
  }, []);

  const startScenario = useCallback(async (scenarioType: string) => {
    setLoading(true);
    setError(null);
    try {
      const raw = await callAPI({ action: "start", scenarioType });
      const parsed = parseStart(raw);
      setTitle(parsed.title);
      setCurrentSituation(parsed.situation);
      setChoices(parsed.choices);
      setHistory([{ round: 1, situation: parsed.situation, decision: "" }]);
      setRound(1);
      setPhase("playing");
      setConsequence(null);
      setMetrics(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [callAPI]);

  const makeDecision = useCallback(async (choiceIndex: number) => {
    if (loading) return;
    const chosen = choices[choiceIndex];
    if (!chosen) return;

    setLoading(true);
    setError(null);

    const updatedHistory = history.map((h, i) =>
      i === history.length - 1 ? { ...h, decision: chosen.label } : h
    );
    setHistory(updatedHistory);

    try {
      const raw = await callAPI({ action: "decide", history: updatedHistory, decision: chosen.label });
      const parsed = parseContinuation(raw);

      setConsequence(parsed.consequence);

      if (parsed.finale) {
        setFinale(parsed.finale);
        setPhase("finale");
      } else {
        setCurrentSituation(parsed.newSituation);
        setChoices(parsed.choices);
        if (parsed.metrics) setMetrics(parsed.metrics);
        const newRound = round + 1;
        setRound(newRound);
        setHistory(prev => [...prev, { round: newRound, situation: parsed.newSituation, decision: "" }]);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [loading, choices, history, round, callAPI]);

  const reset = () => {
    setPhase("select");
    setTitle("");
    setCurrentSituation("");
    setChoices([]);
    setMetrics(null);
    setHistory([]);
    setFinale(null);
    setConsequence(null);
    setRound(0);
    setError(null);
  };

  // Scenario selection
  if (phase === "select") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-4 animate-message-in">
        <div className="text-center space-y-2 mb-8">
          <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-3">
            <Zap className="w-7 h-7 text-destructive" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Scenario Simulator</h2>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Face real-world crises. Make decisions under pressure. See consequences unfold.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg w-full">
          {SCENARIOS.map(s => (
            <button
              key={s.id}
              onClick={() => startScenario(s.id)}
              disabled={loading}
              className="text-left p-4 rounded-xl border border-border/40 bg-card hover:border-primary/30 hover:bg-primary/5 transition-all group"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{s.icon}</span>
                <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{s.label}</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">{s.desc}</p>
            </button>
          ))}
        </div>

        {loading && (
          <div className="mt-6 flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Generating scenario…</span>
          </div>
        )}
        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      </div>
    );
  }

  // Finale screen
  if (phase === "finale" && finale) {
    const gradeColor = finale.grade === "A" ? "text-green-500" : finale.grade === "B" ? "text-primary" : finale.grade === "C" ? "text-amber-500" : "text-destructive";
    const outcomeEmoji = finale.outcome === "success" ? "🏆" : finale.outcome === "partial_success" ? "🥈" : "💀";

    return (
      <div className="flex-1 flex flex-col items-center justify-center px-4 max-w-lg mx-auto animate-message-in">
        <div className="text-center space-y-3 mb-6">
          <span className="text-5xl">{outcomeEmoji}</span>
          <h2 className="text-xl font-bold text-foreground">{title}</h2>
          <div className={cn("text-6xl font-black", gradeColor)}>{finale.grade}</div>
          <p className="text-sm text-muted-foreground">{finale.summary}</p>
        </div>

        {consequence && (
          <div className="w-full rounded-xl border border-border/40 bg-card p-4 mb-4">
            <div className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Final Outcome</div>
            <p className="text-[12px] text-foreground/80 leading-relaxed">{consequence}</p>
          </div>
        )}

        <div className="w-full rounded-xl border border-primary/20 bg-primary/5 p-4 mb-4">
          <div className="text-[10px] font-bold text-primary uppercase mb-1">💡 Key Lesson</div>
          <p className="text-[13px] text-foreground leading-relaxed">{finale.lesson}</p>
        </div>

        <div className="w-full grid grid-cols-2 gap-3 mb-6">
          <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-3">
            <div className="text-[9px] font-bold text-green-500 uppercase mb-1.5">Strengths</div>
            {finale.strengths.map((s, i) => (
              <p key={i} className="text-[11px] text-foreground/70">✓ {s}</p>
            ))}
          </div>
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3">
            <div className="text-[9px] font-bold text-destructive uppercase mb-1.5">Improve</div>
            {finale.weaknesses.map((w, i) => (
              <p key={i} className="text-[11px] text-foreground/70">✗ {w}</p>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={reset} className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium flex items-center gap-2">
            <RotateCcw className="w-3.5 h-3.5" /> New Scenario
          </button>
        </div>
      </div>
    );
  }

  // Active gameplay
  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-border/40 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-destructive" />
          <span className="text-sm font-bold text-foreground truncate max-w-[200px]">{title}</span>
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive">Round {round}</span>
        </div>
        <button onClick={reset} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Quit</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Metrics */}
        {metrics && (
          <div className="rounded-xl border border-border/40 bg-card p-3 space-y-2 animate-message-in">
            <MetricBar icon={Users} label="Morale" value={metrics.morale} />
            <MetricBar icon={Shield} label="Reputation" value={metrics.reputation} />
            <MetricBar icon={Wallet} label="Budget" value={metrics.budget} />
            <MetricBar icon={Clock} label="Urgency" value={metrics.timePressure} />
          </div>
        )}

        {/* Consequence from last decision */}
        {consequence && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 animate-message-in">
            <div className="text-[9px] font-bold text-amber-500 uppercase mb-1.5">⚡ What Happened</div>
            <p className="text-[12px] text-foreground/80 leading-relaxed whitespace-pre-line">{consequence}</p>
          </div>
        )}

        {/* Current situation */}
        <div className="rounded-xl border border-border/40 bg-card p-4 animate-message-in">
          <div className="text-[9px] font-bold text-primary uppercase mb-2">📍 Current Situation</div>
          <p className="text-[13px] text-foreground leading-relaxed whitespace-pre-line">{currentSituation}</p>
        </div>

        {/* Choices */}
        {!loading && choices.length > 0 && (
          <div className="space-y-2 animate-message-in">
            <div className="text-[9px] font-bold text-muted-foreground uppercase">What do you do?</div>
            {choices.map((c, i) => (
              <button
                key={i}
                onClick={() => makeDecision(i)}
                className="w-full text-left p-3 rounded-xl border border-border/40 bg-card hover:border-primary/30 hover:bg-primary/5 transition-all group"
              >
                <div className="flex items-start gap-2">
                  <span className="text-xs font-bold text-primary mt-0.5">{String.fromCharCode(65 + i)}.</span>
                  <div>
                    <p className="text-[13px] font-medium text-foreground group-hover:text-primary transition-colors">{c.label}</p>
                    <p className="text-[10px] text-destructive/60 mt-0.5">⚠ {c.risk}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center gap-2 py-6">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Processing consequences…</span>
          </div>
        )}

        {error && <p className="text-sm text-destructive text-center">{error}</p>}
      </div>
    </div>
  );
}
