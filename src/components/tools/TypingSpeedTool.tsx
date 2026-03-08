import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { RotateCcw, Timer, Zap, Target, Trophy, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";

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

function generateWords(count: number): string[] {
  const words: string[] = [];
  for (let i = 0; i < count; i++) {
    words.push(WORD_POOL[Math.floor(Math.random() * WORD_POOL.length)]);
  }
  return words;
}

type GameState = "idle" | "playing" | "finished";

// Web Audio API key sounds
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
    osc.start(now);
    osc.stop(now + 0.06);
  } else if (type === "space") {
    osc.type = "sine";
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.08);
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.start(now);
    osc.stop(now + 0.1);
  } else if (type === "back") {
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(150, now + 0.04);
    gain.gain.setValueAtTime(0.03, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.start(now);
    osc.stop(now + 0.05);
  } else {
    osc.type = "square";
    osc.frequency.setValueAtTime(200, now);
    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.start(now);
    osc.stop(now + 0.1);
  }
}

export default function TypingSpeedTool() {
  const [duration, setDuration] = useState<number>(30);
  const [words, setWords] = useState<string[]>(() => generateWords(200));
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
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const getAudioCtx = useCallback(() => {
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
    return audioCtxRef.current;
  }, []);

  const playKeySound = useCallback((type: "click" | "space" | "back" | "error") => {
    if (!soundEnabled) return;
    try { createKeySound(getAudioCtx(), type); } catch {}
  }, [soundEnabled, getAudioCtx]);

  const restart = useCallback(() => {
    setWords(generateWords(200));
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
  }, [duration]);

  useEffect(() => { restart(); }, [duration]);

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
      if (input === currentWord) {
        setCorrectWords(p => p + 1);
      }
      setWordIndex(p => p + 1);
      setCharIndex(0);
      setInput("");
      return;
    }

    if (key === "Backspace") {
      if (input.length > 0) {
        playKeySound("back");
        const newKey = `${wordIndex}-${input.length - 1}`;
        setCharStatuses(prev => {
          const next = new Map(prev);
          next.delete(newKey);
          return next;
        });
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
      setCharStatuses(prev => {
        const next = new Map(prev);
        next.set(statusKey, isCorrect ? "correct" : "incorrect");
        return next;
      });

      setInput(p => p + key);
      setCharIndex(p => p + 1);
    }
  }, [state, input, wordIndex, words]);

  const handleContainerClick = () => {
    inputRef.current?.focus();
  };

  // Visible words window
  const visibleWords = useMemo(() => {
    const start = Math.max(0, wordIndex - 5);
    const end = Math.min(words.length, wordIndex + 40);
    return words.slice(start, end).map((word, i) => ({
      word,
      globalIndex: start + i,
    }));
  }, [words, wordIndex]);

  const nextKey = useMemo(() => {
    if (state === "finished") return null;
    const currentWord = words[wordIndex];
    if (!currentWord) return null;
    const ci = input.length;
    if (ci < currentWord.length) return currentWord[ci];
    return " ";
  }, [words, wordIndex, input, state]);

  return (
    <div className="flex flex-col h-full bg-background" onClick={handleContainerClick}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-border/30">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-primary">keyb</span>
          <span className="text-muted-foreground/40">/</span>
          <span className="text-muted-foreground">type</span>
        </div>

        <div className="flex items-center gap-4">
          {/* Duration selector */}
          <div className="flex items-center bg-card rounded-lg border border-border/50 overflow-hidden">
            {DURATIONS.map(d => (
              <button
                key={d}
                onClick={(e) => { e.stopPropagation(); setDuration(d); }}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium transition-all",
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
            onClick={(e) => { e.stopPropagation(); restart(); }}
            className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            title="Restart (Tab+Enter)"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main typing area */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-8 relative" ref={containerRef}>
        <input
          ref={inputRef}
          className="absolute opacity-0 w-0 h-0"
          onKeyDown={handleKeyDown}
          value=""
          onChange={() => {}}
          autoFocus
        />

        {state === "finished" ? (
          /* Results */
          <div className="text-center space-y-6 animate-in fade-in duration-500">
            <Trophy className="w-12 h-12 text-primary mx-auto" />
            <h2 className="text-3xl font-bold text-foreground">Test Complete!</h2>
            <div className="flex gap-8 justify-center">
              {[
                { icon: Zap, label: "WPM", value: wpm, color: "text-primary" },
                { icon: Target, label: "Accuracy", value: `${accuracy}%`, color: "text-emerald-500" },
                { icon: Timer, label: "Duration", value: `${duration}s`, color: "text-amber-500" },
              ].map(s => (
                <div key={s.label} className="text-center">
                  <s.icon className={cn("w-5 h-5 mx-auto mb-2", s.color)} />
                  <div className="text-2xl font-bold text-foreground">{s.value}</div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider">{s.label}</div>
                </div>
              ))}
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); restart(); }}
              className="px-6 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : (
          <>
            {/* Timer + Stats */}
            {state === "playing" && (
              <div className="flex items-center gap-6 mb-8 text-sm">
                <div className="flex items-center gap-2 text-primary font-mono text-2xl font-bold">
                  <Timer className="w-5 h-5" />
                  {timeLeft}
                </div>
                <div className="text-muted-foreground">
                  <span className="text-foreground font-semibold">{wpm}</span> WPM
                </div>
                <div className="text-muted-foreground">
                  <span className="text-foreground font-semibold">{accuracy}%</span> ACC
                </div>
              </div>
            )}

            {/* Words display */}
            <div className="max-w-2xl w-full relative">
              {state === "idle" && (
                <div className="absolute inset-0 flex items-center justify-center z-10">
                  <span className="px-4 py-2 bg-card/90 backdrop-blur-sm border border-border/50 rounded-xl text-sm text-muted-foreground">
                    click or press any key to focus
                  </span>
                </div>
              )}
              <div className={cn(
                "font-mono text-lg sm:text-xl leading-[2.5] tracking-wide flex flex-wrap gap-x-3",
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
                            "relative transition-colors duration-100",
                            status === "correct" && "text-foreground",
                            status === "incorrect" && "text-destructive",
                            !status && globalIndex < wordIndex && "text-foreground/30",
                            !status && globalIndex > wordIndex && "text-muted-foreground/30",
                            !status && globalIndex === wordIndex && "text-muted-foreground/50",
                            isCursor && "border-l-2 border-primary animate-pulse"
                          )}
                        >
                          {char}
                        </span>
                      );
                    })}
                  </span>
                ))}
              </div>
            </div>

            {/* Restart hint */}
            <div className="flex items-center gap-2 mt-8 text-xs text-muted-foreground/30">
              <RotateCcw className="w-3 h-3" />
              <span>tab+enter to restart</span>
            </div>
          </>
        )}
      </div>

      {/* Keyboard visualization */}
      <div className="border-t border-border/20 bg-card/50 px-2 sm:px-6 py-3 sm:py-4">
        <div className="max-w-2xl mx-auto space-y-1">
          {KEYBOARD_ROWS.map((row, ri) => (
            <div key={ri} className="flex gap-0.5 sm:gap-1 justify-center">
              {/* Left label key */}
              {ROW_LABELS[ri] && (
                <div className={cn(
                  "flex items-center justify-center rounded-md text-[9px] sm:text-[10px] font-medium",
                  "bg-primary/10 text-primary/60 border border-primary/20",
                  ri === 1 ? "w-10 sm:w-14 h-8 sm:h-10" : ri === 2 ? "w-12 sm:w-16 h-8 sm:h-10" : "w-14 sm:w-20 h-8 sm:h-10"
                )}>
                  {ROW_LABELS[ri]}
                </div>
              )}
              {row.map(key => {
                const isNext = nextKey === key;
                const isPressed = pressedKey === key;
                return (
                  <div
                    key={key}
                    className={cn(
                      "flex items-center justify-center rounded-md text-[10px] sm:text-xs font-medium transition-all duration-100",
                      "w-7 h-8 sm:w-10 sm:h-10",
                      isPressed
                        ? "bg-primary text-primary-foreground scale-95 shadow-lg shadow-primary/30"
                        : isNext
                        ? "bg-primary/20 text-primary border border-primary/40"
                        : "bg-muted/50 text-muted-foreground/60 border border-border/30"
                    )}
                  >
                    {key.toUpperCase()}
                  </div>
                );
              })}
              {/* Right label key */}
              {ROW_RIGHT[ri] && (
                <div className={cn(
                  "flex items-center justify-center rounded-md text-[9px] sm:text-[10px] font-medium",
                  "bg-muted/50 text-muted-foreground/40 border border-border/30",
                  ri === 0 ? "w-10 sm:w-14 h-8 sm:h-10" : "w-14 sm:w-20 h-8 sm:h-10"
                )}>
                  {ROW_RIGHT[ri]}
                </div>
              )}
            </div>
          ))}
          {/* Space bar row */}
          <div className="flex gap-0.5 sm:gap-1 justify-center">
            <div className={cn(
              "flex items-center justify-center rounded-md text-[10px] sm:text-xs font-medium h-8 sm:h-10 w-48 sm:w-72 transition-all duration-100",
              pressedKey === " "
                ? "bg-primary text-primary-foreground scale-[0.98]"
                : nextKey === " "
                ? "bg-primary/20 text-primary border border-primary/40"
                : "bg-muted/50 text-muted-foreground/40 border border-border/30"
            )}>
              space
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
