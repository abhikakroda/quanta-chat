import { useState, useCallback } from "react";
import {
  ArrowLeft, Loader2, ChevronRight, CheckCircle2, XCircle, Star, Zap, Trophy, Brain, RotateCcw, Shield
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { streamAI } from "@/lib/streamAI";
import ReactMarkdown from "react-markdown";

type TabId = "syllabus" | "pyq" | "quiz" | "analysis" | "formulas";
type QuizQ = { question: string; options: string[]; answer: number; explanation: string };

const TABS: { id: TabId; label: string; emoji: string }[] = [
  { id: "syllabus", label: "Syllabus", emoji: "📘" },
  { id: "pyq", label: "PYQs", emoji: "📝" },
  { id: "quiz", label: "Quiz", emoji: "🧠" },
  { id: "formulas", label: "Formulas", emoji: "📐" },
  { id: "analysis", label: "Analysis", emoji: "📊" },
];

// ═══ COMPLETE GATE ECE SYLLABUS ═══
const SYLLABUS: Record<string, string[]> = {
  "Networks, Signals & Systems": [
    "Network Theorems (KVL, KCL, Thevenin, Norton, Superposition, Max Power)",
    "Transient & Steady State Response (RL, RC, RLC Circuits)",
    "Sinusoidal Steady State (Phasors, Impedance, Power Factor)",
    "Two-Port Networks (Z, Y, h, ABCD, Interconnection)",
    "Network Functions & Synthesis",
    "Signal Classification & Basic Operations",
    "LTI Systems, Convolution & Correlation",
    "Fourier Series, Fourier Transform & Properties",
    "Laplace Transform & Applications",
    "Z-Transform & Applications",
    "Sampling Theorem, Aliasing & Reconstruction",
    "DFT, FFT & Windowing",
    "Random Signals, Probability & Noise (PDF, PSD, Autocorrelation)",
  ],
  "Electronic Devices": [
    "Energy Bands, Carrier Transport (Drift, Diffusion)",
    "PN Junction Diode (I-V, Breakdown, Zener, Capacitance)",
    "BJT (DC Analysis, Biasing, Small Signal Models, h-parameters)",
    "MOSFET (Operation, I-V, Threshold Voltage, Small Signal)",
    "JFET (Characteristics, Biasing)",
    "Special Devices (Tunnel, Schottky, PIN, Varactor, LED, Photodiode, Solar Cell)",
    "IC Fabrication (Oxidation, Diffusion, Ion Implantation, Lithography, Etching)",
  ],
  "Analog Circuits": [
    "Diode Circuits (Rectifier, Clipper, Clamper, Voltage Multiplier)",
    "BJT & MOSFET Amplifiers (CE, CB, CC, CS, CG, CD — Gain, Ri, Ro)",
    "Multistage Amplifiers & Frequency Response",
    "Feedback Amplifiers (Voltage/Current Series/Shunt — Effect on Gain, BW, Ri, Ro)",
    "Oscillators (Barkhausen, RC, LC, Crystal, Wien Bridge, Phase Shift)",
    "Operational Amplifiers (Ideal/Non-Ideal, CMRR, Slew Rate, GBP)",
    "Op-Amp Applications (Inverting, Non-Inv, Diff, Integrator, Differentiator, Filters)",
    "Power Amplifiers (Class A, B, AB, C — Efficiency, Distortion)",
    "Voltage Regulators (Zener, Series, Shunt, LDO, SMPS Basics)",
    "DAC & ADC (R-2R, Weighted, Flash, SAR, Sigma-Delta)",
  ],
  "Digital Circuits": [
    "Boolean Algebra & Logic Minimization (K-Map, QM, SOP, POS)",
    "Combinational Circuits (MUX, DEMUX, Encoder, Decoder, Adder, Subtractor, Comparator)",
    "Sequential Circuits (SR, JK, D, T Flip-Flops, Excitation Tables)",
    "Counters (Ripple, Synchronous, Ring, Johnson, Modulus-N)",
    "Shift Registers (SISO, SIPO, PISO, PIPO, Universal)",
    "Finite State Machines (Mealy, Moore, State Minimization)",
    "Memory (ROM, RAM, EPROM, EEPROM, Flash) & PLDs (PAL, PLA, FPGA)",
    "Logic Families (TTL, CMOS — Speed, Power, Noise Margin, Fan-out)",
    "Timing Circuits (555 Timer, Monostable, Astable)",
    "Verilog/VHDL Basics",
  ],
  "Control Systems": [
    "Transfer Function & Block Diagram Reduction",
    "Signal Flow Graphs & Mason's Gain Formula",
    "Time Domain Analysis (1st & 2nd Order — Rise, Peak, Settling Time, Overshoot)",
    "Steady State Error & Error Constants (Kp, Kv, Ka)",
    "Stability: Routh-Hurwitz Criterion",
    "Root Locus (Rules, Break-away, Break-in, Gain Margin)",
    "Frequency Response: Bode Plot (Gain & Phase Plots)",
    "Nyquist Stability Criterion & Polar Plot",
    "Gain Margin & Phase Margin",
    "State Space Analysis (State Equations, STM, Controllability, Observability)",
    "PID Controllers & Compensators (Lead, Lag, Lead-Lag)",
  ],
  "Communications": [
    "AM (DSB-FC, DSB-SC, SSB, VSB — BW, Power, Efficiency)",
    "FM & PM (Modulation Index, Carson's Rule, WBFM, NBFM)",
    "Superheterodyne Receiver & Image Frequency",
    "Noise in Communication (SNR, Noise Figure, Friis Formula, Noise Temperature)",
    "Pulse Modulation (PAM, PWM, PPM, PCM, DPCM, DM, ADM)",
    "Digital Modulation (ASK, FSK, BPSK, QPSK, MSK, QAM — BER, BW)",
    "Information Theory (Entropy, Mutual Information, Channel Capacity)",
    "Source Coding (Huffman, Shannon-Fano, LZW)",
    "Channel Coding (Hamming, Cyclic, BCH, Convolutional, Viterbi)",
    "Spread Spectrum (DSSS, FHSS, CDMA, Processing Gain)",
    "OFDM & Multi-carrier Modulation",
  ],
  "Electromagnetics": [
    "Electrostatics (Coulomb, Gauss, Divergence Theorem, Laplace/Poisson)",
    "Magnetostatics (Biot-Savart, Ampere's Law, Stoke's Theorem)",
    "Maxwell's Equations (Differential & Integral Form)",
    "EM Wave Propagation (Free Space, Dielectric, Conductor — α, β, η, vp)",
    "Plane Wave Reflection & Refraction (Normal & Oblique Incidence)",
    "Transmission Lines (VSWR, Reflection Coefficient, Smith Chart, Matching)",
    "Waveguides (Rectangular — TE, TM Modes, Cutoff, Guide Wavelength)",
    "Cavity Resonators & Quality Factor",
    "Antenna Parameters (Gain, Directivity, Effective Area, Radiation Pattern, HPBW)",
    "Antenna Types (Dipole, Monopole, Yagi, Parabolic, Microstrip, Array Factor)",
  ],
  "Engineering Mathematics": [
    "Linear Algebra (Matrix, Eigenvalues, Rank, System of Equations, Cayley-Hamilton)",
    "Calculus (Limits, Continuity, Differentiation, Maxima/Minima, Integration, Multiple Integrals)",
    "Differential Equations (1st & 2nd Order ODE, Particular Integrals, Laplace Method)",
    "Complex Analysis (Analytic Functions, Cauchy's Theorem, Residue, Laurent Series)",
    "Probability & Statistics (Bayes, PDF, CDF, Mean, Variance, Distributions)",
    "Numerical Methods (Newton-Raphson, Trapezoidal, Simpson's, Euler's Method)",
    "Vector Calculus (Gradient, Divergence, Curl, Line/Surface/Volume Integrals, Theorems)",
    "Transform Theory (Fourier, Laplace, Z-Transform Properties & Inverse)",
  ],
};

// ═══ INSTANT STATIC REFERENCE ═══
const STATIC: Record<string, string> = {
  "Network Theorems (KVL, KCL, Thevenin, Norton, Superposition, Max Power)":
    "**Quick Reference:**\n| Theorem | Key Formula |\n|---------|------------|\n| KVL | ΣV = 0 (loop) |\n| KCL | ΣI = 0 (node) |\n| Thevenin | Vth = Voc, Rth = Voc/Isc |\n| Norton | IN = Isc, RN = Rth |\n| Max Power | RL = Rth → Pmax = Vth²/4Rth |\n| Superposition | Linear circuits only |\n| Reciprocity | V₁/I₂ = V₂/I₁ |\n| Millman's | V = ΣVkGk/ΣGk |",

  "PN Junction Diode (I-V, Breakdown, Zener, Capacitance)":
    "**Key Formulas:**\n- I = Is(e^(V/ηVT) − 1), VT ≈ 26mV at 300K\n- Depletion width: W = √(2ε(V₀−V)(NA+ND)/(qNAND))\n- Junction capacitance: Cj = εA/W ∝ (V₀−V)^(-1/2)\n- Diffusion capacitance: Cd = τ·gd = τ·I/VT\n- Zener: VBR < 5V (tunneling), > 5V (avalanche)\n- Si knee ≈ 0.7V, Ge ≈ 0.3V",

  "BJT (DC Analysis, Biasing, Small Signal Models, h-parameters)":
    "**Configurations:**\n| Param | CE | CB | CC |\n|-------|----|----|----|----|\n| Ai | β | ≈1 | β+1 |\n| Av | −gmRC | gmRC | ≈1 |\n| Ri | rπ | re | high |\n| Ro | ro | high | low |\n\n- gm = IC/VT, rπ = β/gm, ro = VA/IC\n- Stability: S = (1+β)/(1+β·RE/(RE+RB))\n- h-params: hie=rπ, hfe=β, hoe=1/ro",

  "MOSFET (Operation, I-V, Threshold Voltage, Small Signal)":
    "**MOSFET Equations:**\n- Cutoff: VGS < Vth → ID = 0\n- Linear: VDS < VGS−Vth → ID = K[2(VGS−Vth)VDS − VDS²]\n- Saturation: VDS ≥ VGS−Vth → ID = K(VGS−Vth)²(1+λVDS)\n- K = μnCox(W/2L)\n- gm = 2ID/(VGS−Vth) = 2√(KID)\n- ro = 1/(λID), rd = 1/gm",

  "Boolean Algebra & Logic Minimization (K-Map, QM, SOP, POS)":
    "**Key Laws:**\n- De Morgan: (AB)' = A'+B', (A+B)' = A'·B'\n- Absorption: A+AB = A, A(A+B) = A\n- Consensus: AB+A'C+BC = AB+A'C\n\n**K-Map:** Groups of 1,2,4,8,16 | Wrap edges | Larger = simpler\n**Don't cares:** Include in groups but not in output\n**QM Method:** For >4 variables — find prime implicants → essential PIs",

  "Fourier Series, Fourier Transform & Properties":
    "**Fourier Series:**\n- f(t) = a₀/2 + Σ(aₙcos(nω₀t) + bₙsin(nω₀t))\n- a₀ = (2/T)∫f(t)dt, aₙ = (2/T)∫f(t)cos(nω₀t)dt\n\n**FT Properties:**\n| Property | Time | Freq |\n|----------|------|------|\n| Linearity | af(t)+bg(t) | aF(ω)+bG(ω) |\n| Time shift | f(t−t₀) | F(ω)e^(−jωt₀) |\n| Freq shift | f(t)e^(jω₀t) | F(ω−ω₀) |\n| Convolution | f*g | F·G |\n| Parseval | ∫|f(t)|²dt = (1/2π)∫|F(ω)|²dω |",

  "Laplace Transform & Applications":
    "**Common Pairs:**\n| f(t) | F(s) |\n|------|------|\n| δ(t) | 1 |\n| u(t) | 1/s |\n| e^(−at) | 1/(s+a) |\n| sin(ωt) | ω/(s²+ω²) |\n| cos(ωt) | s/(s²+ω²) |\n| t^n | n!/s^(n+1) |\n\n- Initial value: f(0⁺) = lim s→∞ sF(s)\n- Final value: f(∞) = lim s→0 sF(s) [if stable]",

  "Transfer Function & Block Diagram Reduction":
    "**Rules:**\n- Series: G₁·G₂\n- Parallel: G₁ + G₂\n- Negative feedback: G/(1+GH)\n- Positive feedback: G/(1−GH)\n\n**2nd Order Standard:**\n- G(s) = ωn²/(s²+2ζωns+ωn²)\n- tp = π/(ωn√(1−ζ²)), ts ≈ 4/(ζωn)\n- Mp = e^(−πζ/√(1−ζ²)) × 100%\n- ess = 1/(1+Kp), Kp = lim s→0 G(s)",

  "Stability: Routh-Hurwitz Criterion":
    "**Routh Table Rules:**\n1. All 1st column elements must be positive for stability\n2. Number of sign changes = RHP poles\n3. Row of zeros → auxiliary polynomial (even powers)\n4. Special case: zero in 1st column → replace with ε→0⁺\n\n**Marginal stability:** Auxiliary polynomial roots on jω axis\n**Relative stability:** Shift axis by σ, apply RH to s = (s'−σ)",

  "Root Locus (Rules, Break-away, Break-in, Gain Margin)":
    "**Rules:**\n1. Branches = max(P,Z), starts at poles, ends at zeros\n2. Real axis: to left of odd count of poles+zeros\n3. Asymptotes: (2q+1)·180°/(n−m), centroid = (Σpoles−Σzeros)/(n−m)\n4. Break-away/in: dK/ds = 0\n5. jω crossing: substitute s=jω, equate real & imaginary\n6. Angle of departure: 180° − (Σ∠poles − Σ∠zeros)",

  "AM (DSB-FC, DSB-SC, SSB, VSB — BW, Power, Efficiency)":
    "**AM Comparison:**\n| Scheme | BW | Power | Efficiency |\n|--------|-----|-------|------|\n| DSB-FC | 2fm | Pc(1+μ²/2) | μ²/(2+μ²) |\n| DSB-SC | 2fm | Pc·μ²/2 | 100% |\n| SSB | fm | Pc·μ²/4 | 100% |\n| VSB | fm+fv | — | ~100% |\n\n- s(t) = Ac[1+μm(t)]cos(2πfct)\n- μ = Am/Ac, BW = 2fm max",

  "FM & PM (Modulation Index, Carson's Rule, WBFM, NBFM)":
    "**Key Formulas:**\n- FM: s(t) = Ac cos(2πfct + β sin2πfmt)\n- β = Δf/fm (modulation index)\n- BW = 2(Δf + fm) — Carson's Rule\n- NBFM: β << 1, BW ≈ 2fm\n- WBFM: β >> 1, BW ≈ 2Δf\n- PM: β = kp·Am (independent of fm)\n- SNR improvement: (SNR)FM = 3β²(β+1)(SNR)baseband",

  "Maxwell's Equations (Differential & Integral Form)":
    "**Maxwell's Equations:**\n| Law | Differential | Integral |\n|-----|-------------|----------|\n| Gauss (E) | ∇·D = ρv | ∮D·dS = Qenc |\n| Gauss (M) | ∇·B = 0 | ∮B·dS = 0 |\n| Faraday | ∇×E = −∂B/∂t | ∮E·dl = −dΦ/dt |\n| Ampere | ∇×H = J+∂D/∂t | ∮H·dl = Ienc+dΨ/dt |\n\n- Wave velocity: v = 1/√(με)\n- Intrinsic impedance: η = √(μ/ε)",

  "Transmission Lines (VSWR, Reflection Coefficient, Smith Chart, Matching)":
    "**Key Formulas:**\n- Γ = (ZL−Z₀)/(ZL+Z₀)\n- VSWR = (1+|Γ|)/(1−|Γ|)\n- Zin = Z₀(ZL+jZ₀tanβl)/(Z₀+jZLtanβl)\n- Quarter-wave: Zin = Z₀²/ZL (matching: Z₀ = √(Z₁Z₂))\n- Half-wave: Zin = ZL\n- Short circuit: Zin = jZ₀tan(βl)\n- Open circuit: Zin = −jZ₀cot(βl)\n- Smith Chart: center=Z₀, outer=0Ω or ∞",

  "Linear Algebra (Matrix, Eigenvalues, Rank, System of Equations, Cayley-Hamilton)":
    "**Key Results:**\n- det(A) = product of eigenvalues\n- trace(A) = sum of eigenvalues\n- Rank = # non-zero rows in RREF\n- Ax=b: Unique if r(A)=r([A|b])=n\n- Infinite if r(A)=r([A|b])<n\n- No solution if r(A)≠r([A|b])\n- Cayley-Hamilton: Every matrix satisfies its own characteristic equation\n- Diagonalization: A = PDP⁻¹ if n linearly independent eigenvectors",

  "Probability & Statistics (Bayes, PDF, CDF, Mean, Variance, Distributions)":
    "**Distributions:**\n| Dist | Mean | Variance |\n|------|------|----------|\n| Binomial(n,p) | np | np(1−p) |\n| Poisson(λ) | λ | λ |\n| Uniform(a,b) | (a+b)/2 | (b−a)²/12 |\n| Gaussian(μ,σ²) | μ | σ² |\n| Exponential(λ) | 1/λ | 1/λ² |\n| Rayleigh(σ) | σ√(π/2) | (2−π/2)σ² |\n\n- Bayes: P(A|B) = P(B|A)P(A)/P(B)\n- Q-function: Q(x) = P(X>x) for N(0,1)",

  "Information Theory (Entropy, Mutual Information, Channel Capacity)":
    "**Key Formulas:**\n- H(X) = −Σp(x)log₂p(x) bits/symbol\n- H(X|Y) = H(X,Y) − H(Y)\n- I(X;Y) = H(X) − H(X|Y) = H(Y) − H(Y|X)\n- Channel capacity: C = B·log₂(1+SNR)\n- Shannon limit: Eb/N₀ = −1.6 dB\n- Source coding: R ≥ H(S)\n- Channel coding: error-free if R ≤ C",

  "Frequency Response: Bode Plot (Gain & Phase Plots)":
    "**Bode Plot Rules:**\n| Factor | Magnitude | Phase |\n|--------|-----------|-------|\n| K | 20log|K| flat | 0° |\n| s | +20dB/dec | +90° |\n| 1/s | −20dB/dec | −90° |\n| (1+s/ω) | +20 after ω | 0→+90° |\n| 1/(1+s/ω) | −20 after ω | 0→−90° |\n\n- GM = −20log|G(jω₁₈₀)| dB\n- PM = 180° + ∠G(jωgc)\n- Stable: GM>0, PM>0",

  "Antenna Parameters (Gain, Directivity, Effective Area, Radiation Pattern, HPBW)":
    "**Key Formulas:**\n- Directivity: D = 4πUmax/Prad\n- Gain: G = ηD, η = Prad/Pin\n- Effective area: Ae = Gλ²/(4π)\n- Friis: Pr/Pt = GtGr(λ/4πd)²\n- HPBW: Half-power beamwidth (−3dB)\n- Hertzian dipole: D = 1.5 (1.76 dBi)\n- Half-wave dipole: D = 1.64 (2.15 dBi)\n- Array factor: AF = Σe^(j(n−1)(kdcosθ+β))",
};

const PYQ_YEARS = ["2024", "2023", "2022", "2021", "2020", "2019", "2018", "2017", "2016", "2015", "2014", "2013", "2012", "2011", "2010"];

const QUIZ_TYPES = [
  "Networks & Signals", "Electronic Devices", "Analog Circuits", "Digital Circuits",
  "Control Systems", "Communications", "Electromagnetics", "Engineering Mathematics",
  "Mixed GATE ECE", "Previous Year Pattern (Numerical)", "Aptitude & Reasoning",
];

async function streamAI(prompt: string, sys: string, onChunk: (t: string) => void) {
  const res = await supabase.functions.invoke("chat", {
    body: { messages: [{ role: "user", content: prompt }], model: "google/gemini-2.5-flash", systemPrompt: sys },
  });
  if (res.data) {
    const reader = res.data.getReader?.();
    if (reader) {
      const dec = new TextDecoder();
      let t = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        t += dec.decode(value, { stream: true });
        onChunk(t);
      }
    } else if (typeof res.data === "string") onChunk(res.data);
  }
}

export default function GATEECETool({ onBack }: { onBack?: () => void }) {
  const [tab, setTab] = useState<TabId>("syllabus");
  const [section, setSection] = useState<string | null>(null);
  const [topic, setTopic] = useState<string | null>(null);
  const [aiContent, setAiContent] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  // Quiz
  const [quizQs, setQuizQs] = useState<QuizQ[]>([]);
  const [qi, setQi] = useState(0);
  const [qa, setQa] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [qLoading, setQLoading] = useState(false);
  const [qDone, setQDone] = useState(false);

  // PYQ
  const [pyqYear, setPyqYear] = useState<string | null>(null);
  const [pyqSubject, setPyqSubject] = useState<string | null>(null);

  // Formula sheet subject
  const [formulaSub, setFormulaSub] = useState<string | null>(null);

  const handleTopic = useCallback(async (t: string, sec: string) => {
    setTopic(t);
    setAiContent("");
    setAiLoading(true);
    await streamAI(
      `Explain "${t}" under "${sec}" comprehensively for GATE ECE preparation. Include:\n1. Complete theory with key derivations\n2. All important formulas (tabulated)\n3. 3 solved GATE-level numerical examples\n4. Key revision points\n5. Common mistakes & GATE exam tips\n6. 2 practice problems with solutions\n7. Weightage: How many questions from this topic in recent GATE papers`,
      "You are a GATE ECE expert. Explain at GATE exam level with rigorous theory, derivations, solved numerical problems. Use markdown with LaTeX for equations.",
      setAiContent
    );
    setAiLoading(false);
  }, []);

  const startQuiz = useCallback(async (type: string) => {
    setQuizQs([]); setQi(0); setQa(null); setScore(0); setStreak(0); setQDone(false); setQLoading(true);
    let raw = "";
    await streamAI(
      `Generate 5 MCQ questions for GATE ECE: "${type}". Include numerical problems with calculations. Difficulty should match actual GATE papers. Return ONLY JSON: [{"question":"...","options":["A","B","C","D"],"answer":0,"explanation":"..."}]`,
      "You are a GATE ECE question generator. Return only a JSON array. Make questions challenging with numerical options.",
      (t) => { raw = t; }
    );
    try { const m = raw.match(/\[[\s\S]*\]/); if (m) setQuizQs(JSON.parse(m[0])); } catch {}
    setQLoading(false);
  }, []);

  const loadPYQ = useCallback(async (year: string, subject: string) => {
    setPyqYear(year); setPyqSubject(subject);
    setAiContent(""); setAiLoading(true);
    await streamAI(
      `Show 8-10 actual GATE ECE ${year} questions from the subject "${subject}". For each provide:\n1. Full question with all options\n2. Correct answer\n3. Detailed step-by-step solution\n4. Key concept tested\nFormat with markdown. If exact questions unavailable, provide questions matching the exact pattern and difficulty of GATE ECE ${year}.`,
      "You are a GATE ECE expert. Provide authentic previous year questions with detailed solutions.",
      setAiContent
    );
    setAiLoading(false);
  }, []);

  const loadFormulas = useCallback(async (sub: string) => {
    setFormulaSub(sub);
    setAiContent(""); setAiLoading(true);
    await streamAI(
      `Create a COMPLETE formula sheet for GATE ECE subject "${sub}". Include:\n- ALL important formulas organized by topic\n- Key constants and standard values\n- Important tables (like truth tables, standard transforms, etc.)\n- Quick-recall mnemonics\n- Units and dimensions\nFormat as a clean, printable reference sheet using markdown tables.`,
      "You are a GATE ECE formula sheet generator. Be exhaustive — include every formula a student needs.",
      setAiContent
    );
    setAiLoading(false);
  }, []);

  const handleAnswer = (i: number) => {
    if (qa !== null) return;
    setQa(i);
    if (i === quizQs[qi]?.answer) { setScore(s => s + 1); setStreak(s => s + 1); } else setStreak(0);
  };

  const nextQ = () => {
    if (qi + 1 >= quizQs.length) { setQDone(true); return; }
    setQi(i => i + 1); setQa(null);
  };

  const resetView = () => { setSection(null); setTopic(null); setAiContent(""); setPyqYear(null); setPyqSubject(null); setFormulaSub(null); };
  const subjects = Object.keys(SYLLABUS);

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
          <h2 className="text-[15px] font-bold text-foreground">GATE ECE</h2>
          <p className="text-[11px] text-muted-foreground">Electronics & Communication — Full Syllabus + PYQs</p>
        </div>
        <div className="px-2 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-bold">All-in-One</div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-3 py-2 border-b border-border/30 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => { setTab(t.id); resetView(); setQuizQs([]); setQDone(false); }}
            className={cn("flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap",
              tab === t.id ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}>
            <span>{t.emoji}</span>{t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-2xl mx-auto space-y-3">

          {/* ═══ SYLLABUS ═══ */}
          {tab === "syllabus" && !topic && (
            !section ? (
              <div className="space-y-3">
                <h3 className="text-base font-bold text-foreground">📘 GATE ECE — Complete Syllabus</h3>
                <p className="text-xs text-muted-foreground">8 subjects · {Object.values(SYLLABUS).flat().length} topics · Select to study</p>
                {subjects.map((s) => (
                  <button key={s} onClick={() => setSection(s)}
                    className="w-full flex items-center justify-between p-4 rounded-xl border border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-all text-left group">
                    <div>
                      <span className="font-semibold text-foreground text-sm">{s}</span>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{SYLLABUS[s].length} topics</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                <button onClick={() => setSection(null)} className="flex items-center gap-1 text-sm text-primary hover:underline">
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <h3 className="text-base font-bold text-foreground">{section}</h3>
                {SYLLABUS[section]?.map((t) => (
                  <button key={t} onClick={() => handleTopic(t, section)}
                    className="w-full flex items-center justify-between p-3 rounded-xl border border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-all text-left group">
                    <span className="font-medium text-foreground text-[13px] flex-1">{t}</span>
                    {STATIC[t] && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium mr-2">⚡ Quick</span>}
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary shrink-0" />
                  </button>
                ))}
              </div>
            )
          )}

          {/* ═══ TOPIC VIEW ═══ */}
          {topic && (
            <div className="space-y-3">
              <button onClick={() => { setTopic(null); setAiContent(""); }} className="flex items-center gap-1 text-sm text-primary hover:underline">
                <ArrowLeft className="w-4 h-4" /> Back to {section}
              </button>
              <h3 className="text-base font-bold text-foreground">{topic}</h3>
              {STATIC[topic] && (
                <div className="prose prose-sm dark:prose-invert max-w-none p-4 rounded-xl bg-primary/5 border border-primary/20">
                  <div className="text-xs font-semibold text-primary mb-2">⚡ Quick Reference</div>
                  <ReactMarkdown>{STATIC[topic]}</ReactMarkdown>
                </div>
              )}
              {aiLoading && !aiContent && (
                <div className="flex items-center gap-2 py-4 justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Loading GATE content...</span>
                </div>
              )}
              {aiContent && (
                <div className="prose prose-sm dark:prose-invert max-w-none p-4 rounded-xl bg-card border border-border/50">
                  <ReactMarkdown>{aiContent}</ReactMarkdown>
                </div>
              )}
            </div>
          )}

          {/* ═══ PYQ ═══ */}
          {tab === "pyq" && (
            <div className="space-y-3">
              {!pyqYear ? (
                <>
                  <h3 className="text-base font-bold text-foreground">📝 GATE ECE Previous Year Questions</h3>
                  <p className="text-xs text-muted-foreground">15 years of PYQs (2010–2024)</p>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {PYQ_YEARS.map(y => (
                      <button key={y} onClick={() => setPyqYear(y)}
                        className="p-3 rounded-xl border border-border/50 hover:border-primary/50 hover:bg-primary/5 text-center transition-all">
                        <span className="text-lg font-bold text-foreground">{y}</span>
                      </button>
                    ))}
                  </div>
                </>
              ) : !pyqSubject ? (
                <>
                  <button onClick={() => setPyqYear(null)} className="flex items-center gap-1 text-sm text-primary hover:underline">
                    <ArrowLeft className="w-4 h-4" /> Back to years
                  </button>
                  <h3 className="text-base font-bold text-foreground">GATE ECE {pyqYear} — Select Subject</h3>
                  {subjects.map(s => (
                    <button key={s} onClick={() => loadPYQ(pyqYear!, s)}
                      className="w-full flex items-center justify-between p-3 rounded-xl border border-border/50 hover:border-primary/50 hover:bg-primary/5 text-left group">
                      <span className="font-medium text-foreground text-sm">{s}</span>
                      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
                    </button>
                  ))}
                </>
              ) : (
                <div className="space-y-3">
                  <button onClick={() => { setPyqSubject(null); setAiContent(""); }} className="flex items-center gap-1 text-sm text-primary hover:underline">
                    <ArrowLeft className="w-4 h-4" /> Back to subjects
                  </button>
                  <h3 className="text-base font-bold text-foreground">GATE ECE {pyqYear} — {pyqSubject}</h3>
                  {aiLoading && !aiContent && (
                    <div className="flex items-center gap-2 py-8 justify-center">
                      <Loader2 className="w-5 h-5 animate-spin text-primary" /><span className="text-muted-foreground text-sm">Loading PYQs...</span>
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

          {/* ═══ QUIZ ═══ */}
          {tab === "quiz" && (
            <div className="space-y-4">
              {quizQs.length === 0 && !qLoading ? (
                <div className="space-y-3">
                  <h3 className="text-lg font-bold text-foreground flex items-center gap-2"><Brain className="w-5 h-5 text-primary" /> GATE ECE Quiz</h3>
                  <p className="text-xs text-muted-foreground">Practice GATE-level MCQs & Numericals</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {QUIZ_TYPES.map(c => (
                      <button key={c} onClick={() => startQuiz(c)}
                        className="p-3 rounded-xl border border-border/50 hover:border-primary/50 hover:bg-primary/5 text-left transition-all">
                        <span className="font-medium text-foreground text-sm">{c}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : qLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" /><span className="ml-2 text-muted-foreground">Generating GATE questions...</span>
                </div>
              ) : qDone ? (
                <div className="text-center space-y-4 py-8">
                  <Trophy className="w-12 h-12 mx-auto text-amber-500" />
                  <h3 className="text-2xl font-bold text-foreground">{score}/{quizQs.length}</h3>
                  <p className="text-muted-foreground">{score === quizQs.length ? "GATE Ready! 🎉" : score >= 3 ? "Good attempt! 👍" : "Keep practicing! 💪"}</p>
                  <button onClick={() => { setQuizQs([]); setQDone(false); }} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium">
                    <RotateCcw className="w-4 h-4 inline mr-1" /> Try Again
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Q{qi + 1}/{quizQs.length}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-sm flex items-center gap-1"><Star className="w-4 h-4 text-amber-500" /> {score}</span>
                      {streak > 1 && <span className="text-sm flex items-center gap-1"><Zap className="w-4 h-4 text-orange-500" /> {streak}🔥</span>}
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-card border border-border/50">
                    <p className="font-medium text-foreground mb-3 text-sm leading-relaxed">{quizQs[qi]?.question}</p>
                    <div className="space-y-2">
                      {quizQs[qi]?.options.map((opt, i) => (
                        <button key={i} onClick={() => handleAnswer(i)} disabled={qa !== null}
                          className={cn("w-full text-left p-3 rounded-lg border transition-all text-sm",
                            qa === null ? "border-border/50 hover:border-primary/50 hover:bg-primary/5" :
                            i === quizQs[qi]?.answer ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" :
                            i === qa ? "border-red-500 bg-red-500/10 text-red-700 dark:text-red-400" : "border-border/30 opacity-50"
                          )}>
                          <span className="flex items-center gap-2">
                            {qa !== null && i === quizQs[qi]?.answer && <CheckCircle2 className="w-4 h-4" />}
                            {qa !== null && i === qa && i !== quizQs[qi]?.answer && <XCircle className="w-4 h-4" />}
                            {opt}
                          </span>
                        </button>
                      ))}
                    </div>
                    {qa !== null && (
                      <div className="mt-3 p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">💡 {quizQs[qi]?.explanation}</div>
                    )}
                  </div>
                  {qa !== null && (
                    <button onClick={nextQ} className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-medium">
                      {qi + 1 >= quizQs.length ? "See Results" : "Next Question →"}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ═══ FORMULAS ═══ */}
          {tab === "formulas" && (
            <div className="space-y-3">
              {!formulaSub ? (
                <>
                  <h3 className="text-base font-bold text-foreground">📐 GATE ECE Formula Sheets</h3>
                  <p className="text-xs text-muted-foreground">Complete formula reference by subject</p>
                  {subjects.map(s => (
                    <button key={s} onClick={() => loadFormulas(s)}
                      className="w-full flex items-center justify-between p-3 rounded-xl border border-border/50 hover:border-primary/50 hover:bg-primary/5 text-left group">
                      <span className="font-medium text-foreground text-sm">{s}</span>
                      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
                    </button>
                  ))}
                </>
              ) : (
                <div className="space-y-3">
                  <button onClick={() => { setFormulaSub(null); setAiContent(""); }} className="flex items-center gap-1 text-sm text-primary hover:underline">
                    <ArrowLeft className="w-4 h-4" /> Back
                  </button>
                  <h3 className="text-base font-bold text-foreground">📐 {formulaSub} — Formula Sheet</h3>
                  {aiLoading && !aiContent && (
                    <div className="flex items-center gap-2 py-8 justify-center">
                      <Loader2 className="w-5 h-5 animate-spin text-primary" /><span className="text-muted-foreground text-sm">Generating formula sheet...</span>
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

          {/* ═══ ANALYSIS ═══ */}
          {tab === "analysis" && (
            <div className="space-y-3">
              {!aiContent && !aiLoading ? (
                <>
                  <h3 className="text-base font-bold text-foreground">📊 GATE ECE Analysis</h3>
                  <p className="text-xs text-muted-foreground">Subject-wise weightage & strategy</p>
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      "Subject-wise Weightage (Last 10 Years)",
                      "Topic-wise Question Distribution 2024",
                      "High-Yield Topics (80/20 Rule)",
                      "Cutoff Trends (2015-2024)",
                      "30-Day Revision Strategy",
                      "60-Day Complete Preparation Plan",
                    ].map(item => (
                      <button key={item} onClick={async () => {
                        setAiContent(""); setAiLoading(true);
                        await streamAI(
                          `Provide detailed "${item}" for GATE ECE. Use tables, charts descriptions, and specific data. Be comprehensive and data-driven.`,
                          "You are a GATE ECE analysis expert. Provide data-driven insights with specific numbers.",
                          setAiContent
                        );
                        setAiLoading(false);
                      }}
                        className="w-full flex items-center justify-between p-3 rounded-xl border border-border/50 hover:border-primary/50 hover:bg-primary/5 text-left group">
                        <span className="font-medium text-foreground text-sm">{item}</span>
                        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <button onClick={() => setAiContent("")} className="flex items-center gap-1 text-sm text-primary hover:underline">
                    <ArrowLeft className="w-4 h-4" /> Back
                  </button>
                  {aiLoading && !aiContent && (
                    <div className="flex items-center gap-2 py-8 justify-center">
                      <Loader2 className="w-5 h-5 animate-spin text-primary" /><span className="text-muted-foreground text-sm">Analyzing...</span>
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
