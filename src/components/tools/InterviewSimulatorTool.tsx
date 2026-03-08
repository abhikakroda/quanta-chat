import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, MicOff, Play, RotateCcw, ChevronDown, Loader2, CheckCircle2, XCircle, ArrowRight, Trophy, Timer, Maximize2, Minimize2, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { getMicErrorMessage } from "@/lib/micErrors";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserMemories, buildInterviewMemory } from "@/hooks/useUserMemories";

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

const TIME_LIMITS = [
  { id: 60, label: "1 min" },
  { id: 120, label: "2 min" },
  { id: 180, label: "3 min" },
  { id: 300, label: "5 min" },
  { id: 0, label: "No limit" },
];

type Round = {
  question: string;
  answer: string;
  score: number | null;
  feedback: string;
  status: "asking" | "answering" | "evaluating" | "evaluated";
  timeUsed: number;
};

// ── Countdown Timer Hook ──
function useCountdown(seconds: number, active: boolean, onExpire: () => void) {
  const [remaining, setRemaining] = useState(seconds);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    setRemaining(seconds);
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!active || seconds === 0) return;
    startTimeRef.current = Date.now();
    intervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      const left = Math.max(0, seconds - elapsed);
      setRemaining(left);
      if (left <= 0) {
        clearInterval(intervalRef.current!);
        onExpire();
      }
    }, 250);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [seconds, active]);

  const elapsed = seconds > 0 ? seconds - remaining : 0;
  return { remaining, elapsed };
}

// ── Timer Display ──
function TimerDisplay({ remaining, total }: { remaining: number; total: number }) {
  if (total === 0) return null;
  const pct = (remaining / total) * 100;
  const urgent = remaining <= 10;
  const mm = Math.floor(remaining / 60);
  const ss = remaining % 60;
  return (
    <div className="flex items-center gap-2">
      <div className="relative w-20 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-300", urgent ? "bg-destructive" : "bg-primary")}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={cn("text-xs font-mono font-bold tabular-nums", urgent ? "text-destructive animate-pulse" : "text-muted-foreground")}>
        {mm}:{ss.toString().padStart(2, "0")}
      </span>
    </div>
  );
}

// ── Score Badge ──
function ScoreBadge({ score }: { score: number }) {
  const color = score >= 8 ? "text-green-500" : score >= 5 ? "text-yellow-500" : "text-destructive";
  return (
    <span className={cn("text-sm font-bold", color)}>{score}/10</span>
  );
}

export default function InterviewSimulatorTool() {
  const { user } = useAuth();
  const { upsertMemory, getMemoriesByCategory } = useUserMemories(user?.id);
  const [topic, setTopic] = useState("react");
  const [level, setLevel] = useState("mid");
  const [timeLimit, setTimeLimit] = useState(120);
  const [started, setStarted] = useState(false);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [finished, setFinished] = useState(false);
  const [showTopicPicker, setShowTopicPicker] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [timerActive, setTimerActive] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const totalQuestions = 5;

  const pastWeakAreas = getMemoriesByCategory("weak_topics")
    .filter(m => m.key.includes(topic))
    .map(m => m.value);

  // Past interview scores for improvement tracking
  const pastScores = getMemoriesByCategory("interview_performance")
    .filter(m => m.key.includes(topic))
    .map(m => parseFloat(m.value))
    .filter(v => !isNaN(v));

  const scrollToBottom = () => {
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }), 100);
  };

  const handleTimerExpire = useCallback(() => {
    setTimerActive(false);
    // Auto-submit if there's content
    if (currentAnswer.trim()) {
      submitAnswerRef.current?.();
    }
  }, [currentAnswer]);

  const { remaining, elapsed } = useCountdown(timeLimit, timerActive, handleTimerExpire);

  const toggleFullscreen = () => {
    if (!fullscreen) {
      containerRef.current?.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
    setFullscreen(!fullscreen);
  };

  useEffect(() => {
    const handler = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // ── Audio Recording ──
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        await transcribeAudio(blob);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
    } catch (err) {
      console.error("Mic error:", err);
      setError(getMicErrorMessage(err));
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  const transcribeAudio = async (blob: Blob) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;
      const formData = new FormData();
      formData.append("file", blob, "answer.webm");
      formData.append("language", "en-IN");
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sarvam-stt`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: formData,
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.transcript) {
          setCurrentAnswer(prev => prev ? `${prev} ${data.transcript}` : data.transcript);
        }
      }
    } catch (err) {
      console.error("Transcription failed:", err);
    }
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

      const weakContext = pastWeakAreas.length > 0
        ? `\nThe candidate has previously struggled with: ${pastWeakAreas.join(", ")}. Consider testing these weak areas.`
        : "";

      const prompt = `Generate exactly ONE ${level}-level ${TOPICS.find(t => t.id === topic)?.label} interview question. Question ${roundNum} of ${totalQuestions}.${prevContext}${weakContext}

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
        timeUsed: 0,
      }]);
      setTimerActive(true);
      scrollToBottom();
      setTimeout(() => textareaRef.current?.focus(), 200);
    } catch (err: any) {
      console.error("Question generation failed:", err);
    } finally {
      setLoading(false);
    }
  }, [topic, level, callAI, pastWeakAreas]);

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
    const timeUsed = elapsed;

    setTimerActive(false);
    if (recording) stopRecording();

    setRounds(prev => prev.map((r, i) => i === roundIdx ? { ...r, answer: currentAnswer, status: "evaluating", timeUsed } : r));
    setLoading(true);

    try {
      const prompt = `Evaluate this ${level}-level ${TOPICS.find(t => t.id === topic)?.label} interview answer.

Question: ${round.question}

Candidate's Answer: ${currentAnswer}

Time taken: ${timeUsed} seconds${timeLimit > 0 ? ` (limit: ${timeLimit}s)` : ""}

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
        i === roundIdx ? { ...r, answer: currentAnswer, score, feedback, status: "evaluated", timeUsed } : r
      ));
      setCurrentAnswer("");
      scrollToBottom();

      if (rounds.length >= totalQuestions) {
        setFinished(true);
        const allRounds = [...rounds.slice(0, -1), { ...round, answer: currentAnswer, score, feedback, status: "evaluated" as const, timeUsed }];
        const scores = allRounds.filter(r => r.score !== null);
        const avg = scores.length > 0 ? scores.reduce((s, r) => s + (r.score || 0), 0) / scores.length : 0;
        const weakQs = allRounds.filter(r => (r.score || 0) < 6).map(r => r.question);
        const topicLabel = TOPICS.find(t => t.id === topic)?.label || topic;
        const mems = buildInterviewMemory(topicLabel, level, Math.round(avg * 10) / 10, weakQs);
        for (const m of mems) {
          upsertMemory(m.key, m.value, m.category);
        }
      }
    } catch (err: any) {
      console.error("Evaluation failed:", err);
      setRounds(prev => prev.map((r, i) =>
        i === roundIdx ? { ...r, answer: currentAnswer, score: 0, feedback: "Evaluation failed. Try again.", status: "evaluated", timeUsed } : r
      ));
    } finally {
      setLoading(false);
    }
  };

  // Ref for timer expiry callback
  const submitAnswerRef = useRef(submitAnswer);
  submitAnswerRef.current = submitAnswer;

  const nextQuestion = async () => {
    const previousQs = rounds.map(r => r.question);
    await generateQuestion(rounds.length + 1, previousQs);
  };

  const resetInterview = () => {
    setStarted(false);
    setRounds([]);
    setCurrentAnswer("");
    setFinished(false);
    setTimerActive(false);
    if (recording) stopRecording();
    if (fullscreen) document.exitFullscreen?.().catch(() => {});
  };

  const avgScore = rounds.filter(r => r.score !== null).length > 0
    ? (rounds.reduce((sum, r) => sum + (r.score || 0), 0) / rounds.filter(r => r.score !== null).length).toFixed(1)
    : null;

  const getScoreColor = (score: number) => {
    if (score >= 8) return "text-green-500";
    if (score >= 5) return "text-yellow-500";
    return "text-destructive";
  };

  const improvement = avgScore && pastScores.length > 0
    ? parseFloat(avgScore) - pastScores[pastScores.length - 1]
    : null;

  // ── Setup Screen ──
  if (!started) {
    return (
      <div ref={containerRef} className="max-w-lg mx-auto p-4 space-y-6 animate-fade-in flex flex-col items-center justify-center h-full">
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
              onClick={() => setShowTopicPicker(!showTopicPicker)}
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

          {/* Timer picker */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              <Timer className="w-3 h-3 inline mr-1" />
              Time per question
            </label>
            <div className="flex gap-1.5 flex-wrap">
              {TIME_LIMITS.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTimeLimit(t.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                    timeLimit === t.id
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-muted"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Past performance */}
          {pastScores.length > 0 && (
            <div className="px-3 py-2.5 rounded-xl bg-muted/50 border border-border/30">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Last score: <strong className={getScoreColor(pastScores[pastScores.length - 1])}>{pastScores[pastScores.length - 1]}/10</strong></span>
                <span className="text-muted-foreground/50">·</span>
                <span>{pastScores.length} session{pastScores.length > 1 ? "s" : ""}</span>
              </div>
            </div>
          )}

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

  // ── Interview in Progress ──
  return (
    <div ref={containerRef} className={cn("flex flex-col h-full max-w-2xl mx-auto", fullscreen && "bg-background fixed inset-0 z-50 max-w-none p-0")}>
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-border/40">
        <div className="flex items-center gap-2">
          <Mic className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">
            {TOPICS.find(t => t.id === topic)?.label} · {LEVELS.find(l => l.id === level)?.label}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {timerActive && <TimerDisplay remaining={remaining} total={timeLimit} />}
          <span className="text-xs text-muted-foreground">
            {rounds.filter(r => r.status === "evaluated").length}/{totalQuestions}
          </span>
          {avgScore && (
            <span className={cn("text-xs font-bold", getScoreColor(parseFloat(avgScore)))}>
              Avg: {avgScore}/10
            </span>
          )}
          <button onClick={toggleFullscreen} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title={fullscreen ? "Exit fullscreen" : "Fullscreen"}>
            {fullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
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
                  {round.timeUsed > 0 && (
                    <p className="text-[10px] text-muted-foreground/50 mt-1 flex items-center gap-1">
                      <Timer className="w-2.5 h-2.5" />
                      {Math.floor(round.timeUsed / 60)}:{(round.timeUsed % 60).toString().padStart(2, "0")}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Evaluating */}
            {round.status === "evaluating" && (
              <div className="flex items-center gap-2 ml-10 text-xs text-muted-foreground">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Evaluating your answer...
              </div>
            )}

            {/* Evaluated */}
            {round.status === "evaluated" && round.score !== null && (
              <div className="ml-10 px-3 py-2.5 rounded-xl border border-border/30 bg-card space-y-1.5">
                <div className="flex items-center gap-2">
                  {round.score >= 7 ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-destructive shrink-0" />
                  )}
                  <ScoreBadge score={round.score} />
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{round.feedback}</p>
              </div>
            )}
          </div>
        ))}

        {/* Answer input */}
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
                onClick={recording ? stopRecording : startRecording}
                className={cn(
                  "p-2 rounded-xl border transition-colors flex items-center gap-1.5 text-sm",
                  recording
                    ? "border-destructive/30 bg-destructive/10 text-destructive"
                    : "border-border text-muted-foreground hover:bg-muted"
                )}
                title={recording ? "Stop recording" : "Record answer"}
              >
                {recording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                <span className="text-xs">{recording ? "Stop" : "Voice"}</span>
              </button>
            </div>
          </div>
        )}

        {/* Next question */}
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
              {improvement !== null && (
                <p className="text-xs mt-2 flex items-center justify-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span className={cn("font-semibold", improvement > 0 ? "text-green-500" : improvement < 0 ? "text-destructive" : "text-muted-foreground")}>
                    {improvement > 0 ? "+" : ""}{improvement.toFixed(1)} vs last session
                  </span>
                </p>
              )}
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
