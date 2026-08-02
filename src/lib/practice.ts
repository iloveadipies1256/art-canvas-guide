/**
 * Drawing-specific practice tracking: skill tagging, streaks, and
 * "what should I try next" suggestions. Pure logic — safe on client + server.
 */

export type SkillTag =
  | "ovals"
  | "ellipses"
  | "circles"
  | "straight-lines"
  | "line-control"
  | "proportion"
  | "shading"
  | "perspective"
  | "gesture"
  | "anatomy"
  | "faces"
  | "texture"
  | "composition"
  | "animals"
  | "landscape";

export const SKILL_LABELS: Record<SkillTag, string> = {
  ovals: "Ovals",
  ellipses: "Ellipses",
  circles: "Circles",
  "straight-lines": "Straight lines",
  "line-control": "Line control",
  proportion: "Proportion",
  shading: "Shading & value",
  perspective: "Perspective",
  gesture: "Gesture",
  anatomy: "Anatomy",
  faces: "Faces & portraits",
  texture: "Texture",
  composition: "Composition",
  animals: "Animals",
  landscape: "Landscape",
};

const SUBJECT_MATCHERS: { tag: SkillTag; words: string[] }[] = [
  { tag: "ovals", words: ["oval", "egg", "head shape", "blob"] },
  { tag: "ellipses", words: ["ellipse", "cylinder", "mug", "cup", "wheel", "bottle", "can", "plate", "bowl", "tire"] },
  { tag: "circles", words: ["circle", "sphere", "ball", "apple", "orange", "moon", "bubble"] },
  { tag: "straight-lines", words: ["straight line", "line drill", "box", "cube", "building", "ruler", "practice sheet"] },
  { tag: "line-control", words: ["line control", "linework", "contour", "outline", "ink", "hatch"] },
  { tag: "proportion", words: ["proportion", "measure", "still life", "object", "figure", "body", "skeleton"] },
  { tag: "shading", words: ["shading", "shadow", "light", "value", "render", "highlight", "form", "tonal"] },
  { tag: "perspective", words: ["perspective", "vanishing", "horizon", "street", "room", "interior", "city", "depth"] },
  { tag: "gesture", words: ["gesture", "pose", "action", "dancer", "running", "motion"] },
  { tag: "anatomy", words: ["anatomy", "hand", "arm", "muscle", "torso", "leg", "foot"] },
  { tag: "faces", words: ["face", "portrait", "head", "eye", "nose", "mouth", "hair", "loomis"] },
  { tag: "texture", words: ["texture", "fur", "feather", "scale", "wood", "fabric", "rock", "grass"] },
  { tag: "composition", words: ["composition", "scene", "layout", "thumbnail"] },
  { tag: "animals", words: ["cat", "dog", "fish", "koi", "bird", "fox", "horse", "dragon", "animal", "wolf", "rabbit"] },
  { tag: "landscape", words: ["landscape", "mountain", "tree", "forest", "sunset", "cloud", "river", "sea", "ocean"] },
];

/** Derive skill tags from a free-text lesson subject / module prompt. */
export function tagsFromSubject(subject: string): SkillTag[] {
  const s = subject.toLowerCase();
  const tags = new Set<SkillTag>();
  for (const m of SUBJECT_MATCHERS) {
    if (m.words.some((w) => s.includes(w))) tags.add(m.tag);
  }
  if (tags.size === 0) tags.add("line-control");
  return [...tags].slice(0, 5);
}

/**
 * Derive tags from a critique breakdown: the weakest visible categories are
 * what the session actually exercised / needs work on.
 */
export function tagsFromCritique(breakdown: {
  lineControl?: number | null;
  proportion?: number | null;
  shading?: number | null;
}): SkillTag[] {
  const entries: [SkillTag, number][] = [];
  if (typeof breakdown.lineControl === "number") entries.push(["line-control", breakdown.lineControl]);
  if (typeof breakdown.proportion === "number") entries.push(["proportion", breakdown.proportion]);
  if (typeof breakdown.shading === "number") entries.push(["shading", breakdown.shading]);
  if (entries.length === 0) return [];
  entries.sort((a, b) => a[1] - b[1]);
  // The two weakest categories are the ones this session is "about".
  return entries.slice(0, 2).map(([t]) => t);
}

export function labelForTag(tag: string): string {
  return SKILL_LABELS[tag as SkillTag] ?? tag.replace(/-/g, " ");
}

/* ------------------------------- streaks -------------------------------- */

function dayKey(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

function shiftDay(key: string, days: number): string {
  const d = new Date(`${key}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Consecutive days (ending today or yesterday) with at least one practice event. */
export function computeStreak(timestamps: string[], now: Date = new Date()): number {
  if (timestamps.length === 0) return 0;
  const days = new Set(timestamps.map(dayKey));
  const today = now.toISOString().slice(0, 10);
  let cursor = days.has(today) ? today : shiftDay(today, -1);
  if (!days.has(cursor)) return 0;
  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor = shiftDay(cursor, -1);
  }
  return streak;
}

export function practicedToday(timestamps: string[], now: Date = new Date()): boolean {
  const today = now.toISOString().slice(0, 10);
  return timestamps.some((t) => dayKey(t) === today);
}

/* ------------------------------ suggestions ------------------------------ */

export type PracticeEvent = {
  kind: "lesson" | "critique" | "module";
  subject: string;
  skills: string[];
  created_at: string;
};

export type SkillCount = { tag: string; label: string; count: number };

/** Count tag frequency across the most recent N sessions (a session = one day). */
export function recentSkillCounts(events: PracticeEvent[], sessions = 5): SkillCount[] {
  const days = [...new Set(events.map((e) => dayKey(e.created_at)))].sort().reverse().slice(0, sessions);
  const inWindow = new Set(days);
  const counts = new Map<string, Set<string>>();
  for (const e of events) {
    const d = dayKey(e.created_at);
    if (!inWindow.has(d)) continue;
    for (const s of e.skills) {
      if (!counts.has(s)) counts.set(s, new Set());
      counts.get(s)!.add(d);
    }
  }
  return [...counts.entries()]
    .map(([tag, ds]) => ({ tag, label: labelForTag(tag), count: ds.size }))
    .sort((a, b) => b.count - a.count);
}

export type NextSkillSuggestion = {
  fromTag: string;
  fromLabel: string;
  hitDays: number;
  windowDays: number;
  suggestedTag: SkillTag;
  suggestedLabel: string;
  /** Prompt fed straight into the lesson generator. */
  lessonSubject: string;
  message: string;
};

const PROGRESSIONS: Record<string, { tag: SkillTag; subject: string; pitch: string }> = {
  ovals: { tag: "ellipses", subject: "ellipses in perspective — a stack of tilted cylinders and rims", pitch: "ready to try ellipses in perspective?" },
  circles: { tag: "shading", subject: "a shaded sphere with core shadow, highlight and cast shadow", pitch: "time to turn those circles into shaded spheres?" },
  ellipses: { tag: "perspective", subject: "a cylinder-based object (mug, can) drawn in two-point perspective", pitch: "try putting those ellipses into two-point perspective?" },
  "straight-lines": { tag: "perspective", subject: "a simple box in one-point perspective with a horizon line and vanishing point", pitch: "ready to send those lines to a vanishing point?" },
  "line-control": { tag: "proportion", subject: "a simple still life measured for accurate proportions", pitch: "your linework is getting reps — try a proportion challenge?" },
  proportion: { tag: "shading", subject: "a simple object rendered with a clear light source and value range", pitch: "want to add light and shadow on top of that accuracy?" },
  shading: { tag: "texture", subject: "a textured surface study — fur, fabric and rough stone side by side", pitch: "ready to push shading into texture?" },
  perspective: { tag: "composition", subject: "a small scene composed with foreground, midground and background depth", pitch: "want to use that perspective in a full composition?" },
  faces: { tag: "anatomy", subject: "hands and forearms studied from simple construction shapes", pitch: "faces are covered — how about hands?" },
  gesture: { tag: "anatomy", subject: "a figure built from gesture into simple anatomical masses", pitch: "want to build anatomy on top of your gestures?" },
  animals: { tag: "gesture", subject: "fast 30-second animal gesture drawings capturing motion", pitch: "try loosening up with animal gestures?" },
  landscape: { tag: "composition", subject: "a landscape thumbnail study focused on composition and value grouping", pitch: "want to work the composition side next?" },
  anatomy: { tag: "gesture", subject: "quick gesture poses that keep anatomy loose and alive", pitch: "balance that anatomy with some gesture work?" },
  texture: { tag: "composition", subject: "a scene where texture is used to guide the eye through the composition", pitch: "want to use texture compositionally?" },
  composition: { tag: "shading", subject: "a composed scene rendered with a strong three-value structure", pitch: "ready to render that composition in value?" },
};

/** Fires once a tag shows up in >= 3 of the last 5 practice days. */
export function suggestNextSkill(events: PracticeEvent[], sessions = 5): NextSkillSuggestion | null {
  const days = [...new Set(events.map((e) => dayKey(e.created_at)))].sort().reverse().slice(0, sessions);
  if (days.length < 3) return null;
  const counts = recentSkillCounts(events, sessions);
  const top = counts[0];
  if (!top || top.count < 3) return null;
  const prog = PROGRESSIONS[top.tag];
  if (!prog) return null;
  // Don't suggest something they're already grinding.
  if (counts.some((c) => c.tag === prog.tag && c.count >= top.count)) return null;
  return {
    fromTag: top.tag,
    fromLabel: top.label,
    hitDays: top.count,
    windowDays: days.length,
    suggestedTag: prog.tag,
    suggestedLabel: SKILL_LABELS[prog.tag],
    lessonSubject: prog.subject,
    message: `You've practiced ${top.label.toLowerCase()} in ${top.count} of your last ${days.length} sessions — ${prog.pitch}`,
  };
}
