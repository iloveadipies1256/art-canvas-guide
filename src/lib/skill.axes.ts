/** Shared, client-safe metadata for the four tracked skill axes. */
export const SKILL_AXES = [
  { key: "lineControl", column: "line_control", label: "Line control" },
  { key: "proportion", column: "proportion", label: "Proportion" },
  { key: "shading", column: "shading", label: "Value & shading" },
  { key: "perspective", column: "perspective", label: "Perspective" },
] as const;

export type AxisKey = (typeof SKILL_AXES)[number]["key"];

export type SkillSnapshot = {
  created_at: string;
  subject: string;
  overall: number;
  lineControl: number | null;
  proportion: number | null;
  shading: number | null;
  perspective: number | null;
};

export function axisLabel(key: string): string {
  return SKILL_AXES.find((a) => a.key === key)?.label ?? key;
}

/** Average of the most recent `take` non-null values for each axis. */
export function axisAverages(snapshots: SkillSnapshot[], take = 5): Record<AxisKey, number | null> {
  const recent = snapshots.slice(-take);
  const out = {} as Record<AxisKey, number | null>;
  for (const axis of SKILL_AXES) {
    const vals = recent.map((s) => s[axis.key]).filter((v): v is number => typeof v === "number");
    out[axis.key] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  }
  return out;
}

/** The axis with the lowest recent average — what a drill should target. */
export function weakestAxis(snapshots: SkillSnapshot[]): { key: AxisKey; label: string; value: number | null } {
  const avg = axisAverages(snapshots);
  let best: { key: AxisKey; value: number | null } = { key: "lineControl", value: null };
  let bestVal = Infinity;
  for (const axis of SKILL_AXES) {
    const v = avg[axis.key];
    if (typeof v === "number" && v < bestVal) {
      bestVal = v;
      best = { key: axis.key, value: v };
    }
  }
  return { key: best.key, label: axisLabel(best.key), value: best.value };
}