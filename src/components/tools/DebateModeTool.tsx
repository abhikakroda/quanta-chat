import { useState, useRef, useCallback } from "react";
import { Swords, Play, RotateCcw, ChevronDown, Loader2, ArrowRight, Trophy, ThumbsUp, ThumbsDown, Minus, Shield, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const CATEGORIES = [
  {
    label: "UPSC / Civil Services",
    topics: [
      "Democracy vs Authoritarianism for developing nations",
      "Should India adopt a Presidential system?",
      "Is reservation policy still relevant?",
      "UBI vs targeted welfare programs",
      "Death penalty should be abolished",
      "Social media should be regulated by government",
    ],
  },
  {
    label: "Law & Ethics",
    topics: [
      "AI-generated art should be copyrightable",
      "Right to privacy vs national security",
      "Capital punishment is morally justified",
      "Euthanasia should be legalized",
      "Corporate lobbying undermines democracy",
      "Whistleblowers deserve absolute legal protection",
    ],
  },
  {
    label: "Tech & Society",
    topics: [
      "AI will create more jobs than it destroys",
      "Open source is better than proprietary software",
      "Social media does more harm than good",
      "Remote work is superior to office work",
      "Cryptocurrency should replace fiat currency",
      "Big Tech monopolies should be broken up",
    ],
  },
  {
    label: "Interview / GD",
    topics: [
      "Startups vs corporate jobs for fresh graduates",
      "Higher education is overrated in the age of internet",
      "Work-life balance is a myth in competitive industries",
      "Generalists are more valuable than specialists",
      "Failure is essential for success",
      "Ethical business practices lead to better long-term profits",
    ],
  },
];

type DebateRound = {
  round: number;
  userArg: string;
  aiRebuttal: string;
  scores: { logic: number; evidence: number; persuasion: number } | null;
  feedback: string;
  status: "user_turn" | "ai_responding" | "scoring" | "scored";
};

const TOTAL_ROUNDS = 4;

export default function DebateModeTool() {
  const { user } = useAuth();
  const [topic, setTopic] = useState("");
  const [customTopic, setCustomTopic] = useState("");
  const [userSide, setUserSide] = useState<"for" | "against">("for");
  const [started, setStarted] = useState(false);
  const [rounds, setRounds] = useState<DebateRound[]>([]);
  const [currentArg, setCurrentArg] = useState("");
  const [loading, setLoading] = useState(false);
  const [aiOpening, setAiOpening] = useState("");
  const [finished, setFinished] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(0);
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
        skillPrompt: `You are a fierce but fair debate opponent. You argue passionately with logic, evidence, and rhetorical skill. You challenge weak arguments and acknowledge strong ones. Be concise and impactful.`,
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

  const startDebate = async () => {
    const debateTopic = customTopic.trim() || topic;
    if (!debateTopic) return;
    setStarted(true);
    setRounds([]);
    setFinished(false);
    setLoading(true);

    try {
      const aiSide = userSide === "for" ? "AGAINST" : "FOR";
      const prompt = `You are debating the topic: "${debateTopic}"
You are arguing ${aiSide} this position.
Your opponent argues ${userSide === "for" ? "FOR" : "AGAINST"}.

Give your opening statement (3-4 sentences). Be bold, use a strong hook, present your core thesis.
Just the opening statement, nothing else.`;

      const opening = await callAI(prompt);
      setAiOpening(opening);
      setRounds([{
        round: 1,
        userArg: "",
        aiRebuttal: "",
        scores: null,
        feedback: "",
        status: "user_turn",
      }]);
      scrollToBottom();
      setTimeout(() => textareaRef.current?.focus(), 300);
    } catch (err) {
      console.error("Failed to start debate:", err);
    } finally {
      setLoading(false);
    }
  };

  const submitArgument = async () => {
    if (!currentArg.trim() || loading) return;
    const arg = currentArg;
    setCurrentArg("");
    const roundIdx = rounds.length - 1;
    const roundNum = rounds[roundIdx].round;

    setRounds(prev => prev.map((r, i) =>
      i === roundIdx ? { ...r, userArg: arg, status: "ai_responding" as const } : r
    ));
    setLoading(true);
    scrollToBottom();

    try {
      const debateTopic = customTopic.trim() || topic;
      const aiSide = userSide === "for" ? "AGAINST" : "FOR";

      // Build debate history
      const history = rounds.slice(0, roundIdx).map(r =>
        `Round ${r.round}:\nUser: ${r.userArg}\nAI: ${r.aiRebuttal}`
      ).join("\n\n");

      // Get AI rebuttal
      const rebuttalPrompt = `Debate topic: "${debateTopic}"
You argue ${aiSide}. Opponent argues ${userSide === "for" ? "FOR" : "AGAINST"}.

${history ? `Previous rounds:\n${history}\n\n` : ""}Your opening statement was: "${aiOpening}"

Round ${roundNum}: Opponent's argument:
"${arg}"

Give a sharp rebuttal (3-4 sentences). Counter their specific points, introduce new evidence or logic. Be persuasive.
Just the rebuttal, nothing else.`;

      const rebuttal = await callAI(rebuttalPrompt);

      // Score the user's argument
      const scorePrompt = `You are a neutral debate judge. Score this argument:

Topic: "${debateTopic}"
Position: ${userSide === "for" ? "FOR" : "AGAINST"}
Round ${roundNum} of ${TOTAL_ROUNDS}

Argument: "${arg}"

Score in EXACTLY this format:
LOGIC: [1-10]
EVIDENCE: [1-10]
PERSUASION: [1-10]
FEEDBACK: [1-2 sentences on strengths and what to improve]`;

      const scoreResult = await callAI(scorePrompt);

      let logic = 5, evidence = 5, persuasion = 5;
      let feedback = "";
      const logicMatch = scoreResult.match(/LOGIC:\s*(\d+)/i);
      const evidenceMatch = scoreResult.match(/EVIDENCE:\s*(\d+)/i);
      const persuasionMatch = scoreResult.match(/PERSUASION:\s*(\d+)/i);
      const feedbackMatch = scoreResult.match(/FEEDBACK:\s*([\s\S]+)/i);

      if (logicMatch) logic = Math.min(10, Math.max(1, parseInt(logicMatch[1])));
      if (evidenceMatch) evidence = Math.min(10, Math.max(1, parseInt(evidenceMatch[1])));
      if (persuasionMatch) persuasion = Math.min(10, Math.max(1, parseInt(persuasionMatch[1])));
      if (feedbackMatch) feedback = feedbackMatch[1].trim();

      setRounds(prev => prev.map((r, i) =>
        i === roundIdx ? {
          ...r,
          userArg: arg,
          aiRebuttal: rebuttal,
          scores: { logic, evidence, persuasion },
          feedback,
          status: "scored" as const,
        } : r
      ));

      if (roundNum >= TOTAL_ROUNDS) {
        setFinished(true);
      }

      scrollToBottom();
    } catch (err) {
      console.error("Debate round failed:", err);
      setRounds(prev => prev.map((r, i) =>
        i === roundIdx ? { ...r, userArg: arg, aiRebuttal: "Error generating response.", status: "scored" as const } : r
      ));
    } finally {
      setLoading(false);
    }
  };

  const nextRound = () => {
    setRounds(prev => [...prev, {
      round: prev.length + 1,
      userArg: "",
      aiRebuttal: "",
      scores: null,
      feedback: "",
      status: "user_turn",
    }]);
    scrollToBottom();
    setTimeout(() => textareaRef.current?.focus(), 200);
  };

  const resetDebate = () => {
    setStarted(false);
    setRounds([]);
    setCurrentArg("");
    setAiOpening("");
    setFinished(false);
  };

  const getScoreIcon = (score: number) => {
    if (score >= 8) return <ThumbsUp className="w-3 h-3 text-green-500" />;
    if (score >= 5) return <Minus className="w-3 h-3 text-yellow-500" />;
    return <ThumbsDown className="w-3 h-3 text-destructive" />;
  };

  const avgScores = rounds.filter(r => r.scores).length > 0
    ? {
      logic: (rounds.reduce((s, r) => s + (r.scores?.logic || 0), 0) / rounds.filter(r => r.scores).length).toFixed(1),
      evidence: (rounds.reduce((s, r) => s + (r.scores?.evidence || 0), 0) / rounds.filter(r => r.scores).length).toFixed(1),
      persuasion: (rounds.reduce((s, r) => s + (r.scores?.persuasion || 0), 0) / rounds.filter(r => r.scores).length).toFixed(1),
    }
    : null;

  // Setup screen
  if (!started) {
    return (
      <div className="max-w-lg mx-auto p-4 space-y-6 flex flex-col items-center justify-center h-full animate-message-in">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <Swords className="w-7 h-7 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-foreground">AI Debate Mode</h2>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            Pick a topic, choose your side, and debate the AI. Scored on logic, evidence, and persuasion.
          </p>
        </div>

        <div className="w-full max-w-md space-y-4">
          {/* Category tabs */}
          <div className="flex gap-1 overflow-x-auto pb-1">
            {CATEGORIES.map((cat, i) => (
              <button
                key={cat.label}
                onClick={() => setSelectedCategory(i)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors shrink-0",
                  selectedCategory === i
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Topic grid */}
          <div className="space-y-1.5 max-h-[180px] overflow-y-auto">
            {CATEGORIES[selectedCategory].topics.map((t) => (
              <button
                key={t}
                onClick={() => { setTopic(t); setCustomTopic(""); }}
                className={cn(
                  "w-full text-left px-3.5 py-2.5 rounded-xl text-[13px] border transition-colors",
                  topic === t && !customTopic
                    ? "border-primary/30 bg-primary/10 text-primary font-medium"
                    : "border-border/40 text-foreground/70 hover:bg-muted"
                )}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Custom topic */}
          <div>
            <label className="text-[10px] text-muted-foreground/50 mb-1 block">Or enter your own topic</label>
            <input
              value={customTopic}
              onChange={(e) => { setCustomTopic(e.target.value); setTopic(""); }}
              placeholder="e.g. AI regulation is necessary for humanity's survival"
              className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/30 transition-colors"
            />
          </div>

          {/* Side picker */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Your position</label>
            <div className="flex gap-2">
              <button
                onClick={() => setUserSide("for")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium border transition-colors",
                  userSide === "for"
                    ? "border-green-500/30 bg-green-500/10 text-green-600"
                    : "border-border text-muted-foreground hover:bg-muted"
                )}
              >
                <Shield className="w-4 h-4" />
                FOR
              </button>
              <button
                onClick={() => setUserSide("against")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium border transition-colors",
                  userSide === "against"
                    ? "border-red-500/30 bg-red-500/10 text-red-500"
                    : "border-border text-muted-foreground hover:bg-muted"
                )}
              >
                <Zap className="w-4 h-4" />
                AGAINST
              </button>
            </div>
          </div>

          <button
            onClick={startDebate}
            disabled={!topic && !customTopic.trim()}
            className="w-full px-4 py-3 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-30 flex items-center justify-center gap-2"
          >
            <Swords className="w-4 h-4" />
            Start Debate ({TOTAL_ROUNDS} rounds)
          </button>
        </div>
      </div>
    );
  }

  // Debate in progress
  const debateTopic = customTopic.trim() || topic;

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-border/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Swords className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground truncate max-w-[200px]">{debateTopic.slice(0, 45)}{debateTopic.length > 45 ? "…" : ""}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", userSide === "for" ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-500")}>
              You: {userSide.toUpperCase()}
            </span>
            <span className="text-xs text-muted-foreground">
              R{rounds.filter(r => r.status === "scored").length}/{TOTAL_ROUNDS}
            </span>
            <button onClick={resetDebate} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        {avgScores && (
          <div className="flex gap-4 mt-2 text-[10px] text-muted-foreground">
            <span>Logic: <span className="font-bold text-foreground">{avgScores.logic}</span></span>
            <span>Evidence: <span className="font-bold text-foreground">{avgScores.evidence}</span></span>
            <span>Persuasion: <span className="font-bold text-foreground">{avgScores.persuasion}</span></span>
          </div>
        )}
      </div>

      {/* Debate rounds */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {/* AI opening */}
        {aiOpening && (
          <div className="animate-message-in">
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-destructive/10 text-destructive flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                AI
              </div>
              <div className="flex-1 px-3.5 py-2.5 rounded-2xl rounded-tl-md bg-card border border-border/40 shadow-elegant">
                <p className="text-[10px] font-medium text-muted-foreground mb-1">Opening Statement</p>
                <p className="text-sm leading-relaxed text-foreground">{aiOpening}</p>
              </div>
            </div>
          </div>
        )}

        {rounds.map((round, i) => (
          <div key={i} className="space-y-3 animate-message-in">
            <div className="text-[10px] text-muted-foreground/40 text-center font-medium">— Round {round.round} —</div>

            {/* User argument */}
            {round.userArg && (
              <div className="flex gap-3 justify-end">
                <div className="px-3.5 py-2.5 rounded-2xl rounded-tr-md bg-muted max-w-[80%]">
                  <p className="text-sm leading-relaxed text-foreground/80 whitespace-pre-wrap">{round.userArg}</p>
                </div>
                <div className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5",
                  userSide === "for" ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-500"
                )}>
                  You
                </div>
              </div>
            )}

            {/* AI responding */}
            {round.status === "ai_responding" && (
              <div className="flex items-center gap-2 ml-10 text-xs text-muted-foreground">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                AI preparing rebuttal...
              </div>
            )}

            {/* AI rebuttal */}
            {round.aiRebuttal && (
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-destructive/10 text-destructive flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                  AI
                </div>
                <div className="flex-1 px-3.5 py-2.5 rounded-2xl rounded-tl-md bg-card border border-border/40">
                  <p className="text-sm leading-relaxed text-foreground">{round.aiRebuttal}</p>
                </div>
              </div>
            )}

            {/* Scores */}
            {round.status === "scored" && round.scores && (
              <div className="ml-10 px-3.5 py-2.5 rounded-xl border border-border/30 bg-card space-y-2">
                <div className="flex items-center gap-4 text-[11px]">
                  <div className="flex items-center gap-1.5">
                    {getScoreIcon(round.scores.logic)}
                    <span className="text-muted-foreground">Logic:</span>
                    <span className="font-bold text-foreground">{round.scores.logic}/10</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {getScoreIcon(round.scores.evidence)}
                    <span className="text-muted-foreground">Evidence:</span>
                    <span className="font-bold text-foreground">{round.scores.evidence}/10</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {getScoreIcon(round.scores.persuasion)}
                    <span className="text-muted-foreground">Persuasion:</span>
                    <span className="font-bold text-foreground">{round.scores.persuasion}/10</span>
                  </div>
                </div>
                {round.feedback && (
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{round.feedback}</p>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Answer input */}
        {rounds.length > 0 && rounds[rounds.length - 1].status === "user_turn" && (
          <div className="space-y-2 animate-message-in">
            <textarea
              ref={textareaRef}
              value={currentArg}
              onChange={(e) => setCurrentArg(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  submitArgument();
                }
              }}
              placeholder="Present your argument… (⌘+Enter to submit)"
              className="w-full resize-none bg-muted/30 border border-border rounded-xl outline-none text-sm text-foreground p-3 min-h-[100px] max-h-[200px] focus:border-primary/30 transition-colors placeholder:text-muted-foreground/50"
            />
            <button
              onClick={submitArgument}
              disabled={!currentArg.trim() || loading}
              className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-30 flex items-center gap-1.5"
            >
              Submit Argument
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Next round */}
        {!loading && rounds.length > 0 && rounds[rounds.length - 1].status === "scored" && !finished && (
          <div className="flex justify-center pt-2">
            <button
              onClick={nextRound}
              className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-2"
            >
              Next Round
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && rounds.length > 0 && rounds[rounds.length - 1].status === "ai_responding" && (
          <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            AI is formulating a rebuttal...
          </div>
        )}

        {/* Final results */}
        {finished && avgScores && (
          <div className="text-center py-6 space-y-4 animate-message-in">
            <Trophy className="w-10 h-10 text-primary mx-auto" />
            <div>
              <h3 className="text-lg font-bold text-foreground">Debate Complete!</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Topic: {debateTopic}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto">
              <div className="px-3 py-3 rounded-xl bg-card border border-border/40 text-center">
                <div className="text-lg font-bold text-foreground">{avgScores.logic}</div>
                <div className="text-[10px] text-muted-foreground">Logic</div>
              </div>
              <div className="px-3 py-3 rounded-xl bg-card border border-border/40 text-center">
                <div className="text-lg font-bold text-foreground">{avgScores.evidence}</div>
                <div className="text-[10px] text-muted-foreground">Evidence</div>
              </div>
              <div className="px-3 py-3 rounded-xl bg-card border border-border/40 text-center">
                <div className="text-lg font-bold text-foreground">{avgScores.persuasion}</div>
                <div className="text-[10px] text-muted-foreground">Persuasion</div>
              </div>
            </div>
            <div className="flex justify-center gap-2">
              <button
                onClick={resetDebate}
                className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-2"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                New Debate
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
