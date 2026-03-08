import { useState, useCallback } from "react";
import { ArrowLeft, Globe, Loader2, Brain, Trophy, RotateCcw, Landmark, Atom, Leaf, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";

type TabId = "history" | "polity" | "geography" | "science" | "current" | "quiz";
type QuizQ = { question: string; options: string[]; answer: number; explanation: string };

const TABS: { id: TabId; label: string; emoji: string }[] = [
  { id: "history", label: "History", emoji: "🏛️" },
  { id: "polity", label: "Polity", emoji: "⚖️" },
  { id: "geography", label: "Geography", emoji: "🌍" },
  { id: "science", label: "Science", emoji: "🔬" },
  { id: "current", label: "Current GK", emoji: "📰" },
  { id: "quiz", label: "Quiz", emoji: "🧠" },
];

const HISTORY_TOPICS = [
  "Ancient India", "Medieval India", "Modern India (1857-1947)",
  "Indian National Movement", "World History", "Art & Culture",
  "Indian Constitution History", "Important Dates & Events",
];

const POLITY_TOPICS = [
  "Indian Constitution", "Fundamental Rights & Duties",
  "Parliament & State Legislature", "President & Governor",
  "Supreme Court & High Courts", "Panchayati Raj",
  "Constitutional Amendments", "Important Articles",
  "Election Commission", "CAG & UPSC",
];

const GEOGRAPHY_TOPICS = [
  "Physical Geography of India", "Indian Rivers & Drainage",
  "Climate of India", "Soils & Natural Vegetation",
  "Indian Agriculture", "Minerals & Industries",
  "World Geography", "Maps & Important Places",
];

const SCIENCE_TOPICS = [
  "Physics (Mechanics, Light, Sound)", "Chemistry (Elements, Reactions)",
  "Biology (Human Body)", "Biology (Plants & Ecology)",
  "Computer & Technology", "Space & Astronomy",
  "Inventions & Discoveries", "Diseases & Nutrition",
];

const CURRENT_TOPICS = [
  "Awards & Honours 2024-25", "Government Schemes",
  "International Organizations", "Sports Events",
  "Books & Authors", "Summits & Conferences",
  "Important Appointments", "Defence & Security",
];

const QUIZ_TYPES = [
  "History & Culture", "Indian Polity", "Geography",
  "General Science", "Current Affairs", "Mixed GK (SSC/UPSC)",
  "Static GK", "Previous Year Questions",
];

const STATIC_GK: Record<string, string> = {
  "Ancient India": "**Key Facts:**\n- Indus Valley (3300-1300 BCE): Harappa, Mohenjo-daro\n- Vedic Period: Rigveda (oldest), 4 Vedas\n- Maurya Dynasty: Chandragupta → Ashoka (Dhamma)\n- Gupta Period: Golden Age of India\n- Important: Arthashastra (Kautilya), Nalanda University",
  "Indian Constitution": "**Key Articles:**\n| Article | Subject |\n|---------|--------|\n| 14 | Equality before law |\n| 19 | 6 Freedoms |\n| 21 | Right to Life |\n| 32 | Constitutional remedies |\n| 44 | Uniform Civil Code |\n| 370 | J&K (abrogated) |\n\n- Parts: 25, Schedules: 12, Articles: 448+\n- Borrowed from: UK, US, Ireland, Canada, Australia",
  "Fundamental Rights & Duties": "**6 Fundamental Rights (Part III):**\n1. Right to Equality (Art 14-18)\n2. Right to Freedom (Art 19-22)\n3. Right against Exploitation (Art 23-24)\n4. Right to Freedom of Religion (Art 25-28)\n5. Cultural & Educational Rights (Art 29-30)\n6. Right to Constitutional Remedies (Art 32)\n\n**11 Fundamental Duties (Art 51A)**\n- Added by 42nd Amendment (1976)",
  "Physical Geography of India": "**Quick Facts:**\n- Area: 3.28 million km², 7th largest\n- Latitudes: 8°4'N to 37°6'N\n- Longitudes: 68°7'E to 97°25'E\n- Highest: K2 (8611m), Kangchenjunga (8586m)\n- Physiographic divisions: 6 (Himalaya, Plains, Peninsula, Coast, Islands, Desert)",
  "Indian Rivers & Drainage": "**Major Rivers:**\n| River | Origin | Length |\n|-------|--------|--------|\n| Ganga | Gangotri | 2525 km |\n| Brahmaputra | Mansarovar | 2900 km |\n| Godavari | Nasik | 1465 km |\n| Krishna | Mahabaleshwar | 1400 km |\n| Narmada | Amarkantak | 1312 km |\n\n- West flowing: Narmada, Tapi (rift valleys)",
  "Physics (Mechanics, Light, Sound)": "**Key Laws:**\n- Newton's Laws: F=ma, Action=Reaction\n- Speed of light: 3×10⁸ m/s\n- Speed of sound (air): 343 m/s\n- Snell's law: n₁sinθ₁ = n₂sinθ₂\n- Mirror formula: 1/f = 1/v + 1/u\n- Doppler effect: Pitch changes with relative motion",
  "Biology (Human Body)": "**Systems:**\n- Blood groups: A, B, AB (universal recipient), O (universal donor)\n- Bones: 206 (adult), Muscles: 639\n- Largest organ: Skin\n- Largest gland: Liver\n- Smallest bone: Stapes (ear)\n- Chromosomes: 46 (23 pairs)\n- DNA discoverers: Watson & Crick (1953)",
};

async function streamAI(prompt: string, systemPrompt: string, onChunk: (text: string) => void) {
  const res = await supabase.functions.invoke("chat", {
    body: { messages: [{ role: "user", content: prompt }], model: "google/gemini-2.5-flash", systemPrompt },
  });
  if (res.data) {
    const reader = res.data.getReader?.();
    if (reader) {
      const decoder = new TextDecoder();
      let text = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        onChunk(text);
      }
    } else if (typeof res.data === "string") {
      onChunk(res.data);
    }
  }
}

export default function GKTool() {
  const [tab, setTab] = useState<TabId>("history");
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
    const sys = `You are a GK/General Awareness expert for competitive exams (SSC/UPSC/Banking). Explain "${topic}" under "${category}" with key facts, important points, tables, mnemonics, and exam-relevant details. Format with markdown. Add quick revision points at the end.`;
    await streamAI(`Explain "${topic}" for competitive exam GK preparation with key facts and revision notes.`, sys, setContent);
    setLoading(false);
  }, []);

  const startQuiz = useCallback(async (type: string) => {
    setLoading(true);
    setQuizQuestions([]);
    setQuizAnswers({});
    setQuizSubmitted(false);
    const sys = `You are a competitive exam GK quiz generator. Generate exactly 5 ${type} MCQ questions at SSC CGL/UPSC Prelims level. Return ONLY a JSON array: [{"question":"...","options":["A","B","C","D"],"answer":0,"explanation":"..."}]. answer is 0-indexed.`;
    let raw = "";
    await streamAI(`Generate 5 ${type} GK MCQ questions.`, sys, (t) => { raw = t; });
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
          <Landmark className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-[15px] font-bold text-foreground">General Knowledge</h2>
          <p className="text-[11px] text-muted-foreground">History, Polity, Geography, Science & Current Affairs</p>
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
        {tab === "history" && !activeTopic && !loading && renderTopicGrid(HISTORY_TOPICS, "History")}
        {tab === "polity" && !activeTopic && !loading && renderTopicGrid(POLITY_TOPICS, "Indian Polity")}
        {tab === "geography" && !activeTopic && !loading && renderTopicGrid(GEOGRAPHY_TOPICS, "Geography")}
        {tab === "science" && !activeTopic && !loading && renderTopicGrid(SCIENCE_TOPICS, "General Science")}
        {tab === "current" && !activeTopic && !loading && renderTopicGrid(CURRENT_TOPICS, "Current Affairs")}

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
            {STATIC_GK[activeTopic] && (
              <div className="prose prose-sm dark:prose-invert max-w-none p-4 rounded-xl bg-primary/5 border border-primary/20">
                <div className="text-xs font-semibold text-primary mb-2 flex items-center gap-1">⚡ Quick Reference</div>
                <ReactMarkdown>{STATIC_GK[activeTopic]}</ReactMarkdown>
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
            </button>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown>{content}</ReactMarkdown>
            </div>
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
