import { useState, useRef } from "react";
import { Sparkles, Paperclip, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import * as pdfjsLib from "pdfjs-dist";
import ReactMarkdown from "react-markdown";

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export default function SummarizerTool() {
  const [input, setInput] = useState("");
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const readFile = async (file: File): Promise<string> => {
    if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const pages: string[] = [];
      for (let i = 1; i <= Math.min(pdf.numPages, 50); i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        pages.push(textContent.items.map((item: any) => item.str).join(" "));
      }
      return pages.join("\n\n");
    }
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve("");
      reader.readAsText(file);
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const content = await readFile(file);
    setInput(content.slice(0, 15000));
    e.target.value = "";
  };

  const handleSummarize = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setError("");
    setSummary("");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            messages: [
              { role: "user", content: `Please provide a clear, concise summary of the following text. Include key points, main arguments, and important details in bullet points:\n\n${input}` },
            ],
            model: "mistral",
            enableThinking: false,
            skillPrompt: "You are a summarization expert. Condense texts into clear, well-structured summaries. Use bullet points for key findings. Be concise but preserve all critical information.",
          }),
        }
      );

      if (!resp.ok) throw new Error("Summarization failed");

      const reader = resp.body?.getReader();
      if (!reader) throw new Error("No response");

      const decoder = new TextDecoder();
      let buffer = "";
      let fullSummary = "";

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
              fullSummary += content;
              setSummary(fullSummary);
            }
          } catch { /* partial */ }
        }
      }
    } catch (err: any) {
      setError(err.message || "Summarization failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4 animate-fade-in">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">Summarizer</h2>
      </div>

      {/* File upload */}
      <div className="flex items-center gap-2">
        <input ref={fileRef} type="file" accept=".txt,.md,.pdf,.csv,.json,.html" className="hidden" onChange={handleFileUpload} />
        <button
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border hover:bg-accent text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <Paperclip className="w-4 h-4" />
          {fileName || "Upload a file"}
        </button>
        <span className="text-xs text-muted-foreground">or paste text below</span>
      </div>

      {/* Input */}
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Paste or type the text you want to summarize..."
        className="w-full bg-muted/50 border border-border rounded-2xl outline-none text-sm text-foreground p-4 min-h-[160px] resize-none focus:border-primary/30 transition-colors"
      />

      <div className="flex items-center gap-3">
        <button
          onClick={handleSummarize}
          disabled={!input.trim() || loading}
          className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-30 transition-opacity"
        >
          {loading ? (
            <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Summarizing...</span>
          ) : "Summarize"}
        </button>
        {input.length > 0 && (
          <span className="text-xs text-muted-foreground">{input.length.toLocaleString()} chars</span>
        )}
      </div>

      {/* Output */}
      {error && <p className="text-destructive text-sm">{error}</p>}
      {summary && (
        <div className="bg-muted/30 border border-border rounded-2xl p-4">
          <div className="prose prose-sm max-w-none text-foreground">
            <ReactMarkdown>{summary}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
