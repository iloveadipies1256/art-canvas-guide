import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Loader2, Palette, Target } from "lucide-react";
import { toast } from "sonner";
import { generateLesson, type CoachLesson } from "@/lib/coach.functions";
import { weakAreaLessonSubject, type WeakArea } from "@/lib/weak-area";

/**
 * "Your weakest area is X — here's a lesson for it" panel.
 * Generates an adaptive lesson (server derives skill level) targeted at the axis.
 */
export function WeakAreaLesson({
  weakest,
  drawnSubject,
  compact = false,
}: {
  weakest: WeakArea;
  drawnSubject?: string;
  compact?: boolean;
}) {
  const lessonFn = useServerFn(generateLesson);
  const qc = useQueryClient();
  const [lesson, setLesson] = useState<CoachLesson | null>(null);

  const gen = useMutation({
    mutationFn: () => lessonFn({ data: { subject: weakAreaLessonSubject(weakest.key, drawnSubject) } }),
    onSuccess: (res) => {
      setLesson(res);
      qc.invalidateQueries({ queryKey: ["lessons"] });
      qc.invalidateQueries({ queryKey: ["practice-stats"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Coach unavailable"),
  });

  return (
    <div className={`rounded-xl border border-primary/40 bg-primary/5 ${compact ? "p-3" : "p-5"}`}>
      <p className="font-mono text-xs uppercase tracking-widest text-neon-cyan mb-2 flex items-center gap-2">
        <Target className="w-3.5 h-3.5" /> Improve your weakest area
      </p>
      <p className={`${compact ? "text-xs" : "text-sm"} text-muted-foreground mb-3`}>
        Your <span className="text-neon-violet">{weakest.label.toLowerCase()}</span> score
        {weakest.value !== null ? ` (${Math.round(weakest.value)})` : ""} is the lowest of your tracked
        skills.
      </p>

      {!lesson && (
        <button
          onClick={() => gen.mutate()}
          disabled={gen.isPending}
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground font-mono text-xs uppercase tracking-wider glow-violet disabled:opacity-50 inline-flex items-center gap-2"
        >
          {gen.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {gen.isPending ? "Building lesson…" : `Get a lesson to improve your ${weakest.label.toLowerCase()}`}
        </button>
      )}

      {lesson && (
        <div>
          <h3 className="font-display font-bold text-lg">{lesson.title}</h3>
          <ol className="mt-3 space-y-2">
            {lesson.steps.slice(0, 4).map((s) => (
              <li key={s.n} className="text-sm">
                <span className="font-mono text-neon-violet mr-2">{String(s.n).padStart(2, "0")}</span>
                {s.instruction}
              </li>
            ))}
          </ol>
          {lesson.steps.length > 4 && (
            <p className="text-xs text-muted-foreground mt-2 font-mono">
              +{lesson.steps.length - 4} more steps in the coach
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              to="/edit/$artworkId"
              params={{ artworkId: "new" }}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground font-mono text-xs uppercase tracking-wider glow-violet flex items-center gap-2"
            >
              <Palette className="w-4 h-4" /> Start this lesson
            </Link>
            <Link
              to="/coach"
              className="px-4 py-2 rounded-md border border-border font-mono text-xs uppercase tracking-wider hover:border-primary"
            >
              Open in coach
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
