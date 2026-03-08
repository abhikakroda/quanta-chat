import { useState, useRef, useEffect, useCallback } from "react";
import {
  FileText, Loader2, Upload, RotateCcw, Wand2, Presentation, ChevronLeft, ChevronRight,
  Maximize2, Minimize2, Download, X, Grid3X3, StickyNote, Play
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

type Tab = "analyze" | "slides";

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
  const [tab, setTab] = useState<Tab>("analyze");
  const fileRef = useRef<HTMLInputElement>(null);

  // Slide state
  const [slides, setSlides] = useState<Slide[]>([]);
  const [generatingSlides, setGeneratingSlides] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPresenting, setIsPresenting] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [slideStyle, setSlideStyle] = useState("professional");

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError("");
    setAnalysis("");
    setExtractedText("");
    setSlides([]);
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
    } catch (err: any) {
      setError(err.message || "Failed to read file");
    } finally {
      setLoading(false);
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

  const handleGenerateSlides = async () => {
    if (!extractedText || generatingSlides) return;
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
          documentText: extractedText,
          fileName,
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
        setTab("slides");
      } else {
        throw new Error("Invalid slide data");
      }
    } catch (err: any) {
      setError(err.message || "Slide generation failed");
    } finally {
      setGeneratingSlides(false);
    }
  };

  const handleReset = () => {
    setFileName(""); setExtractedText(""); setAnalysis(""); setError("");
    setSlides([]); setCurrentSlide(0); setTab("analyze");
    if (fileRef.current) fileRef.current.value = "";
  };

  // Keyboard navigation for slides
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
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
      if (e.key === "Home") setCurrentSlide(0);
      if (e.key === "End") setCurrentSlide(slides.length - 1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [slides.length, isPresenting]);

  const startPresentation = async () => {
    setIsPresenting(true);
    try {
      await document.documentElement.requestFullscreen();
    } catch { /* fullscreen not supported */ }
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

  // ──── FULLSCREEN PRESENTATION ────
  if (isPresenting && slides.length > 0) {
    return (
      <div className="fixed inset-0 z-[9999] bg-[#0a0a0a] flex flex-col">
        <div className="flex-1 flex items-center justify-center overflow-hidden">
          <SlideRenderer slide={slides[currentSlide]} index={currentSlide} total={slides.length} fullscreen />
        </div>
        {/* Nav */}
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
        {/* Notes */}
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
            <p className="text-[11px] text-muted-foreground">Analyze docs & generate presentations</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {extractedText && (
            <button onClick={handleReset} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs bg-muted/50 border border-border/50 text-foreground/70 hover:bg-muted transition-colors">
              <RotateCcw className="w-3.5 h-3.5" /> New
            </button>
          )}
        </div>
      </div>

      {/* Tabs when we have content */}
      {extractedText && (
        <div className="flex gap-1 bg-muted/30 rounded-xl p-1 border border-border/30">
          <button
            onClick={() => setTab("analyze")}
            className={cn("flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[13px] font-medium transition-all",
              tab === "analyze" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Wand2 className="w-3.5 h-3.5" /> Analyze
          </button>
          <button
            onClick={() => setTab("slides")}
            className={cn("flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[13px] font-medium transition-all",
              tab === "slides" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Presentation className="w-3.5 h-3.5" /> Slides
            {slides.length > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">{slides.length}</span>}
          </button>
        </div>
      )}

      {/* Upload area */}
      {!extractedText && (
        <label className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-border/40 rounded-2xl cursor-pointer hover:border-primary/30 transition-colors py-16 gap-4">
          <input ref={fileRef} type="file" accept=".pdf,.txt,.md,.csv,.json,.xml,.html,.css,.js,.ts,.py,.java,.c,.cpp,.docx" onChange={handleFile} className="hidden" />
          {loading ? (
            <>
              <Loader2 className="w-10 h-10 animate-spin text-primary/40" />
              <p className="text-sm text-muted-foreground">Reading file...</p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center border border-primary/10">
                <Upload className="w-8 h-8 text-primary/30" />
              </div>
              <div className="text-center">
                <p className="text-[15px] font-medium text-foreground/60">Upload a document</p>
                <p className="text-xs text-muted-foreground/50 mt-1">PDF, TXT, MD, CSV, JSON, and more</p>
              </div>
            </>
          )}
        </label>
      )}

      {error && <p className="text-destructive text-xs text-center">{error}</p>}

      {/* ─── ANALYZE TAB ─── */}
      {tab === "analyze" && extractedText && (
        <>
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
              <div className="flex gap-2">
                <button onClick={handleAnalyze} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
                  <Wand2 className="w-4 h-4" /> Analyze Document
                </button>
                <button onClick={() => { setTab("slides"); if (slides.length === 0) handleGenerateSlides(); }} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-muted border border-border/50 text-foreground text-sm font-medium hover:bg-muted/80 transition-colors">
                  <Presentation className="w-4 h-4" /> Generate Slides
                </button>
              </div>
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
              {analysis && !analyzing && (
                <div className="mt-4 pt-4 border-t border-border/30 flex justify-center">
                  <button onClick={() => { setTab("slides"); if (slides.length === 0) handleGenerateSlides(); }} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
                    <Presentation className="w-4 h-4" /> Generate Slides from this
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ─── SLIDES TAB ─── */}
      {tab === "slides" && extractedText && (
        <div className="flex-1 flex flex-col min-h-0">
          {generatingSlides ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4">
              <div className="relative">
                <Loader2 className="w-10 h-10 animate-spin text-primary/40" />
                <Presentation className="w-5 h-5 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-foreground/70">Generating slides...</p>
                <p className="text-xs text-muted-foreground mt-1">AI is creating your presentation</p>
              </div>
            </div>
          ) : slides.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-5">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center border border-primary/10">
                <Presentation className="w-8 h-8 text-primary/40" />
              </div>
              <div className="text-center">
                <p className="text-[15px] font-medium text-foreground/70">Generate a slide deck</p>
                <p className="text-xs text-muted-foreground mt-1">AI will create slides from your document</p>
              </div>
              {/* Style picker */}
              <div className="flex gap-2">
                {["professional", "creative", "minimal", "bold"].map(s => (
                  <button
                    key={s}
                    onClick={() => setSlideStyle(s)}
                    className={cn("px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors capitalize",
                      slideStyle === s ? "border-primary/30 bg-primary/10 text-primary" : "border-border/40 text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <button onClick={handleGenerateSlides} className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
                <Wand2 className="w-4 h-4" /> Generate Slides
              </button>
            </div>
          ) : (
            /* Slide editor view */
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
                  <button onClick={downloadSlidesHtml} className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors" title="Download">
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={startPresentation} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-[11px] font-medium hover:opacity-90 transition-opacity">
                    <Play className="w-3 h-3" /> Present
                  </button>
                  <button onClick={handleGenerateSlides} className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors" title="Regenerate">
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {showGrid ? (
                /* Grid view */
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
                /* Single slide view */
                <div className="flex-1 flex flex-col min-h-0 gap-2">
                  <div className="flex-1 flex items-center justify-center min-h-0">
                    <div className="relative w-full" style={{ maxWidth: "900px" }}>
                      <div className="aspect-video rounded-xl overflow-hidden border border-border/30 shadow-lg">
                        <SlideRenderer slide={slides[currentSlide]} index={currentSlide} total={slides.length} />
                      </div>
                      {/* Nav arrows */}
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

                  {/* Slide thumbnails strip */}
                  <div className="shrink-0 overflow-x-auto pb-1">
                    <div className="flex gap-2 px-1">
                      {slides.map((slide, i) => (
                        <button
                          key={i}
                          onClick={() => setCurrentSlide(i)}
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

                  {/* Notes panel */}
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
  slide: Slide;
  index: number;
  total: number;
  fullscreen?: boolean;
  thumbnail?: boolean;
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
        {!thumbnail && <p className={cn("absolute bottom-3 right-4 text-white/30", thumbnail ? "text-[4px]" : "text-[9px]", "font-mono")}>{index + 1}</p>}
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
        {slide.content[1] && (
          <p className={cn("mt-3 text-white/40", textScale)}>— {slide.content[1]}</p>
        )}
        {!thumbnail && <p className={cn("absolute bottom-3 right-4 text-white/20 font-mono", thumbnail ? "text-[4px]" : "text-[9px]")}>{index + 1} / {total}</p>}
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
        {!thumbnail && <p className={cn("text-right text-white/20 font-mono mt-2", "text-[9px]")}>{index + 1} / {total}</p>}
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
        {!thumbnail && <p className={cn("text-right text-white/20 font-mono mt-2", "text-[9px]")}>{index + 1} / {total}</p>}
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
          <p className={cn("text-white/20 font-mono", "text-[9px]")}>{index + 1} / {total}</p>
        </div>
      )}
    </div>
  );
}

// Generate downloadable HTML with all slides
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
