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
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-16">
      <h1 className="text-2xl font-semibold text-foreground mb-1 tracking-tight">
        What can I help with?
      </h1>
      <p className="text-sm text-muted-foreground mb-10">
        Ask anything or pick a suggestion below.
      </p>

      <div className="flex flex-wrap justify-center gap-2 max-w-lg">
        {suggestions.map((s) => (
          <button
            key={s.text}
            onClick={() => onSuggestion(s.text)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-full border border-border bg-card hover:bg-accent text-sm text-foreground/80 hover:text-foreground transition-colors duration-150"
          >
            <s.icon className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="truncate max-w-[200px]">{s.text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}