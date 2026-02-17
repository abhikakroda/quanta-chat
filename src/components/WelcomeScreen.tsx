import { Code2, PenTool, GraduationCap, Zap } from "lucide-react";

type Props = { onSuggestion: (text: string) => void };

const suggestions = [
  { icon: Code2, text: "Help me write a Python function to sort a list" },
  { icon: PenTool, text: "Summarize a long article for me" },
  { icon: GraduationCap, text: "Explain quantum computing simply" },
  { icon: Zap, text: "What are the latest trends in AI?" },
];

export default function WelcomeScreen({ onSuggestion }: Props) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 sm:py-16">
      <h1 className="text-xl sm:text-2xl font-semibold text-foreground mb-1 tracking-tight text-center">
        What can I help with?
      </h1>
      <p className="text-sm text-muted-foreground mb-8 sm:mb-10 text-center">
        Ask anything or pick a suggestion below.
      </p>

      <div className="flex flex-col sm:flex-wrap sm:flex-row justify-center gap-2 w-full max-w-lg px-2 sm:px-0">
        {suggestions.map((s) => (
          <button
            key={s.text}
            onClick={() => onSuggestion(s.text)}
            className="flex items-center gap-2 px-3.5 py-2.5 sm:py-2 rounded-full border border-border bg-card hover:bg-accent active:bg-accent text-sm text-foreground/80 hover:text-foreground transition-colors duration-150 touch-manipulation"
          >
            <s.icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span className="truncate">{s.text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
