import { useState, useRef, useCallback } from "react";
import { AlertTriangle, Play, RotateCcw, Loader2, ArrowRight, Trophy, ThumbsDown, Shield, Zap, XCircle, Target, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const SCENARIOS = [
  {
    label: "💼 Job Interview Rejection",
    description: "Survive brutal HR rejection scenarios",
    rounds: [
      { type: "pressure" as const, prompt: "You're interviewing a candidate. Start with an extremely tough behavioral question that catches most people off guard. Be professional but intimidating. Ask ONE question only." },
      { type: "rejection" as const, prompt: "The candidate just answered your question. Now simulate a REJECTION scenario: Tell them their answer was weak, point out specific flaws, and ask a devastating follow-up that tests their composure. Be realistic — this is how tough interviewers actually behave." },
      { type: "stress" as const, prompt: "Now do a STRESS TEST: Ask a completely unexpected curveball question — something that seems unfair, tests lateral thinking, and puts maximum pressure. Examples: 'Why shouldn't we hire you?', 'Your resume has a gap — explain.', 'Your last boss says you're difficult to work with — respond.'" },
      { type: "final" as const, prompt: "Final round: Ask the hardest, most uncomfortable question you can think of for this interview. Something that truly separates average candidates from exceptional ones. Then after their response, give a BRUTAL but constructive assessment of their entire performance." },
    ],
  },
  {
    label: "📞 Startup Pitch Destruction",
    description: "Face VC investors who tear apart your pitch",
    rounds: [
      { type: "pressure" as const, prompt: "You're a skeptical VC investor. The founder just pitched their startup. Ask the most devastating 'why will this fail?' question. Be blunt — VCs don't sugarcoat. ONE question." },
      { type: "rejection" as const, prompt: "The founder answered. Now tear their answer apart: find holes in their logic, question their market size assumptions, challenge their moat. Ask why you shouldn't just give this money to their competitor instead." },
      { type: "stress" as const, prompt: "Now hit them with a curveball: question their personal capability. 'Have you ever built anything that actually scaled?', 'Your team looks weak for this problem', or 'What happens when Google copies this in 6 months?'" },
      { type: "final" as const, prompt: "Final: Give them the dreaded 'We're passing' speech. Explain exactly why you're not investing. Then break character and give genuine constructive feedback on how they could improve their pitch." },
    ],
  },
  {
    label: "⚖️ Legal Cross-Examination",
    description: "Handle hostile cross-examination like a lawyer",
    rounds: [
      { type: "pressure" as const, prompt: "You're a hostile opposing counsel. Cross-examine the witness with a trap question — something that seems simple but is designed to get a damaging admission. Be aggressive but legal." },
      { type: "rejection" as const, prompt: "The witness answered. Now impeach their credibility: find contradictions, challenge their expertise, suggest bias. Use classic courtroom pressure tactics." },
      { type: "stress" as const, prompt: "Now use the 'isn't it true' rapid-fire technique: Hit them with 3 quick statements they have to respond to, each designed to back them into a corner." },
      { type: "final" as const, prompt: "Final: Deliver your most devastating line of questioning, then break character and score their performance as a witness/advocate. What did they handle well? Where did they crack?" },
    ],
  },
  {
    label: "🎓 UPSC Panel Grilling",
    description: "Face the toughest civil services interview panel",
    rounds: [
      { type: "pressure" as const, prompt: "You're a senior UPSC interview panelist. Ask a deceptively simple question about current affairs that actually requires deep analytical thinking. The kind that separates IAS officers from the rest." },
      { type: "rejection" as const, prompt: "Challenge their answer aggressively. Point out they missed key nuances, their analysis was surface-level, and a real administrator can't afford such shallow thinking. Ask a follow-up that demands first-principles reasoning." },
      { type: "stress" as const, prompt: "Now test their ethics and composure: Present an impossible ethical dilemma — the kind where every answer has trade-offs. There's no 'right' answer, only how well they reason through it." },
      { type: "final" as const, prompt: "Final: Ask them to defend a position they clearly disagree with. Then rate their overall IAS readiness on a 1-10 scale with specific areas to improve." },
    ],
  },
];

type RoundResult = {
  roundIdx: number;
  type: "pressure" | "rejection" | "stress" | "final";
  aiChallenge: string;
  userResponse: string;
  aiFeedback: string;
  score: number | null;
  status: "ai_challenging" | "user_turn" | "ai_evaluating" | "scored";
};

export default function FailureSimulatorTool() {
  const { user } = useAuth();
  const [selectedScenario, setSelectedScenario] = useState<number | null>(null);
  const [context, setContext] = useState("");
  const [started, setStarted] = useState(false);
  const [rounds, setRounds] = useState<RoundResult[]>([]);
  const [currentResponse, setCurrentResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [finished, setFinished] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }), 100);
  };

  const callAI = useCallback(async (prompt: string): Promise<string> => {
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
        messages: [{ role: "user", content: prompt }],
        model: "mistral",
        enableThinking: false,
        skillPrompt: "You are a ruthless but fair evaluator and simulator. You create realistic high-pressure scenarios. You don't hold back, but your feedback is always constructive underneath the intensity. Be specific and realistic.",
      }),
    });

    if (!resp.ok) throw new Error("AI request failed");
    const reader = resp.body?.getReader();
    if (!reader) throw new Error("No response");
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
    return full.trim();
  }, []);

  const startSimulation = async () => {
    if (selectedScenario === null) return;
    const scenario = SCENARIOS[selectedScenario];
    setStarted(true);
    setRounds([]);
    setFinished(false);
    setLoading(true);

    try {
      const contextLine = context.trim() ? `\n\nContext from user: "${context.trim()}"` : "";
      const challenge = await callAI(`${scenario.rounds[0].prompt}${contextLine}`);

      setRounds([{
        roundIdx: 0,
        type: scenario.rounds[0].type,
        aiChallenge: challenge,
        userResponse: "",
        aiFeedback: "",
        score: null,
        status: "user_turn",
      }]);
      scrollToBottom();
      setTimeout(() => textareaRef.current?.focus(), 300);
    } catch (err) {
      console.error("Failed to start simulation:", err);
    } finally {
      setLoading(false);
    }
  };

  const submitResponse = async () => {
    if (!currentResponse.trim() || loading || selectedScenario === null) return;
    const scenario = SCENARIOS[selectedScenario];
    const response = currentResponse;
    setCurrentResponse("");
    const roundIdx = rounds.length - 1;

    setRounds(prev => prev.map((r, i) =>
      i === roundIdx ? { ...r, userResponse: response, status: "ai_evaluating" as const } : r
    ));
    setLoading(true);
    scrollToBottom();

    try {
      const history = rounds.map(r =>
        `Challenge: ${r.aiChallenge}\nResponse: ${r.userResponse || "(pending)"}`
      ).join("\n\n");

      // Score the response
      const scorePrompt = `You are evaluating a response in a high-pressure simulation.

Scenario: ${scenario.label}
Round: ${rounds[roundIdx].type.toUpperCase()}

Challenge given: "${rounds[roundIdx].aiChallenge}"
User's response: "${response}"

Rate their response:
COMPOSURE: [1-10] (did they stay calm and professional?)
SUBSTANCE: [1-10] (was the content strong and well-reasoned?)
RECOVERY: [1-10] (did they handle the pressure well?)
FEEDBACK: [2-3 sentences — what was strong, what cracked, what to improve]

Output EXACTLY in this format.`;

      const scoreResult = await callAI(scorePrompt);

      let composure = 5, substance = 5, recovery = 5;
      let feedback = "";
      const cm = scoreResult.match(/COMPOSURE:\s*(\d+)/i);
      const sm = scoreResult.match(/SUBSTANCE:\s*(\d+)/i);
      const rm = scoreResult.match(/RECOVERY:\s*(\d+)/i);
      const fm = scoreResult.match(/FEEDBACK:\s*([\s\S]+)/i);

      if (cm) composure = Math.min(10, Math.max(1, parseInt(cm[1])));
      if (sm) substance = Math.min(10, Math.max(1, parseInt(sm[1])));
      if (rm) recovery = Math.min(10, Math.max(1, parseInt(rm[1])));
      if (fm) feedback = fm[1].trim();

      const avgScore = Math.round((composure + substance + recovery) / 3 * 10) / 10;

      // Get next challenge if not final round
      const nextRoundIdx = roundIdx + 1;
      const isLast = nextRoundIdx >= scenario.rounds.length;

      let nextChallenge = "";
      if (!isLast) {
        const nextPrompt = `${scenario.rounds[nextRoundIdx].prompt}\n\nPrevious exchange:\n${history}\nLatest response: "${response}"`;
        nextChallenge = await callAI(nextPrompt);
      }

      setRounds(prev => {
        const updated = prev.map((r, i) =>
          i === roundIdx ? {
            ...r,
            userResponse: response,
            aiFeedback: feedback,
            score: avgScore,
            status: "scored" as const,
          } : r
        );

        if (!isLast && nextChallenge) {
          updated.push({
            roundIdx: nextRoundIdx,
            type: scenario.rounds[nextRoundIdx].type,
            aiChallenge: nextChallenge,
            userResponse: "",
            aiFeedback: "",
            score: null,
            status: "user_turn",
          });
        }

        return updated;
      });

      if (isLast) setFinished(true);
      scrollToBottom();
      if (!isLast) setTimeout(() => textareaRef.current?.focus(), 300);
    } catch (err) {
      console.error("Round failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setStarted(false);
    setRounds([]);
    setCurrentResponse("");
    setFinished(false);
    setContext("");
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "pressure": return <Target className="w-3 h-3" />;
      case "rejection": return <XCircle className="w-3 h-3" />;
      case "stress": return <Zap className="w-3 h-3" />;
      case "final": return <AlertTriangle className="w-3 h-3" />;
      default: return null;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "pressure": return "text-amber-500 bg-amber-500/10 border-amber-500/20";
      case "rejection": return "text-red-500 bg-red-500/10 border-red-500/20";
      case "stress": return "text-orange-500 bg-orange-500/10 border-orange-500/20";
      case "final": return "text-destructive bg-destructive/10 border-destructive/20";
      default: return "";
    }
  };

  const avgScore = rounds.filter(r => r.score !== null).length > 0
    ? (rounds.reduce((s, r) => s + (r.score || 0), 0) / rounds.filter(r => r.score !== null).length).toFixed(1)
    : null;

  // Setup screen
  if (!started) {
    return (
      <div className="max-w-lg mx-auto p-4 space-y-6 flex flex-col items-center justify-center h-full animate-message-in">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-3">
            <AlertTriangle className="w-7 h-7 text-destructive" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Failure Simulator</h2>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            Face rejection, pressure, and stress scenarios. Build resilience before the real thing breaks you.
          </p>
        </div>

        <div className="w-full max-w-md space-y-4">
          {/* Scenario cards */}
          <div className="space-y-2">
            {SCENARIOS.map((s, i) => (
              <button
                key={s.label}
                onClick={() => setSelectedScenario(i)}
                className={cn(
                  "w-full text-left px-4 py-3 rounded-xl border transition-all duration-200",
                  selectedScenario === i
                    ? "border-destructive/30 bg-destructive/5"
                    : "border-border/40 hover:bg-muted"
                )}
              >
                <div className="text-sm font-medium text-foreground">{s.label}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{s.description}</div>
              </button>
            ))}
          </div>

          {/* Context input */}
          {selectedScenario !== null && (
            <div className="animate-message-in">
              <label className="text-[10px] text-muted-foreground/50 mb-1 block">Add context (optional)</label>
              <input
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder={
                  selectedScenario === 0 ? "e.g. Software Engineer at Google, 3 YOE" :
                  selectedScenario === 1 ? "e.g. AI SaaS for healthcare, pre-seed" :
                  selectedScenario === 2 ? "e.g. Contract dispute, plaintiff side" :
                  "e.g. IAS aspirant, 2nd attempt, economics optional"
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-destructive/30 transition-colors"
              />
            </div>
          )}

          <button
            onClick={startSimulation}
            disabled={selectedScenario === null}
            className="w-full px-4 py-3 rounded-xl bg-destructive text-destructive-foreground font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-30 flex items-center justify-center gap-2"
          >
            <AlertTriangle className="w-4 h-4" />
            Begin Simulation (4 rounds)
          </button>
        </div>
      </div>
    );
  }

  // Simulation in progress
  const scenario = SCENARIOS[selectedScenario!];

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-border/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            <span className="text-sm font-semibold text-foreground">{scenario.label}</span>
          </div>
          <div className="flex items-center gap-3">
            {avgScore && (
              <span className="text-xs text-muted-foreground">
                Avg: <span className="font-bold text-foreground">{avgScore}/10</span>
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              R{rounds.filter(r => r.status === "scored").length}/{scenario.rounds.length}
            </span>
            <button onClick={reset} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Rounds */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {rounds.map((round, i) => (
          <div key={i} className="space-y-3 animate-message-in">
            {/* Round label */}
            <div className="flex items-center justify-center gap-2">
              <span className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border",
                getTypeColor(round.type)
              )}>
                {getTypeIcon(round.type)}
                {round.type}
              </span>
            </div>

            {/* AI Challenge */}
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-destructive/10 text-destructive flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                ⚡
              </div>
              <div className="flex-1 px-3.5 py-2.5 rounded-2xl rounded-tl-md bg-card border border-destructive/20 shadow-sm">
                <p className="text-sm leading-relaxed text-foreground">{round.aiChallenge}</p>
              </div>
            </div>

            {/* User response */}
            {round.userResponse && (
              <div className="flex gap-3 justify-end">
                <div className="px-3.5 py-2.5 rounded-2xl rounded-tr-md bg-muted max-w-[80%]">
                  <p className="text-sm leading-relaxed text-foreground/80 whitespace-pre-wrap">{round.userResponse}</p>
                </div>
                <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                  You
                </div>
              </div>
            )}

            {/* AI evaluating */}
            {round.status === "ai_evaluating" && (
              <div className="flex items-center gap-2 ml-10 text-xs text-muted-foreground">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Evaluating your response...
              </div>
            )}

            {/* Score & feedback */}
            {round.status === "scored" && round.score !== null && (
              <div className="ml-10 px-3.5 py-2.5 rounded-xl border border-border/30 bg-card space-y-2">
                <div className="flex items-center gap-3">
                  <span className={cn(
                    "text-lg font-bold",
                    round.score >= 7 ? "text-green-500" : round.score >= 5 ? "text-amber-500" : "text-destructive"
                  )}>
                    {round.score}/10
                  </span>
                  <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        round.score >= 7 ? "bg-green-500" : round.score >= 5 ? "bg-amber-500" : "bg-destructive"
                      )}
                      style={{ width: `${(round.score / 10) * 100}%` }}
                    />
                  </div>
                </div>
                {round.aiFeedback && (
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{round.aiFeedback}</p>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Input for current round */}
        {rounds.length > 0 && rounds[rounds.length - 1].status === "user_turn" && (
          <div className="space-y-2 animate-message-in">
            <textarea
              ref={textareaRef}
              value={currentResponse}
              onChange={(e) => setCurrentResponse(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  submitResponse();
                }
              }}
              placeholder="How do you respond? Stay composed… (⌘+Enter to submit)"
              className="w-full resize-none bg-muted/30 border border-border rounded-xl outline-none text-sm text-foreground p-3 min-h-[100px] max-h-[200px] focus:border-destructive/30 transition-colors placeholder:text-muted-foreground/50"
            />
            <button
              onClick={submitResponse}
              disabled={!currentResponse.trim() || loading}
              className="px-4 py-2 rounded-xl bg-destructive text-destructive-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-30 flex items-center gap-1.5"
            >
              Respond Under Pressure
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && rounds.length > 0 && rounds[rounds.length - 1].status === "ai_evaluating" && (
          <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Judging your response...
          </div>
        )}

        {/* Final results */}
        {finished && avgScore && (
          <div className="text-center py-6 space-y-4 animate-message-in">
            <div className={cn(
              "w-16 h-16 rounded-2xl flex items-center justify-center mx-auto",
              parseFloat(avgScore) >= 7 ? "bg-green-500/10" : parseFloat(avgScore) >= 5 ? "bg-amber-500/10" : "bg-destructive/10"
            )}>
              {parseFloat(avgScore) >= 7 ? (
                <Trophy className="w-8 h-8 text-green-500" />
              ) : parseFloat(avgScore) >= 5 ? (
                <Shield className="w-8 h-8 text-amber-500" />
              ) : (
                <ThumbsDown className="w-8 h-8 text-destructive" />
              )}
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">
                {parseFloat(avgScore) >= 7 ? "You're Ready! 💪" : parseFloat(avgScore) >= 5 ? "Getting There 🔄" : "Needs Work 📚"}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Average score: <span className="font-bold text-foreground">{avgScore}/10</span>
              </p>
            </div>

            <div className="grid grid-cols-4 gap-2 max-w-sm mx-auto">
              {rounds.map((r, i) => (
                <div key={i} className="px-2 py-2 rounded-lg bg-card border border-border/40 text-center">
                  <div className={cn(
                    "text-sm font-bold",
                    (r.score || 0) >= 7 ? "text-green-500" : (r.score || 0) >= 5 ? "text-amber-500" : "text-destructive"
                  )}>
                    {r.score}
                  </div>
                  <div className="text-[9px] text-muted-foreground uppercase">{r.type}</div>
                </div>
              ))}
            </div>

            <button
              onClick={reset}
              className="px-5 py-2.5 rounded-xl bg-destructive text-destructive-foreground text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-2 mx-auto"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
