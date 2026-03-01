import { useState, useCallback } from "react";
import { TrendingUp, Loader2, Target, AlertTriangle, Route, BarChart3, Shield, Zap, Clock, ArrowRight, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type SkillGap = { skill: string; current: number; required: number; priority: string; time: string };
type Market = { difficulty: number; competition: string; salaryRange: string; demandTrend: string; openings: string; summary: string };
type Probability = { m6: number; y1: number; y2: number; factorsFor: string[]; factorsAgainst: string[] };
type Alternative = { title: string; companies: string; difficulty: number; salary: string; why: string };
type Risk = { best: string; likely: string; worst: string; pivot: string };
type Roadmap = { m1_3: string; m4_6: string; m7_12: string; y2: string };

type ProjectionData = {
  skillGaps: SkillGap[];
  market: Market;
  probability: Probability;
  alternatives: Alternative[];
  risk: Risk;
  roadmap: Roadmap;
};

function parseProjection(raw: string): ProjectionData | null {
  try {
    // Parse skill gaps
    const skillSection = raw.match(/===SKILL_GAPS===([\s\S]*?)===MARKET/)?.[1] || "";
    const skillBlocks = skillSection.split("---").filter(s => s.trim());
    const skillGaps: SkillGap[] = skillBlocks.map(block => {
      const g = (key: string) => block.match(new RegExp(`${key}:\\s*(.+)`, "i"))?.[1]?.trim() || "";
      return {
        skill: g("SKILL"),
        current: parseInt(g("CURRENT")) || 0,
        required: parseInt(g("REQUIRED")) || 80,
        priority: g("PRIORITY").toLowerCase(),
        time: g("TIME"),
      };
    }).filter(s => s.skill);

    // Parse market
    const marketSection = raw.match(/===MARKET_ANALYSIS===([\s\S]*?)===PROB/)?.[1] || "";
    const gm = (key: string) => marketSection.match(new RegExp(`${key}:\\s*(.+)`, "i"))?.[1]?.trim() || "";
    const market: Market = {
      difficulty: parseInt(gm("DIFFICULTY")) || 50,
      competition: gm("COMPETITION"),
      salaryRange: gm("SALARY_RANGE"),
      demandTrend: gm("DEMAND_TREND"),
      openings: gm("OPENINGS_ESTIMATE"),
      summary: gm("MARKET_SUMMARY"),
    };

    // Parse probability
    const probSection = raw.match(/===PROBABILITY===([\s\S]*?)===ALT/)?.[1] || "";
    const gp = (key: string) => probSection.match(new RegExp(`${key}:\\s*(.+)`, "i"))?.[1]?.trim() || "";
    const probability: Probability = {
      m6: parseInt(gp("PROBABILITY_6M")) || 10,
      y1: parseInt(gp("PROBABILITY_1Y")) || 30,
      y2: parseInt(gp("PROBABILITY_2Y")) || 50,
      factorsFor: gp("FACTORS_FOR").split(",").map(s => s.trim()).filter(Boolean),
      factorsAgainst: gp("FACTORS_AGAINST").split(",").map(s => s.trim()).filter(Boolean),
    };

    // Parse alternatives
    const altSection = raw.match(/===ALTERNATIVES===([\s\S]*?)===RISK/)?.[1] || "";
    const altBlocks = altSection.split("---").filter(s => s.trim());
    const alternatives: Alternative[] = altBlocks.map(block => {
      const ga = (key: string) => block.match(new RegExp(`${key}:\\s*(.+)`, "i"))?.[1]?.trim() || "";
      return {
        title: ga("ALT_TITLE"),
        companies: ga("ALT_COMPANY_TYPES"),
        difficulty: parseInt(ga("ALT_DIFFICULTY")) || 50,
        salary: ga("ALT_SALARY"),
        why: ga("ALT_WHY"),
      };
    }).filter(a => a.title);

    // Parse risk
    const riskSection = raw.match(/===RISK_SIMULATION===([\s\S]*?)===ROAD/)?.[1] || "";
    const gr = (key: string) => riskSection.match(new RegExp(`${key}:\\s*(.+)`, "i"))?.[1]?.trim() || "";
    const risk: Risk = {
      best: gr("BEST_CASE"),
      likely: gr("LIKELY_CASE"),
      worst: gr("WORST_CASE"),
      pivot: gr("PIVOT_TRIGGER"),
    };

    // Parse roadmap
    const roadSection = raw.match(/===ROADMAP===([\s\S]*?)$/)?.[1] || "";
    const grd = (key: string) => roadSection.match(new RegExp(`${key}:\\s*(.+)`, "i"))?.[1]?.trim() || "";
    const roadmap: Roadmap = {
      m1_3: grd("MONTH_1_3"),
      m4_6: grd("MONTH_4_6"),
      m7_12: grd("MONTH_7_12"),
      y2: grd("YEAR_2"),
    };

    return { skillGaps, market, probability, alternatives, risk, roadmap };
  } catch {
    return null;
  }
}

function SkillBar({ skill, current, required, priority }: SkillGap) {
  const gap = required - current;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-medium text-foreground">{skill}</span>
        <div className="flex items-center gap-2">
          <span className={cn(
            "text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase",
            priority === "critical" ? "bg-destructive/10 text-destructive" :
            priority === "high" ? "bg-amber-500/10 text-amber-500" :
            "bg-muted text-muted-foreground"
          )}>{priority}</span>
          <span className="text-[10px] text-muted-foreground">{gap > 0 ? `+${gap}% needed` : "✓"}</span>
        </div>
      </div>
      <div className="relative h-2 rounded-full bg-muted overflow-hidden">
        <div className="absolute inset-0 h-full rounded-full bg-muted-foreground/10" style={{ width: `${required}%` }} />
        <div className={cn(
          "absolute inset-0 h-full rounded-full transition-all duration-700",
          current >= required ? "bg-green-500" : current >= required * 0.6 ? "bg-amber-500" : "bg-destructive"
        )} style={{ width: `${current}%` }} />
      </div>
    </div>
  );
}

function ProbabilityGauge({ label, value }: { label: string; value: number }) {
  const color = value >= 60 ? "text-green-500" : value >= 30 ? "text-amber-500" : "text-destructive";
  const bgColor = value >= 60 ? "bg-green-500" : value >= 30 ? "bg-amber-500" : "bg-destructive";
  return (
    <div className="text-center">
      <div className="relative w-16 h-16 mx-auto mb-1">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
          <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="3" className="text-muted/50" />
          <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="3"
            className={color}
            strokeDasharray={`${value * 0.942} 100`}
            strokeLinecap="round"
          />
        </svg>
        <span className={cn("absolute inset-0 flex items-center justify-center text-sm font-bold", color)}>
          {value}%
        </span>
      </div>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
}

export default function FutureProjectionTool() {
  const { user } = useAuth();
  const [goal, setGoal] = useState("");
  const [currentSkills, setCurrentSkills] = useState("");
  const [experience, setExperience] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ProjectionData | null>(null);
  const [rawResult, setRawResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>("skills");

  const toggleSection = (id: string) => setExpandedSection(prev => prev === id ? null : id);

  const analyze = useCallback(async () => {
    if (!goal.trim() || loading) return;
    setLoading(true);
    setData(null);
    setError(null);
    setRawResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/career-projection`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ goal, currentSkills, experience }),
      });

      const result = await resp.json();
      if (result.error) { setError(result.error); return; }

      setRawResult(result.result);
      const parsed = parseProjection(result.result);
      if (parsed) setData(parsed);
      else setError("Failed to parse projection. Raw result saved.");
    } catch (err) {
      setError("Failed to generate projection");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [goal, currentSkills, experience, loading]);

  // Setup screen
  if (!data && !loading) {
    return (
      <div className="max-w-lg mx-auto p-4 space-y-6 flex flex-col items-center justify-center h-full animate-message-in">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <TrendingUp className="w-7 h-7 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Future Projection Engine</h2>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            Enter your career goal. AI analyzes skill gaps, market difficulty, probability, risks, and alternative paths.
          </p>
        </div>

        <div className="w-full max-w-md space-y-3">
          <div>
            <label className="text-[10px] text-muted-foreground/50 mb-1 block">Career Goal *</label>
            <input
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder='e.g. "Embedded Engineer at NVIDIA"'
              className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/30 transition-colors"
            />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground/50 mb-1 block">Current Skills (optional)</label>
            <input
              value={currentSkills}
              onChange={(e) => setCurrentSkills(e.target.value)}
              placeholder="e.g. C, Python, basic RTOS, Arduino"
              className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/30 transition-colors"
            />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground/50 mb-1 block">Experience (optional)</label>
            <input
              value={experience}
              onChange={(e) => setExperience(e.target.value)}
              placeholder="e.g. 2 YOE in IoT development, B.Tech ECE"
              className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/30 transition-colors"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <button
            onClick={analyze}
            disabled={!goal.trim()}
            className="w-full px-4 py-3 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-30 flex items-center justify-center gap-2"
          >
            <TrendingUp className="w-4 h-4" />
            Generate Career Projection
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 animate-fade-in">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">Analyzing career path…</p>
          <p className="text-[11px] text-muted-foreground mt-1">Scanning skill gaps, market data, and risk factors</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-4 text-center">
        <p className="text-sm text-destructive">{error || "Failed to parse results"}</p>
        {rawResult && (
          <pre className="mt-4 text-xs text-muted-foreground whitespace-pre-wrap text-left bg-muted p-4 rounded-xl overflow-auto max-h-[400px]">{rawResult}</pre>
        )}
        <button onClick={() => { setData(null); setRawResult(null); setError(null); }} className="mt-4 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm">
          Try Again
        </button>
      </div>
    );
  }

  const SectionHeader = ({ id, icon: Icon, title, badge }: { id: string; icon: typeof Target; title: string; badge?: string }) => (
    <button
      onClick={() => toggleSection(id)}
      className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
    >
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold text-foreground">{title}</span>
        {badge && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">{badge}</span>}
      </div>
      {expandedSection === id ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
    </button>
  );

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-border/40 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          <span className="text-sm font-bold text-foreground truncate max-w-[250px]">{goal}</span>
        </div>
        <button onClick={() => { setData(null); setRawResult(null); }} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          New Goal
        </button>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-border/30">
        {/* Probability */}
        <div>
          <SectionHeader id="prob" icon={Target} title="Success Probability" />
          {expandedSection === "prob" && (
            <div className="px-4 pb-4 animate-message-in">
              <div className="flex justify-around py-3">
                <ProbabilityGauge label="6 Months" value={data.probability.m6} />
                <ProbabilityGauge label="1 Year" value={data.probability.y1} />
                <ProbabilityGauge label="2 Years" value={data.probability.y2} />
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="rounded-lg bg-green-500/5 border border-green-500/10 p-2.5">
                  <div className="text-[9px] font-bold text-green-500 uppercase mb-1.5">Working For You</div>
                  {data.probability.factorsFor.map((f, i) => (
                    <p key={i} className="text-[11px] text-foreground/70 leading-relaxed">✓ {f}</p>
                  ))}
                </div>
                <div className="rounded-lg bg-destructive/5 border border-destructive/10 p-2.5">
                  <div className="text-[9px] font-bold text-destructive uppercase mb-1.5">Against You</div>
                  {data.probability.factorsAgainst.map((f, i) => (
                    <p key={i} className="text-[11px] text-foreground/70 leading-relaxed">✗ {f}</p>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Skill Gaps */}
        <div>
          <SectionHeader id="skills" icon={Zap} title="Skill Gap Analysis" badge={`${data.skillGaps.length} gaps`} />
          {expandedSection === "skills" && (
            <div className="px-4 pb-4 space-y-3 animate-message-in">
              {data.skillGaps.map((sg, i) => (
                <SkillBar key={i} {...sg} />
              ))}
            </div>
          )}
        </div>

        {/* Market */}
        <div>
          <SectionHeader id="market" icon={BarChart3} title="Market Analysis" badge={data.market.competition} />
          {expandedSection === "market" && (
            <div className="px-4 pb-4 animate-message-in">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                <div className="rounded-xl bg-card border border-border/40 p-2.5 text-center">
                  <div className={cn("text-lg font-bold", data.market.difficulty >= 70 ? "text-destructive" : data.market.difficulty >= 40 ? "text-amber-500" : "text-green-500")}>
                    {data.market.difficulty}
                  </div>
                  <div className="text-[9px] text-muted-foreground">Difficulty</div>
                </div>
                <div className="rounded-xl bg-card border border-border/40 p-2.5 text-center">
                  <div className="text-xs font-bold text-foreground">{data.market.salaryRange}</div>
                  <div className="text-[9px] text-muted-foreground">Salary Range</div>
                </div>
                <div className="rounded-xl bg-card border border-border/40 p-2.5 text-center">
                  <div className={cn("text-xs font-bold", data.market.demandTrend === "booming" || data.market.demandTrend === "growing" ? "text-green-500" : "text-amber-500")}>
                    {data.market.demandTrend}
                  </div>
                  <div className="text-[9px] text-muted-foreground">Demand</div>
                </div>
                <div className="rounded-xl bg-card border border-border/40 p-2.5 text-center">
                  <div className="text-xs font-bold text-foreground">{data.market.openings}</div>
                  <div className="text-[9px] text-muted-foreground">Openings/mo</div>
                </div>
              </div>
              {data.market.summary && (
                <p className="text-[11px] text-muted-foreground leading-relaxed">{data.market.summary}</p>
              )}
            </div>
          )}
        </div>

        {/* Risk Simulation */}
        <div>
          <SectionHeader id="risk" icon={AlertTriangle} title="Risk Simulation" />
          {expandedSection === "risk" && (
            <div className="px-4 pb-4 space-y-2 animate-message-in">
              {[
                { label: "Best Case 🟢", text: data.risk.best, cls: "border-green-500/20 bg-green-500/5" },
                { label: "Likely Case 🟡", text: data.risk.likely, cls: "border-amber-500/20 bg-amber-500/5" },
                { label: "Worst Case 🔴", text: data.risk.worst, cls: "border-destructive/20 bg-destructive/5" },
              ].map(r => (
                <div key={r.label} className={cn("rounded-xl border p-3", r.cls)}>
                  <div className="text-[10px] font-bold text-foreground mb-1">{r.label}</div>
                  <p className="text-[12px] text-foreground/70 leading-relaxed">{r.text}</p>
                </div>
              ))}
              {data.risk.pivot && (
                <div className="rounded-xl border border-border/30 bg-card p-3">
                  <div className="text-[10px] font-bold text-muted-foreground mb-1">⚡ Pivot Trigger</div>
                  <p className="text-[12px] text-foreground/70">{data.risk.pivot}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Alternatives */}
        <div>
          <SectionHeader id="alt" icon={Route} title="Alternative Paths" badge={`${data.alternatives.length}`} />
          {expandedSection === "alt" && (
            <div className="px-4 pb-4 space-y-2 animate-message-in">
              {data.alternatives.map((alt, i) => (
                <div key={i} className="rounded-xl border border-border/40 bg-card p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[13px] font-bold text-foreground">{alt.title}</span>
                    <span className={cn(
                      "text-[9px] font-bold px-1.5 py-0.5 rounded-full",
                      alt.difficulty < 50 ? "bg-green-500/10 text-green-500" : "bg-amber-500/10 text-amber-500"
                    )}>
                      Difficulty: {alt.difficulty}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{alt.companies} • {alt.salary}</p>
                  <p className="text-[11px] text-foreground/60 mt-1">{alt.why}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Roadmap */}
        <div>
          <SectionHeader id="roadmap" icon={Clock} title="Action Roadmap" />
          {expandedSection === "roadmap" && (
            <div className="px-4 pb-4 animate-message-in">
              <div className="relative pl-6 space-y-4">
                <div className="absolute left-2 top-1 bottom-1 w-0.5 bg-primary/20" />
                {[
                  { label: "Months 1–3", text: data.roadmap.m1_3 },
                  { label: "Months 4–6", text: data.roadmap.m4_6 },
                  { label: "Months 7–12", text: data.roadmap.m7_12 },
                  { label: "Year 2", text: data.roadmap.y2 },
                ].map((phase, i) => (
                  <div key={i} className="relative">
                    <div className="absolute -left-[18px] top-0.5 w-3 h-3 rounded-full bg-primary border-2 border-background" />
                    <div className="text-[10px] font-bold text-primary uppercase mb-0.5">{phase.label}</div>
                    <p className="text-[12px] text-foreground/70 leading-relaxed">{phase.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
