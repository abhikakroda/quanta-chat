import { Code2, BookOpen, Pencil, Lightbulb } from "lucide-react";
import ChatInput from "./ChatInput";

type Props = {
  onSend: (text: string) => void;
  onStop?: () => void;
  disabled: boolean;
  streaming?: boolean;
  agentMode?: boolean;
  onToggleAgent?: () => void;
};

const suggestions = [
  { icon: "💻", text: "Write code" },
  { icon: "📖", text: "Learn something" },
  { icon: "✏️", text: "Write or edit" },
  { icon: "💡", text: "Step-by-step help" },
];

export default function WelcomeScreen({ onSend, onStop, disabled, streaming, agentMode, onToggleAgent }: Props) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4">
      <h1 className="text-2xl sm:text-3xl font-normal text-foreground mb-8 sm:mb-10 tracking-tight text-center">
        What can I help with?
      </h1>

      {/* Centered input */}
      <div className="w-full max-w-[680px] mb-6">
        <ChatInput onSend={onSend} onStop={onStop} disabled={disabled} streaming={streaming} agentMode={agentMode} onToggleAgent={onToggleAgent} />
      </div>

      {/* Suggestion chips */}
      <div className="flex flex-wrap justify-center gap-2 max-w-[680px]">
        {suggestions.map((s) => (
          <button
            key={s.text}
            onClick={() => onSend(s.text)}
            className="flex items-center gap-2 px-4 py-2 rounded-full border border-border hover:bg-accent active:bg-accent text-sm text-foreground/70 hover:text-foreground transition-colors duration-150 touch-manipulation"
          >
            <span>{s.icon}</span>
            <span>{s.text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
