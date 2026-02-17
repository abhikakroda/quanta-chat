import { useState, useRef, useEffect } from "react";
import { ArrowUp, Square, Plus } from "lucide-react";

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
    <div className="px-3 sm:px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
      <div className="max-w-[680px] mx-auto">
        <div className="relative flex items-end rounded-[26px] border border-border bg-card/80 transition-all duration-150 focus-within:border-foreground/15 shadow-elegant">
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
            placeholder="Ask anything"
            rows={1}
            className="w-full resize-none bg-transparent outline-none text-[15px] text-foreground placeholder:text-muted-foreground/50 min-h-[48px] max-h-[200px] pl-4 sm:pl-5 pr-14 py-3.5"
            disabled={disabled}
          />
          <div className="absolute right-2 bottom-2">
            {streaming ? (
              <button
                onClick={onStop}
                className="w-8 h-8 rounded-full bg-foreground text-background hover:opacity-80 active:opacity-70 transition-opacity flex items-center justify-center touch-manipulation"
              >
                <Square className="w-3.5 h-3.5" fill="currentColor" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!input.trim() || disabled}
                className="w-8 h-8 rounded-full bg-foreground text-background disabled:opacity-20 hover:opacity-80 active:opacity-70 transition-opacity flex items-center justify-center touch-manipulation"
              >
                <ArrowUp className="w-4 h-4" strokeWidth={2.5} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
