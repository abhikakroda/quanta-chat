import { Bot, Code, FileText, Lightbulb } from "lucide-react";

type Props = { onSuggestion: (text: string) => void };

const suggestions = [
  { icon: Code, text: "Help me write a Python function", label: "Coding" },
  { icon: FileText, text: "Summarize a long article for me", label: "Writing" },
  { icon: Lightbulb, text: "Explain quantum computing simply", label: "Learning" },
];

export default function WelcomeScreen({ onSuggestion }: Props) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
        <Bot className="w-8 h-8 text-primary" />
      </div>
      <h1 className="text-3xl font-bold text-foreground mb-2">Quanta AI</h1>
      <p className="text-muted-foreground text-center max-w-md mb-10">
        Powered by Qwen 3.5. Ask me anything — coding, writing, analysis, and more.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl w-full">
        {suggestions.map((s) => (
          <button
            key={s.label}
            onClick={() => onSuggestion(s.text)}
            className="flex flex-col items-center gap-3 p-5 rounded-xl border border-border bg-card hover:bg-accent/50 hover:border-primary/30 transition-all text-left group"
          >
            <s.icon className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
            <span className="text-sm text-foreground font-medium">{s.label}</span>
            <span className="text-xs text-muted-foreground text-center">{s.text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
