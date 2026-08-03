import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SkillSnapshot } from "./skill.axes";

export const getSkillHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SkillSnapshot[]> => {
    const { data, error } = await (context.supabase as any)
      .from("skill_snapshots")
      .select("created_at, subject, overall, line_control, proportion, shading, perspective")
      .order("created_at", { ascending: true })
      .limit(200);
    if (error) throw new Error(error.message);
    return ((data ?? []) as any[]).map((r) => ({
      created_at: r.created_at,
      subject: r.subject ?? "",
      overall: Number(r.overall ?? 0),
      lineControl: r.line_control === null ? null : Number(r.line_control),
      proportion: r.proportion === null ? null : Number(r.proportion),
      shading: r.shading === null ? null : Number(r.shading),
      perspective: r.perspective === null ? null : Number(r.perspective),
    }));
  });