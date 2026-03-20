import { useState } from "react";
import {
  ArrowLeft, Cpu, Radio, Activity, Wifi, Loader2, ChevronRight,
  CheckCircle2, XCircle, Star, Zap, Trophy, Brain, RotateCcw
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { streamAI } from "@/lib/streamAI";
import ReactMarkdown from "react-markdown";

type TabId = "digital" | "analog" | "signals" | "comm" | "quiz";
type QuizQ = { question: string; options: string[]; answer: number; explanation: string };

const TABS: { id: TabId; label: string; emoji: string; icon: typeof Cpu }[] = [
  { id: "digital", label: "Digital", emoji: "🔢", icon: Cpu },
  { id: "analog", label: "Analog", emoji: "📻", icon: Radio },
  { id: "signals", label: "Signals", emoji: "📈", icon: Activity },
  { id: "comm", label: "Comm Systems", emoji: "📡", icon: Wifi },
  { id: "quiz", label: "Quiz", emoji: "🧠", icon: Brain },
];

const DIGITAL_TOPICS = [
  "Number Systems & Conversions", "Boolean Algebra & K-Maps", "Logic Gates & Circuits",
  "Combinational Circuits (MUX, Decoder, Adder)", "Sequential Circuits (Flip-Flops, Counters)",
  "Finite State Machines", "Memory & Programmable Logic", "ADC & DAC Converters",
];

const ANALOG_TOPICS = [
  "Diode Circuits & Rectifiers", "BJT Biasing & Amplifiers", "MOSFET & FET Circuits",
  "Operational Amplifiers", "Feedback & Oscillators", "Power Amplifiers",
  "Filters (Active & Passive)", "Voltage Regulators",
];

const SIGNAL_TOPICS = [
  "Signal Classification", "Fourier Series & Transform", "Laplace Transform",
  "Z-Transform", "Sampling Theorem", "LTI Systems & Convolution",
  "Frequency Response", "Digital Signal Processing Basics",
];

const COMM_TOPICS = [
  "AM & FM Modulation", "Digital Modulation (ASK, FSK, PSK, QAM)", "Pulse Modulation (PAM, PWM, PPM, PCM)",
  "Information Theory & Coding", "Error Detection & Correction", "Antenna Fundamentals",
  "Transmission Lines", "Satellite & Optical Communication",
];

// Instant static reference data per topic
const STATIC_DATA: Record<string, string> = {
  "Number Systems & Conversions": "**Key Formulas:**\n- Binary → Decimal: Multiply each bit by 2^position\n- Decimal → Binary: Repeated division by 2\n- Octal (base 8), Hexadecimal (base 16)\n- BCD: Each decimal digit → 4-bit binary\n- 1's complement: Flip all bits | 2's complement: 1's comp + 1\n- r's complement = rⁿ − N",
  "Boolean Algebra & K-Maps": "**Key Laws:**\n- De Morgan: (A·B)' = A'+B', (A+B)' = A'·B'\n- Absorption: A+A·B = A, A·(A+B) = A\n- Consensus: AB+A'C+BC = AB+A'C\n- K-Map grouping: Powers of 2 (1,2,4,8)\n- SOP (Sum of Products) & POS (Product of Sums)\n- Don't care conditions: Use X in K-Map",
  "Logic Gates & Circuits": "**7 Basic Gates:**\n| Gate | Expression | Truth |\n|------|-----------|-------|\n| AND | Y=A·B | 1 only if both 1 |\n| OR | Y=A+B | 0 only if both 0 |\n| NOT | Y=A' | Inverts |\n| NAND | Y=(A·B)' | Universal gate |\n| NOR | Y=(A+B)' | Universal gate |\n| XOR | Y=A⊕B | Odd 1s |\n| XNOR | Y=(A⊕B)' | Even 1s |",
  "Combinational Circuits (MUX, Decoder, Adder)": "**Quick Reference:**\n- **MUX** 2ⁿ:1 → n select lines, 1 output\n- **Decoder** n:2ⁿ → n inputs, 2ⁿ outputs\n- **Half Adder**: S=A⊕B, C=A·B\n- **Full Adder**: S=A⊕B⊕Cin, Cout=AB+Cin(A⊕B)\n- **Encoder**: 2ⁿ inputs → n outputs\n- **Comparator**: A>B, A=B, A<B outputs",
  "Sequential Circuits (Flip-Flops, Counters)": "**Flip-Flop Types:**\n| Type | Characteristic Eq |\n|------|-------------------|\n| SR | Q+ = S + R'Q, SR=0 |\n| JK | Q+ = JQ' + K'Q |\n| D | Q+ = D |\n| T | Q+ = TQ' + T'Q = T⊕Q |\n\n- **Mod-N counter**: N states, needs ⌈log₂N⌉ FFs\n- **Ring counter**: N FFs → Mod-N\n- **Johnson**: N FFs → Mod-2N",
  "Diode Circuits & Rectifiers": "**Key Formulas:**\n- V_D = 0.7V (Si), 0.3V (Ge)\n- **Half-wave**: Vdc = Vm/π, ripple = 1.21\n- **Full-wave**: Vdc = 2Vm/π, ripple = 0.48\n- **Bridge**: 4 diodes, no center tap\n- **Zener**: Voltage regulation, reverse breakdown\n- PIV: Half=Vm, Center-tap=2Vm, Bridge=Vm",
  "BJT Biasing & Amplifiers": "**Quick Reference:**\n- **CE**: High Av, Ai, 180° phase shift\n- **CB**: High Av, Ai≈1, no phase shift\n- **CC**: Av≈1, High Ai, no phase shift (emitter follower)\n- β = Ic/Ib, α = Ic/Ie, β = α/(1-α)\n- Stability factor S = (1+β)/(1+β·Re/(Re+Rb))\n- **Voltage divider bias**: Most stable",
  "Operational Amplifiers": "**Ideal Op-Amp:**\n- Gain = ∞, Rin = ∞, Rout = 0, BW = ∞\n- **Inverting**: Av = -Rf/Rin\n- **Non-inverting**: Av = 1 + Rf/Rin\n- **Summing**: Vo = -(V1·Rf/R1 + V2·Rf/R2)\n- **Differentiator**: Vo = -RC·dVin/dt\n- **Integrator**: Vo = -(1/RC)∫Vin·dt\n- CMRR = Ad/Acm (higher is better)",
  "AM & FM Modulation": "**Key Formulas:**\n- **AM**: s(t) = Ac[1+μ·m(t)]cos(2πfct)\n- Modulation index μ = Am/Ac = (Vmax-Vmin)/(Vmax+Vmin)\n- BW_AM = 2fm, Power = Pc(1+μ²/2)\n- **FM**: BW = 2(Δf+fm) [Carson's rule]\n- Modulation index β = Δf/fm\n- FM is noise-resistant, AM is simpler",
  "Fourier Series & Transform": "**Key Properties:**\n- x(t) = a₀ + Σ[aₙcos(nω₀t) + bₙsin(nω₀t)]\n- Parseval's theorem: Energy in time = Energy in freq\n- FT{x(t-t₀)} = X(ω)·e^(-jωt₀) [Time shift]\n- FT{x(t)·e^(jω₀t)} = X(ω-ω₀) [Freq shift]\n- Convolution in time ↔ Multiplication in freq\n- δ(t) ↔ 1, 1 ↔ 2πδ(ω)",
  "Sampling Theorem": "**Nyquist:**\n- fs ≥ 2·fmax (minimum sampling rate)\n- Aliasing occurs when fs < 2·fmax\n- Anti-aliasing filter: LPF before sampling\n- Reconstruction: Ideal LPF (sinc interpolation)\n- Practical: fs = 2.5 to 5 × fmax",
  "Laplace Transform": "**Common Pairs:**\n| f(t) | F(s) |\n|------|------|\n| δ(t) | 1 |\n| u(t) | 1/s |\n| e^(-at) | 1/(s+a) |\n| t^n | n!/s^(n+1) |\n| sin(ωt) | ω/(s²+ω²) |\n| cos(ωt) | s/(s²+ω²) |",
  "Z-Transform": "**Common Pairs:**\n| x[n] | X(z) |\n|------|------|\n| δ[n] | 1 |\n| u[n] | z/(z-1) |\n| aⁿu[n] | z/(z-a) |\n| naⁿu[n] | az/(z-a)² |\n\n- ROC determines stability & causality\n- Causal: ROC is exterior of circle\n- Stable: ROC includes unit circle",
};

// streamAI is now imported from @/lib/streamAI

export default function ECETool({ onBack }: { onBack?: () => void }) {
  const [activeTab, setActiveTab] = useState<TabId>("digital");
  const [aiContent, setAiContent] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [quizQuestions, setQuizQuestions] = useState<QuizQ[]>([]);
  const [quizIdx, setQuizIdx] = useState(0);
  const [quizAnswer, setQuizAnswer] = useState<number | null>(null);
  const [quizScore, setQuizScore] = useState(0);
  const [quizStreak, setQuizStreak] = useState(0);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizFinished, setQuizFinished] = useState(false);
  const [quizCategory, setQuizCategory] = useState("Mixed");

  const getTopics = () => {
    switch (activeTab) {
      case "digital": return DIGITAL_TOPICS;
      case "analog": return ANALOG_TOPICS;
      case "signals": return SIGNAL_TOPICS;
      case "comm": return COMM_TOPICS;
      default: return [];
    }
  };

  const getSystemPrompt = () => {
    switch (activeTab) {
      case "digital": return "You are an expert in Digital Electronics for ECE students. Explain with truth tables, circuit diagrams (text-based), K-maps, timing diagrams, and solved GATE/university-level examples. Use markdown formatting.";
      case "analog": return "You are an expert in Analog Electronics for ECE students. Explain with circuit analysis, small-signal models, formulas, and solved GATE/university-level examples. Use markdown formatting.";
      case "signals": return "You are an expert in Signals & Systems for ECE students. Explain with mathematical derivations, properties, transforms, and solved GATE/university-level examples. Use markdown formatting with LaTeX for formulas.";
      case "comm": return "You are an expert in Communication Systems for ECE students. Explain with block diagrams, modulation/demodulation concepts, bandwidth calculations, and solved GATE/university-level examples. Use markdown formatting.";
      default: return "";
    }
  };

  const handleTopicClick = async (topic: string) => {
    setSelectedTopic(topic);
    setAiContent("");
    setAiLoading(true);
    const sys = getSystemPrompt();
    const prompt = `Explain "${topic}" comprehensively for an ECE engineering student. Include:\n1. Core concepts & theory\n2. Key formulas & equations\n3. Circuit/block diagrams (text-based)\n4. 2 solved numerical examples (GATE level)\n5. Common mistakes to avoid\n6. Quick revision points`;
    await streamAI(prompt, sys, setAiContent);
    setAiLoading(false);
  };

  const startQuiz = async (category: string) => {
    setQuizCategory(category);
    setQuizQuestions([]);
    setQuizIdx(0);
    setQuizAnswer(null);
    setQuizScore(0);
    setQuizStreak(0);
    setQuizFinished(false);
    setQuizLoading(true);
    const sys = "You are an ECE quiz master. Generate exactly 5 MCQ questions. Return ONLY a JSON array.";
    const prompt = `Generate 5 MCQ questions on "${category}" for ECE students (GATE/university level). Return JSON: [{"question":"...","options":["A","B","C","D"],"answer":0,"explanation":"..."}]`;
    let raw = "";
    await streamAI(prompt, sys, (t) => { raw = t; });
    try {
      const match = raw.match(/\[[\s\S]*\]/);
      if (match) setQuizQuestions(JSON.parse(match[0]));
    } catch {}
    setQuizLoading(false);
  };

  const handleQuizAnswer = (idx: number) => {
    if (quizAnswer !== null) return;
    setQuizAnswer(idx);
    if (idx === quizQuestions[quizIdx]?.answer) {
      setQuizScore((s) => s + 1);
      setQuizStreak((s) => s + 1);
    } else {
      setQuizStreak(0);
    }
  };

  const nextQuestion = () => {
    if (quizIdx + 1 >= quizQuestions.length) { setQuizFinished(true); return; }
    setQuizIdx((i) => i + 1);
    setQuizAnswer(null);
  };

  const QUIZ_CATEGORIES = ["Digital Electronics", "Analog Electronics", "Signals & Systems", "Communication Systems", "Mixed ECE"];

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50 bg-card/50 backdrop-blur-sm">
        {onBack && (
          <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <ArrowLeft className="w-5 h-5 text-muted-foreground" />
          </button>
        )}
        <Cpu className="w-6 h-6 text-primary" />
        <div>
          <h2 className="text-lg font-bold text-foreground">ECE Engineering</h2>
          <p className="text-xs text-muted-foreground">Digital • Analog • Signals • Communication</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-3 py-2 border-b border-border/30 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setSelectedTopic(null); setAiContent(""); }}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap",
              activeTab === tab.id
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <span>{tab.emoji}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === "quiz" ? (
          <div className="max-w-2xl mx-auto space-y-4">
            {quizQuestions.length === 0 && !quizLoading ? (
              <div className="space-y-3">
                <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Brain className="w-5 h-5 text-primary" /> ECE Quiz
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {QUIZ_CATEGORIES.map((cat) => (
                    <button key={cat} onClick={() => startQuiz(cat)}
                      className="p-3 rounded-xl border border-border/50 hover:border-primary/50 hover:bg-primary/5 text-left transition-all">
                      <span className="font-medium text-foreground">{cat}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : quizLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <span className="ml-2 text-muted-foreground">Generating questions...</span>
              </div>
            ) : quizFinished ? (
              <div className="text-center space-y-4 py-8">
                <Trophy className="w-12 h-12 mx-auto text-amber-500" />
                <h3 className="text-2xl font-bold text-foreground">{quizScore}/{quizQuestions.length}</h3>
                <p className="text-muted-foreground">
                  {quizScore === quizQuestions.length ? "Perfect! 🎉" : quizScore >= 3 ? "Good job! 👍" : "Keep practicing! 💪"}
                </p>
                <button onClick={() => { setQuizQuestions([]); setQuizFinished(false); }}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium">
                  <RotateCcw className="w-4 h-4 inline mr-1" /> Try Again
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Q{quizIdx + 1}/{quizQuestions.length}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-sm flex items-center gap-1"><Star className="w-4 h-4 text-amber-500" /> {quizScore}</span>
                    <span className="text-sm flex items-center gap-1"><Zap className="w-4 h-4 text-orange-500" /> {quizStreak}🔥</span>
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-card border border-border/50">
                  <p className="font-medium text-foreground mb-3">{quizQuestions[quizIdx]?.question}</p>
                  <div className="space-y-2">
                    {quizQuestions[quizIdx]?.options.map((opt, i) => (
                      <button key={i} onClick={() => handleQuizAnswer(i)}
                        disabled={quizAnswer !== null}
                        className={cn(
                          "w-full text-left p-3 rounded-lg border transition-all text-sm",
                          quizAnswer === null ? "border-border/50 hover:border-primary/50 hover:bg-primary/5" :
                          i === quizQuestions[quizIdx]?.answer ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" :
                          i === quizAnswer ? "border-red-500 bg-red-500/10 text-red-700 dark:text-red-400" :
                          "border-border/30 opacity-50"
                        )}>
                        <span className="flex items-center gap-2">
                          {quizAnswer !== null && i === quizQuestions[quizIdx]?.answer && <CheckCircle2 className="w-4 h-4" />}
                          {quizAnswer !== null && i === quizAnswer && i !== quizQuestions[quizIdx]?.answer && <XCircle className="w-4 h-4" />}
                          {opt}
                        </span>
                      </button>
                    ))}
                  </div>
                  {quizAnswer !== null && (
                    <div className="mt-3 p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
                      💡 {quizQuestions[quizIdx]?.explanation}
                    </div>
                  )}
                </div>
                {quizAnswer !== null && (
                  <button onClick={nextQuestion} className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-medium">
                    {quizIdx + 1 >= quizQuestions.length ? "See Results" : "Next Question →"}
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="max-w-2xl mx-auto space-y-3">
            {!selectedTopic ? (
              <>
                <h3 className="text-lg font-bold text-foreground mb-3">
                  {TABS.find(t => t.id === activeTab)?.emoji} {TABS.find(t => t.id === activeTab)?.label} Topics
                </h3>
                <div className="grid grid-cols-1 gap-2">
                  {getTopics().map((topic) => (
                    <button key={topic} onClick={() => handleTopicClick(topic)}
                      className="flex items-center justify-between p-3 rounded-xl border border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-all text-left group">
                      <span className="font-medium text-foreground text-sm">{topic}</span>
                      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <button onClick={() => { setSelectedTopic(null); setAiContent(""); }}
                  className="flex items-center gap-1 text-sm text-primary hover:underline">
                  <ArrowLeft className="w-4 h-4" /> Back to topics
                </button>
                <h3 className="text-lg font-bold text-foreground">{selectedTopic}</h3>
                {/* Instant static reference */}
                {STATIC_DATA[selectedTopic] && (
                  <div className="prose prose-sm dark:prose-invert max-w-none p-4 rounded-xl bg-primary/5 border border-primary/20">
                    <div className="text-xs font-semibold text-primary mb-2 flex items-center gap-1">⚡ Quick Reference</div>
                    <ReactMarkdown>{STATIC_DATA[selectedTopic]}</ReactMarkdown>
                  </div>
                )}
                {aiLoading && !aiContent && (
                  <div className="flex items-center gap-2 py-4 justify-center">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    <span className="text-muted-foreground text-sm">Loading detailed explanation...</span>
                  </div>
                )}
                {aiContent && (
                  <div className="prose prose-sm dark:prose-invert max-w-none p-4 rounded-xl bg-card border border-border/50">
                    <ReactMarkdown>{aiContent}</ReactMarkdown>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
