import { useState, useRef } from "react";
import { Volume2, Loader2, Play, Square, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const VOICES = [
  { id: "shubh", label: "Shubh", gender: "Male" },
  { id: "aditya", label: "Aditya", gender: "Male" },
  { id: "rahul", label: "Rahul", gender: "Male" },
  { id: "rohan", label: "Rohan", gender: "Male" },
  { id: "amit", label: "Amit", gender: "Male" },
  { id: "dev", label: "Dev", gender: "Male" },
  { id: "soham", label: "Soham", gender: "Male" },
  { id: "mohit", label: "Mohit", gender: "Male" },
  { id: "rehan", label: "Rehan", gender: "Male" },
  { id: "vijay", label: "Vijay", gender: "Male" },
  { id: "gokul", label: "Gokul", gender: "Male" },
  { id: "ritu", label: "Ritu", gender: "Female" },
  { id: "priya", label: "Priya", gender: "Female" },
  { id: "neha", label: "Neha", gender: "Female" },
  { id: "pooja", label: "Pooja", gender: "Female" },
  { id: "simran", label: "Simran", gender: "Female" },
  { id: "kavya", label: "Kavya", gender: "Female" },
  { id: "ishita", label: "Ishita", gender: "Female" },
  { id: "shreya", label: "Shreya", gender: "Female" },
  { id: "rupali", label: "Rupali", gender: "Female" },
  { id: "shruti", label: "Shruti", gender: "Female" },
  { id: "suhani", label: "Suhani", gender: "Female" },
  { id: "kavitha", label: "Kavitha", gender: "Female" },
];

const LANGUAGES = [
  { code: "en-IN", label: "English" },
  { code: "hi-IN", label: "Hindi" },
  { code: "ta-IN", label: "Tamil" },
  { code: "te-IN", label: "Telugu" },
  { code: "kn-IN", label: "Kannada" },
  { code: "ml-IN", label: "Malayalam" },
  { code: "mr-IN", label: "Marathi" },
  { code: "bn-IN", label: "Bengali" },
  { code: "gu-IN", label: "Gujarati" },
  { code: "pa-IN", label: "Punjabi" },
];

export default function TextToSpeechTool() {
  const [text, setText] = useState("");
  const [voice, setVoice] = useState("shubh");
  const [language, setLanguage] = useState("en-IN");
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState("");
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleSpeak = async () => {
    if (!text.trim() || loading) return;
    setError("");
    setLoading(true);
    setAudioBase64(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sarvam-tts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ text: text.trim(), language, speaker: voice }),
      });

      if (!resp.ok) throw new Error("TTS failed");
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      if (!data.audio) throw new Error("No audio returned");

      setAudioBase64(data.audio);
      playAudio(data.audio);
    } catch (err: any) {
      setError(err.message || "Failed to generate speech");
    } finally {
      setLoading(false);
    }
  };

  const playAudio = (base64: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    const audio = new Audio(`data:audio/mp3;base64,${base64}`);
    audioRef.current = audio;
    setPlaying(true);
    audio.onended = () => setPlaying(false);
    audio.onerror = () => setPlaying(false);
    audio.play();
  };

  const handleStop = () => {
    audioRef.current?.pause();
    audioRef.current = null;
    setPlaying(false);
  };

  const handleDownload = () => {
    if (!audioBase64) return;
    const link = document.createElement("a");
    link.href = `data:audio/mp3;base64,${audioBase64}`;
    link.download = "speech.mp3";
    link.click();
  };

  const charCount = text.length;
  const maxChars = 1000;

  return (
    <div className="max-w-xl mx-auto p-4 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
          <Volume2 className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground tracking-tight">Text to Speech</h2>
          <p className="text-[11px] text-muted-foreground">Powered by Sarvam AI</p>
        </div>
      </div>

      {/* Voice & Language selection */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Voice</label>
          <select
            value={voice}
            onChange={(e) => setVoice(e.target.value)}
            className="w-full bg-muted/30 border border-border/30 rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/20"
          >
            {VOICES.map((v) => (
              <option key={v.id} value={v.id}>{v.label} ({v.gender})</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Language</label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full bg-muted/30 border border-border/30 rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/20"
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Text input */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center">
          <label className="text-xs font-medium text-muted-foreground">Text</label>
          <span className={cn("text-[10px]", charCount > maxChars ? "text-destructive" : "text-muted-foreground/50")}>
            {charCount}/{maxChars}
          </span>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, maxChars))}
          placeholder="Type or paste text to convert to speech..."
          rows={5}
          className="w-full bg-muted/30 border border-border/30 rounded-xl px-3.5 py-3 text-sm text-foreground placeholder:text-muted-foreground/40 resize-none focus:outline-none focus:ring-1 focus:ring-primary/20 leading-relaxed"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={playing ? handleStop : handleSpeak}
          disabled={(!text.trim() && !playing) || loading}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all",
            playing
              ? "bg-destructive/10 text-destructive hover:bg-destructive/20"
              : "bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-30"
          )}
        >
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
          ) : playing ? (
            <><Square className="w-4 h-4" /> Stop</>
          ) : (
            <><Play className="w-4 h-4" /> Speak</>
          )}
        </button>

        {audioBase64 && !loading && (
          <>
            {!playing && (
              <button
                onClick={() => playAudio(audioBase64)}
                className="p-3 rounded-xl bg-muted/50 border border-border/30 text-foreground/70 hover:bg-muted transition-colors"
                title="Replay"
              >
                <Play className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={handleDownload}
              className="p-3 rounded-xl bg-muted/50 border border-border/30 text-foreground/70 hover:bg-muted transition-colors"
              title="Download MP3"
            >
              <Download className="w-4 h-4" />
            </button>
          </>
        )}
      </div>

      {error && <p className="text-destructive text-xs text-center">{error}</p>}
    </div>
  );
}
