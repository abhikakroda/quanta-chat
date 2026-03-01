import { useState, useEffect, useCallback } from "react";
import { Swords, Loader2, Trophy, Users, Plus, ArrowRight, Copy, Clock, Crown, Medal, Shield, Flame, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Battle = {
  id: string;
  creator_id: string;
  opponent_id: string | null;
  status: string;
  category: string;
  question: string;
  difficulty: string;
  winner_id: string | null;
  join_code: string;
  created_at: string;
};

type LeaderboardEntry = {
  user_id: string;
  wins: number;
  losses: number;
  draws: number;
  total_score: number;
  streak: number;
};

type Submission = {
  id: string;
  battle_id: string;
  user_id: string;
  answer: string;
  score: number;
  feedback: string | null;
};

const CATEGORIES = [
  { id: "system-design", icon: "🏗️", label: "System Design" },
  { id: "debugging", icon: "🐛", label: "Production Debug" },
  { id: "architecture", icon: "🧱", label: "Architecture" },
  { id: "leadership", icon: "👔", label: "Engineering Lead" },
  { id: "startup", icon: "🚀", label: "Startup Survival" },
];

export default function CareerBattleTool() {
  const { user } = useAuth();
  const [phase, setPhase] = useState<"lobby" | "waiting" | "active" | "submitted" | "result" | "leaderboard">("lobby");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [battle, setBattle] = useState<Battle | null>(null);
  const [answer, setAnswer] = useState("");
  const [openBattles, setOpenBattles] = useState<Battle[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [result, setResult] = useState<any>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [copied, setCopied] = useState(false);

  const callAPI = useCallback(async (body: any) => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) throw new Error("Not authenticated");
    const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/career-battle`, {
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

  const loadLobby = useCallback(async () => {
    setLoading(true);
    try {
      const [openResp, lbResp] = await Promise.all([
        callAPI({ action: "list-open" }),
        callAPI({ action: "leaderboard" }),
      ]);
      setOpenBattles(openResp.battles || []);
      setLeaderboard(lbResp.leaderboard || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [callAPI]);

  useEffect(() => { loadLobby(); }, [loadLobby]);

  // Realtime subscription for battle updates
  useEffect(() => {
    if (!battle?.id) return;
    const channel = supabase
      .channel(`battle-${battle.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "battles", filter: `id=eq.${battle.id}` },
        (payload: any) => {
          const updated = payload.new;
          setBattle(updated);
          if (updated.status === "active" && phase === "waiting") setPhase("active");
          if (updated.status === "completed") checkResult(battle.id);
        })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "battle_submissions", filter: `battle_id=eq.${battle.id}` },
        () => { if (phase === "submitted") checkResult(battle.id); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [battle?.id, phase]);

  const checkResult = async (battleId: string) => {
    try {
      const resp = await callAPI({ action: "status", battleId });
      if (resp.battle?.status === "completed" && resp.submissions?.length >= 2) {
        setSubmissions(resp.submissions);
        setBattle(resp.battle);
        setPhase("result");
      }
    } catch { /* ignore */ }
  };

  const createBattle = async (category: string) => {
    setLoading(true);
    setError(null);
    try {
      const resp = await callAPI({ action: "create", category });
      setBattle(resp.battle);
      setPhase("waiting");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const joinBattle = async (battleId: string) => {
    setLoading(true);
    setError(null);
    try {
      const resp = await callAPI({ action: "join", battleId });
      setBattle(resp.battle);
      setPhase("active");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const submitAnswer = async () => {
    if (!answer.trim() || !battle) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await callAPI({ action: "submit", battleId: battle.id, answer });
      if (resp.judged) {
        setResult(resp);
        setPhase("result");
        // Reload to get submissions
        checkResult(battle.id);
      } else {
        setPhase("submitted");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyCode = () => {
    if (battle?.join_code) {
      navigator.clipboard.writeText(battle.join_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const reset = () => {
    setPhase("lobby");
    setBattle(null);
    setAnswer("");
    setResult(null);
    setSubmissions([]);
    setError(null);
    loadLobby();
  };

  // LOBBY
  if (phase === "lobby") {
    return (
      <div className="flex flex-col h-full max-w-2xl mx-auto">
        <div className="shrink-0 px-4 py-3 border-b border-border/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Swords className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold text-foreground">Career Battle</span>
          </div>
          <button onClick={() => { setPhase("leaderboard"); }} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <Trophy className="w-3.5 h-3.5" /> Leaderboard
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Create battle */}
          <div>
            <h3 className="text-xs font-bold text-muted-foreground uppercase mb-3 flex items-center gap-1.5">
              <Plus className="w-3 h-3" /> Create Battle
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CATEGORIES.map(c => (
                <button
                  key={c.id}
                  onClick={() => createBattle(c.id)}
                  disabled={loading}
                  className="text-left p-3 rounded-xl border border-border/40 bg-card hover:border-primary/30 hover:bg-primary/5 transition-all group"
                >
                  <span className="text-lg">{c.icon}</span>
                  <p className="text-[11px] font-semibold text-foreground mt-1 group-hover:text-primary transition-colors">{c.label}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Open battles */}
          {openBattles.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-muted-foreground uppercase mb-3 flex items-center gap-1.5">
                <Users className="w-3 h-3" /> Open Battles ({openBattles.length})
              </h3>
              <div className="space-y-2">
                {openBattles.map(b => (
                  <div key={b.id} className="flex items-center justify-between p-3 rounded-xl border border-border/40 bg-card">
                    <div>
                      <span className="text-[10px] font-bold text-primary uppercase">{b.category}</span>
                      <p className="text-[12px] text-foreground/80 truncate max-w-[250px]">{b.question}</p>
                    </div>
                    <button
                      onClick={() => joinBattle(b.id)}
                      className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-[11px] font-medium flex items-center gap-1 hover:opacity-90 transition-opacity"
                    >
                      Join <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick leaderboard preview */}
          {leaderboard.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-muted-foreground uppercase mb-3 flex items-center gap-1.5">
                <Trophy className="w-3 h-3" /> Top Battlers
              </h3>
              <div className="space-y-1">
                {leaderboard.slice(0, 5).map((entry, i) => (
                  <div key={entry.user_id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-card border border-border/20">
                    <div className="flex items-center gap-2">
                      <span className={cn("text-sm font-bold", i === 0 ? "text-amber-500" : i === 1 ? "text-muted-foreground" : "text-muted-foreground/60")}>
                        {i === 0 ? "👑" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                      </span>
                      <span className="text-[11px] font-mono text-foreground/70">{entry.user_id.slice(0, 8)}…</span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px]">
                      <span className="text-green-500 font-bold">{entry.wins}W</span>
                      <span className="text-destructive font-bold">{entry.losses}L</span>
                      {entry.streak > 0 && <span className="text-amber-500">🔥{entry.streak}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center gap-2 py-4">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Loading…</span>
            </div>
          )}
          {error && <p className="text-sm text-destructive text-center">{error}</p>}
        </div>
      </div>
    );
  }

  // WAITING for opponent
  if (phase === "waiting" && battle) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-4 animate-message-in">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
          <Clock className="w-7 h-7 text-primary animate-pulse" />
        </div>
        <h2 className="text-lg font-bold text-foreground mb-2">Waiting for Opponent…</h2>
        <p className="text-sm text-muted-foreground mb-6 text-center max-w-xs">
          Share the battle code with someone to challenge them!
        </p>

        <div className="flex items-center gap-2 mb-6">
          <div className="px-4 py-2.5 rounded-xl bg-card border border-border font-mono text-lg font-bold text-primary tracking-wider">
            {battle.join_code}
          </div>
          <button onClick={copyCode} className="p-2.5 rounded-xl bg-card border border-border hover:bg-primary/5 transition-colors">
            <Copy className={cn("w-4 h-4", copied ? "text-green-500" : "text-muted-foreground")} />
          </button>
        </div>

        <div className="rounded-xl border border-border/40 bg-card p-4 max-w-sm w-full mb-4">
          <div className="text-[9px] font-bold text-primary uppercase mb-1">Question Preview</div>
          <p className="text-[12px] text-foreground/80">{battle.question}</p>
        </div>

        <button onClick={reset} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Cancel Battle</button>
      </div>
    );
  }

  // ACTIVE - answer the question
  if (phase === "active" && battle) {
    return (
      <div className="flex flex-col h-full max-w-2xl mx-auto">
        <div className="shrink-0 px-4 py-3 border-b border-border/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Swords className="w-4 h-4 text-destructive" />
            <span className="text-sm font-bold text-foreground">Battle Active</span>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive uppercase">{battle.category}</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
            <div className="text-[9px] font-bold text-primary uppercase mb-2">⚔️ Challenge Question</div>
            <p className="text-[14px] font-medium text-foreground leading-relaxed">{battle.question}</p>
          </div>

          <div>
            <label className="text-[10px] text-muted-foreground/50 mb-1 block">Your Answer</label>
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Type your answer… Be thorough, clear, and strategic."
              className="w-full h-48 px-3.5 py-2.5 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/30 transition-colors resize-none"
            />
            <div className="flex items-center justify-between mt-2">
              <span className="text-[10px] text-muted-foreground">{answer.length} characters</span>
              <span className="text-[10px] text-muted-foreground/50">AI will judge both answers</span>
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <button
            onClick={submitAnswer}
            disabled={!answer.trim() || loading}
            className="w-full px-4 py-3 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-30 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Swords className="w-4 h-4" />}
            Submit Answer
          </button>
        </div>
      </div>
    );
  }

  // SUBMITTED - waiting for opponent
  if (phase === "submitted") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-4 animate-message-in">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
        <h2 className="text-lg font-bold text-foreground mb-2">Answer Submitted!</h2>
        <p className="text-sm text-muted-foreground text-center max-w-xs">
          Waiting for your opponent to submit their answer. AI will judge both answers when ready.
        </p>
      </div>
    );
  }

  // RESULT
  if (phase === "result" && battle) {
    const mySubmission = submissions.find(s => s.user_id === user?.id);
    const opponentSubmission = submissions.find(s => s.user_id !== user?.id);
    const iWon = battle.winner_id === user?.id;
    const isDraw = battle.winner_id === null;

    return (
      <div className="flex flex-col h-full max-w-2xl mx-auto">
        <div className="shrink-0 px-4 py-3 border-b border-border/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-bold text-foreground">Battle Complete</span>
          </div>
          <button onClick={reset} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <RefreshCw className="w-3 h-3" /> New Battle
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Verdict */}
          <div className="text-center py-4 animate-message-in">
            <span className="text-5xl">{iWon ? "🏆" : isDraw ? "🤝" : "💀"}</span>
            <h2 className={cn("text-2xl font-black mt-2", iWon ? "text-green-500" : isDraw ? "text-amber-500" : "text-destructive")}>
              {iWon ? "YOU WON!" : isDraw ? "DRAW!" : "YOU LOST"}
            </h2>
          </div>

          {/* Scores comparison */}
          <div className="grid grid-cols-2 gap-3">
            <div className={cn("rounded-xl border p-4 text-center", iWon ? "border-green-500/30 bg-green-500/5" : "border-border/40 bg-card")}>
              <div className="text-[9px] font-bold text-muted-foreground uppercase mb-1">Your Score</div>
              <div className={cn("text-3xl font-black", (mySubmission?.score || 0) >= 70 ? "text-green-500" : "text-amber-500")}>
                {mySubmission?.score || 0}
              </div>
            </div>
            <div className={cn("rounded-xl border p-4 text-center", !iWon && !isDraw ? "border-green-500/30 bg-green-500/5" : "border-border/40 bg-card")}>
              <div className="text-[9px] font-bold text-muted-foreground uppercase mb-1">Opponent Score</div>
              <div className={cn("text-3xl font-black", (opponentSubmission?.score || 0) >= 70 ? "text-green-500" : "text-amber-500")}>
                {opponentSubmission?.score || 0}
              </div>
            </div>
          </div>

          {/* Question */}
          <div className="rounded-xl border border-border/40 bg-card p-3">
            <div className="text-[9px] font-bold text-muted-foreground uppercase mb-1">Question</div>
            <p className="text-[12px] text-foreground/80">{battle.question}</p>
          </div>

          {/* Feedback */}
          {mySubmission?.feedback && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
              <div className="text-[9px] font-bold text-primary uppercase mb-1">Your Feedback</div>
              <p className="text-[12px] text-foreground/80 leading-relaxed">{mySubmission.feedback}</p>
            </div>
          )}

          {/* My answer */}
          {mySubmission && (
            <div className="rounded-xl border border-border/40 bg-card p-3">
              <div className="text-[9px] font-bold text-muted-foreground uppercase mb-1">Your Answer</div>
              <p className="text-[11px] text-foreground/70 leading-relaxed whitespace-pre-line">{mySubmission.answer}</p>
            </div>
          )}

          {/* Opponent answer */}
          {opponentSubmission && (
            <div className="rounded-xl border border-border/40 bg-card p-3">
              <div className="text-[9px] font-bold text-muted-foreground uppercase mb-1">Opponent's Answer</div>
              <p className="text-[11px] text-foreground/70 leading-relaxed whitespace-pre-line">{opponentSubmission.answer}</p>
              {opponentSubmission.feedback && (
                <p className="text-[10px] text-muted-foreground mt-2 italic">{opponentSubmission.feedback}</p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // LEADERBOARD
  if (phase === "leaderboard") {
    return (
      <div className="flex flex-col h-full max-w-2xl mx-auto">
        <div className="shrink-0 px-4 py-3 border-b border-border/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-bold text-foreground">Leaderboard</span>
          </div>
          <button onClick={reset} className="text-xs text-muted-foreground hover:text-foreground transition-colors">← Back</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {leaderboard.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No battles yet. Be the first!</p>
          )}
          {leaderboard.map((entry, i) => {
            const isMe = entry.user_id === user?.id;
            const winRate = entry.wins + entry.losses + entry.draws > 0
              ? Math.round((entry.wins / (entry.wins + entry.losses + entry.draws)) * 100)
              : 0;

            return (
              <div key={entry.user_id} className={cn(
                "flex items-center justify-between px-4 py-3 rounded-xl border transition-colors",
                isMe ? "border-primary/30 bg-primary/5" : "border-border/40 bg-card"
              )}>
                <div className="flex items-center gap-3">
                  <span className={cn("text-lg font-bold w-8", i === 0 ? "text-amber-500" : i === 1 ? "text-muted-foreground" : "text-muted-foreground/50")}>
                    {i === 0 ? "👑" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                  </span>
                  <div>
                    <span className={cn("text-[12px] font-mono", isMe ? "text-primary font-bold" : "text-foreground/70")}>
                      {isMe ? "You" : `${entry.user_id.slice(0, 8)}…`}
                    </span>
                    <div className="flex items-center gap-2 text-[10px]">
                      <span className="text-green-500">{entry.wins}W</span>
                      <span className="text-destructive">{entry.losses}L</span>
                      <span className="text-muted-foreground">{entry.draws}D</span>
                      <span className="text-muted-foreground/50">({winRate}%)</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-foreground">{entry.total_score}</div>
                  <div className="text-[9px] text-muted-foreground">total pts</div>
                  {entry.streak > 0 && (
                    <div className="text-[9px] text-amber-500 font-bold flex items-center gap-0.5 justify-end">
                      <Flame className="w-2.5 h-2.5" /> {entry.streak} streak
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return null;
}
