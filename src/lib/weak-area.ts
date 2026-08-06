import { SKILL_AXES, axisLabel, type AxisKey } from "@/lib/skill.axes";

/** Focused practice subject for each skill axis, used to target a weak area. */
export const AXIS_LESSON_SUBJECT: Record<AxisKey, string> = {
  lineControl:
    "line control drill: long confident strokes, smooth ellipses and straight lines drawn from the shoulder",
  proportion:
    "proportion drill: measuring and blocking in a simple still life with correct relative sizes",
  shading:
    "value and shading drill: a sphere, cube and cylinder rendered under a single light source",
  perspective:
    "perspective drill: a simple room interior drawn in one-point perspective",
};

export type CritiqueBreakdown = {
  lineControl: number | null;
  proportion: number | null;
  shading: number | null;
  perspective: number | null;
  skillEstimate?: number;
};

export type WeakArea = { key: AxisKey; label: string; value: number | null };

/** Lowest scored axis from a single critique breakdown. */
export function weakestFromBreakdown(b: CritiqueBreakdown | null | undefined): WeakArea {
  let best: AxisKey = "lineControl";
  let bestVal = Infinity;
  if (b) {
    for (const axis of SKILL_AXES) {
      const v = b[axis.key];
      if (typeof v === "number" && v < bestVal) {
        bestVal = v;
        best = axis.key;
      }
    }
  }
  return { key: best, label: axisLabel(best), value: Number.isFinite(bestVal) ? bestVal : null };
}

/**
 * Lesson subject that targets a weak axis while staying anchored to what the
 * user actually drew.
 */
export function weakAreaLessonSubject(key: AxisKey, drawnSubject?: string): string {
  const base = AXIS_LESSON_SUBJECT[key];
  const s = (drawnSubject ?? "").trim();
  if (!s || s.toLowerCase() === "untitled drawing") return base;
  return `${axisLabel(key).toLowerCase()} fundamentals applied to "${s}" — ${base}`;
}
