import { useState, useRef, useEffect, useCallback, forwardRef } from "react";
import { ArrowUp, Square, Plus, ChevronDown, ChevronUp, Atom, Mic, MicOff, Loader2, Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";
import { MODELS, ModelId, ThinkingLevel } from "@/lib/chat";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

type AttachedFile = {
  name: string;
  content: string;
  type: string;
  dataUrl?: string;
};

type Props = {
  onSend: (message: string, files?: AttachedFile[]) => void;
  onStop?: () => void;
  disabled: boolean;
  streaming?: boolean;
  agentMode?: boolean;
  onToggleAgent?: () => void;
  selectedModel?: ModelId;
  onSelectModel?: (model: ModelId) => void;
  activeSkillLabel?: string | null;
  noBorder?: boolean;
};

const ChatInput = forwardRef<HTMLDivElement, Props>(function ChatInput({
  onSend, onStop, disabled, streaming,
  agentMode, onToggleAgent,
  selectedModel = "mistral", onSelectModel,
  activeSkillLabel,
}, _ref) {
  const [input, setInput] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const modelRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = "auto";
      ref.current.style.height = Math.min(ref.current.scrollHeight, 200) + "px";
    }
  }, [input]);

  useEffect(() => {
    if (!modelMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (modelRef.current && !modelRef.current.contains(e.target as Node)) setModelMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [modelMenuOpen]);

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

  const readFileContent = async (file: File): Promise<{ content: string; dataUrl?: string }> => {
    if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
      return { content: await readPdfContent(file) };
    }
    if (file.type.startsWith("image/")) {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          resolve({ content: `[Image: ${file.name}]`, dataUrl });
        };
        reader.onerror = () => resolve({ content: `[Could not read image: ${file.name}]` });
        reader.readAsDataURL(file);
      });
    }
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ content: reader.result as string });
      reader.onerror = () => resolve({ content: `[Could not read file: ${file.name}]` });
      reader.readAsText(file);
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      const result = await readFileContent(file);
      setAttachedFiles((prev) => [...prev, { name: file.name, content: result.content, type: file.type, dataUrl: result.dataUrl }]);
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
      const result = await readFileContent(file);
      setAttachedFiles((prev) => [...prev, { name: file.name, content: result.content, type: file.type, dataUrl: result.dataUrl }]);
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
          const { supabase } = await import("@/integrations/supabase/client");
          const { data: { session } } = await supabase.auth.getSession();
          const token = session?.access_token;
          if (!token) throw new Error("Not authenticated");
          const formData = new FormData();
          formData.append("audio", blob, "recording.webm");
          const resp = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sarvam-stt`,
            { method: "POST", headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}` }, body: formData }
          );
          if (!resp.ok) throw new Error("STT failed");
          const data = await resp.json();
          if (data.transcript) setInput((prev) => (prev ? prev + " " + data.transcript : data.transcript));
        } catch (err) { console.error("STT error:", err); }
        finally { setTranscribing(false); }
      };
      mediaRecorder.start();
      setRecording(true);
    } catch (err) { console.error("Microphone access denied:", err); }
  }, [recording]);

  const selectedModelLabel = MODELS.find((m) => m.id === selectedModel)?.label || "Auto";

  // Build the active mode label for the pill
  const activeModeLabel = agentMode
    ? (activeSkillLabel ? `Agent | ${activeSkillLabel}` : "Agent")
    : activeSkillLabel || null;

  return (
    <div
      className="px-3 sm:px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 border-t border-border/30"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="max-w-[640px] mx-auto">
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
                {f.dataUrl ? (
                  <img src={f.dataUrl} alt={f.name} className="w-8 h-8 rounded object-cover" />
                ) : (
                  <Paperclip className="w-3 h-3" />
                )}
                <span className="truncate max-w-[120px]">{f.name}</span>
                <button onClick={() => removeFile(i)} className="text-muted-foreground/50 hover:text-foreground ml-0.5">×</button>
              </div>
            ))}
          </div>
        )}

        <div
          ref={containerRef}
          className={cn(
            "relative flex flex-col rounded-2xl border border-border/60 bg-card transition-all duration-300 shadow-sm overflow-visible",
            dragging && "ring-2 ring-primary/30"
          )}
        >
          {/* Textarea */}
          <textarea
            ref={ref}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (!streaming) handleSubmit();
              }
            }}
            placeholder={activeSkillLabel ? `Ask about ${activeSkillLabel}…` : "Ask away. Pics work too."}
            rows={1}
            className="w-full resize-none bg-transparent outline-none text-[15px] text-foreground placeholder:text-muted-foreground/40 max-h-[200px] px-4 pt-3.5 pb-1 min-h-[56px]"
          />

          {/* Bottom action row - Kimi style */}
          <div className="flex items-center justify-between px-2.5 pb-2.5 pt-0.5">
            {/* Left: + attach, Agent pill */}
            <div className="flex items-center gap-1.5">
              <input ref={fileRef} type="file" accept=".txt,.md,.csv,.json,.js,.ts,.tsx,.jsx,.py,.html,.css,.xml,.yaml,.yml,.log,.sql,.sh,.env,.toml,.ini,.cfg,.conf,.pdf,image/*" multiple className="hidden" onChange={handleFileSelect} />
              <button
                onClick={() => fileRef.current?.click()}
                className="w-8 h-8 rounded-lg border border-border/60 hover:bg-accent text-muted-foreground/50 hover:text-foreground transition-colors flex items-center justify-center touch-manipulation"
                title="Attach file"
              >
                <Plus className="w-4 h-4" />
              </button>

              {/* Agent toggle pill */}
              {onToggleAgent && (
                <button
                  onClick={onToggleAgent}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[13px] font-medium transition-all duration-200 touch-manipulation",
                    agentMode
                      ? "border-primary/40 text-primary bg-primary/10"
                      : "border-border/60 text-muted-foreground/60 hover:text-foreground hover:border-border"
                  )}
                >
                  <Atom className="w-3.5 h-3.5" />
                  <span>{activeModeLabel || "Agent"}</span>
                </button>
              )}

              {/* Voice input */}
              <button
                onClick={toggleRecording}
                disabled={transcribing}
                className={cn(
                  "w-8 h-8 rounded-lg border transition-all duration-200 touch-manipulation flex items-center justify-center",
                  recording
                    ? "border-destructive/50 text-destructive bg-destructive/10"
                    : transcribing
                    ? "border-border text-muted-foreground/30"
                    : "border-border/60 hover:bg-accent text-muted-foreground/50 hover:text-foreground"
                )}
                title={recording ? "Stop" : transcribing ? "Transcribing..." : "Voice input"}
              >
                {transcribing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : recording ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Right: model selector + send */}
            <div className="flex items-center gap-1.5">
              {/* Model selector */}
              {onSelectModel && (
                <div ref={modelRef} className="relative">
                  <button
                    onClick={() => setModelMenuOpen((o) => !o)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-medium text-muted-foreground/60 hover:text-foreground transition-colors touch-manipulation"
                  >
                    <span className="max-w-[90px] truncate">{selectedModelLabel}</span>
                    {modelMenuOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                  {modelMenuOpen && (
                    <div className="absolute bottom-full right-0 mb-2 bg-popover border border-border rounded-xl shadow-lg z-50 min-w-[180px] py-1 animate-scale-spring">
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

              {/* Send / Stop */}
              {streaming ? (
                <button
                  onClick={onStop}
                  className="w-9 h-9 rounded-full bg-foreground/10 text-foreground hover:bg-foreground/20 transition-colors flex items-center justify-center touch-manipulation"
                >
                  <Square className="w-3.5 h-3.5" fill="currentColor" />
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={!input.trim() || streaming}
                  className="w-9 h-9 rounded-full bg-foreground/10 text-foreground disabled:opacity-20 hover:bg-foreground/20 transition-colors flex items-center justify-center touch-manipulation"
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
});

export default ChatInput;
