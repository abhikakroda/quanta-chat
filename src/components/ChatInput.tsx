import { useState, useRef, useEffect } from "react";
import { ArrowUp, Square, Paperclip, Bot, Zap, ChevronDown, ChevronUp, Settings2, Atom } from "lucide-react";
import { cn } from "@/lib/utils";
import { MODELS, ModelId } from "@/lib/chat";

type Props = {
  onSend: (message: string) => void;
  onStop?: () => void;
  disabled: boolean;
  streaming?: boolean;
  agentMode?: boolean;
  onToggleAgent?: () => void;
  thinkingEnabled?: boolean;
  onToggleThinking?: () => void;
  selectedModel?: ModelId;
  onSelectModel?: (model: ModelId) => void;
  modelSupportsThinking?: boolean;
};

export default function ChatInput({
  onSend, onStop, disabled, streaming,
  agentMode, onToggleAgent,
  thinkingEnabled, onToggleThinking,
  selectedModel = "qwen", onSelectModel,
  modelSupportsThinking,
}: Props) {
  const [input, setInput] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<{ name: string }[]>([]);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [agentPopover, setAgentPopover] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const modelRef = useRef<HTMLDivElement>(null);
  const agentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = "auto";
      ref.current.style.height = Math.min(ref.current.scrollHeight, 200) + "px";
    }
  }, [input]);

  // Close dropdowns on outside click
  useEffect(() => {
    if (!modelMenuOpen && !agentPopover) return;
    const handler = (e: MouseEvent) => {
      if (modelMenuOpen && modelRef.current && !modelRef.current.contains(e.target as Node)) setModelMenuOpen(false);
      if (agentPopover && agentRef.current && !agentRef.current.contains(e.target as Node)) setAgentPopover(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [modelMenuOpen, agentPopover]);

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
      setAttachedFiles((prev) => [...prev, { name: file.name }]);
    });
    e.target.value = "";
  };

  const removeFile = (index: number) => setAttachedFiles((prev) => prev.filter((_, i) => i !== index));

  const selectedModelLabel = MODELS.find((m) => m.id === selectedModel)?.label || "Auto";

  return (
    <div className="px-3 sm:px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
      <div className="max-w-[680px] mx-auto">
        {/* Attached files */}
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

        <div className="relative flex flex-col rounded-[26px] border border-border bg-card/80 transition-all duration-150 focus-within:border-foreground/15 shadow-elegant overflow-visible">
          {/* Textarea */}
          <textarea
            ref={ref}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
            }}
            placeholder={agentMode ? "Ask agent anything…" : "Ask anything"}
            rows={1}
            className="w-full resize-none bg-transparent outline-none text-[15px] text-foreground placeholder:text-muted-foreground/50 min-h-[48px] max-h-[200px] px-5 pt-3.5 pb-1"
            disabled={disabled}
          />

          {/* Bottom action row */}
          <div className="flex items-center justify-between px-2.5 pb-2.5 pt-0.5">
            {/* Left: attach + settings */}
            <div className="flex items-center gap-0.5">
              <input ref={fileRef} type="file" accept="image/*,.pdf,.txt,.md,.csv,.json" multiple className="hidden" onChange={handleFileSelect} />
              <button
                onClick={() => fileRef.current?.click()}
                className="p-2 rounded-xl border border-border hover:bg-accent text-muted-foreground/60 hover:text-foreground transition-colors touch-manipulation"
                title="Attach file"
              >
                <Paperclip className="w-4 h-4" />
              </button>
            </div>

            {/* Right: model selector + thinking + agent + send */}
            <div className="flex items-center gap-1.5">
              {/* Model selector */}
              {onSelectModel && (
                <div ref={modelRef} className="relative">
                  <button
                    onClick={() => { setModelMenuOpen((o) => !o); setAgentPopover(false); }}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-full border border-border text-[12px] font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors touch-manipulation"
                  >
                    <span className="max-w-[80px] sm:max-w-none truncate">{selectedModelLabel}</span>
                    {modelMenuOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                  {modelMenuOpen && (
                    <div className="absolute bottom-full right-0 mb-2 bg-card border border-border rounded-xl shadow-float z-50 min-w-[180px] py-1 animate-message-in">
                      {MODELS.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => { onSelectModel(m.id); setModelMenuOpen(false); }}
                          className={cn(
                            "w-full text-left px-3 py-2 text-sm transition-colors touch-manipulation flex items-center justify-between",
                            selectedModel === m.id ? "text-foreground font-medium bg-accent" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                          )}
                        >
                          <span>{m.label}</span>
                          {selectedModel === m.id && <span className="text-foreground">✓</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Thinking toggle */}
              {modelSupportsThinking && onToggleThinking && (
                <button
                  onClick={onToggleThinking}
                  className={cn(
                    "p-2 rounded-xl border transition-colors touch-manipulation",
                    thinkingEnabled
                      ? "border-primary/30 text-primary bg-primary/10"
                      : "border-border text-muted-foreground/40 hover:text-muted-foreground hover:bg-accent"
                  )}
                  title={thinkingEnabled ? "Reasoning ON" : "Reasoning OFF"}
                >
                  <Zap className="w-4 h-4" />
                </button>
              )}

              {/* Agent mode */}
              {onToggleAgent && (
                <div ref={agentRef} className="relative">
                  <button
                    onClick={() => { setAgentPopover((o) => !o); setModelMenuOpen(false); }}
                    className={cn(
                      "p-2 rounded-xl border transition-colors touch-manipulation",
                      agentMode
                        ? "border-primary/30 text-primary bg-primary/10"
                        : "border-border text-muted-foreground/40 hover:text-muted-foreground hover:bg-accent"
                    )}
                    title={agentMode ? "Agent ON" : "Agent OFF"}
                  >
                    <Atom className="w-4 h-4" />
                  </button>
                  {agentPopover && (
                    <div className="absolute bottom-full right-0 mb-2 bg-card border border-border rounded-xl shadow-float z-50 w-[220px] p-3 animate-message-in">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Atom className="w-4 h-4 text-foreground" />
                        <span className="text-sm font-medium text-foreground">Agent Mode</span>
                      </div>
                      <p className="text-[12px] text-muted-foreground mb-3 leading-relaxed">
                        Multi-step reasoning for complex professional tasks
                      </p>
                      <button
                        onClick={() => { onToggleAgent(); setAgentPopover(false); }}
                        className={cn(
                          "w-full px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                          agentMode
                            ? "bg-destructive/10 text-destructive hover:bg-destructive/20"
                            : "bg-primary text-primary-foreground hover:opacity-90"
                        )}
                      >
                        {agentMode ? "Disable Agent" : "Enable Agent"}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Send / Stop */}
              {streaming ? (
                <button
                  onClick={onStop}
                  className="w-9 h-9 rounded-xl bg-foreground text-background hover:opacity-80 active:opacity-70 transition-opacity flex items-center justify-center touch-manipulation"
                >
                  <Square className="w-3.5 h-3.5" fill="currentColor" />
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={!input.trim() || disabled}
                  className="w-9 h-9 rounded-xl bg-foreground text-background disabled:opacity-20 hover:opacity-80 active:opacity-70 transition-opacity flex items-center justify-center touch-manipulation"
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
