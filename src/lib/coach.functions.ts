import { createServerFn } from "@tanstack/react-start";
import { generateText, NoObjectGeneratedError, Output } from "ai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { extractJsonObject, LessonSchema, normalizeLesson, type CoachLesson } from "./coach.schema";
import {
  clampScore,
  levelFromScore,
  nudgeScore,
  rollScore,
  seedScoreFromSelfReport,
  stepPlanForLevel,
  type SkillLevel,
} from "./coach.skill";
import { COURSE_MODULES, moduleById } from "./course";
import { tagsFromCritique, tagsFromSubject } from "./practice";

/** Records a practice event (skill-tagged) for streaks + suggestions. */
async function logPractice(
  supabase: any,
  userId: string,
  kind: "lesson" | "critique" | "module",
  subject: string,
  skills: string[],
  sourceId?: string,
) {
  const { error } = await supabase.from("practice_events").insert({
    user_id: userId,
    kind,
    subject: subject.slice(0, 200),
    skills: [...new Set(skills)].slice(0, 6),
    source_id: sourceId ?? null,
  });
  if (error) console.error("[practice_events.insert]", error);
}

export type { CoachLesson } from "./coach.schema";
export type UserSkill = {
  score: number;
  sampleCount: number;
  selfReported: boolean;
  level: SkillLevel;
};

// A single flagged region on the submitted artwork, in percentage coordinates
// (0-100, relative to image width/height) so the client can overlay it on the
// <img> at any render size without needing the original pixel dimensions.
export type CritiqueRegion = {
  x: number; // left, % of image width
  y: number; // top, % of image height
  width: number; // % of image width
  height: number; // % of image height
  category: "proportion" | "lineControl" | "shading" | "other";
  issue: string; // short label, e.g. "Ear proportion is off"
};

export type MicroDrill = {
  title: string;
  instructions: string;
  durationSeconds: number;
};

const CritiqueRegionSchema = z.object({
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  width: z.number().min(1).max(100),
  height: z.number().min(1).max(100),
  category: z.enum(["proportion", "lineControl", "shading", "other"]),
  issue: z.string().min(1).max(120),
});

const MicroDrillSchema = z.object({
  title: z.string().min(1).max(80),
  instructions: z.string().min(1).max(300),
  durationSeconds: z.number().int().min(20).max(120),
});

const CritiqueSchema = z.object({
  critique: z.string().min(1),
  skillEstimate: z.number().min(0).max(100),
  level: z.enum(["beginner", "intermediate", "advanced"]),
  lineControl: z.number().min(0).max(100).optional(),
  proportion: z.number().min(0).max(100).optional(),
  shading: z.number().min(0).max(100).optional(),
  // New: 0-3 flagged regions, worst-first. Empty array is fine (a clean piece
  // doesn't need to be flagged just to have something to show).
  regions: z.array(CritiqueRegionSchema).max(3).optional().default([]),
  // A single, focused drill targeting the single biggest issue found (usually
  // regions[0], but the model chooses what's most worth 60 seconds of practice).
  microDrill: MicroDrillSchema.optional(),
});

async function loadOrSeedSkill(
  supabase: any,
  userId: string,
): Promise<{ score: number; sample_count: number; self_reported: boolean }> {
  const { data } = await (supabase as any)
    .from("user_skill")
    .select("score, sample_count, self_reported")
    .eq("user_id", userId)
    .maybeSingle();
  if (data) return data as any;
  await (supabase as any)
    .from("user_skill")
    .insert({ user_id: userId, score: 20, sample_count: 0, self_reported: false });
  return { score: 20, sample_count: 0, self_reported: false };
}

export const getUserSkill = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<UserSkill> => {
    const row = await loadOrSeedSkill(context.supabase, context.userId);
    return {
      score: row.score,
      sampleCount: row.sample_count,
      selfReported: row.self_reported,
      level: levelFromScore(row.score),
    };
  });

export const setStartingSkill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ level: z.enum(["beginner", "intermediate", "advanced"]) }).parse(input),
  )
  .handler(async ({ data, context }): Promise<UserSkill> => {
    const score = seedScoreFromSelfReport(data.level);
    await (context.supabase as any)
      .from("user_skill")
      .upsert(
        { user_id: context.userId, score, sample_count: 0, self_reported: true },
        { onConflict: "user_id" },
      );
    return { score, sampleCount: 0, selfReported: true, level: levelFromScore(score) };
  });

export const submitLessonFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ rating: z.enum(["too_easy", "just_right", "too_hard"]) })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<UserSkill> => {
    const row = await loadOrSeedSkill(context.supabase, context.userId);
    const next = nudgeScore(row.score, data.rating);
    await (context.supabase as any)
      .from("user_skill")
      .update({ score: next })
      .eq("user_id", context.userId);
    return {
      score: next,
      sampleCount: row.sample_count,
      selfReported: row.self_reported,
      level: levelFromScore(next),
    };
  });

export const generateLesson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        subject: z.string().min(1).max(200),
        skillLevel: z.enum(["beginner", "intermediate", "advanced"]).optional(),
        moduleId: z.string().max(80).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    // Adaptive: derive level from stored skill unless caller pinned it.
    const skillRow = await loadOrSeedSkill(context.supabase, context.userId);
    const level: SkillLevel = data.skillLevel ?? levelFromScore(skillRow.score);
    const plan = stepPlanForLevel(level);
    const provider = createLovableAiGatewayProvider(key);
    let output: CoachLesson;
    try {
      const result = await generateText({
        model: provider("google/gemini-3-flash-preview"),
        output: Output.object({ schema: LessonSchema }),
        system:
          `You are a friendly, patient drawing coach adapting to the learner's current level. Return exactly one JSON object with this shape: { title: string, materials: string[], steps: [{ n: number, instruction: string, tip: string }], challenge: string }. Every field is mandatory. Every step must include n, instruction, and tip. Do not use alternate keys like text, hint, lesson, or tutorial. Keep materials to at most 6 items. STEP GRANULARITY RULE: ${plan.granularity} Return between ${plan.minSteps} and ${plan.maxSteps} steps.`,
        prompt: `Design a step-by-step drawing lesson.\nSubject: ${data.subject}\nLearner level: ${level}\nReturn between ${plan.minSteps} and ${plan.maxSteps} concrete steps at the granularity described in the system message, plus one bonus challenge.`,
      });
      output = normalizeLesson(result.output, data.subject, level);
    } catch (err) {
      if (NoObjectGeneratedError.isInstance(err) && err.text) {
        try {
          output = normalizeLesson(extractJsonObject(err.text), data.subject, level);
        } catch (parseErr) {
          console.error("[coach.lesson.normalize]", parseErr);
          output = normalizeLesson(null, data.subject, level);
        }
      } else {
        throw err;
      }
    }

    const { error } = await context.supabase.from("lessons").insert({
      user_id: context.userId,
      subject: data.subject,
      skill_level: level,
      payload: output,
    });
    if (error) console.error("[lessons.insert]", error);
    await logPractice(context.supabase, context.userId, "lesson", data.subject, tagsFromSubject(data.subject), data.moduleId ?? undefined);
    return {
      ...output,
      level,
      referenceCadence: plan.referenceCadence,
      moduleId: data.moduleId ?? null,
    };
  });

export const critiqueArtwork = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        imageDataUrl: z.string().min(32),
        subject: z.string().min(1).max(200),
        stepInstruction: z.string().max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const provider = createLovableAiGatewayProvider(key);
    let parsed: z.infer<typeof CritiqueSchema>;
    try {
      const result = await generateText({
        model: provider("google/gemini-3-flash-preview"),
        output: Output.object({ schema: CritiqueSchema }),
        system:
          "You are a kind, precise drawing coach AND a skill assessor. Look at the drawing and produce JSON with: " +
          "critique (2-4 sentences: one real strength, one concrete adjustment, one micro-exercise; never harsh), " +
          "lineControl 0-100, proportion 0-100, shading 0-100 (rate what you visibly see; 0 = absent/very shaky, 50 = solid beginner, 75 = confident intermediate, 90+ = trained). " +
          "skillEstimate is your overall 0-100 assessment weighting line control, proportion, and use of value/shading roughly equally. " +
          "level is 'beginner' (<35), 'intermediate' (35-70), or 'advanced' (70+) matching skillEstimate. Do not inflate scores to be nice. " +
          "ALSO identify up to 3 specific regions of the image that have the clearest, most fixable issues (worst first). " +
          "For each region give x, y, width, height as PERCENTAGES of the full image (0-100, origin top-left) tightly bounding just the problem area — not the whole drawing. " +
          "Tag each region's category as one of proportion, lineControl, shading, or other, and give a short (under 12 word) issue label naming exactly what's off there. " +
          "If the piece is genuinely clean, return an empty regions array rather than inventing nitpicks. " +
          "Finally, based on the single most important issue found (usually the first region), write ONE microDrill: a title, clear instructions for a focused ~30-90 second isolated practice exercise that targets just that issue (not a full new lesson), and durationSeconds.",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Subject: ${data.subject}${data.stepInstruction ? `\nCurrent step: ${data.stepInstruction}` : ""}\nCritique my drawing, assess my skill, flag specific problem regions, and give me one micro-drill.`,
              },
              { type: "image", image: data.imageDataUrl },
            ],
          },
        ],
      });
      parsed = result.output;
    } catch (err) {
      // Fallback: plain-text critique, no skill update, no regions.
      const { text } = await generateText({
        model: provider("google/gemini-3-flash-preview"),
        system:
          "You are a kind, precise drawing coach. Give 2-4 sentences: name one strength you actually see, one concrete thing to adjust next, and one micro-exercise. Never be harsh.",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Subject: ${data.subject}${data.stepInstruction ? `\nCurrent step: ${data.stepInstruction}` : ""}\nLook at my drawing and give feedback.`,
              },
              { type: "image", image: data.imageDataUrl },
            ],
          },
        ],
      });
      return { critique: text, regions: [] as CritiqueRegion[], microDrill: null as MicroDrill | null, skill: null as UserSkill | null };
    }

    // Roll the user's skill score toward the new estimate.
    const row = await loadOrSeedSkill(context.supabase, context.userId);
    const nextScore = clampScore(rollScore(row.score, row.sample_count, parsed.skillEstimate));
    const nextCount = row.sample_count + 1;
    await (context.supabase as any)
      .from("user_skill")
      .update({ score: nextScore, sample_count: nextCount, self_reported: true })
      .eq("user_id", context.userId);

    await logPractice(
      context.supabase,
      context.userId,
      "critique",
      data.subject,
      [
        ...tagsFromSubject(data.subject),
        ...tagsFromCritique({
          lineControl: parsed.lineControl ?? null,
          proportion: parsed.proportion ?? null,
          shading: parsed.shading ?? null,
        }),
      ],
    );

    return {
      critique: parsed.critique,
      breakdown: {
        lineControl: parsed.lineControl ?? null,
        proportion: parsed.proportion ?? null,
        shading: parsed.shading ?? null,
        skillEstimate: parsed.skillEstimate,
      },
      regions: parsed.regions ?? [],
      microDrill: parsed.microDrill ?? null,
      skill: {
        score: nextScore,
        sampleCount: nextCount,
        selfReported: true,
        level: levelFromScore(nextScore),
      } satisfies UserSkill,
    };
  });

export const listRecentLessons = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("lessons")
      .select("id, subject, skill_level, payload, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const generateStepImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        subject: z.string().min(1).max(200),
        instruction: z.string().min(1).max(500),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-image",
        messages: [
          {
            role: "user",
            content: `Simple, clean reference drawing showing this stage of drawing "${data.subject}": ${data.instruction}. Minimal line art on a plain neutral background, no text, no annotations, one clear illustration demonstrating the step.`,
          },
        ],
        modalities: ["image", "text"],
      }),
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      throw new Error(`Image generation failed: ${res.status} ${msg}`);
    }
    const json = (await res.json()) as { data?: { b64_json?: string }[] };
    const b64 = json.data?.[0]?.b64_json;
    if (!b64) throw new Error("No image returned");
    return { imageDataUrl: `data:image/png;base64,${b64}` };
  });

export const listCourseModules = createServerFn({ method: "GET" }).handler(async () => {
  return COURSE_MODULES;
});

export const getCourseProgress = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (context.supabase as any)
      .from("course_progress")
      .select("module_id, feedback, completed_at")
      .order("completed_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as { module_id: string; feedback: string | null; completed_at: string }[];
  });

export const markModuleComplete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        moduleId: z.string().min(1).max(80),
        feedback: z.enum(["too_easy", "just_right", "too_hard"]).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const mod = moduleById(data.moduleId);
    if (!mod) throw new Error("Unknown module");
    await (context.supabase as any)
      .from("course_progress")
      .upsert(
        { user_id: context.userId, module_id: data.moduleId, feedback: data.feedback ?? null, completed_at: new Date().toISOString() },
        { onConflict: "user_id,module_id" },
      );
    // Also nudge the score if feedback given.
    if (data.feedback) {
      const row = await loadOrSeedSkill(context.supabase, context.userId);
      const next = nudgeScore(row.score, data.feedback);
      await (context.supabase as any)
        .from("user_skill")
        .update({ score: next })
        .eq("user_id", context.userId);
    }
    await logPractice(
      context.supabase,
      context.userId,
      "module",
      mod.title,
      [...tagsFromSubject(`${mod.subjectPrompt} ${mod.focus}`)],
      mod.id,
    );
    return { ok: true };
  });
