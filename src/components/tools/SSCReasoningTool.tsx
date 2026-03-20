import { useState, useCallback } from "react";
import { ArrowLeft, Puzzle, Loader2, Brain, Trophy, RotateCcw, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";

type TabId = "verbal" | "nonverbal" | "analytical" | "quiz";
type QuizQ = { question: string; options: string[]; answer: number; explanation: string };

const TABS: { id: TabId; label: string; emoji: string }[] = [
  { id: "verbal", label: "Verbal", emoji: "🔤" },
  { id: "nonverbal", label: "Non-Verbal", emoji: "🔷" },
  { id: "analytical", label: "Analytical", emoji: "🧩" },
  { id: "quiz", label: "Quiz", emoji: "🧠" },
];

const VERBAL_TOPICS = [
  "Coding-Decoding", "Blood Relations", "Direction Sense",
  "Syllogism", "Analogy (Verbal)", "Classification",
  "Series (Number/Letter)", "Word Arrangement", "Ranking & Order",
  "Seating Arrangement", "Statement & Conclusion", "Venn Diagrams",
];

const NONVERBAL_TOPICS = [
  "Mirror Image", "Water Image", "Paper Folding & Cutting",
  "Figure Completion", "Embedded Figures", "Pattern Recognition",
  "Dice & Cubes", "Counting Figures",
];

const ANALYTICAL_TOPICS = [
  "Puzzle (Floor/Box)", "Calendar", "Clock",
  "Missing Number", "Mathematical Operations", "Inequality",
];

const QUIZ_TYPES = [
  "Verbal Reasoning", "Non-Verbal Reasoning", "Analytical Reasoning",
  "Mixed SSC Reasoning", "Coding-Decoding Special", "Previous Year Questions",
];

const STATIC_REASON: Record<string, string> = {
  "Coding-Decoding": "**Types:**\n- Letter coding: A=1,B=2...Z=26 or shift pattern\n- Number coding: Replace letters with numbers\n- Mixed coding: Conditions-based\n\n**Shortcuts:**\n- Check position shift: +1,+2,−1,−2\n- Reverse alphabet: A↔Z, B↔Y, C↔X\n- Opposite letters sum = 27 (A+Z=1+26)",
  "Blood Relations": "**Key Rules:**\n- Father's/Mother's son = Brother\n- Father's/Mother's daughter = Sister\n- Father's father = Grandfather\n- Mother's brother = Maternal Uncle\n- Father's sister = Paternal Aunt\n\n**Tip:** Draw family tree, use + for male, − for female",
  "Direction Sense": "**Compass:**\n- Right of North = East\n- Left of North = West\n- Opposite of NE = SW\n\n**Shadow Rule:**\n- Morning: Shadow falls West (sun in East)\n- Evening: Shadow falls East (sun in West)\n- Noon: No/minimal shadow",
  "Syllogism": "**Rules:**\n- All A are B + All B are C → All A are C ✓\n- Some A are B + All B are C → Some A are C ✓\n- No A are B → No B are A ✓\n- Some A are B → Some B are A ✓\n\n**Tip:** Use Venn diagrams for every question",
  "Mirror Image": "**Rules:**\n- Left↔Right reversal (horizontal mirror)\n- Top↔Bottom reversal (vertical mirror)\n- Letters/numbers: Write backwards\n- Clock in mirror: Subtract from 12:00",
  "Dice & Cubes": "**Rules:**\n- Opposite faces never adjacent\n- In standard dice: 1↔6, 2↔5, 3↔4\n- Two adjacent faces visible → third is opposite of hidden\n- Painted cube cut into n³: Corner=3 faces, Edge=2, Face=1, Inside=0",
  "Calendar": "**Key Facts:**\n- Odd days: Mon=1, Tue=2...Sun=0\n- Normal year = 1 odd day, Leap = 2\n- 100 years = 5 odd days\n- 400 years = 0 odd days\n- Leap year: divisible by 4, century by 400",
  "Clock": "**Formulas:**\n- Angle = |30H − 5.5M|\n- Hands overlap: every 65 5/11 min\n- Right angle: 22 times in 12 hours\n- Straight line: 22 times in 12 hours\n- Gain/Loss: Minute hand gains 5.5°/min over hour hand",
};

async function streamAI(prompt: string, systemPrompt: string, onChunk: (text: string) => void) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) { onChunk("Error: Not authenticated"); return; }

  const resp = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: prompt }],
        model: "gemini-flash",
        enableThinking: false,
        skillPrompt: systemPrompt,
      }),
    }
  );

  if (!resp.ok || !resp.body) { onChunk("Error: Failed to get response"); return; }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";

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
        if (content) {
          fullText += content;
          onChunk(fullText);
        }
      } catch { /* partial */ }
    }
  }
}

export default function SSCReasoningTool() {
  const [tab, setTab] = useState<TabId>("verbal");
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
    const sys = `You are an SSC CGL/CHSL Reasoning expert. Explain "${topic}" under "${category}" with clear concepts, shortcuts, tricks, and 3-5 solved examples with step-by-step solutions. Format with markdown. Add exam tips.`;
    await streamAI(`Explain "${topic}" for SSC Reasoning preparation with tricks and examples.`, sys, setContent);
    setLoading(false);
  }, []);

  const startQuiz = useCallback(async (type: string) => {
    setLoading(true);
    setQuizQuestions([]);
    setQuizAnswers({});
    setQuizSubmitted(false);
    const sys = `You are an SSC exam quiz generator. Generate exactly 5 ${type} MCQ questions for SSC CGL/CHSL level reasoning. Return ONLY a JSON array: [{"question":"...","options":["A","B","C","D"],"answer":0,"explanation":"..."}]. answer is 0-indexed.`;
    let raw = "";
    await streamAI(`Generate 5 ${type} MCQ questions for SSC Reasoning.`, sys, (t) => { raw = t; });
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
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
          <Puzzle className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-[15px] font-bold text-foreground">SSC Reasoning</h2>
          <p className="text-[11px] text-muted-foreground">Verbal, Non-Verbal & Analytical Reasoning for SSC</p>
        </div>
        {streak > 0 && (
          <div className="ml-auto flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/10 text-amber-500 text-[11px] font-bold">
            <Trophy className="w-3 h-3" /> {streak}🔥
          </div>
        )}
      </div>

      <div className="flex gap-1 px-4 py-2 border-b border-border/30 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setContent(""); setActiveTopic(null); setQuizQuestions([]); }}
            className={cn("px-3 py-1.5 rounded-lg text-[13px] font-medium whitespace-nowrap transition-all",
              tab === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/50")}>
            {t.emoji} {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {tab === "verbal" && !activeTopic && !loading && renderTopicGrid(VERBAL_TOPICS, "Verbal Reasoning")}
        {tab === "nonverbal" && !activeTopic && !loading && renderTopicGrid(NONVERBAL_TOPICS, "Non-Verbal Reasoning")}
        {tab === "analytical" && !activeTopic && !loading && renderTopicGrid(ANALYTICAL_TOPICS, "Analytical Reasoning")}

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
              <ArrowLeft className="w-3 h-3" /> Back
            </button>
            <h3 className="text-base font-bold text-foreground">{activeTopic}</h3>
            {STATIC_REASON[activeTopic] && (
              <div className="prose prose-sm dark:prose-invert max-w-none p-4 rounded-xl bg-primary/5 border border-primary/20">
                <div className="text-xs font-semibold text-primary mb-2 flex items-center gap-1">⚡ Quick Reference</div>
                <ReactMarkdown>{STATIC_REASON[activeTopic]}</ReactMarkdown>
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
