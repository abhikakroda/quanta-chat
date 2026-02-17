import { useState, useRef, useEffect } from "react";
import { ArrowUp, Square } from "lucide-react";

type Props = {
  onSend: (message: string) => void;
  onStop?: () => void;
  disabled: boolean;
  streaming?: boolean;
};

export default function ChatInput({ onSend, onStop, disabled, streaming }: Props) {
  const [input, setInput] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = "auto";
      ref.current.style.height = Math.min(ref.current.scrollHeight, 200) + "px";
    }
  }, [input]);

  const handleSubmit = () => {
    if (!input.trim() || disabled) return;
    onSend(input.trim());
    setInput("");
  };

  return (
    <div className="px-4 pb-5 pt-2">
      <div className="max-w-2xl mx-auto">
        <div className="relative rounded-xl border border-border bg-card transition-all duration-150 focus-within:border-foreground/20">
          <textarea
            ref={ref}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="Message Quanta…"
            rows={1}
            className="w-full resize-none bg-transparent outline-none text-[14px] text-foreground placeholder:text-muted-foreground/50 min-h-[44px] max-h-[200px] px-3.5 py-3 pr-12"
            disabled={disabled}
          />
          <div className="absolute right-2 bottom-2">
            {streaming ? (
              <button
                onClick={onStop}
                className="w-7 h-7 rounded-lg bg-foreground text-background hover:opacity-80 transition-opacity flex items-center justify-center"
              >
                <Square className="w-3 h-3" fill="currentColor" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!input.trim() || disabled}
                className="w-7 h-7 rounded-lg bg-foreground text-background disabled:opacity-20 hover:opacity-80 transition-opacity flex items-center justify-center"
              >
                <ArrowUp className="w-3.5 h-3.5" strokeWidth={2.5} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}