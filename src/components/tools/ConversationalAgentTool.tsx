import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, MicOff, Square, Phone, PhoneOff, Globe, Volume2, Loader2, User, ChevronDown, Send, MessageSquare, Bot } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { getMicErrorMessage } from "@/lib/micErrors";
import ReactMarkdown from "react-markdown";

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
type Mode = "voice" | "text";

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
  const [mode, setMode] = useState<Mode>("text");
  const [textInput, setTextInput] = useState("");
  const [autoSpeak, setAutoSpeak] = useState(true);

  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const isActiveRef = useRef(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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
      const SILENCE_THRESHOLD = 8;
      const SILENCE_FRAMES_NEEDED = 45;
      let hasSpoken = false;

      const tick = () => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setVolume(avg / 128);

        if (avg > 15) { hasSpoken = true; silentFrames = 0; }
        else if (hasSpoken) { silentFrames++; }

        if (hasSpoken && silentFrames >= SILENCE_FRAMES_NEEDED && mediaRef.current?.state === "recording") {
          mediaRef.current?.stop();
          setIsListening(false);
          return;
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
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        if (blob.size > 1000) {
          await processVoiceTurn(blob);
        } else if (isActiveRef.current) {
          startListening();
        }
      };
      recorder.start();
      mediaRef.current = recorder;
      setIsListening(true);
    } catch (err) {
      setError(getMicErrorMessage(err));
    }
  }, [language, turns, voice]);

  const stopListening = useCallback(() => {
    mediaRef.current?.stop();
    setIsListening(false);
  }, []);

  const startConversation = useCallback(async () => {
    setIsActive(true);
    setError("");
    setCurrentTranscript("");
    setAgentResponse("");
    if (mode === "voice") {
      setTimeout(() => startListening(), 100);
    }
  }, [startListening, mode]);

  const endConversation = useCallback(() => {
    stopEverything();
    setCurrentTranscript("");
    setAgentResponse("");
    setProcessingStage("");
  }, []);

  const getAIResponse = async (userText: string): Promise<string> => {
    setProcessingStage("Thinking...");
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) throw new Error("Not authenticated");

    abortRef.current = new AbortController();

    const conversationHistory = turns.map(t => ({
      role: t.role === "user" ? "user" as const : "assistant" as const,
      content: t.text
    }));

    const langLabel = LANGUAGES.find(l => l.code === language)?.label || "English";

    const chatResp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({
        messages: [...conversationHistory, { role: "user", content: userText }],
        model: "mistral",
        enableThinking: false,
        skillPrompt: `You are a conversational AI agent powered by Sarvam AI. You speak ${langLabel}. 
Keep responses concise and natural (under 100 words for voice, under 300 for text).
If the user speaks in a regional language, respond in that language.
Don't use complex markdown - speak naturally. Be warm, helpful, and to the point.
You can help with any topic - questions, tasks, advice, learning, etc.`,
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

    return fullResp;
  };

  const speakText = async (text: string) => {
    if (!autoSpeak && mode === "text") return;
    setIsSpeaking(true);
    setProcessingStage("Speaking...");

    let spoke = false;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const ttsResp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sarvam-tts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text: text.slice(0, 2500), language, speaker: voice }),
      });

      if (ttsResp.ok) {
        const ttsData = await ttsResp.json();
        if (ttsData.audio) {
          const audio = new Audio(`data:audio/mp3;base64,${ttsData.audio}`);
          audioRef.current = audio;
          spoke = true;
          await new Promise<void>((resolve) => {
            audio.onended = () => { setIsSpeaking(false); resolve(); };
            audio.onerror = () => { setIsSpeaking(false); resolve(); };
            audio.play().catch(() => { spoke = false; setIsSpeaking(false); resolve(); });
          });
        }
      }
    } catch (e) {
      console.error("TTS failed:", e);
    }

    if (!spoke && text && window.speechSynthesis) {
      try {
        const utterance = new SpeechSynthesisUtterance(text.slice(0, 500));
        utterance.lang = language;
        utterance.rate = 1.05;
        await new Promise<void>((resolve) => {
          utterance.onend = () => { setIsSpeaking(false); resolve(); };
          utterance.onerror = () => { setIsSpeaking(false); resolve(); };
          window.speechSynthesis.speak(utterance);
        });
      } catch { /* fallback failed */ }
    }

    setIsSpeaking(false);
  };

  const processVoiceTurn = async (audioBlob: Blob) => {
    setIsProcessing(true);
    setCurrentTranscript("");
    setAgentResponse("");

    try {
      setProcessingStage("Recognizing...");
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");
      formData.append("language", language);

      const sttResp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sarvam-stt`, {
        method: "POST",
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${token}`,
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

      const fullResp = await getAIResponse(userText);
      setTurns(prev => [...prev, { role: "agent", text: fullResp, timestamp: new Date() }]);

      await speakText(fullResp);

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

  const handleTextSubmit = async () => {
    const text = textInput.trim();
    if (!text || isProcessing) return;

    setTextInput("");
    setIsProcessing(true);
    setAgentResponse("");
    setError("");

    const userTurn: Turn = { role: "user", text, timestamp: new Date() };
    setTurns(prev => [...prev, userTurn]);

    try {
      const fullResp = await getAIResponse(text);
      setTurns(prev => [...prev, { role: "agent", text: fullResp, timestamp: new Date() }]);

      if (autoSpeak) await speakText(fullResp);
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setError(err.message || "Response failed");
      }
    } finally {
      setIsProcessing(false);
      setProcessingStage("");
      setAgentResponse("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleTextSubmit();
    }
  };

  const stopSpeaking = () => {
    audioRef.current?.pause();
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
    if (isActiveRef.current && mode === "voice") startListening();
  };

  const statusText = isListening
    ? "Listening..."
    : isSpeaking
    ? "Speaking..."
    : isProcessing
    ? processingStage || "Processing..."
    : isActive && mode === "voice"
    ? "Tap mic to speak"
    : "";

  return (
    <div className="max-w-2xl mx-auto p-3 sm:p-4 space-y-3 animate-fade-in h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center border border-border/50">
            <Bot className="w-4.5 h-4.5 text-foreground/70" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground tracking-tight">Conversational Agent</h2>
            <p className="text-[11px] text-muted-foreground">Sarvam AI • Auto-reply</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Mode toggle */}
          <div className="flex bg-muted/50 border border-border/50 rounded-xl p-0.5">
            <button
              onClick={() => { setMode("text"); if (isActive && isListening) stopListening(); }}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-medium transition-all",
                mode === "text" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <MessageSquare className="w-3.5 h-3.5 inline mr-1" />Text
            </button>
            <button
              onClick={() => setMode("voice")}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-medium transition-all",
                mode === "voice" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Phone className="w-3.5 h-3.5 inline mr-1" />Voice
            </button>
          </div>

          {/* Voice picker */}
          <div className="relative">
            <button
              onClick={() => { setShowVoicePicker(!showVoicePicker); setShowLangPicker(false); }}
              className="flex items-center gap-1 px-2 py-1.5 rounded-xl text-xs bg-muted/50 border border-border/50 text-foreground/70 hover:bg-muted transition-colors"
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
                      v.id === voice ? "bg-accent text-foreground font-medium" : "text-foreground/70 hover:bg-muted"
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
              className="flex items-center gap-1 px-2 py-1.5 rounded-xl text-xs bg-muted/50 border border-border/50 text-foreground/70 hover:bg-muted transition-colors"
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
                      l.code === language ? "bg-accent text-foreground font-medium" : "text-foreground/70 hover:bg-muted"
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

      {/* Auto-speak toggle for text mode */}
      {mode === "text" && (
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => setAutoSpeak(!autoSpeak)}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-colors border",
              autoSpeak ? "bg-accent text-foreground border-border" : "bg-muted/30 text-muted-foreground border-border/30"
            )}
          >
            <Volume2 className="w-3 h-3" />
            {autoSpeak ? "Voice on" : "Voice off"}
          </button>
        </div>
      )}

      {/* Chat area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-0">
        {turns.length === 0 && !isActive && (
          <div className="flex flex-col items-center justify-center h-full gap-4 py-12">
            <div className="w-16 h-16 rounded-2xl bg-accent flex items-center justify-center border border-border/50">
              <Bot className="w-8 h-8 text-foreground/60" />
            </div>
            <div className="text-center space-y-1.5">
              <h3 className="text-lg font-semibold text-foreground">Start a Conversation</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                {mode === "text" 
                  ? "Type a message below to chat. The agent auto-replies instantly."
                  : "Tap the call button to start a voice conversation with auto-detection."
                }
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2 mt-2">
              {["What can you help me with?", "Tell me a joke", "Explain quantum computing", "Help me practice Hindi"].map(q => (
                <button
                  key={q}
                  onClick={() => { setTextInput(q); setMode("text"); }}
                  className="px-3 py-1.5 rounded-xl text-xs bg-muted/50 border border-border/50 text-foreground/70 hover:bg-accent hover:text-foreground transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {turns.map((turn, i) => (
          <div key={i} className={cn("flex", turn.role === "user" ? "justify-end" : "justify-start")}>
            <div className={cn(
              "max-w-[85%] px-4 py-2.5 text-sm leading-relaxed",
              turn.role === "user"
                ? "bg-chat-user text-chat-user-foreground rounded-2xl rounded-br-md"
                : "bg-chat-ai text-chat-ai-foreground rounded-2xl rounded-bl-md border border-border/30"
            )}>
              {turn.role === "agent" ? (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown>{turn.text}</ReactMarkdown>
                </div>
              ) : turn.text}
            </div>
          </div>
        ))}

        {/* Live streaming response */}
        {agentResponse && isProcessing && (
          <div className="flex justify-start">
            <div className="max-w-[85%] px-4 py-2.5 text-sm bg-chat-ai text-chat-ai-foreground rounded-2xl rounded-bl-md border border-border/30 opacity-80">
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown>{agentResponse}</ReactMarkdown>
              </div>
            </div>
          </div>
        )}

        {/* Processing indicator */}
        {isProcessing && !agentResponse && (
          <div className="flex justify-start">
            <div className="px-4 py-3 bg-chat-ai text-chat-ai-foreground rounded-2xl rounded-bl-md border border-border/30">
              <div className="flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{processingStage || "Thinking..."}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Speaking indicator */}
      {isSpeaking && (
        <div className="flex items-center justify-center gap-3 py-2">
          <div className="flex items-center gap-1">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="w-1 bg-primary rounded-full animate-pulse"
                style={{ height: `${8 + Math.random() * 14}px`, animationDelay: `${i * 80}ms` }}
              />
            ))}
          </div>
          <span className="text-xs text-muted-foreground">Speaking</span>
          <button onClick={stopSpeaking} className="p-1.5 rounded-lg bg-muted hover:bg-accent transition-colors">
            <Square className="w-3 h-3" />
          </button>
        </div>
      )}

      {error && <p className="text-destructive text-xs text-center">{error}</p>}

      {/* Voice mode controls */}
      {mode === "voice" && (
        <div className="flex flex-col items-center gap-3 py-4">
          {/* Voice orb */}
          <div className="relative flex items-center justify-center">
            {isActive && (
              <>
                <div className={cn(
                  "absolute w-24 h-24 rounded-full opacity-10 animate-ping bg-primary",
                )} style={{ animationDuration: "2s" }} />
                <div className={cn(
                  "absolute w-20 h-20 rounded-full opacity-15 bg-primary",
                )} style={{ transform: `scale(${1 + volume * 0.3})`, transition: "transform 0.1s ease-out" }} />
              </>
            )}

            {!isActive ? (
              <button
                onClick={startConversation}
                className="relative z-10 w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:scale-105 transition-all duration-300 shadow-lg"
              >
                <Phone className="w-7 h-7" />
              </button>
            ) : (
              <div className="flex items-center gap-3 relative z-10">
                <button
                  onClick={isListening ? stopListening : startListening}
                  disabled={isProcessing || isSpeaking}
                  className={cn(
                    "w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300",
                    isListening ? "bg-primary text-primary-foreground scale-110" : "bg-muted text-foreground hover:bg-accent",
                    (isProcessing || isSpeaking) && "opacity-40 cursor-not-allowed"
                  )}
                >
                  {isListening ? <Mic className="w-6 h-6" /> : <MicOff className="w-5 h-5" />}
                </button>

                <button
                  onClick={endConversation}
                  className="w-14 h-14 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:opacity-90 transition-all"
                >
                  <PhoneOff className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>

          {statusText && (
            <p className={cn(
              "text-sm font-medium",
              isListening ? "text-primary" : isSpeaking ? "text-primary" : "text-muted-foreground"
            )}>
              {statusText}
            </p>
          )}
        </div>
      )}

      {/* Text mode input */}
      {mode === "text" && (
        <div className="flex items-end gap-2 pt-1">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={textInput}
              onChange={e => setTextInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              rows={1}
              className="w-full resize-none rounded-xl bg-muted/50 border border-border/50 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
              style={{ minHeight: "44px", maxHeight: "120px" }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = "44px";
                target.style.height = Math.min(target.scrollHeight, 120) + "px";
              }}
            />
          </div>

          {/* Mic button for quick voice in text mode */}
          <button
            onClick={isListening ? stopListening : () => { setIsActive(true); startListening(); }}
            disabled={isProcessing}
            className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center transition-all shrink-0",
              isListening ? "bg-primary text-primary-foreground" : "bg-muted/50 border border-border/50 text-foreground/60 hover:bg-accent"
            )}
          >
            {isListening ? <Mic className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          <button
            onClick={handleTextSubmit}
            disabled={!textInput.trim() || isProcessing}
            className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-all shrink-0 disabled:opacity-30"
          >
            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      )}
    </div>
  );
}
