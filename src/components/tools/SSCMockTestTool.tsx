import { useState, useCallback, useEffect, useRef } from "react";
import { ArrowLeft, Loader2, Trophy, RotateCcw, Clock, CheckCircle2, AlertTriangle, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";

type QuizQ = { question: string; options: string[]; answer: number; explanation: string; subject: string };
type TestConfig = { name: string; questions: number; minutes: number; subjects: string[] };

const TEST_CONFIGS: TestConfig[] = [
  { name: "SSC CGL Tier-1 Mini", questions: 25, minutes: 15, subjects: ["English", "Math", "Reasoning", "GK"] },
  { name: "SSC CHSL Quick Test", questions: 20, minutes: 12, subjects: ["English", "Math", "Reasoning", "GK"] },
  { name: "Full Mock (50 Qs)", questions: 50, minutes: 30, subjects: ["English", "Math", "Reasoning", "GK"] },
  { name: "English + GK Focus", questions: 20, minutes: 12, subjects: ["English", "GK"] },
  { name: "Math + Reasoning Focus", questions: 20, minutes: 12, subjects: ["Math", "Reasoning"] },
  { name: "Speed Round (10 Qs)", questions: 10, minutes: 5, subjects: ["English", "Math", "Reasoning", "GK"] },
];

const SUBJECT_COLORS: Record<string, string> = {
  English: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  Math: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  Reasoning: "bg-purple-500/10 text-purple-600 border-purple-500/30",
  GK: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
};

const SUBJECT_PROMPTS: Record<string, string> = {
  English: "English Language (vocabulary, grammar, idioms, sentence improvement, error detection, comprehension)",
  Math: "Quantitative Aptitude (arithmetic, algebra, geometry, trigonometry, data interpretation, percentages, profit-loss, time-speed-distance)",
  Reasoning: "General Intelligence & Reasoning (coding-decoding, analogy, series, blood relations, direction sense, syllogism, classification, mirror image)",
  GK: "General Knowledge & General Awareness (history, polity, geography, science, current affairs, static GK, important dates)",
};

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function SSCMockTestTool() {
  const [phase, setPhase] = useState<"select" | "loading" | "test" | "result">("select");
  const [config, setConfig] = useState<TestConfig | null>(null);
  const [questions, setQuestions] = useState<QuizQ[]>([]);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [currentQ, setCurrentQ] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [score, setScore] = useState(0);
  const [subjectScores, setSubjectScores] = useState<Record<string, { correct: number; total: number }>>({});
  const [showReview, setShowReview] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Timer
  useEffect(() => {
    if (phase !== "test") return;
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          submitTest();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase]);

  const startTest = useCallback(async (cfg: TestConfig) => {
    setConfig(cfg);
    setPhase("loading");
    setAnswers({});
    setCurrentQ(0);
    setShowReview(false);

    const perSubject = Math.ceil(cfg.questions / cfg.subjects.length);
    const subjectList = cfg.subjects.map(s => `${perSubject} questions on ${SUBJECT_PROMPTS[s]}`).join("\n");

    const sys = `You are an SSC competitive exam question generator. Generate exactly ${cfg.questions} MCQ questions for SSC CGL/CHSL level.
Mix these subjects evenly:
${subjectList}

Return ONLY a JSON array: [{"question":"...","options":["A","B","C","D"],"answer":0,"explanation":"...","subject":"English|Math|Reasoning|GK"}].
answer is 0-indexed. Shuffle subjects randomly. Make questions exam-realistic.`;

    let raw = "";
    try {
      const res = await supabase.functions.invoke("chat", {
        body: { messages: [{ role: "user", content: `Generate ${cfg.questions} mixed SSC exam MCQs.` }], model: "google/gemini-2.5-flash", systemPrompt: sys },
      });
      if (res.data) {
        const reader = res.data.getReader?.();
        if (reader) {
          const decoder = new TextDecoder();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            raw += decoder.decode(value, { stream: true });
          }
        } else if (typeof res.data === "string") {
          raw = res.data;
        }
      }
      const match = raw.match(/\[[\s\S]*\]/);
      if (match) {
        const parsed = JSON.parse(match[0]) as QuizQ[];
        setQuestions(parsed);
        setTimeLeft(cfg.minutes * 60);
        setPhase("test");
      } else {
        setPhase("select");
      }
    } catch {
      setPhase("select");
    }
  }, []);

  const submitTest = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    let s = 0;
    const sScores: Record<string, { correct: number; total: number }> = {};
    questions.forEach((q, i) => {
      if (!sScores[q.subject]) sScores[q.subject] = { correct: 0, total: 0 };
      sScores[q.subject].total++;
      if (answers[i] === q.answer) { s++; sScores[q.subject].correct++; }
    });
    setScore(s);
    setSubjectScores(sScores);
    setPhase("result");
  }, [questions, answers]);

  const answeredCount = Object.keys(answers).length;
  const progress = questions.length ? (answeredCount / questions.length) * 100 : 0;

  if (phase === "select") {
    return (
      <div className="flex flex-col h-full bg-background">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Trophy className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-[15px] font-bold text-foreground">SSC Mock Test</h2>
            <p className="text-[11px] text-muted-foreground">Timed mixed-subject practice tests</p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid gap-3">
            {TEST_CONFIGS.map(cfg => (
              <button key={cfg.name} onClick={() => startTest(cfg)}
                className="p-4 rounded-xl border border-border/50 bg-muted/20 hover:bg-primary/5 hover:border-primary/30 transition-all text-left space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-foreground">{cfg.name}</span>
                  <Play className="w-4 h-4 text-primary" />
                </div>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />{cfg.questions} Qs</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{cfg.minutes} min</span>
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {cfg.subjects.map(s => (
                    <span key={s} className={cn("px-2 py-0.5 rounded-full text-[10px] font-medium border", SUBJECT_COLORS[s])}>{s}</span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (phase === "loading") {
    return (
      <div className="flex flex-col h-full bg-background items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Generating {config?.questions} questions...</p>
        <p className="text-[11px] text-muted-foreground/60">This may take a moment</p>
      </div>
    );
  }

  if (phase === "result") {
    const pct = questions.length ? Math.round((score / questions.length) * 100) : 0;
    return (
      <div className="flex flex-col h-full bg-background">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50">
          <Trophy className="w-5 h-5 text-primary" />
          <h2 className="text-[15px] font-bold text-foreground">Test Results</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="text-center p-6 rounded-xl border border-border/50 bg-muted/10">
            <p className="text-4xl font-black text-foreground">{score}/{questions.length}</p>
            <p className="text-sm text-muted-foreground mt-1">{pct}% — {pct >= 80 ? "Excellent! 🎉" : pct >= 60 ? "Good effort! 👍" : pct >= 40 ? "Keep practicing 📝" : "Needs improvement 💪"}</p>
            <div className="mt-3"><Progress value={pct} className="h-2" /></div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {Object.entries(subjectScores).map(([sub, s]) => (
              <div key={sub} className={cn("p-3 rounded-xl border text-center", SUBJECT_COLORS[sub])}>
                <p className="text-[11px] font-medium">{sub}</p>
                <p className="text-lg font-black">{s.correct}/{s.total}</p>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <button onClick={() => setShowReview(!showReview)}
              className="flex-1 py-2.5 rounded-xl border border-border/50 text-sm font-medium text-foreground hover:bg-muted/50 transition-all">
              {showReview ? "Hide" : "Review"} Answers
            </button>
            <button onClick={() => { setPhase("select"); setQuestions([]); setAnswers({}); }}
              className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center gap-1">
              <RotateCcw className="w-3 h-3" /> New Test
            </button>
          </div>

          {showReview && questions.map((q, i) => (
            <div key={i} className={cn("p-3 rounded-xl border text-sm", answers[i] === q.answer ? "border-emerald-500/30 bg-emerald-500/5" : "border-destructive/30 bg-destructive/5")}>
              <div className="flex items-center gap-2 mb-2">
                <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium border", SUBJECT_COLORS[q.subject])}>{q.subject}</span>
                <span className="text-muted-foreground text-[11px]">Q{i + 1}</span>
              </div>
              <p className="font-medium mb-2">{q.question}</p>
              {q.options.map((opt, j) => (
                <p key={j} className={cn("text-[13px] py-0.5", j === q.answer ? "text-emerald-600 font-medium" : answers[i] === j ? "text-destructive line-through" : "text-muted-foreground")}>
                  {j === q.answer ? "✓ " : answers[i] === j ? "✗ " : "  "}{opt}
                </p>
              ))}
              <p className="text-[11px] text-muted-foreground mt-1 italic">{q.explanation}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Test phase
  const q = questions[currentQ];
  const timeWarning = timeLeft < 60;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header with timer */}
      <div className="px-4 py-2 border-b border-border/50 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-bold text-foreground">{config?.name}</span>
          <span className={cn("flex items-center gap-1 text-sm font-mono font-bold", timeWarning ? "text-destructive animate-pulse" : "text-foreground")}>
            <Clock className="w-3.5 h-3.5" /> {formatTime(timeLeft)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Progress value={progress} className="h-1.5 flex-1" />
          <span className="text-[11px] text-muted-foreground">{answeredCount}/{questions.length}</span>
        </div>
      </div>

      {/* Question nav dots */}
      <div className="px-4 py-2 border-b border-border/30 flex gap-1 flex-wrap">
        {questions.map((_, i) => (
          <button key={i} onClick={() => setCurrentQ(i)}
            className={cn("w-6 h-6 rounded text-[10px] font-bold transition-all",
              i === currentQ ? "bg-primary text-primary-foreground" :
              answers[i] !== undefined ? "bg-emerald-500/20 text-emerald-600 border border-emerald-500/30" :
              "bg-muted/50 text-muted-foreground hover:bg-muted")}>
            {i + 1}
          </button>
        ))}
      </div>

      {/* Question */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {q && (
          <>
            <div className="flex items-center gap-2">
              <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-medium border", SUBJECT_COLORS[q.subject])}>{q.subject}</span>
              <span className="text-[11px] text-muted-foreground">Question {currentQ + 1} of {questions.length}</span>
            </div>
            <p className="text-sm font-medium text-foreground">{q.question}</p>
            <div className="grid gap-2">
              {q.options.map((opt, j) => (
                <button key={j} onClick={() => setAnswers(p => ({ ...p, [currentQ]: j }))}
                  className={cn("px-4 py-3 rounded-xl text-[13px] text-left transition-all border",
                    answers[currentQ] === j ? "bg-primary/10 border-primary/40 text-primary font-medium" :
                    "border-border/30 hover:bg-muted/50 text-foreground")}>
                  <span className="font-medium mr-2 text-muted-foreground">{String.fromCharCode(65 + j)}.</span>{opt}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Navigation */}
      <div className="px-4 py-3 border-t border-border/50 flex gap-2">
        <button onClick={() => setCurrentQ(p => Math.max(0, p - 1))} disabled={currentQ === 0}
          className="flex-1 py-2.5 rounded-xl border border-border/50 text-sm font-medium disabled:opacity-30 text-foreground hover:bg-muted/50">
          Previous
        </button>
        {currentQ < questions.length - 1 ? (
          <button onClick={() => setCurrentQ(p => p + 1)}
            className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium">
            Next
          </button>
        ) : (
          <button onClick={submitTest}
            className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium flex items-center justify-center gap-1">
            <CheckCircle2 className="w-4 h-4" /> Submit Test
          </button>
        )}
      </div>
    </div>
  );
}
