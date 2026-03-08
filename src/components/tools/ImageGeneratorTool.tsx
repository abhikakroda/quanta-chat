import { useState, useEffect } from "react";
import { ImageIcon, Loader2, Download, RotateCcw, Wand2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

function ImageProgress() {
  const [elapsed, setElapsed] = useState(0);
  const STEPS = [
    { at: 0, label: "Initializing AI model…" },
    { at: 3, label: "Interpreting your prompt…" },
    { at: 6, label: "Generating image…" },
    { at: 12, label: "Refining details…" },
    { at: 20, label: "Almost there…" },
  ];

  useEffect(() => {
    const interval = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const currentStep = [...STEPS].reverse().find((s) => elapsed >= s.at) || STEPS[0];
  const progress = Math.min((elapsed / 30) * 100, 95);

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 py-12">
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 rounded-full border-2 border-primary/10" />
        <svg className="absolute inset-0 w-16 h-16 -rotate-90" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="28" fill="none" stroke="hsl(var(--primary))" strokeWidth="2.5" strokeLinecap="round"
            strokeDasharray={`${progress * 1.76} 176`} className="transition-all duration-1000 ease-out" opacity="0.6" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <Wand2 className="w-6 h-6 text-primary/50 animate-pulse" />
        </div>
      </div>
      <div className="text-center space-y-1">
        <p className="text-sm text-foreground/70 font-medium">{currentStep.label}</p>
        <p className="text-[11px] text-muted-foreground/50">{elapsed}s elapsed</p>
      </div>
    </div>
  );
}

export default function ImageGeneratorTool() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  const handleGenerate = async () => {
    const text = prompt.trim();
    if (!text || loading) return;

    setLoading(true);
    setError("");
    setImageUrl(null);
    setDescription("");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-image`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ prompt: text }),
      });

      const data = await resp.json();
      if (!resp.ok || !data.success) throw new Error(data.error || "Generation failed");

      if (data.images && data.images.length > 0) {
        setImageUrl(data.images[0].image_url?.url || null);
      }
      setDescription(data.text || "");
    } catch (err: any) {
      setError(err.message || "Failed to generate image");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!imageUrl) return;
    const a = document.createElement("a");
    a.href = imageUrl;
    a.download = `opentropic-image-${Date.now()}.png`;
    a.click();
  };

  const handleReset = () => {
    setPrompt("");
    setImageUrl(null);
    setDescription("");
    setError("");
  };

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4 animate-fade-in h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
            <Wand2 className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground tracking-tight">Image Generator</h2>
            <p className="text-[11px] text-muted-foreground">AI-powered image creation</p>
          </div>
        </div>
        {imageUrl && (
          <button onClick={handleReset} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs bg-muted/50 border border-border/50 text-foreground/70 hover:bg-muted transition-colors">
            <RotateCcw className="w-3.5 h-3.5" />
            New Image
          </button>
        )}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
          placeholder="Describe the image you want to create..."
          className="flex-1 bg-muted/30 border border-border/40 rounded-xl px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:ring-1 focus:ring-primary/20 transition-all"
        />
        <button
          onClick={handleGenerate}
          disabled={!prompt.trim() || loading}
          className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-30 transition-opacity shrink-0"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Generate"}
        </button>
      </div>

      {error && <p className="text-destructive text-xs text-center">{error}</p>}

      {loading && <ImageProgress />}

      {imageUrl && !loading && (
        <div className="flex-1 flex flex-col items-center gap-4 min-h-0">
          <div className="relative rounded-2xl overflow-hidden border border-border/30 bg-muted/10 max-h-[60vh]">
            <img src={imageUrl} alt={prompt} className="max-w-full max-h-[60vh] object-contain" />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleDownload} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
              <Download className="w-3.5 h-3.5" />
              Download
            </button>
          </div>
          {description && (
            <p className="text-xs text-muted-foreground text-center max-w-md">{description}</p>
          )}
        </div>
      )}

      {!imageUrl && !loading && (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-12 space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-primary/5 flex items-center justify-center">
            <ImageIcon className="w-7 h-7 text-primary/30" />
          </div>
          <p className="text-sm text-foreground/60">Describe what you want to generate</p>
          <p className="text-xs text-muted-foreground/50">Powered by AI image generation</p>
        </div>
      )}
    </div>
  );
}
