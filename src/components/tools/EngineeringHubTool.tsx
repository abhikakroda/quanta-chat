import { useState, lazy, Suspense } from "react";
import {
  Cpu, GraduationCap, Shield, CircuitBoard, Loader2,
  Brain, Trophy, Zap
} from "lucide-react";
import { cn } from "@/lib/utils";

const ECETool = lazy(() => import("./ECETool"));
const GATEECETool = lazy(() => import("./GATEECETool"));
const IESETTool = lazy(() => import("./IESETTool"));
const PCBDesignTool = lazy(() => import("./PCBDesignTool"));

const SECTIONS = [
  { id: "ece", label: "ECE Engineering", icon: Cpu, emoji: "🔧", color: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/20", desc: "Digital, Analog, Signals & Communication" },
  { id: "gate", label: "GATE ECE", icon: Shield, emoji: "🔥", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", desc: "Full syllabus, PYQs 2010-2024, Formulas" },
  { id: "ies", label: "IES/ESE E&T", icon: GraduationCap, emoji: "🏛️", color: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/20", desc: "Paper I, II, GA, Previous Year Questions" },
  { id: "pcb", label: "PCB Design", icon: CircuitBoard, emoji: "🔌", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", desc: "Component placement, learning & AI review" },
] as const;

type SectionId = typeof SECTIONS[number]["id"];

export default function EngineeringHubTool() {
  const [activeSection, setActiveSection] = useState<SectionId | null>(null);

  if (activeSection) {
    return (
      <div className="animate-fade-in">
        <div className="flex items-center gap-2 px-4 pt-3 pb-2">
          <button
            onClick={() => setActiveSection(null)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to Engineering Hub
          </button>
          <span className="text-xs text-muted-foreground/50">
            {SECTIONS.find(s => s.id === activeSection)?.label}
          </span>
        </div>
        <Suspense fallback={<div className="flex items-center justify-center py-20"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>}>
          {activeSection === "ece" && <ECETool />}
          {activeSection === "gate" && <GATEECETool />}
          {activeSection === "ies" && <IESETTool />}
          {activeSection === "pcb" && <PCBDesignTool />}
        </Suspense>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-5 animate-fade-in">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-primary/10 border border-primary/20 mb-2">
          <Cpu className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-foreground">Engineering Hub</h2>
        <p className="text-sm text-muted-foreground">ECE / E&T — GATE, IES & Core Engineering</p>
        
        <div className="flex items-center justify-center gap-4 mt-3">
          {[
            { icon: Brain, label: "4 Modules", color: "text-purple-400" },
            { icon: Trophy, label: "PYQs & Quizzes", color: "text-amber-400" },
            { icon: Zap, label: "Formula Sheets", color: "text-emerald-400" },
          ].map(stat => (
            <div key={stat.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <stat.icon className={cn("w-3.5 h-3.5", stat.color)} />
              <span>{stat.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {SECTIONS.map((section) => (
          <button
            key={section.id}
            onClick={() => setActiveSection(section.id)}
            className={cn(
              "group flex items-start gap-3 p-4 rounded-xl border text-left transition-all duration-200",
              section.border, section.bg,
              "hover:scale-[1.02] hover:shadow-lg"
            )}
          >
            <div className={cn("p-2 rounded-lg", section.bg)}>
              <section.icon className={cn("w-5 h-5", section.color)} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-foreground">{section.label}</span>
                <span className="text-xs">{section.emoji}</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{section.desc}</p>
            </div>
            <span className="text-muted-foreground/30 group-hover:text-primary transition-colors text-xs mt-1">→</span>
          </button>
        ))}
      </div>
    </div>
  );
}
