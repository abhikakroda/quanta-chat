import { useState, useRef } from "react";
import { FileText, Loader2, Upload, RotateCcw, Wand2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import * as pdfjsLib from "pdfjs-dist";

// @ts-ignore
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export default function DocAnalyzerTool() {
  const [fileName, setFileName] = useState("");
  const [extractedText, setExtractedText] = useState("");
  const [analysis, setAnalysis] = useState("");
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setError("");
    setAnalysis("");
    setExtractedText("");
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
        // Text-based files
        const text = await file.text();
        setExtractedText(text);
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
          messages: [{
            role: "user",
            content: `Analyze this document comprehensively. Provide:
1. **Summary** - A concise overview
2. **Key Points** - Main arguments or findings
3. **Structure** - How the document is organized
4. **Important Details** - Critical data, quotes, or facts
5. **Conclusions** - Main takeaways

Document: "${fileName}"

Content:
${extractedText.slice(0, 12000)}`,
          }],
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
              // Strip thinking tags
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

  const handleReset = () => {
    setFileName("");
    setExtractedText("");
    setAnalysis("");
    setError("");
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4 animate-fade-in h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
            <FileText className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground tracking-tight">Document Analyzer</h2>
            <p className="text-[11px] text-muted-foreground">Upload & analyze PDFs and documents</p>
          </div>
        </div>
        {extractedText && (
          <button onClick={handleReset} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs bg-muted/50 border border-border/50 text-foreground/70 hover:bg-muted transition-colors">
            <RotateCcw className="w-3.5 h-3.5" />
            New File
          </button>
        )}
      </div>

      {!extractedText && (
        <label className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-border/40 rounded-2xl cursor-pointer hover:border-primary/30 transition-colors py-16 gap-4">
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.txt,.md,.csv,.json,.xml,.html,.css,.js,.ts,.py,.java,.c,.cpp"
            onChange={handleFile}
            className="hidden"
          />
          {loading ? (
            <>
              <Loader2 className="w-10 h-10 animate-spin text-primary/40" />
              <p className="text-sm text-muted-foreground">Reading file...</p>
            </>
          ) : (
            <>
              <div className="w-14 h-14 rounded-2xl bg-primary/5 flex items-center justify-center">
                <Upload className="w-7 h-7 text-primary/30" />
              </div>
              <div className="text-center">
                <p className="text-sm text-foreground/60">Click to upload a document</p>
                <p className="text-xs text-muted-foreground/50 mt-1">PDF, TXT, MD, CSV, JSON, and more</p>
              </div>
            </>
          )}
        </label>
      )}

      {error && <p className="text-destructive text-xs text-center">{error}</p>}

      {extractedText && !analysis && !analyzing && (
        <div className="flex flex-col items-center gap-4 py-8">
          <div className="bg-muted/20 border border-border/30 rounded-xl p-4 w-full">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-primary/60" />
              <span className="text-sm font-medium text-foreground">{fileName}</span>
              <span className="text-xs text-muted-foreground ml-auto">{extractedText.length.toLocaleString()} chars</span>
            </div>
            <pre className="text-xs text-muted-foreground max-h-32 overflow-y-auto whitespace-pre-wrap">{extractedText.slice(0, 500)}...</pre>
          </div>
          <button
            onClick={handleAnalyze}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
          >
            <Wand2 className="w-4 h-4" />
            Analyze Document
          </button>
        </div>
      )}

      {(analyzing || analysis) && (
        <div className="flex-1 overflow-y-auto rounded-xl bg-muted/10 border border-border/30 p-5 min-h-0">
          {analyzing && !analysis && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center py-8">
              <Loader2 className="w-4 h-4 animate-spin" />
              Analyzing document...
            </div>
          )}
          {analysis && (
            <div className="prose prose-sm max-w-none text-foreground dark:prose-invert">
              <ReactMarkdown>{analysis}</ReactMarkdown>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
