import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  computeStreak,
  practicedToday,
  recentSkillCounts,
  suggestNextSkill,
  type NextSkillSuggestion,
  type PracticeEvent,
  type SkillCount,
} from "./practice";

export type PracticeStats = {
  streak: number;
  practicedToday: boolean;
  totalSessions: number;
  recentSkills: SkillCount[];
  suggestion: NextSkillSuggestion | null;
  lastPracticedAt: string | null;
};

export const getPracticeStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PracticeStats> => {
    const { data, error } = await (context.supabase as any)
      .from("practice_events")
      .select("kind, subject, skills, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    const events = (data ?? []) as PracticeEvent[];
    const stamps = events.map((e) => e.created_at);
    const days = new Set(stamps.map((t) => new Date(t).toISOString().slice(0, 10)));
    return {
      streak: computeStreak(stamps),
      practicedToday: practicedToday(stamps),
      totalSessions: days.size,
      recentSkills: recentSkillCounts(events, 5).slice(0, 6),
      suggestion: suggestNextSkill(events),
      lastPracticedAt: stamps[0] ?? null,
    };
  });
