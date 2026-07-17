import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { generateLesson, listRecentLessons, type CoachLesson } from "@/lib/coach.functions";
import { Sparkles, Palette } from "lucide-react";
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
  const qc = useQueryClient();
  const [subject, setSubject] = useState("");
  const [skill, setSkill] = useState<"beginner" | "intermediate" | "advanced">("beginner");
  const [lesson, setLesson] = useState<CoachLesson | null>(null);

  const { data: recent } = useQuery({ queryKey: ["lessons"], queryFn: () => list() });

  const mut = useMutation({
    mutationFn: () => gen({ data: { subject, skillLevel: skill } }),
    onSuccess: (res) => { setLesson(res); qc.invalidateQueries({ queryKey: ["lessons"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Coach unavailable"),
  });

  return (
    <AppShell>
      <div className="max-w-[1100px] mx-auto px-6 py-10">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-neon-cyan mb-2">The AI Coach</p>
        <h1 className="font-display font-bold text-4xl mb-8">What are we drawing today?</h1>

        <div className="glass rounded-2xl p-6 glow-violet">
          <div className="flex gap-2">
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. a fox curled in autumn leaves"
              className="flex-1 px-4 py-3 rounded-lg bg-input border border-border focus:outline-none focus:ring-2 focus:ring-primary"
              onKeyDown={(e) => e.key === "Enter" && subject.trim() && mut.mutate()}
            />
            <select
              value={skill}
              onChange={(e) => setSkill(e.target.value as never)}
              className="px-3 py-3 rounded-lg bg-input border border-border font-mono text-xs uppercase"
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
            <button
              onClick={() => subject.trim() && mut.mutate()}
              disabled={mut.isPending || !subject.trim()}
              className="px-5 rounded-lg bg-primary text-primary-foreground font-mono text-xs uppercase tracking-wider glow-violet disabled:opacity-50 flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" /> {mut.isPending ? "Coaching…" : "Get lesson"}
            </button>
          </div>
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
                <p className="text-xs text-muted-foreground font-mono mt-1">{lesson.materials.join(" · ")}</p>
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