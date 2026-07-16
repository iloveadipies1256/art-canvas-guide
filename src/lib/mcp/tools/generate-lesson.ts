import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { generateText, NoObjectGeneratedError, Output } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { extractJsonObject, LessonSchema, normalizeLesson } from "@/lib/coach.schema";

export default defineTool({
  name: "generate_lesson",
  title: "Generate a drawing lesson",
  description:
    "Generate a step-by-step Neon Canvas drawing lesson for a subject and skill level. Returns title, materials, numbered steps with tips, and a bonus challenge.",
  inputSchema: {
    subject: z.string().min(1).max(200).describe("What to draw, e.g. 'a fox curled in autumn leaves'."),
    skillLevel: z
      .enum(["beginner", "intermediate", "advanced"])
      .default("beginner")
      .describe("Learner skill level."),
  },
  annotations: { readOnlyHint: true, openWorldHint: true },
  handler: async ({ subject, skillLevel }, _ctx: ToolContext) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) {
      return { content: [{ type: "text", text: "Missing LOVABLE_API_KEY" }], isError: true };
    }
    const provider = createLovableAiGatewayProvider(key);
    let lesson;
    try {
      const result = await generateText({
        model: provider("google/gemini-3-flash-preview"),
        output: Output.object({ schema: LessonSchema }),
        system:
          "You are a friendly, patient drawing coach. Break every subject into concrete, doable strokes. Return exactly one JSON object with this shape: { title: string, materials: string[], steps: [{ n: number, instruction: string, tip: string }], challenge: string }. Every step must include n, instruction, and tip. Keep materials to at most 6 items and steps between 4 and 6.",
        prompt: `Design a step-by-step drawing lesson.\nSubject: ${subject}\nSkill level: ${skillLevel}\nReturn 4-6 concrete steps and one bonus challenge.`,
      });
      lesson = normalizeLesson(result.output, subject, skillLevel);
    } catch (err) {
      if (NoObjectGeneratedError.isInstance(err) && err.text) {
        try {
          lesson = normalizeLesson(extractJsonObject(err.text), subject, skillLevel);
        } catch {
          lesson = normalizeLesson(null, subject, skillLevel);
        }
      } else {
        throw err;
      }
    }
    return {
      content: [{ type: "text", text: JSON.stringify(lesson, null, 2) }],
      structuredContent: { lesson },
    };
  },
});