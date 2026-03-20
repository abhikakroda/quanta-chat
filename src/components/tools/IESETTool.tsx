import { useState, useCallback } from "react";
import {
  ArrowLeft, Cpu, Radio, Activity, Wifi, Loader2, ChevronRight,
  CheckCircle2, XCircle, Star, Zap, Trophy, Brain, RotateCcw,
  MonitorSmartphone, Settings, Waves, CircuitBoard, Shield
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { streamAI } from "@/lib/streamAI";
import ReactMarkdown from "react-markdown";

type TabId = "paper1" | "paper2" | "ga" | "quiz" | "pyq";
type QuizQ = { question: string; options: string[]; answer: number; explanation: string };

const TABS: { id: TabId; label: string; emoji: string }[] = [
  { id: "paper1", label: "Paper I", emoji: "📘" },
  { id: "paper2", label: "Paper II", emoji: "📗" },
  { id: "ga", label: "General Ability", emoji: "📚" },
  { id: "quiz", label: "Quiz", emoji: "🧠" },
  { id: "pyq", label: "PYQs", emoji: "📝" },
];

// ═══ FULL IES/ESE E&T SYLLABUS ═══

const PAPER1_SECTIONS = {
  "Networks & Circuits": [
    "Network Theorems (KVL, KCL, Thevenin, Norton, Superposition)",
    "Transient & Steady State Response (RL, RC, RLC)",
    "Sinusoidal Steady State Analysis (Phasors, Impedance)",
    "Resonance & Coupled Circuits",
    "Two-Port Networks (Z, Y, h, ABCD Parameters)",
    "Network Functions & Synthesis",
    "Filters (Butterworth, Chebyshev, Active Filters)",
  ],
  "EM Theory": [
    "Maxwell's Equations & Boundary Conditions",
    "Wave Propagation (Free Space, Dielectrics, Conductors)",
    "Transmission Lines (Smith Chart, Impedance Matching)",
    "Waveguides (Rectangular, Circular) & Cavity Resonators",
    "Antenna Parameters (Gain, Directivity, Radiation Pattern)",
    "Antenna Types (Dipole, Yagi, Parabolic, Microstrip)",
    "EM Wave Polarization",
  ],
  "Electronic Devices": [
    "PN Junction Diode (I-V, Breakdown, Zener)",
    "BJT (Characteristics, Biasing, Small Signal Models)",
    "MOSFET & JFET (Operation, Characteristics, Biasing)",
    "Special Devices (Tunnel, Schottky, Varactor, PIN, LED, Photodiode)",
    "Semiconductor Physics (Energy Bands, Carrier Transport)",
    "Fabrication Technology (Diffusion, Ion Implantation, Oxidation)",
    "Integrated Circuit Fabrication",
  ],
  "Analog Circuits": [
    "Small Signal Analysis of BJT & FET Amplifiers",
    "Feedback Amplifiers (Voltage & Current, Series & Shunt)",
    "Oscillators (Barkhausen, RC, LC, Crystal)",
    "Operational Amplifiers (Ideal, Non-Ideal, Applications)",
    "Active Filters (LP, HP, BP, Notch) using Op-Amp",
    "Power Amplifiers (Class A, B, AB, C, D)",
    "Voltage Regulators (Linear & Switching)",
    "D/A & A/D Converters (Flash, SAR, Sigma-Delta, R-2R)",
  ],
  "Digital Circuits": [
    "Boolean Algebra & Minimization (K-Map, QM Method)",
    "Combinational Circuits (MUX, Decoder, Encoder, Adder, Comparator)",
    "Sequential Circuits (Flip-Flops, Counters, Shift Registers)",
    "Finite State Machines (Mealy, Moore) & State Reduction",
    "Memory (ROM, RAM, EPROM, Flash) & PLDs",
    "Timing Circuits (555 Timer, Monostable, Astable)",
    "Logic Families (TTL, CMOS) & Interfacing",
  ],
  "Signals & Systems": [
    "Signal Classification & Operations",
    "LTI Systems & Convolution (CT & DT)",
    "Fourier Series & Fourier Transform",
    "Laplace Transform & Applications",
    "Z-Transform & Applications",
    "Sampling Theorem & Aliasing",
    "DFT, FFT & Windowing",
    "Random Signals & Noise (PDF, PSD, Autocorrelation)",
  ],
  "Control Systems": [
    "Transfer Function & Block Diagram Reduction",
    "Signal Flow Graphs (Mason's Gain Formula)",
    "Time Domain Analysis (Step, Ramp, Impulse Response)",
    "Stability (Routh-Hurwitz, Root Locus)",
    "Frequency Domain (Bode Plot, Nyquist, Gain/Phase Margin)",
    "State Space Analysis (State Equations, Controllability, Observability)",
    "PID Controllers & Compensation",
  ],
  "Communication Systems": [
    "AM, FM, PM Modulation & Demodulation",
    "Superheterodyne Receivers",
    "Noise in Communication Systems (SNR, Noise Figure)",
    "Digital Modulation (ASK, FSK, PSK, QAM, OFDM)",
    "Pulse Modulation (PAM, PWM, PPM, PCM, DPCM, DM)",
    "Information Theory (Entropy, Channel Capacity, Shannon's Theorem)",
    "Error Control Coding (Hamming, Cyclic, Convolutional, Turbo, LDPC)",
    "Spread Spectrum (DSSS, FHSS) & CDMA",
  ],
};

const PAPER2_SECTIONS = {
  "Microprocessors & Microcontrollers": [
    "8085 Architecture & Programming",
    "8086 Architecture & Memory Interfacing",
    "8051 Microcontroller (Architecture, Ports, Timers, Interrupts)",
    "ARM Architecture & Instruction Set",
    "Peripheral Interfacing (ADC, DAC, LCD, Keyboard)",
    "DMA, Interrupts & I/O Techniques",
    "Embedded System Design Basics",
  ],
  "Computer Engineering": [
    "Number Systems & Computer Arithmetic",
    "Computer Organization (CPU, ALU, CU, Pipeline)",
    "Memory Hierarchy (Cache, Virtual Memory)",
    "I/O Organization & Buses",
    "Programming Concepts (C, Data Structures)",
    "Operating System Concepts (Process, Scheduling, Deadlock)",
    "Computer Networks (OSI, TCP/IP, Routing, Protocols)",
  ],
  "Advanced Communication": [
    "Satellite Communication (Link Budget, Transponders, Orbits)",
    "Optical Communication (Fiber Types, Sources, Detectors, WDM)",
    "Mobile Communication (GSM, CDMA, LTE, 5G NR)",
    "Radar Systems (Range Equation, Pulse, Doppler, MTI)",
    "Television Engineering (PAL, NTSC, HDTV, Digital TV)",
    "Microwave Engineering (Klystron, Magnetron, TWT, Gunn)",
    "MIMO & Beamforming",
  ],
  "Advanced Electronics": [
    "VLSI Design (CMOS Logic, Layout, Timing, Power)",
    "DSP Applications (FIR, IIR Filters, Adaptive Filtering)",
    "Power Electronics (Rectifiers, Choppers, Inverters, SMPS)",
    "Biomedical Instrumentation (ECG, EEG, CT, MRI basics)",
    "Industrial Instrumentation & Process Control",
    "Nanotechnology & MEMS",
    "IoT Architecture & Protocols",
  ],
};

const GA_SECTIONS = {
  "Current Affairs & GK": [
    "Indian Polity & Constitution",
    "Indian Economy & Budget",
    "Science & Technology in News",
    "Environmental Issues & Agreements",
    "Awards, Honours & Important Dates",
    "Government Schemes & Policies",
  ],
  "English": [
    "Grammar (Tenses, Voice, Narration)",
    "Vocabulary & Synonyms/Antonyms",
    "Comprehension & Précis Writing",
    "Essay Writing (Technical & General)",
  ],
  "Engineering Aptitude": [
    "Engineering Mathematics (Linear Algebra, Calculus, Probability)",
    "Numerical Methods & Statistics",
    "Ethics in Engineering",
    "Project Management & PERT/CPM",
  ],
};

// ═══ INSTANT STATIC REFERENCE DATA ═══
const STATIC_IES: Record<string, string> = {
  "Network Theorems (KVL, KCL, Thevenin, Norton, Superposition)":
    "**Key Theorems:**\n| Theorem | Statement |\n|---------|----------|\n| KVL | ΣV = 0 around any loop |\n| KCL | ΣI = 0 at any node |\n| Thevenin | Vth = Voc, Rth = Voc/Isc |\n| Norton | IN = Isc, RN = Rth |\n| Superposition | Works only for linear circuits |\n| Max Power | RL = Rth for max transfer |\n\n- **Reciprocity**: V₁/I₂ = V₂/I₁ (bilateral networks)\n- **Millman's**: V = ΣVkGk/ΣGk",

  "Maxwell's Equations & Boundary Conditions":
    "**Maxwell's Equations:**\n| Equation | Differential | Integral |\n|----------|-------------|----------|\n| Gauss (E) | ∇·D = ρv | ∮D·dS = Q |\n| Gauss (M) | ∇·B = 0 | ∮B·dS = 0 |\n| Faraday | ∇×E = −∂B/∂t | ∮E·dl = −dΦ/dt |\n| Ampere | ∇×H = J+∂D/∂t | ∮H·dl = I+dΨ/dt |\n\n**Boundary Conditions:**\n- Et1 = Et2, Dn1 − Dn2 = ρs\n- Bn1 = Bn2, Ht1 − Ht2 = Js",

  "PN Junction Diode (I-V, Breakdown, Zener)":
    "**Key Formulas:**\n- I = Is(e^(V/ηVT) − 1), VT = kT/q ≈ 26mV\n- **Zener**: Reverse breakdown, voltage regulation\n- **Avalanche**: High reverse voltage, impact ionization\n- Depletion width: W ∝ √(V₀−V)\n- Capacitance: Cj = εA/W (junction), Cd = τ·dI/dV (diffusion)\n- Si: V_knee ≈ 0.7V, Ge: ≈ 0.3V",

  "BJT (Characteristics, Biasing, Small Signal Models)":
    "**Configurations:**\n| Param | CE | CB | CC |\n|-------|----|----|----|\n| Ai | β | ≈1 | β+1 |\n| Av | −gmRC | gmRC | ≈1 |\n| Ri | rπ | re | high |\n| Ro | ro | high | low |\n\n- β = IC/IB, α = IC/IE, β = α/(1−α)\n- gm = IC/VT, rπ = β/gm\n- Stability factor: S = (1+β)/(1+β·RE/(RE+RB))",

  "Small Signal Analysis of BJT & FET Amplifiers":
    "**BJT Small Signal:**\n- gm = IC/VT, rπ = β/gm, ro = VA/IC\n- CE gain: Av = −gm(RC∥RL)\n- CB gain: Av = gm(RC∥RL)\n- CC gain: Av ≈ 1\n\n**FET Small Signal:**\n- gm = 2ID/|VGS−Vth| = 2√(ID·K)\n- CS gain: Av = −gm(RD∥RL)\n- CD gain: Av = gmRS/(1+gmRS)\n- CG gain: Av = gm(RD∥RL)",

  "Operational Amplifiers (Ideal, Non-Ideal, Applications)":
    "**Ideal Op-Amp:** A=∞, Ri=∞, Ro=0, BW=∞\n\n| Config | Gain | Ri |\n|--------|------|----|\n| Inverting | −Rf/R1 | R1 |\n| Non-inv | 1+Rf/R1 | ∞ |\n| Diff | Rf/R1 | 2R1 |\n| Summing | −Rf(V1/R1+V2/R2) | R1 |\n| Integrator | −1/(sRC) | R |\n| Differentiator | −sRC | 1/(sC) |\n\n- CMRR = Ad/Acm, Slew rate = dVo/dt_max\n- GBP = Av × BW = constant",

  "Boolean Algebra & Minimization (K-Map, QM Method)":
    "**Key Laws:**\n- De Morgan: (AB)' = A'+B', (A+B)' = A'·B'\n- Absorption: A+AB = A, A(A+B) = A\n- Consensus: AB+A'C+BC = AB+A'C\n\n**K-Map Rules:**\n- Group sizes: 1, 2, 4, 8, 16 (powers of 2)\n- Larger groups = simpler terms\n- Wrap around edges allowed\n- Each 1 must be in at least one group\n- **QM Method**: For >4 variables",

  "LTI Systems & Convolution (CT & DT)":
    "**Properties of LTI:**\n- Output: y(t) = x(t) * h(t)\n- Commutative: x*h = h*x\n- Associative: x*(h1*h2) = (x*h1)*h2\n- Distributive: x*(h1+h2) = x*h1 + x*h2\n\n**BIBO Stability:**\n- CT: ∫|h(t)|dt < ∞\n- DT: Σ|h[n]| < ∞\n\n**Causal:** h(t)=0 for t<0 | h[n]=0 for n<0",

  "Transfer Function & Block Diagram Reduction":
    "**Rules:**\n- Series: G1·G2\n- Parallel: G1 + G2\n- Feedback: G/(1+GH) [negative], G/(1−GH) [positive]\n\n**Standard 2nd Order:**\n- G(s) = ωn²/(s²+2ζωns+ωn²)\n- ζ<1: Underdamped, ζ=1: Critical, ζ>1: Overdamped\n- Peak time: tp = π/(ωn√(1−ζ²))\n- Settling time: ts ≈ 4/(ζωn) [2%]",

  "Stability (Routh-Hurwitz, Root Locus)":
    "**Routh-Hurwitz:**\n- All elements in 1st column must be positive\n- Sign changes = number of RHP poles\n- Row of zeros → auxiliary polynomial\n\n**Root Locus Rules:**\n1. Starts at OL poles (K=0), ends at OL zeros (K=∞)\n2. On real axis: to left of odd number of poles+zeros\n3. Asymptotes: (2q+1)×180°/(n−m)\n4. Centroid: (Σpoles−Σzeros)/(n−m)\n5. Break-away: dK/ds = 0",

  "AM, FM, PM Modulation & Demodulation":
    "**AM:**\n- s(t) = Ac[1+μm(t)]cos(2πfct)\n- μ = Am/Ac, BW = 2fm\n- η = μ²/(2+μ²) for tone modulation\n- DSB-SC: BW=2fm, SSB: BW=fm\n\n**FM:**\n- s(t) = Accos(2πfct + β·sin2πfmt)\n- β = Δf/fm (modulation index)\n- BW = 2(Δf+fm) [Carson's Rule]\n- WBFM: β>>1, NBFM: β<<1",

  "Information Theory (Entropy, Channel Capacity, Shannon's Theorem)":
    "**Key Formulas:**\n- Entropy: H = −Σpi·log₂(pi) bits/symbol\n- Max entropy: H_max = log₂(M)\n- Channel capacity: C = B·log₂(1+SNR)\n- Shannon limit: Eb/N0 = −1.6 dB\n- Source coding theorem: R ≥ H(S)\n- Channel coding theorem: R ≤ C for error-free",

  "8085 Architecture & Programming":
    "**8085 Key Facts:**\n- 8-bit processor, 16-bit address bus\n- 40 pins, 6.144 MHz max clock\n- 5 flags: S, Z, AC, P, CY\n- Registers: A, B, C, D, E, H, L, SP, PC\n- Interrupts: TRAP(highest), RST 7.5, 6.5, 5.5, INTR(lowest)\n- TRAP is non-maskable & edge+level triggered\n- 246 instructions, 5 addressing modes",

  "Satellite Communication (Link Budget, Transponders, Orbits)":
    "**Key Concepts:**\n- GEO: 35,786 km, period = 24 hrs\n- LEO: 160-2000 km, MEO: 2000-35,786 km\n- Link budget: Pr = Pt + Gt + Gr − Lp − La\n- Free space loss: Lp = (4πd/λ)²\n- EIRP = Pt × Gt\n- G/T = Figure of merit (dB/K)\n- Transponder BW: 36-72 MHz typical",

  "Optical Communication (Fiber Types, Sources, Detectors, WDM)":
    "**Fiber Types:**\n| Type | Core | BW | Use |\n|------|------|-----|-----|\n| SMF | 8-10μm | Very High | Long haul |\n| MMF Step | 50-62.5μm | Low | Short |\n| MMF Graded | 50-62.5μm | Medium | LAN |\n\n- NA = sin(θmax) = √(n1²−n2²)\n- Sources: LED (incoherent), LASER (coherent)\n- Detectors: PIN (fast), APD (high gain)\n- WDM: Multiple wavelengths on single fiber",

  "VLSI Design (CMOS Logic, Layout, Timing, Power)":
    "**CMOS Basics:**\n- NMOS: pull-down (connect to GND)\n- PMOS: pull-up (connect to VDD)\n- Static power ≈ 0, Dynamic: P = αCVDD²f\n- Propagation delay: tp ∝ CL·VDD/I\n\n**Scaling (λ rule):**\n- If dimensions scale by S: Area→1/S², Speed→S, Power→1/S²\n- **Stick diagrams** & **Euler paths** for layout\n- DRC, LVS, parasitic extraction",

  "Frequency Domain (Bode Plot, Nyquist, Gain/Phase Margin)":
    "**Bode Plot Rules:**\n- Pole at origin: −20dB/dec from start\n- Zero at origin: +20dB/dec from start\n- Simple pole: −20dB/dec after corner freq\n- Simple zero: +20dB/dec after corner freq\n\n**Margins:**\n- GM = −20log|G(jω)| at phase = −180°\n- PM = 180° + ∠G(jω) at |G|=1\n- Stable: GM>0dB & PM>0°",
};

const QUIZ_TYPES = [
  "Paper I - Networks & EM", "Paper I - Electronic Devices & Analog",
  "Paper I - Digital & Signals", "Paper I - Control & Communication",
  "Paper II - Microprocessors", "Paper II - Advanced Comm & Electronics",
  "Mixed IES E&T", "Previous Year Pattern",
];

// streamAI is now imported from @/lib/streamAI

export default function IESETTool({ onBack }: { onBack?: () => void }) {
  const [activeTab, setActiveTab] = useState<TabId>("paper1");
  const [aiContent, setAiContent] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);

  // Quiz
  const [quizQuestions, setQuizQuestions] = useState<QuizQ[]>([]);
  const [quizIdx, setQuizIdx] = useState(0);
  const [quizAnswer, setQuizAnswer] = useState<number | null>(null);
  const [quizScore, setQuizScore] = useState(0);
  const [quizStreak, setQuizStreak] = useState(0);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizFinished, setQuizFinished] = useState(false);

  // PYQ
  const [pyqYear, setPyqYear] = useState<string | null>(null);

  const getSections = () => {
    switch (activeTab) {
      case "paper1": return PAPER1_SECTIONS;
      case "paper2": return PAPER2_SECTIONS;
      case "ga": return GA_SECTIONS;
      default: return {};
    }
  };

  const handleTopicClick = useCallback(async (topic: string, section: string) => {
    setSelectedTopic(topic);
    setAiContent("");
    setAiLoading(true);
    const sys = `You are an IES/ESE (Indian Engineering Services) Electronics & Telecommunication expert. Explain topics at UPSC ESE exam level with rigorous theory, derivations, formulas, solved numerical problems, and previous year GATE/ESE style questions. Use markdown formatting with LaTeX for equations.`;
    const prompt = `Explain "${topic}" under "${section}" comprehensively for IES/ESE E&T preparation. Include:
1. Complete theory with derivations
2. All important formulas (tabulated)
3. 3 solved numerical examples (ESE/GATE level)
4. Key points for quick revision
5. Common mistakes & exam tips
6. 2 previous year style practice questions with solutions`;
    await streamAI(prompt, sys, setAiContent);
    setAiLoading(false);
  }, []);

  const startQuiz = useCallback(async (type: string) => {
    setQuizQuestions([]);
    setQuizIdx(0);
    setQuizAnswer(null);
    setQuizScore(0);
    setQuizStreak(0);
    setQuizFinished(false);
    setQuizLoading(true);
    let raw = "";
    await streamAI(
      `Generate 5 MCQ questions for IES/ESE Electronics & Telecommunication: "${type}". Questions should be at UPSC ESE Prelims difficulty with numerical problems. Return ONLY JSON: [{"question":"...","options":["A","B","C","D"],"answer":0,"explanation":"..."}]`,
      "You are an IES ESE exam question generator. Return only a JSON array. Make questions challenging with numerical options where applicable.",
      (t) => { raw = t; }
    );
    try {
      const match = raw.match(/\[[\s\S]*\]/);
      if (match) setQuizQuestions(JSON.parse(match[0]));
    } catch {}
    setQuizLoading(false);
  }, []);

  const loadPYQ = useCallback(async (year: string) => {
    setPyqYear(year);
    setAiContent("");
    setAiLoading(true);
    await streamAI(
      `Show 10 important previous year questions from IES/ESE Electronics & Telecommunication exam ${year} (or similar pattern questions). For each question provide the full question, 4 options, correct answer, and detailed solution. Format with markdown.`,
      "You are an IES ESE exam expert. Provide authentic exam-pattern questions with detailed solutions.",
      setAiContent
    );
    setAiLoading(false);
  }, []);

  const handleQuizAnswer = (idx: number) => {
    if (quizAnswer !== null) return;
    setQuizAnswer(idx);
    if (idx === quizQuestions[quizIdx]?.answer) {
      setQuizScore(s => s + 1);
      setQuizStreak(s => s + 1);
    } else setQuizStreak(0);
  };

  const nextQuestion = () => {
    if (quizIdx + 1 >= quizQuestions.length) { setQuizFinished(true); return; }
    setQuizIdx(i => i + 1);
    setQuizAnswer(null);
  };

  const resetView = () => {
    setSelectedSection(null);
    setSelectedTopic(null);
    setAiContent("");
    setPyqYear(null);
  };

  const PYQ_YEARS = ["2024", "2023", "2022", "2021", "2020", "2019", "2018", "2017"];

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50 bg-card/50 backdrop-blur-sm">
        {onBack && (
          <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <ArrowLeft className="w-5 h-5 text-muted-foreground" />
          </button>
        )}
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
          <Shield className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1">
          <h2 className="text-[15px] font-bold text-foreground">IES/ESE E&T</h2>
          <p className="text-[11px] text-muted-foreground">UPSC Engineering Services — Electronics & Telecom</p>
        </div>
        <div className="px-2 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-bold">
          Full Syllabus
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-3 py-2 border-b border-border/30 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); resetView(); setQuizQuestions([]); }}
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
        <div className="max-w-2xl mx-auto space-y-3">

          {/* ═══ SYLLABUS TABS (Paper I, II, GA) ═══ */}
          {(activeTab === "paper1" || activeTab === "paper2" || activeTab === "ga") && !selectedTopic && (
            <>
              {!selectedSection ? (
                <div className="space-y-3">
                  <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                    {TABS.find(t => t.id === activeTab)?.emoji} {activeTab === "paper1" ? "Paper I — Technical" : activeTab === "paper2" ? "Paper II — Technical" : "General Ability & Engineering Aptitude"}
                  </h3>
                  <p className="text-xs text-muted-foreground">Select a section to explore topics</p>
                  <div className="grid grid-cols-1 gap-2">
                    {Object.keys(getSections()).map((section) => (
                      <button
                        key={section}
                        onClick={() => setSelectedSection(section)}
                        className="flex items-center justify-between p-4 rounded-xl border border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-all text-left group"
                      >
                        <div>
                          <span className="font-semibold text-foreground text-sm">{section}</span>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {(getSections() as any)[section]?.length} topics
                          </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <button onClick={() => setSelectedSection(null)}
                    className="flex items-center gap-1 text-sm text-primary hover:underline">
                    <ArrowLeft className="w-4 h-4" /> Back to sections
                  </button>
                  <h3 className="text-base font-bold text-foreground">{selectedSection}</h3>
                  <div className="grid grid-cols-1 gap-1.5">
                    {((getSections() as any)[selectedSection] || []).map((topic: string) => (
                      <button
                        key={topic}
                        onClick={() => handleTopicClick(topic, selectedSection!)}
                        className="flex items-center justify-between p-3 rounded-xl border border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-all text-left group"
                      >
                        <span className="font-medium text-foreground text-[13px] flex-1">{topic}</span>
                        {STATIC_IES[topic] && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium mr-2">⚡ Quick</span>}
                        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ═══ TOPIC CONTENT ═══ */}
          {selectedTopic && (
            <div className="space-y-3">
              <button onClick={() => { setSelectedTopic(null); setAiContent(""); }}
                className="flex items-center gap-1 text-sm text-primary hover:underline">
                <ArrowLeft className="w-4 h-4" /> Back to {selectedSection}
              </button>
              <h3 className="text-base font-bold text-foreground">{selectedTopic}</h3>

              {/* Instant static reference */}
              {STATIC_IES[selectedTopic] && (
                <div className="prose prose-sm dark:prose-invert max-w-none p-4 rounded-xl bg-primary/5 border border-primary/20">
                  <div className="text-xs font-semibold text-primary mb-2 flex items-center gap-1">⚡ Quick Reference — Instant Load</div>
                  <ReactMarkdown>{STATIC_IES[selectedTopic]}</ReactMarkdown>
                </div>
              )}

              {aiLoading && !aiContent && (
                <div className="flex items-center gap-2 py-4 justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Loading detailed ESE content...</span>
                </div>
              )}
              {aiContent && (
                <div className="prose prose-sm dark:prose-invert max-w-none p-4 rounded-xl bg-card border border-border/50">
                  <ReactMarkdown>{aiContent}</ReactMarkdown>
                </div>
              )}
            </div>
          )}

          {/* ═══ QUIZ TAB ═══ */}
          {activeTab === "quiz" && (
            <div className="space-y-4">
              {quizQuestions.length === 0 && !quizLoading ? (
                <div className="space-y-3">
                  <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                    <Brain className="w-5 h-5 text-primary" /> IES E&T Quiz
                  </h3>
                  <p className="text-xs text-muted-foreground">Practice ESE-level MCQs</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {QUIZ_TYPES.map((cat) => (
                      <button key={cat} onClick={() => startQuiz(cat)}
                        className="p-3 rounded-xl border border-border/50 hover:border-primary/50 hover:bg-primary/5 text-left transition-all">
                        <span className="font-medium text-foreground text-sm">{cat}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : quizLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <span className="ml-2 text-muted-foreground">Generating ESE questions...</span>
                </div>
              ) : quizFinished ? (
                <div className="text-center space-y-4 py-8">
                  <Trophy className="w-12 h-12 mx-auto text-amber-500" />
                  <h3 className="text-2xl font-bold text-foreground">{quizScore}/{quizQuestions.length}</h3>
                  <p className="text-muted-foreground">
                    {quizScore === quizQuestions.length ? "IES Ready! 🎉" : quizScore >= 3 ? "Good attempt! 👍" : "Keep revising! 💪"}
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
                      {quizStreak > 1 && <span className="text-sm flex items-center gap-1"><Zap className="w-4 h-4 text-orange-500" /> {quizStreak}🔥</span>}
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-card border border-border/50">
                    <p className="font-medium text-foreground mb-3 text-sm leading-relaxed">{quizQuestions[quizIdx]?.question}</p>
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
          )}

          {/* ═══ PYQ TAB ═══ */}
          {activeTab === "pyq" && (
            <div className="space-y-3">
              {!pyqYear ? (
                <>
                  <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                    📝 Previous Year Questions
                  </h3>
                  <p className="text-xs text-muted-foreground">Select a year to load ESE E&T pattern questions</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {PYQ_YEARS.map(year => (
                      <button key={year} onClick={() => loadPYQ(year)}
                        className="p-4 rounded-xl border border-border/50 hover:border-primary/50 hover:bg-primary/5 text-center transition-all">
                        <span className="text-lg font-bold text-foreground">{year}</span>
                        <p className="text-[10px] text-muted-foreground mt-0.5">ESE E&T</p>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <button onClick={() => { setPyqYear(null); setAiContent(""); }}
                    className="flex items-center gap-1 text-sm text-primary hover:underline">
                    <ArrowLeft className="w-4 h-4" /> Back to years
                  </button>
                  <h3 className="text-base font-bold text-foreground">ESE E&T {pyqYear} — Pattern Questions</h3>
                  {aiLoading && !aiContent && (
                    <div className="flex items-center gap-2 py-8 justify-center">
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                      <span className="text-muted-foreground text-sm">Loading questions...</span>
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
    </div>
  );
}
