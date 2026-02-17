import { useState, useRef, useCallback } from "react";
import { FileText, Upload, Loader2, Wand2, Download, RotateCcw, Copy, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import * as pdfjsLib from "pdfjs-dist";

// Set worker source
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

type EditMode = "rewrite" | "summarize" | "fix-grammar" | "translate" | "format" | "custom";

const EDIT_MODES: { id: EditMode; label: string; icon: string; prompt: string }[] = [
  { id: "rewrite", label: "Rewrite", icon: "✍️", prompt: "Rewrite this text to be clearer, more professional, and better structured. Keep the same meaning but improve readability and flow." },
  { id: "summarize", label: "Summarize", icon: "📝", prompt: "Summarize this text concisely, highlighting the key points and main ideas. Use bullet points where appropriate." },
  { id: "fix-grammar", label: "Fix Grammar", icon: "✅", prompt: "Fix all grammar, spelling, and punctuation errors in this text. Keep the original meaning and style intact." },
  { id: "translate", label: "Translate", icon: "🌐", prompt: "Translate this text to English. If already in English, translate to Hindi. Preserve formatting and meaning." },
  { id: "format", label: "Format", icon: "📋", prompt: "Format this text with proper headings, paragraphs, bullet points, and structure. Make it well-organized and easy to read." },
  { id: "custom", label: "Custom Edit", icon: "🎯", prompt: "" },
];

export default function PdfEditorTool() {
  const [fileName, setFileName] = useState("");
  const [originalText, setOriginalText] = useState("");
  const [editedText, setEditedText] = useState("");
  const [pageCount, setPageCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [selectedMode, setSelectedMode] = useState<EditMode>("rewrite");
  const [customPrompt, setCustomPrompt] = useState("");
  const [copied, setCopied] = useState(false);
  const [stage, setStage] = useState<"upload" | "preview" | "edited">("upload");
  const fileRef = useRef<HTMLInputElement>(null);

  const extractTextFromPdf = async (file: File): Promise<{ text: string; pages: number }> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = "";

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item: any) => item.str)
        .join(" ");
      fullText += `\n--- Page ${i} ---\n${pageText}\n`;
    }

    return { text: fullText.trim(), pages: pdf.numPages };
  };

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("Please upload a PDF file");
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      setError("File too large. Maximum 20MB.");
      return;
    }

    setLoading(true);
    setError("");
    setFileName(file.name);

    try {
      const { text, pages } = await extractTextFromPdf(file);
      if (!text.trim()) {
        throw new Error("No text found in PDF. It may be a scanned document or image-based PDF.");
      }
      setOriginalText(text);
      setPageCount(pages);
      setStage("preview");
    } catch (err: any) {
      setError(err.message || "Failed to parse PDF");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleEdit = async () => {
    setEditing(true);
    setError("");
    setEditedText("");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const mode = EDIT_MODES.find(m => m.id === selectedMode)!;
      const editPrompt = selectedMode === "custom" ? customPrompt : mode.prompt;

      if (!editPrompt.trim()) {
        throw new Error("Please enter a custom edit instruction");
      }

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content: `${editPrompt}\n\nHere is the PDF content to edit:\n\n${originalText.slice(0, 12000)}`,
            },
          ],
          model: "mistral",
          enableThinking: false,
          skillPrompt: "You are an expert document editor. Edit the provided text according to the user's instructions. Return ONLY the edited text without any explanations, preamble, or meta-commentary. Do not wrap in code blocks.",
        }),
      });

      if (!resp.ok) throw new Error("AI editing failed");

      const reader = resp.body?.getReader();
      if (!reader) throw new Error("No response");
      const decoder = new TextDecoder();
      let buffer = "";
      let full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") break;
          try {
            const parsed = JSON.parse(json);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) { full += content; setEditedText(full); }
          } catch { /* partial */ }
        }
      }

      setStage("edited");
    } catch (err: any) {
      setError(err.message || "Editing failed");
    } finally {
      setEditing(false);
    }
  };

  const handleDownload = () => {
    const content = editedText || originalText;
    const htmlContent = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${fileName} - Edited</title>
<style>body{font-family:Georgia,serif;max-width:800px;margin:40px auto;padding:20px;line-height:1.8;color:#222;}
h1,h2,h3{font-family:system-ui,sans-serif;margin-top:2em;}
p{margin:1em 0;}ul,ol{margin:1em 0;padding-left:2em;}
@media print{body{margin:0;padding:20px;}}</style></head>
<body>${content.split("\n").map(l => l.trim() ? `<p>${l}</p>` : "").join("\n")}</body></html>`;

    const blob = new Blob([htmlContent], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName.replace(".pdf", "-edited.html");
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(editedText || originalText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    setOriginalText("");
    setEditedText("");
    setFileName("");
    setPageCount(0);
    setStage("upload");
    setError("");
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4 animate-fade-in h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
            <FileText className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground tracking-tight">PDF Editor</h2>
            <p className="text-[11px] text-muted-foreground">AI-powered document editing</p>
          </div>
        </div>
        {stage !== "upload" && (
          <button onClick={handleReset} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs bg-muted/50 border border-border/50 text-foreground/70 hover:bg-muted transition-colors">
            <RotateCcw className="w-3.5 h-3.5" />
            New File
          </button>
        )}
      </div>

      {/* Upload stage */}
      {stage === "upload" && (
        <div className="flex-1 flex flex-col items-center justify-center">
          <input
            ref={fileRef}
            type="file"
            accept=".pdf"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={loading}
            className="w-full max-w-sm border-2 border-dashed border-border/60 rounded-2xl p-10 flex flex-col items-center gap-4 hover:border-primary/30 hover:bg-muted/30 transition-all duration-300 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
                <p className="text-sm text-muted-foreground">Extracting text...</p>
              </>
            ) : (
              <>
                <Upload className="w-10 h-10 text-muted-foreground/50" />
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground/70">Upload a PDF</p>
                  <p className="text-xs text-muted-foreground mt-1">Max 20MB • Text-based PDFs only</p>
                </div>
              </>
            )}
          </button>
        </div>
      )}

      {/* Preview / Edit stage */}
      {(stage === "preview" || stage === "edited") && (
        <div className="flex-1 flex flex-col space-y-4 overflow-hidden">
          {/* File info */}
          <div className="flex items-center gap-3 px-4 py-3 bg-muted/30 rounded-xl border border-border/30">
            <FileText className="w-5 h-5 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{fileName}</p>
              <p className="text-xs text-muted-foreground">{pageCount} pages • {originalText.length.toLocaleString()} characters</p>
            </div>
          </div>

          {/* Edit mode selector */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-medium px-1">Edit Mode</p>
            <div className="flex flex-wrap gap-2">
              {EDIT_MODES.map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => setSelectedMode(mode.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all border",
                    selectedMode === mode.id
                      ? "bg-primary/10 border-primary/20 text-primary"
                      : "bg-muted/30 border-border/30 text-foreground/60 hover:bg-muted/50"
                  )}
                >
                  <span>{mode.icon}</span>
                  {mode.label}
                </button>
              ))}
            </div>
            {selectedMode === "custom" && (
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Describe how you want the PDF content edited..."
                className="w-full px-4 py-3 rounded-xl bg-muted/30 border border-border/30 text-sm text-foreground placeholder:text-muted-foreground/40 resize-none focus:outline-none focus:ring-1 focus:ring-primary/30"
                rows={3}
              />
            )}
          </div>

          {/* Edit button */}
          <button
            onClick={handleEdit}
            disabled={editing || (selectedMode === "custom" && !customPrompt.trim())}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-all disabled:opacity-40"
          >
            {editing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Editing with AI...
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4" />
                Edit with AI
              </>
            )}
          </button>

          {/* Content display */}
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-muted-foreground px-1">
                {stage === "edited" ? "✨ Edited Content" : "📄 Original Content"}
              </p>
              <div className="flex gap-1.5">
                <button onClick={handleCopy} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-muted/50 text-foreground/60 hover:bg-muted transition-colors">
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied ? "Copied!" : "Copy"}
                </button>
                {stage === "edited" && (
                  <button onClick={handleDownload} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                    <Download className="w-3 h-3" />
                    Download
                  </button>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto rounded-xl bg-muted/20 border border-border/30 p-4">
              <pre className="text-sm text-foreground/80 whitespace-pre-wrap font-sans leading-relaxed">
                {editing && editedText ? editedText : stage === "edited" ? editedText : originalText}
              </pre>
            </div>
          </div>
        </div>
      )}

      {error && <p className="text-destructive text-xs text-center">{error}</p>}
    </div>
  );
}
