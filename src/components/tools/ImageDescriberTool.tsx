import { useState, useRef } from "react";
import { Image, Loader2, Upload } from "lucide-react";
import ReactMarkdown from "react-markdown";

export default function ImageDescriberTool() {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState("image/png");
  const [description, setDescription] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMimeType(file.type || "image/png");
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setImagePreview(dataUrl);
      setImageBase64(dataUrl.split(",")[1]);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleDescribe = async () => {
    if (!imageBase64) return;
    setLoading(true);
    setError("");
    setDescription("");

    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/describe-image`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ imageBase64, mimeType, prompt: customPrompt || "Describe this image in detail. Include objects, colors, text, people, composition, and mood." }),
      });

      if (!resp.ok) throw new Error("Description failed");
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      setDescription(data.description);
    } catch (err: any) {
      setError(err.message || "Failed to describe image");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4 animate-fade-in">
      <div className="flex items-center gap-2 mb-2">
        <Image className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">Image Describer</h2>
        <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-primary/15 text-primary">AI Vision</span>
      </div>

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />

      {!imagePreview ? (
        <button onClick={() => fileRef.current?.click()} className="w-full border-2 border-dashed border-border rounded-2xl p-12 flex flex-col items-center gap-3 text-muted-foreground hover:border-primary/30 hover:text-foreground transition-colors">
          <Upload className="w-8 h-8" />
          <span className="text-sm">Upload an image to describe</span>
        </button>
      ) : (
        <div className="space-y-3">
          <div className="relative rounded-2xl overflow-hidden border border-border">
            <img src={imagePreview} alt="Uploaded" className="w-full max-h-[300px] object-contain bg-muted/30" />
            <button onClick={() => { setImagePreview(null); setImageBase64(null); setDescription(""); }} className="absolute top-2 right-2 px-2 py-1 rounded-lg bg-background/80 text-xs text-muted-foreground hover:text-foreground backdrop-blur-sm">
              Change
            </button>
          </div>
        </div>
      )}

      <input value={customPrompt} onChange={(e) => setCustomPrompt(e.target.value)} placeholder="Custom prompt (optional, e.g. 'What text is in this image?')" className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary/30" />

      <button onClick={handleDescribe} disabled={!imageBase64 || loading} className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-30 transition-opacity">
        {loading ? <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</span> : "Describe Image"}
      </button>

      {error && <p className="text-destructive text-sm">{error}</p>}
      {description && (
        <div className="bg-muted/30 border border-border rounded-2xl p-4">
          <div className="prose prose-sm max-w-none text-foreground">
            <ReactMarkdown>{description}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
