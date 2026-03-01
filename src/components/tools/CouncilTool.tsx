import { useState, useCallback } from "react";
import { Users, Loader2, MessageSquare, Lightbulb, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

type PersonaResponse = {
  key: string;
  name: string;
  emoji: string;
  response: string;
  error: boolean;
};

type DebateRound = {
  question: string;
  responses: PersonaResponse[];
  synthesis: string;
};

const PERSONA_COLORS: Record<string, { border: string; bg: string; text: string }> = {
  engineer: { border: "border-blue-500/30", bg: "bg-blue-500/5", text: "text-blue-500" },
  professor: { border: "border-violet-500/30", bg: "bg-violet-500/5", text: "text-violet-500" },
  founder: { border: "border-amber-500/30", bg: "bg-amber-500/5", text: "text-amber-500" },
  manager: { border: "border-emerald-500/30", bg: "bg-emerald-500/5", text: "text-emerald-500" },
};

export default function CouncilTool() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rounds, setRounds] = useState<DebateRound[]>([]);
  const [followUp, setFollowUp] = useState("");
  const [expandedPersona, setExpandedPersona] = useState<string | null>(null);
  const [loadingPersonas, setLoadingPersonas] = useState<string[]>([]);

  const callAPI = useCallback(async (body: any) => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) throw new Error("Not authenticated");
    const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-council`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify(body),
    });
    const r = await resp.json();
    if (r.error) throw new Error(r.error);
    return r;
  }, []);

  const startDebate = useCallback(async (q?: string) => {
    const topic = q || question;
    if (!topic.trim() || loading) return;
    setLoading(true);
    setError(null);
    setLoadingPersonas(["engineer", "professor", "founder", "manager"]);

    try {
      // Build debate history from previous rounds
      const debateHistory = rounds.flatMap(r =>
        r.responses.map(p => ({ persona: p.name, response: p.response }))
      );

      const result = await callAPI({ question: topic, debateHistory });

      const newRound: DebateRound = {
        question: topic,
        responses: result.responses,
        synthesis: result.synthesis,
      };
      setRounds(prev => [...prev, newRound]);
      setExpandedPersona(null);
      setFollowUp("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setLoadingPersonas([]);
    }
  }, [question, loading, rounds, callAPI]);

  const reset = () => {
    setRounds([]);
    setQuestion("");
    setFollowUp("");
    setError(null);
    setExpandedPersona(null);
  };

  // Input screen
  if (rounds.length === 0 && !loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-4 animate-message-in">
        <div className="text-center space-y-2 mb-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <span className="text-2xl">🔧</span>
            <span className="text-2xl">🎓</span>
            <span className="text-2xl">🚀</span>
            <span className="text-2xl">👔</span>
          </div>
          <h2 className="text-xl font-bold text-foreground">AI Council</h2>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            4 expert personas debate your question. Get perspectives from an Engineer, Professor, Founder, and Corporate Manager.
          </p>
        </div>

        <div className="w-full max-w-md space-y-3">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={`e.g. "Should we rewrite our monolith in microservices?"\n"Is it worth learning Rust in 2026?"\n"Should I quit my job to start a startup?"`}
            className="w-full h-28 px-3.5 py-2.5 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/30 transition-colors resize-none"
          />

          {error && <p className="text-sm text-destructive">{error}</p>}

          <button
            onClick={() => startDebate()}
            disabled={!question.trim()}
            className="w-full px-4 py-3 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-30 flex items-center justify-center gap-2"
          >
            <Users className="w-4 h-4" />
            Summon the Council
          </button>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-3 max-w-md w-full">
          {[
            { emoji: "🔧", name: "Practical Engineer", desc: "Battle-tested, production-focused" },
            { emoji: "🎓", name: "Professor", desc: "Theoretical, research-backed" },
            { emoji: "🚀", name: "Startup Founder", desc: "Ship fast, business-first" },
            { emoji: "👔", name: "Corp Manager", desc: "Process, risk, team dynamics" },
          ].map(p => (
            <div key={p.name} className="p-3 rounded-xl border border-border/40 bg-card">
              <div className="flex items-center gap-1.5 mb-1">
                <span>{p.emoji}</span>
                <span className="text-[11px] font-semibold text-foreground">{p.name}</span>
              </div>
              <p className="text-[10px] text-muted-foreground">{p.desc}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Loading state
  if (loading && rounds.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 animate-fade-in">
        <div className="flex items-center gap-3">
          {["🔧", "🎓", "🚀", "👔"].map((emoji, i) => (
            <div key={i} className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center text-xl border-2 transition-all duration-500",
              loadingPersonas.length > 0 ? "border-primary/50 animate-pulse" : "border-border/30"
            )} style={{ animationDelay: `${i * 200}ms` }}>
              {emoji}
            </div>
          ))}
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">Council is deliberating…</p>
          <p className="text-[11px] text-muted-foreground mt-1">4 experts analyzing your question simultaneously</p>
        </div>
      </div>
    );
  }

  // Debate view
  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-border/40 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          <span className="text-sm font-bold text-foreground">AI Council</span>
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
            {rounds.length} round{rounds.length > 1 ? "s" : ""}
          </span>
        </div>
        <button onClick={reset} className="text-xs text-muted-foreground hover:text-foreground transition-colors">New Topic</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {rounds.map((round, ri) => (
          <div key={ri} className="space-y-3 animate-message-in">
            {/* Question */}
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
              <div className="text-[9px] font-bold text-primary uppercase mb-1">
                {ri === 0 ? "📋 Topic" : `🔄 Follow-up #${ri}`}
              </div>
              <p className="text-[13px] font-medium text-foreground">{round.question}</p>
            </div>

            {/* Persona responses */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {round.responses.map((persona) => {
                const colors = PERSONA_COLORS[persona.key] || PERSONA_COLORS.engineer;
                const isExpanded = expandedPersona === `${ri}-${persona.key}`;
                const lines = persona.response.split("\n").filter(l => l.trim());
                const verdict = lines.find(l => l.toLowerCase().includes("verdict"));
                const preview = persona.response.slice(0, 200);

                return (
                  <div
                    key={persona.key}
                    className={cn("rounded-xl border p-3 transition-all cursor-pointer hover:shadow-sm", colors.border, colors.bg)}
                    onClick={() => setExpandedPersona(isExpanded ? null : `${ri}-${persona.key}`)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-lg">{persona.emoji}</span>
                        <span className={cn("text-[11px] font-bold", colors.text)}>{persona.name}</span>
                      </div>
                      {isExpanded ? <ChevronUp className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
                    </div>

                    {isExpanded ? (
                      <div className="text-[12px] text-foreground/80 leading-relaxed whitespace-pre-line">
                        {persona.response}
                      </div>
                    ) : (
                      <>
                        <p className="text-[11px] text-foreground/70 leading-relaxed line-clamp-3">{preview}…</p>
                        {verdict && (
                          <p className={cn("text-[10px] font-bold mt-2 italic", colors.text)}>
                            {verdict}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Synthesis */}
            {round.synthesis && (
              <div className="rounded-xl border border-border/40 bg-card p-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-[10px] font-bold text-amber-500 uppercase">Council Synthesis</span>
                </div>
                <p className="text-[12px] text-foreground/80 leading-relaxed whitespace-pre-line">{round.synthesis}</p>
              </div>
            )}
          </div>
        ))}

        {/* Loading indicator for follow-up */}
        {loading && rounds.length > 0 && (
          <div className="flex items-center justify-center gap-2 py-4">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Council is reconvening…</span>
          </div>
        )}

        {error && <p className="text-sm text-destructive text-center">{error}</p>}
      </div>

      {/* Follow-up input */}
      {!loading && (
        <div className="shrink-0 px-4 py-3 border-t border-border/40">
          <div className="flex items-center gap-2">
            <input
              value={followUp}
              onChange={(e) => setFollowUp(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && followUp.trim()) startDebate(followUp); }}
              placeholder="Ask a follow-up… the council remembers context"
              className="flex-1 px-3 py-2 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/30 transition-colors"
            />
            <button
              onClick={() => startDebate(followUp)}
              disabled={!followUp.trim()}
              className="px-3 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-30 flex items-center gap-1"
            >
              <MessageSquare className="w-3.5 h-3.5" /> Ask
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
