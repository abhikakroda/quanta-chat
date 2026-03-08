import { useState, useRef, useEffect } from "react";
import {
  FileText, Loader2, Upload, RotateCcw, Wand2, Presentation, ChevronLeft, ChevronRight,
  Download, X, Grid3X3, StickyNote, Play, Pencil, Check, FileDown, Sparkles, File,
  ScanText, Copy, CheckCheck, Eye
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import * as pdfjsLib from "pdfjs-dist";

// @ts-ignore
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

type Slide = {
  title: string;
  subtitle: string;
  content: string[];
  layout: "title" | "content" | "two-column" | "quote" | "image-text" | "stats";
  notes: string;
  accent: string;
};

type Mode = "home" | "analyze" | "slides" | "pdf-preview" | "ocr";

const ACCENT_COLORS: Record<string, { bg: string; text: string; gradient: string }> = {
  blue: { bg: "bg-blue-500", text: "text-blue-400", gradient: "from-blue-600 to-blue-400" },
  purple: { bg: "bg-purple-500", text: "text-purple-400", gradient: "from-purple-600 to-violet-400" },
  green: { bg: "bg-emerald-500", text: "text-emerald-400", gradient: "from-emerald-600 to-teal-400" },
  orange: { bg: "bg-orange-500", text: "text-orange-400", gradient: "from-orange-600 to-amber-400" },
  red: { bg: "bg-red-500", text: "text-red-400", gradient: "from-red-600 to-rose-400" },
  teal: { bg: "bg-teal-500", text: "text-teal-400", gradient: "from-teal-600 to-cyan-400" },
};

export default function DocAnalyzerTool() {
  const [fileName, setFileName] = useState("");
  const [extractedText, setExtractedText] = useState("");
  const [analysis, setAnalysis] = useState("");
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<Mode>("home");
  const fileRef = useRef<HTMLInputElement>(null);

  // Prompt-based generation
  const [prompt, setPrompt] = useState("");
  const [genType, setGenType] = useState<"pdf" | "ppt">("pdf");

  // PDF doc state
  const [pdfContent, setPdfContent] = useState("");
  const [editingPdf, setEditingPdf] = useState(false);
  const [pdfTitle, setPdfTitle] = useState("Document");
  const [generatingPdf, setGeneratingPdf] = useState(false);

  // Slide state
  const [slides, setSlides] = useState<Slide[]>([]);
  const [generatingSlides, setGeneratingSlides] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPresenting, setIsPresenting] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [slideStyle, setSlideStyle] = useState("professional");
  const [editingSlide, setEditingSlide] = useState<number | null>(null);

  // OCR state
  const [ocrText, setOcrText] = useState("");
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrTotalPages, setOcrTotalPages] = useState(0);
  const [ocrPageTexts, setOcrPageTexts] = useState<string[]>([]);
  const [ocrCopied, setOcrCopied] = useState(false);
  const ocrFileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError("");
    setAnalysis("");
    setExtractedText("");
    setSlides([]);
    setPdfContent("");
    setLoading(true);
    try {
      if (file.type === "application/pdf") {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let text = "";
        for (let i = 1; i <= Math.min(pdf.numPages, 50); i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          text += content.items.map((item: any) => item.str).join(" ") + "\n\n";
        }
        setExtractedText(text.trim());
      } else {
        setExtractedText(await file.text());
      }
      setMode("analyze");
    } catch (err: any) {
      setError(err.message || "Failed to read file");
    } finally {
      setLoading(false);
    }
  };

  // Generate PDF document from AI
  const handleGeneratePdf = async (sourceText?: string) => {
    setGeneratingPdf(true);
    setError("");
    setPdfContent("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const inputText = sourceText || prompt;
      const title = fileName || inputText.slice(0, 50) || "Document";
      setPdfTitle(title);

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/task-executor`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          task: sourceText
            ? `Create a well-structured professional document from this content:\n\n${sourceText.slice(0, 15000)}`
            : `Create a well-structured professional document about: ${inputText}`,
          format: "document",
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Generation failed" }));
        throw new Error(err.error || "Generation failed");
      }

      const data = await resp.json();
      if (data.content) {
        setPdfContent(data.content);
        setMode("pdf-preview");
      } else {
        throw new Error("No content generated");
      }
    } catch (err: any) {
      setError(err.message || "PDF generation failed");
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleAnalyze = async () => {
    if (!extractedText || analyzing) return;
    setAnalyzing(true);
    setAnalysis("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: `Analyze this document comprehensively. Provide:\n1. **Summary**\n2. **Key Points**\n3. **Structure**\n4. **Important Details**\n5. **Conclusions**\n\nDocument: "${fileName}"\n\nContent:\n${extractedText.slice(0, 12000)}` }],
          model: "qwen",
          enableThinking: false,
          skillPrompt: "You are a document analysis expert. Provide thorough, structured analysis using markdown formatting.",
        }),
      });

      if (!resp.ok) throw new Error("Analysis failed");
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
            if (content) {
              const clean = content.replace(/<\/?think>/g, "");
              if (clean) { full += clean; setAnalysis(full); }
            }
          } catch { /* partial */ }
        }
      }
    } catch (err: any) {
      setError(err.message || "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleGenerateSlides = async (sourceText?: string) => {
    setGeneratingSlides(true);
    setError("");
    setSlides([]);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-slides`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          documentText: sourceText || extractedText || prompt,
          fileName: fileName || prompt.slice(0, 50),
          slideCount: "8-10",
          style: slideStyle,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Generation failed" }));
        throw new Error(err.error || "Generation failed");
      }

      const data = await resp.json();
      if (data.slides && Array.isArray(data.slides)) {
        setSlides(data.slides);
        setCurrentSlide(0);
        setMode("slides");
      } else {
        throw new Error("Invalid slide data");
      }
    } catch (err: any) {
      setError(err.message || "Slide generation failed");
    } finally {
      setGeneratingSlides(false);
    }
  };

  const handlePromptGenerate = () => {
    if (!prompt.trim()) return;
    if (genType === "pdf") {
      handleGeneratePdf();
    } else {
      handleGenerateSlides();
    }
  };

  const handleReset = () => {
    setFileName(""); setExtractedText(""); setAnalysis(""); setError("");
    setSlides([]); setCurrentSlide(0); setMode("home"); setPdfContent("");
    setPrompt(""); setEditingSlide(null); setEditingPdf(false);
    setOcrText(""); setOcrPageTexts([]); setOcrProgress(0); setOcrTotalPages(0);
    if (fileRef.current) fileRef.current.value = "";
    if (ocrFileRef.current) ocrFileRef.current.value = "";
  };

  // ─── OCR: Handwritten PDF → Digital Text ───
  const handleOcrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.includes("pdf") && !file.name.endsWith(".pdf")) {
      setError("Please upload a PDF file for OCR");
      return;
    }
    setFileName(file.name);
    setError("");
    setOcrText("");
    setOcrPageTexts([]);
    setOcrLoading(true);
    setOcrProgress(0);
    setMode("ocr");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const totalPages = Math.min(pdf.numPages, 20);
      setOcrTotalPages(totalPages);
      const pageResults: string[] = [];

      for (let i = 1; i <= totalPages; i++) {
        setOcrProgress(i);
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d")!;
        await page.render({ canvasContext: ctx, viewport }).promise;

        // Convert canvas to base64
        const dataUrl = canvas.toDataURL("image/png");
        const base64 = dataUrl.split(",")[1];

        // Send to AI vision for OCR
        const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/describe-image`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            imageBase64: base64,
            mimeType: "image/png",
            prompt: "You are an expert OCR engine specialized in handwritten text recognition. Extract ALL text from this handwritten document image with maximum accuracy. Preserve the original structure, paragraphs, and line breaks. If there are diagrams or drawings, describe them briefly in [brackets]. Output ONLY the extracted text, no commentary or explanations. If text is unclear, make your best guess and mark uncertain words with (?).",
          }),
        });

        if (!resp.ok) throw new Error(`OCR failed on page ${i}`);
        const data = await resp.json();
        const pageText = data.description || `[Page ${i}: No text extracted]`;
        pageResults.push(pageText);
        setOcrPageTexts([...pageResults]);
        setOcrText(pageResults.map((t, idx) => `── Page ${idx + 1} ──\n${t}`).join("\n\n"));
      }
    } catch (err: any) {
      setError(err.message || "OCR processing failed");
    } finally {
      setOcrLoading(false);
    }
  };

  const copyOcrText = () => {
    navigator.clipboard.writeText(ocrText);
    setOcrCopied(true);
    setTimeout(() => setOcrCopied(false), 2000);
  };

  const downloadOcrText = () => {
    const blob = new Blob([ocrText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileName?.replace(/\.pdf$/i, "") || "ocr-output"}-digitized.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Download PDF via print
  const downloadPdf = () => {
    const html = generatePdfHtml(pdfTitle, pdfContent);
    const w = window.open("", "_blank");
    if (w) {
      w.document.write(html);
      w.document.close();
      setTimeout(() => w.print(), 600);
    }
  };

  // Download slides HTML
  const downloadSlidesHtml = () => {
    const html = generateSlidesHtml(slides);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileName || "presentation"}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Update a slide field
  const updateSlide = (index: number, field: keyof Slide, value: any) => {
    setSlides(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s));
  };

  // Keyboard navigation for slides
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (editingSlide !== null) return; // don't nav while editing
      if (slides.length === 0) return;
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        setCurrentSlide(prev => Math.min(prev + 1, slides.length - 1));
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setCurrentSlide(prev => Math.max(prev - 1, 0));
      }
      if (e.key === "Escape" && isPresenting) {
        setIsPresenting(false);
        if (document.fullscreenElement) document.exitFullscreen();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [slides.length, isPresenting, editingSlide]);

  const startPresentation = async () => {
    setIsPresenting(true);
    try { await document.documentElement.requestFullscreen(); } catch {}
  };

  const exitPresentation = async () => {
    setIsPresenting(false);
    if (document.fullscreenElement) {
      try { await document.exitFullscreen(); } catch {}
    }
  };

  useEffect(() => {
    const handler = () => {
      if (!document.fullscreenElement && isPresenting) setIsPresenting(false);
    };
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, [isPresenting]);

  // ──── FULLSCREEN PRESENTATION ────
  if (isPresenting && slides.length > 0) {
    return (
      <div className="fixed inset-0 z-[9999] bg-[#0a0a0a] flex flex-col">
        <div className="flex-1 flex items-center justify-center overflow-hidden">
          <SlideRenderer slide={slides[currentSlide]} index={currentSlide} total={slides.length} fullscreen />
        </div>
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/60 backdrop-blur-xl rounded-full px-4 py-2 opacity-0 hover:opacity-100 transition-opacity duration-500">
          <button onClick={() => setCurrentSlide(p => Math.max(0, p - 1))} disabled={currentSlide === 0} className="p-1.5 rounded-full text-white/60 hover:text-white disabled:opacity-20 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-white/60 text-sm font-mono min-w-[60px] text-center">{currentSlide + 1} / {slides.length}</span>
          <button onClick={() => setCurrentSlide(p => Math.min(slides.length - 1, p + 1))} disabled={currentSlide === slides.length - 1} className="p-1.5 rounded-full text-white/60 hover:text-white disabled:opacity-20 transition-colors">
            <ChevronRight className="w-5 h-5" />
          </button>
          <div className="w-px h-4 bg-white/10" />
          <button onClick={exitPresentation} className="p-1.5 rounded-full text-white/60 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
        </div>
        {showNotes && slides[currentSlide]?.notes && (
          <div className="absolute bottom-20 left-1/2 -translate-x-1/2 max-w-lg bg-black/70 backdrop-blur-xl rounded-xl px-4 py-3 text-white/70 text-sm">
            {slides[currentSlide].notes}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4 animate-fade-in h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center border border-primary/10">
            <FileText className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground tracking-tight">Document Studio</h2>
            <p className="text-[11px] text-muted-foreground">Generate PDF & PPT with AI • Preview • Edit • Download</p>
          </div>
        </div>
        {mode !== "home" && (
          <button onClick={handleReset} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs bg-muted/50 border border-border/50 text-foreground/70 hover:bg-muted transition-colors">
            <RotateCcw className="w-3.5 h-3.5" /> New
          </button>
        )}
      </div>

      {error && <p className="text-destructive text-xs text-center">{error}</p>}

      {/* ─── HOME ─── */}
      {mode === "home" && (
        <div className="flex-1 flex flex-col gap-5">
          {/* AI Prompt Section */}
          <div className="rounded-2xl border border-border/30 bg-card/50 p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">Generate with AI</span>
            </div>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="Describe what you want to create... e.g. 'A business proposal for a mobile app startup' or 'Presentation about climate change solutions'"
              className="w-full bg-muted/30 border border-border/40 rounded-xl px-4 py-3 text-sm text-foreground outline-none focus:border-primary/40 transition-colors resize-none min-h-[80px]"
            />
            <div className="flex items-center gap-3">
              {/* Type toggle */}
              <div className="flex gap-1 bg-muted/30 rounded-xl p-1 border border-border/30">
                <button
                  onClick={() => setGenType("pdf")}
                  className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                    genType === "pdf" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <FileDown className="w-3.5 h-3.5" /> PDF Document
                </button>
                <button
                  onClick={() => setGenType("ppt")}
                  className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                    genType === "ppt" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Presentation className="w-3.5 h-3.5" /> Presentation
                </button>
              </div>

              {genType === "ppt" && (
                <div className="flex gap-1">
                  {["professional", "creative", "minimal", "bold"].map(s => (
                    <button
                      key={s}
                      onClick={() => setSlideStyle(s)}
                      className={cn("px-2.5 py-1 rounded-lg text-[10px] font-medium border transition-colors capitalize",
                        slideStyle === s ? "border-primary/30 bg-primary/10 text-primary" : "border-border/40 text-muted-foreground hover:bg-muted"
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              <button
                onClick={handlePromptGenerate}
                disabled={!prompt.trim() || generatingPdf || generatingSlides}
                className="ml-auto flex items-center gap-2 px-5 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-30 transition-opacity"
              >
                {(generatingPdf || generatingSlides) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                Generate
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border/30" />
            <span className="text-[11px] text-muted-foreground/50">or upload a file</span>
            <div className="flex-1 h-px bg-border/30" />
          </div>

          {/* File Upload */}
          <label className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-border/40 rounded-2xl cursor-pointer hover:border-primary/30 transition-colors py-12 gap-3">
            <input ref={fileRef} type="file" accept=".pdf,.txt,.md,.csv,.json,.xml,.html,.css,.js,.ts,.py,.java,.c,.cpp,.docx" onChange={handleFile} className="hidden" />
            {loading ? (
              <>
                <Loader2 className="w-8 h-8 animate-spin text-primary/40" />
                <p className="text-sm text-muted-foreground">Reading file...</p>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center border border-primary/10">
                  <Upload className="w-6 h-6 text-primary/30" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground/60">Upload a document</p>
                  <p className="text-xs text-muted-foreground/50 mt-0.5">PDF, TXT, MD, CSV, JSON, DOCX</p>
                </div>
              </>
            )}
          </label>
        </div>
      )}

      {/* ─── ANALYZE TAB (from file) ─── */}
      {mode === "analyze" && extractedText && (
        <>
          {/* Mode switcher */}
          <div className="flex gap-1 bg-muted/30 rounded-xl p-1 border border-border/30">
            <button onClick={() => setMode("analyze")} className={cn("flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[13px] font-medium transition-all", "bg-card text-foreground shadow-sm")}>
              <Wand2 className="w-3.5 h-3.5" /> Analyze
            </button>
            <button onClick={() => { setMode("slides"); if (slides.length === 0) handleGenerateSlides(); }} className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[13px] font-medium text-muted-foreground hover:text-foreground transition-all">
              <Presentation className="w-3.5 h-3.5" /> Slides
            </button>
            <button onClick={() => { setMode("pdf-preview"); if (!pdfContent) handleGeneratePdf(extractedText); }} className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[13px] font-medium text-muted-foreground hover:text-foreground transition-all">
              <FileDown className="w-3.5 h-3.5" /> PDF
            </button>
          </div>

          {!analysis && !analyzing && (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="bg-muted/20 border border-border/30 rounded-xl p-4 w-full">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 text-primary/60" />
                  <span className="text-sm font-medium text-foreground">{fileName}</span>
                  <span className="text-xs text-muted-foreground ml-auto">{extractedText.length.toLocaleString()} chars</span>
                </div>
                <pre className="text-xs text-muted-foreground max-h-32 overflow-y-auto whitespace-pre-wrap">{extractedText.slice(0, 500)}...</pre>
              </div>
              <button onClick={handleAnalyze} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
                <Wand2 className="w-4 h-4" /> Analyze Document
              </button>
            </div>
          )}

          {(analyzing || analysis) && (
            <div className="flex-1 overflow-y-auto rounded-xl bg-muted/10 border border-border/30 p-5 min-h-0">
              {analyzing && !analysis && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center py-8">
                  <Loader2 className="w-4 h-4 animate-spin" /> Analyzing document...
                </div>
              )}
              {analysis && (
                <div className="prose prose-sm max-w-none text-foreground dark:prose-invert">
                  <ReactMarkdown>{analysis}</ReactMarkdown>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ─── PDF PREVIEW ─── */}
      {mode === "pdf-preview" && (
        <div className="flex-1 flex flex-col min-h-0 gap-3">
          {generatingPdf ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4">
              <div className="relative">
                <Loader2 className="w-10 h-10 animate-spin text-primary/40" />
                <FileDown className="w-5 h-5 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>
              <p className="text-sm font-medium text-foreground/70">Generating document...</p>
            </div>
          ) : pdfContent ? (
            <>
              {/* Toolbar */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {editingPdf ? (
                    <input
                      value={pdfTitle}
                      onChange={e => setPdfTitle(e.target.value)}
                      className="text-sm font-medium bg-muted/30 border border-border/40 rounded-lg px-2 py-1 text-foreground outline-none focus:border-primary/40"
                    />
                  ) : (
                    <span className="text-sm font-medium text-foreground">{pdfTitle}</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setEditingPdf(!editingPdf)}
                    className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors",
                      editingPdf ? "border-primary/30 bg-primary/10 text-primary" : "border-border/50 text-foreground/70 hover:bg-muted"
                    )}
                  >
                    {editingPdf ? <><Check className="w-3.5 h-3.5" /> Done</> : <><Pencil className="w-3.5 h-3.5" /> Edit</>}
                  </button>
                  <button
                    onClick={downloadPdf}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity"
                  >
                    <Download className="w-3.5 h-3.5" /> Download PDF
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto rounded-xl bg-white dark:bg-[#1a1a1a] border border-border/30 shadow-lg min-h-0">
                {editingPdf ? (
                  <textarea
                    value={pdfContent}
                    onChange={e => setPdfContent(e.target.value)}
                    className="w-full h-full p-8 bg-transparent text-foreground text-sm outline-none resize-none font-mono leading-relaxed"
                  />
                ) : (
                  <div className="p-8 prose prose-sm max-w-none text-foreground dark:prose-invert">
                    <ReactMarkdown>{pdfContent}</ReactMarkdown>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm text-muted-foreground">No content generated yet.</p>
            </div>
          )}
        </div>
      )}

      {/* ─── SLIDES TAB ─── */}
      {mode === "slides" && (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Mode switcher when from file */}
          {extractedText && (
            <div className="flex gap-1 bg-muted/30 rounded-xl p-1 border border-border/30 mb-3">
              <button onClick={() => setMode("analyze")} className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[13px] font-medium text-muted-foreground hover:text-foreground transition-all">
                <Wand2 className="w-3.5 h-3.5" /> Analyze
              </button>
              <button onClick={() => setMode("slides")} className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[13px] font-medium bg-card text-foreground shadow-sm transition-all">
                <Presentation className="w-3.5 h-3.5" /> Slides
              </button>
              <button onClick={() => { setMode("pdf-preview"); if (!pdfContent) handleGeneratePdf(extractedText); }} className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[13px] font-medium text-muted-foreground hover:text-foreground transition-all">
                <FileDown className="w-3.5 h-3.5" /> PDF
              </button>
            </div>
          )}

          {generatingSlides ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4">
              <div className="relative">
                <Loader2 className="w-10 h-10 animate-spin text-primary/40" />
                <Presentation className="w-5 h-5 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>
              <p className="text-sm font-medium text-foreground/70">Generating slides...</p>
            </div>
          ) : slides.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-5">
              <Presentation className="w-12 h-12 text-primary/30" />
              <p className="text-sm text-muted-foreground">No slides yet. Generate from a prompt or file.</p>
            </div>
          ) : (
            <>
              {/* Toolbar */}
              <div className="flex items-center justify-between pb-2">
                <div className="flex items-center gap-1">
                  <button onClick={() => setShowGrid(g => !g)} className={cn("p-1.5 rounded-lg transition-colors", showGrid ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")} title="Grid view">
                    <Grid3X3 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setShowNotes(n => !n)} className={cn("p-1.5 rounded-lg transition-colors", showNotes ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")} title="Notes">
                    <StickyNote className="w-3.5 h-3.5" />
                  </button>
                </div>
                <span className="text-[11px] text-muted-foreground font-mono">{currentSlide + 1} / {slides.length}</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setEditingSlide(editingSlide === currentSlide ? null : currentSlide)}
                    className={cn("p-1.5 rounded-lg transition-colors", editingSlide === currentSlide ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}
                    title="Edit slide"
                  >
                    {editingSlide === currentSlide ? <Check className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
                  </button>
                  <button onClick={downloadSlidesHtml} className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors" title="Download">
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={startPresentation} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-[11px] font-medium hover:opacity-90 transition-opacity">
                    <Play className="w-3 h-3" /> Present
                  </button>
                  <button onClick={() => handleGenerateSlides()} className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors" title="Regenerate">
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {showGrid ? (
                <div className="flex-1 overflow-y-auto">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {slides.map((slide, i) => (
                      <button
                        key={i}
                        onClick={() => { setCurrentSlide(i); setShowGrid(false); }}
                        className={cn(
                          "rounded-xl border overflow-hidden transition-all hover:scale-[1.02] active:scale-[0.98]",
                          currentSlide === i ? "border-primary ring-2 ring-primary/20" : "border-border/30 hover:border-border"
                        )}
                      >
                        <div className="aspect-video">
                          <SlideRenderer slide={slide} index={i} total={slides.length} thumbnail />
                        </div>
                        <div className="px-2 py-1.5 bg-card text-[10px] text-muted-foreground text-left truncate">
                          {i + 1}. {slide.title}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col min-h-0 gap-2">
                  {/* Slide editor panel */}
                  {editingSlide === currentSlide && (
                    <div className="shrink-0 rounded-xl bg-muted/20 border border-border/30 p-4 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Title</label>
                          <input
                            value={slides[currentSlide].title}
                            onChange={e => updateSlide(currentSlide, "title", e.target.value)}
                            className="w-full bg-muted/30 border border-border/40 rounded-lg px-3 py-1.5 text-xs text-foreground outline-none focus:border-primary/40"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Subtitle</label>
                          <input
                            value={slides[currentSlide].subtitle}
                            onChange={e => updateSlide(currentSlide, "subtitle", e.target.value)}
                            className="w-full bg-muted/30 border border-border/40 rounded-lg px-3 py-1.5 text-xs text-foreground outline-none focus:border-primary/40"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Content (one bullet per line)</label>
                        <textarea
                          value={slides[currentSlide].content.join("\n")}
                          onChange={e => updateSlide(currentSlide, "content", e.target.value.split("\n"))}
                          className="w-full bg-muted/30 border border-border/40 rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-primary/40 resize-none min-h-[60px]"
                        />
                      </div>
                      <div className="flex gap-2">
                        <div>
                          <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Layout</label>
                          <select
                            value={slides[currentSlide].layout}
                            onChange={e => updateSlide(currentSlide, "layout", e.target.value)}
                            className="bg-muted/30 border border-border/40 rounded-lg px-2 py-1 text-xs text-foreground outline-none"
                          >
                            {["title", "content", "two-column", "quote", "stats"].map(l => (
                              <option key={l} value={l}>{l}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Color</label>
                          <div className="flex gap-1">
                            {Object.keys(ACCENT_COLORS).map(c => (
                              <button
                                key={c}
                                onClick={() => updateSlide(currentSlide, "accent", c)}
                                className={cn("w-5 h-5 rounded-full border-2 transition-all", ACCENT_COLORS[c].bg,
                                  slides[currentSlide].accent === c ? "border-foreground scale-110" : "border-transparent opacity-60 hover:opacity-100"
                                )}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex-1 flex items-center justify-center min-h-0">
                    <div className="relative w-full" style={{ maxWidth: "900px" }}>
                      <div className="aspect-video rounded-xl overflow-hidden border border-border/30 shadow-lg">
                        <SlideRenderer slide={slides[currentSlide]} index={currentSlide} total={slides.length} />
                      </div>
                      <button
                        onClick={() => setCurrentSlide(p => Math.max(0, p - 1))}
                        disabled={currentSlide === 0}
                        className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/30 text-white/70 hover:bg-black/50 hover:text-white disabled:opacity-0 transition-all backdrop-blur-sm"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => setCurrentSlide(p => Math.min(slides.length - 1, p + 1))}
                        disabled={currentSlide === slides.length - 1}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/30 text-white/70 hover:bg-black/50 hover:text-white disabled:opacity-0 transition-all backdrop-blur-sm"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Thumbnails */}
                  <div className="shrink-0 overflow-x-auto pb-1">
                    <div className="flex gap-2 px-1">
                      {slides.map((slide, i) => (
                        <button
                          key={i}
                          onClick={() => { setCurrentSlide(i); setEditingSlide(null); }}
                          className={cn(
                            "shrink-0 w-24 rounded-lg overflow-hidden border transition-all",
                            currentSlide === i ? "border-primary ring-2 ring-primary/20 scale-105" : "border-border/30 opacity-60 hover:opacity-100"
                          )}
                        >
                          <div className="aspect-video">
                            <SlideRenderer slide={slide} index={i} total={slides.length} thumbnail />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {showNotes && slides[currentSlide]?.notes && (
                    <div className="shrink-0 rounded-xl bg-muted/20 border border-border/30 p-3">
                      <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider mb-1">Presenter Notes</p>
                      <p className="text-xs text-foreground/70">{slides[currentSlide].notes}</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ──── SLIDE RENDERER ────
function SlideRenderer({ slide, index, total, fullscreen, thumbnail }: {
  slide: Slide; index: number; total: number; fullscreen?: boolean; thumbnail?: boolean;
}) {
  const accent = ACCENT_COLORS[slide.accent] || ACCENT_COLORS.blue;
  const textScale = thumbnail ? "text-[6px]" : fullscreen ? "text-base" : "text-[11px]";
  const titleScale = thumbnail ? "text-[8px]" : fullscreen ? "text-4xl" : "text-lg";
  const subScale = thumbnail ? "text-[5px]" : fullscreen ? "text-xl" : "text-xs";
  const padScale = thumbnail ? "p-2" : fullscreen ? "p-16" : "p-6";

  if (slide.layout === "title") {
    return (
      <div className={cn("w-full h-full flex flex-col items-center justify-center bg-gradient-to-br", accent.gradient, padScale, "text-white relative overflow-hidden")}>
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 20% 80%, white 0%, transparent 50%), radial-gradient(circle at 80% 20%, white 0%, transparent 50%)" }} />
        <h1 className={cn(titleScale, "font-bold text-center relative z-10 leading-tight")}>{slide.title}</h1>
        {slide.subtitle && <p className={cn(subScale, "mt-2 text-white/70 text-center relative z-10")}>{slide.subtitle}</p>}
        {!thumbnail && <p className={cn("absolute bottom-3 right-4 text-white/30 text-[9px] font-mono")}>{index + 1}</p>}
      </div>
    );
  }

  if (slide.layout === "quote") {
    return (
      <div className={cn("w-full h-full flex flex-col items-center justify-center bg-[#111] relative", padScale)}>
        <div className={cn("absolute top-4 left-6 font-serif opacity-10", thumbnail ? "text-xl" : fullscreen ? "text-[120px]" : "text-5xl", accent.text)}>"</div>
        <blockquote className={cn("text-center text-white/90 font-medium italic max-w-[80%] relative z-10 leading-relaxed", thumbnail ? "text-[7px]" : fullscreen ? "text-2xl" : "text-sm")}>
          {slide.content[0]}
        </blockquote>
        {slide.content[1] && <p className={cn("mt-3 text-white/40", textScale)}>— {slide.content[1]}</p>}
        {!thumbnail && <p className={cn("absolute bottom-3 right-4 text-white/20 font-mono text-[9px]")}>{index + 1} / {total}</p>}
      </div>
    );
  }

  if (slide.layout === "stats") {
    return (
      <div className={cn("w-full h-full flex flex-col bg-[#0c0c0c] text-white", padScale)}>
        <h2 className={cn(titleScale, "font-bold mb-1")}>{slide.title}</h2>
        {slide.subtitle && <p className={cn(subScale, "text-white/40 mb-3")}>{slide.subtitle}</p>}
        <div className={cn("flex-1 grid gap-2", slide.content.length <= 3 ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-3")}>
          {slide.content.map((item, i) => {
            const [label, value] = item.includes(":") ? item.split(":").map(s => s.trim()) : [item, ""];
            return (
              <div key={i} className={cn("rounded-lg bg-white/5 flex flex-col items-center justify-center", thumbnail ? "p-1" : "p-3")}>
                {value && <span className={cn("font-bold", accent.text, thumbnail ? "text-[8px]" : fullscreen ? "text-3xl" : "text-base")}>{value}</span>}
                <span className={cn("text-white/50 text-center", thumbnail ? "text-[5px]" : fullscreen ? "text-sm" : "text-[9px]")}>{label}</span>
              </div>
            );
          })}
        </div>
        {!thumbnail && <p className="text-right text-white/20 font-mono mt-2 text-[9px]">{index + 1} / {total}</p>}
      </div>
    );
  }

  if (slide.layout === "two-column") {
    const left = slide.content.filter((_, i) => i % 2 === 0);
    const right = slide.content.filter((_, i) => i % 2 === 1);
    return (
      <div className={cn("w-full h-full flex flex-col bg-[#0c0c0c] text-white", padScale)}>
        <h2 className={cn(titleScale, "font-bold mb-1")}>{slide.title}</h2>
        {slide.subtitle && <p className={cn(subScale, "text-white/40 mb-3")}>{slide.subtitle}</p>}
        <div className="flex-1 grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            {left.map((item, i) => (
              <div key={i} className="flex items-start gap-1.5">
                <div className={cn("w-1 h-1 rounded-full mt-1 shrink-0", accent.bg)} />
                <span className={cn(textScale, "text-white/80 leading-snug")}>{item}</span>
              </div>
            ))}
          </div>
          <div className="space-y-1.5">
            {right.map((item, i) => (
              <div key={i} className="flex items-start gap-1.5">
                <div className={cn("w-1 h-1 rounded-full mt-1 shrink-0", accent.bg)} />
                <span className={cn(textScale, "text-white/80 leading-snug")}>{item}</span>
              </div>
            ))}
          </div>
        </div>
        {!thumbnail && <p className="text-right text-white/20 font-mono mt-2 text-[9px]">{index + 1} / {total}</p>}
      </div>
    );
  }

  // Default "content" layout
  return (
    <div className={cn("w-full h-full flex flex-col bg-[#0c0c0c] text-white", padScale)}>
      <h2 className={cn(titleScale, "font-bold")}>{slide.title}</h2>
      {slide.subtitle && <p className={cn(subScale, "text-white/40 mt-0.5 mb-2")}>{slide.subtitle}</p>}
      <div className="flex-1 flex flex-col justify-center space-y-1.5">
        {slide.content.map((item, i) => (
          <div key={i} className="flex items-start gap-2">
            <div className={cn("w-1.5 h-1.5 rounded-full mt-1 shrink-0", accent.bg)} />
            <span className={cn(textScale, "text-white/80 leading-snug")}>{item}</span>
          </div>
        ))}
      </div>
      {!thumbnail && (
        <div className="flex items-center justify-between mt-2">
          <div className={cn("h-0.5 w-8 rounded-full", accent.bg, "opacity-40")} />
          <p className="text-white/20 font-mono text-[9px]">{index + 1} / {total}</p>
        </div>
      )}
    </div>
  );
}

// Generate PDF-ready HTML
function generatePdfHtml(title: string, content: string): string {
  // Convert markdown to basic HTML
  const htmlBody = content
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/gim, '<em>$1</em>')
    .replace(/^- (.*$)/gim, '<li>$1</li>')
    .replace(/^(\d+)\. (.*$)/gim, '<li>$2</li>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${title}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Inter', sans-serif; max-width: 800px; margin: 0 auto; padding: 60px 40px; color: #1a1a1a; line-height: 1.8; font-size: 14px; }
h1 { font-size: 28px; font-weight: 700; margin: 24px 0 16px; color: #111; border-bottom: 2px solid #e5e5e5; padding-bottom: 8px; }
h2 { font-size: 22px; font-weight: 600; margin: 20px 0 12px; color: #222; }
h3 { font-size: 18px; font-weight: 600; margin: 16px 0 8px; color: #333; }
p { margin-bottom: 12px; text-align: justify; }
li { margin-left: 24px; margin-bottom: 6px; }
strong { font-weight: 600; }
em { font-style: italic; }
.header { text-align: center; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 3px solid #111; }
.header h1 { border: none; font-size: 32px; }
.footer { margin-top: 60px; padding-top: 16px; border-top: 1px solid #ddd; text-align: center; font-size: 11px; color: #999; }
@media print { body { padding: 20px; } .footer { position: fixed; bottom: 20px; left: 0; right: 0; } }
</style>
</head>
<body>
<div class="header"><h1>${title}</h1><p style="color:#666;font-size:12px">Generated on ${new Date().toLocaleDateString()}</p></div>
<p>${htmlBody}</p>
<div class="footer">Generated by Document Studio</div>
</body>
</html>`;
}

// Generate downloadable slides HTML
function generateSlidesHtml(slides: Slide[]): string {
  const slidesJson = JSON.stringify(slides);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Presentation</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Inter,system-ui,sans-serif;background:#0a0a0a;color:#fff;overflow:hidden;height:100vh}
.slide{width:100vw;height:100vh;display:none;flex-direction:column;align-items:center;justify-content:center;padding:5vw}
.slide.active{display:flex}
.slide h1{font-size:5vw;font-weight:700;text-align:center;line-height:1.2}
.slide h2{font-size:3vw;font-weight:700;margin-bottom:1vw}
.slide p{font-size:1.8vw;opacity:.7;margin-top:1vw}
.slide .bullet{display:flex;align-items:flex-start;gap:1vw;margin:0.8vw 0;font-size:1.6vw;opacity:.85}
.slide .dot{width:0.8vw;height:0.8vw;border-radius:50%;margin-top:0.5vw;flex-shrink:0}
.nav{position:fixed;bottom:2vh;left:50%;transform:translateX(-50%);display:flex;gap:1vw;background:rgba(0,0,0,.6);padding:0.8vw 2vw;border-radius:999px;backdrop-filter:blur(10px);opacity:0;transition:opacity .3s}
body:hover .nav{opacity:1}
.nav button{background:none;border:none;color:rgba(255,255,255,.5);font-size:2vw;cursor:pointer;padding:0.5vw}
.nav button:hover{color:#fff}
.nav span{color:rgba(255,255,255,.4);font-size:1.2vw;display:flex;align-items:center;font-family:monospace}
</style>
</head>
<body>
<div id="slides"></div>
<div class="nav">
<button onclick="go(-1)">◀</button>
<span id="counter"></span>
<button onclick="go(1)">▶</button>
</div>
<script>
const slides=${slidesJson};
const colors={blue:'#3b82f6',purple:'#8b5cf6',green:'#10b981',orange:'#f97316',red:'#ef4444',teal:'#14b8a6'};
let cur=0;
const container=document.getElementById('slides');
slides.forEach((s,i)=>{
const d=document.createElement('div');
d.className='slide'+(i===0?' active':'');
const c=colors[s.accent]||colors.blue;
if(s.layout==='title'){
d.style.background='linear-gradient(135deg,'+c+','+c+'88)';
d.innerHTML='<h1>'+s.title+'</h1>'+(s.subtitle?'<p>'+s.subtitle+'</p>':'');
}else if(s.layout==='quote'){
d.innerHTML='<div style="font-size:10vw;opacity:.1;color:'+c+';position:absolute;top:5%;left:5%">"</div><blockquote style="font-size:2.5vw;font-style:italic;max-width:70%;text-align:center;line-height:1.6">'+s.content[0]+'</blockquote>'+(s.content[1]?'<p style="margin-top:2vw;opacity:.4">— '+s.content[1]+'</p>':'');
}else{
let html='<h2>'+s.title+'</h2>';
s.content.forEach(item=>{html+='<div class="bullet"><div class="dot" style="background:'+c+'"></div><span>'+item+'</span></div>';});
d.innerHTML=html;d.style.alignItems='flex-start';
}
container.appendChild(d);
});
function show(){
document.querySelectorAll('.slide').forEach((s,i)=>s.classList.toggle('active',i===cur));
document.getElementById('counter').textContent=(cur+1)+' / '+slides.length;
}
function go(d){cur=Math.max(0,Math.min(slides.length-1,cur+d));show();}
document.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key===' ')go(1);if(e.key==='ArrowLeft')go(-1);});
show();
</script>
</body>
</html>`;
}
