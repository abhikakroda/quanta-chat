import { useState, useRef, useEffect, useCallback, forwardRef } from "react";
import { ArrowUp, Square, Plus, Mic, MicOff, Loader2, Paperclip, AudioLines, FileText, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { MODELS, ModelId } from "@/lib/chat";
import * as pdfjsLib from "pdfjs-dist";
import mammoth from "mammoth";

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
  noBorder,
}, _ref) {
  const [input, setInput] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = "auto";
      ref.current.style.height = Math.min(ref.current.scrollHeight, 200) + "px";
    }
  }, [input]);


  const handleSubmit = () => {
    const trimmed = input.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed, attachedFiles.length > 0 ? attachedFiles : undefined);
    setInput("");
    setAttachedFiles([]);
  };

  const readPdfContent = async (file: File): Promise<{ content: string; dataUrl?: string }> => {
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
      const text = pages.join("\n\n");
      if (text.trim()) {
        return { content: text };
      }
      // No extractable text — render first page as image for vision
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d")!;
      await page.render({ canvasContext: ctx, viewport }).promise;
      const dataUrl = canvas.toDataURL("image/png");
      return { content: `[Image-based PDF: ${file.name}]`, dataUrl };
    } catch {
      return { content: `[Could not read PDF: ${file.name}]` };
    }
  };

  const readDocxContent = async (file: File): Promise<string> => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      return result.value || "[DOCX contained no extractable text]";
    } catch {
      return `[Could not read DOCX: ${file.name}]`;
    }
  };

  const readFileContent = async (file: File): Promise<{ content: string; dataUrl?: string }> => {
    if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
      return await readPdfContent(file);
    }
    if (file.name.endsWith(".docx") || file.name.endsWith(".doc") || file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      return { content: await readDocxContent(file) };
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
    } catch (err) {
      console.error("Mic error:", err);
      const { getMicErrorMessage } = await import("@/lib/micErrors");
      const { toast } = await import("@/hooks/use-toast");
      toast({ title: "Microphone Error", description: getMicErrorMessage(err), variant: "destructive" });
    }
  }, [recording]);


  return (
    <div
      className={cn("px-2 sm:px-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2", !noBorder && "border-t border-border/30")}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="max-w-[720px] mx-auto">
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
              <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/80 border border-border/40 text-xs text-foreground group">
                {f.dataUrl ? (
                  <img src={f.dataUrl} alt={f.name} className="w-8 h-8 rounded object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <FileText className="w-4 h-4 text-primary/60" />
                  </div>
                )}
                <div className="min-w-0">
                  <span className="truncate max-w-[140px] block font-medium text-[12px]">{f.name}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {f.type.startsWith("image/") ? "Image" : f.name.endsWith(".pdf") ? "PDF" : f.name.endsWith(".docx") || f.name.endsWith(".doc") ? "Word Doc" : "Text file"}
                  </span>
                </div>
                <button onClick={() => removeFile(i)} className="p-0.5 rounded-md text-muted-foreground/40 hover:text-foreground hover:bg-muted transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div
          className={cn(
            "relative flex items-end rounded-[24px] liquid-pill transition-all duration-300",
            dragging && "ring-2 ring-primary/30"
          )}
        >
          {/* Plus / attach */}
          <input ref={fileRef} type="file" accept=".txt,.md,.csv,.json,.js,.ts,.tsx,.jsx,.py,.html,.css,.xml,.yaml,.yml,.log,.sql,.sh,.env,.toml,.ini,.cfg,.conf,.pdf,.docx,.doc,image/*" multiple className="hidden" onChange={handleFileSelect} />
          <button
            onClick={() => fileRef.current?.click()}
            className="shrink-0 w-9 h-9 sm:w-10 sm:h-10 ml-1 sm:ml-1.5 mb-1 rounded-full hover:bg-accent text-muted-foreground/50 hover:text-foreground transition-colors flex items-center justify-center touch-manipulation"
            title="Attach file"
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

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
            placeholder="Ask anything"
            rows={1}
            className="flex-1 resize-none bg-transparent outline-none text-sm sm:text-[15px] text-foreground placeholder:text-muted-foreground/40 max-h-[200px] py-3 min-h-[44px] sm:min-h-[48px]"
          />

          {/* Right buttons */}
          <div className="flex items-center gap-0.5 shrink-0 mr-1 sm:mr-1.5 mb-1">
            {/* Voice input */}
            <button
              onClick={toggleRecording}
              disabled={transcribing}
              className={cn(
                "w-9 h-9 sm:w-10 sm:h-10 rounded-full transition-all duration-200 touch-manipulation flex items-center justify-center",
                recording
                  ? "text-destructive bg-destructive/10"
                  : transcribing
                  ? "text-muted-foreground/30"
                  : "hover:bg-accent text-muted-foreground/50 hover:text-foreground"
              )}
              title={recording ? "Stop" : transcribing ? "Transcribing..." : "Voice input"}
            >
              {transcribing ? <Loader2 className="w-4 h-4 animate-spin" /> : recording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            {/* Send / Stop / Voice button */}
            {streaming ? (
              <button
                onClick={onStop}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-foreground text-background hover:opacity-80 transition-colors flex items-center justify-center touch-manipulation"
              >
                <Square className="w-3 h-3 sm:w-3.5 sm:h-3.5" fill="currentColor" />
              </button>
            ) : input.trim() ? (
              <button
                onClick={handleSubmit}
                disabled={!input.trim() || streaming}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-primary text-primary-foreground disabled:opacity-20 hover:opacity-80 transition-colors flex items-center justify-center touch-manipulation"
              >
                <ArrowUp className="w-4 h-4" strokeWidth={2.5} />
              </button>
            ) : (
              <button
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-primary text-primary-foreground hover:opacity-80 transition-colors flex items-center justify-center touch-manipulation"
                title="Voice chat"
              >
                <AudioLines className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
});

export default ChatInput;
