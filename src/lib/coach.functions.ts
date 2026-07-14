import { createServerFn } from "@tanstack/react-start";
import { generateText, NoObjectGeneratedError, Output } from "ai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { extractJsonObject, LessonSchema, normalizeLesson, type CoachLesson } from "./coach.schema";

export type { CoachLesson } from "./coach.schema";

export const generateLesson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        subject: z.string().min(1).max(200),
        skillLevel: z.enum(["beginner", "intermediate", "advanced"]).default("beginner"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const provider = createLovableAiGatewayProvider(key);
    let output: CoachLesson;
    try {
      const result = await generateText({
        model: provider("google/gemini-3-flash-preview"),
        output: Output.object({ schema: LessonSchema }),
        system:
          "You are a friendly, patient drawing coach. Break every subject into concrete, doable strokes. Return exactly one JSON object with this shape: { title: string, materials: string[], steps: [{ n: number, instruction: string, tip: string }], challenge: string }. Every field is mandatory. Every step must include n, instruction, and tip. Do not use alternate keys like text, hint, lesson, or tutorial. Keep materials to at most 6 items and steps between 4 and 6.",
        prompt: `Design a step-by-step drawing lesson.\nSubject: ${data.subject}\nSkill level: ${data.skillLevel}\nReturn 4-6 concrete steps and one bonus challenge.`,
      });
      output = normalizeLesson(result.output, data.subject, data.skillLevel);
    } catch (err) {
      if (NoObjectGeneratedError.isInstance(err) && err.text) {
        try {
          output = normalizeLesson(extractJsonObject(err.text), data.subject, data.skillLevel);
        } catch (parseErr) {
          console.error("[coach.lesson.normalize]", parseErr);
          output = normalizeLesson(null, data.subject, data.skillLevel);
        }
      } else {
        throw err;
      }
    }

    const { error } = await context.supabase.from("lessons").insert({
      user_id: context.userId,
      subject: data.subject,
      skill_level: data.skillLevel,
      payload: output,
    });
    if (error) console.error("[lessons.insert]", error);
    return output;
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
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const provider = createLovableAiGatewayProvider(key);
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
    return { critique: text };
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