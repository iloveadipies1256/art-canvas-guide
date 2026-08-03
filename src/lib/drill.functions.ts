import { createServerFn } from "@tanstack/react-start";
import { generateText, NoObjectGeneratedError, Output } from "ai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { axisLabel, weakestAxis, type AxisKey, type SkillSnapshot } from "./skill.axes";
import { tagsFromSubject } from "./practice";

export type DailyDrill = {
  id: string;
  drillDate: string;
  focusSkill: AxisKey;
  focusLabel: string;
  title: string;
  instructions: string;
  durationSeconds: number;
  completedAt: string | null;
};

export const getTodayDrill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DailyDrill> => {
    const today = new Date().toISOString().slice(0, 10);
    const { data: existing } = await (context.supabase as any)
      .from("daily_drills")
      .select("id, drill_date, focus_skill, subject, payload, completed_at")
      .eq("drill_date", today)
      .maybeSingle();

    if (existing) {
      const p = (existing.payload ?? {}) as { title?: string; instructions?: string; durationSeconds?: number };
      return {
        id: existing.id,
        drillDate: existing.drill_date,
        focusSkill: existing.focus_skill as AxisKey,
        focusLabel: axisLabel(existing.focus_skill),
        title: p.title ?? existing.subject,
        instructions: p.instructions ?? existing.subject,
        durationSeconds: p.durationSeconds ?? 300,
        completedAt: existing.completed_at,
      };
    }

    const { data: snapRows } = await (context.supabase as any)
      .from("skill_snapshots")
      .select("created_at, subject, overall, line_control, proportion, shading, perspective")
      .order("created_at", { ascending: true })
      .limit(50);
    const snapshots: SkillSnapshot[] = ((snapRows ?? []) as any[]).map((r) => ({
      created_at: r.created_at,
      subject: r.subject ?? "",
      overall: Number(r.overall ?? 0),
      lineControl: r.line_control === null ? null : Number(r.line_control),
      proportion: r.proportion === null ? null : Number(r.proportion),
      shading: r.shading === null ? null : Number(r.shading),
      perspective: r.perspective === null ? null : Number(r.perspective),
    }));
    const weak = weakestAxis(snapshots);

    const { data: skillRow } = await (context.supabase as any)
      .from("user_skill")
      .select("score")
      .eq("user_id", context.userId)
      .maybeSingle();
    const score = Number(skillRow?.score ?? 20);
    const level = score < 35 ? "beginner" : score < 70 ? "intermediate" : "advanced";

    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const provider = createLovableAiGatewayProvider(key);
    const schema = z.object({
      title: z.string(),
      instructions: z.string(),
      durationSeconds: z.number(),
    });

    let drill = { title: `${weak.label} warm-up`, instructions: `Spend five minutes practising ${weak.label.toLowerCase()} on a blank canvas.`, durationSeconds: 300 };
    try {
      const result = await generateText({
        model: provider("google/gemini-3-flash-preview"),
        output: Output.object({ schema }),
        system:
          "You design 5-minute daily drawing warm-up drills. Return JSON with title (under 8 words), " +
          "instructions (2-4 short sentences describing exactly what to draw and how, repeatable on a blank canvas, no materials beyond a canvas), " +
          "and durationSeconds (between 120 and 600). The drill must isolate ONE skill — do not turn it into a full illustration.",
        prompt: `Design today's warm-up drill.\nSkill to target: ${weak.label}\nLearner level: ${level}\nMake it feel fresh, specific and finishable in five minutes.`,
      });
      drill = {
        title: result.output.title.slice(0, 80),
        instructions: result.output.instructions.slice(0, 600),
        durationSeconds: Math.max(120, Math.min(600, Math.round(result.output.durationSeconds || 300))),
      };
    } catch (err) {
      if (!NoObjectGeneratedError.isInstance(err)) console.error("[daily_drill.generate]", err);
    }

    const { data: inserted, error } = await (context.supabase as any)
      .from("daily_drills")
      .insert({
        user_id: context.userId,
        drill_date: today,
        focus_skill: weak.key,
        subject: drill.title,
        payload: drill,
      })
      .select("id, drill_date, focus_skill, completed_at")
      .single();
    if (error) throw new Error(error.message);

    return {
      id: inserted.id,
      drillDate: inserted.drill_date,
      focusSkill: weak.key,
      focusLabel: weak.label,
      title: drill.title,
      instructions: drill.instructions,
      durationSeconds: drill.durationSeconds,
      completedAt: inserted.completed_at,
    };
  });

export const completeDrill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const now = new Date().toISOString();
    const { data: row, error } = await (context.supabase as any)
      .from("daily_drills")
      .update({ completed_at: now })
      .eq("id", data.id)
      .select("subject, focus_skill")
      .single();
    if (error) throw new Error(error.message);

    const { error: pErr } = await (context.supabase as any).from("practice_events").insert({
      user_id: context.userId,
      kind: "lesson",
      subject: `Daily drill: ${row.subject}`.slice(0, 200),
      skills: [...new Set(tagsFromSubject(`${row.subject} ${row.focus_skill}`))].slice(0, 6),
      source_id: data.id,
    });
    if (pErr) console.error("[practice_events.insert]", pErr);
    return { completedAt: now };
  });