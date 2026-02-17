import { useState, useRef, useEffect } from "react";
import { ArrowUp, Square, Paperclip, Bot } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  onSend: (message: string) => void;
  onStop?: () => void;
  disabled: boolean;
  streaming?: boolean;
  agentMode?: boolean;
  onToggleAgent?: () => void;
};

export default function ChatInput({ onSend, onStop, disabled, streaming, agentMode, onToggleAgent }: Props) {
  const [input, setInput] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<{ name: string; dataUrl: string }[]>([]);
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = "auto";
      ref.current.style.height = Math.min(ref.current.scrollHeight, 200) + "px";
    }
  }, [input]);

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (!trimmed || disabled) return;

    let message = trimmed;
    if (attachedFiles.length > 0) {
      const fileNames = attachedFiles.map((f) => f.name).join(", ");
      message = `[Attached: ${fileNames}]\n\n${trimmed}`;
    }

    onSend(message);
    setInput("");
    setAttachedFiles([]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        setAttachedFiles((prev) => [...prev, { name: file.name, dataUrl: reader.result as string }]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  const removeFile = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="px-3 sm:px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
      <div className="max-w-[680px] mx-auto">
        {/* Attached files preview */}
        {attachedFiles.length > 0 && (
          <div className="flex gap-2 mb-2 flex-wrap">
            {attachedFiles.map((f, i) => (
              <div key={i} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted text-xs text-muted-foreground">
                <Paperclip className="w-3 h-3" />
                <span className="truncate max-w-[120px]">{f.name}</span>
                <button onClick={() => removeFile(i)} className="text-muted-foreground/50 hover:text-foreground ml-0.5">×</button>
              </div>
            ))}
          </div>
        )}

        <div className="relative flex flex-col rounded-[26px] border border-border bg-card/80 transition-all duration-150 focus-within:border-foreground/15 shadow-elegant">
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
            placeholder={agentMode ? "Ask agent anything…" : "Ask anything"}
            rows={1}
            className="w-full resize-none bg-transparent outline-none text-[15px] text-foreground placeholder:text-muted-foreground/50 min-h-[48px] max-h-[200px] pl-4 sm:pl-5 pr-14 py-3.5"
            disabled={disabled}
          />

          {/* Bottom action bar inside the pill */}
          <div className="flex items-center justify-between px-3 pb-2.5">
            <div className="flex items-center gap-1">
              {/* File attach */}
              <input ref={fileRef} type="file" accept="image/*,.pdf,.txt,.md,.csv,.json" multiple className="hidden" onChange={handleFileSelect} />
              <button
                onClick={() => fileRef.current?.click()}
                className="p-1.5 rounded-full text-muted-foreground/40 hover:text-muted-foreground hover:bg-accent transition-colors touch-manipulation"
                title="Attach file"
              >
                <Paperclip className="w-4 h-4" />
              </button>

              {/* Agent mode toggle */}
              {onToggleAgent && (
                <button
                  onClick={onToggleAgent}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium transition-colors touch-manipulation border",
                    agentMode
                      ? "border-primary/30 text-primary bg-primary/10"
                      : "border-transparent text-muted-foreground/40 hover:text-muted-foreground hover:bg-accent"
                  )}
                  title={agentMode ? "Agent mode ON" : "Agent mode OFF"}
                >
                  <Bot className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{agentMode ? "Agent" : "Agent"}</span>
                </button>
              )}
            </div>

            {/* Send/Stop */}
            <div>
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
    </div>
  );
}
