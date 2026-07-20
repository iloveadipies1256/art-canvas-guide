export type SkillLevel = "beginner" | "intermediate" | "advanced";

export const SKILL_MIN = 0;
export const SKILL_MAX = 100;

export function levelFromScore(score: number): SkillLevel {
  if (score < 35) return "beginner";
  if (score < 70) return "intermediate";
  return "advanced";
}

export function seedScoreFromSelfReport(level: SkillLevel): number {
  if (level === "beginner") return 15;
  if (level === "intermediate") return 45;
  return 75;
}

/** Exponential moving average toward the new sample, weighted by prior count. */
export function rollScore(prev: number, sampleCount: number, estimate: number): number {
  // Cap the "prior weight" so a very seasoned user still moves on new evidence.
  const n = Math.min(Math.max(sampleCount, 0), 8);
  const next = (prev * n + estimate) / (n + 1);
  return clampScore(next);
}

export function nudgeScore(prev: number, rating: "too_easy" | "just_right" | "too_hard"): number {
  const delta = rating === "too_easy" ? 6 : rating === "too_hard" ? -6 : 1;
  return clampScore(prev + delta);
}

export function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 20;
  return Math.max(SKILL_MIN, Math.min(SKILL_MAX, n));
}

export function stepPlanForLevel(level: SkillLevel): {
  minSteps: number;
  maxSteps: number;
  granularity: string;
  referenceCadence: "every" | "alternate" | "on_demand";
} {
  if (level === "beginner") {
    return {
      minSteps: 6,
      maxSteps: 8,
      granularity:
        "Many tiny, isolated steps. Each step should be one concrete action a total beginner can copy (e.g. 'draw an oval for the head', 'add two small dots for eyes'). Do not combine actions.",
      referenceCadence: "every",
    };
  }
  if (level === "intermediate") {
    return {
      minSteps: 4,
      maxSteps: 5,
      granularity:
        "Medium-granularity steps. Combine 2-3 small actions into one step (e.g. 'block in head and shoulders as simple shapes'). Assume the user can handle basic proportions.",
      referenceCadence: "alternate",
    };
  }
  return {
    minSteps: 3,
    maxSteps: 4,
    granularity:
      "High-level milestone steps only (e.g. 'rough gesture', 'refine forms', 'add shading and detail'). Assume strong fundamentals; skip micro instructions.",
    referenceCadence: "on_demand",
  };
}