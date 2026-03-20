import { useState, useCallback } from "react";
import { ArrowLeft, Calculator, Sparkles, Loader2, CheckCircle2, XCircle, Trophy, Brain, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { streamAI } from "@/lib/streamAI";
import ReactMarkdown from "react-markdown";

type TabId = "arithmetic" | "algebra" | "geometry" | "di" | "quiz";
type QuizQ = { question: string; options: string[]; answer: number; explanation: string };

const TABS: { id: TabId; label: string; emoji: string }[] = [
  { id: "arithmetic", label: "Arithmetic", emoji: "🔢" },
  { id: "algebra", label: "Algebra", emoji: "📐" },
  { id: "geometry", label: "Geometry", emoji: "📏" },
  { id: "di", label: "Data Interp.", emoji: "📊" },
  { id: "quiz", label: "Quiz", emoji: "🧠" },
];

const ARITHMETIC_TOPICS = [
  "Number System", "HCF & LCM", "Percentage", "Profit & Loss",
  "Simple Interest", "Compound Interest", "Ratio & Proportion",
  "Time & Work", "Time, Speed & Distance", "Average",
  "Mixture & Alligation", "Partnership",
];

const ALGEBRA_TOPICS = [
  "Linear Equations", "Quadratic Equations", "Surds & Indices",
  "Simplification", "Algebraic Identities", "Polynomials",
];

const GEOMETRY_TOPICS = [
  "Triangles", "Circles", "Quadrilaterals", "Coordinate Geometry",
  "Mensuration (2D)", "Mensuration (3D)", "Trigonometry",
  "Height & Distance",
];

const DI_TOPICS = [
  "Bar Graph", "Pie Chart", "Line Graph", "Table Based",
  "Mixed DI", "Caselet DI",
];

const QUIZ_TYPES = [
  "Arithmetic Quick Fire", "Algebra Challenge", "Geometry Master",
  "Data Interpretation", "Mixed SSC Quant", "Previous Year Questions",
];

// Pre-loaded instant reference data
const STATIC_MATH: Record<string, string> = {
  "Number System": "**Key Shortcuts:**\n- Divisibility by 3: Sum of digits divisible by 3\n- Divisibility by 11: Difference of alternate sums = 0 or ×11\n- Unit digit cycles: 2→{2,4,8,6}, 3→{3,9,7,1}, 7→{7,9,3,1}\n- Remainder theorem: f(x)/（x-a) → remainder = f(a)",
  "HCF & LCM": "**Formulas:**\n- HCF × LCM = Product of two numbers\n- HCF of fractions = HCF(numerators)/LCM(denominators)\n- LCM of fractions = LCM(numerators)/HCF(denominators)\n- For co-prime numbers: HCF = 1",
  "Percentage": "**Quick Tricks:**\n- x% of y = y% of x\n- Successive: a% then b% = (a+b+ab/100)%\n- If price ↑ by r%, reduce consumption by r/(100+r)×100%\n- Population: P(1+r/100)ⁿ",
  "Profit & Loss": "**Formulas:**\n- Profit% = (Profit/CP)×100\n- SP = CP×(100+P%)/100\n- Discount% = (Discount/MP)×100\n- SP = MP×(100-D%)/100\n- Two articles: one at x% profit, one at x% loss → Net loss = x²/100 %",
  "Simple Interest": "**SI = PRT/100**\n- Amount A = P + SI = P(1+RT/100)\n- If SI = P, then T = 100/R years\n- Equal installments: Each = Total×100/(100n+Rn(n-1)/2)",
  "Compound Interest": "**CI = P(1+R/100)ⁿ - P**\n- Half-yearly: rate=R/2, time=2n\n- Quarterly: rate=R/4, time=4n\n- Difference CI-SI (2 yrs) = P(R/100)²\n- Difference CI-SI (3 yrs) = PR²(300+R)/100³",
  "Ratio & Proportion": "**Key Rules:**\n- a:b = c:d (cross multiply: ad=bc)\n- Componendo: (a+b)/b = (c+d)/d\n- Dividendo: (a-b)/b = (c-d)/d\n- Mean proportion of a,b = √(ab)",
  "Time & Work": "**Shortcuts:**\n- A's 1 day work = 1/a\n- Together: 1/a + 1/b = (a+b)/ab days\n- If A is x times efficient as B: Time ratio = 1:x\n- Pipe problems: Inlet (+), Outlet (−)",
  "Time, Speed & Distance": "**Formulas:**\n- Speed = Distance/Time\n- Relative speed (same dir): S1−S2\n- Relative speed (opposite): S1+S2\n- Average speed: 2S1·S2/(S1+S2) [equal distances]\n- Train: Time = (L1+L2)/(S1±S2)",
  "Average": "**Quick Methods:**\n- Average = Sum/Count\n- New avg when adding: (Old sum + new)/（n+1)\n- Weighted avg = Σ(wi×xi)/Σwi\n- Consecutive n numbers: avg = (first+last)/2",
  "Triangles": "**Key Formulas:**\n- Area = ½×b×h = √[s(s-a)(s-b)(s-c)]\n- Equilateral: Area = (√3/4)a², height = (√3/2)a\n- Pythagorean triplets: (3,4,5), (5,12,13), (8,15,17), (7,24,25)\n- Angle bisector theorem: BD/DC = AB/AC",
  "Trigonometry": "**Standard Values:**\n| θ | sin | cos | tan |\n|---|-----|-----|-----|\n| 0° | 0 | 1 | 0 |\n| 30° | 1/2 | √3/2 | 1/√3 |\n| 45° | 1/√2 | 1/√2 | 1 |\n| 60° | √3/2 | 1/2 | √3 |\n| 90° | 1 | 0 | ∞ |\n\nsin²θ + cos²θ = 1",
};

// streamAI is now imported from @/lib/streamAI

export default function SSCMathTool() {
  const [tab, setTab] = useState<TabId>("arithmetic");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTopic, setActiveTopic] = useState<string | null>(null);
  const [quizQuestions, setQuizQuestions] = useState<QuizQ[]>([]);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);

  const fetchTopic = useCallback(async (topic: string, category: string) => {
    setActiveTopic(topic);
    setLoading(true);
    setContent("");
    const sys = `You are an SSC CGL/CHSL Quantitative Aptitude expert. Explain the topic "${topic}" under "${category}" clearly with formulas, shortcuts, tricks, and 3-5 solved examples with step-by-step solutions. Format with markdown. Add exam tips and common mistakes to avoid.`;
    await streamAI(`Explain "${topic}" for SSC exam preparation with shortcuts and solved examples.`, sys, setContent);
    setLoading(false);
  }, []);

  const startQuiz = useCallback(async (type: string) => {
    setLoading(true);
    setQuizQuestions([]);
    setQuizAnswers({});
    setQuizSubmitted(false);
    const sys = `You are an SSC exam quiz generator. Generate exactly 5 ${type} MCQ questions for SSC CGL/CHSL level. Return ONLY a JSON array: [{"question":"...","options":["A","B","C","D"],"answer":0,"explanation":"..."}]. answer is 0-indexed. Make questions exam-level difficulty with numerical options where applicable.`;
    let raw = "";
    await streamAI(`Generate 5 ${type} MCQ questions for SSC Quant practice.`, sys, (t) => { raw = t; });
    try {
      const match = raw.match(/\[[\s\S]*\]/);
      if (match) setQuizQuestions(JSON.parse(match[0]));
    } catch {}
    setLoading(false);
  }, []);

  const submitQuiz = () => {
    let s = 0;
    quizQuestions.forEach((q, i) => { if (quizAnswers[i] === q.answer) s++; });
    setScore(s);
    setStreak(prev => s === quizQuestions.length ? prev + 1 : 0);
    setQuizSubmitted(true);
  };

  const renderTopicGrid = (topics: string[], category: string) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {topics.map(t => (
        <button key={t} onClick={() => fetchTopic(t, category)}
          className="px-3 py-3 rounded-xl text-[13px] font-medium bg-muted/50 hover:bg-primary/10 hover:text-primary border border-border/40 hover:border-primary/30 transition-all text-left">
          {t}
        </button>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
          <Calculator className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-[15px] font-bold text-foreground">SSC Quant / Math</h2>
          <p className="text-[11px] text-muted-foreground">Arithmetic, Algebra, Geometry & DI for SSC CGL/CHSL</p>
        </div>
        {streak > 0 && (
          <div className="ml-auto flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/10 text-amber-500 text-[11px] font-bold">
            <Trophy className="w-3 h-3" /> {streak}🔥
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-4 py-2 border-b border-border/30 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setContent(""); setActiveTopic(null); setQuizQuestions([]); }}
            className={cn("px-3 py-1.5 rounded-lg text-[13px] font-medium whitespace-nowrap transition-all",
              tab === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/50")}>
            {t.emoji} {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {tab === "arithmetic" && !activeTopic && !loading && renderTopicGrid(ARITHMETIC_TOPICS, "Arithmetic")}
        {tab === "algebra" && !activeTopic && !loading && renderTopicGrid(ALGEBRA_TOPICS, "Algebra")}
        {tab === "geometry" && !activeTopic && !loading && renderTopicGrid(GEOMETRY_TOPICS, "Geometry")}
        {tab === "di" && !activeTopic && !loading && renderTopicGrid(DI_TOPICS, "Data Interpretation")}

        {tab === "quiz" && !quizQuestions.length && !loading && (
          <div className="grid grid-cols-2 gap-2">
            {QUIZ_TYPES.map(t => (
              <button key={t} onClick={() => startQuiz(t)}
                className="px-3 py-4 rounded-xl text-[13px] font-medium bg-muted/50 hover:bg-primary/10 hover:text-primary border border-border/40 hover:border-primary/30 transition-all text-center">
                <Brain className="w-5 h-5 mx-auto mb-1 opacity-60" /> {t}
              </button>
            ))}
          </div>
        )}

        {activeTopic && tab !== "quiz" && (
          <div className="space-y-3">
            <button onClick={() => { setActiveTopic(null); setContent(""); }} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-3 h-3" /> Back to topics
            </button>
            <h3 className="text-base font-bold text-foreground">{activeTopic}</h3>
            {/* Instant static reference */}
            {STATIC_MATH[activeTopic] && (
              <div className="prose prose-sm dark:prose-invert max-w-none p-4 rounded-xl bg-primary/5 border border-primary/20">
                <div className="text-xs font-semibold text-primary mb-2 flex items-center gap-1">⚡ Quick Reference</div>
                <ReactMarkdown>{STATIC_MATH[activeTopic]}</ReactMarkdown>
              </div>
            )}
            {loading && !content && (
              <div className="flex items-center gap-2 py-4 justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Loading detailed explanation...</span>
              </div>
            )}
            {content && (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown>{content}</ReactMarkdown>
              </div>
            )}
          </div>
        )}

        {quizQuestions.length > 0 && (
          <div className="space-y-4">
            <button onClick={() => { setQuizQuestions([]); setQuizSubmitted(false); }} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-3 h-3" /> Back
            </button>
            {quizQuestions.map((q, i) => (
              <div key={i} className={cn("p-4 rounded-xl border", quizSubmitted
                ? quizAnswers[i] === q.answer ? "border-emerald-500/30 bg-emerald-500/5" : "border-destructive/30 bg-destructive/5"
                : "border-border/50 bg-muted/20")}>
                <p className="text-sm font-medium mb-3">{i + 1}. {q.question}</p>
                <div className="grid grid-cols-1 gap-1.5">
                  {q.options.map((opt, j) => (
                    <button key={j} disabled={quizSubmitted}
                      onClick={() => setQuizAnswers(p => ({ ...p, [i]: j }))}
                      className={cn("px-3 py-2 rounded-lg text-[13px] text-left transition-all border",
                        quizSubmitted && j === q.answer ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-600" :
                        quizSubmitted && quizAnswers[i] === j ? "bg-destructive/10 border-destructive/40 text-destructive" :
                        quizAnswers[i] === j ? "bg-primary/10 border-primary/40 text-primary" :
                        "border-border/30 hover:bg-muted/50")}>
                      {opt}
                    </button>
                  ))}
                </div>
                {quizSubmitted && <p className="text-xs text-muted-foreground mt-2 italic">{q.explanation}</p>}
              </div>
            ))}
            {!quizSubmitted ? (
              <button onClick={submitQuiz} disabled={Object.keys(quizAnswers).length < quizQuestions.length}
                className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm disabled:opacity-40">
                Submit Answers
              </button>
            ) : (
              <div className="text-center space-y-2">
                <p className="text-lg font-bold">{score}/{quizQuestions.length} Correct! {score === quizQuestions.length ? "🎉" : "📝"}</p>
                <button onClick={() => { setQuizQuestions([]); setQuizSubmitted(false); }}
                  className="flex items-center gap-1 mx-auto text-sm text-primary hover:underline">
                  <RotateCcw className="w-3 h-3" /> Try Again
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
