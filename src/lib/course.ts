import type { SkillLevel } from "./coach.skill";

export type CourseModule = {
  id: string;
  title: string;
  subtitle: string;
  /** Passed as the "subject" to the adaptive lesson generator. */
  subjectPrompt: string;
  focus: string;
};

export const COURSE_MODULES: CourseModule[] = [
  {
    id: "shapes-lines",
    title: "Shapes & Line Control",
    subtitle: "Warm up your hand: circles, ellipses, and confident straight lines.",
    subjectPrompt: "a practice sheet of clean circles, ellipses, and straight lines to build line control",
    focus: "line control, hand warm-up",
  },
  {
    id: "proportion",
    title: "Proportion & Simple Objects",
    subtitle: "Measure and compare — draw simple everyday objects with correct proportions.",
    subjectPrompt: "a simple everyday object (mug, apple, book) drawn with careful proportional measurement",
    focus: "proportion, measuring, silhouette",
  },
  {
    id: "perspective",
    title: "Perspective Basics",
    subtitle: "Horizon lines, vanishing points, and boxes in one- and two-point perspective.",
    subjectPrompt: "a simple box or small building in one-point perspective with a visible horizon line and vanishing point",
    focus: "perspective, horizon line, vanishing points",
  },
  {
    id: "light-shadow",
    title: "Light, Shadow & Shading",
    subtitle: "Turn flat shapes into forms with core shadow, highlight, and cast shadow.",
    subjectPrompt: "a single sphere or cylinder rendered with core shadow, highlight, reflected light, and cast shadow",
    focus: "value, shading, light source",
  },
  {
    id: "figure-portrait",
    title: "Figure & Portrait Basics",
    subtitle: "Loomis-style head construction and simple gesture figures.",
    subjectPrompt: "a simple front-facing human head using basic construction (Loomis-style ball + jaw + facial guidelines)",
    focus: "gesture, head construction, proportions",
  },
];

export function moduleById(id: string): CourseModule | undefined {
  return COURSE_MODULES.find((m) => m.id === id);
}

export function nextModule(completedIds: string[]): CourseModule | undefined {
  return COURSE_MODULES.find((m) => !completedIds.includes(m.id)) ?? COURSE_MODULES[COURSE_MODULES.length - 1];
}

export function levelBadge(level: SkillLevel): string {
  if (level === "beginner") return "Beginner";
  if (level === "intermediate") return "Intermediate";
  return "Advanced";
}