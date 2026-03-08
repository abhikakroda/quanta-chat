import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { RotateCcw, Timer, Zap, Target, Trophy, Volume2, VolumeX, BookOpen, ChevronRight, ArrowLeft, Lock, CheckCircle2, Flame } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Learning Chapters ──
const CHAPTERS = [
  {
    id: "home-row",
    title: "Home Row",
    desc: "Master the foundation: A S D F J K L ;",
    keys: "asdfghjkl;",
    words: ["sad","fad","lad","ask","had","jag","gal","all","fall","shall","flask","hash","dash","lash","flash","slash","salad","glass","flags","halls"],
    unlockAt: 0,
    icon: "🏠",
  },
  {
    id: "top-row",
    title: "Top Row",
    desc: "Reach up: Q W E R T Y U I O P",
    keys: "qwertyuiopasdfghjkl",
    words: ["the","per","quit","type","your","quite","write","quiet","power","equip","tower","reply","worth","poetry","triple","quarter","require","people","purple","pretty"],
    unlockAt: 20,
    icon: "⬆️",
  },
  {
    id: "bottom-row",
    title: "Bottom Row",
    desc: "Reach down: Z X C V B N M",
    keys: "zxcvbnmasdfghjklqwertyuiop",
    words: ["box","zinc","mix","vex","ban","can","van","man","buzz","exam","jazz","cozy","maze","next","back","calm","zone","move","fix","blank"],
    unlockAt: 30,
    icon: "⬇️",
  },
  {
    id: "common-words",
    title: "Common Words",
    desc: "100 most used English words",
    keys: "",
    words: ["the","be","to","of","and","a","in","that","have","it","for","not","on","with","he","as","you","do","at","this","but","his","by","from","they","we","say","her","she","or","an","will","my","one","all","would","there","their","what","so"],
    unlockAt: 40,
    icon: "📝",
  },
  {
    id: "numbers",
    title: "Numbers & Symbols",
    desc: "Type numbers and basic punctuation",
    keys: "1234567890,.",
    words: ["100","2024","3.14","99","42","007","365","1000","50","75","12.5","88","256","512","1024","2048","4096","720","360","180"],
    unlockAt: 50,
    icon: "🔢",
  },
  {
    id: "speed-drill",
    title: "Speed Drill",
    desc: "Push your limits with mixed content",
    keys: "",
    words: ["the","be","to","of","and","in","that","have","it","for","not","on","with","he","as","you","do","at","this","but","from","they","say","she","will","one","all","would","there","what","so","up","out","if","about","who","get","which","go","me","when","make","can","like","time","just","know","take","people","into","year","your","good","some","could","them","see","other","than","then","now","look","only","come","its","over","think","also","back","after","use","two","how","our","work","first","well","way","even","new","want","because","any","these","give","day","most"],
    unlockAt: 60,
    icon: "🚀",
  },
];

// ── Word pool for free typing ──
const WORD_POOL = [
  "the","be","to","of","and","a","in","that","have","it","for","not","on","with","he","as","you",
  "do","at","this","but","his","by","from","they","we","say","her","she","or","an","will","my",
  "one","all","would","there","their","what","so","up","out","if","about","who","get","which",
  "go","me","when","make","can","like","time","no","just","him","know","take","people","into",
  "year","your","good","some","could","them","see","other","than","then","now","look","only",
  "come","its","over","think","also","back","after","use","two","how","our","work","first",
  "well","way","even","new","want","because","any","these","give","day","most","us","great",
  "own","hand","high","keep","long","make","much","before","head","right","too","old","left",
  "begin","grow","read","learn","change","open","play","close","stand","build","turn","real",
  "under","watch","room","cold","line","name","big","kind","still","hold","power","fact","air",
  "home","carry","late","never","night","young","group","story","start","move","run","might",
];

const DURATIONS = [15, 30, 60, 120] as const;

const KEYBOARD_ROWS = [
  ["`","1","2","3","4","5","6","7","8","9","0","-","="],
  ["q","w","e","r","t","y","u","i","o","p","[","]","\\"],
  ["a","s","d","f","g","h","j","k","l",";","'"],
  ["z","x","c","v","b","n","m",",",".","/"],
];

const ROW_LABELS = ["", "tab", "caps", "shift"];
const ROW_RIGHT = ["⌫", "", "", "shift"];

function generateWords(pool: string[], count: number): string[] {
  const words: string[] = [];
  for (let i = 0; i < count; i++) {
    words.push(pool[Math.floor(Math.random() * pool.length)]);
  }
  return words;
}

type GameState = "idle" | "playing" | "finished";
type View = "menu" | "chapters" | "typing";

function createKeySound(ctx: AudioContext, type: "click" | "space" | "back" | "error") {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  const now = ctx.currentTime;
  if (type === "click") {
    osc.type = "square";
    osc.frequency.setValueAtTime(800 + Math.random() * 400, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.05);
    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    osc.start(now); osc.stop(now + 0.06);
  } else if (type === "space") {
    osc.type = "sine";
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.08);
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.start(now); osc.stop(now + 0.1);
  } else if (type === "back") {
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(150, now + 0.04);
    gain.gain.setValueAtTime(0.03, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.start(now); osc.stop(now + 0.05);
  } else {
    osc.type = "square";
    osc.frequency.setValueAtTime(200, now);
    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.start(now); osc.stop(now + 0.1);
  }
}

// ── Get best WPM from localStorage ──
function getBestWpm(): number {
  try { return parseInt(localStorage.getItem("typing_best_wpm") || "0"); } catch { return 0; }
}
function saveBestWpm(wpm: number) {
  const best = getBestWpm();
  if (wpm > best) localStorage.setItem("typing_best_wpm", String(wpm));
}

export default function TypingSpeedTool() {
  const [view, setView] = useState<View>("menu");
  const [activeChapter, setActiveChapter] = useState<string | null>(null);
  const [duration, setDuration] = useState<number>(30);
  const [words, setWords] = useState<string[]>(() => generateWords(WORD_POOL, 200));
  const [input, setInput] = useState("");
  const [wordIndex, setWordIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [state, setState] = useState<GameState>("idle");
  const [timeLeft, setTimeLeft] = useState(30);
  const [correctChars, setCorrectChars] = useState(0);
  const [totalChars, setTotalChars] = useState(0);
  const [correctWords, setCorrectWords] = useState(0);
  const [pressedKey, setPressedKey] = useState<string | null>(null);
  const [charStatuses, setCharStatuses] = useState<Map<string, "correct" | "incorrect">>(new Map());
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [bestWpm] = useState(getBestWpm);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const wordsContainerRef = useRef<HTMLDivElement>(null);

  const getAudioCtx = useCallback(() => {
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
    return audioCtxRef.current;
  }, []);

  const playKeySound = useCallback((type: "click" | "space" | "back" | "error") => {
    if (!soundEnabled) return;
    try { createKeySound(getAudioCtx(), type); } catch {}
  }, [soundEnabled, getAudioCtx]);

  const activeChapterData = useMemo(() => CHAPTERS.find(c => c.id === activeChapter), [activeChapter]);
  const highlightKeys = useMemo(() => activeChapterData?.keys ? new Set(activeChapterData.keys.split("")) : null, [activeChapterData]);

  const startTyping = useCallback((chapterId?: string) => {
    const pool = chapterId
      ? CHAPTERS.find(c => c.id === chapterId)?.words || WORD_POOL
      : WORD_POOL;
    setActiveChapter(chapterId || null);
    setWords(generateWords(pool, 200));
    setInput("");
    setWordIndex(0);
    setCharIndex(0);
    setState("idle");
    setTimeLeft(duration);
    setCorrectChars(0);
    setTotalChars(0);
    setCorrectWords(0);
    setCharStatuses(new Map());
    if (timerRef.current) clearInterval(timerRef.current);
    setView("typing");
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [duration]);

  const restart = useCallback(() => {
    startTyping(activeChapter || undefined);
  }, [startTyping, activeChapter]);

  useEffect(() => {
    if (view === "typing") restart();
  }, [duration]);

  useEffect(() => {
    if (state === "playing") {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            setState("finished");
            if (timerRef.current) clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }
  }, [state]);

  const wpm = useMemo(() => {
    const elapsed = duration - timeLeft;
    if (elapsed === 0) return 0;
    return Math.round((correctChars / 5) / (elapsed / 60));
  }, [correctChars, duration, timeLeft]);

  const accuracy = useMemo(() => {
    if (totalChars === 0) return 100;
    return Math.round((correctChars / totalChars) * 100);
  }, [correctChars, totalChars]);

  useEffect(() => {
    if (state === "finished" && wpm > 0) saveBestWpm(wpm);
  }, [state, wpm]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (state === "finished") return;
    const key = e.key;
    setPressedKey(key.toLowerCase());
    setTimeout(() => setPressedKey(null), 150);

    if (state === "idle") {
      if (key.length === 1) setState("playing");
      else return;
    }

    if (key === " ") {
      e.preventDefault();
      if (input.length === 0) return;
      playKeySound("space");
      const currentWord = words[wordIndex];
      if (input === currentWord) setCorrectWords(p => p + 1);
      setWordIndex(p => p + 1);
      setCharIndex(0);
      setInput("");
      return;
    }

    if (key === "Backspace") {
      if (input.length > 0) {
        playKeySound("back");
        const newKey = `${wordIndex}-${input.length - 1}`;
        setCharStatuses(prev => { const next = new Map(prev); next.delete(newKey); return next; });
        setInput(p => p.slice(0, -1));
        setCharIndex(p => Math.max(0, p - 1));
      }
      return;
    }

    if (key.length === 1) {
      const currentWord = words[wordIndex];
      const ci = input.length;
      const isCorrect = ci < currentWord.length && key === currentWord[ci];
      playKeySound(isCorrect ? "click" : "error");
      setTotalChars(p => p + 1);
      if (isCorrect) setCorrectChars(p => p + 1);
      const statusKey = `${wordIndex}-${ci}`;
      setCharStatuses(prev => { const next = new Map(prev); next.set(statusKey, isCorrect ? "correct" : "incorrect"); return next; });
      setInput(p => p + key);
      setCharIndex(p => p + 1);
    }
  }, [state, input, wordIndex, words, playKeySound]);

  const handleContainerClick = () => inputRef.current?.focus();

  const visibleWords = useMemo(() => {
    const start = Math.max(0, wordIndex - 3);
    const end = Math.min(words.length, wordIndex + 35);
    return words.slice(start, end).map((word, i) => ({ word, globalIndex: start + i }));
  }, [words, wordIndex]);

  const nextKey = useMemo(() => {
    if (state === "finished") return null;
    const currentWord = words[wordIndex];
    if (!currentWord) return null;
    const ci = input.length;
    if (ci < currentWord.length) return currentWord[ci];
    return " ";
  }, [words, wordIndex, input, state]);

  // ── Menu View ──
  if (view === "menu") {
    return (
      <div className="flex flex-col h-full bg-background overflow-y-auto">
        <div className="max-w-2xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-12">
          {/* Hero */}
          <div className="text-center mb-10">
            <div className="text-4xl mb-3">⌨️</div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">Typing Speed Trainer</h1>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Learn touch typing from scratch or test your speed. Progressive chapters guide you from home row to full speed.
            </p>
            {bestWpm > 0 && (
              <div className="flex items-center justify-center gap-2 mt-3 text-sm">
                <Flame className="w-4 h-4 text-amber-500" />
                <span className="text-muted-foreground">Personal best: <span className="text-foreground font-bold">{bestWpm} WPM</span></span>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
            <button
              onClick={() => startTyping()}
              className="flex items-center gap-4 p-5 rounded-2xl bg-primary/10 border border-primary/20 hover:bg-primary/15 transition-all text-left group"
            >
              <div className="p-3 rounded-xl bg-primary/20">
                <Zap className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-foreground text-base">Speed Test</div>
                <div className="text-xs text-muted-foreground mt-0.5">Test your typing speed with random words</div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground/30 group-hover:text-primary transition-colors" />
            </button>
            <button
              onClick={() => setView("chapters")}
              className="flex items-center gap-4 p-5 rounded-2xl bg-card border border-border/50 hover:border-primary/30 transition-all text-left group"
            >
              <div className="p-3 rounded-xl bg-accent">
                <BookOpen className="w-6 h-6 text-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-foreground text-base">Learn to Type</div>
                <div className="text-xs text-muted-foreground mt-0.5">6 chapters from beginner to advanced</div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground/30 group-hover:text-primary transition-colors" />
            </button>
          </div>

          {/* Quick tips */}
          <div className="bg-card rounded-2xl border border-border/40 p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" /> Tips for faster typing
            </h3>
            <ul className="space-y-2 text-xs text-muted-foreground">
              {[
                "Keep your fingers on the home row (A S D F — J K L ;) at all times",
                "Don't look at the keyboard — trust your muscle memory",
                "Focus on accuracy first, speed will follow naturally",
                "Practice 15 minutes daily for consistent improvement",
                "Use all fingers — each finger covers specific keys",
              ].map((tip, i) => (
                <li key={i} className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-primary/50 mt-0.5 shrink-0" />
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // ── Chapters View ──
  if (view === "chapters") {
    return (
      <div className="flex flex-col h-full bg-background overflow-y-auto">
        <div className="max-w-2xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8">
          <button
            onClick={() => setView("menu")}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>

          <h2 className="text-xl font-bold text-foreground mb-1">Learning Path</h2>
          <p className="text-sm text-muted-foreground mb-6">Complete chapters in order to build proper technique. Unlock new chapters by reaching the WPM goal.</p>

          <div className="space-y-3">
            {CHAPTERS.map((ch, i) => {
              const isUnlocked = getBestWpm() >= ch.unlockAt || i === 0;
              return (
                <button
                  key={ch.id}
                  onClick={() => isUnlocked && startTyping(ch.id)}
                  disabled={!isUnlocked}
                  className={cn(
                    "w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-all",
                    isUnlocked
                      ? "bg-card border-border/50 hover:border-primary/30 hover:bg-accent/30"
                      : "bg-muted/20 border-border/20 opacity-50 cursor-not-allowed"
                  )}
                >
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center text-xl shrink-0",
                    isUnlocked ? "bg-primary/10" : "bg-muted/30"
                  )}>
                    {isUnlocked ? ch.icon : <Lock className="w-5 h-5 text-muted-foreground/40" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground text-sm">{ch.title}</span>
                      {!isUnlocked && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                          {ch.unlockAt}+ WPM
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{ch.desc}</div>
                  </div>
                  {isUnlocked && <ChevronRight className="w-4 h-4 text-muted-foreground/30 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── Typing View ──
  return (
    <div className="flex flex-col h-full bg-background" onClick={handleContainerClick}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-border/30">
        <div className="flex items-center gap-3">
          <button
            onClick={() => { if (timerRef.current) clearInterval(timerRef.current); setView("menu"); }}
            className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium text-foreground truncate">
            {activeChapterData ? activeChapterData.title : "Speed Test"}
          </span>
          {activeChapterData && (
            <span className="text-xs text-muted-foreground hidden sm:inline">— {activeChapterData.desc}</span>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center bg-card rounded-lg border border-border/50 overflow-hidden">
            {DURATIONS.map(d => (
              <button
                key={d}
                onClick={(e) => { e.stopPropagation(); setDuration(d); }}
                className={cn(
                  "px-2.5 py-1.5 text-[11px] font-medium transition-all",
                  duration === d
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {d}s
              </button>
            ))}
          </div>

          <button
            onClick={(e) => { e.stopPropagation(); setSoundEnabled(p => !p); }}
            className={cn("p-1.5 rounded-lg transition-colors", soundEnabled ? "text-primary hover:bg-accent" : "text-muted-foreground/40 hover:bg-accent")}
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); restart(); }}
            className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main typing area */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-8 min-h-0">
        <input
          ref={inputRef}
          className="absolute opacity-0 w-0 h-0"
          onKeyDown={handleKeyDown}
          value=""
          onChange={() => {}}
          autoFocus
        />

        {state === "finished" ? (
          <div className="text-center space-y-5 animate-in fade-in duration-500">
            <Trophy className="w-10 h-10 text-primary mx-auto" />
            <h2 className="text-2xl font-bold text-foreground">Test Complete!</h2>
            <div className="flex gap-6 sm:gap-8 justify-center">
              {[
                { icon: Zap, label: "WPM", value: wpm, color: "text-primary" },
                { icon: Target, label: "Accuracy", value: `${accuracy}%`, color: "text-emerald-500" },
                { icon: Timer, label: "Time", value: `${duration}s`, color: "text-amber-500" },
              ].map(s => (
                <div key={s.label} className="text-center">
                  <s.icon className={cn("w-5 h-5 mx-auto mb-1.5", s.color)} />
                  <div className="text-xl font-bold text-foreground">{s.value}</div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</div>
                </div>
              ))}
            </div>
            {wpm > bestWpm && wpm > 0 && (
              <div className="flex items-center justify-center gap-2 text-sm text-amber-500">
                <Flame className="w-4 h-4" />
                <span className="font-semibold">New personal best!</span>
              </div>
            )}
            <div className="flex gap-3 justify-center pt-2">
              <button onClick={(e) => { e.stopPropagation(); restart(); }} className="px-5 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors">
                Try Again
              </button>
              <button onClick={() => setView(activeChapter ? "chapters" : "menu")} className="px-5 py-2 bg-card border border-border/50 text-foreground rounded-xl text-sm font-medium hover:bg-accent transition-colors">
                {activeChapter ? "Chapters" : "Menu"}
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Timer + Stats bar */}
            <div className="flex items-center gap-4 sm:gap-6 mb-6">
              {state === "playing" ? (
                <>
                  <div className="flex items-center gap-1.5 text-primary font-mono text-xl font-bold">
                    <Timer className="w-4 h-4" />
                    {timeLeft}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <span className="text-foreground font-semibold">{wpm}</span> wpm
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <span className="text-foreground font-semibold">{accuracy}%</span> acc
                  </div>
                </>
              ) : (
                <div className="text-xs text-muted-foreground/40">
                  start typing to begin…
                </div>
              )}
            </div>

            {/* Words display */}
            <div className="max-w-2xl w-full relative" ref={wordsContainerRef}>
              {state === "idle" && (
                <div className="absolute inset-0 flex items-center justify-center z-10">
                  <span className="px-4 py-2 bg-card/90 backdrop-blur-sm border border-border/50 rounded-xl text-sm text-muted-foreground">
                    click or press any key to start
                  </span>
                </div>
              )}
              <div className={cn(
                "font-mono text-base sm:text-lg leading-[2.2] tracking-wide flex flex-wrap gap-x-2.5 max-h-[120px] overflow-hidden",
                state === "idle" && "blur-[2px] opacity-50"
              )}>
                {visibleWords.map(({ word, globalIndex }) => (
                  <span key={globalIndex} className="inline-block">
                    {word.split("").map((char, ci) => {
                      const statusKey = `${globalIndex}-${ci}`;
                      const status = charStatuses.get(statusKey);
                      const isCursor = globalIndex === wordIndex && ci === input.length;
                      return (
                        <span
                          key={ci}
                          className={cn(
                            "relative transition-colors duration-75",
                            status === "correct" && "text-foreground",
                            status === "incorrect" && "text-destructive bg-destructive/10 rounded-sm",
                            !status && globalIndex < wordIndex && "text-foreground/25",
                            !status && globalIndex > wordIndex && "text-muted-foreground/30",
                            !status && globalIndex === wordIndex && "text-muted-foreground/50",
                            isCursor && "border-l-2 border-primary"
                          )}
                        >
                          {char}
                        </span>
                      );
                    })}
                    {/* Show extra typed chars beyond word length */}
                    {globalIndex === wordIndex && input.length > word.length && (
                      <span className="text-destructive/60 bg-destructive/10 rounded-sm">
                        {input.slice(word.length)}
                      </span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Keyboard */}
      {state !== "finished" && (
        <div className="border-t border-border/20 bg-card/30 px-2 sm:px-4 py-2 sm:py-3 shrink-0">
          <div className="max-w-xl mx-auto space-y-0.5 sm:space-y-1">
            {KEYBOARD_ROWS.map((row, ri) => (
              <div key={ri} className="flex gap-[2px] sm:gap-1 justify-center">
                {ROW_LABELS[ri] && (
                  <div className={cn(
                    "flex items-center justify-center rounded text-[8px] sm:text-[10px] font-medium",
                    "bg-primary/10 text-primary/50 border border-primary/15",
                    ri === 1 ? "w-8 sm:w-12 h-7 sm:h-9" : ri === 2 ? "w-10 sm:w-14 h-7 sm:h-9" : "w-12 sm:w-16 h-7 sm:h-9"
                  )}>
                    {ROW_LABELS[ri]}
                  </div>
                )}
                {row.map(key => {
                  const isNext = nextKey === key;
                  const isPressed = pressedKey === key;
                  const isHighlighted = highlightKeys?.has(key);
                  return (
                    <div
                      key={key}
                      className={cn(
                        "flex items-center justify-center rounded text-[9px] sm:text-xs font-medium transition-all duration-75",
                        "w-6 h-7 sm:w-9 sm:h-9",
                        isPressed
                          ? "bg-primary text-primary-foreground scale-90 shadow-md shadow-primary/30"
                          : isNext
                          ? "bg-primary/25 text-primary border border-primary/50 scale-105"
                          : isHighlighted
                          ? "bg-primary/8 text-primary/70 border border-primary/20"
                          : "bg-muted/40 text-muted-foreground/50 border border-border/20"
                      )}
                    >
                      {key.toUpperCase()}
                    </div>
                  );
                })}
                {ROW_RIGHT[ri] && (
                  <div className={cn(
                    "flex items-center justify-center rounded text-[8px] sm:text-[10px] font-medium",
                    "bg-muted/40 text-muted-foreground/30 border border-border/20",
                    ri === 0 ? "w-8 sm:w-12 h-7 sm:h-9" : "w-12 sm:w-16 h-7 sm:h-9"
                  )}>
                    {ROW_RIGHT[ri]}
                  </div>
                )}
              </div>
            ))}
            <div className="flex gap-[2px] sm:gap-1 justify-center">
              <div className={cn(
                "flex items-center justify-center rounded text-[9px] sm:text-xs font-medium h-7 sm:h-9 w-36 sm:w-56 transition-all duration-75",
                pressedKey === " "
                  ? "bg-primary text-primary-foreground scale-[0.98]"
                  : nextKey === " "
                  ? "bg-primary/25 text-primary border border-primary/50"
                  : "bg-muted/40 text-muted-foreground/30 border border-border/20"
              )}>
                space
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
