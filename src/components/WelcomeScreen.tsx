import { Sparkles, Code2, PenTool, GraduationCap, Zap } from "lucide-react";

type Props = { onSuggestion: (text: string) => void };

const suggestions = [
  { icon: Code2, text: "Help me write a Python function to sort a list", label: "Code", color: "from-blue-500/20 to-cyan-500/20 dark:from-blue-500/10 dark:to-cyan-500/10" },
  { icon: PenTool, text: "Summarize a long article for me", label: "Write", color: "from-purple-500/20 to-pink-500/20 dark:from-purple-500/10 dark:to-pink-500/10" },
  { icon: GraduationCap, text: "Explain quantum computing simply", label: "Learn", color: "from-amber-500/20 to-orange-500/20 dark:from-amber-500/10 dark:to-orange-500/10" },
  { icon: Zap, text: "What are the latest trends in AI?", label: "Explore", color: "from-emerald-500/20 to-teal-500/20 dark:from-emerald-500/10 dark:to-teal-500/10" },
];

export default function WelcomeScreen({ onSuggestion }: Props) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-12 relative">
      {/* Background glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
        <div className="w-[500px] h-[500px] rounded-full bg-primary/5 blur-[100px]" />
      </div>

      <div className="relative z-10 flex flex-col items-center">
        {/* Logo */}
        <div className="relative mb-8">
          <div className="absolute inset-0 rounded-2xl bg-primary/20 blur-xl animate-pulse-ring" />
          <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center glow-primary">
            <Sparkles className="w-7 h-7 text-primary-foreground" />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-4xl font-bold mb-3 tracking-tight">
          <span className="gradient-text">Quanta AI</span>
        </h1>
        <p className="text-muted-foreground text-center max-w-sm mb-12 text-[15px] leading-relaxed">
          Your intelligent assistant for coding, writing, analysis, and more.
        </p>

        {/* Suggestion cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl w-full">
          {suggestions.map((s, i) => (
            <button
              key={s.label}
              onClick={() => onSuggestion(s.text)}
              className="group flex flex-col items-start gap-3 p-4 rounded-xl border border-border bg-card hover:border-primary/30 transition-all duration-300 text-left hover:shadow-elegant"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${s.color} flex items-center justify-center`}>
                <s.icon className="w-4 h-4 text-foreground/70 group-hover:text-primary transition-colors" />
              </div>
              <div>
                <span className="text-sm font-medium text-foreground block mb-0.5">{s.label}</span>
                <span className="text-xs text-muted-foreground leading-snug line-clamp-2">{s.text}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}