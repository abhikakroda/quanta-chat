import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useUserMemories, type UserMemory } from "@/hooks/useUserMemories";
import { useSkillLevel, getRank, getProgressToNext, getNextRank, SKILL_RANKS } from "@/hooks/useSkillLevel";
import { Code2, BookOpen, MessageSquare, Target, TrendingUp, AlertTriangle, CheckCircle2, Brain, Flame } from "lucide-react";

type MetricCard = {
  label: string;
  icon: typeof Code2;
  score: number; // 0-100
  weaknesses: string[];
  color: string;
};

function extractScore(value: string): number {
  const match = value.match(/(\d+(?:\.\d+)?)\s*\/\s*10/);
  if (match) return parseFloat(match[1]) * 10;
  const pctMatch = value.match(/(\d+)%/);
  if (pctMatch) return parseInt(pctMatch[1]);
  return 50;
}

function computeMetrics(memories: UserMemory[]): MetricCard[] {
  // Coding
  const codingMems = memories.filter(m =>
    m.category === "coding_patterns" || (m.category === "weak_topics" && /code|react|js|typescript|python|dsa|algorithm|function|bug|error|loop|array|string|sql/i.test(m.value))
  );
  const codingScores = codingMems.map(m => extractScore(m.value)).filter(s => s !== 50);
  const codingAvg = codingScores.length > 0 ? codingScores.reduce((a, b) => a + b, 0) / codingScores.length : -1;
  const codingWeakness = codingMems.map(m => m.value.replace(/scored.*$/i, "").trim()).filter(Boolean).slice(0, 4);

  // Theory
  const theoryMems = memories.filter(m =>
    m.category === "weak_topics" && /os|network|database|dbms|system|design|process|thread|memory|cache|tcp|http|sql|normalization|deadlock/i.test(m.value)
  );
  const theoryScores = theoryMems.map(m => extractScore(m.value)).filter(s => s !== 50);
  const theoryAvg = theoryScores.length > 0 ? theoryScores.reduce((a, b) => a + b, 0) / theoryScores.length : -1;
  const theoryWeakness = theoryMems.map(m => m.value.replace(/scored.*$/i, "").trim()).filter(Boolean).slice(0, 4);

  // Communication (writing tone, learning style)
  const commMems = memories.filter(m =>
    m.category === "writing_tone" || m.category === "learning_style"
  );
  const commScore = commMems.length > 0 ? Math.min(100, commMems.length * 20 + 40) : -1;
  const commDetails = commMems.map(m => `${m.key}: ${m.value}`).slice(0, 4);

  // Interview performance
  const interviewMems = memories.filter(m => m.category === "interview_performance");
  const interviewScores = interviewMems.map(m => extractScore(m.value)).filter(s => s !== 50);
  const interviewAvg = interviewScores.length > 0 ? interviewScores.reduce((a, b) => a + b, 0) / interviewScores.length : -1;
  const interviewWeakness = interviewMems.map(m => {
    const topicMatch = m.key.match(/interview_(.+?)_/);
    const scoreMatch = m.value.match(/Score:\s*(\d+(?:\.\d+)?)/);
    return topicMatch && scoreMatch ? `${topicMatch[1]}: ${scoreMatch[1]}/10` : m.value;
  }).slice(0, 4);

  return [
    {
      label: "Coding",
      icon: Code2,
      score: codingAvg >= 0 ? Math.round(codingAvg) : -1,
      weaknesses: codingWeakness,
      color: "hsl(210 70% 55%)",
    },
    {
      label: "Theory",
      icon: BookOpen,
      score: theoryAvg >= 0 ? Math.round(theoryAvg) : -1,
      weaknesses: theoryWeakness,
      color: "hsl(270 60% 55%)",
    },
    {
      label: "Communication",
      icon: MessageSquare,
      score: commScore,
      weaknesses: commDetails,
      color: "hsl(140 50% 45%)",
    },
    {
      label: "Interview Ready",
      icon: Target,
      score: interviewAvg >= 0 ? Math.round(interviewAvg) : -1,
      weaknesses: interviewWeakness,
      color: "hsl(45 90% 50%)",
    },
  ];
}

function getScoreLabel(score: number): { text: string; color: string } {
  if (score < 0) return { text: "No data", color: "text-muted-foreground/40" };
  if (score >= 80) return { text: "Strong", color: "text-green-500" };
  if (score >= 60) return { text: "Decent", color: "text-yellow-500" };
  if (score >= 40) return { text: "Weak", color: "text-orange-500" };
  return { text: "Critical", color: "text-destructive" };
}

function HeatCell({ value }: { value: number }) {
  if (value < 0) return (
    <div className="w-full h-3 rounded-full bg-muted/50" />
  );
  const hue = value >= 70 ? 140 : value >= 50 ? 45 : value >= 30 ? 25 : 0;
  const sat = value >= 70 ? 50 : 60;
  const light = 50;
  return (
    <div className="w-full h-3 rounded-full bg-muted/50 overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-1000 ease-out"
        style={{
          width: `${Math.max(4, value)}%`,
          background: `hsl(${hue} ${sat}% ${light}%)`,
        }}
      />
    </div>
  );
}

export default function WeaknessHeatmapTool() {
  const { user } = useAuth();
  const { memories, loading } = useUserMemories(user?.id);
  const { skills } = useSkillLevel(user?.id);

  const metrics = useMemo(() => computeMetrics(memories), [memories]);

  const allWeakTopics = useMemo(() =>
    memories
      .filter(m => m.category === "weak_topics")
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 8),
    [memories]
  );

  const rank = skills ? getRank(skills.xp) : SKILL_RANKS[0];
  const nextRank = skills ? getNextRank(skills.xp) : SKILL_RANKS[1];
  const progress = skills ? getProgressToNext(skills.xp) : 0;

  const overallScore = useMemo(() => {
    const valid = metrics.filter(m => m.score >= 0);
    if (valid.length === 0) return -1;
    return Math.round(valid.reduce((s, m) => s + m.score, 0) / valid.length);
  }, [metrics]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="text-sm text-muted-foreground animate-pulse">Loading dashboard…</span>
      </div>
    );
  }

  const hasData = memories.length > 0;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Brain className="w-5 h-5 text-primary" />
              Skill Heatmap
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">AI-powered weakness analysis from your activity</p>
          </div>
          {overallScore >= 0 && (
            <div className="text-right">
              <div className="text-2xl font-bold text-foreground">{overallScore}%</div>
              <div className={cn("text-[10px] font-medium", getScoreLabel(overallScore).color)}>
                {getScoreLabel(overallScore).text}
              </div>
            </div>
          )}
        </div>

        {/* Rank bar */}
        {skills && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-card border border-border/40">
            <span className="text-2xl">{rank.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-foreground">{rank.name}</span>
                <span className="text-xs text-muted-foreground font-mono">{skills.xp} XP</span>
              </div>
              <div className="mt-1.5 h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${progress}%`, background: rank.color }}
                />
              </div>
              {nextRank && (
                <p className="text-[10px] text-muted-foreground/50 mt-1">{nextRank.minXP - skills.xp} XP to {nextRank.icon} {nextRank.name}</p>
              )}
            </div>
          </div>
        )}

        {!hasData ? (
          <div className="text-center py-12 space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto">
              <Target className="w-8 h-8 text-muted-foreground/30" />
            </div>
            <h3 className="text-sm font-medium text-foreground">No data yet</h3>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto">
              Use the Tutor Mode, Interview Simulator, or chat to build your skill profile. The dashboard will populate as the AI learns about you.
            </p>
          </div>
        ) : (
          <>
            {/* Heatmap cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {metrics.map((metric) => {
                const label = getScoreLabel(metric.score);
                return (
                  <div
                    key={metric.label}
                    className="px-4 py-3.5 rounded-2xl bg-card border border-border/40 space-y-2.5 hover:shadow-elegant transition-shadow"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-8 h-8 rounded-xl flex items-center justify-center"
                          style={{ background: `${metric.color}15` }}
                        >
                          <metric.icon className="w-4 h-4" style={{ color: metric.color }} />
                        </div>
                        <span className="text-sm font-semibold text-foreground">{metric.label}</span>
                      </div>
                      <div className="text-right">
                        {metric.score >= 0 ? (
                          <span className="text-lg font-bold text-foreground">{metric.score}%</span>
                        ) : (
                          <span className="text-xs text-muted-foreground/40">—</span>
                        )}
                      </div>
                    </div>

                    <HeatCell value={metric.score} />

                    <div className={cn("text-[10px] font-medium", label.color)}>{label.text}</div>

                    {metric.weaknesses.length > 0 && (
                      <div className="space-y-1 pt-1 border-t border-border/30">
                        {metric.weaknesses.map((w, i) => (
                          <div key={i} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                            <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5 text-orange-400" />
                            <span className="line-clamp-2">{w}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* All weak topics list */}
            {allWeakTopics.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Flame className="w-4 h-4 text-orange-400" />
                  Weak Areas to Improve
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {allWeakTopics.map((m) => {
                    const score = extractScore(m.value);
                    return (
                      <div
                        key={m.id}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-card border border-border/40"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-medium text-foreground truncate">{m.key.replace(/^weak_/, "").replace(/_/g, " ")}</p>
                          <p className="text-[10px] text-muted-foreground truncate mt-0.5">{m.value}</p>
                        </div>
                        {score !== 50 && (
                          <span className={cn(
                            "text-xs font-bold shrink-0",
                            score >= 60 ? "text-yellow-500" : "text-destructive"
                          )}>
                            {Math.round(score / 10)}/10
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Activity stats */}
            {skills && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  Activity Stats
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "Messages", value: skills.messages_sent, icon: MessageSquare },
                    { label: "Tools Used", value: skills.tools_used, icon: Code2 },
                    { label: "Interviews", value: skills.interviews_completed, icon: Target },
                  ].map(stat => (
                    <div key={stat.label} className="px-3 py-3 rounded-xl bg-card border border-border/40 text-center">
                      <stat.icon className="w-4 h-4 mx-auto text-muted-foreground/50 mb-1" />
                      <div className="text-lg font-bold text-foreground">{stat.value}</div>
                      <div className="text-[10px] text-muted-foreground">{stat.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendations */}
            <div className="px-4 py-3 rounded-2xl bg-primary/5 border border-primary/10 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary" />
                Recommended Next Steps
              </h3>
              <ul className="space-y-1.5">
                {metrics.filter(m => m.score >= 0 && m.score < 60).map(m => (
                  <li key={m.label} className="text-[12px] text-muted-foreground flex items-start gap-2">
                    <span className="text-primary mt-0.5">→</span>
                    Focus on <span className="font-medium text-foreground">{m.label}</span> — currently at {m.score}%. Try Tutor Mode or Interview Sim to improve.
                  </li>
                ))}
                {metrics.filter(m => m.score < 0).map(m => (
                  <li key={m.label} className="text-[12px] text-muted-foreground flex items-start gap-2">
                    <span className="text-primary mt-0.5">→</span>
                    Start building your <span className="font-medium text-foreground">{m.label}</span> profile — no data yet.
                  </li>
                ))}
                {metrics.every(m => m.score >= 60) && metrics.every(m => m.score >= 0) && (
                  <li className="text-[12px] text-muted-foreground flex items-start gap-2">
                    <span className="text-primary mt-0.5">→</span>
                    Great progress! Keep pushing to reach <span className="font-medium text-foreground">80%+ across all areas</span>.
                  </li>
                )}
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
