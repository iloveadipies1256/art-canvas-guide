import { createServerFn } from "@tanstack/react-start";
import { generateText, NoObjectGeneratedError, Output } from "ai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const LessonSchema = z.object({
  title: z.string(),
  materials: z.array(z.string()),
  steps: z.array(
    z.object({
      n: z.number(),
      instruction: z.string(),
      tip: z.string(),
    }),
  ),
  challenge: z.string(),
});

export type CoachLesson = z.infer<typeof LessonSchema>;

function gateway() {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Missing LOVABLE_API_KEY");
  return createLovableAiGatewayProvider(key);
}

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
    const provider = gateway();
    let output: CoachLesson;
    try {
      const result = await generateText({
        model: provider("google/gemini-3-flash-preview"),
        output: Output.object({ schema: LessonSchema }),
        system:
          "You are a friendly, patient drawing coach. Break every subject into concrete, doable strokes. Steps must be sequential and specific about shape, direction, and pressure. Tips should feel encouraging. Keep materials to at most 6 items and steps between 3 and 8.",
        prompt: `Design a step-by-step drawing lesson.\nSubject: ${data.subject}\nSkill level: ${data.skillLevel}\nReturn 4-6 concrete steps and one bonus challenge.`,
      });
      output = result.output;
    } catch (err) {
      if (NoObjectGeneratedError.isInstance(err) && err.text) {
        const cleaned = err.text.replace(/```json\s*|```/g, "").trim();
        const start = cleaned.search(/[\{\[]/);
        const end = cleaned.lastIndexOf("}");
        const parsed = JSON.parse(cleaned.slice(start, end + 1));
        output = LessonSchema.parse(parsed);
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
    const provider = gateway();
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