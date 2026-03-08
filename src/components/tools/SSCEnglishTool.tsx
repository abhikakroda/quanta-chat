import { useState, useCallback, useMemo } from "react";
import {
  ArrowLeft, BookOpen, Search, Sparkles, Loader2, ChevronRight,
  Volume2, CheckCircle2, XCircle, Star, Zap, Trophy, Brain,
  Bookmark, BookmarkCheck, RotateCcw
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";

type TabId = "vocab" | "grammar" | "comprehension" | "quiz" | "idioms";
type QuizQ = { question: string; options: string[]; answer: number; explanation: string };

const TABS: { id: TabId; label: string; emoji: string }[] = [
  { id: "vocab", label: "Vocabulary", emoji: "📖" },
  { id: "grammar", label: "Grammar", emoji: "✏️" },
  { id: "comprehension", label: "Reading", emoji: "📄" },
  { id: "quiz", label: "Quiz", emoji: "🧠" },
  { id: "idioms", label: "Idioms", emoji: "💬" },
];

const VOCAB_TOPICS = [
  "One Word Substitution", "Synonyms & Antonyms", "Spelling Correction",
  "Cloze Test Vocabulary", "Idioms & Phrases Meaning", "Foreign Words in English",
  "Homonyms & Homophones", "Word Formation & Roots",
];

const GRAMMAR_TOPICS = [
  "Tenses", "Active & Passive Voice", "Direct & Indirect Speech",
  "Subject-Verb Agreement", "Articles", "Prepositions",
  "Error Spotting", "Sentence Improvement", "Fill in the Blanks",
];

const COMPREHENSION_TOPICS = [
  "Reading Comprehension", "Para Jumbles", "Sentence Rearrangement",
  "Cloze Test", "Summary Writing",
];

const IDIOM_CATEGORIES = [
  "Body Parts Idioms", "Animal Idioms", "Color Idioms",
  "Food Idioms", "Nature Idioms", "Common Proverbs",
];

const STATIC_ENG: Record<string, string> = {
  "One Word Substitution": "**Common Examples:**\n| Phrase | One Word |\n|--------|----------|\n| One who loves mankind | Philanthropist |\n| One who hates mankind | Misanthrope |\n| One who can speak two languages | Bilingual |\n| A person who lives alone | Recluse |\n| Government by the people | Democracy |\n| Murder of a king | Regicide |",
  "Synonyms & Antonyms": "**High-Frequency SSC Words:**\n- Abandon → Forsake (S), Retain (A)\n- Benevolent → Kind (S), Malevolent (A)\n- Candid → Frank (S), Evasive (A)\n- Diligent → Industrious (S), Lazy (A)\n- Eloquent → Articulate (S), Inarticulate (A)\n- Frugal → Thrifty (S), Extravagant (A)",
  "Tenses": "**12 Tenses Quick Chart:**\n| Tense | Structure | Example |\n|-------|-----------|--------|\n| Simple Present | V1/V1+s | He goes |\n| Present Cont. | is/am/are+V-ing | He is going |\n| Present Perfect | has/have+V3 | He has gone |\n| Simple Past | V2 | He went |\n| Past Cont. | was/were+V-ing | He was going |\n| Past Perfect | had+V3 | He had gone |",
  "Active & Passive Voice": "**Formula:**\n- Active: Subject + Verb + Object\n- Passive: Object + be + V3 + by + Subject\n\n**Quick Rules:**\n- Simple Present: is/am/are + V3\n- Simple Past: was/were + V3\n- Future: will be + V3\n- Modal: Modal + be + V3",
  "Articles": "**Rules:**\n- 'A' before consonant sounds: a boy, a university\n- 'An' before vowel sounds: an hour, an MBA\n- 'The' for specific/unique: the sun, the Ganga\n- No article: proper nouns, meals, games, languages\n- Exception: the USA, the UK, the Himalayas",
  "Error Spotting": "**Common Errors:**\n1. Subject-Verb agreement: 'Each of the boys *are*' ❌ → '*is*' ✓\n2. Pronoun case: 'Between you and *I*' ❌ → '*me*' ✓\n3. Preposition: 'Comprise *of*' ❌ → 'Comprise' ✓\n4. Tense consistency: Don't mix past and present\n5. Double negatives: 'hardly *no*' ❌ → 'hardly *any*' ✓",
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

export default function SSCEnglishTool({ onBack }: { onBack: () => void }) {
  const [activeTab, setActiveTab] = useState<TabId>("vocab");
  const [aiContent, setAiContent] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);

  // Quiz
  const [quizQuestions, setQuizQuestions] = useState<QuizQ[]>([]);
  const [quizIdx, setQuizIdx] = useState(0);
  const [quizAnswer, setQuizAnswer] = useState<number | null>(null);
  const [quizScore, setQuizScore] = useState(0);
  const [quizStreak, setQuizStreak] = useState(0);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizFinished, setQuizFinished] = useState(false);
  const [quizCategory, setQuizCategory] = useState("Mixed");

  // Bookmarked words
  const [savedWords, setSavedWords] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("ssc_saved_words") || "[]"); } catch { return []; }
  });

  const saveWordsToStorage = (words: string[]) => {
    setSavedWords(words);
    localStorage.setItem("ssc_saved_words", JSON.stringify(words));
  };

  const handleTopicSelect = useCallback(async (topic: string, tab: TabId) => {
    setSelectedTopic(topic);
    setAiLoading(true);
    setAiContent("");

    const prompts: Record<string, string> = {
      vocab: `Generate SSC CGL/CHSL exam-focused content for "${topic}". Include:
- 15 important words with meanings, usage in sentences
- Previous year SSC exam examples where applicable
- Memory tricks/mnemonics for difficult words
- 5 practice questions in SSC exam format
Format with markdown tables, bold key terms.`,
      grammar: `Teach "${topic}" for SSC CGL/CHSL exam preparation. Include:
- Clear rules with examples
- Common errors students make
- Previous year SSC exam questions on this topic  
- 5 practice questions with answers and explanations
Use markdown formatting with tables where helpful.`,
      comprehension: `Provide a practice "${topic}" exercise in SSC CGL/CHSL exam format. Include:
- A passage or set of sentences (exam-level difficulty)
- 5 questions based on it with options
- Answers with detailed explanations
- Tips for solving quickly in exams`,
      idioms: `List 20 important "${topic}" for SSC exams. For each:
- The idiom/phrase
- Meaning
- Example sentence  
- SSC exam tip
Then add 5 MCQ practice questions from previous SSC exams. Use markdown tables.`,
    };

    try {
      await streamAI(
        prompts[tab] || prompts.vocab,
        "You are an expert SSC exam English tutor. Focus on SSC CGL, CHSL, MTS exam patterns. Use previous year questions where possible. Be accurate and exam-oriented.",
        (t) => setAiContent(t)
      );
    } catch { setAiContent("Failed to load. Please try again."); }
    finally { setAiLoading(false); }
  }, []);

  const startQuiz = useCallback(async (category: string) => {
    setQuizCategory(category);
    setQuizLoading(true);
    setQuizQuestions([]);
    setQuizIdx(0);
    setQuizAnswer(null);
    setQuizScore(0);
    setQuizStreak(0);
    setQuizFinished(false);
    try {
      await streamAI(
        `Generate exactly 10 SSC CGL/CHSL English ${category} MCQ questions based on previous year exam patterns.
Return ONLY a JSON array, no markdown, no code fences. Each object: {"question":"...","options":["A","B","C","D"],"answer":0,"explanation":"..."}
answer is the 0-based index. Make questions realistic SSC exam level.`,
        "You are an SSC exam question bank. Return only valid JSON array.",
        (text) => {
          try {
            const clean = text.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
            const parsed = JSON.parse(clean);
            if (Array.isArray(parsed) && parsed.length >= 1) setQuizQuestions(parsed);
          } catch { /* still streaming */ }
        }
      );
    } catch { /* error */ }
    finally { setQuizLoading(false); }
  }, []);

  const handleQuizAnswer = (idx: number) => {
    if (quizAnswer !== null) return;
    setQuizAnswer(idx);
    if (quizQuestions[quizIdx]?.answer === idx) { setQuizScore(s => s + 1); setQuizStreak(s => s + 1); }
    else setQuizStreak(0);
  };

  const nextQuestion = () => {
    if (quizIdx + 1 >= quizQuestions.length) { setQuizFinished(true); return; }
    setQuizIdx(i => i + 1);
    setQuizAnswer(null);
  };

  const currentQ = quizQuestions[quizIdx];

  const getTopics = () => {
    switch (activeTab) {
      case "vocab": return VOCAB_TOPICS;
      case "grammar": return GRAMMAR_TOPICS;
      case "comprehension": return COMPREHENSION_TOPICS;
      case "idioms": return IDIOM_CATEGORIES;
      default: return [];
    }
  };

  const QUIZ_CATEGORIES = ["Mixed", "Synonyms", "Antonyms", "One Word Substitution", "Error Spotting", "Idioms & Phrases", "Fill in the Blanks", "Sentence Improvement"];

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50 bg-card/50 backdrop-blur-sm shrink-0">
        <button onClick={selectedTopic ? () => { setSelectedTopic(null); setAiContent(""); } : onBack}
          className="p-1.5 rounded-lg hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="p-1.5 rounded-lg bg-primary/10"><BookOpen className="w-4 h-4 text-primary" /></div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-foreground truncate">SSC English & Vocabulary</h2>
            <p className="text-[10px] text-muted-foreground">CGL • CHSL • MTS Exam Prep</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-amber-500/10 border border-amber-500/20">
          <span className="text-[10px] font-semibold text-amber-500">SSC</span>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-border/40 bg-card/30 shrink-0 overflow-x-auto scrollbar-none">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => { setActiveTab(tab.id); setSelectedTopic(null); setAiContent(""); }}
            className={cn("flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-all border-b-2 whitespace-nowrap",
              activeTab === tab.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            )}>
            <span>{tab.emoji}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* ═══ QUIZ TAB ═══ */}
        {activeTab === "quiz" && (
          <div className="p-4 space-y-4">
            {quizQuestions.length === 0 && !quizLoading ? (
              <div className="space-y-4">
                <div className="flex flex-col items-center py-8 gap-3">
                  <div className="p-3 rounded-2xl bg-primary/10"><Brain className="w-8 h-8 text-primary" /></div>
                  <h3 className="text-base font-bold text-foreground">SSC English Quiz</h3>
                  <p className="text-xs text-muted-foreground text-center">Practice with previous year SSC exam questions</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {QUIZ_CATEGORIES.map(cat => (
                    <button key={cat} onClick={() => startQuiz(cat)}
                      className="px-3 py-3 rounded-xl bg-card border border-border/40 hover:border-primary/30 hover:bg-accent/30 transition-all text-left">
                      <span className="text-sm font-medium text-foreground">{cat}</span>
                      <p className="text-[10px] text-muted-foreground mt-0.5">10 questions</p>
                    </button>
                  ))}
                </div>
              </div>
            ) : quizLoading && quizQuestions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
                <p className="text-sm text-muted-foreground">Generating {quizCategory} questions…</p>
              </div>
            ) : quizFinished ? (
              <div className="flex flex-col items-center justify-center py-12 gap-4">
                <div className="p-4 rounded-2xl bg-amber-500/10"><Trophy className="w-10 h-10 text-amber-500" /></div>
                <h3 className="text-xl font-bold text-foreground">Quiz Complete!</h3>
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <div className="text-3xl font-extrabold text-primary">{quizScore}/{quizQuestions.length}</div>
                    <div className="text-xs text-muted-foreground">Score</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-extrabold text-amber-500">{Math.round((quizScore / quizQuestions.length) * 100)}%</div>
                    <div className="text-xs text-muted-foreground">Accuracy</div>
                  </div>
                </div>
                <button onClick={() => startQuiz(quizCategory)}
                  className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors mt-2 flex items-center gap-2">
                  <RotateCcw className="w-4 h-4" /> Play Again
                </button>
              </div>
            ) : currentQ ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-muted-foreground">{quizIdx + 1}/{quizQuestions.length}</span>
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary transition-all duration-300 rounded-full" style={{ width: `${((quizIdx + 1) / quizQuestions.length) * 100}%` }} />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Star className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-xs font-bold text-foreground">{quizScore}</span>
                  </div>
                  {quizStreak > 1 && <span className="px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-500 text-[10px] font-bold">🔥 {quizStreak}</span>}
                </div>
                <div className="rounded-xl p-4 border border-border/50 bg-card">
                  <span className="text-[10px] font-semibold text-primary uppercase tracking-wider">{quizCategory}</span>
                  <p className="text-sm font-semibold text-foreground mt-2 leading-relaxed">{currentQ.question}</p>
                </div>
                <div className="space-y-2">
                  {currentQ.options.map((opt, i) => {
                    const isSelected = quizAnswer === i;
                    const isCorrect = currentQ.answer === i;
                    const answered = quizAnswer !== null;
                    return (
                      <button key={i} onClick={() => handleQuizAnswer(i)} disabled={answered}
                        className={cn("w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left text-sm font-medium transition-all",
                          answered && isCorrect ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-600" :
                          answered && isSelected && !isCorrect ? "bg-destructive/10 border-destructive/40 text-destructive" :
                          answered ? "bg-card border-border/30 text-muted-foreground opacity-60" :
                          "bg-card border-border/50 text-foreground hover:border-primary/30 hover:bg-accent/30"
                        )}>
                        <span className={cn("w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 border",
                          answered && isCorrect ? "bg-emerald-500 text-emerald-50 border-emerald-500" :
                          answered && isSelected ? "bg-destructive text-destructive-foreground border-destructive" :
                          "bg-muted border-border text-muted-foreground"
                        )}>
                          {answered && isCorrect ? <CheckCircle2 className="w-3.5 h-3.5" /> :
                           answered && isSelected ? <XCircle className="w-3.5 h-3.5" /> :
                           String.fromCharCode(65 + i)}
                        </span>
                        <span className="flex-1">{opt}</span>
                      </button>
                    );
                  })}
                </div>
                {quizAnswer !== null && currentQ.explanation && (
                  <div className="rounded-xl p-3 bg-accent/30 border border-border/30">
                    <p className="text-xs text-muted-foreground"><strong className="text-foreground">Explanation:</strong> {currentQ.explanation}</p>
                  </div>
                )}
                {quizAnswer !== null && (
                  <button onClick={nextQuestion}
                    className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors">
                    {quizIdx + 1 >= quizQuestions.length ? "See Results" : "Next Question →"}
                  </button>
                )}
              </div>
            ) : null}
          </div>
        )}

        {/* ═══ TOPIC TABS (vocab, grammar, comprehension, idioms) ═══ */}
        {activeTab !== "quiz" && !selectedTopic && (
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-1 gap-1.5">
              {getTopics().map(topic => (
                <button key={topic} onClick={() => handleTopicSelect(topic, activeTab)}
                  className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-card border border-border/40 hover:border-primary/30 hover:bg-accent/30 transition-all text-left group">
                  <BookOpen className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                  <span className="text-sm font-medium text-foreground flex-1">{topic}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ═══ AI CONTENT ═══ */}
        {activeTab !== "quiz" && selectedTopic && (
          <div className="p-4 space-y-3">
            <div className="rounded-xl p-4 border border-border/50 bg-card">
              <div className="flex items-center gap-2">
                <span className="text-lg">{TABS.find(t => t.id === activeTab)?.emoji}</span>
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-foreground">{selectedTopic}</h3>
                  <p className="text-[10px] text-muted-foreground">SSC Exam • {TABS.find(t => t.id === activeTab)?.label}</p>
                </div>
                {aiLoading && <Loader2 className="w-4 h-4 text-primary animate-spin" />}
              </div>
            </div>
            <div className="rounded-xl border border-border/40 bg-card/50 p-4 min-h-[200px]">
              {aiContent ? (
                <div className="prose prose-sm dark:prose-invert max-w-none text-foreground prose-headings:text-foreground prose-strong:text-foreground prose-p:text-muted-foreground prose-li:text-muted-foreground prose-table:text-xs">
                  <ReactMarkdown>{aiContent}</ReactMarkdown>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Sparkles className="w-6 h-6 text-primary animate-pulse" />
                  <p className="text-xs text-muted-foreground">Generating SSC study material…</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
