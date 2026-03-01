import { memo, useState } from "react";
import { cn } from "@/lib/utils";
import { getRank, getNextRank, getProgressToNext, SKILL_RANKS, type UserSkills } from "@/hooks/useSkillLevel";
import { Trophy, Zap, MessageSquare, Wrench, GraduationCap } from "lucide-react";

type Props = {
  skills: UserSkills | null;
  xpGained: number | null;
  collapsed?: boolean;
};

function SkillBadge({ skills, xpGained, collapsed }: Props) {
  const [expanded, setExpanded] = useState(false);
  if (!skills) return null;

  const rank = getRank(skills.xp);
  const nextRank = getNextRank(skills.xp);
  const progress = getProgressToNext(skills.xp);

  if (collapsed) {
    return (
      <div className="px-1.5 py-1">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-center p-2 rounded-lg hover:bg-sidebar-accent transition-colors"
          title={`${rank.icon} ${rank.name} — ${skills.xp} XP`}
        >
          <span className="text-base">{rank.icon}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="px-3 py-1.5">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full group"
      >
        {/* Compact bar */}
        <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-sidebar-accent/50 transition-colors">
          <span className="text-lg shrink-0">{rank.icon}</span>
          <div className="flex-1 min-w-0 text-left">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-semibold text-sidebar-foreground tracking-tight">{rank.name}</span>
              <span className="text-[10px] text-muted-foreground font-mono">{skills.xp} XP</span>
            </div>
            {/* XP bar */}
            <div className="mt-1 h-1.5 w-full rounded-full bg-sidebar-accent overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{
                  width: `${progress}%`,
                  background: rank.color,
                }}
              />
            </div>
            {nextRank && (
              <p className="text-[9px] text-muted-foreground/50 mt-0.5">
                {nextRank.minXP - skills.xp} XP to {nextRank.icon} {nextRank.name}
              </p>
            )}
          </div>
        </div>

        {/* XP popup */}
        {xpGained !== null && xpGained > 0 && (
          <div className="fixed bottom-20 right-4 animate-slide-up text-sm font-bold text-primary pointer-events-none z-50 bg-primary/10 px-3 py-1.5 rounded-full border border-primary/20">
            +{xpGained} XP ✨
          </div>
        )}
      </button>

      {/* Expanded stats */}
      {expanded && (
        <div className="mt-1 mx-1 p-3 rounded-xl bg-sidebar-accent/40 space-y-2.5 animate-scale-spring">
          <div className="flex items-center justify-between text-[11px] text-sidebar-foreground/70">
            <div className="flex items-center gap-1.5">
              <MessageSquare className="w-3 h-3" />
              <span>Messages</span>
            </div>
            <span className="font-mono font-medium">{skills.messages_sent}</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-sidebar-foreground/70">
            <div className="flex items-center gap-1.5">
              <Wrench className="w-3 h-3" />
              <span>Tools Used</span>
            </div>
            <span className="font-mono font-medium">{skills.tools_used}</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-sidebar-foreground/70">
            <div className="flex items-center gap-1.5">
              <GraduationCap className="w-3 h-3" />
              <span>Interviews</span>
            </div>
            <span className="font-mono font-medium">{skills.interviews_completed}</span>
          </div>
          <div className="h-px bg-sidebar-border/50 my-1" />
          <div className="text-[10px] text-muted-foreground/40 space-y-0.5">
            <p>+5 XP per message</p>
            <p>+10 XP per tool use</p>
            <p>+50 XP per interview</p>
            <p>+100 XP for high scores (8+)</p>
          </div>
          {/* Rank ladder */}
          <div className="h-px bg-sidebar-border/50 my-1" />
          <div className="space-y-1">
            {SKILL_RANKS.map((r) => (
              <div
                key={r.name}
                className={cn(
                  "flex items-center gap-2 text-[10px] px-1.5 py-0.5 rounded",
                  skills.xp >= r.minXP ? "text-sidebar-foreground" : "text-muted-foreground/30"
                )}
              >
                <span>{r.icon}</span>
                <span className="flex-1">{r.name}</span>
                <span className="font-mono">{r.minXP}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(SkillBadge);
