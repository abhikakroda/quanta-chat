import { useState, useRef, useCallback } from "react";
import { Mic, MicOff, Volume2, Loader2, Square } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";

export default function VoiceChatTool() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [playingAudio, setPlayingAudio] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<{ role: string; text: string }[]>([]);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/wav" });
        await processAudio(blob);
      };
      recorder.start();
      mediaRef.current = recorder;
      setIsRecording(true);
      setError("");
    } catch {
      setError("Microphone access denied");
    }
  }, []);

  const stopRecording = useCallback(() => {
    mediaRef.current?.stop();
    setIsRecording(false);
  }, []);

  const processAudio = async (audioBlob: Blob) => {
    setLoading(true);
    setTranscript("");
    setResponse("");

    try {
      // Step 1: STT with Sarvam
      const { data: { session: sttSession } } = await supabase.auth.getSession();
      const sttToken = sttSession?.access_token;
      if (!sttToken) throw new Error("Not authenticated");

      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.wav");

      const sttResp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sarvam-stt`, {
        method: "POST",
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${sttToken}`,
        },
        body: formData,
      });

      if (!sttResp.ok) throw new Error("Speech recognition failed");
      const sttData = await sttResp.json();
      if (sttData.error) throw new Error(sttData.error);
      const userText = sttData.transcript;
      setTranscript(userText);
      setHistory((h) => [...h, { role: "user", text: userText }]);

      // Step 2: Get AI response
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const chatResp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          messages: [
            ...history.map((h) => ({ role: h.role === "user" ? "user" : "assistant", content: h.text })),
            { role: "user", content: userText },
          ],
          model: "mistral",
          enableThinking: false,
          skillPrompt: "You are a voice assistant. Keep responses concise and conversational (under 200 words). Be friendly and direct.",
        }),
      });

      if (!chatResp.ok) throw new Error("AI response failed");

      // Parse streaming response
      const reader = chatResp.body?.getReader();
      if (!reader) throw new Error("No response");
      const decoder = new TextDecoder();
      let buffer = "";
      let fullResp = "";

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
            if (content) { fullResp += content; setResponse(fullResp); }
          } catch { /* partial */ }
        }
      }

      setHistory((h) => [...h, { role: "assistant", text: fullResp }]);

      // Step 3: TTS with Sarvam
      const ttsResp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sarvam-tts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${sttToken}`,
        },
        body: JSON.stringify({ text: fullResp.slice(0, 2500), language: "en-IN" }),
      });

      if (ttsResp.ok) {
        const ttsData = await ttsResp.json();
        if (ttsData.audio) {
          setPlayingAudio(true);
          const audio = new Audio(`data:audio/mp3;base64,${ttsData.audio}`);
          audioRef.current = audio;
          audio.onended = () => setPlayingAudio(false);
          audio.play();
        }
      }
    } catch (err: any) {
      setError(err.message || "Voice chat failed");
    } finally {
      setLoading(false);
    }
  };

  const stopAudio = () => { audioRef.current?.pause(); setPlayingAudio(false); };

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4 animate-fade-in">
      <div className="flex items-center gap-2 mb-2">
        <Volume2 className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">Voice Chat</h2>
        <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-primary/15 text-primary">Sarvam AI</span>
      </div>

      {/* Voice button */}
      <div className="flex flex-col items-center gap-4 py-8">
        <button
          onClick={isRecording ? stopRecording : startRecording}
          disabled={loading}
          className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 ${
            isRecording ? "bg-destructive text-destructive-foreground scale-110 animate-pulse" : "bg-primary text-primary-foreground hover:scale-105"
          } disabled:opacity-30`}
        >
          {loading ? <Loader2 className="w-8 h-8 animate-spin" /> : isRecording ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
        </button>
        <p className="text-sm text-muted-foreground">
          {loading ? "Processing..." : isRecording ? "Listening... Tap to stop" : "Tap to speak"}
        </p>
      </div>

      {playingAudio && (
        <div className="flex items-center justify-center gap-2">
          <div className="flex items-center gap-1">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="w-1 bg-primary rounded-full animate-pulse" style={{ height: `${12 + Math.random() * 20}px`, animationDelay: `${i * 100}ms` }} />
            ))}
          </div>
          <button onClick={stopAudio} className="p-2 rounded-full bg-muted hover:bg-accent transition-colors">
            <Square className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && <p className="text-destructive text-sm text-center">{error}</p>}

      {/* Conversation history */}
      {history.length > 0 && (
        <div className="space-y-3 max-h-[300px] overflow-y-auto">
          {history.map((h, i) => (
            <div key={i} className={`flex ${h.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm ${h.role === "user" ? "bg-primary text-primary-foreground rounded-br-md" : "bg-muted text-foreground rounded-bl-md"}`}>
                {h.role === "assistant" ? <ReactMarkdown>{h.text}</ReactMarkdown> : h.text}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
