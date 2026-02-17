import { useState, useRef, useEffect, useCallback } from "react";
import { ArrowUp, Square, Paperclip, Bot, Zap, ChevronDown, ChevronUp, Settings2, Atom, Mic, MicOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { MODELS, ModelId } from "@/lib/chat";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

type AttachedFile = {
  name: string;
  content: string;
  type: string;
};

type Props = {
  onSend: (message: string, files?: AttachedFile[]) => void;
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
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [agentPopover, setAgentPopover] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const modelRef = useRef<HTMLDivElement>(null);
  const agentRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

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
    onSend(trimmed, attachedFiles.length > 0 ? attachedFiles : undefined);
    setInput("");
    setAttachedFiles([]);
  };

  const readPdfContent = async (file: File): Promise<string> => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const pages: string[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(" ");
        if (pageText.trim()) pages.push(pageText);
      }
      return pages.join("\n\n") || "[PDF contained no extractable text]";
    } catch {
      return `[Could not read PDF: ${file.name}]`;
    }
  };

  const readFileContent = async (file: File): Promise<string> => {
    if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
      return readPdfContent(file);
    }
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(`[Could not read file: ${file.name}]`);
      reader.readAsText(file);
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      const content = await readFileContent(file);
      setAttachedFiles((prev) => [...prev, { name: file.name, content, type: file.type }]);
    }
    e.target.value = "";
  };

  const removeFile = (index: number) => setAttachedFiles((prev) => prev.filter((_, i) => i !== index));

  const [dragging, setDragging] = useState(false);
  const dragCounter = useRef(0);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    dragCounter.current = 0;
    const files = e.dataTransfer.files;
    if (!files?.length) return;
    for (const file of Array.from(files)) {
      const content = await readFileContent(file);
      setAttachedFiles((prev) => [...prev, { name: file.name, content, type: file.type }]);
    }
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.types.includes("Files")) setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) setDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const toggleRecording = useCallback(async () => {
    if (recording) {
      mediaRecorderRef.current?.stop();
      setRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setTranscribing(true);

        try {
          const formData = new FormData();
          formData.append("audio", blob, "recording.webm");

          const resp = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sarvam-stt`,
            {
              method: "POST",
              headers: {
                apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
                Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
              },
              body: formData,
            }
          );

          if (!resp.ok) throw new Error("STT failed");
          const data = await resp.json();
          if (data.transcript) {
            setInput((prev) => (prev ? prev + " " + data.transcript : data.transcript));
          }
        } catch (err) {
          console.error("STT error:", err);
        } finally {
          setTranscribing(false);
        }
      };

      mediaRecorder.start();
      setRecording(true);
    } catch (err) {
      console.error("Microphone access denied:", err);
    }
  }, [recording]);

  const selectedModelLabel = MODELS.find((m) => m.id === selectedModel)?.label || "Auto";

  return (
    <div
      className="px-3 sm:px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="max-w-[680px] mx-auto">
        {/* Drag overlay */}
        {dragging && (
          <div className="mb-2 flex items-center justify-center rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 py-6 text-sm text-muted-foreground animate-fade-in">
            <Paperclip className="w-4 h-4 mr-2" />
            Drop files here
          </div>
        )}

        {/* Attached files */}
        {attachedFiles.length > 0 && !dragging && (
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

        <div className={cn(
          "relative flex flex-col rounded-[26px] glass-strong transition-all duration-300 focus-within:border-foreground/15 shadow-liquid overflow-visible",
          dragging && "ring-2 ring-primary/30"
        )}>
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
              <input ref={fileRef} type="file" accept=".txt,.md,.csv,.json,.js,.ts,.tsx,.jsx,.py,.html,.css,.xml,.yaml,.yml,.log,.sql,.sh,.env,.toml,.ini,.cfg,.conf,.pdf" multiple className="hidden" onChange={handleFileSelect} />
              <button
                onClick={() => fileRef.current?.click()}
                className="p-2 rounded-xl border border-border hover:bg-accent text-muted-foreground/60 hover:text-foreground transition-colors touch-manipulation ripple-container press-scale"
                title="Attach file"
              >
                <Paperclip className="w-4 h-4" />
              </button>
              <button
                onClick={toggleRecording}
                disabled={transcribing}
                className={cn(
                  "p-2 rounded-xl border transition-all duration-200 touch-manipulation ripple-container press-scale",
                  recording
                    ? "border-destructive/50 text-destructive bg-destructive/10 animate-pulse"
                    : transcribing
                    ? "border-border text-muted-foreground/40"
                    : "border-border hover:bg-accent text-muted-foreground/60 hover:text-foreground"
                )}
                title={recording ? "Stop recording" : transcribing ? "Transcribing..." : "Voice input"}
              >
                {transcribing ? <Loader2 className="w-4 h-4 animate-spin" /> : recording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
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
                    <div className="absolute bottom-full right-0 mb-2 bg-popover border border-border rounded-xl shadow-liquid z-50 min-w-[180px] py-1 animate-scale-spring">
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
                    "p-2 rounded-xl border transition-all duration-200 touch-manipulation press-scale",
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
                    <div className="absolute bottom-full right-0 mb-2 bg-popover border border-border rounded-xl shadow-liquid z-50 w-[250px] p-3 animate-scale-spring">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Atom className="w-4 h-4 text-foreground" />
                        <span className="text-sm font-medium text-foreground">Agent Mode</span>
                      </div>
                      <p className="text-[12px] text-muted-foreground mb-2 leading-relaxed">
                        Multi-step reasoning for complex tasks. The agent will:
                      </p>
                      <ul className="text-[11px] text-muted-foreground mb-3 space-y-1 pl-3">
                        <li>• Break tasks into numbered steps</li>
                        <li>• Auto-continue until complete</li>
                        <li>• Use the best model (Qwen 3.5)</li>
                        <li>• Enable deep thinking automatically</li>
                      </ul>
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
                  className="w-9 h-9 rounded-xl bg-foreground text-background hover:opacity-80 transition-opacity flex items-center justify-center touch-manipulation ripple-container press-scale"
                >
                  <Square className="w-3.5 h-3.5" fill="currentColor" />
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={!input.trim() || disabled}
                  className="w-9 h-9 rounded-xl bg-foreground text-background disabled:opacity-20 hover:opacity-80 transition-opacity flex items-center justify-center touch-manipulation ripple-container press-scale"
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
