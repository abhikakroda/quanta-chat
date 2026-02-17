import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, MicOff, Square, Phone, PhoneOff, Globe, Volume2, Loader2, Settings2, User, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

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
  { code: "od-IN", label: "Odia" },
];

const VOICES = [
  { id: "anushka", label: "Anushka", gender: "Female" },
  { id: "manisha", label: "Manisha", gender: "Female" },
  { id: "vidya", label: "Vidya", gender: "Female" },
  { id: "arya", label: "Arya", gender: "Female" },
  { id: "ritu", label: "Ritu", gender: "Female" },
  { id: "priya", label: "Priya", gender: "Female" },
  { id: "abhilash", label: "Abhilash", gender: "Male" },
  { id: "karun", label: "Karun", gender: "Male" },
  { id: "hitesh", label: "Hitesh", gender: "Male" },
  { id: "rahul", label: "Rahul", gender: "Male" },
];

type Turn = { role: "user" | "agent"; text: string; timestamp: Date };

export default function ConversationalAgentTool() {
  const [isActive, setIsActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [language, setLanguage] = useState("en-IN");
  const [voice, setVoice] = useState("anushka");
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [showVoicePicker, setShowVoicePicker] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState("");
  const [agentResponse, setAgentResponse] = useState("");
  const [error, setError] = useState("");
  const [processingStage, setProcessingStage] = useState("");
  const [volume, setVolume] = useState(0);

  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const isActiveRef = useRef(false);

  // Keep ref in sync
  useEffect(() => { isActiveRef.current = isActive; }, [isActive]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, currentTranscript, agentResponse]);

  useEffect(() => {
    return () => { stopEverything(); };
  }, []);

  const stopEverything = () => {
    mediaRef.current?.stop();
    streamRef.current?.getTracks().forEach(t => t.stop());
    audioRef.current?.pause();
    abortRef.current?.abort();
    cancelAnimationFrame(animFrameRef.current);
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    audioContextRef.current?.close().catch(() => {});
    setIsActive(false);
    setIsListening(false);
    setIsProcessing(false);
    setIsSpeaking(false);
    setVolume(0);
  };

  const startVolumeMonitorWithSilenceDetection = (stream: MediaStream) => {
    try {
      const ctx = new AudioContext();
      audioContextRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      src.connect(analyser);
      analyserRef.current = analyser;

      const data = new Uint8Array(analyser.frequencyBinCount);
      let silentFrames = 0;
      const SILENCE_THRESHOLD = 8; // low volume threshold
      const SILENCE_FRAMES_NEEDED = 45; // ~1.5s of silence at 30fps
      let hasSpoken = false;

      const tick = () => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setVolume(avg / 128);

        if (avg > 15) {
          hasSpoken = true;
          silentFrames = 0;
        } else if (hasSpoken) {
          silentFrames++;
        }

        // Auto-stop after silence detected (user stopped speaking)
        if (hasSpoken && silentFrames >= SILENCE_FRAMES_NEEDED && mediaRef.current?.state === "recording") {
          mediaRef.current?.stop();
          setIsListening(false);
          return; // stop the loop
        }

        animFrameRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch { /* audio context not supported */ }
  };

  const startListening = useCallback(async () => {
    try {
      setError("");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      startVolumeMonitorWithSilenceDetection(stream);

      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        cancelAnimationFrame(animFrameRef.current);
        setVolume(0);
        stream.getTracks().forEach(t => t.stop());
        audioContextRef.current?.close().catch(() => {});
        const blob = new Blob(chunksRef.current, { type: "audio/wav" });
        if (blob.size > 1000) {
          await processConversationTurn(blob);
        } else if (isActiveRef.current) {
          startListening();
        }
      };
      recorder.start();
      mediaRef.current = recorder;
      setIsListening(true);
    } catch {
      setError("Microphone access denied. Please allow microphone permission.");
    }
  }, [language, turns, voice]);

  const stopListening = useCallback(() => {
    mediaRef.current?.stop();
    setIsListening(false);
  }, []);

  const startConversation = useCallback(async () => {
    setIsActive(true);
    setTurns([]);
    setError("");
    setCurrentTranscript("");
    setAgentResponse("");
    // Small delay to let state update
    setTimeout(() => startListening(), 100);
  }, [startListening]);

  const endConversation = useCallback(() => {
    stopEverything();
    setCurrentTranscript("");
    setAgentResponse("");
    setProcessingStage("");
  }, []);

  const processConversationTurn = async (audioBlob: Blob) => {
    setIsProcessing(true);
    setCurrentTranscript("");
    setAgentResponse("");

    try {
      // Stage 1: Speech-to-Text (fast)
      setProcessingStage("Recognizing...");
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.wav");

      const sttResp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sarvam-stt`, {
        method: "POST",
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: formData,
      });

      if (!sttResp.ok) throw new Error("Speech recognition failed");
      const sttData = await sttResp.json();
      if (sttData.error) throw new Error(sttData.error);

      const userText = sttData.transcript;
      if (!userText?.trim()) {
        if (isActiveRef.current) startListening();
        setIsProcessing(false);
        return;
      }

      setCurrentTranscript(userText);
      setTurns(prev => [...prev, { role: "user", text: userText, timestamp: new Date() }]);

      // Stage 2: AI Response (stream it)
      setProcessingStage("Thinking...");
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not authenticated");

      abortRef.current = new AbortController();

      const conversationHistory = turns.map(t => ({
        role: t.role === "user" ? "user" as const : "assistant" as const,
        content: t.text
      }));

      const chatResp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          messages: [
            ...conversationHistory,
            { role: "user", content: userText },
          ],
          model: "mistral",
          enableThinking: false,
          skillPrompt: `You are a conversational AI agent. You speak ${LANGUAGES.find(l => l.code === language)?.label || "English"}. 
Keep responses very short and concise (under 80 words). Be direct and natural like a phone call.
If the user speaks in a regional language, respond in that language.
Don't use markdown formatting, lists, or special characters - speak naturally as this will be converted to speech.
Respond as if you're on a real phone call - brief, warm, and to the point.`,
        }),
        signal: abortRef.current.signal,
      });

      if (!chatResp.ok) throw new Error("AI response failed");

      const reader = chatResp.body?.getReader();
      if (!reader) throw new Error("No response stream");
      const decoder = new TextDecoder();
      let buffer = "";
      let fullResp = "";

      setProcessingStage("Responding...");

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
            if (content) { fullResp += content; setAgentResponse(fullResp); }
          } catch { /* partial */ }
        }
      }

      setTurns(prev => [...prev, { role: "agent", text: fullResp, timestamp: new Date() }]);

      // Stage 3: Text-to-Speech (with selected voice)
      setProcessingStage("Speaking...");
      setIsSpeaking(true);

      const ttsResp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sarvam-tts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          text: fullResp.slice(0, 1000),
          language,
          speaker: voice,
        }),
      });

      if (ttsResp.ok) {
        const ttsData = await ttsResp.json();
        if (ttsData.audio) {
          const audio = new Audio(`data:audio/mp3;base64,${ttsData.audio}`);
          audioRef.current = audio;

          await new Promise<void>((resolve) => {
            audio.onended = () => { setIsSpeaking(false); resolve(); };
            audio.onerror = () => { setIsSpeaking(false); resolve(); };
            audio.play().catch(() => { setIsSpeaking(false); resolve(); });
          });
        }
      }

      setIsSpeaking(false);

      // Auto-listen for next turn immediately
      if (isActiveRef.current) {
        setIsProcessing(false);
        setProcessingStage("");
        await startListening();
        return;
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setError(err.message || "Conversation failed");
      }
    } finally {
      setIsProcessing(false);
      setIsSpeaking(false);
      setProcessingStage("");
    }
  };

  const stopSpeaking = () => {
    audioRef.current?.pause();
    setIsSpeaking(false);
    if (isActiveRef.current) startListening();
  };

  const ringColor = isListening
    ? "from-green-500 to-emerald-400"
    : isSpeaking
    ? "from-blue-500 to-cyan-400"
    : isProcessing
    ? "from-amber-500 to-orange-400"
    : "from-primary to-primary-glow";

  const statusText = isListening
    ? "Listening..."
    : isSpeaking
    ? "Agent speaking..."
    : isProcessing
    ? processingStage || "Processing..."
    : isActive
    ? "Tap to speak"
    : "Start conversation";

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4 animate-fade-in h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
            <Phone className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground tracking-tight">Conversational Agent</h2>
            <p className="text-[11px] text-muted-foreground">Powered by Sarvam AI</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {/* Voice picker */}
          <div className="relative">
            <button
              onClick={() => { setShowVoicePicker(!showVoicePicker); setShowLangPicker(false); }}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs bg-muted/50 border border-border/50 text-foreground/70 hover:bg-muted transition-colors"
            >
              <User className="w-3 h-3" />
              {VOICES.find(v => v.id === voice)?.label}
              <ChevronDown className="w-3 h-3 opacity-50" />
            </button>
            {showVoicePicker && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-popover border border-border rounded-xl shadow-lg p-1 min-w-[160px] max-h-[260px] overflow-y-auto">
                {VOICES.map(v => (
                  <button
                    key={v.id}
                    onClick={() => { setVoice(v.id); setShowVoicePicker(false); }}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between",
                      v.id === voice ? "bg-primary/10 text-primary font-medium" : "text-foreground/70 hover:bg-muted"
                    )}
                  >
                    <span>{v.label}</span>
                    <span className="text-[10px] text-muted-foreground">{v.gender}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Language picker */}
          <div className="relative">
            <button
              onClick={() => { setShowLangPicker(!showLangPicker); setShowVoicePicker(false); }}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs bg-muted/50 border border-border/50 text-foreground/70 hover:bg-muted transition-colors"
            >
              <Globe className="w-3 h-3" />
              {LANGUAGES.find(l => l.code === language)?.label}
              <ChevronDown className="w-3 h-3 opacity-50" />
            </button>
            {showLangPicker && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-popover border border-border rounded-xl shadow-lg p-1 min-w-[140px] max-h-[240px] overflow-y-auto">
                {LANGUAGES.map(l => (
                  <button
                    key={l.code}
                    onClick={() => { setLanguage(l.code); setShowLangPicker(false); }}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
                      l.code === language ? "bg-primary/10 text-primary font-medium" : "text-foreground/70 hover:bg-muted"
                    )}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main interaction area */}
      <div className="flex-1 flex flex-col items-center justify-center relative">
        {/* Conversation display */}
        {turns.length > 0 && (
          <div ref={scrollRef} className="w-full flex-1 overflow-y-auto space-y-3 mb-4 max-h-[300px] pr-1">
            {turns.map((turn, i) => (
              <div key={i} className={cn("flex", turn.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cn(
                  "max-w-[85%] px-4 py-2.5 text-sm leading-relaxed",
                  turn.role === "user"
                    ? "bg-chat-user text-chat-user-foreground rounded-2xl rounded-br-md"
                    : "bg-chat-ai text-chat-ai-foreground rounded-2xl rounded-bl-md border border-border/30"
                )}>
                  {turn.text}
                </div>
              </div>
            ))}
            {/* Live transcript */}
            {currentTranscript && isProcessing && (
              <div className="flex justify-end">
                <div className="max-w-[85%] px-4 py-2.5 text-sm bg-chat-user text-chat-user-foreground rounded-2xl rounded-br-md opacity-70">
                  {currentTranscript}
                </div>
              </div>
            )}
            {/* Live agent response */}
            {agentResponse && isProcessing && (
              <div className="flex justify-start">
                <div className="max-w-[85%] px-4 py-2.5 text-sm bg-chat-ai text-chat-ai-foreground rounded-2xl rounded-bl-md border border-border/30 opacity-70">
                  {agentResponse}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Voice orb */}
        <div className="relative flex items-center justify-center py-6">
          {/* Animated rings */}
          {isActive && (
            <>
              <div className={cn(
                "absolute w-32 h-32 rounded-full bg-gradient-to-br opacity-10 animate-ping",
                ringColor
              )} style={{ animationDuration: "2s" }} />
              <div className={cn(
                "absolute w-28 h-28 rounded-full bg-gradient-to-br opacity-15",
                ringColor
              )} style={{
                transform: `scale(${1 + volume * 0.3})`,
                transition: "transform 0.1s ease-out"
              }} />
            </>
          )}

          {/* Main button */}
          {!isActive ? (
            <button
              onClick={startConversation}
              className="relative z-10 w-20 h-20 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:scale-105 transition-all duration-300 shadow-lg"
            >
              <Phone className="w-8 h-8" />
            </button>
          ) : (
            <div className="flex items-center gap-4 relative z-10">
              {/* Mic toggle */}
              <button
                onClick={isListening ? stopListening : startListening}
                disabled={isProcessing || isSpeaking}
                className={cn(
                  "w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300",
                  isListening
                    ? "bg-green-500 text-white scale-110"
                    : "bg-muted text-foreground hover:bg-accent",
                  (isProcessing || isSpeaking) && "opacity-40 cursor-not-allowed"
                )}
              >
                {isListening ? <Mic className="w-7 h-7" /> : <MicOff className="w-6 h-6" />}
              </button>

              {/* Stop speaking */}
              {isSpeaking && (
                <button
                  onClick={stopSpeaking}
                  className="w-12 h-12 rounded-full bg-accent text-foreground flex items-center justify-center hover:bg-muted transition-colors"
                >
                  <Square className="w-4 h-4" />
                </button>
              )}

              {/* End call */}
              <button
                onClick={endConversation}
                className="w-16 h-16 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:opacity-90 transition-all"
              >
                <PhoneOff className="w-6 h-6" />
              </button>
            </div>
          )}
        </div>

        {/* Status */}
        <div className="flex flex-col items-center gap-1.5">
          <p className={cn(
            "text-sm font-medium",
            isListening ? "text-green-500" : isSpeaking ? "text-blue-500" : isProcessing ? "text-amber-500" : "text-muted-foreground"
          )}>
            {statusText}
          </p>
          {isProcessing && (
            <div className="flex items-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{processingStage}</span>
            </div>
          )}
          {isSpeaking && (
            <div className="flex items-center gap-1 mt-1">
              {[...Array(7)].map((_, i) => (
                <div
                  key={i}
                  className="w-1 bg-blue-500 rounded-full animate-pulse"
                  style={{
                    height: `${8 + Math.random() * 16}px`,
                    animationDelay: `${i * 80}ms`,
                    animationDuration: "0.6s",
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {error && (
          <p className="text-destructive text-xs text-center mt-2 px-4">{error}</p>
        )}
      </div>

      {/* Footer info */}
      {!isActive && turns.length === 0 && (
        <div className="text-center space-y-2 pb-4">
          <p className="text-sm text-muted-foreground">
            Tap to start a voice conversation
          </p>
          <p className="text-xs text-muted-foreground/60">
            Auto-detects silence • Select voice & language • Real-time
          </p>
        </div>
      )}
    </div>
  );
}
