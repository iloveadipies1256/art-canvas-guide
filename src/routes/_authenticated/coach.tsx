import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import {
  generateLesson,
  getUserSkill,
  listRecentLessons,
  setStartingSkill,
  submitLessonFeedback,
  type CoachLesson,
  type UserSkill,
} from "@/lib/coach.functions";
import { levelBadge } from "@/lib/course";
import { PracticeStatsPanel } from "@/components/PracticeStats";
import type { SkillLevel } from "@/lib/coach.skill";
import { Sparkles, Palette, GraduationCap } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/coach")({
  head: () => ({
    meta: [
      { title: "AI Coach — Neon Canvas" },
      { name: "description", content: "Generate step-by-step drawing lessons on any subject." },
    ],
  }),
  component: CoachPage,
});

const SUGGESTIONS = [
  "Koi fish in a pond",
  "Sunset over mountains",
  "Cyberpunk street at night",
  "A cat wearing headphones",
  "Retro spaceship",
  "Fresh croissant",
];

function CoachPage() {
  const gen = useServerFn(generateLesson);
  const list = useServerFn(listRecentLessons);
  const skillFn = useServerFn(getUserSkill);
  const seedFn = useServerFn(setStartingSkill);
  const feedbackFn = useServerFn(submitLessonFeedback);
  const qc = useQueryClient();
  const [subject, setSubject] = useState("");
  const [lesson, setLesson] = useState<(CoachLesson & { level?: SkillLevel }) | null>(null);
  const [feedbackGiven, setFeedbackGiven] = useState(false);

  const { data: recent } = useQuery({ queryKey: ["lessons"], queryFn: () => list() });
  const { data: skill } = useQuery<UserSkill>({ queryKey: ["user-skill"], queryFn: () => skillFn() });

  const mut = useMutation({
    mutationFn: () => gen({ data: { subject } }),
    onSuccess: (res) => {
      setLesson(res);
      setFeedbackGiven(false);
      qc.invalidateQueries({ queryKey: ["lessons"] });
      qc.invalidateQueries({ queryKey: ["practice-stats"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Coach unavailable"),
  });

  function startSuggested(nextSubject: string) {
    setSubject(nextSubject);
    mutSuggested(nextSubject);
  }

  function mutSuggested(nextSubject: string) {
    gen({ data: { subject: nextSubject } })
      .then((res) => {
        setLesson(res);
        setFeedbackGiven(false);
        qc.invalidateQueries({ queryKey: ["lessons"] });
        qc.invalidateQueries({ queryKey: ["practice-stats"] });
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Coach unavailable"));
  }

  const seedMut = useMutation({
    mutationFn: (level: SkillLevel) => seedFn({ data: { level } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["user-skill"] }),
  });

  const rateMut = useMutation({
    mutationFn: (rating: "too_easy" | "just_right" | "too_hard") => feedbackFn({ data: { rating } }),
    onSuccess: (res) => {
      qc.setQueryData(["user-skill"], res);
      setFeedbackGiven(true);
      toast.success(`Got it — coaching at ${levelBadge(res.level)} level.`);
    },
  });

  const needsSeed = skill && !skill.selfReported;

  return (
    <AppShell>
      <div className="max-w-[1100px] mx-auto px-6 py-10">
        <div className="flex items-center justify-between gap-4 mb-8">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-neon-cyan mb-2">The AI Coach</p>
            <h1 className="font-display font-bold text-4xl">What are we drawing today?</h1>
          </div>
          {skill && (
            <div className="hidden sm:flex flex-col items-end gap-1">
              <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Your level</span>
              <span className="font-mono text-xs px-3 py-1 rounded-full border border-primary/40 bg-primary/10 text-neon-violet">
                {levelBadge(skill.level)} · {Math.round(skill.score)}
              </span>
            </div>
          )}
        </div>

        <div className="mb-6">
          <Link
            to="/course"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-accent/40 bg-accent/5 text-neon-cyan font-mono text-xs uppercase tracking-wider hover:bg-accent/10"
          >
            <GraduationCap className="w-4 h-4" /> Follow the Learn-to-Draw course
          </Link>
        </div>

        <div className="mb-6">
          <PracticeStatsPanel onStartSuggestion={startSuggested} />
        </div>

        {needsSeed && (
          <div className="glass rounded-2xl p-6 mb-6 border border-primary/30 glow-violet">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-neon-violet mb-2">First time here</p>
            <h2 className="font-display font-bold text-xl mb-1">Where are you starting from?</h2>
            <p className="text-sm text-muted-foreground mb-4">
              This seeds your coach. It'll self-correct as you draw and give feedback.
            </p>
            <div className="grid sm:grid-cols-3 gap-2">
              {(
                [
                  { level: "beginner" as const, label: "Total beginner", hint: "I rarely draw" },
                  { level: "intermediate" as const, label: "Some practice", hint: "I've drawn a bit" },
                  { level: "advanced" as const, label: "Experienced", hint: "I draw regularly" },
                ]
              ).map((opt) => (
                <button
                  key={opt.level}
                  onClick={() => seedMut.mutate(opt.level)}
                  disabled={seedMut.isPending}
                  className="text-left p-4 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-colors disabled:opacity-50"
                >
                  <p className="font-display font-medium">{opt.label}</p>
                  <p className="text-xs text-muted-foreground mt-1">{opt.hint}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="glass rounded-2xl p-6 glow-violet">
          <div className="flex gap-2">
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. a fox curled in autumn leaves"
              className="flex-1 px-4 py-3 rounded-lg bg-input border border-border focus:outline-none focus:ring-2 focus:ring-primary"
              onKeyDown={(e) => e.key === "Enter" && subject.trim() && mut.mutate()}
            />
            <button
              onClick={() => subject.trim() && mut.mutate()}
              disabled={mut.isPending || !subject.trim()}
              className="px-5 rounded-lg bg-primary text-primary-foreground font-mono text-xs uppercase tracking-wider glow-violet disabled:opacity-50 flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" /> {mut.isPending ? "Coaching…" : "Get lesson"}
            </button>
          </div>
          {skill && (
            <p className="text-[11px] font-mono text-muted-foreground mt-3">
              Steps will be tuned for <span className="text-neon-cyan">{levelBadge(skill.level).toLowerCase()}</span> level.
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setSubject(s)}
                className="px-3 py-1 rounded-full border border-border text-xs text-muted-foreground hover:text-foreground hover:border-primary"
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {lesson && (
          <div className="glass rounded-2xl p-6 mt-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="font-display font-bold text-2xl">{lesson.title}</h2>
                <p className="text-xs text-muted-foreground font-mono mt-1">
                  {lesson.level ? `${levelBadge(lesson.level)} · ` : ""}
                  {lesson.materials.join(" · ")}
                </p>
              </div>
              <Link
                to="/edit/$artworkId"
                params={{ artworkId: "new" }}
                className="px-4 py-2 rounded-md bg-primary text-primary-foreground font-mono text-xs uppercase tracking-wider glow-violet flex items-center gap-2 shrink-0"
              >
                <Palette className="w-4 h-4" /> Draw it
              </Link>
            </div>
            <ol className="space-y-3">
              {lesson.steps.map((s) => (
                <li key={s.n} className="rounded-lg border border-border p-4">
                  <p><span className="font-mono text-neon-violet mr-2">{String(s.n).padStart(2, "0")}</span>{s.instruction}</p>
                  <p className="text-sm text-muted-foreground mt-1">Tip: {s.tip}</p>
                </li>
              ))}
            </ol>
            <div className="mt-4 p-4 rounded-lg border border-accent/40 bg-accent/5">
              <p className="text-xs font-mono uppercase tracking-widest text-neon-cyan mb-1">Bonus challenge</p>
              <p>{lesson.challenge}</p>
            </div>

            <div className="mt-6 p-4 rounded-lg border border-border bg-secondary/30">
              {feedbackGiven ? (
                <p className="text-sm text-muted-foreground text-center">Thanks — the coach adjusted your level.</p>
              ) : (
                <>
                  <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-3 text-center">
                    How was this lesson?
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
                        onClick={() => rateMut.mutate(o.r)}
                        disabled={rateMut.isPending}
                        className="px-3 py-2 rounded-md border border-border font-mono text-xs uppercase tracking-wider hover:border-primary hover:bg-primary/5 disabled:opacity-50"
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {!lesson && recent && recent.length === 0 && (
          <div className="mt-10 glass rounded-2xl p-10 text-center">
            <Sparkles className="w-8 h-8 mx-auto mb-3 text-neon-violet" />
            <p className="font-display text-lg mb-1">No lessons yet</p>
            <p className="text-sm text-muted-foreground">Type a subject above or pick a suggestion to get your first step-by-step lesson.</p>
          </div>
        )}

        {recent && recent.length > 0 && (
          <div className="mt-10">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground mb-3">Recent lessons</p>
            <div className="grid sm:grid-cols-2 gap-3">
              {recent.map((r) => (
                <button
                  key={r.id}
                  onClick={() => { setSubject(r.subject); setLesson(r.payload as CoachLesson); }}
                  className="text-left glass rounded-xl p-4 hover:glow-violet transition-shadow"
                >
                  <p className="font-display font-medium">{r.subject}</p>
                  <p className="text-xs text-muted-foreground font-mono">{r.skill_level} · {new Date(r.created_at).toLocaleDateString()}</p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}