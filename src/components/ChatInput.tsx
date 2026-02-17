import { useState, useRef, useEffect } from "react";
import { ArrowUp } from "lucide-react";

type Props = {
  onSend: (message: string) => void;
  disabled: boolean;
};

export default function ChatInput({ onSend, disabled }: Props) {
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
    <div className="px-4 pb-4 pt-2 bg-gradient-to-t from-background via-background to-transparent">
      <div className="max-w-3xl mx-auto">
        <div className="relative rounded-2xl border border-border bg-card shadow-elegant transition-all duration-200 focus-within:shadow-float focus-within:border-primary/30">
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
            placeholder="Message Quanta..."
            rows={1}
            className="w-full resize-none bg-transparent outline-none text-[15px] text-foreground placeholder:text-muted-foreground/60 min-h-[52px] max-h-[200px] px-4 py-3.5 pr-14"
            disabled={disabled}
          />
          <div className="absolute right-2 bottom-2">
            <button
              onClick={handleSubmit}
              disabled={!input.trim() || disabled}
              className="w-8 h-8 rounded-lg bg-primary text-primary-foreground disabled:opacity-30 hover:opacity-90 transition-all duration-200 flex items-center justify-center disabled:cursor-not-allowed"
            >
              <ArrowUp className="w-4 h-4" strokeWidth={2.5} />
            </button>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground/50 text-center mt-2">
          Quanta can make mistakes. Verify important information.
        </p>
      </div>
    </div>
  );
}