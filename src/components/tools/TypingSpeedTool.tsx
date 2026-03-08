import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { RotateCcw, Timer, Zap, Target, Trophy, Volume2, VolumeX, BookOpen, ChevronRight, ArrowLeft, Lock, CheckCircle2, Flame, Info, Hand, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

// ── Finger map for each key ──
const FINGER_COLORS = {
  "L-Pinky": "hsl(0 70% 60%)",
  "L-Ring": "hsl(30 70% 55%)",
  "L-Middle": "hsl(60 70% 45%)",
  "L-Index": "hsl(120 50% 45%)",
  "R-Index": "hsl(180 50% 45%)",
  "R-Middle": "hsl(220 60% 55%)",
  "R-Ring": "hsl(260 50% 55%)",
  "R-Pinky": "hsl(300 50% 55%)",
  "Thumb": "hsl(45 60% 50%)",
};

const FINGER_MAP: Record<string, { finger: string; hand: "left" | "right"; color: string; label: string }> = {
  "q": { finger: "Pinky", hand: "left", color: FINGER_COLORS["L-Pinky"], label: "L-Pinky" },
  "a": { finger: "Pinky", hand: "left", color: FINGER_COLORS["L-Pinky"], label: "L-Pinky" },
  "z": { finger: "Pinky", hand: "left", color: FINGER_COLORS["L-Pinky"], label: "L-Pinky" },
  "1": { finger: "Pinky", hand: "left", color: FINGER_COLORS["L-Pinky"], label: "L-Pinky" },
  "`": { finger: "Pinky", hand: "left", color: FINGER_COLORS["L-Pinky"], label: "L-Pinky" },
  "w": { finger: "Ring", hand: "left", color: FINGER_COLORS["L-Ring"], label: "L-Ring" },
  "s": { finger: "Ring", hand: "left", color: FINGER_COLORS["L-Ring"], label: "L-Ring" },
  "x": { finger: "Ring", hand: "left", color: FINGER_COLORS["L-Ring"], label: "L-Ring" },
  "2": { finger: "Ring", hand: "left", color: FINGER_COLORS["L-Ring"], label: "L-Ring" },
  "e": { finger: "Middle", hand: "left", color: FINGER_COLORS["L-Middle"], label: "L-Middle" },
  "d": { finger: "Middle", hand: "left", color: FINGER_COLORS["L-Middle"], label: "L-Middle" },
  "c": { finger: "Middle", hand: "left", color: FINGER_COLORS["L-Middle"], label: "L-Middle" },
  "3": { finger: "Middle", hand: "left", color: FINGER_COLORS["L-Middle"], label: "L-Middle" },
  "r": { finger: "Index", hand: "left", color: FINGER_COLORS["L-Index"], label: "L-Index" },
  "f": { finger: "Index", hand: "left", color: FINGER_COLORS["L-Index"], label: "L-Index" },
  "v": { finger: "Index", hand: "left", color: FINGER_COLORS["L-Index"], label: "L-Index" },
  "t": { finger: "Index", hand: "left", color: FINGER_COLORS["L-Index"], label: "L-Index" },
  "g": { finger: "Index", hand: "left", color: FINGER_COLORS["L-Index"], label: "L-Index" },
  "b": { finger: "Index", hand: "left", color: FINGER_COLORS["L-Index"], label: "L-Index" },
  "4": { finger: "Index", hand: "left", color: FINGER_COLORS["L-Index"], label: "L-Index" },
  "5": { finger: "Index", hand: "left", color: FINGER_COLORS["L-Index"], label: "L-Index" },
  "y": { finger: "Index", hand: "right", color: FINGER_COLORS["R-Index"], label: "R-Index" },
  "h": { finger: "Index", hand: "right", color: FINGER_COLORS["R-Index"], label: "R-Index" },
  "n": { finger: "Index", hand: "right", color: FINGER_COLORS["R-Index"], label: "R-Index" },
  "u": { finger: "Index", hand: "right", color: FINGER_COLORS["R-Index"], label: "R-Index" },
  "j": { finger: "Index", hand: "right", color: FINGER_COLORS["R-Index"], label: "R-Index" },
  "m": { finger: "Index", hand: "right", color: FINGER_COLORS["R-Index"], label: "R-Index" },
  "6": { finger: "Index", hand: "right", color: FINGER_COLORS["R-Index"], label: "R-Index" },
  "7": { finger: "Index", hand: "right", color: FINGER_COLORS["R-Index"], label: "R-Index" },
  "i": { finger: "Middle", hand: "right", color: FINGER_COLORS["R-Middle"], label: "R-Middle" },
  "k": { finger: "Middle", hand: "right", color: FINGER_COLORS["R-Middle"], label: "R-Middle" },
  ",": { finger: "Middle", hand: "right", color: FINGER_COLORS["R-Middle"], label: "R-Middle" },
  "8": { finger: "Middle", hand: "right", color: FINGER_COLORS["R-Middle"], label: "R-Middle" },
  "o": { finger: "Ring", hand: "right", color: FINGER_COLORS["R-Ring"], label: "R-Ring" },
  "l": { finger: "Ring", hand: "right", color: FINGER_COLORS["R-Ring"], label: "R-Ring" },
  ".": { finger: "Ring", hand: "right", color: FINGER_COLORS["R-Ring"], label: "R-Ring" },
  "9": { finger: "Ring", hand: "right", color: FINGER_COLORS["R-Ring"], label: "R-Ring" },
  "p": { finger: "Pinky", hand: "right", color: FINGER_COLORS["R-Pinky"], label: "R-Pinky" },
  ";": { finger: "Pinky", hand: "right", color: FINGER_COLORS["R-Pinky"], label: "R-Pinky" },
  "/": { finger: "Pinky", hand: "right", color: FINGER_COLORS["R-Pinky"], label: "R-Pinky" },
  "'": { finger: "Pinky", hand: "right", color: FINGER_COLORS["R-Pinky"], label: "R-Pinky" },
  "[": { finger: "Pinky", hand: "right", color: FINGER_COLORS["R-Pinky"], label: "R-Pinky" },
  "]": { finger: "Pinky", hand: "right", color: FINGER_COLORS["R-Pinky"], label: "R-Pinky" },
  "\\": { finger: "Pinky", hand: "right", color: FINGER_COLORS["R-Pinky"], label: "R-Pinky" },
  "0": { finger: "Ring", hand: "right", color: FINGER_COLORS["R-Ring"], label: "R-Ring" },
  "-": { finger: "Pinky", hand: "right", color: FINGER_COLORS["R-Pinky"], label: "R-Pinky" },
  "=": { finger: "Pinky", hand: "right", color: FINGER_COLORS["R-Pinky"], label: "R-Pinky" },
};

// ── Learning Chapters ──
const CHAPTERS = [
  {
    id: "home-row-left", title: "Home Row — Left Hand", desc: "Start with A S D F", keys: "asdf",
    words: ["sad","fad","add","dad","as","ad","fa","sass","fads","adds","dads"],
    unlockAt: 0, icon: "🏠",
    guide: {
      title: "Your Left Hand Home Position",
      instructions: ["Place your left pinky on A, ring on S, middle on D, index on F","Feel the small bump on F — that's your anchor point","Keep fingers curved and relaxed, like holding a tennis ball","Rest your thumb gently on the spacebar"],
      fingerMap: "A → Pinky  |  S → Ring  |  D → Middle  |  F → Index",
      warmup: "Practice: asdf fdsa asdf fdsa asas dfdf",
    },
  },
  {
    id: "home-row-right", title: "Home Row — Right Hand", desc: "Add J K L ;", keys: "jkl;",
    words: ["all","hall","kill","jell","kall","jail","jell","llk","jk","lk"],
    unlockAt: 0, icon: "🏡",
    guide: {
      title: "Your Right Hand Home Position",
      instructions: ["Place right index on J, middle on K, ring on L, pinky on ;","Feel the bump on J — right hand anchor","Both hands rest on home row together","Thumbs share the spacebar"],
      fingerMap: "J → Index  |  K → Middle  |  L → Ring  |  ; → Pinky",
      warmup: "Practice: jkl; ;lkj jkjk l;l; jlj; kjkj",
    },
  },
  {
    id: "home-row-full", title: "Home Row — Both Hands", desc: "Combine both hands", keys: "asdfghjkl;",
    words: ["sad","fad","lad","ask","had","jag","gal","all","fall","shall","flask","hash","dash","lash","flash","slash","salad","glass","flags","halls","glad","half","lads","shag","gaff"],
    unlockAt: 5, icon: "🤝",
    guide: {
      title: "Full Home Row Mastery",
      instructions: ["Type using both hands — return to home position after each word","G is left index (stretch right), H is right index (stretch left)","Focus on accuracy over speed","Build clean muscle memory first"],
      fingerMap: "Left: A(pinky) S(ring) D(mid) F(index) G(index)  |  Right: H(index) J(index) K(mid) L(ring) ;(pinky)",
      warmup: "Practice: asjd fklg hash flag glad salad flask",
    },
  },
  {
    id: "top-row-left", title: "Top Row — Left Hand", desc: "Reach up: Q W E R T", keys: "qwertasdf",
    words: ["wet","few","rew","weed","feet","tree","reed","seed","west","rest","test","fest","date","rate","stead","tread","sweat","feast","quest","dread"],
    unlockAt: 10, icon: "⬆️",
    guide: {
      title: "Reaching the Top Row (Left)",
      instructions: ["Each finger reaches UP to its top-row key","Q←Pinky W←Ring E←Middle R←Index T←Index(stretch)","Return finger to home position after each press","Keep wrist steady — move only fingers"],
      fingerMap: "Q(pinky↑) W(ring↑) E(mid↑) R(index↑) T(index stretch↑)",
      warmup: "Practice: qa ws ed rf tg qa ws ed rf tg",
    },
  },
  {
    id: "top-row-right", title: "Top Row — Right Hand", desc: "Reach up: Y U I O P", keys: "yuiopjkl;",
    words: ["you","your","oil","loop","pool","toil","poke","yolk","ploy","joke","oily","pull","opium","poky","jokily","yup","lip","poi","lily","jolly"],
    unlockAt: 15, icon: "☝️",
    guide: {
      title: "Reaching the Top Row (Right)",
      instructions: ["Right hand fingers reach UP","Y←Index(stretch) U←Index I←Middle O←Ring P←Pinky","Practice reaching up and returning to J K L ;","Keep other fingers on home row while one reaches"],
      fingerMap: "Y(index stretch↑) U(index↑) I(mid↑) O(ring↑) P(pinky↑)",
      warmup: "Practice: yj uk il o; pj yj uk il o; pj",
    },
  },
  {
    id: "top-row-full", title: "Top Row — Full Practice", desc: "Home + top row combined", keys: "qwertyuiopasdfghjkl",
    words: ["the","per","quit","type","your","quite","write","quiet","power","equip","tower","reply","worth","poetry","triple","quarter","require","people","purple","pretty","other","water","right","thought","operate"],
    unlockAt: 20, icon: "🎯",
    guide: {
      title: "Home + Top Row Fluency",
      instructions: ["You know 20 keys — enough for most English words!","Focus on smooth transitions between rows","Slow down for fingers that stumble","Even pace beats bursts of speed"],
      fingerMap: "Full top row + home row active",
      warmup: "Practice: the quick power type write people right",
    },
  },
  {
    id: "bottom-row-left", title: "Bottom Row — Left Hand", desc: "Reach down: Z X C V B", keys: "zxcvbasdf",
    words: ["cab","dab","bad","vex","axe","zap","vat","tab","cave","base","face","back","exact","brace","dance","blaze","craze","dance","advance","fabric"],
    unlockAt: 25, icon: "⬇️",
    guide: {
      title: "Reaching the Bottom Row (Left)",
      instructions: ["Each finger reaches DOWN and slightly left","Z←Pinky X←Ring C←Middle V←Index B←Index(stretch)","Bottom row is trickier — take it slow","Anchor wrist, use minimal finger movement"],
      fingerMap: "Z(pinky↓) X(ring↓) C(mid↓) V(index↓) B(index stretch↓)",
      warmup: "Practice: za xs dc fv gb za xs dc fv gb",
    },
  },
  {
    id: "bottom-row-right", title: "Bottom Row — Right Hand", desc: "Reach down: N M , . /", keys: "nm,./jkl;",
    words: ["man","kin","monk","milk","link","mink","link","knot","moon","noon","loom","nimm","klim","moln","minl"],
    unlockAt: 30, icon: "👇",
    guide: {
      title: "Reaching the Bottom Row (Right)",
      instructions: ["N←Index(stretch) M←Index ,←Middle .←Ring /←Pinky","Punctuation uses same fingers as home-row keys","Practice . and , without looking","Keep right thumb on spacebar"],
      fingerMap: "N(index stretch↓) M(index↓) ,(mid↓) .(ring↓) /(pinky↓)",
      warmup: "Practice: jn km l, ;. j/ jn km l, ;. j/",
    },
  },
  {
    id: "bottom-row-full", title: "Bottom Row — Full Practice", desc: "All three rows combined", keys: "zxcvbnmasdfghjklqwertyuiop",
    words: ["box","zinc","mix","vex","ban","can","van","man","buzz","exam","jazz","cozy","maze","next","back","calm","zone","move","fix","blank","complex","amazing","exciting","maximize","visualize"],
    unlockAt: 35, icon: "💪",
    guide: {
      title: "Three-Row Mastery",
      instructions: ["You now have ALL letter keys!","Keep fingers anchored on home row between words","Don't lift your entire hand — just the needed finger","Slow correct typing builds speed faster than fast sloppy typing"],
      fingerMap: "All 26 letter keys + common punctuation active",
      warmup: "Practice: the quick brown fox jumps over the lazy dog",
    },
  },
  {
    id: "common-100", title: "100 Common Words", desc: "Most frequent English words", keys: "",
    words: ["the","be","to","of","and","a","in","that","have","it","for","not","on","with","he","as","you","do","at","this","but","his","by","from","they","we","say","her","she","or","an","will","my","one","all","would","there","their","what","so","up","out","if","about","who","get","which","go","me","when","make","can","like","time","just","know","take","people","into","year","your","good","some","could","them","see","other","than","then","now","look","only","come","its","over","think","also","back","after","use","two","how","our","work","first","well","way","even","new","want","because","any","these","give","day","most"],
    unlockAt: 40, icon: "📝",
    guide: {
      title: "Common Words Drill",
      instructions: ["These 100 words = ~50% of all written English","Type each word as a single fluid motion","Note words that slow you down and repeat them","Word-level muscle memory is the goal"],
      fingerMap: "All keys — focus on word-level muscle memory",
      warmup: "Practice: the and that have with this from they would there",
    },
  },
  {
    id: "numbers", title: "Numbers & Symbols", desc: "Type numbers and punctuation", keys: "1234567890,.",
    words: ["100","2024","3.14","99","42","007","365","1000","50","75","12.5","88","256","512","1024","2048","4096","720","360","180"],
    unlockAt: 50, icon: "🔢",
    guide: {
      title: "Number Row Technique",
      instructions: ["Numbers use same fingers as home-row keys, two rows up","1←L-Pinky 2←L-Ring ... 0←R-Ring","Hardest row — accuracy > speed here","Look at number, press without looking at keyboard"],
      fingerMap: "1(L-pinky) 2(L-ring) 3(L-mid) 4(L-idx) 5(L-idx) 6(R-idx) 7(R-idx) 8(R-mid) 9(R-ring) 0(R-ring)",
      warmup: "Practice: 1a 2s 3d 4f 5f 6j 7j 8k 9l 0l",
    },
  },
  {
    id: "punctuation", title: "Punctuation Practice", desc: "Commas, periods, colons, more", keys: ",.;:'\"!?-",
    words: ["hello,","world.","it's","don't","yes!","why?","well...","one-two","he's","she'll","I'm","can't","won't","let's","that's","what's","they're","we're","you're","isn't"],
    unlockAt: 55, icon: "✏️",
    guide: {
      title: "Punctuation Fluency",
      instructions: ["Period(.)→R-ring, Comma(,)→R-middle (bottom row)","For shifted symbols (!?:), hold Shift with OPPOSITE hand's pinky","Practice . and , until automatic","Good punctuation separates beginners from intermediates"],
      fingerMap: ". (R-ring↓)  , (R-mid↓)  ; (R-pinky)  ' (R-pinky)  Shift+key for !?:\"",
      warmup: "Practice: hello, world. it's great! why? yes. no, maybe.",
    },
  },
  {
    id: "speed-drill", title: "Speed Drill", desc: "Push your limits", keys: "",
    words: ["the","be","to","of","and","in","that","have","it","for","not","on","with","he","as","you","do","at","this","but","from","they","say","she","will","one","all","would","there","what","so","up","out","if","about","who","get","which","go","me","when","make","can","like","time","just","know","take","people","into","year","your","good","some","could","them","see","other","than","then","now","look","only","come","its","over","think","also","back","after","use","two","how","our","work","first","well","way","even","new","want","because","any","these","give","day","most"],
    unlockAt: 60, icon: "🚀",
    guide: {
      title: "Speed Building Techniques",
      instructions: ["All keys learned — now build SPEED","Consistent pace > occasional bursts","Read ahead: next word while typing current one","If accuracy <95%, slow down — accuracy first"],
      fingerMap: "All keys — focus on speed with 95%+ accuracy",
      warmup: "Warm up with easy words first, then push harder",
    },
  },
  {
    id: "advanced-words", title: "Advanced Vocabulary", desc: "Long complex words", keys: "",
    words: ["algorithm","development","implementation","configuration","infrastructure","authentication","optimization","documentation","architecture","environment","performance","accessibility","functionality","comprehensive","visualization","collaboration","revolutionary","extraordinary","communication","international","understanding","determination","opportunities","characteristics","approximately"],
    unlockAt: 70, icon: "🧠",
    guide: {
      title: "Advanced Word Patterns",
      instructions: ["Long words test sustained rhythm","Break mentally: algo-rithm, docu-men-ta-tion","Common suffixes: -tion, -ment, -ness, -able, -ing","One clean pass > corrections"],
      fingerMap: "All keys — sustained accuracy over long words",
      warmup: "Practice: development environment performance documentation",
    },
  },
  {
    id: "code-typing", title: "Code Typing", desc: "Programming syntax", keys: "",
    words: ["const","function","return","import","export","class","async","await","throw","catch","try","new","this","null","true","false","let","var","if","else","for","while","switch","case","break","default","typeof","void","delete","yield"],
    unlockAt: 80, icon: "💻",
    guide: {
      title: "Typing Code Fluently",
      instructions: ["Practice programming keywords","Get comfortable with {} () and =>","Code typing benefits hugely from touch typing","No more hunt-and-peck!"],
      fingerMap: "All keys + symbols — programming keywords",
      warmup: "Practice: const function return import export class async await",
    },
  },
];

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
  for (let i = 0; i < count; i++) words.push(pool[Math.floor(Math.random() * pool.length)]);
  return words;
}

type GameState = "idle" | "playing" | "finished";
type View = "menu" | "chapters" | "lesson" | "typing" | "progress";

// ── Realistic mechanical keyboard sound using noise bursts ──
function createMechanicalSound(ctx: AudioContext, type: "click" | "space" | "back" | "error") {
  const now = ctx.currentTime;

  // White noise buffer
  const bufferSize = ctx.sampleRate * 0.05;
  const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const output = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) output[i] = (Math.random() * 2 - 1);

  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer;

  // Bandpass filter for that "thock" character
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";

  const gain = ctx.createGain();
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  if (type === "click") {
    // Cherry MX-style thock
    filter.frequency.setValueAtTime(3000 + Math.random() * 2000, now);
    filter.Q.setValueAtTime(1.5, now);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    noise.start(now);
    noise.stop(now + 0.04);

    // Add a subtle bottom-out click
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(1200 + Math.random() * 600, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.015);
    oscGain.gain.setValueAtTime(0.06, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);
    osc.start(now);
    osc.stop(now + 0.02);
  } else if (type === "space") {
    // Deeper, longer stabilizer sound
    filter.frequency.setValueAtTime(1500, now);
    filter.Q.setValueAtTime(0.8, now);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    noise.start(now);
    noise.stop(now + 0.07);

    // Low thud
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.05);
    oscGain.gain.setValueAtTime(0.08, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    osc.start(now);
    osc.stop(now + 0.06);
  } else if (type === "back") {
    // Slightly different pitch for backspace
    filter.frequency.setValueAtTime(2000, now);
    filter.Q.setValueAtTime(1.2, now);
    gain.gain.setValueAtTime(0.10, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    noise.start(now);
    noise.stop(now + 0.05);
  } else {
    // Error: slightly harsh
    filter.frequency.setValueAtTime(800, now);
    filter.Q.setValueAtTime(3, now);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    noise.start(now);
    noise.stop(now + 0.06);

    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    osc.type = "square";
    osc.frequency.setValueAtTime(200, now);
    oscGain.gain.setValueAtTime(0.03, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.start(now);
    osc.stop(now + 0.08);
  }
}

function getBestWpm(): number {
  try { return parseInt(localStorage.getItem("typing_best_wpm") || "0"); } catch { return 0; }
}
function saveBestWpm(wpm: number) {
  const best = getBestWpm();
  if (wpm > best) localStorage.setItem("typing_best_wpm", String(wpm));
}
function getChapterBest(chapterId: string): number {
  try { return parseInt(localStorage.getItem(`typing_ch_${chapterId}`) || "0"); } catch { return 0; }
}
function saveChapterBest(chapterId: string, wpm: number) {
  const best = getChapterBest(chapterId);
  if (wpm > best) localStorage.setItem(`typing_ch_${chapterId}`, String(wpm));
}

// ── Finger Overlay Component ──
function FingerOverlay({ nextKey }: { nextKey: string | null }) {
  if (!nextKey || nextKey === " ") {
    return (
      <div className="flex items-center justify-center gap-3 py-2 px-4 bg-accent/30 rounded-xl border border-border/30">
        <div className="flex gap-0.5">
          {/* Left hand */}
          {["L-Pinky","L-Ring","L-Middle","L-Index"].map(f => (
            <div key={f} className="w-5 h-7 rounded-t-full border border-border/30 bg-muted/30 transition-all duration-150"
              style={nextKey === " " ? { backgroundColor: `${FINGER_COLORS.Thumb}33`, borderColor: `${FINGER_COLORS.Thumb}66` } : undefined}
            />
          ))}
        </div>
        {nextKey === " " && (
          <div className="w-20 h-4 rounded-full border-2 transition-all duration-150"
            style={{ backgroundColor: `${FINGER_COLORS.Thumb}44`, borderColor: FINGER_COLORS.Thumb }}
          />
        )}
        <div className="flex gap-0.5">
          {["R-Index","R-Middle","R-Ring","R-Pinky"].map(f => (
            <div key={f} className="w-5 h-7 rounded-t-full border border-border/30 bg-muted/30 transition-all duration-150"
              style={nextKey === " " ? { backgroundColor: `${FINGER_COLORS.Thumb}33`, borderColor: `${FINGER_COLORS.Thumb}66` } : undefined}
            />
          ))}
        </div>
      </div>
    );
  }

  const fm = FINGER_MAP[nextKey.toLowerCase()];
  if (!fm) return null;

  const leftFingers = ["L-Pinky","L-Ring","L-Middle","L-Index"];
  const rightFingers = ["R-Index","R-Middle","R-Ring","R-Pinky"];

  return (
    <div className="flex items-center justify-center gap-6 py-2 px-4 bg-accent/30 rounded-xl border border-border/30">
      <div className="flex gap-0.5">
        {leftFingers.map(f => {
          const isActive = fm.label === f;
          return (
            <div key={f}
              className={cn("w-5 h-7 rounded-t-full border transition-all duration-150", isActive ? "scale-110 shadow-lg" : "bg-muted/30 border-border/30")}
              style={isActive ? { backgroundColor: `${fm.color}55`, borderColor: fm.color, boxShadow: `0 0 8px ${fm.color}44` } : undefined}
            />
          );
        })}
      </div>
      <div className="text-center min-w-[60px]">
        <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: fm.color }}>
          {fm.hand === "left" ? "← " : ""}{fm.finger}{fm.hand === "right" ? " →" : ""}
        </div>
        <div className="text-lg font-bold font-mono" style={{ color: fm.color }}>{nextKey.toUpperCase()}</div>
      </div>
      <div className="flex gap-0.5">
        {rightFingers.map(f => {
          const isActive = fm.label === f;
          return (
            <div key={f}
              className={cn("w-5 h-7 rounded-t-full border transition-all duration-150", isActive ? "scale-110 shadow-lg" : "bg-muted/30 border-border/30")}
              style={isActive ? { backgroundColor: `${fm.color}55`, borderColor: fm.color, boxShadow: `0 0 8px ${fm.color}44` } : undefined}
            />
          );
        })}
      </div>
    </div>
  );
}

export default function TypingSpeedTool() {
  const { user } = useAuth();
  const [view, setView] = useState<View>("menu");
  const [activeChapter, setActiveChapter] = useState<string | null>(null);
  const [duration, setDuration] = useState<number>(30);
  const [words, setWords] = useState<string[]>(() => generateWords(WORD_POOL, 200));
  const [input, setInput] = useState("");
  const [wordIndex, setWordIndex] = useState(0);
  const [state, setState] = useState<GameState>("idle");
  const [timeLeft, setTimeLeft] = useState(30);
  const [correctChars, setCorrectChars] = useState(0);
  const [totalChars, setTotalChars] = useState(0);
  const [correctWords, setCorrectWords] = useState(0);
  const [pressedKey, setPressedKey] = useState<string | null>(null);
  const [charStatuses, setCharStatuses] = useState<Map<string, "correct" | "incorrect">>(new Map());
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [bestWpm] = useState(getBestWpm);
  const [showFingerColors, setShowFingerColors] = useState(false);
  const [showFingerGuide, setShowFingerGuide] = useState(true);
  const [progressData, setProgressData] = useState<Array<{ chapter_id: string; wpm: number; accuracy: number; completed_at: string }>>([]);
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
    try { createMechanicalSound(getAudioCtx(), type); } catch {}
  }, [soundEnabled, getAudioCtx]);

  const activeChapterData = useMemo(() => CHAPTERS.find(c => c.id === activeChapter), [activeChapter]);
  const highlightKeys = useMemo(() => activeChapterData?.keys ? new Set(activeChapterData.keys.split("")) : null, [activeChapterData]);

  // Fetch progress from DB
  const fetchProgress = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("typing_progress")
      .select("chapter_id, wpm, accuracy, completed_at")
      .eq("user_id", user.id)
      .order("completed_at", { ascending: false })
      .limit(200);
    if (data) setProgressData(data as any);
  }, [user]);

  useEffect(() => { fetchProgress(); }, [fetchProgress]);

  const saveProgressToDB = useCallback(async (chapterId: string, wpmVal: number, accVal: number) => {
    if (!user) return;
    await supabase.from("typing_progress").insert({
      user_id: user.id,
      chapter_id: chapterId,
      wpm: wpmVal,
      accuracy: accVal,
    } as any);
    fetchProgress();
  }, [user, fetchProgress]);

  const startTyping = useCallback((chapterId?: string) => {
    const pool = chapterId ? CHAPTERS.find(c => c.id === chapterId)?.words || WORD_POOL : WORD_POOL;
    setActiveChapter(chapterId || null);
    setWords(generateWords(pool, 200));
    setInput("");
    setWordIndex(0);
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

  const restart = useCallback(() => { startTyping(activeChapter || undefined); }, [startTyping, activeChapter]);

  useEffect(() => { if (view === "typing") restart(); }, [duration]);

  useEffect(() => {
    if (state === "playing") {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) { setState("finished"); if (timerRef.current) clearInterval(timerRef.current); return 0; }
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
    if (state === "finished" && wpm > 0) {
      saveBestWpm(wpm);
      const chId = activeChapter || "speed-test";
      saveChapterBest(chId, wpm);
      saveProgressToDB(chId, wpm, accuracy);
    }
  }, [state, wpm, activeChapter, accuracy, saveProgressToDB]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (state === "finished") return;
    const key = e.key;
    setPressedKey(key.toLowerCase());
    setTimeout(() => setPressedKey(null), 100);
    if (state === "idle") { if (key.length === 1) setState("playing"); else return; }
    if (key === " ") {
      e.preventDefault();
      if (input.length === 0) return;
      playKeySound("space");
      if (input === words[wordIndex]) setCorrectWords(p => p + 1);
      setWordIndex(p => p + 1);
      setInput("");
      return;
    }
    if (key === "Backspace") {
      if (input.length > 0) {
        playKeySound("back");
        const newKey = `${wordIndex}-${input.length - 1}`;
        setCharStatuses(prev => { const next = new Map(prev); next.delete(newKey); return next; });
        setInput(p => p.slice(0, -1));
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

  // ── Progress View ──
  if (view === "progress") {
    const chapterBests = new Map<string, { wpm: number; accuracy: number; count: number }>();
    progressData.forEach(p => {
      const existing = chapterBests.get(p.chapter_id);
      if (!existing || p.wpm > existing.wpm) {
        chapterBests.set(p.chapter_id, { wpm: p.wpm, accuracy: p.accuracy, count: (existing?.count || 0) + 1 });
      } else {
        chapterBests.set(p.chapter_id, { ...existing, count: existing.count + 1 });
      }
    });

    const recentSessions = progressData.slice(0, 20);

    return (
      <div className="flex flex-col h-full bg-background overflow-y-auto">
        <div className="max-w-2xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8">
          <button onClick={() => setView("menu")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>

          <h2 className="text-xl font-bold text-foreground mb-1 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" /> Progress Tracker
          </h2>
          <p className="text-sm text-muted-foreground mb-6">{progressData.length} sessions recorded</p>

          {/* Chapter bests */}
          {chapterBests.size > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-foreground mb-3">Chapter Best Scores</h3>
              <div className="space-y-2">
                {Array.from(chapterBests.entries()).map(([chId, data]) => {
                  const ch = CHAPTERS.find(c => c.id === chId);
                  return (
                    <div key={chId} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/40">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-sm">
                        {ch?.icon || "⚡"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-foreground truncate">{ch?.title || chId}</div>
                        <div className="text-[10px] text-muted-foreground">{data.count} sessions</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-primary">{data.wpm} WPM</div>
                        <div className="text-[10px] text-muted-foreground">{data.accuracy}% acc</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recent sessions */}
          {recentSessions.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">Recent Sessions</h3>
              <div className="space-y-1.5">
                {recentSessions.map((s, i) => {
                  const ch = CHAPTERS.find(c => c.id === s.chapter_id);
                  return (
                    <div key={i} className="flex items-center gap-3 py-2 px-3 rounded-lg bg-accent/20 text-sm">
                      <span className="text-xs">{ch?.icon || "⚡"}</span>
                      <span className="flex-1 text-muted-foreground truncate text-xs">{ch?.title || s.chapter_id}</span>
                      <span className="font-semibold text-foreground text-xs">{s.wpm} WPM</span>
                      <span className="text-muted-foreground text-[10px]">{s.accuracy}%</span>
                      <span className="text-muted-foreground text-[10px]">{new Date(s.completed_at).toLocaleDateString()}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {progressData.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No progress yet. Complete a typing session to start tracking!
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Menu View ──
  if (view === "menu") {
    return (
      <div className="flex flex-col h-full bg-background overflow-y-auto">
        <div className="max-w-2xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-12">
          <div className="text-center mb-10">
            <div className="text-4xl mb-3">⌨️</div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">Typing Speed Trainer</h1>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Learn touch typing from scratch or test your speed. {CHAPTERS.length} progressive chapters.
            </p>
            {bestWpm > 0 && (
              <div className="flex items-center justify-center gap-2 mt-3 text-sm">
                <Flame className="w-4 h-4 text-amber-500" />
                <span className="text-muted-foreground">Personal best: <span className="text-foreground font-bold">{bestWpm} WPM</span></span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
            <button onClick={() => startTyping()} className="flex items-center gap-4 p-5 rounded-2xl bg-primary/10 border border-primary/20 hover:bg-primary/15 transition-all text-left group">
              <div className="p-3 rounded-xl bg-primary/20"><Zap className="w-6 h-6 text-primary" /></div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-foreground text-base">Speed Test</div>
                <div className="text-xs text-muted-foreground mt-0.5">Random words</div>
              </div>
            </button>
            <button onClick={() => setView("chapters")} className="flex items-center gap-4 p-5 rounded-2xl bg-card border border-border/50 hover:border-primary/30 transition-all text-left group">
              <div className="p-3 rounded-xl bg-accent"><BookOpen className="w-6 h-6 text-foreground" /></div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-foreground text-base">Learn to Type</div>
                <div className="text-xs text-muted-foreground mt-0.5">{CHAPTERS.length} chapters</div>
              </div>
            </button>
            <button onClick={() => { fetchProgress(); setView("progress"); }} className="flex items-center gap-4 p-5 rounded-2xl bg-card border border-border/50 hover:border-primary/30 transition-all text-left group">
              <div className="p-3 rounded-xl bg-accent"><BarChart3 className="w-6 h-6 text-foreground" /></div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-foreground text-base">Progress</div>
                <div className="text-xs text-muted-foreground mt-0.5">WPM history</div>
              </div>
            </button>
          </div>

          {/* Hand Position Guide */}
          <div className="bg-card rounded-2xl border border-border/40 p-5 mb-4">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Hand className="w-4 h-4 text-primary" /> Proper Hand Position
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div className="bg-accent/30 rounded-xl p-3 space-y-1.5">
                <div className="text-xs font-semibold text-foreground">Left Hand</div>
                <div className="text-[11px] text-muted-foreground space-y-0.5">
                  <div>Pinky → <span className="font-mono text-foreground">A</span></div>
                  <div>Ring → <span className="font-mono text-foreground">S</span></div>
                  <div>Middle → <span className="font-mono text-foreground">D</span></div>
                  <div>Index → <span className="font-mono text-foreground">F</span> (bump ⬤)</div>
                </div>
              </div>
              <div className="bg-accent/30 rounded-xl p-3 space-y-1.5">
                <div className="text-xs font-semibold text-foreground">Right Hand</div>
                <div className="text-[11px] text-muted-foreground space-y-0.5">
                  <div>Index → <span className="font-mono text-foreground">J</span> (bump ⬤)</div>
                  <div>Middle → <span className="font-mono text-foreground">K</span></div>
                  <div>Ring → <span className="font-mono text-foreground">L</span></div>
                  <div>Pinky → <span className="font-mono text-foreground">;</span></div>
                </div>
              </div>
            </div>
            {/* Visual finger color legend */}
            <div className="flex flex-wrap gap-1.5 justify-center">
              {Object.entries(FINGER_COLORS).filter(([k]) => k !== "Thumb").map(([label, color]) => (
                <span key={label} className="text-[9px] px-2 py-0.5 rounded-full border font-medium" style={{ borderColor: `${color}55`, color }}>{label}</span>
              ))}
            </div>
          </div>

          <div className="bg-card rounded-2xl border border-border/40 p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" /> Tips for faster typing
            </h3>
            <ul className="space-y-2 text-xs text-muted-foreground">
              {["Keep fingers on home row (A S D F — J K L ;)","Don't look at keyboard — trust muscle memory","Accuracy first, speed follows","Practice 15 min daily","Use all fingers — each covers specific keys","Read ahead: next word while typing current","Steady rhythm > bursts of speed"].map((tip, i) => (
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
    const userBest = getBestWpm();
    return (
      <div className="flex flex-col h-full bg-background overflow-y-auto">
        <div className="max-w-2xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8">
          <button onClick={() => setView("menu")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <h2 className="text-xl font-bold text-foreground mb-1">Learning Path</h2>
          <p className="text-sm text-muted-foreground mb-2">{CHAPTERS.length} chapters — from single-hand drills to code typing.</p>
          <div className="flex items-center gap-2 mb-6 text-xs text-muted-foreground">
            <Flame className="w-3.5 h-3.5 text-amber-500" />
            Your best: <span className="text-foreground font-bold">{userBest} WPM</span>
          </div>
          <div className="space-y-2">
            {CHAPTERS.map((ch, i) => {
              const isUnlocked = userBest >= ch.unlockAt || i === 0;
              const chBest = getChapterBest(ch.id);
              const dbBest = progressData.filter(p => p.chapter_id === ch.id).sort((a,b) => b.wpm - a.wpm)[0];
              const displayBest = Math.max(chBest, dbBest?.wpm || 0);
              return (
                <button key={ch.id}
                  onClick={() => { if (!isUnlocked) return; setActiveChapter(ch.id); setView("lesson"); }}
                  disabled={!isUnlocked}
                  className={cn("w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-all",
                    isUnlocked ? "bg-card border-border/50 hover:border-primary/30 hover:bg-accent/30" : "bg-muted/20 border-border/20 opacity-50 cursor-not-allowed"
                  )}
                >
                  <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center text-lg shrink-0", isUnlocked ? "bg-primary/10" : "bg-muted/30")}>
                    {isUnlocked ? ch.icon : <Lock className="w-5 h-5 text-muted-foreground/40" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground text-sm">{ch.title}</span>
                      {!isUnlocked && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{ch.unlockAt}+ WPM</span>}
                      {displayBest > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">Best: {displayBest} WPM</span>}
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

  // ── Lesson View ──
  if (view === "lesson" && activeChapterData?.guide) {
    const guide = activeChapterData.guide;
    const chapterIdx = CHAPTERS.findIndex(c => c.id === activeChapter);
    return (
      <div className="flex flex-col h-full bg-background overflow-y-auto">
        <div className="max-w-2xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8">
          <button onClick={() => setView("chapters")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to chapters
          </button>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-xl">{activeChapterData.icon}</div>
            <div>
              <div className="text-xs text-muted-foreground">Chapter {chapterIdx + 1} of {CHAPTERS.length}</div>
              <h2 className="text-lg font-bold text-foreground">{activeChapterData.title}</h2>
            </div>
          </div>

          <div className="bg-primary/5 border border-primary/15 rounded-2xl p-5 mb-4">
            <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2"><Info className="w-4 h-4 text-primary" />{guide.title}</h3>
            <ul className="space-y-2.5">
              {guide.instructions.map((inst, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-foreground/80">
                  <span className="w-5 h-5 rounded-full bg-primary/15 text-primary text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                  {inst}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-card border border-border/40 rounded-2xl p-5 mb-4">
            <h4 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-2"><Hand className="w-3.5 h-3.5" /> Finger Assignment</h4>
            <p className="text-sm font-mono text-foreground/80 bg-accent/30 rounded-lg px-3 py-2">{guide.fingerMap}</p>
          </div>

          <div className="bg-accent/20 border border-border/30 rounded-2xl p-5 mb-6">
            <h4 className="text-xs font-semibold text-muted-foreground mb-2">🔥 Warm-up Exercise</h4>
            <p className="text-sm font-mono text-foreground/70 tracking-wider">{guide.warmup}</p>
          </div>

          {/* Keys preview with finger colors */}
          {activeChapterData.keys && (
            <div className="bg-card border border-border/40 rounded-2xl p-4 mb-6">
              <h4 className="text-xs font-semibold text-muted-foreground mb-3">Keys you'll practice</h4>
              <div className="flex flex-wrap gap-1.5 justify-center">
                {activeChapterData.keys.split("").map((key, i) => {
                  const fm = FINGER_MAP[key];
                  return (
                    <div key={i} className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold border"
                      style={{ backgroundColor: fm ? `${fm.color}22` : undefined, borderColor: fm ? `${fm.color}55` : undefined, color: fm?.color }}>
                      {key.toUpperCase()}
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-2 mt-3 justify-center">
                {Array.from(new Set(activeChapterData.keys.split("").map(k => FINGER_MAP[k]?.label).filter(Boolean))).map(label => {
                  const color = Object.values(FINGER_COLORS).find((_, i) => Object.keys(FINGER_COLORS)[i] === label) || FINGER_COLORS[label as keyof typeof FINGER_COLORS];
                  return (
                    <span key={label} className="text-[10px] px-2 py-0.5 rounded-full border font-medium" style={{ borderColor: `${color}55`, color }}>{label}</span>
                  );
                })}
              </div>
            </div>
          )}

          <button onClick={() => startTyping(activeChapter || undefined)}
            className="w-full px-6 py-3.5 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors flex items-center justify-center gap-2">
            Start Practice <ChevronRight className="w-4 h-4" />
          </button>
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
          <button onClick={() => { if (timerRef.current) clearInterval(timerRef.current); setView(activeChapter ? "lesson" : "menu"); }}
            className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium text-foreground truncate">
            {activeChapterData ? activeChapterData.title : "Speed Test"}
          </span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center bg-card rounded-lg border border-border/50 overflow-hidden">
            {DURATIONS.map(d => (
              <button key={d} onClick={(e) => { e.stopPropagation(); setDuration(d); }}
                className={cn("px-2.5 py-1.5 text-[11px] font-medium transition-all",
                  duration === d ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                )}>
                {d}s
              </button>
            ))}
          </div>
          <button onClick={(e) => { e.stopPropagation(); setShowFingerGuide(p => !p); }}
            className={cn("p-1.5 rounded-lg transition-colors", showFingerGuide ? "text-primary bg-primary/10" : "text-muted-foreground/40 hover:bg-accent")}
            title="Finger guide overlay">
            <Hand className="w-3.5 h-3.5" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); setShowFingerColors(p => !p); }}
            className={cn("p-1.5 rounded-lg transition-colors text-[10px] font-bold", showFingerColors ? "text-primary bg-primary/10" : "text-muted-foreground/40 hover:bg-accent")}
            title="Color-coded keyboard">
            🎨
          </button>
          <button onClick={(e) => { e.stopPropagation(); setSoundEnabled(p => !p); }}
            className={cn("p-1.5 rounded-lg transition-colors", soundEnabled ? "text-primary hover:bg-accent" : "text-muted-foreground/40 hover:bg-accent")}>
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>
          <button onClick={(e) => { e.stopPropagation(); restart(); }}
            className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-8 min-h-0">
        <input ref={inputRef} className="absolute opacity-0 w-0 h-0" onKeyDown={handleKeyDown} value="" onChange={() => {}} autoFocus />

        {state === "finished" ? (
          <div className="text-center space-y-5 animate-in fade-in duration-500">
            <Trophy className="w-10 h-10 text-primary mx-auto" />
            <h2 className="text-2xl font-bold text-foreground">{activeChapterData ? `${activeChapterData.title} Complete!` : "Test Complete!"}</h2>
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
                <Flame className="w-4 h-4" /><span className="font-semibold">New personal best!</span>
              </div>
            )}
            <div className="bg-card border border-border/40 rounded-xl p-4 max-w-sm mx-auto text-left">
              <h4 className="text-xs font-semibold text-muted-foreground mb-2">💡 Tip</h4>
              <p className="text-xs text-muted-foreground">
                {accuracy < 90 ? "Accuracy below 90%. Slow down and focus on correct keys."
                  : wpm < 30 ? "Keep practicing! Try the learning chapters. 15 min daily helps."
                  : wpm < 50 ? "Good progress! Look ahead at the next word while typing."
                  : wpm < 70 ? "Great speed! Practice words that slow you down."
                  : "Excellent! Try Advanced Vocabulary or Code Typing."}
              </p>
            </div>
            {user && <p className="text-[10px] text-muted-foreground">✓ Progress saved to your account</p>}
            <div className="flex gap-3 justify-center pt-2">
              <button onClick={(e) => { e.stopPropagation(); restart(); }} className="px-5 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors">Try Again</button>
              <button onClick={() => setView(activeChapter ? "chapters" : "menu")} className="px-5 py-2 bg-card border border-border/50 text-foreground rounded-xl text-sm font-medium hover:bg-accent transition-colors">
                {activeChapter ? "Chapters" : "Menu"}
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Timer + Stats */}
            <div className="flex items-center gap-4 sm:gap-6 mb-4">
              {state === "playing" ? (
                <>
                  <div className="flex items-center gap-1.5 text-primary font-mono text-xl font-bold"><Timer className="w-4 h-4" />{timeLeft}</div>
                  <div className="text-xs text-muted-foreground"><span className="text-foreground font-semibold">{wpm}</span> wpm</div>
                  <div className="text-xs text-muted-foreground"><span className="text-foreground font-semibold">{accuracy}%</span> acc</div>
                </>
              ) : (
                <div className="text-xs text-muted-foreground/40">start typing to begin…</div>
              )}
            </div>

            {/* Finger guide overlay */}
            {showFingerGuide && (
              <div className="mb-4">
                <FingerOverlay nextKey={nextKey} />
              </div>
            )}

            {/* Words */}
            <div className="max-w-2xl w-full relative" ref={wordsContainerRef}>
              {state === "idle" && (
                <div className="absolute inset-0 flex items-center justify-center z-10">
                  <span className="px-4 py-2 bg-card/90 backdrop-blur-sm border border-border/50 rounded-xl text-sm text-muted-foreground">click or press any key to start</span>
                </div>
              )}
              <div className={cn("font-mono text-base sm:text-lg leading-[2.2] tracking-wide flex flex-wrap gap-x-2.5 max-h-[120px] overflow-hidden", state === "idle" && "blur-[2px] opacity-50")}>
                {visibleWords.map(({ word, globalIndex }) => (
                  <span key={globalIndex} className="inline-block">
                    {word.split("").map((char, ci) => {
                      const statusKey = `${globalIndex}-${ci}`;
                      const status = charStatuses.get(statusKey);
                      const isCursor = globalIndex === wordIndex && ci === input.length;
                      return (
                        <span key={ci} className={cn("relative transition-colors duration-75",
                          status === "correct" && "text-foreground",
                          status === "incorrect" && "text-destructive bg-destructive/10 rounded-sm",
                          !status && globalIndex < wordIndex && "text-foreground/25",
                          !status && globalIndex > wordIndex && "text-muted-foreground/30",
                          !status && globalIndex === wordIndex && "text-muted-foreground/50",
                          isCursor && "border-l-2 border-primary"
                        )}>{char}</span>
                      );
                    })}
                    {globalIndex === wordIndex && input.length > word.length && (
                      <span className="text-destructive/60 bg-destructive/10 rounded-sm">{input.slice(word.length)}</span>
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
                  <div className={cn("flex items-center justify-center rounded text-[8px] sm:text-[10px] font-medium bg-primary/10 text-primary/50 border border-primary/15",
                    ri === 1 ? "w-8 sm:w-12 h-7 sm:h-9" : ri === 2 ? "w-10 sm:w-14 h-7 sm:h-9" : "w-12 sm:w-16 h-7 sm:h-9")}>
                    {ROW_LABELS[ri]}
                  </div>
                )}
                {row.map(key => {
                  const isNext = nextKey === key;
                  const isPressed = pressedKey === key;
                  const isHighlighted = highlightKeys?.has(key);
                  const fm = FINGER_MAP[key];
                  const useFingerColor = showFingerColors && fm;
                  return (
                    <div key={key}
                      className={cn("flex items-center justify-center rounded text-[9px] sm:text-xs font-medium transition-all duration-75 w-6 h-7 sm:w-9 sm:h-9",
                        !useFingerColor && (
                          isPressed ? "bg-primary text-primary-foreground scale-90 shadow-md shadow-primary/30"
                            : isNext ? "bg-primary/25 text-primary border border-primary/50 scale-105"
                            : isHighlighted ? "bg-primary/8 text-primary/70 border border-primary/20"
                            : "bg-muted/40 text-muted-foreground/50 border border-border/20"
                        )
                      )}
                      style={useFingerColor ? {
                        backgroundColor: isPressed ? fm.color : `${fm.color}${isNext ? '44' : '18'}`,
                        color: isPressed ? 'white' : fm.color,
                        borderWidth: 1,
                        borderColor: `${fm.color}${isNext ? '99' : '33'}`,
                        transform: isPressed ? 'scale(0.9)' : isNext ? 'scale(1.05)' : undefined,
                      } : undefined}
                    >
                      {key.toUpperCase()}
                    </div>
                  );
                })}
                {ROW_RIGHT[ri] && (
                  <div className={cn("flex items-center justify-center rounded text-[8px] sm:text-[10px] font-medium bg-muted/40 text-muted-foreground/30 border border-border/20",
                    ri === 0 ? "w-8 sm:w-12 h-7 sm:h-9" : "w-12 sm:w-16 h-7 sm:h-9")}>
                    {ROW_RIGHT[ri]}
                  </div>
                )}
              </div>
            ))}
            <div className="flex gap-[2px] sm:gap-1 justify-center">
              <div className={cn("flex items-center justify-center rounded text-[9px] sm:text-xs font-medium h-7 sm:h-9 w-36 sm:w-56 transition-all duration-75",
                pressedKey === " " ? "bg-primary text-primary-foreground scale-[0.98]"
                  : nextKey === " " ? "bg-primary/25 text-primary border border-primary/50"
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
