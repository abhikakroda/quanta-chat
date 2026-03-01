import { useState, useRef, useCallback } from "react";
import { Mic, Play, RotateCcw, ChevronDown, Loader2, CheckCircle2, XCircle, ArrowRight, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

const TOPICS = [
  { id: "react", label: "React" },
  { id: "javascript", label: "JavaScript" },
  { id: "typescript", label: "TypeScript" },
  { id: "system-design", label: "System Design" },
  { id: "dsa", label: "DSA" },
  { id: "python", label: "Python" },
  { id: "sql", label: "SQL" },
  { id: "devops", label: "DevOps" },
  { id: "behavioral", label: "Behavioral" },
];

const LEVELS = [
  { id: "junior", label: "Junior" },
  { id: "mid", label: "Mid-Level" },
  { id: "senior", label: "Senior" },
];

type Round = {
  question: string;
  answer: string;
  score: number | null;
  feedback: string;
  status: "asking" | "answering" | "evaluating" | "evaluated";
};

export default function InterviewSimulatorTool() {
  const [topic, setTopic] = useState("react");
  const [level, setLevel] = useState("mid");
  const [started, setStarted] = useState(false);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [finished, setFinished] = useState(false);
  const [showTopicPicker, setShowTopicPicker] = useState(false);
  const [showLevelPicker, setShowLevelPicker] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const totalQuestions = 5;

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
        skillPrompt: "You are a strict technical interviewer. Follow instructions exactly. Be concise.",
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

  const generateQuestion = useCallback(async (roundNum: number, previousQs: string[]) => {
    setLoading(true);
    try {
      const prevContext = previousQs.length > 0
        ? `\nPreviously asked (do NOT repeat these):\n${previousQs.map((q, i) => `${i + 1}. ${q}`).join("\n")}`
        : "";

      const prompt = `Generate exactly ONE ${level}-level ${TOPICS.find(t => t.id === topic)?.label} interview question. Question ${roundNum} of ${totalQuestions}.${prevContext}

Rules:
- Ask a clear, specific technical question
- Appropriate for ${level} level
- Just the question, nothing else
- No numbering, no prefix`;

      const question = await callAI(prompt);

      setRounds(prev => [...prev, {
        question,
        answer: "",
        score: null,
        feedback: "",
        status: "answering",
      }]);
      scrollToBottom();
      setTimeout(() => textareaRef.current?.focus(), 200);
    } catch (err: any) {
      console.error("Question generation failed:", err);
    } finally {
      setLoading(false);
    }
  }, [topic, level, callAI]);

  const startInterview = async () => {
    setStarted(true);
    setRounds([]);
    setFinished(false);
    await generateQuestion(1, []);
  };

  const submitAnswer = async () => {
    if (!currentAnswer.trim()) return;
    const roundIdx = rounds.length - 1;
    const round = rounds[roundIdx];

    setRounds(prev => prev.map((r, i) => i === roundIdx ? { ...r, answer: currentAnswer, status: "evaluating" } : r));
    setLoading(true);

    try {
      const prompt = `Evaluate this ${level}-level ${TOPICS.find(t => t.id === topic)?.label} interview answer.

Question: ${round.question}

Candidate's Answer: ${currentAnswer}

Respond in EXACTLY this format (no deviations):
SCORE: [number 1-10]
FEEDBACK: [2-3 sentences of constructive feedback. What was good, what could improve, and the key point they should know.]`;

      const evaluation = await callAI(prompt);

      let score = 5;
      let feedback = evaluation;
      const scoreMatch = evaluation.match(/SCORE:\s*(\d+)/i);
      const feedbackMatch = evaluation.match(/FEEDBACK:\s*([\s\S]+)/i);
      if (scoreMatch) score = Math.min(10, Math.max(1, parseInt(scoreMatch[1])));
      if (feedbackMatch) feedback = feedbackMatch[1].trim();

      setRounds(prev => prev.map((r, i) =>
        i === roundIdx ? { ...r, answer: currentAnswer, score, feedback, status: "evaluated" } : r
      ));
      setCurrentAnswer("");
      scrollToBottom();

      // Check if interview is complete
      if (rounds.length >= totalQuestions) {
        setFinished(true);
      }
    } catch (err: any) {
      console.error("Evaluation failed:", err);
      setRounds(prev => prev.map((r, i) =>
        i === roundIdx ? { ...r, answer: currentAnswer, score: 0, feedback: "Evaluation failed. Try again.", status: "evaluated" } : r
      ));
    } finally {
      setLoading(false);
    }
  };

  const nextQuestion = async () => {
    const previousQs = rounds.map(r => r.question);
    await generateQuestion(rounds.length + 1, previousQs);
  };

  const resetInterview = () => {
    setStarted(false);
    setRounds([]);
    setCurrentAnswer("");
    setFinished(false);
  };

  const avgScore = rounds.filter(r => r.score !== null).length > 0
    ? (rounds.reduce((sum, r) => sum + (r.score || 0), 0) / rounds.filter(r => r.score !== null).length).toFixed(1)
    : null;

  const getScoreColor = (score: number) => {
    if (score >= 8) return "text-green-500";
    if (score >= 5) return "text-yellow-500";
    return "text-destructive";
  };

  // Setup screen
  if (!started) {
    return (
      <div className="max-w-lg mx-auto p-4 space-y-6 animate-fade-in flex flex-col items-center justify-center h-full">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <Mic className="w-7 h-7 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Interview Simulator</h2>
          <p className="text-sm text-muted-foreground">Practice technical interviews with AI evaluation</p>
        </div>

        <div className="w-full max-w-sm space-y-3">
          {/* Topic picker */}
          <div className="relative">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Topic</label>
            <button
              onClick={() => { setShowTopicPicker(!showTopicPicker); setShowLevelPicker(false); }}
              className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border border-border bg-card text-sm text-foreground hover:bg-accent transition-colors"
            >
              <span>{TOPICS.find(t => t.id === topic)?.label}</span>
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            </button>
            {showTopicPicker && (
              <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-popover border border-border rounded-xl shadow-lg p-1 max-h-[200px] overflow-y-auto">
                {TOPICS.map(t => (
                  <button
                    key={t.id}
                    onClick={() => { setTopic(t.id); setShowTopicPicker(false); }}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
                      t.id === topic ? "bg-primary/10 text-primary font-medium" : "text-foreground/70 hover:bg-muted"
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Level picker */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Difficulty</label>
            <div className="flex gap-2">
              {LEVELS.map(l => (
                <button
                  key={l.id}
                  onClick={() => setLevel(l.id)}
                  className={cn(
                    "flex-1 px-3 py-2 rounded-xl text-sm font-medium border transition-colors",
                    level === l.id
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-muted"
                  )}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={startInterview}
            className="w-full mt-4 px-4 py-3 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
          >
            <Play className="w-4 h-4" />
            Start Interview ({totalQuestions} questions)
          </button>
        </div>
      </div>
    );
  }

  // Interview in progress
  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-border/40">
        <div className="flex items-center gap-2">
          <Mic className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">
            {TOPICS.find(t => t.id === topic)?.label} · {LEVELS.find(l => l.id === level)?.label}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {rounds.filter(r => r.status === "evaluated").length}/{totalQuestions}
          </span>
          {avgScore && (
            <span className={cn("text-xs font-bold", getScoreColor(parseFloat(avgScore)))}>
              Avg: {avgScore}/10
            </span>
          )}
          <button onClick={resetInterview} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Reset">
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Rounds */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {rounds.map((round, i) => (
          <div key={i} className="space-y-3 animate-fade-in">
            {/* Question */}
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                Q{i + 1}
              </div>
              <div className="flex-1">
                <p className="text-sm leading-relaxed text-foreground">{round.question}</p>
              </div>
            </div>

            {/* Answer */}
            {round.answer && (
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                  A
                </div>
                <div className="flex-1 px-3 py-2.5 rounded-xl bg-muted/50 border border-border/30">
                  <p className="text-sm text-foreground/80 whitespace-pre-wrap">{round.answer}</p>
                </div>
              </div>
            )}

            {/* Evaluation */}
            {round.status === "evaluating" && (
              <div className="flex items-center gap-2 ml-10 text-xs text-muted-foreground">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Evaluating your answer...
              </div>
            )}

            {round.status === "evaluated" && round.score !== null && (
              <div className="ml-10 px-3 py-2.5 rounded-xl border border-border/30 bg-card space-y-1.5">
                <div className="flex items-center gap-2">
                  {round.score >= 7 ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-destructive shrink-0" />
                  )}
                  <span className={cn("text-sm font-bold", getScoreColor(round.score))}>
                    {round.score}/10
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{round.feedback}</p>
              </div>
            )}
          </div>
        ))}

        {/* Answer input for current question */}
        {rounds.length > 0 && rounds[rounds.length - 1].status === "answering" && (
          <div className="space-y-2 ml-10 animate-fade-in">
            <textarea
              ref={textareaRef}
              value={currentAnswer}
              onChange={(e) => setCurrentAnswer(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.metaKey) {
                  e.preventDefault();
                  submitAnswer();
                }
              }}
              placeholder="Type your answer... (⌘+Enter to submit)"
              className="w-full resize-none bg-muted/30 border border-border rounded-xl outline-none text-sm text-foreground p-3 min-h-[100px] max-h-[200px] focus:border-primary/30 transition-colors placeholder:text-muted-foreground/50"
            />
            <button
              onClick={submitAnswer}
              disabled={!currentAnswer.trim() || loading}
              className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-30 flex items-center gap-1.5"
            >
              Submit Answer
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Next question / Finish */}
        {!loading && rounds.length > 0 && rounds[rounds.length - 1].status === "evaluated" && !finished && (
          <div className="flex justify-center pt-2">
            <button
              onClick={nextQuestion}
              className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-2"
            >
              Next Question
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Loading question */}
        {loading && rounds[rounds.length - 1]?.status !== "evaluating" && (
          <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Generating question...
          </div>
        )}

        {/* Final results */}
        {finished && (
          <div className="text-center py-6 space-y-4 animate-fade-in">
            <Trophy className="w-10 h-10 text-primary mx-auto" />
            <div>
              <h3 className="text-lg font-bold text-foreground">Interview Complete!</h3>
              <p className="text-sm text-muted-foreground mt-1">
                You scored an average of{" "}
                <span className={cn("font-bold", getScoreColor(parseFloat(avgScore || "0")))}>
                  {avgScore}/10
                </span>
              </p>
            </div>
            <div className="flex gap-2 justify-center">
              <button
                onClick={resetInterview}
                className="px-4 py-2 rounded-xl border border-border text-sm text-foreground hover:bg-muted transition-colors flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Try Again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
