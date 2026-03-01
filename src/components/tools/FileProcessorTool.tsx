import { useState, useCallback, useRef } from "react";
import { FileText, Upload, Loader2, BookOpen, StickyNote, Layers, HelpCircle, ChevronDown, ChevronUp, Copy, Check, RotateCcw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

type Mode = "summary" | "notes" | "flashcards" | "quiz";

type FlashCard = { q: string; a: string; difficulty: string };
type QuizQuestion = { q: string; options: string[]; correct: string; explanation: string };
type NoteSection = { heading: string; notes: string[]; takeaway: string };

const MODES: { id: Mode; icon: typeof BookOpen; label: string; desc: string }[] = [
  { id: "summary", icon: BookOpen, label: "Summary", desc: "Comprehensive overview" },
  { id: "notes", icon: StickyNote, label: "Study Notes", desc: "Structured notes" },
  { id: "flashcards", icon: Layers, label: "Flashcards", desc: "Memorization cards" },
  { id: "quiz", icon: HelpCircle, label: "Quiz", desc: "Test comprehension" },
];

const ACCEPTED = ".txt,.md,.js,.ts,.tsx,.jsx,.py,.java,.go,.rs,.c,.cpp,.h,.css,.html,.json,.xml,.csv,.yaml,.yml,.toml,.sql,.sh,.rb,.php,.swift,.kt,.r,.m,.env,.gitignore,.dockerfile";

function parseFlashcards(raw: string): FlashCard[] {
  const section = raw.match(/===FLASHCARDS===\s*([\s\S]*?)$/)?.[1] || raw;
  return section.split("---").map(block => {
    const q = block.match(/Q:\s*(.+)/i)?.[1]?.trim() || "";
    const a = block.match(/A:\s*(.+)/i)?.[1]?.trim() || "";
    const d = block.match(/DIFFICULTY:\s*(.+)/i)?.[1]?.trim() || "medium";
    return { q, a, difficulty: d.toLowerCase() };
  }).filter(c => c.q && c.a);
}

function parseQuiz(raw: string): { title: string; questions: QuizQuestion[] } {
  const title = raw.match(/TITLE:\s*(.+)/i)?.[1]?.trim() || "Quiz";
  const qBlocks = raw.split("---").filter(b => b.match(/Q\d+:/i));
  const questions = qBlocks.map(block => {
    const q = block.match(/Q\d+:\s*(.+)/i)?.[1]?.trim() || "";
    const options = ["A", "B", "C", "D"].map(l =>
      block.match(new RegExp(`${l}\\)\\s*(.+)`, "i"))?.[1]?.trim() || ""
    ).filter(Boolean);
    const correct = block.match(/CORRECT:\s*(.)/i)?.[1]?.trim().toUpperCase() || "A";
    const explanation = block.match(/EXPLANATION:\s*(.+)/i)?.[1]?.trim() || "";
    return { q, options, correct, explanation };
  }).filter(q => q.q && q.options.length >= 2);
  return { title, questions };
}

function parseNotes(raw: string): { title: string; sections: NoteSection[]; connections: string[]; actions: string[] } {
  const title = raw.match(/===TITLE===\s*(.+)/)?.[1]?.trim() || "Notes";
  const sectionsRaw = raw.match(/===SECTIONS===\s*([\s\S]*?)===CONNECTIONS/)?.[1] || "";
  const sections = sectionsRaw.split("---").map(block => {
    const heading = block.match(/HEADING:\s*(.+)/i)?.[1]?.trim() || "";
    const notesMatch = block.match(/NOTES:\s*([\s\S]*?)KEY_TAKEAWAY/i)?.[1] || "";
    const notes = notesMatch.split("\n").map(l => l.replace(/^[-•*]\s*/, "").trim()).filter(Boolean);
    const takeaway = block.match(/KEY_TAKEAWAY:\s*(.+)/i)?.[1]?.trim() || "";
    return { heading, notes, takeaway };
  }).filter(s => s.heading);

  const connRaw = raw.match(/===CONNECTIONS===\s*([\s\S]*?)===ACTION/)?.[1] || "";
  const connections = connRaw.split("\n").map(l => l.replace(/^[-•*]\s*/, "").trim()).filter(Boolean);

  const actRaw = raw.match(/===ACTION_ITEMS===\s*([\s\S]*?)$/)?.[1] || "";
  const actions = actRaw.split("\n").map(l => l.replace(/^[-•*]\s*/, "").trim()).filter(Boolean);

  return { title, sections, connections, actions };
}

function parseSummary(raw: string) {
  const overview = raw.match(/===OVERVIEW===\s*([\s\S]*?)===KEY_POINTS/)?.[1]?.trim() || "";
  const pointsRaw = raw.match(/===KEY_POINTS===\s*([\s\S]*?)===STRUCTURE/)?.[1] || "";
  const points = pointsRaw.split("\n").map(l => l.replace(/^[-•*]\s*/, "").trim()).filter(Boolean);
  const structure = raw.match(/===STRUCTURE===\s*([\s\S]*?)===STATISTICS/)?.[1]?.trim() || "";
  const statsRaw = raw.match(/===STATISTICS===\s*([\s\S]*?)$/)?.[1] || "";
  const gs = (k: string) => statsRaw.match(new RegExp(`${k}:\\s*(.+)`, "i"))?.[1]?.trim() || "";
  return {
    overview, points, structure,
    stats: { type: gs("TYPE"), complexity: gs("COMPLEXITY"), topics: gs("TOPICS"), wordCount: gs("WORD_COUNT"), sections: gs("SECTIONS") },
  };
}

export default function FileProcessorTool() {
  const [file, setFile] = useState<{ name: string; content: string; type: string } | null>(null);
  const [mode, setMode] = useState<Mode>("summary");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rawResult, setRawResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // Quiz state
  const [quizAnswers, setQuizAnswers] = useState<Record<number, string>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  // Flashcard state
  const [flippedCards, setFlippedCards] = useState<Set<number>>(new Set());

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { setError("File too large (max 5MB)"); return; }

    const reader = new FileReader();
    reader.onload = () => {
      setFile({ name: f.name, content: reader.result as string, type: f.type || f.name.split(".").pop() || "text" });
      setRawResult(null);
      setError(null);
      setQuizAnswers({});
      setQuizSubmitted(false);
      setFlippedCards(new Set());
    };
    reader.readAsText(f);
  }, []);

  const process = useCallback(async () => {
    if (!file || loading) return;
    setLoading(true);
    setError(null);
    setRawResult(null);
    setQuizAnswers({});
    setQuizSubmitted(false);
    setFlippedCards(new Set());

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/file-processor`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ content: file.content, fileName: file.name, fileType: file.type, mode }),
      });

      const result = await resp.json();
      if (result.error) throw new Error(result.error);
      setRawResult(result.result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [file, mode, loading]);

  const copyAll = () => {
    if (rawResult) {
      navigator.clipboard.writeText(rawResult);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const reset = () => {
    setFile(null);
    setRawResult(null);
    setError(null);
    setQuizAnswers({});
    setQuizSubmitted(false);
    setFlippedCards(new Set());
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Upload screen
  if (!file) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-4 animate-message-in">
        <div className="text-center space-y-2 mb-8">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <FileText className="w-7 h-7 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-foreground">File Processor</h2>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Upload any text file. AI transforms it into summaries, study notes, flashcards, or quizzes.
          </p>
        </div>

        <input ref={fileInputRef} type="file" accept={ACCEPTED} onChange={handleFile} className="hidden" />

        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full max-w-sm border-2 border-dashed border-border/60 rounded-2xl p-8 hover:border-primary/40 hover:bg-primary/5 transition-all group cursor-pointer"
        >
          <Upload className="w-8 h-8 text-muted-foreground group-hover:text-primary transition-colors mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground">Drop or click to upload</p>
          <p className="text-[10px] text-muted-foreground mt-1">
            Code, text, CSV, JSON, Markdown, config files (max 5MB)
          </p>
        </button>

        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

        <div className="grid grid-cols-2 gap-2 max-w-sm w-full mt-6">
          {MODES.map(m => (
            <div key={m.id} className="p-3 rounded-xl border border-border/30 bg-card">
              <div className="flex items-center gap-1.5 mb-1">
                <m.icon className="w-3.5 h-3.5 text-primary" />
                <span className="text-[11px] font-semibold text-foreground">{m.label}</span>
              </div>
              <p className="text-[10px] text-muted-foreground">{m.desc}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // File loaded - mode selection + results
  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-border/40 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="w-4 h-4 text-primary shrink-0" />
          <span className="text-sm font-bold text-foreground truncate">{file.name}</span>
          <span className="text-[9px] text-muted-foreground shrink-0">{(file.content.length / 1024).toFixed(1)}KB</span>
        </div>
        <div className="flex items-center gap-2">
          {rawResult && (
            <button onClick={copyAll} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
              {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
            </button>
          )}
          <button onClick={reset} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-3 h-3" /> New File
          </button>
        </div>
      </div>

      {/* Mode selector */}
      <div className="shrink-0 px-4 py-2 border-b border-border/20 flex gap-1.5 overflow-x-auto">
        {MODES.map(m => (
          <button
            key={m.id}
            onClick={() => { setMode(m.id); if (rawResult) setRawResult(null); }}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all whitespace-nowrap",
              mode === m.id ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted"
            )}
          >
            <m.icon className="w-3 h-3" />
            {m.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {/* Process button */}
        {!rawResult && !loading && (
          <div className="flex flex-col items-center justify-center h-full gap-4 animate-message-in">
            <div className="text-center">
              <p className="text-sm text-foreground font-medium mb-1">
                {MODES.find(m => m.id === mode)?.label}: {file.name}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {file.content.split("\n").length} lines • {(file.content.length / 1024).toFixed(1)}KB
              </p>
            </div>
            <button
              onClick={process}
              className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              Generate {MODES.find(m => m.id === mode)?.label}
            </button>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center h-full gap-3 animate-fade-in">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Processing {file.name}…</p>
          </div>
        )}

        {/* SUMMARY VIEW */}
        {rawResult && mode === "summary" && (() => {
          const s = parseSummary(rawResult);
          return (
            <div className="space-y-4 animate-message-in">
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                <div className="text-[9px] font-bold text-primary uppercase mb-2">Overview</div>
                <p className="text-[13px] text-foreground leading-relaxed">{s.overview}</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: "Type", value: s.stats.type },
                  { label: "Complexity", value: s.stats.complexity },
                  { label: "Words", value: s.stats.wordCount },
                  { label: "Sections", value: s.stats.sections },
                ].map(st => (
                  <div key={st.label} className="rounded-xl bg-card border border-border/40 p-2.5 text-center">
                    <div className="text-xs font-bold text-foreground">{st.value || "—"}</div>
                    <div className="text-[9px] text-muted-foreground">{st.label}</div>
                  </div>
                ))}
              </div>

              {s.points.length > 0 && (
                <div className="rounded-xl border border-border/40 bg-card p-4">
                  <div className="text-[9px] font-bold text-muted-foreground uppercase mb-2">Key Points</div>
                  <ul className="space-y-1.5">
                    {s.points.map((p, i) => (
                      <li key={i} className="text-[12px] text-foreground/80 flex items-start gap-2">
                        <span className="text-primary mt-0.5 shrink-0">•</span>{p}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {s.structure && (
                <div className="rounded-xl border border-border/40 bg-card p-4">
                  <div className="text-[9px] font-bold text-muted-foreground uppercase mb-2">Structure</div>
                  <p className="text-[12px] text-foreground/80 leading-relaxed">{s.structure}</p>
                </div>
              )}

              {s.stats.topics && (
                <div className="flex flex-wrap gap-1.5">
                  {s.stats.topics.split(",").map((t, i) => (
                    <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{t.trim()}</span>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {/* NOTES VIEW */}
        {rawResult && mode === "notes" && (() => {
          const n = parseNotes(rawResult);
          return (
            <div className="space-y-4 animate-message-in">
              <h3 className="text-lg font-bold text-foreground">{n.title}</h3>

              {n.sections.map((s, i) => (
                <div key={i} className="rounded-xl border border-border/40 bg-card p-4">
                  <h4 className="text-[13px] font-bold text-foreground mb-2">{s.heading}</h4>
                  <ul className="space-y-1 mb-2">
                    {s.notes.map((note, j) => (
                      <li key={j} className="text-[12px] text-foreground/80 flex items-start gap-2">
                        <span className="text-primary mt-0.5 shrink-0">→</span>{note}
                      </li>
                    ))}
                  </ul>
                  {s.takeaway && (
                    <div className="mt-2 pt-2 border-t border-border/20">
                      <p className="text-[11px] text-primary font-medium">💡 {s.takeaway}</p>
                    </div>
                  )}
                </div>
              ))}

              {n.connections.length > 0 && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                  <div className="text-[9px] font-bold text-amber-500 uppercase mb-2">🔗 Connections</div>
                  {n.connections.map((c, i) => (
                    <p key={i} className="text-[12px] text-foreground/80 mb-1">• {c}</p>
                  ))}
                </div>
              )}

              {n.actions.length > 0 && (
                <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4">
                  <div className="text-[9px] font-bold text-green-500 uppercase mb-2">✅ Action Items</div>
                  {n.actions.map((a, i) => (
                    <p key={i} className="text-[12px] text-foreground/80 mb-1">☐ {a}</p>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {/* FLASHCARDS VIEW */}
        {rawResult && mode === "flashcards" && (() => {
          const cards = parseFlashcards(rawResult);
          return (
            <div className="space-y-3 animate-message-in">
              <div className="text-center mb-2">
                <span className="text-[10px] text-muted-foreground">{cards.length} flashcards • Click to flip</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {cards.map((card, i) => {
                  const isFlipped = flippedCards.has(i);
                  return (
                    <button
                      key={i}
                      onClick={() => setFlippedCards(prev => {
                        const next = new Set(prev);
                        next.has(i) ? next.delete(i) : next.add(i);
                        return next;
                      })}
                      className={cn(
                        "text-left p-4 rounded-xl border min-h-[100px] transition-all",
                        isFlipped
                          ? "border-green-500/30 bg-green-500/5"
                          : "border-border/40 bg-card hover:border-primary/30"
                      )}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className={cn(
                          "text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase",
                          card.difficulty === "hard" ? "bg-destructive/10 text-destructive" :
                          card.difficulty === "easy" ? "bg-green-500/10 text-green-500" :
                          "bg-amber-500/10 text-amber-500"
                        )}>{card.difficulty}</span>
                        <span className="text-[9px] text-muted-foreground">{isFlipped ? "ANSWER" : "QUESTION"}</span>
                      </div>
                      <p className="text-[12px] text-foreground leading-relaxed">
                        {isFlipped ? card.a : card.q}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* QUIZ VIEW */}
        {rawResult && mode === "quiz" && (() => {
          const quiz = parseQuiz(rawResult);
          const score = quizSubmitted
            ? quiz.questions.reduce((acc, q, i) => acc + (quizAnswers[i] === q.correct ? 1 : 0), 0)
            : 0;

          return (
            <div className="space-y-4 animate-message-in">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground">{quiz.title}</h3>
                {quizSubmitted && (
                  <div className={cn(
                    "text-sm font-bold px-3 py-1 rounded-full",
                    score >= quiz.questions.length * 0.8 ? "bg-green-500/10 text-green-500" :
                    score >= quiz.questions.length * 0.5 ? "bg-amber-500/10 text-amber-500" :
                    "bg-destructive/10 text-destructive"
                  )}>
                    {score}/{quiz.questions.length}
                  </div>
                )}
              </div>

              {quiz.questions.map((q, qi) => {
                const userAnswer = quizAnswers[qi];
                const isCorrect = userAnswer === q.correct;
                const letters = ["A", "B", "C", "D"];

                return (
                  <div key={qi} className={cn(
                    "rounded-xl border p-4",
                    quizSubmitted
                      ? isCorrect ? "border-green-500/30 bg-green-500/5" : "border-destructive/30 bg-destructive/5"
                      : "border-border/40 bg-card"
                  )}>
                    <p className="text-[13px] font-medium text-foreground mb-3">
                      <span className="text-primary font-bold mr-1.5">Q{qi + 1}.</span>{q.q}
                    </p>
                    <div className="space-y-1.5">
                      {q.options.map((opt, oi) => {
                        const letter = letters[oi];
                        const isSelected = userAnswer === letter;
                        const isCorrectOption = letter === q.correct;
                        return (
                          <button
                            key={oi}
                            onClick={() => { if (!quizSubmitted) setQuizAnswers(prev => ({ ...prev, [qi]: letter })); }}
                            disabled={quizSubmitted}
                            className={cn(
                              "w-full text-left px-3 py-2 rounded-lg text-[12px] transition-all flex items-center gap-2",
                              quizSubmitted
                                ? isCorrectOption ? "bg-green-500/10 text-green-500 font-medium" :
                                  isSelected && !isCorrect ? "bg-destructive/10 text-destructive" :
                                  "text-foreground/50"
                                : isSelected ? "bg-primary/10 text-primary border border-primary/30" :
                                  "hover:bg-muted text-foreground/70"
                            )}
                          >
                            <span className="font-bold w-5">{letter})</span>
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                    {quizSubmitted && q.explanation && (
                      <p className="text-[11px] text-muted-foreground mt-2 italic">💡 {q.explanation}</p>
                    )}
                  </div>
                );
              })}

              {!quizSubmitted ? (
                <button
                  onClick={() => setQuizSubmitted(true)}
                  disabled={Object.keys(quizAnswers).length < quiz.questions.length}
                  className="w-full px-4 py-3 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-30"
                >
                  Submit Quiz ({Object.keys(quizAnswers).length}/{quiz.questions.length} answered)
                </button>
              ) : (
                <button
                  onClick={() => { setQuizAnswers({}); setQuizSubmitted(false); }}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-card text-foreground text-sm font-medium hover:bg-muted transition-colors flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Retry Quiz
                </button>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
