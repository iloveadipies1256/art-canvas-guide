import { createServerFn } from "@tanstack/react-start";
import { generateText, NoObjectGeneratedError, Output } from "ai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

export type LiveNudge = {
  focus: string;
  nudges: string[];
  encouragement: string;
};

/**
 * Mid-drawing coaching: looks at the work-in-progress canvas and returns a few
 * short, actionable corrections instead of a full end-of-piece critique.
 */
export const liveNudge = createServerFn({ method: "POST" })
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
  .handler(async ({ data }): Promise<LiveNudge> => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const provider = createLovableAiGatewayProvider(key);
    const schema = z.object({
      focus: z.string(),
      nudges: z.array(z.string()),
      encouragement: z.string(),
    });
    const system =
      "You are a drawing coach watching over the artist's shoulder WHILE they draw. " +
      "This is an unfinished work in progress — never judge it as finished and never grade it. " +
      "Return JSON with: focus (under 8 words naming the one thing to fix right now), " +
      "nudges (2 or 3 short imperative corrections, each under 16 words, about proportion, gesture, " +
      "line confidence or value placement that the artist can act on in the next minute), " +
      "and encouragement (one warm sentence about something already working).";
    const messages = [
      {
        role: "user" as const,
        content: [
          {
            type: "text" as const,
            text: `Subject: ${data.subject}${data.stepInstruction ? `\nCurrent step: ${data.stepInstruction}` : ""}\nI'm still drawing. What should I adjust right now?`,
          },
          { type: "image" as const, image: data.imageDataUrl },
        ],
      },
    ];
    try {
      const result = await generateText({
        model: provider("google/gemini-3-flash-preview"),
        output: Output.object({ schema }),
        system,
        messages,
      });
      const out = result.output;
      return {
        focus: out.focus.slice(0, 80),
        nudges: out.nudges.slice(0, 3).map((n) => n.slice(0, 160)),
        encouragement: out.encouragement.slice(0, 200),
      };
    } catch (err) {
      if (NoObjectGeneratedError.isInstance(err) && err.text) {
        return { focus: "Keep going", nudges: [err.text.slice(0, 160)], encouragement: "" };
      }
      const { text } = await generateText({
        model: provider("google/gemini-3-flash-preview"),
        system: "You are a drawing coach watching an unfinished drawing. Give two short, kind, actionable corrections.",
        messages,
      });
      return { focus: "Keep going", nudges: [text.slice(0, 300)], encouragement: "" };
    }
  });