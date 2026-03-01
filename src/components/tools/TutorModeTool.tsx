import { useState, useRef, useCallback } from "react";
import { BookOpen, Play, RotateCcw, ChevronDown, Loader2, CheckCircle2, XCircle, ArrowRight, Brain, Lightbulb, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserMemories } from "@/hooks/useUserMemories";

const SUBJECTS = [
  { id: "os", label: "Operating Systems", emoji: "🖥️" },
  { id: "dbms", label: "Database Systems", emoji: "🗄️" },
  { id: "networking", label: "Computer Networks", emoji: "🌐" },
  { id: "dsa", label: "Data Structures & Algo", emoji: "🧮" },
  { id: "react", label: "React", emoji: "⚛️" },
  { id: "javascript", label: "JavaScript", emoji: "📜" },
  { id: "python", label: "Python", emoji: "🐍" },
  { id: "system-design", label: "System Design", emoji: "🏗️" },
  { id: "ml", label: "Machine Learning", emoji: "🤖" },
  { id: "sql", label: "SQL", emoji: "📊" },
];

const DEPTH_LEVELS = [
  { id: "beginner", label: "Beginner", desc: "Basics & fundamentals" },
  { id: "intermediate", label: "Intermediate", desc: "Core concepts" },
  { id: "advanced", label: "Advanced", desc: "Deep dive" },
];

type TutorStep = {
  type: "question" | "evaluation" | "hint" | "explanation";
  content: string;
  score?: number;
  userAnswer?: string;
  status: "active" | "answered" | "evaluated";
};

export default function TutorModeTool() {
  const { user } = useAuth();
  const { upsertMemory, getMemoriesByCategory } = useUserMemories(user?.id);
  const [subject, setSubject] = useState("os");
  const [depth, setDepth] = useState("beginner");
  const [started, setStarted] = useState(false);
  const [steps, setSteps] = useState<TutorStep[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [questionCount, setQuestionCount] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [showSubjectPicker, setShowSubjectPicker] = useState(false);
  const [streakCount, setStreakCount] = useState(0);
  const [adaptedDepth, setAdaptedDepth] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const weakAreas = getMemoriesByCategory("weak_topics")
    .filter(m => m.key.includes(subject))
    .map(m => m.value);

  const learningStyle = getMemoriesByCategory("learning_style")
    .map(m => `${m.key}: ${m.value}`);

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
        skillPrompt: `You are a Socratic tutor. You NEVER give direct answers. Instead, you ask probing questions to guide the student to discover answers themselves. You adapt difficulty based on their responses. Be encouraging but rigorous.`,
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

  const generateQuestion = useCallback(async () => {
    setLoading(true);
    try {
      const subjectLabel = SUBJECTS.find(s => s.id === subject)?.label || subject;
      const currentDepth = adaptedDepth || depth;
      const prevQuestions = steps.filter(s => s.type === "question").map(s => s.content);
      const prevContext = prevQuestions.length > 0
        ? `\nPreviously asked (do NOT repeat):\n${prevQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n")}`
        : "";

      const weakContext = weakAreas.length > 0
        ? `\nStudent has struggled with: ${weakAreas.join(", ")}. Probe these areas.`
        : "";

      const styleContext = learningStyle.length > 0
        ? `\nLearning preferences: ${learningStyle.join("; ")}`
        : "";

      const prompt = `Generate ONE Socratic question to teach ${subjectLabel} at ${currentDepth} level.${prevContext}${weakContext}${styleContext}

Rules:
- Ask a thought-provoking question that tests understanding, not memorization
- The question should lead the student to discover a concept
- Make it specific and answerable in 2-4 sentences
- ${currentDepth === "beginner" ? "Use simple language, relatable analogies" : currentDepth === "advanced" ? "Ask about edge cases, tradeoffs, real-world scenarios" : "Focus on core mechanisms and why things work"}
- Just the question, nothing else`;

      const question = await callAI(prompt);
      setSteps(prev => [...prev, { type: "question", content: question, status: "active" }]);
      setQuestionCount(prev => prev + 1);
      scrollToBottom();
      setTimeout(() => textareaRef.current?.focus(), 200);
    } catch (err) {
      console.error("Question generation failed:", err);
    } finally {
      setLoading(false);
    }
  }, [subject, depth, adaptedDepth, steps, callAI, weakAreas, learningStyle]);

  const startSession = async () => {
    setStarted(true);
    setSteps([]);
    setQuestionCount(0);
    setCorrectCount(0);
    setStreakCount(0);
    setAdaptedDepth(null);
    await generateQuestion();
  };

  const submitAnswer = async () => {
    if (!currentAnswer.trim() || loading) return;
    const answer = currentAnswer;
    setCurrentAnswer("");

    // Mark current question as answered
    setSteps(prev => prev.map((s, i) =>
      i === prev.length - 1 ? { ...s, userAnswer: answer, status: "answered" as const } : s
    ));
    setLoading(true);
    scrollToBottom();

    try {
      const currentQ = steps[steps.length - 1];
      const subjectLabel = SUBJECTS.find(s => s.id === subject)?.label || subject;

      const prompt = `Evaluate this student's answer in a Socratic tutoring session on ${subjectLabel}.

Question: ${currentQ.content}
Student's Answer: ${answer}

Respond in EXACTLY this format:
SCORE: [1-10]
UNDERSTANDING: [STRONG|PARTIAL|WEAK]
RESPONSE: [Your Socratic response. If they got it right, acknowledge and ask a deeper follow-up. If partially right, give a hint and rephrase. If wrong, gently redirect with a simpler sub-question. 2-4 sentences max.]
CONCEPT: [The key concept being tested, in 5 words or less]`;

      const evaluation = await callAI(prompt);

      let score = 5;
      let understanding = "PARTIAL";
      let response = evaluation;
      let concept = "";

      const scoreMatch = evaluation.match(/SCORE:\s*(\d+)/i);
      const understandingMatch = evaluation.match(/UNDERSTANDING:\s*(STRONG|PARTIAL|WEAK)/i);
      const responseMatch = evaluation.match(/RESPONSE:\s*([\s\S]*?)(?=\nCONCEPT:|$)/i);
      const conceptMatch = evaluation.match(/CONCEPT:\s*(.+)/i);

      if (scoreMatch) score = Math.min(10, Math.max(1, parseInt(scoreMatch[1])));
      if (understandingMatch) understanding = understandingMatch[1];
      if (responseMatch) response = responseMatch[1].trim();
      if (conceptMatch) concept = conceptMatch[1].trim();

      const isCorrect = score >= 7;
      if (isCorrect) {
        setCorrectCount(prev => prev + 1);
        setStreakCount(prev => prev + 1);
      } else {
        setStreakCount(0);
      }

      // Adapt difficulty based on performance
      const newStreak = isCorrect ? streakCount + 1 : 0;
      if (newStreak >= 3 && (adaptedDepth || depth) !== "advanced") {
        const nextDepth = (adaptedDepth || depth) === "beginner" ? "intermediate" : "advanced";
        setAdaptedDepth(nextDepth);
        setSteps(prev => [
          ...prev,
          { type: "evaluation", content: response, score, status: "evaluated" as const, userAnswer: answer },
          { type: "hint", content: `📈 Great streak! Difficulty adapted to **${nextDepth}** level.`, status: "evaluated" as const },
        ]);
      } else if (!isCorrect && score <= 4 && (adaptedDepth || depth) !== "beginner") {
        const prevDepth = (adaptedDepth || depth) === "advanced" ? "intermediate" : "beginner";
        setAdaptedDepth(prevDepth);
        setSteps(prev => [
          ...prev,
          { type: "evaluation", content: response, score, status: "evaluated" as const, userAnswer: answer },
          { type: "hint", content: `📉 Let's slow down. Adjusting to **${prevDepth}** level to strengthen foundations.`, status: "evaluated" as const },
        ]);
      } else {
        setSteps(prev => [
          ...prev,
          { type: "evaluation", content: response, score, status: "evaluated" as const, userAnswer: answer },
        ]);
      }

      // Save weak concepts to memory
      if (score < 6 && concept) {
        const subjectLabel = SUBJECTS.find(s => s.id === subject)?.label || subject;
        upsertMemory(
          `weak_${subject}_${concept.slice(0, 20).replace(/\s+/g, "_").toLowerCase()}`,
          `${concept} — scored ${score}/10 in tutor mode (${subjectLabel})`,
          "weak_topics"
        );
      }

      // Save learning pattern
      if (questionCount > 0 && questionCount % 5 === 0) {
        const accuracy = Math.round((correctCount / questionCount) * 100);
        upsertMemory(
          `tutor_${subject}_accuracy`,
          `${accuracy}% accuracy over ${questionCount} questions at ${adaptedDepth || depth} level`,
          "learning_style"
        );
      }

      scrollToBottom();
    } catch (err) {
      console.error("Evaluation failed:", err);
      setSteps(prev => [
        ...prev,
        { type: "evaluation", content: "Evaluation failed. Let's try another question.", score: 0, status: "evaluated" as const },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const requestHint = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const currentQ = steps[steps.length - 1];
      const prompt = `The student is stuck on this question. Give a SHORT hint (1-2 sentences) that guides them WITHOUT revealing the answer.

Question: ${currentQ.content}

Just the hint, nothing else.`;
      const hint = await callAI(prompt);
      setSteps(prev => [...prev, { type: "hint", content: `💡 ${hint}`, status: "evaluated" as const }]);
      scrollToBottom();
    } catch (err) {
      console.error("Hint failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const resetSession = () => {
    setStarted(false);
    setSteps([]);
    setCurrentAnswer("");
    setQuestionCount(0);
    setCorrectCount(0);
    setStreakCount(0);
    setAdaptedDepth(null);
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return "text-green-500";
    if (score >= 5) return "text-yellow-500";
    return "text-destructive";
  };

  const accuracy = questionCount > 0 ? Math.round((correctCount / questionCount) * 100) : 0;
  const currentLevel = adaptedDepth || depth;

  // Setup screen
  if (!started) {
    return (
      <div className="max-w-lg mx-auto p-4 space-y-6 flex flex-col items-center justify-center h-full animate-message-in">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <Brain className="w-7 h-7 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-foreground">AI Tutor Mode</h2>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            The AI asks <span className="font-medium text-foreground">you</span> questions. Answer to learn — difficulty adapts to your level.
          </p>
        </div>

        <div className="w-full max-w-sm space-y-3">
          {/* Subject picker */}
          <div className="relative">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Subject</label>
            <button
              onClick={() => setShowSubjectPicker(!showSubjectPicker)}
              className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border border-border bg-card text-sm text-foreground hover:bg-accent transition-colors"
            >
              <span>{SUBJECTS.find(s => s.id === subject)?.emoji} {SUBJECTS.find(s => s.id === subject)?.label}</span>
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            </button>
            {showSubjectPicker && (
              <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-popover border border-border rounded-xl shadow-lg p-1 max-h-[240px] overflow-y-auto">
                {SUBJECTS.map(s => (
                  <button
                    key={s.id}
                    onClick={() => { setSubject(s.id); setShowSubjectPicker(false); }}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2",
                      s.id === subject ? "bg-primary/10 text-primary font-medium" : "text-foreground/70 hover:bg-muted"
                    )}
                  >
                    <span>{s.emoji}</span>
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Depth level */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Starting Depth</label>
            <div className="space-y-1.5">
              {DEPTH_LEVELS.map(d => (
                <button
                  key={d.id}
                  onClick={() => setDepth(d.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm border transition-colors text-left",
                    depth === d.id
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-muted"
                  )}
                >
                  <span className="font-medium flex-1">{d.label}</span>
                  <span className="text-[11px] text-muted-foreground">{d.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={startSession}
            className="w-full mt-4 px-4 py-3 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
          >
            <Play className="w-4 h-4" />
            Start Learning Session
          </button>
        </div>
      </div>
    );
  }

  // Active tutoring session
  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-border/40">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">
            {SUBJECTS.find(s => s.id === subject)?.emoji} {SUBJECTS.find(s => s.id === subject)?.label}
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium capitalize">
            {currentLevel}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {questionCount > 0 && (
            <>
              <span className="text-[11px] text-muted-foreground font-mono">{accuracy}% acc</span>
              {streakCount >= 2 && (
                <span className="text-[11px] text-primary font-bold">🔥 {streakCount}</span>
              )}
            </>
          )}
          <span className="text-xs text-muted-foreground">Q{questionCount}</span>
          <button onClick={resetSession} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Reset">
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Conversation */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {steps.map((step, i) => (
          <div key={i} className="animate-message-in">
            {step.type === "question" && (
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 mt-0.5">
                  <Target className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 px-3.5 py-2.5 rounded-2xl rounded-tl-md bg-card border border-border/40 shadow-elegant">
                  <p className="text-sm leading-relaxed text-foreground">{step.content}</p>
                </div>
              </div>
            )}

            {step.type === "evaluation" && (
              <div className="space-y-2">
                {/* User's answer */}
                {step.userAnswer && (
                  <div className="flex gap-3 justify-end">
                    <div className="px-3.5 py-2.5 rounded-2xl rounded-tr-md bg-muted max-w-[80%]">
                      <p className="text-sm text-foreground/80 whitespace-pre-wrap">{step.userAnswer}</p>
                    </div>
                  </div>
                )}
                {/* AI evaluation */}
                <div className="flex gap-3">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{
                    background: step.score && step.score >= 7 ? "hsl(140 50% 92%)" : step.score && step.score >= 5 ? "hsl(45 80% 90%)" : "hsl(0 60% 92%)"
                  }}>
                    {step.score && step.score >= 7 ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-destructive" />
                    )}
                  </div>
                  <div className="flex-1 px-3.5 py-2.5 rounded-2xl rounded-tl-md bg-card border border-border/40">
                    {step.score !== undefined && (
                      <span className={cn("text-xs font-bold mr-2", getScoreColor(step.score))}>
                        {step.score}/10
                      </span>
                    )}
                    <p className="text-sm leading-relaxed text-foreground/80 inline">{step.content}</p>
                  </div>
                </div>
              </div>
            )}

            {step.type === "hint" && (
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center shrink-0 mt-0.5">
                  <Lightbulb className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <div className="flex-1 px-3.5 py-2 rounded-2xl rounded-tl-md bg-accent/50 border border-border/20">
                  <p className="text-sm text-muted-foreground leading-relaxed">{step.content}</p>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Active answer input */}
        {steps.length > 0 && steps[steps.length - 1].type === "question" && steps[steps.length - 1].status === "active" && (
          <div className="space-y-2 pl-10 animate-message-in">
            <textarea
              ref={textareaRef}
              value={currentAnswer}
              onChange={(e) => setCurrentAnswer(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  submitAnswer();
                }
              }}
              placeholder="Type your answer… (⌘+Enter to submit)"
              className="w-full resize-none bg-muted/30 border border-border rounded-xl outline-none text-sm text-foreground p-3 min-h-[80px] max-h-[180px] focus:border-primary/30 transition-colors placeholder:text-muted-foreground/50"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={submitAnswer}
                disabled={!currentAnswer.trim() || loading}
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-30 flex items-center gap-1.5"
              >
                Submit
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={requestHint}
                disabled={loading}
                className="px-3 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted transition-colors disabled:opacity-30 flex items-center gap-1.5"
              >
                <Lightbulb className="w-3.5 h-3.5" />
                Hint
              </button>
            </div>
          </div>
        )}

        {/* Next question button */}
        {!loading && steps.length > 0 && steps[steps.length - 1].type === "evaluation" && (
          <div className="flex justify-center pt-2">
            <button
              onClick={generateQuestion}
              className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-2"
            >
              Next Question
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            {steps.length > 0 && steps[steps.length - 1].status === "answered" ? "Evaluating..." : "Thinking of a question..."}
          </div>
        )}
      </div>
    </div>
  );
}
