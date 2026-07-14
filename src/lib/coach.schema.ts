import { z } from "zod";

export const LessonSchema = z.object({
  title: z.string().min(1),
  materials: z.array(z.string()),
  steps: z.array(
    z.object({
      n: z.number(),
      instruction: z.string().min(1),
      tip: z.string().min(1),
    }),
  ),
  challenge: z.string().min(1),
});

export type CoachLesson = z.infer<typeof LessonSchema>;

const fallbackTips = [
  "Use light strokes first so you can adjust the silhouette.",
  "Zoom out often and compare the biggest shapes before adding detail.",
  "Let the brightest neon marks sit on top of darker foundation shapes.",
  "If an edge feels stiff, erase a little and redraw it with one confident motion.",
  "Keep pressure varied so the drawing has rhythm instead of one flat line weight.",
  "Save tiny highlights for the very end so they feel intentional.",
];

const fallbackInstructions = (subject: string, skillLevel: string) => {
  const cleanSubject = subject.trim() || "your subject";
  const detailLevel = skillLevel === "advanced" ? "secondary forms" : "simple supporting shapes";

  return [
    `Block in ${cleanSubject} with loose geometric shapes and leave room around the edges.`,
    `Refine the main silhouette using longer, smoother strokes before adding any details.`,
    `Add ${detailLevel} that show where the light, shadow, and focal point will sit.`,
    "Build the neon glow with a darker base color, then layer brighter strokes over it.",
    "Clean the edges with the eraser and add a few crisp highlights to finish the sketch.",
  ];
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function objectText(value: unknown) {
  const record = asRecord(value);
  if (!record) return typeof value === "string" ? value.trim() : "";

  return firstText(
    record.instruction,
    record.text,
    record.description,
    record.action,
    record.task,
    record.content,
    record.step,
    record.title,
    record.name,
    record.label,
  );
}

function materialText(value: unknown) {
  const record = asRecord(value);
  return record ? firstText(record.name, record.item, record.material, record.label) : firstText(value);
}

function stepNumber(value: unknown, fallback: number) {
  const record = asRecord(value);
  const raw = record ? firstText(record.n, record.number, record.index, record.order) : "";
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function unwrapLesson(value: unknown): unknown {
  const record = asRecord(value);
  if (!record) return value;

  for (const key of ["lesson", "tutorial", "drawingLesson", "result", "output"]) {
    const nested = asRecord(record[key]);
    if (nested) return nested;
  }

  return value;
}

export function extractJsonObject(text: string) {
  const cleaned = text.replace(/```json\s*|```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("Coach response did not contain a JSON object");
  return JSON.parse(cleaned.slice(start, end + 1));
}

export function normalizeLesson(rawValue: unknown, subject: string, skillLevel: string): CoachLesson {
  const raw = asRecord(unwrapLesson(rawValue)) ?? {};
  const cleanSubject = subject.trim() || "Neon sketch";

  const rawMaterials = Array.isArray(raw.materials)
    ? raw.materials
    : Array.isArray(raw.supplies)
      ? raw.supplies
      : Array.isArray(raw.tools)
        ? raw.tools
        : [];

  const materials = rawMaterials.map(materialText).filter(Boolean).slice(0, 6);
  if (materials.length === 0) materials.push("Canvas", "Brush", "Eraser", "One bright color");

  const rawSteps = Array.isArray(raw.steps)
    ? raw.steps
    : Array.isArray(raw.instructions)
      ? raw.instructions
      : Array.isArray(raw.lessonSteps)
        ? raw.lessonSteps
        : [];

  const steps = rawSteps
    .map((step, index) => {
      const record = asRecord(step);
      const instruction = objectText(step);
      const tip = record
        ? firstText(record.tip, record.hint, record.coachTip, record.advice) || fallbackTips[index % fallbackTips.length]
        : fallbackTips[index % fallbackTips.length];

      return instruction
        ? {
            n: stepNumber(step, index + 1),
            instruction,
            tip,
          }
        : null;
    })
    .filter((step): step is CoachLesson["steps"][number] => Boolean(step))
    .slice(0, 8);

  while (steps.length < 3) {
    const index = steps.length;
    steps.push({
      n: index + 1,
      instruction: fallbackInstructions(cleanSubject, skillLevel)[index],
      tip: fallbackTips[index],
    });
  }

  return LessonSchema.parse({
    title: firstText(raw.title, raw.name, raw.heading) || `Draw ${cleanSubject}`,
    materials,
    steps: steps.map((step, index) => ({ ...step, n: index + 1 })),
    challenge:
      firstText(raw.challenge, raw.bonusChallenge, raw.bonus, raw.extraChallenge) ||
      `Add one unexpected neon detail to make ${cleanSubject} feel more personal.`,
  });
}