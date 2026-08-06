import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, Sparkles, Loader2, Palette, Target } from "lucide-react";
import { toast } from "sonner";
import { critiqueArtwork, generateLesson, type CoachLesson } from "@/lib/coach.functions";
import { SKILL_AXES } from "@/lib/skill.axes";
import { weakestFromBreakdown, weakAreaLessonSubject } from "@/lib/weak-area";
import type { SkillLevel } from "@/lib/coach.skill";

/** Downscale + encode a chosen file to a JPEG data URL the model can read. */
async function fileToDataUrl(file: File, max = 1024): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  return canvas.toDataURL("image/jpeg", 0.88);
}

type Breakdown = {
  lineControl: number | null;
  proportion: number | null;
  shading: number | null;
  perspective: number | null;
  skillEstimate: number;
};

export function AssessPiece({ onAssessed }: { onAssessed?: () => void }) {
  const critiqueFn = useServerFn(critiqueArtwork);
  const lessonFn = useServerFn(generateLesson);
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const [subject, setSubject] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [critique, setCritique] = useState<string | null>(null);
  const [breakdown, setBreakdown] = useState<Breakdown | null>(null);
  const [lesson, setLesson] = useState<(CoachLesson & { level?: SkillLevel }) | null>(null);
  const [stage, setStage] = useState<"idle" | "assessing" | "recommending">("idle");

  const run = useMutation({
    mutationFn: async (dataUrl: string) => {
      setStage("assessing");
      const res = await critiqueFn({
        data: { imageDataUrl: dataUrl, subject: subject.trim() || "untitled drawing" },
      });
      const bd = (res as { breakdown?: Breakdown }).breakdown ?? null;
      setCritique(res.critique);
      setBreakdown(bd);
      await qc.invalidateQueries({ queryKey: ["skill-history"] });
      await qc.invalidateQueries({ queryKey: ["user-skill"] });
      onAssessed?.();

      setStage("recommending");
      const weakest = weakestFromBreakdown(bd);
      const rec = await lessonFn({
        data: { subject: weakAreaLessonSubject(weakest.key, subject.trim()) },
      });
      setLesson(rec);
      await qc.invalidateQueries({ queryKey: ["lessons"] });
      return { weakest };
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : "Assessment failed");
    },
    onSettled: () => setStage("idle"),
  });

  async function handleFile(file: File | undefined) {
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      setPreview(dataUrl);
      setCritique(null);
      setBreakdown(null);
      setLesson(null);
      run.mutate(dataUrl);
    } catch {
      toast.error("Couldn't read that image");
    }
  }

  const busy = run.isPending;
  const weakest = weakestFromBreakdown(breakdown);

  return (
    <div className="glass rounded-2xl p-6">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-neon-violet mb-2 flex items-center gap-2">
        <Target className="w-3.5 h-3.5" /> Assess a piece
      </p>
      <h2 className="font-display font-bold text-xl mb-1">Upload a drawing, get scored + a next lesson</h2>
      <p className="text-sm text-muted-foreground mb-4">
        The coach rates your line control, proportion, value and perspective, adds it to your progress
        charts, and picks a lesson for your weakest area.
      </p>

      <div className="flex flex-col sm:flex-row gap-2">
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="What is it? e.g. portrait study"
          className="flex-1 px-4 py-3 rounded-lg bg-input border border-border focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            void handleFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <button
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="px-5 py-3 rounded-lg bg-primary text-primary-foreground font-mono text-xs uppercase tracking-wider glow-violet disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {stage === "assessing" ? "Assessing…" : stage === "recommending" ? "Picking lesson…" : "Upload artwork"}
        </button>
        <Link
          to="/edit/$artworkId"
          params={{ artworkId: "new" }}
          className="px-5 py-3 rounded-lg border border-accent/40 bg-accent/5 text-neon-cyan font-mono text-xs uppercase tracking-wider flex items-center justify-center gap-2"
        >
          <Palette className="w-4 h-4" /> Draw one
        </Link>
      </div>

      {preview && (
        <div className="mt-5 grid sm:grid-cols-[160px_1fr] gap-4 items-start">
          <img
            src={preview}
            alt="Artwork submitted for assessment"
            className="w-full rounded-lg border border-border"
          />
          <div>
            {busy && !critique && (
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Looking at your drawing…
              </p>
            )}
            {critique && <p className="text-sm leading-relaxed">{critique}</p>}
            {breakdown && (
              <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1">
                {SKILL_AXES.map((a) => (
                  <li key={a.key} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{a.label}</span>
                    <span className={`font-mono ${weakest.key === a.key ? "text-neon-violet" : ""}`}>
                      {breakdown[a.key] === null ? "—" : Math.round(breakdown[a.key] as number)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {stage === "recommending" && !lesson && (
        <p className="mt-5 text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Building a lesson for your weakest area…
        </p>
      )}

      {lesson && (
        <div className="mt-6 rounded-xl border border-primary/40 bg-primary/5 p-5">
          <p className="font-mono text-xs uppercase tracking-widest text-neon-cyan mb-2 flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5" /> Recommended next lesson
          </p>
          <p className="text-sm text-muted-foreground mb-3">
            Your <span className="text-neon-violet">{weakest.label.toLowerCase()}</span> score
            {weakest.value !== null ? ` (${Math.round(weakest.value)})` : ""} is the lowest — here's a lesson to
            work on it.
          </p>
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
