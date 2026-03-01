import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SkillRank = {
  name: string;
  minXP: number;
  color: string;
  icon: string;
};

export const SKILL_RANKS: SkillRank[] = [
  { name: "Beginner", minXP: 0, color: "hsl(0 0% 55%)", icon: "🌱" },
  { name: "Explorer", minXP: 200, color: "hsl(140 50% 45%)", icon: "🧭" },
  { name: "Intermediate", minXP: 600, color: "hsl(210 70% 55%)", icon: "⚡" },
  { name: "Advanced", minXP: 1500, color: "hsl(270 60% 55%)", icon: "🔥" },
  { name: "Elite", minXP: 3500, color: "hsl(45 90% 50%)", icon: "💎" },
  { name: "Architect", minXP: 7000, color: "hsl(280 80% 60%)", icon: "🏗️" },
  { name: "AI Master", minXP: 15000, color: "hsl(340 80% 55%)", icon: "👑" },
];

export type UserSkills = {
  id: string;
  user_id: string;
  xp: number;
  level: number;
  messages_sent: number;
  tools_used: number;
  interviews_completed: number;
};

export type XPAction = "message" | "tool_use" | "interview_complete" | "interview_high_score";

const XP_REWARDS: Record<XPAction, number> = {
  message: 5,
  tool_use: 10,
  interview_complete: 50,
  interview_high_score: 100,
};

export function getRank(xp: number): SkillRank {
  let rank = SKILL_RANKS[0];
  for (const r of SKILL_RANKS) {
    if (xp >= r.minXP) rank = r;
    else break;
  }
  return rank;
}

export function getNextRank(xp: number): SkillRank | null {
  for (const r of SKILL_RANKS) {
    if (xp < r.minXP) return r;
  }
  return null;
}

export function getProgressToNext(xp: number): number {
  const current = getRank(xp);
  const next = getNextRank(xp);
  if (!next) return 100;
  const range = next.minXP - current.minXP;
  const progress = xp - current.minXP;
  return Math.min(100, Math.round((progress / range) * 100));
}

export function useSkillLevel(userId: string | undefined) {
  const [skills, setSkills] = useState<UserSkills | null>(null);
  const [loading, setLoading] = useState(true);
  const [xpGained, setXpGained] = useState<number | null>(null);

  const fetchSkills = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    const { data } = await supabase
      .from("user_skills")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (data) {
      setSkills(data as unknown as UserSkills);
    } else {
      // Create initial record
      const { data: created } = await supabase
        .from("user_skills")
        .insert({ user_id: userId })
        .select()
        .single();
      if (created) setSkills(created as unknown as UserSkills);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchSkills(); }, [fetchSkills]);

  const awardXP = useCallback(async (action: XPAction) => {
    if (!userId || !skills) return;
    const reward = XP_REWARDS[action];
    const newXP = skills.xp + reward;
    const newLevel = SKILL_RANKS.filter(r => newXP >= r.minXP).length;

    const updates: Record<string, number> = {
      xp: newXP,
      level: newLevel,
    };
    if (action === "message") updates.messages_sent = skills.messages_sent + 1;
    if (action === "tool_use") updates.tools_used = skills.tools_used + 1;
    if (action === "interview_complete" || action === "interview_high_score") {
      updates.interviews_completed = skills.interviews_completed + 1;
    }

    const { data } = await supabase
      .from("user_skills")
      .update(updates)
      .eq("user_id", userId)
      .select()
      .single();

    if (data) {
      setSkills(data as unknown as UserSkills);
      setXpGained(reward);
      setTimeout(() => setXpGained(null), 2000);
    }
  }, [userId, skills]);

  const rank = skills ? getRank(skills.xp) : SKILL_RANKS[0];
  const nextRank = skills ? getNextRank(skills.xp) : SKILL_RANKS[1];
  const progress = skills ? getProgressToNext(skills.xp) : 0;

  return { skills, loading, awardXP, rank, nextRank, progress, xpGained };
}
