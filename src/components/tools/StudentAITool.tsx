import { useState, useRef, useCallback } from "react";
import {
  GraduationCap, BookOpen, Brain, FileQuestion, ClipboardList,
  Loader2, ArrowUp, RotateCcw, Sparkles, CheckCircle2, XCircle,
  ChevronRight, Paperclip, FileText, X, Copy, Check
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import * as pdfjsLib from "pdfjs-dist";
import mammoth from "mammoth";

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

type Mode = "explain" | "quiz" | "summarize" | "homework";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type QuizQuestion = {
  question: string;
  options: string[];
  correct: number;
  explanation: string;
};

const MODES = [
  { id: "explain" as Mode, icon: BookOpen, label: "Explain Topic", desc: "Simple explanations with examples", color: "text-blue-500", bg: "bg-blue-500/10" },
  { id: "quiz" as Mode, icon: FileQuestion, label: "Quiz Me", desc: "Generate quiz from any topic or notes", color: "text-emerald-500", bg: "bg-emerald-500/10" },
  { id: "summarize" as Mode, icon: ClipboardList, label: "Summarize Notes", desc: "Condense notes into key points", color: "text-violet-500", bg: "bg-violet-500/10" },
  { id: "homework" as Mode, icon: Brain, label: "Solve Homework", desc: "Step-by-step solutions", color: "text-amber-500", bg: "bg-amber-500/10" },
];

const SKILL_PROMPTS: Record<Mode, string> = {
  explain: `You are a patient, expert teacher for students. Your job is to explain topics in the SIMPLEST way possible.

Rules:
- Use everyday analogies and real-world examples
- Break complex ideas into small, numbered steps
- Use emojis to make it engaging (but don't overdo it)
- Start with a one-line "In simple words..." summary
- Then give the detailed explanation
- End with a "Quick Check" — one simple question to test understanding
- If the student asks follow-ups, build on what you already explained
- Adapt to the student's level based on their questions`,

  quiz: `You are a quiz generator for students. Generate quiz questions from the given topic or content.

Rules:
- Generate exactly 5 multiple-choice questions
- Format EACH question EXACTLY like this:

**Q1. [question text]**
A) [option]
B) [option]
C) [option]
D) [option]

✅ **Answer: [letter]) [answer text]**
📝 **Why:** [1-sentence explanation]

---

- Make questions test UNDERSTANDING, not just recall
- Mix difficulty: 2 easy, 2 medium, 1 hard
- If content/notes are provided, base questions on that content
- If just a topic name, generate conceptual questions`,

  summarize: `You are a note-summarizing assistant for students. Your job is to condense notes into clear, structured summaries.

Rules:
- Start with a **TL;DR** (2-3 sentences max)
- Then provide **Key Points** as a numbered list (5-8 points)
- Add a **Key Terms** section with brief definitions
- End with **What to Remember** — the 3 most important takeaways
- Use bullet points and bold for scannability
- If the notes are messy/unstructured, organize them logically
- Keep language simple and student-friendly`,

  homework: `You are a homework helper that solves problems STEP BY STEP. You teach while solving.

Rules:
- ALWAYS show your work step by step
- Number each step clearly (Step 1, Step 2, etc.)
- Explain the WHY behind each step, not just the HOW
- Use the format: Step → What we do → Why we do it
- For math: show every intermediate calculation
- For essays/writing: outline → draft → key points
- For science: state the concept → apply the formula → calculate
- End with a **💡 Tip** that helps with similar problems
- If the problem is ambiguous, state your assumptions`,
};

export default function StudentAITool() {
  const [mode, setMode] = useState<Mode | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [attachedFile, setAttachedFile] = useState<{ name: string; content: string } | null>(null);
  const [copied, setCopied] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }), 100);
  };

  const readFile = async (file: File): Promise<string> => {
    if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const pages: string[] = [];
      for (let i = 1; i <= Math.min(pdf.numPages, 30); i++) {
        const page = await pdf.getPage(i);
        const tc = await page.getTextContent();
        pages.push(tc.items.map((item: any) => item.str).join(" "));
      }
      return pages.join("\n\n") || "[No extractable text]";
    }
    if (file.name.endsWith(".docx") || file.name.endsWith(".doc")) {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      return result.value || "[No extractable text]";
    }
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve("[Could not read file]");
      reader.readAsText(file);
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const content = await readFile(file);
    setAttachedFile({ name: file.name, content: content.slice(0, 20000) });
    e.target.value = "";
  };

  const streamAI = useCallback(async (msgs: Message[], modeId: Mode): Promise<string> => {
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
        messages: msgs.map(m => ({ role: m.role, content: m.content })),
        model: "mistral",
        enableThinking: false,
        skillPrompt: SKILL_PROMPTS[modeId],
      }),
    });

    if (!resp.ok) throw new Error("AI request failed");
    const reader = resp.body?.getReader();
    if (!reader) throw new Error("No response");
    const decoder = new TextDecoder();
    let buffer = "";
    let full = "";

    // Add empty assistant message for streaming
    setMessages(prev => [...prev, { role: "assistant", content: "" }]);

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
            full += content;
            setMessages(prev => {
              const updated = [...prev];
              updated[updated.length - 1] = { role: "assistant", content: full };
              return updated;
            });
          }
        } catch { /* partial */ }
      }
    }
    scrollToBottom();
    return full.trim();
  }, []);

  const handleSend = async () => {
    if ((!input.trim() && !attachedFile) || loading || !mode) return;

    let userContent = input.trim();
    if (attachedFile) {
      userContent = `--- Uploaded File: ${attachedFile.name} ---\n${attachedFile.content}\n\n${userContent || (mode === "summarize" ? "Summarize these notes." : mode === "quiz" ? "Generate a quiz from this content." : "Help me with this.")}`;
    }

    const userMsg: Message = { role: "user", content: userContent };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setAttachedFile(null);
    setLoading(true);
    scrollToBottom();

    try {
      await streamAI([...messages, userMsg], mode);
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: "assistant", content: "Sorry, something went wrong. Please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const copyMessage = (index: number, content: string) => {
    navigator.clipboard.writeText(content);
    setCopied(index);
    setTimeout(() => setCopied(null), 2000);
  };

  const reset = () => {
    setMessages([]);
    setInput("");
    setAttachedFile(null);
    setMode(null);
  };

  const switchMode = (newMode: Mode) => {
    setMode(newMode);
    setMessages([]);
    setInput("");
    setAttachedFile(null);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  // ──── MODE SELECTOR ────
  if (!mode) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 animate-fade-in">
        <div className="max-w-md w-full space-y-6">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/15 to-violet-500/15 flex items-center justify-center mx-auto border border-blue-500/10">
              <GraduationCap className="w-8 h-8 text-blue-500" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Student AI</h1>
            <p className="text-sm text-muted-foreground">Your AI study companion. Pick a mode to get started.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {MODES.map(m => (
              <button
                key={m.id}
                onClick={() => switchMode(m.id)}
                className="group flex flex-col items-start gap-3 p-4 rounded-xl border border-border/40 bg-card/50 hover:bg-card hover:border-border hover:shadow-lg transition-all text-left hover:-translate-y-0.5"
              >
                <div className={cn("p-2.5 rounded-xl", m.bg)}>
                  <m.icon className={cn("w-5 h-5", m.color)} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{m.label}</p>
                  <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">{m.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const currentMode = MODES.find(m => m.id === mode)!;
  const placeholders: Record<Mode, string> = {
    explain: "Enter a topic... e.g. 'Photosynthesis', 'Newton's 3rd Law'",
    quiz: "Enter a topic or paste your notes to generate a quiz...",
    summarize: "Paste your notes here or upload a file...",
    homework: "Type or paste your homework question...",
  };

  // ──── ACTIVE SESSION ────
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-3 sm:px-4 py-2.5 border-b border-border/30 bg-card/50">
        <div className="flex items-center gap-3">
          <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center", currentMode.bg)}>
            <currentMode.icon className={cn("w-4 h-4", currentMode.color)} />
          </div>
          <div>
            <h2 className="text-[14px] font-bold text-foreground">{currentMode.label}</h2>
            <p className="text-[10px] text-muted-foreground">{currentMode.desc}</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Mode switcher pills */}
          <div className="hidden sm:flex items-center gap-0.5 bg-muted/40 rounded-lg p-0.5 mr-2">
            {MODES.map(m => (
              <button
                key={m.id}
                onClick={() => switchMode(m.id)}
                className={cn(
                  "p-1.5 rounded-md transition-colors",
                  mode === m.id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                )}
                title={m.label}
              >
                <m.icon className="w-3.5 h-3.5" />
              </button>
            ))}
          </div>
          <button onClick={reset} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors" title="Back to modes">
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4 py-12">
            <div className={cn("p-4 rounded-2xl", currentMode.bg)}>
              <currentMode.icon className={cn("w-10 h-10", currentMode.color)} />
            </div>
            <div>
              <p className="text-base font-semibold text-foreground">{currentMode.label}</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                {mode === "explain" && "Type any topic and I'll explain it simply with examples."}
                {mode === "quiz" && "Give me a topic or upload your notes — I'll create a quiz."}
                {mode === "summarize" && "Paste notes or upload a file — I'll create a clean summary."}
                {mode === "homework" && "Type or paste your homework problem for a step-by-step solution."}
              </p>
            </div>

            {/* Quick start suggestions */}
            {mode === "explain" && (
              <div className="flex flex-wrap gap-2 justify-center max-w-sm">
                {["Photosynthesis", "Quadratic equations", "Supply & Demand", "DNA replication", "Newton's Laws"].map(topic => (
                  <button
                    key={topic}
                    onClick={() => { setInput(`Explain ${topic}`); inputRef.current?.focus(); }}
                    className="px-3 py-1.5 rounded-xl text-[12px] bg-muted/50 border border-border/30 text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                  >
                    {topic}
                  </button>
                ))}
              </div>
            )}
            {mode === "homework" && (
              <div className="flex flex-wrap gap-2 justify-center max-w-sm">
                {["Solve: 2x² + 5x - 3 = 0", "Balance: Fe + O₂ → Fe₂O₃", "Find area of triangle with base 8cm, height 5cm"].map(q => (
                  <button
                    key={q}
                    onClick={() => { setInput(q); inputRef.current?.focus(); }}
                    className="px-3 py-1.5 rounded-xl text-[12px] bg-muted/50 border border-border/30 text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
            <div className={cn(
              "max-w-[90%] text-[14px] leading-relaxed",
              msg.role === "user"
                ? "px-4 py-3 bg-foreground text-background rounded-2xl rounded-br-sm"
                : "group relative"
            )}>
              {msg.role === "assistant" ? (
                <div className="prose prose-sm max-w-none text-foreground prose-p:my-1.5 prose-ul:my-1 prose-li:my-0 prose-headings:text-foreground prose-strong:text-foreground">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                  {msg.content && !loading && (
                    <button
                      onClick={() => copyMessage(i, msg.content)}
                      className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                    >
                      {copied === i ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
                    </button>
                  )}
                </div>
              ) : (
                <span>{msg.content.length > 200 ? msg.content.slice(0, 200) + "..." : msg.content}</span>
              )}
            </div>
          </div>
        ))}

        {loading && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>
                {mode === "explain" ? "Explaining..." : mode === "quiz" ? "Generating quiz..." : mode === "summarize" ? "Summarizing..." : "Solving..."}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="p-3 border-t border-border/30 bg-card/30">
        {/* Attached file */}
        {attachedFile && (
          <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-xl bg-muted/80 border border-border/40 text-xs">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="w-3.5 h-3.5 text-primary/60" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate font-medium text-foreground text-[12px]">{attachedFile.name}</p>
              <p className="text-[10px] text-muted-foreground">{Math.round(attachedFile.content.length / 1000)}k chars</p>
            </div>
            <button onClick={() => setAttachedFile(null)} className="p-0.5 rounded-md text-muted-foreground/40 hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div className="flex gap-2 items-end bg-muted/30 border border-border/40 rounded-2xl p-1.5 focus-within:border-primary/30 focus-within:ring-2 focus-within:ring-primary/10 transition-all">
          {/* File upload (for summarize & quiz modes) */}
          <input ref={fileRef} type="file" accept=".txt,.md,.pdf,.docx,.doc,.csv,.json" className="hidden" onChange={handleFileSelect} />
          <button
            onClick={() => fileRef.current?.click()}
            className="shrink-0 w-9 h-9 rounded-xl hover:bg-accent text-muted-foreground/50 hover:text-foreground transition-colors flex items-center justify-center"
            title="Upload notes"
          >
            <Paperclip className="w-4 h-4" />
          </button>

          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholders[mode]}
            rows={1}
            className="flex-1 bg-transparent px-2 py-2 text-[14px] text-foreground placeholder:text-muted-foreground/40 resize-none focus:outline-none max-h-[150px] overflow-y-auto"
            style={{ minHeight: "40px" }}
          />
          <button
            onClick={handleSend}
            disabled={(!input.trim() && !attachedFile) || loading}
            className="w-9 h-9 rounded-xl bg-foreground text-background flex items-center justify-center hover:opacity-80 disabled:opacity-20 transition-all shrink-0"
          >
            <ArrowUp className="w-4 h-4" strokeWidth={2.5} />
          </button>
        </div>

        {/* Mobile mode switcher */}
        <div className="flex sm:hidden items-center justify-center gap-1 mt-2">
          {MODES.map(m => (
            <button
              key={m.id}
              onClick={() => switchMode(m.id)}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors",
                mode === m.id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <m.icon className="w-3 h-3" />
              {m.label.split(" ")[0]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
