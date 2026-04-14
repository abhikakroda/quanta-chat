import { useState, lazy, Suspense } from "react";
import {
  BookOpen, Calculator, Puzzle, Globe, Clock, Loader2,
  GraduationCap, Brain, Trophy, Zap
} from "lucide-react";
import { cn } from "@/lib/utils";

const SSCEnglishTool = lazy(() => import("./SSCEnglishTool"));
const SSCMathTool = lazy(() => import("./SSCMathTool"));
const SSCReasoningTool = lazy(() => import("./SSCReasoningTool"));
const GKTool = lazy(() => import("./GKTool"));
const SSCMockTestTool = lazy(() => import("./SSCMockTestTool"));

const SECTIONS = [
  { id: "english", label: "English", icon: BookOpen, emoji: "📖", color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20", desc: "Vocabulary, Grammar, Comprehension" },
  { id: "math", label: "Math", icon: Calculator, emoji: "🔢", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", desc: "Arithmetic, Algebra, Geometry, DI" },
  { id: "reasoning", label: "Reasoning", icon: Puzzle, emoji: "🧩", color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20", desc: "Verbal, Non-Verbal, Analytical" },
  { id: "gk", label: "General Knowledge", icon: Globe, emoji: "🌍", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", desc: "History, Polity, Geography, Science" },
  { id: "mock", label: "Mock Tests", icon: Clock, emoji: "⏱️", color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", desc: "Timed full-length & mini mocks" },
] as const;

type SectionId = typeof SECTIONS[number]["id"];

export default function SSCHubTool() {
  const [activeSection, setActiveSection] = useState<SectionId | null>(null);

  if (activeSection) {
    return (
      <div className="animate-fade-in">
        {/* Back bar */}
        <div className="flex items-center gap-2 px-4 pt-3 pb-2">
          <button
            onClick={() => setActiveSection(null)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to SSC Hub
          </button>
          <span className="text-xs text-muted-foreground/50">
            {SECTIONS.find(s => s.id === activeSection)?.label}
          </span>
        </div>
        <Suspense fallback={<div className="flex items-center justify-center py-20"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>}>
          {activeSection === "english" && <SSCEnglishTool onBack={() => setActiveSection(null)} />}
          {activeSection === "math" && <SSCMathTool />}
          {activeSection === "reasoning" && <SSCReasoningTool />}
          {activeSection === "gk" && <GKTool />}
          {activeSection === "mock" && <SSCMockTestTool />}
        </Suspense>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-primary/10 border border-primary/20 mb-2">
          <GraduationCap className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-foreground">SSC Exam Prep</h2>
        <p className="text-sm text-muted-foreground">CGL / CHSL — Complete preparation suite</p>
        
        {/* Stats */}
        <div className="flex items-center justify-center gap-4 mt-3">
          {[
            { icon: Brain, label: "5 Subjects", color: "text-purple-400" },
            { icon: Trophy, label: "Mock Tests", color: "text-amber-400" },
            { icon: Zap, label: "PYQ Practice", color: "text-emerald-400" },
          ].map(stat => (
            <div key={stat.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <stat.icon className={cn("w-3.5 h-3.5", stat.color)} />
              <span>{stat.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Section cards */}
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
