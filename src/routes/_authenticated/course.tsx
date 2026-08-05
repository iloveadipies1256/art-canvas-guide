import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Studio } from "@/components/canvas/Studio";
import { saveArtwork } from "@/lib/artwork.functions";
import { liveNudge } from "@/lib/live.functions";
import {
  generateLesson,
  getCourseProgress,
  getUserSkill,
  markModuleComplete,
  type CoachLesson,
  type UserSkill,
} from "@/lib/coach.functions";
import { COURSE_MODULES, levelBadge } from "@/lib/course";
import type { SkillLevel } from "@/lib/coach.skill";
import { CheckCircle2, Circle, GraduationCap, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useVoiceGuidance, useAutoSpeakStep } from "@/hooks/useVoiceGuidance";
import { VoiceGuidanceControls } from "@/components/VoiceGuidanceControls";

export const Route = createFileRoute("/_authenticated/course")({
  head: () => ({
    meta: [
      { title: "Learn to Draw — Neon Canvas" },
      { name: "description", content: "A guided drawing course from basic shapes to portrait construction, adapted to your skill." },
    ],
  }),
  component: CoursePage,
});

function CoursePage() {
  const gen = useServerFn(generateLesson);
  const progressFn = useServerFn(getCourseProgress);
  const skillFn = useServerFn(getUserSkill);
  const completeFn = useServerFn(markModuleComplete);
  const save = useServerFn(saveArtwork);
  const nudge = useServerFn(liveNudge);
  const qc = useQueryClient();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [lesson, setLesson] = useState<(CoachLesson & { level?: SkillLevel }) | null>(null);
  const [saving, setSaving] = useState(false);
  const [liveChecking, setLiveChecking] = useState(false);
  const [done, setDone] = useState<Record<number, boolean>>({});
  const voice = useVoiceGuidance();
  const activeStep = lesson?.steps.find((s) => !done[s.n]) ?? null;
  useAutoSpeakStep(
    voice,
    activeStep ? `Step ${activeStep.n}. ${activeStep.instruction}. Tip: ${activeStep.tip}` : null,
  );

  const { data: skill } = useQuery<UserSkill>({ queryKey: ["user-skill"], queryFn: () => skillFn() });
  const { data: progress } = useQuery({ queryKey: ["course-progress"], queryFn: () => progressFn() });

  const completedIds = useMemo(() => new Set((progress ?? []).map((p) => p.module_id)), [progress]);
  const nextId = useMemo(
    () => COURSE_MODULES.find((m) => !completedIds.has(m.id))?.id ?? COURSE_MODULES[COURSE_MODULES.length - 1].id,
    [completedIds],
  );

  const startMut = useMutation({
    mutationFn: async (moduleId: string) => {
      const mod = COURSE_MODULES.find((m) => m.id === moduleId)!;
      setActiveId(moduleId);
      return gen({ data: { subject: mod.subjectPrompt, moduleId } });
    },
    onSuccess: (res) => { voice.stop(); setDone({}); setLesson(res); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Coach unavailable"),
  });

  const completeMut = useMutation({
    mutationFn: (v: { rating: "too_easy" | "just_right" | "too_hard" }) =>
      completeFn({ data: { moduleId: activeId!, feedback: v.rating } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["course-progress"] });
      qc.invalidateQueries({ queryKey: ["user-skill"] });
      qc.invalidateQueries({ queryKey: ["practice-stats"] });
      toast.success("Module complete!");
      voice.stop();
      setDone({});
      setLesson(null);
      setActiveId(null);
    },
  });

  const completedCount = completedIds.size;
  const pct = Math.round((completedCount / COURSE_MODULES.length) * 100);

  return (
    <AppShell>
      <div className="max-w-[1100px] mx-auto px-6 py-10">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-neon-cyan mb-2 flex items-center gap-2">
              <GraduationCap className="w-3.5 h-3.5" /> Learn to draw
            </p>
            <h1 className="font-display font-bold text-4xl">Fundamentals course</h1>
          </div>
          {skill && (
            <span className="font-mono text-xs px-3 py-1 rounded-full border border-primary/40 bg-primary/10 text-neon-violet">
              {levelBadge(skill.level)} · {Math.round(skill.score)}
            </span>
          )}
        </div>

        <div className="glass rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              Progress
            </span>
            <span className="font-mono text-xs text-neon-cyan">
              {completedCount} / {COURSE_MODULES.length} · {pct}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-secondary overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-accent transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Each module adapts to your current level — a beginner and an advanced learner get different step
            granularity for the same topic.
          </p>
        </div>

        <ol className="space-y-3">
          {COURSE_MODULES.map((mod, i) => {
            const done = completedIds.has(mod.id);
            const isNext = mod.id === nextId && !done;
            return (
              <li
                key={mod.id}
                className={`glass rounded-xl p-5 border ${
                  done
                    ? "border-accent/40 bg-accent/5"
                    : isNext
                      ? "border-primary/50 glow-violet"
                      : "border-border"
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="shrink-0 mt-1">
                    {done ? (
                      <CheckCircle2 className="w-6 h-6 text-neon-cyan" />
                    ) : (
                      <Circle className="w-6 h-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                        Module {String(i + 1).padStart(2, "0")}
                      </span>
                      {isNext && (
                        <span className="font-mono text-[10px] uppercase tracking-widest text-neon-violet">
                          Up next
                        </span>
                      )}
                    </div>
                    <h2 className="font-display font-bold text-lg mt-1">{mod.title}</h2>
                    <p className="text-sm text-muted-foreground mt-1">{mod.subtitle}</p>
                  </div>
                  <button
                    onClick={() => startMut.mutate(mod.id)}
                    disabled={startMut.isPending}
                    className="shrink-0 px-4 py-2 rounded-md bg-primary text-primary-foreground font-mono text-xs uppercase tracking-wider glow-violet disabled:opacity-50 flex items-center gap-2"
                  >
                    {startMut.isPending && activeId === mod.id ? (
                      <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading</>
                    ) : done ? (
                      <><Sparkles className="w-3.5 h-3.5" /> Redo</>
                    ) : (
                      <><Sparkles className="w-3.5 h-3.5" /> Start</>
                    )}
                  </button>
                </div>
              </li>
            );
          })}
        </ol>

        {lesson && activeId && (
          <div className="glass rounded-2xl p-6 mt-8 border border-primary/40">
            <p className="font-mono text-[10px] uppercase tracking-widest text-neon-violet mb-1">
              {COURSE_MODULES.find((m) => m.id === activeId)?.title}
              {lesson.level ? ` · ${levelBadge(lesson.level)}` : ""}
            </p>
            <h2 className="font-display font-bold text-2xl">{lesson.title}</h2>
            <p className="text-xs text-muted-foreground font-mono mt-1">{lesson.materials.join(" · ")}</p>
            <VoiceGuidanceControls voice={voice} className="mt-4" />
            <ol className="space-y-3 mt-5">
              {lesson.steps.map((s) => (
                <li
                  key={s.n}
                  className={`rounded-lg border p-4 ${
                    done[s.n]
                      ? "border-accent/40 bg-accent/5"
                      : activeStep?.n === s.n
                        ? "border-primary/60 bg-primary/5"
                        : "border-border"
                  }`}
                >
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!done[s.n]}
                      onChange={(e) => { voice.stop(); setDone((d) => ({ ...d, [s.n]: e.target.checked })); }}
                      className="mt-1.5 accent-primary"
                    />
                    <div className="flex-1">
                      <p>
                        <span className="font-mono text-neon-violet mr-2">{String(s.n).padStart(2, "0")}</span>
                        {s.instruction}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">Tip: {s.tip}</p>
                    </div>
                  </label>
                </li>
              ))}
            </ol>
            <div className="mt-4 p-4 rounded-lg border border-accent/40 bg-accent/5">
              <p className="text-xs font-mono uppercase tracking-widest text-neon-cyan mb-1">Bonus challenge</p>
              <p>{lesson.challenge}</p>
            </div>

            <div className="mt-6 p-4 rounded-lg border border-border bg-secondary/30">
              <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-3 text-center">
                Practice it here
              </p>
              <div className="rounded-lg overflow-hidden border border-border">
                <Studio
                  title={lesson.title}
                  saving={saving}
                  liveChecking={liveChecking}
                  onLiveCheck={async (img) => {
                    setLiveChecking(true);
                    try {
                      const res = await nudge({ data: { imageDataUrl: img, subject: lesson.title } });
                      toast.message(res.focus || "Live check", {
                        description: [res.encouragement, ...res.nudges].filter(Boolean).join(" · "),
                        duration: 12000,
                      });
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Coach unavailable");
                    } finally {
                      setLiveChecking(false);
                    }
                  }}
                  onSave={async ({ imageDataUrl, thumbDataUrl, width, height }) => {
                    setSaving(true);
                    try {
                      await save({
                        data: { title: lesson.title, width, height, imageDataUrl, thumbDataUrl },
                      });
                      toast.success("Saved to your gallery");
                      qc.invalidateQueries({ queryKey: ["artworks"] });
                    } finally {
                      setSaving(false);
                    }
                  }}
                />
              </div>
            </div>

            <div className="mt-6 p-4 rounded-lg border border-border bg-secondary/30">
              <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-3 text-center">
                Mark this module complete
              </p>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { r: "too_easy" as const, label: "Too easy" },
                    { r: "just_right" as const, label: "Just right" },
                    { r: "too_hard" as const, label: "Too hard" },
                  ]
                ).map((o) => (
                  <button
                    key={o.r}
                    onClick={() => completeMut.mutate({ rating: o.r })}
                    disabled={completeMut.isPending}
                    className="px-3 py-2 rounded-md border border-border font-mono text-xs uppercase tracking-wider hover:border-primary hover:bg-primary/5 disabled:opacity-50"
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}