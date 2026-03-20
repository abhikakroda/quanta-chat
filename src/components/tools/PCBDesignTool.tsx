import { useState, useCallback, useRef, useEffect } from "react";
import {
  ArrowLeft, Loader2, CircuitBoard, Layers, Cpu, Zap, RotateCcw,
  ZoomIn, ZoomOut, Move, MousePointer, Trash2, Download, Plus, Settings, Grid3X3,
  GitBranch, ArrowRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { streamAI } from "@/lib/streamAI";
import ReactMarkdown from "react-markdown";

type TabId = "schematic" | "design" | "components" | "learn" | "review" | "quiz";

type Component = {
  id: string;
  type: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  pins: { x: number; y: number; label: string }[];
  rotation: number;
  value?: string;
  footprint?: string;
  color: string;
};

type Trace = {
  id: string;
  points: { x: number; y: number }[];
  layer: "top" | "bottom";
  width: number;
};

type PCBProject = {
  name: string;
  width: number;
  height: number;
  components: Component[];
  traces: Trace[];
  layers: number;
};

// ── Schematic types ──
type SchematicSymbol = {
  id: string;
  type: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  pins: { x: number; y: number; label: string; netId?: string }[];
  rotation: number;
  value?: string;
};

type Wire = {
  id: string;
  points: { x: number; y: number }[];
  netName?: string;
};

type SchematicProject = {
  symbols: SchematicSymbol[];
  wires: Wire[];
  nets: string[];
};

const TABS: { id: TabId; label: string; emoji: string }[] = [
  { id: "schematic", label: "Schematic", emoji: "📐" },
  { id: "design", label: "PCB Layout", emoji: "🔧" },
  { id: "components", label: "Library", emoji: "📦" },
  { id: "learn", label: "Learn PCB", emoji: "📘" },
  { id: "review", label: "AI Review", emoji: "🤖" },
  { id: "quiz", label: "Quiz", emoji: "🧠" },
];

// Schematic symbol library
const SCHEMATIC_SYMBOLS = {
  "Passive": [
    { type: "sch-resistor", label: "R", w: 60, h: 20, pins: [{ x: 0, y: 10, label: "1" }, { x: 60, y: 10, label: "2" }], values: ["1kΩ","10kΩ","100kΩ","4.7kΩ","330Ω"] },
    { type: "sch-capacitor", label: "C", w: 30, h: 30, pins: [{ x: 15, y: 0, label: "+" }, { x: 15, y: 30, label: "-" }], values: ["100nF","10μF","1μF","22pF","100pF"] },
    { type: "sch-inductor", label: "L", w: 60, h: 20, pins: [{ x: 0, y: 10, label: "1" }, { x: 60, y: 10, label: "2" }], values: ["10μH","100μH","1mH"] },
    { type: "sch-diode", label: "D", w: 40, h: 24, pins: [{ x: 0, y: 12, label: "A" }, { x: 40, y: 12, label: "K" }], values: ["1N4148","1N4007","Zener 5.1V"] },
  ],
  "Active": [
    { type: "sch-npn", label: "Q", w: 40, h: 50, pins: [{ x: 0, y: 25, label: "B" }, { x: 40, y: 5, label: "C" }, { x: 40, y: 45, label: "E" }], values: ["2N2222","BC547","2N3904"] },
    { type: "sch-opamp", label: "U", w: 60, h: 50, pins: [{ x: 0, y: 15, label: "IN+" }, { x: 0, y: 35, label: "IN-" }, { x: 60, y: 25, label: "OUT" }, { x: 30, y: 0, label: "V+" }, { x: 30, y: 50, label: "V-" }], values: ["LM358","NE5532","TL072"] },
    { type: "sch-led", label: "LED", w: 30, h: 24, pins: [{ x: 0, y: 12, label: "A" }, { x: 30, y: 12, label: "K" }], values: ["Red","Green","Blue"] },
    { type: "sch-mcu", label: "U", w: 80, h: 100, pins: [
      { x: 0, y: 15, label: "VCC" }, { x: 0, y: 30, label: "GND" }, { x: 0, y: 45, label: "RST" }, { x: 0, y: 60, label: "XTAL1" }, { x: 0, y: 75, label: "XTAL2" },
      { x: 80, y: 15, label: "PB0" }, { x: 80, y: 30, label: "PB1" }, { x: 80, y: 45, label: "PB2" }, { x: 80, y: 60, label: "PB3" }, { x: 80, y: 75, label: "PB4" },
    ], values: ["ATmega328","STM32F103","ESP32"] },
  ],
  "Power": [
    { type: "sch-vcc", label: "VCC", w: 20, h: 24, pins: [{ x: 10, y: 24, label: "VCC" }], values: ["3.3V","5V","12V"] },
    { type: "sch-gnd", label: "GND", w: 20, h: 24, pins: [{ x: 10, y: 0, label: "GND" }], values: ["GND"] },
    { type: "sch-vreg", label: "U", w: 60, h: 40, pins: [{ x: 0, y: 20, label: "IN" }, { x: 30, y: 40, label: "GND" }, { x: 60, y: 20, label: "OUT" }], values: ["LM7805","AMS1117-3.3"] },
  ],
  "Connectors": [
    { type: "sch-conn2", label: "J", w: 24, h: 30, pins: [{ x: 24, y: 8, label: "1" }, { x: 24, y: 22, label: "2" }], values: ["Header 2P"] },
    { type: "sch-conn4", label: "J", w: 24, h: 50, pins: [{ x: 24, y: 8, label: "1" }, { x: 24, y: 20, label: "2" }, { x: 24, y: 32, label: "3" }, { x: 24, y: 44, label: "4" }], values: ["Header 4P"] },
  ],
};

// Component library (PCB)
const COMPONENT_LIBRARY = {
  "Passive": [
    { type: "resistor", label: "Resistor", w: 50, h: 20, pins: [{ x: 0, y: 10, label: "1" }, { x: 50, y: 10, label: "2" }], color: "hsl(var(--primary))", footprint: "0805/0603/1206", values: ["1Ω","10Ω","100Ω","1kΩ","10kΩ","100kΩ","1MΩ"] },
    { type: "capacitor", label: "Capacitor", w: 30, h: 30, pins: [{ x: 0, y: 15, label: "+" }, { x: 30, y: 15, label: "-" }], color: "hsl(var(--accent))", footprint: "0805/0603/1206", values: ["1pF","10pF","100pF","1nF","10nF","100nF","1μF","10μF","100μF"] },
    { type: "inductor", label: "Inductor", w: 50, h: 20, pins: [{ x: 0, y: 10, label: "1" }, { x: 50, y: 10, label: "2" }], color: "hsl(var(--secondary))", footprint: "0805/1210", values: ["1μH","10μH","100μH","1mH","10mH"] },
    { type: "diode", label: "Diode", w: 40, h: 20, pins: [{ x: 0, y: 10, label: "A" }, { x: 40, y: 10, label: "K" }], color: "hsl(var(--destructive))", footprint: "SOD-123/SOD-323", values: ["1N4148","1N4007","Zener"] },
  ],
  "Active": [
    { type: "ic-dip8", label: "IC DIP-8", w: 60, h: 40, pins: [{ x: 0, y: 10, label: "1" },{ x: 0, y: 20, label: "2" },{ x: 0, y: 30, label: "3" },{ x: 0, y: 40, label: "4" },{ x: 60, y: 10, label: "5" },{ x: 60, y: 20, label: "6" },{ x: 60, y: 30, label: "7" },{ x: 60, y: 40, label: "8" }], color: "hsl(var(--foreground))", footprint: "DIP-8", values: ["555","LM358","ATtiny85","NE5532"] },
    { type: "transistor", label: "Transistor", w: 30, h: 35, pins: [{ x: 0, y: 18, label: "B" },{ x: 15, y: 0, label: "C" },{ x: 15, y: 35, label: "E" }], color: "hsl(var(--primary))", footprint: "SOT-23/TO-92", values: ["2N2222","BC547","IRF540","2N3904"] },
    { type: "led", label: "LED", w: 25, h: 25, pins: [{ x: 0, y: 12, label: "A" },{ x: 25, y: 12, label: "K" }], color: "#22c55e", footprint: "0805/3mm/5mm", values: ["Red","Green","Blue","White","Yellow"] },
    { type: "mcu", label: "MCU", w: 80, h: 80, pins: Array.from({length: 16}, (_, i) => ({ x: i < 8 ? 0 : 80, y: (i % 8 + 1) * 9, label: `P${i}` })), color: "hsl(var(--foreground))", footprint: "QFP-32/QFN-32", values: ["ATmega328","STM32F103","ESP32","PIC16F877"] },
  ],
  "Connectors": [
    { type: "header-2", label: "Header 2-pin", w: 20, h: 25, pins: [{ x: 10, y: 5, label: "1" },{ x: 10, y: 20, label: "2" }], color: "hsl(var(--muted-foreground))", footprint: "2.54mm", values: ["Power","Signal"] },
    { type: "usb-c", label: "USB-C", w: 40, h: 25, pins: [{ x: 5, y: 12, label: "V+" },{ x: 15, y: 12, label: "D-" },{ x: 25, y: 12, label: "D+" },{ x: 35, y: 12, label: "GND" }], color: "hsl(var(--muted-foreground))", footprint: "USB-C", values: ["USB-C"] },
    { type: "barrel-jack", label: "Barrel Jack", w: 35, h: 30, pins: [{ x: 5, y: 15, label: "+" },{ x: 30, y: 15, label: "-" }], color: "hsl(var(--muted-foreground))", footprint: "Barrel 5.5×2.1mm", values: ["DC Jack"] },
  ],
  "Power": [
    { type: "vreg", label: "Voltage Regulator", w: 50, h: 30, pins: [{ x: 0, y: 15, label: "IN" },{ x: 25, y: 30, label: "GND" },{ x: 50, y: 15, label: "OUT" }], color: "hsl(var(--destructive))", footprint: "SOT-223/TO-220", values: ["LM7805","LM1117-3.3","AMS1117"] },
    { type: "crystal", label: "Crystal", w: 35, h: 15, pins: [{ x: 0, y: 8, label: "1" },{ x: 35, y: 8, label: "2" }], color: "hsl(var(--accent))", footprint: "HC49/SMD", values: ["8MHz","16MHz","32.768kHz","20MHz"] },
  ],
};

const LEARN_TOPICS = {
  "PCB Basics": [
    "PCB Layers (Top, Bottom, Inner, Silk, Mask, Paste)",
    "Component Footprints & Land Patterns",
    "Through-hole vs SMD Components",
    "PCB Material (FR-4, Rogers, Flex PCB)",
    "Copper Weight & Track Width",
    "Via Types (Through, Blind, Buried, Micro)",
  ],
  "Design Rules": [
    "Trace Width Calculator (Current vs Width)",
    "Clearance & Spacing Rules",
    "Ground Plane Design & Copper Pour",
    "Decoupling Capacitor Placement",
    "Power Distribution Network (PDN)",
    "Thermal Management & Heat Sinks",
  ],
  "Layout Techniques": [
    "Component Placement Strategy",
    "Signal Routing Best Practices",
    "Differential Pair Routing",
    "High-Speed Design (Impedance Control)",
    "EMI/EMC Design Guidelines",
    "Design for Manufacturing (DFM)",
  ],
  "Advanced Topics": [
    "Multi-layer PCB Stackup Design",
    "RF PCB Design Principles",
    "Mixed-Signal PCB Layout",
    "Flex & Rigid-Flex PCB Design",
    "BGA Fanout Strategies",
    "PCB Panelization & Assembly",
  ],
};

const STATIC_REF: Record<string, string> = {
  "Trace Width Calculator (Current vs Width)":
    "**IPC-2221 Standard (1oz Cu, 10°C rise):**\n| Current | External Width | Internal Width |\n|---------|---------------|----------------|\n| 0.5A | 10 mil | 20 mil |\n| 1A | 20 mil | 40 mil |\n| 2A | 50 mil | 100 mil |\n| 3A | 80 mil | 150 mil |\n| 5A | 150 mil | 300 mil |\n\n- Formula: I = k × ΔT^0.44 × A^0.725\n- k = 0.048 (external), 0.024 (internal)\n- A = cross-section area (mil²) = Width × Thickness",
  "Via Types (Through, Blind, Buried, Micro)":
    "**Via Comparison:**\n| Type | Layers | Cost | Use Case |\n|------|--------|------|----------|\n| Through-hole | All | Low | Standard |\n| Blind | Outer→Inner | Medium | HDI |\n| Buried | Inner→Inner | High | HDI |\n| Micro-via | Adjacent | High | BGA fanout |\n\n- Standard via: 0.3mm drill, 0.6mm pad\n- Micro-via: 0.1mm drill, 0.25mm pad\n- Via current: ~1A for 0.3mm drill (1oz Cu)",
  "Clearance & Spacing Rules":
    "**IPC-2221 Minimum Spacing:**\n| Voltage | Internal | External |\n|---------|----------|----------|\n| 0-15V | 5 mil | 4 mil |\n| 16-30V | 5 mil | 8 mil |\n| 31-50V | 10 mil | 15 mil |\n| 51-100V | 10 mil | 25 mil |\n| 101-150V | 15 mil | 50 mil |\n| 151-300V | 30 mil | 100 mil |\n\n- Min trace-to-trace: 6 mil (standard), 4 mil (fine pitch)\n- Solder mask: 2-3 mil expansion",
  "Component Placement Strategy":
    "**Placement Priority Order:**\n1. Connectors & mounting holes → Board edge\n2. MCU/FPGA → Center, aligned to grid\n3. Decoupling caps → Closest to IC power pins\n4. Clock circuits → Near MCU, short traces\n5. Power section → Input side, separated\n6. Analog section → Away from digital noise\n\n**Rules of thumb:**\n- Keep bypass caps within 2mm of IC pins\n- Orient ICs consistently (Pin 1 same direction)\n- Group by function, not by type",
};

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

// ── Schematic symbol drawing helpers ──
function drawSchSymbol(ctx: CanvasRenderingContext2D, sym: SchematicSymbol, isSelected: boolean, isDark: boolean) {
  const fg = isDark ? "#e5e5e5" : "#1a1a1a";
  const selColor = isDark ? "#60a5fa" : "#2563eb";
  const pinColor = isDark ? "#f59e0b" : "#d97706";

  ctx.save();
  ctx.translate(sym.x, sym.y);

  // Body
  ctx.strokeStyle = isSelected ? selColor : fg;
  ctx.lineWidth = isSelected ? 2 : 1.5;
  ctx.fillStyle = isSelected ? (isDark ? "rgba(96,165,250,0.08)" : "rgba(37,99,235,0.06)") : "transparent";

  if (sym.type === "sch-resistor") {
    ctx.fillRect(10, 0, 40, sym.height);
    ctx.strokeRect(10, 0, 40, sym.height);
    // Zigzag
    ctx.beginPath();
    ctx.moveTo(0, 10); ctx.lineTo(10, 10);
    ctx.moveTo(50, 10); ctx.lineTo(60, 10);
    ctx.stroke();
  } else if (sym.type === "sch-capacitor") {
    ctx.beginPath();
    ctx.moveTo(sym.width / 2, 0); ctx.lineTo(sym.width / 2, 8);
    ctx.moveTo(sym.width / 2, 22); ctx.lineTo(sym.width / 2, 30);
    ctx.stroke();
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(4, 11); ctx.lineTo(26, 11); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(4, 19); ctx.lineTo(26, 19); ctx.stroke();
  } else if (sym.type === "sch-diode") {
    ctx.beginPath();
    ctx.moveTo(0, 12); ctx.lineTo(12, 12);
    ctx.moveTo(28, 12); ctx.lineTo(40, 12);
    ctx.stroke();
    // Triangle
    ctx.beginPath();
    ctx.moveTo(12, 2); ctx.lineTo(28, 12); ctx.lineTo(12, 22); ctx.closePath();
    ctx.stroke(); ctx.fill();
    // Bar
    ctx.beginPath(); ctx.moveTo(28, 2); ctx.lineTo(28, 22); ctx.stroke();
  } else if (sym.type === "sch-npn") {
    ctx.beginPath();
    ctx.moveTo(0, 25); ctx.lineTo(15, 25);
    ctx.moveTo(15, 10); ctx.lineTo(15, 40);
    ctx.moveTo(15, 18); ctx.lineTo(40, 5);
    ctx.moveTo(15, 32); ctx.lineTo(40, 45);
    ctx.stroke();
    // Arrow on emitter
    ctx.beginPath(); ctx.moveTo(32, 40); ctx.lineTo(40, 45); ctx.lineTo(35, 36); ctx.fill();
  } else if (sym.type === "sch-opamp") {
    ctx.beginPath();
    ctx.moveTo(10, 0); ctx.lineTo(50, 25); ctx.lineTo(10, 50); ctx.closePath();
    ctx.stroke(); ctx.fill();
    // Input labels
    ctx.fillStyle = fg; ctx.font = "bold 10px monospace"; ctx.textAlign = "left";
    ctx.fillText("+", 13, 18); ctx.fillText("−", 13, 38);
    // Wires
    ctx.strokeStyle = isSelected ? selColor : fg; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, 15); ctx.lineTo(10, 15);
    ctx.moveTo(0, 35); ctx.lineTo(10, 35);
    ctx.moveTo(50, 25); ctx.lineTo(60, 25);
    ctx.moveTo(30, 0); ctx.lineTo(30, 8);
    ctx.moveTo(30, 50); ctx.lineTo(30, 42);
    ctx.stroke();
  } else if (sym.type === "sch-vcc") {
    ctx.beginPath(); ctx.moveTo(10, 24); ctx.lineTo(10, 8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(2, 8); ctx.lineTo(10, 0); ctx.lineTo(18, 8); ctx.stroke();
  } else if (sym.type === "sch-gnd") {
    ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(10, 12); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(2, 12); ctx.lineTo(18, 12); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(5, 16); ctx.lineTo(15, 16); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(8, 20); ctx.lineTo(12, 20); ctx.stroke();
  } else if (sym.type === "sch-led") {
    // Same as diode + arrows
    ctx.beginPath(); ctx.moveTo(0, 12); ctx.lineTo(8, 12); ctx.moveTo(22, 12); ctx.lineTo(30, 12); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(8, 2); ctx.lineTo(22, 12); ctx.lineTo(8, 22); ctx.closePath(); ctx.stroke(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(22, 2); ctx.lineTo(22, 22); ctx.stroke();
    // Light arrows
    ctx.strokeStyle = pinColor; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(18, -2); ctx.lineTo(24, -6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(22, -1); ctx.lineTo(28, -5); ctx.stroke();
  } else {
    // Generic box for MCU, vreg, connectors etc
    ctx.fillRect(0, 0, sym.width, sym.height);
    ctx.strokeRect(0, 0, sym.width, sym.height);
  }

  // Label
  ctx.fillStyle = fg;
  ctx.font = "bold 9px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const labelY = sym.type.includes("vcc") || sym.type.includes("gnd") ? -6 : sym.height / 2 - 5;
  ctx.fillText(sym.label, sym.width / 2, labelY);
  if (sym.value) {
    ctx.font = "7px monospace";
    ctx.fillStyle = isDark ? "#94a3b8" : "#64748b";
    ctx.fillText(sym.value, sym.width / 2, labelY + 11);
  }

  // Pins
  sym.pins.forEach((pin) => {
    ctx.fillStyle = pinColor;
    ctx.beginPath();
    ctx.arc(pin.x, pin.y, 3, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.restore();
}

export default function PCBDesignTool({ onBack }: { onBack?: () => void }) {
  const [tab, setTab] = useState<TabId>("schematic");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const schCanvasRef = useRef<HTMLCanvasElement>(null);
  const [project, setProject] = useState<PCBProject>({
    name: "My PCB", width: 600, height: 400, components: [], traces: [], layers: 2,
  });
  const [schematic, setSchematic] = useState<SchematicProject>({ symbols: [], wires: [], nets: [] });
  const [tool, setTool] = useState<"select" | "place" | "trace" | "delete">("select");
  const [schTool, setSchTool] = useState<"select" | "place" | "wire" | "delete">("select");
  const [selectedComp, setSelectedComp] = useState<string | null>(null);
  const [selectedSchSym, setSelectedSchSym] = useState<string | null>(null);
  const [placingType, setPlacingType] = useState<any>(null);
  const [placingSchType, setPlacingSchType] = useState<any>(null);
  const [zoom, setZoom] = useState(1);
  const [schZoom, setSchZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [schPan, setSchPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState<string | null>(null);
  const [schDragging, setSchDragging] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [schDragOffset, setSchDragOffset] = useState({ x: 0, y: 0 });
  const [showGrid, setShowGrid] = useState(true);
  const [schShowGrid, setSchShowGrid] = useState(true);
  const [activeLayer, setActiveLayer] = useState<"top" | "bottom">("top");
  const [wirePoints, setWirePoints] = useState<{ x: number; y: number }[]>([]);
  const [isDrawingWire, setIsDrawingWire] = useState(false);

  // Learn tab
  const [learnSection, setLearnSection] = useState<string | null>(null);
  const [learnTopic, setLearnTopic] = useState<string | null>(null);
  const [aiContent, setAiContent] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  // Auto-assign reference designators
  const refCounters = useRef<Record<string, number>>({});

  const getNextRef = (prefix: string) => {
    const key = prefix;
    refCounters.current[key] = (refCounters.current[key] || 0) + 1;
    return `${prefix}${refCounters.current[key]}`;
  };

  // Templates
  const TEMPLATES = [
    { name: "Arduino Shield", desc: "Basic Arduino Uno shield with headers" },
    { name: "LED Driver", desc: "Simple LED driver circuit with current limiting" },
    { name: "Power Supply 5V", desc: "LM7805 based 5V regulated supply" },
    { name: "ESP32 Breakout", desc: "ESP32 module breakout board" },
    { name: "Audio Amplifier", desc: "LM386 based audio amplifier" },
    { name: "Sensor Board", desc: "Multi-sensor I2C/SPI breakout" },
  ];

  const isDark = document.documentElement.classList.contains("dark");

  // ── Schematic Canvas Drawing ──
  useEffect(() => {
    const canvas = schCanvasRef.current;
    if (!canvas || tab !== "schematic") return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    ctx.scale(dpr, dpr);

    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    // Background
    ctx.fillStyle = isDark ? "#0f1117" : "#fafbfc";
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(schPan.x, schPan.y);
    ctx.scale(schZoom, schZoom);

    // Grid
    if (schShowGrid) {
      ctx.strokeStyle = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.05)";
      ctx.lineWidth = 0.5;
      const gridSize = 20;
      const startX = -schPan.x / schZoom;
      const startY = -schPan.y / schZoom;
      const endX = startX + w / schZoom;
      const endY = startY + h / schZoom;
      for (let x = Math.floor(startX / gridSize) * gridSize; x <= endX; x += gridSize) {
        ctx.beginPath(); ctx.moveTo(x, startY); ctx.lineTo(x, endY); ctx.stroke();
      }
      for (let y = Math.floor(startY / gridSize) * gridSize; y <= endY; y += gridSize) {
        ctx.beginPath(); ctx.moveTo(startX, y); ctx.lineTo(endX, y); ctx.stroke();
      }
    }

    // Wires
    schematic.wires.forEach((wire) => {
      if (wire.points.length < 2) return;
      ctx.strokeStyle = isDark ? "#4ade80" : "#16a34a";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(wire.points[0].x, wire.points[0].y);
      wire.points.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
      ctx.stroke();
      // Junction dots
      wire.points.forEach((p) => {
        ctx.fillStyle = isDark ? "#4ade80" : "#16a34a";
        ctx.beginPath(); ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2); ctx.fill();
      });
    });

    // Drawing wire preview
    if (isDrawingWire && wirePoints.length > 0) {
      ctx.strokeStyle = isDark ? "rgba(74,222,128,0.5)" : "rgba(22,163,74,0.5)";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(wirePoints[0].x, wirePoints[0].y);
      wirePoints.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Symbols
    schematic.symbols.forEach((sym) => {
      drawSchSymbol(ctx, sym, selectedSchSym === sym.id, isDark);
    });

    ctx.restore();
  }, [schematic, schZoom, schPan, schShowGrid, selectedSchSym, tab, schTool, wirePoints, isDrawingWire, isDark]);

  // ── PCB Canvas Drawing (same as before) ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || tab !== "design") return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    ctx.scale(dpr, dpr);

    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    ctx.fillStyle = isDark ? "#0a0a0a" : "#f0f0f0";
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    const bx = (w / zoom - project.width) / 2;
    const by = (h / zoom - project.height) / 2;

    ctx.fillStyle = "#1a5c2a";
    ctx.fillRect(bx, by, project.width, project.height);
    ctx.strokeStyle = "#2d8a4e";
    ctx.lineWidth = 2;
    ctx.strokeRect(bx, by, project.width, project.height);

    if (showGrid) {
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.lineWidth = 0.5;
      const gridSize = 20;
      for (let x = bx; x <= bx + project.width; x += gridSize) {
        ctx.beginPath(); ctx.moveTo(x, by); ctx.lineTo(x, by + project.height); ctx.stroke();
      }
      for (let y = by; y <= by + project.height; y += gridSize) {
        ctx.beginPath(); ctx.moveTo(bx, y); ctx.lineTo(bx + project.width, y); ctx.stroke();
      }
    }

    project.traces.forEach((trace) => {
      if (trace.points.length < 2) return;
      ctx.strokeStyle = trace.layer === "top" ? "#e63946" : "#457b9d";
      ctx.lineWidth = trace.width;
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(bx + trace.points[0].x, by + trace.points[0].y);
      trace.points.slice(1).forEach((p) => ctx.lineTo(bx + p.x, by + p.y));
      ctx.stroke();
    });

    project.components.forEach((comp) => {
      const cx = bx + comp.x;
      const cy = by + comp.y;
      ctx.fillStyle = selectedComp === comp.id ? "rgba(59,130,246,0.3)" : "rgba(30,30,30,0.9)";
      ctx.strokeStyle = selectedComp === comp.id ? "#3b82f6" : comp.color;
      ctx.lineWidth = selectedComp === comp.id ? 2 : 1;
      ctx.fillRect(cx, cy, comp.width, comp.height);
      ctx.strokeRect(cx, cy, comp.width, comp.height);
      ctx.fillStyle = "#ffffff"; ctx.font = "bold 9px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(comp.label, cx + comp.width / 2, cy + comp.height / 2 - 4);
      if (comp.value) { ctx.font = "7px monospace"; ctx.fillStyle = "#94a3b8"; ctx.fillText(comp.value, cx + comp.width / 2, cy + comp.height / 2 + 6); }
      comp.pins.forEach((pin) => {
        ctx.fillStyle = "#d4a030"; ctx.beginPath(); ctx.arc(cx + pin.x, cy + pin.y, 3, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#b8860b"; ctx.lineWidth = 0.5; ctx.stroke();
      });
    });

    if (tool === "place" && placingType) {
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = "rgba(59,130,246,0.2)"; ctx.strokeStyle = "#3b82f6"; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
      const gx = w / zoom / 2 - placingType.w / 2;
      const gy = h / zoom / 2 - placingType.h / 2;
      ctx.fillRect(gx, gy, placingType.w, placingType.h);
      ctx.strokeRect(gx, gy, placingType.w, placingType.h);
      ctx.setLineDash([]); ctx.globalAlpha = 1;
    }

    ctx.restore();
  }, [project, zoom, pan, showGrid, selectedComp, tool, placingType, activeLayer, tab, isDark]);

  // ── Schematic canvas handlers ──
  const getSchLocalCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = schCanvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left - schPan.x) / schZoom,
      y: (e.clientY - rect.top - schPan.y) / schZoom,
    };
  };

  const handleSchCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getSchLocalCoords(e);
    const snapX = Math.round(x / 20) * 20;
    const snapY = Math.round(y / 20) * 20;

    if (schTool === "place" && placingSchType) {
      const newSym: SchematicSymbol = {
        id: crypto.randomUUID(),
        type: placingSchType.type,
        label: getNextRef(placingSchType.label),
        x: snapX - placingSchType.w / 2,
        y: snapY - placingSchType.h / 2,
        width: placingSchType.w,
        height: placingSchType.h,
        pins: placingSchType.pins.map((p: any) => ({ ...p })),
        rotation: 0,
        value: placingSchType.values?.[0],
      };
      setSchematic((s) => ({ ...s, symbols: [...s.symbols, newSym] }));
      setSchTool("select");
      setPlacingSchType(null);
      return;
    }

    if (schTool === "wire") {
      if (!isDrawingWire) {
        setIsDrawingWire(true);
        setWirePoints([{ x: snapX, y: snapY }]);
      } else {
        const newPts = [...wirePoints, { x: snapX, y: snapY }];
        setWirePoints(newPts);
        // Double-click or shift to finish is hard, so we finish on same-point click
        if (newPts.length >= 2) {
          // Check if near a pin to auto-finish
          const nearPin = schematic.symbols.some(s =>
            s.pins.some(p => Math.abs(s.x + p.x - snapX) < 10 && Math.abs(s.y + p.y - snapY) < 10)
          );
          if (nearPin && newPts.length >= 2) {
            const wire: Wire = { id: crypto.randomUUID(), points: newPts };
            setSchematic(s => ({ ...s, wires: [...s.wires, wire] }));
            setIsDrawingWire(false);
            setWirePoints([]);
          }
        }
      }
      return;
    }

    if (schTool === "select") {
      const clicked = schematic.symbols.find(
        (s) => x >= s.x && x <= s.x + s.width && y >= s.y && y <= s.y + s.height
      );
      setSelectedSchSym(clicked?.id || null);
    }

    if (schTool === "delete") {
      const clicked = schematic.symbols.find(
        (s) => x >= s.x && x <= s.x + s.width && y >= s.y && y <= s.y + s.height
      );
      if (clicked) {
        setSchematic((s) => ({ ...s, symbols: s.symbols.filter((c) => c.id !== clicked.id) }));
      }
    }
  };

  const handleSchCanvasDoubleClick = () => {
    // Finish wire on double-click
    if (isDrawingWire && wirePoints.length >= 2) {
      const wire: Wire = { id: crypto.randomUUID(), points: wirePoints };
      setSchematic(s => ({ ...s, wires: [...s.wires, wire] }));
      setIsDrawingWire(false);
      setWirePoints([]);
    }
  };

  const handleSchMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (schTool !== "select") return;
    const { x, y } = getSchLocalCoords(e);
    const clicked = schematic.symbols.find(
      (s) => x >= s.x && x <= s.x + s.width && y >= s.y && y <= s.y + s.height
    );
    if (clicked) {
      setSchDragging(clicked.id);
      setSchDragOffset({ x: x - clicked.x, y: y - clicked.y });
      setSelectedSchSym(clicked.id);
    }
  };

  const handleSchMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!schDragging) {
      // Update wire preview endpoint
      if (isDrawingWire && wirePoints.length > 0) {
        const { x, y } = getSchLocalCoords(e);
        const snapX = Math.round(x / 20) * 20;
        const snapY = Math.round(y / 20) * 20;
        setWirePoints(prev => [...prev.slice(0, -1), { x: snapX, y: snapY }]);
        if (wirePoints.length === 1) setWirePoints(prev => [...prev, { x: snapX, y: snapY }]);
      }
      return;
    }
    const { x, y } = getSchLocalCoords(e);
    const snapX = Math.round((x - schDragOffset.x) / 10) * 10;
    const snapY = Math.round((y - schDragOffset.y) / 10) * 10;
    setSchematic((s) => ({
      ...s,
      symbols: s.symbols.map((c) => c.id === schDragging ? { ...c, x: snapX, y: snapY } : c),
    }));
  };

  const handleSchMouseUp = () => setSchDragging(null);

  // ── Push Schematic to PCB ──
  const pushToPCB = useCallback(() => {
    const schToLib: Record<string, any> = {
      "sch-resistor": "resistor", "sch-capacitor": "capacitor", "sch-inductor": "inductor",
      "sch-diode": "diode", "sch-npn": "transistor", "sch-led": "led",
      "sch-opamp": "ic-dip8", "sch-mcu": "mcu", "sch-vreg": "vreg",
      "sch-conn2": "header-2", "sch-conn4": "header-2",
    };
    const lib = Object.values(COMPONENT_LIBRARY).flat();
    const newComps: Component[] = schematic.symbols
      .filter(s => !s.type.includes("vcc") && !s.type.includes("gnd"))
      .map((s, i) => {
        const pcbType = schToLib[s.type] || "resistor";
        const libItem = lib.find(l => l.type === pcbType) || lib[0];
        return {
          id: crypto.randomUUID(),
          type: pcbType,
          label: s.label,
          x: 40 + (i % 5) * 110,
          y: 40 + Math.floor(i / 5) * 80,
          width: libItem.w,
          height: libItem.h,
          pins: libItem.pins,
          rotation: 0,
          value: s.value || libItem.values?.[0],
          footprint: libItem.footprint,
          color: libItem.color,
        };
      });
    setProject(p => ({ ...p, components: newComps, traces: [] }));
    setTab("design");
  }, [schematic]);

  // ── PCB canvas handlers (unchanged) ──
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left - pan.x) / zoom;
    const my = (e.clientY - rect.top - pan.y) / zoom;
    const bx = (canvas.clientWidth / zoom - project.width) / 2;
    const by = (canvas.clientHeight / zoom - project.height) / 2;
    const localX = mx - bx; const localY = my - by;

    if (tool === "place" && placingType) {
      const snapX = Math.round(localX / 20) * 20;
      const snapY = Math.round(localY / 20) * 20;
      const newComp: Component = {
        id: crypto.randomUUID(), type: placingType.type, label: placingType.label,
        x: snapX - placingType.w / 2, y: snapY - placingType.h / 2,
        width: placingType.w, height: placingType.h, pins: placingType.pins,
        rotation: 0, value: placingType.values?.[0], footprint: placingType.footprint, color: placingType.color,
      };
      setProject((p) => ({ ...p, components: [...p.components, newComp] }));
      setTool("select"); setPlacingType(null); return;
    }
    if (tool === "select") {
      const clicked = project.components.find(c => localX >= c.x && localX <= c.x + c.width && localY >= c.y && localY <= c.y + c.height);
      setSelectedComp(clicked?.id || null);
    }
    if (tool === "delete") {
      const clicked = project.components.find(c => localX >= c.x && localX <= c.x + c.width && localY >= c.y && localY <= c.y + c.height);
      if (clicked) setProject((p) => ({ ...p, components: p.components.filter((c) => c.id !== clicked.id) }));
    }
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (tool !== "select") return;
    const canvas = canvasRef.current; if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left - pan.x) / zoom; const my = (e.clientY - rect.top - pan.y) / zoom;
    const bx = (canvas.clientWidth / zoom - project.width) / 2; const by = (canvas.clientHeight / zoom - project.height) / 2;
    const localX = mx - bx; const localY = my - by;
    const clicked = project.components.find(c => localX >= c.x && localX <= c.x + c.width && localY >= c.y && localY <= c.y + c.height);
    if (clicked) { setDragging(clicked.id); setDragOffset({ x: localX - clicked.x, y: localY - clicked.y }); setSelectedComp(clicked.id); }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragging) return;
    const canvas = canvasRef.current; if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left - pan.x) / zoom; const my = (e.clientY - rect.top - pan.y) / zoom;
    const bx = (canvas.clientWidth / zoom - project.width) / 2; const by = (canvas.clientHeight / zoom - project.height) / 2;
    const localX = mx - bx; const localY = my - by;
    const snapX = Math.round((localX - dragOffset.x) / 10) * 10;
    const snapY = Math.round((localY - dragOffset.y) / 10) * 10;
    setProject((p) => ({ ...p, components: p.components.map((c) => c.id === dragging ? { ...c, x: snapX, y: snapY } : c) }));
  };

  const handleCanvasMouseUp = () => setDragging(null);

  const loadTemplate = useCallback(async (template: string) => {
    setAiContent(""); setAiLoading(true);
    let raw = "";
    await streamAI(
      `Generate a PCB component placement for a "${template}" project. Return ONLY a JSON object with this structure: {"components":[{"type":"resistor","label":"R1","x":100,"y":100,"value":"10kΩ"},{"type":"capacitor","label":"C1","x":200,"y":100,"value":"100nF"},...]}. Place components logically. Use types: resistor, capacitor, inductor, diode, ic-dip8, transistor, led, mcu, header-2, usb-c, vreg, crystal. Keep x: 20-550, y: 20-350.`,
      "You are a PCB design expert. Return ONLY valid JSON with component placements.",
      (t) => { raw = t; }
    );
    try {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (parsed.components) {
          const lib = Object.values(COMPONENT_LIBRARY).flat();
          const newComps: Component[] = parsed.components.map((c: any) => {
            const libItem = lib.find((l) => l.type === c.type) || lib[0];
            return {
              id: crypto.randomUUID(), type: c.type, label: c.label || libItem.label,
              x: c.x || 100, y: c.y || 100, width: libItem.w, height: libItem.h,
              pins: libItem.pins, rotation: 0, value: c.value || libItem.values?.[0],
              footprint: libItem.footprint, color: libItem.color,
            };
          });
          setProject((p) => ({ ...p, components: newComps, traces: [] }));
        }
      }
    } catch {}
    setAiLoading(false);
  }, []);

  const handleLearnTopic = useCallback(async (topic: string, section: string) => {
    setLearnTopic(topic); setAiContent(""); setAiLoading(true);
    await streamAI(
      `Explain "${topic}" under "${section}" for PCB design. Include:\n1. Complete explanation with diagrams described\n2. Design rules & industry standards\n3. Practical examples & common mistakes\n4. Calculator/formula if applicable\n5. Tips for ECE engineers`,
      "You are a PCB design expert & ECE instructor. Explain clearly with practical examples, industry standards (IPC), and formulas.",
      setAiContent
    );
    setAiLoading(false);
  }, []);

  const reviewDesign = useCallback(async () => {
    setAiContent(""); setAiLoading(true);
    const compSummary = project.components.map((c) => `${c.label} (${c.type}, ${c.value || "N/A"}) at (${c.x},${c.y})`).join("; ");
    const schSummary = schematic.symbols.length > 0
      ? `\nSchematic: ${schematic.symbols.map(s => `${s.label}(${s.type},${s.value})`).join(", ")}, ${schematic.wires.length} wires`
      : "";
    await streamAI(
      `Review this PCB design:\nBoard: ${project.width}×${project.height}mm, ${project.layers} layers\nComponents: ${compSummary || "None placed yet"}\nTraces: ${project.traces.length}${schSummary}\n\nProvide:\n1. Design rule violations\n2. Component placement suggestions\n3. Routing recommendations\n4. EMI/EMC concerns\n5. DFM issues\n6. Overall rating (1-10) with improvement suggestions`,
      "You are a senior PCB design engineer reviewing a board layout. Be thorough and practical.",
      setAiContent
    );
    setAiLoading(false);
  }, [project, schematic]);

  const selectedComponent = project.components.find((c) => c.id === selectedComp);
  const selectedSchSymbol = schematic.symbols.find((s) => s.id === selectedSchSym);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50 glass-subtle">
        {onBack && (
          <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <ArrowLeft className="w-5 h-5 text-muted-foreground" />
          </button>
        )}
        <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center border border-border/50">
          <CircuitBoard className="w-5 h-5 text-foreground/70" />
        </div>
        <div className="flex-1">
          <h2 className="text-[15px] font-bold text-foreground">PCB Design Simulator</h2>
          <p className="text-[11px] text-muted-foreground">Schematic → PCB Layout workflow</p>
        </div>
        <div className="px-2 py-1 rounded-full bg-accent text-foreground/60 text-[10px] font-bold border border-border/50">ECE Lab</div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-3 py-2 border-b border-border/30 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => { setTab(t.id); setLearnSection(null); setLearnTopic(null); if (t.id !== "review") setAiContent(""); }}
            className={cn("flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap",
              tab === t.id ? "bg-foreground text-background shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}>
            <span>{t.emoji}</span>{t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* ═══ SCHEMATIC TAB ═══ */}
        {tab === "schematic" && (
          <div className="flex flex-col h-full">
            {/* Toolbar */}
            <div className="flex items-center gap-1 px-3 py-2 border-b border-border/30 bg-card/30 flex-wrap">
              {([
                { id: "select" as const, icon: MousePointer, label: "Select" },
                { id: "wire" as const, icon: GitBranch, label: "Wire" },
                { id: "delete" as const, icon: Trash2, label: "Delete" },
              ]).map((t) => (
                <button key={t.id} onClick={() => { setSchTool(t.id); setPlacingSchType(null); if (t.id !== "wire") { setIsDrawingWire(false); setWirePoints([]); } }}
                  className={cn("p-2 rounded-lg transition-all", schTool === t.id ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted")}>
                  <t.icon className="w-4 h-4" />
                </button>
              ))}
              <div className="w-px h-6 bg-border/50 mx-1" />
              <button onClick={() => setSchZoom((z) => Math.min(z + 0.2, 3))} className="p-2 rounded-lg text-muted-foreground hover:bg-muted"><ZoomIn className="w-4 h-4" /></button>
              <button onClick={() => setSchZoom((z) => Math.max(z - 0.2, 0.3))} className="p-2 rounded-lg text-muted-foreground hover:bg-muted"><ZoomOut className="w-4 h-4" /></button>
              <button onClick={() => setSchShowGrid((g) => !g)} className={cn("p-2 rounded-lg", schShowGrid ? "text-foreground bg-accent" : "text-muted-foreground hover:bg-muted")}><Grid3X3 className="w-4 h-4" /></button>
              <div className="w-px h-6 bg-border/50 mx-1" />
              <span className="text-[10px] text-muted-foreground">{schematic.symbols.length} symbols · {schematic.wires.length} wires</span>
              <div className="ml-auto flex items-center gap-1">
                <button onClick={pushToPCB} disabled={schematic.symbols.length === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground text-background text-xs font-medium hover:opacity-80 disabled:opacity-30 transition-all">
                  <ArrowRight className="w-3.5 h-3.5" /> Push to PCB
                </button>
                <button onClick={() => { setSchematic({ symbols: [], wires: [], nets: [] }); refCounters.current = {}; }}
                  className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Canvas + Symbol library sidebar */}
            <div className="flex-1 flex min-h-0">
              <canvas
                ref={schCanvasRef}
                className={cn("flex-1", schTool === "wire" ? "cursor-crosshair" : schTool === "place" ? "cursor-copy" : "cursor-default")}
                onClick={handleSchCanvasClick}
                onDoubleClick={handleSchCanvasDoubleClick}
                onMouseDown={handleSchMouseDown}
                onMouseMove={handleSchMouseMove}
                onMouseUp={handleSchMouseUp}
                onMouseLeave={handleSchMouseUp}
              />

              {/* Right panel */}
              <div className="w-56 border-l border-border/30 bg-card/30 overflow-y-auto p-2 space-y-2 hidden sm:block">
                {selectedSchSymbol ? (
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-foreground">Properties</h4>
                    <div className="space-y-2">
                      <div><label className="text-[10px] text-muted-foreground">Reference</label><p className="text-sm font-medium text-foreground">{selectedSchSymbol.label}</p></div>
                      <div><label className="text-[10px] text-muted-foreground">Type</label><p className="text-sm text-foreground">{selectedSchSymbol.type.replace("sch-","")}</p></div>
                      <div><label className="text-[10px] text-muted-foreground">Value</label>
                        <select
                          value={selectedSchSymbol.value || ""}
                          onChange={(e) => setSchematic(s => ({ ...s, symbols: s.symbols.map(sym => sym.id === selectedSchSym ? { ...sym, value: e.target.value } : sym) }))}
                          className="w-full mt-0.5 px-2 py-1 rounded-lg bg-muted border border-border/30 text-xs text-foreground"
                        >
                          {Object.values(SCHEMATIC_SYMBOLS).flat().find(t => t.type === selectedSchSymbol.type)?.values?.map(v => (
                            <option key={v} value={v}>{v}</option>
                          ))}
                        </select>
                      </div>
                      <div><label className="text-[10px] text-muted-foreground">Pins</label><p className="text-sm text-foreground">{selectedSchSymbol.pins.length}</p></div>
                      <div><label className="text-[10px] text-muted-foreground">Position</label><p className="text-sm text-foreground">({selectedSchSymbol.x}, {selectedSchSymbol.y})</p></div>
                    </div>
                    <button onClick={() => setSchematic(s => ({ ...s, symbols: s.symbols.filter(c => c.id !== selectedSchSym) }))}
                      className="w-full py-1.5 rounded-lg bg-destructive/10 text-destructive text-xs font-medium hover:bg-destructive/20">
                      Delete Symbol
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-foreground">Schematic Symbols</h4>
                    <p className="text-[10px] text-muted-foreground">Click to place on schematic</p>
                    {Object.entries(SCHEMATIC_SYMBOLS).map(([cat, items]) => (
                      <div key={cat}>
                        <p className="text-[10px] font-semibold text-muted-foreground mb-1">{cat}</p>
                        {items.map((item) => (
                          <button key={item.type} onClick={() => { setSchTool("place"); setPlacingSchType(item); }}
                            className={cn("w-full text-left px-2 py-1.5 rounded-lg text-[12px] transition-all mb-0.5",
                              placingSchType?.type === item.type ? "bg-foreground/10 text-foreground font-medium" : "text-foreground/70 hover:bg-muted/50"
                            )}>
                            {item.label === "R" ? "Resistor" : item.label === "C" ? "Capacitor" : item.label === "L" ? "Inductor" : item.label === "D" ? "Diode" : item.label === "Q" ? "Transistor (NPN)" : item.label === "U" ? item.values?.[0] || item.type.replace("sch-","") : item.label === "LED" ? "LED" : item.label === "VCC" ? "VCC Power" : item.label === "GND" ? "GND" : item.label === "J" ? item.values?.[0] || "Connector" : item.type.replace("sch-","")}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Hint bar */}
            <div className="px-3 py-2 border-t border-border/30 bg-card/30">
              <p className="text-[10px] text-muted-foreground">
                {schTool === "wire" ? "Click pins to draw wires. Double-click to finish a wire." :
                 schTool === "place" ? "Click on the canvas to place the symbol." :
                 "Select symbols to edit properties. Use 'Push to PCB' to generate layout."}
              </p>
            </div>
          </div>
        )}

        {/* ═══ DESIGN TAB ═══ */}
        {tab === "design" && (
          <div className="flex flex-col h-full">
            <div className="flex items-center gap-1 px-3 py-2 border-b border-border/30 bg-card/30 flex-wrap">
              {([
                { id: "select" as const, icon: MousePointer, label: "Select" },
                { id: "delete" as const, icon: Trash2, label: "Delete" },
              ]).map((t) => (
                <button key={t.id} onClick={() => { setTool(t.id); setPlacingType(null); }}
                  className={cn("p-2 rounded-lg transition-all", tool === t.id ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted")}>
                  <t.icon className="w-4 h-4" />
                </button>
              ))}
              <div className="w-px h-6 bg-border/50 mx-1" />
              <button onClick={() => setZoom((z) => Math.min(z + 0.2, 3))} className="p-2 rounded-lg text-muted-foreground hover:bg-muted"><ZoomIn className="w-4 h-4" /></button>
              <button onClick={() => setZoom((z) => Math.max(z - 0.2, 0.3))} className="p-2 rounded-lg text-muted-foreground hover:bg-muted"><ZoomOut className="w-4 h-4" /></button>
              <button onClick={() => setShowGrid((g) => !g)} className={cn("p-2 rounded-lg", showGrid ? "text-foreground bg-accent" : "text-muted-foreground hover:bg-muted")}><Grid3X3 className="w-4 h-4" /></button>
              <div className="w-px h-6 bg-border/50 mx-1" />
              <button onClick={() => setActiveLayer(activeLayer === "top" ? "bottom" : "top")}
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium bg-muted/50 text-foreground">
                <Layers className="w-3.5 h-3.5" />{activeLayer === "top" ? "Top" : "Bottom"}
              </button>
              <div className="ml-auto flex items-center gap-1">
                <span className="text-[10px] text-muted-foreground">{project.components.length} components</span>
                <button onClick={() => setProject((p) => ({ ...p, components: [], traces: [] }))}
                  className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 flex min-h-0">
              <canvas ref={canvasRef} className="flex-1 cursor-crosshair"
                onClick={handleCanvasClick} onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove} onMouseUp={handleCanvasMouseUp} onMouseLeave={handleCanvasMouseUp} />

              <div className="w-56 border-l border-border/30 bg-card/30 overflow-y-auto p-2 space-y-2 hidden sm:block">
                {selectedComponent ? (
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-foreground">Properties</h4>
                    <div className="space-y-2">
                      <div><label className="text-[10px] text-muted-foreground">Reference</label><p className="text-sm font-medium text-foreground">{selectedComponent.label}</p></div>
                      <div><label className="text-[10px] text-muted-foreground">Type</label><p className="text-sm text-foreground">{selectedComponent.type}</p></div>
                      <div><label className="text-[10px] text-muted-foreground">Value</label><p className="text-sm text-foreground">{selectedComponent.value || "N/A"}</p></div>
                      <div><label className="text-[10px] text-muted-foreground">Footprint</label><p className="text-sm text-foreground">{selectedComponent.footprint || "N/A"}</p></div>
                      <div><label className="text-[10px] text-muted-foreground">Position</label><p className="text-sm text-foreground">({selectedComponent.x}, {selectedComponent.y})</p></div>
                      <div><label className="text-[10px] text-muted-foreground">Pins</label><p className="text-sm text-foreground">{selectedComponent.pins.length}</p></div>
                    </div>
                    <button onClick={() => setProject((p) => ({ ...p, components: p.components.filter((c) => c.id !== selectedComp) }))}
                      className="w-full py-1.5 rounded-lg bg-destructive/10 text-destructive text-xs font-medium hover:bg-destructive/20">
                      Delete Component
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-foreground">Quick Add</h4>
                    {Object.entries(COMPONENT_LIBRARY).map(([cat, items]) => (
                      <div key={cat}>
                        <p className="text-[10px] font-semibold text-muted-foreground mb-1">{cat}</p>
                        {items.map((item) => (
                          <button key={item.type} onClick={() => { setTool("place"); setPlacingType(item); }}
                            className={cn("w-full text-left px-2 py-1.5 rounded-lg text-[12px] transition-all mb-0.5",
                              placingType?.type === item.type ? "bg-foreground/10 text-foreground font-medium" : "text-foreground/70 hover:bg-muted/50"
                            )}>
                            {item.label}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="px-3 py-2 border-t border-border/30 bg-card/30">
              <p className="text-[10px] font-semibold text-muted-foreground mb-1.5">Templates — Click to auto-generate placement</p>
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {TEMPLATES.map((t) => (
                  <button key={t.name} onClick={() => loadTemplate(t.name)} disabled={aiLoading}
                    className="shrink-0 px-3 py-1.5 rounded-lg border border-border/40 hover:border-foreground/30 hover:bg-accent text-[11px] font-medium text-foreground transition-all disabled:opacity-50">
                    {aiLoading ? <Loader2 className="w-3 h-3 animate-spin inline mr-1" /> : null}{t.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═══ COMPONENTS LIBRARY TAB ═══ */}
        {tab === "components" && (
          <div className="p-4 max-w-2xl mx-auto space-y-4">
            <h3 className="text-base font-bold text-foreground">📦 Component Library</h3>
            {Object.entries(COMPONENT_LIBRARY).map(([cat, items]) => (
              <div key={cat} className="space-y-2">
                <h4 className="text-sm font-semibold text-foreground">{cat}</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {items.map((item) => (
                    <div key={item.type} className="p-3 rounded-xl border border-border/50 bg-card space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm text-foreground">{item.label}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{item.pins.length} pins</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">Footprint: {item.footprint}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {item.values?.slice(0, 5).map((v) => (
                          <span key={v} className="text-[10px] px-1.5 py-0.5 rounded bg-accent text-foreground/70">{v}</span>
                        ))}
                      </div>
                      <button onClick={() => { setTab("design"); setTool("place"); setPlacingType(item); }}
                        className="mt-2 w-full py-1.5 rounded-lg bg-accent text-foreground text-xs font-medium hover:bg-muted transition-colors">
                        Place on Board →
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ═══ LEARN TAB ═══ */}
        {tab === "learn" && (
          <div className="p-4 max-w-2xl mx-auto space-y-3">
            {!learnTopic ? (
              !learnSection ? (
                <div className="space-y-3">
                  <h3 className="text-base font-bold text-foreground">📘 Learn PCB Design</h3>
                  <p className="text-xs text-muted-foreground">Master PCB design from basics to advanced</p>
                  {Object.keys(LEARN_TOPICS).map((sec) => (
                    <button key={sec} onClick={() => setLearnSection(sec)}
                      className="w-full flex items-center justify-between p-4 rounded-xl border border-border/50 hover:border-foreground/30 hover:bg-accent transition-all text-left">
                      <div>
                        <span className="font-semibold text-foreground text-sm">{sec}</span>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{(LEARN_TOPICS as any)[sec].length} topics</p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  <button onClick={() => setLearnSection(null)} className="flex items-center gap-1 text-sm text-foreground/70 hover:text-foreground transition-colors">
                    <ArrowLeft className="w-4 h-4" /> Back
                  </button>
                  <h3 className="text-base font-bold text-foreground">{learnSection}</h3>
                  {((LEARN_TOPICS as any)[learnSection] || []).map((topic: string) => (
                    <button key={topic} onClick={() => handleLearnTopic(topic, learnSection!)}
                      className="w-full flex items-center justify-between p-3 rounded-xl border border-border/50 hover:border-foreground/30 hover:bg-accent transition-all text-left">
                      <span className="font-medium text-foreground text-[13px] flex-1">{topic}</span>
                      {STATIC_REF[topic] && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-accent text-foreground/60 font-medium mr-2">⚡</span>}
                    </button>
                  ))}
                </div>
              )
            ) : (
              <div className="space-y-3">
                <button onClick={() => { setLearnTopic(null); setAiContent(""); }} className="flex items-center gap-1 text-sm text-foreground/70 hover:text-foreground transition-colors">
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <h3 className="text-base font-bold text-foreground">{learnTopic}</h3>
                {STATIC_REF[learnTopic] && (
                  <div className="prose prose-sm dark:prose-invert max-w-none p-4 rounded-xl bg-accent/50 border border-border/50">
                    <div className="text-xs font-semibold text-foreground/60 mb-2">⚡ Quick Reference</div>
                    <ReactMarkdown>{STATIC_REF[learnTopic]}</ReactMarkdown>
                  </div>
                )}
                {aiLoading && !aiContent && (
                  <div className="flex items-center gap-2 py-4 justify-center">
                    <Loader2 className="w-5 h-5 animate-spin text-foreground/50" />
                    <span className="text-sm text-muted-foreground">Loading...</span>
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

        {/* ═══ AI REVIEW TAB ═══ */}
        {tab === "review" && (
          <div className="p-4 max-w-2xl mx-auto space-y-4">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">🤖 AI Design Review</h3>
            <p className="text-xs text-muted-foreground">Get AI-powered feedback on your PCB layout</p>
            <div className="p-4 rounded-xl bg-card border border-border/50 space-y-2">
              <p className="text-sm text-foreground"><strong>Board:</strong> {project.width}×{project.height}mm, {project.layers} layers</p>
              <p className="text-sm text-foreground"><strong>Components:</strong> {project.components.length}</p>
              <p className="text-sm text-foreground"><strong>Schematic:</strong> {schematic.symbols.length} symbols, {schematic.wires.length} wires</p>
              <p className="text-sm text-foreground"><strong>Traces:</strong> {project.traces.length}</p>
              {project.components.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {project.components.map((c) => (
                    <span key={c.id} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{c.label}</span>
                  ))}
                </div>
              )}
            </div>
            <button onClick={reviewDesign} disabled={aiLoading}
              className="w-full py-2.5 rounded-lg bg-foreground text-background font-medium disabled:opacity-50 transition-opacity">
              {aiLoading ? <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> : <Zap className="w-4 h-4 inline mr-2" />}
              Review My Design
            </button>
            {aiContent && (
              <div className="prose prose-sm dark:prose-invert max-w-none p-4 rounded-xl bg-card border border-border/50">
                <ReactMarkdown>{aiContent}</ReactMarkdown>
              </div>
            )}
          </div>
        )}

        {/* ═══ QUIZ TAB ═══ */}
        {tab === "quiz" && (
          <div className="p-4 max-w-2xl mx-auto space-y-3">
            {!aiContent && !aiLoading ? (
              <div className="space-y-3">
                <h3 className="text-base font-bold text-foreground">🧠 PCB Design Quiz</h3>
                {["PCB Basics & Layers", "Design Rules & IPC Standards", "Component Footprints & Placement",
                  "Signal Integrity & Routing", "EMI/EMC & Shielding", "DFM & Manufacturing",
                  "Mixed PCB Design Quiz"].map((q) => (
                  <button key={q} onClick={async () => {
                    setAiContent(""); setAiLoading(true);
                    await streamAI(
                      `Generate 5 MCQ questions on PCB design topic: "${q}". Each question should test practical knowledge for ECE engineers. Return formatted markdown with questions, 4 options each, correct answer marked with ✅, and brief explanation.`,
                      "You are a PCB design quiz generator for ECE engineers.",
                      setAiContent
                    );
                    setAiLoading(false);
                  }}
                    className="w-full p-3 rounded-xl border border-border/50 hover:border-foreground/30 hover:bg-accent text-left font-medium text-foreground text-sm transition-all">
                    {q}
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                <button onClick={() => setAiContent("")} className="flex items-center gap-1 text-sm text-foreground/70 hover:text-foreground transition-colors">
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                {aiLoading && !aiContent && (
                  <div className="flex items-center gap-2 py-8 justify-center">
                    <Loader2 className="w-5 h-5 animate-spin text-foreground/50" /><span className="text-muted-foreground text-sm">Generating questions...</span>
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
