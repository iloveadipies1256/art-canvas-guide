import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { critiqueArtwork, generateLesson, type CoachLesson } from "@/lib/coach.functions";
import { Sparkles, X, MessageSquareText } from "lucide-react";
import { toast } from "sonner";

export function CoachDrawer({
  open,
  imageDataUrl,
  subject,
  onClose,
}: {
  open: boolean;
  imageDataUrl: string | null;
  subject: string;
  onClose: () => void;
}) {
  const gen = useServerFn(generateLesson);
  const crit = useServerFn(critiqueArtwork);
  const [prompt, setPrompt] = useState(subject);
  const [lesson, setLesson] = useState<CoachLesson | null>(null);
  const [done, setDone] = useState<Record<number, boolean>>({});
  const [critique, setCritique] = useState<string | null>(null);

  const lessonMut = useMutation({
    mutationFn: (subj: string) => gen({ data: { subject: subj, skillLevel: "beginner" } }),
    onSuccess: (res) => { setLesson(res); setDone({}); setCritique(null); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Coach unavailable"),
  });

  const critMut = useMutation({
    mutationFn: () => crit({
      data: {
        imageDataUrl: imageDataUrl!,
        subject: prompt || subject,
        stepInstruction: lesson?.steps.find((s) => !done[s.n])?.instruction,
      },
    }),
    onSuccess: (res) => setCritique(res.critique),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Coach unavailable"),
  });

  if (!open) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-96 z-50 glass border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right">
      <div className="p-4 border-b border-border/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-neon-cyan" />
          <h2 className="font-display font-bold">AI Coach</h2>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
      </div>

      <div className="p-4 border-b border-border/60">
        <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Draw me a…</label>
        <div className="flex gap-2 mt-1.5">
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. koi fish, castle at dusk"
            className="flex-1 px-3 py-2 rounded-md bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            onClick={() => prompt.trim() && lessonMut.mutate(prompt.trim())}
            disabled={lessonMut.isPending}
            className="px-3 rounded-md bg-primary text-primary-foreground text-xs font-mono uppercase glow-violet disabled:opacity-50"
          >
            {lessonMut.isPending ? "…" : "Lesson"}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {lesson ? (
          <div>
            <h3 className="font-display font-bold text-lg">{lesson.title}</h3>
            {lesson.materials.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1 font-mono">
                {lesson.materials.join(" · ")}
              </p>
            )}
            <ol className="mt-4 space-y-3">
              {lesson.steps.map((s) => (
                <li key={s.n} className={`rounded-lg border p-3 ${done[s.n] ? "border-accent/40 bg-accent/5" : "border-border/60"}`}>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!done[s.n]}
                      onChange={(e) => setDone((d) => ({ ...d, [s.n]: e.target.checked }))}
                      className="mt-1 accent-primary"
                    />
                    <div className="flex-1">
                      <p className="text-sm">
                        <span className="font-mono text-neon-violet mr-2">{String(s.n).padStart(2, "0")}</span>
                        {s.instruction}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">Tip: {s.tip}</p>
                    </div>
                  </label>
                </li>
              ))}
            </ol>
            <div className="mt-4 p-3 rounded-lg border border-accent/40 bg-accent/5">
              <p className="text-xs font-mono uppercase tracking-widest text-neon-cyan mb-1">Bonus</p>
              <p className="text-sm">{lesson.challenge}</p>
            </div>
          </div>
        ) : (
          <div className="text-center text-sm text-muted-foreground pt-12">
            <Sparkles className="w-8 h-8 mx-auto mb-3 text-neon-violet" />
            Type a subject and get a step-by-step lesson.
          </div>
        )}

        {critique && (
          <div className="p-3 rounded-lg border border-primary/40 bg-primary/5">
            <p className="text-xs font-mono uppercase tracking-widest text-neon-violet mb-1 flex items-center gap-1">
              <MessageSquareText className="w-3 h-3" /> Feedback
            </p>
            <p className="text-sm whitespace-pre-line">{critique}</p>
          </div>
        )}
      </div>

      {imageDataUrl && (
        <div className="p-4 border-t border-border/60">
          <button
            onClick={() => critMut.mutate()}
            disabled={critMut.isPending}
            className="w-full px-4 py-2 rounded-md border border-accent/40 text-neon-cyan text-xs font-mono uppercase tracking-wider hover:bg-accent/10 disabled:opacity-50"
          >
            {critMut.isPending ? "Looking…" : "Give me feedback on this"}
          </button>
        </div>
      )}
    </div>
  );
}