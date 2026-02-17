import { useState } from "react";
import { Languages, ArrowRightLeft, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const LANGUAGES = [
  { code: "auto", label: "Auto Detect" },
  { code: "en-IN", label: "English" },
  { code: "hi-IN", label: "Hindi" },
  { code: "bn-IN", label: "Bengali" },
  { code: "ta-IN", label: "Tamil" },
  { code: "te-IN", label: "Telugu" },
  { code: "mr-IN", label: "Marathi" },
  { code: "gu-IN", label: "Gujarati" },
  { code: "kn-IN", label: "Kannada" },
  { code: "ml-IN", label: "Malayalam" },
  { code: "pa-IN", label: "Punjabi" },
  { code: "od-IN", label: "Odia" },
];

export default function TranslatorTool() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [sourceLang, setSourceLang] = useState("auto");
  const [targetLang, setTargetLang] = useState("hi-IN");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleTranslate = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setError("");
    setOutput("");

    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sarvam-translate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ text: input, sourceLang, targetLang }),
        }
      );

      if (!resp.ok) throw new Error("Translation failed");
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      setOutput(data.translatedText || "No translation returned");
    } catch (err: any) {
      setError(err.message || "Translation failed");
    } finally {
      setLoading(false);
    }
  };

  const swapLanguages = () => {
    if (sourceLang === "auto") return;
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
    setInput(output);
    setOutput(input);
  };

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4 animate-fade-in">
      <div className="flex items-center gap-2 mb-2">
        <Languages className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">Sarvam AI Translator</h2>
      </div>

      {/* Language selectors */}
      <div className="flex items-center gap-2">
        <select
          value={sourceLang}
          onChange={(e) => setSourceLang(e.target.value)}
          className="flex-1 bg-muted border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary/30 transition-colors"
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>{l.label}</option>
          ))}
        </select>

        <button
          onClick={swapLanguages}
          disabled={sourceLang === "auto"}
          className="p-2 rounded-xl border border-border hover:bg-accent text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
        >
          <ArrowRightLeft className="w-4 h-4" />
        </button>

        <select
          value={targetLang}
          onChange={(e) => setTargetLang(e.target.value)}
          className="flex-1 bg-muted border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary/30 transition-colors"
        >
          {LANGUAGES.filter((l) => l.code !== "auto").map((l) => (
            <option key={l.code} value={l.code}>{l.label}</option>
          ))}
        </select>
      </div>

      {/* Input/Output */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Enter text to translate..."
          className="w-full bg-muted/50 border border-border rounded-2xl outline-none text-sm text-foreground p-4 min-h-[140px] resize-none focus:border-primary/30 transition-colors"
        />
        <div className="w-full bg-muted/30 border border-border rounded-2xl p-4 min-h-[140px] text-sm text-foreground">
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Translating...
            </div>
          ) : error ? (
            <p className="text-destructive text-sm">{error}</p>
          ) : output ? (
            <p className="whitespace-pre-wrap">{output}</p>
          ) : (
            <p className="text-muted-foreground/40">Translation will appear here</p>
          )}
        </div>
      </div>

      <button
        onClick={handleTranslate}
        disabled={!input.trim() || loading}
        className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-30 transition-opacity"
      >
        {loading ? "Translating..." : "Translate"}
      </button>
    </div>
  );
}
