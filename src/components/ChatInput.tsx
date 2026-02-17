import { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";

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
    <div className="border-t border-border bg-background px-4 py-4">
      <div className="max-w-3xl mx-auto relative">
        <div className="flex items-end gap-2 rounded-2xl border border-border bg-card shadow-sm px-4 py-3 focus-within:ring-2 focus-within:ring-ring/30 transition-shadow">
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
            placeholder="Ask Quanta anything..."
            rows={1}
            className="flex-1 resize-none bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground min-h-[24px] max-h-[200px]"
            disabled={disabled}
          />
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || disabled}
            className="p-2 rounded-xl bg-primary text-primary-foreground disabled:opacity-40 hover:opacity-90 transition-opacity shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
