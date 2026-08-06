import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  critiqueArtwork,
  generateLesson,
  generateStepImage,
  type CoachLesson,
  type CritiqueRegion,
  type MicroDrill,
} from "@/lib/coach.functions";
import { Sparkles, X, MessageSquareText, Image as ImageIcon, Loader2, Timer, Play, Pause, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { SKILL_AXES } from "@/lib/skill.axes";
import { weakestFromBreakdown, weakAreaLessonSubject, type CritiqueBreakdown } from "@/lib/weak-area";
import { useVoiceGuidance, useAutoSpeakStep } from "@/hooks/useVoiceGuidance";
import { VoiceGuidanceControls } from "@/components/VoiceGuidanceControls";

const stepImageCache = new Map<string, string>();
const cacheKey = (subject: string, instruction: string) => `${subject}|||${instruction}`;

const REGION_COLORS: Record<CritiqueRegion["category"], string> = {
  proportion: "border-neon-violet",
  lineControl: "border-neon-cyan",
  shading: "border-amber-400",
  other: "border-primary",
};

const REGION_LABEL_BG: Record<CritiqueRegion["category"], string> = {
  proportion: "bg-neon-violet/90",
  lineControl: "bg-neon-cyan/90",
  shading: "bg-amber-400/90",
  other: "bg-primary/90",
};

function CritiqueImageWithRegions({ src, regions }: { src: string; regions: CritiqueRegion[] }) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  return (
    <div className="relative w-full rounded-md overflow-hidden border border-border">
      <img src={src} alt="Your submitted drawing" className="w-full block" />
      {regions.map((r, i) => (
        <button
          key={i}
          type="button"
          onClick={() => setActiveIdx(activeIdx === i ? null : i)}
          className={`absolute border-2 rounded-sm transition-all ${REGION_COLORS[r.category]} ${
            activeIdx === i ? "ring-2 ring-offset-1 ring-offset-background ring-white/60 z-10" : ""
          }`}
          style={{
            left: `${r.x}%`,
            top: `${r.y}%`,
            width: `${r.width}%`,
            height: `${r.height}%`,
          }}
          title={r.issue}
        >
          <span
            className={`absolute -top-5 left-0 whitespace-nowrap text-[9px] font-mono uppercase tracking-wide text-black px-1 py-0.5 rounded-sm ${REGION_LABEL_BG[r.category]}`}
          >
            {i + 1}
          </span>
        </button>
      ))}
      {activeIdx !== null && regions[activeIdx] && (
        <div className="absolute bottom-0 inset-x-0 bg-background/95 backdrop-blur-sm border-t border-border p-2">
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            {regions[activeIdx].category}
          </p>
          <p className="text-xs mt-0.5">{regions[activeIdx].issue}</p>
        </div>
      )}
    </div>
  );
}

function MicroDrillCard({ drill }: { drill: MicroDrill }) {
  const [secondsLeft, setSecondsLeft] = useState(drill.durationSeconds);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          setRunning(false);
          setFinished(true);
          if (intervalRef.current) clearInterval(intervalRef.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running]);

  function toggle() {
    if (finished) return;
    setRunning((r) => !r);
  }

  function reset() {
    setRunning(false);
    setFinished(false);
    setSecondsLeft(drill.durationSeconds);
  }

  const pct = Math.round(((drill.durationSeconds - secondsLeft) / drill.durationSeconds) * 100);

  return (
    <div className="p-3 rounded-lg border border-neon-cyan/40 bg-neon-cyan/5">
      <p className="text-xs font-mono uppercase tracking-widest text-neon-cyan mb-1 flex items-center gap-1">
        <Timer className="w-3 h-3" /> Micro-drill
      </p>
      <p className="text-sm font-semibold">{drill.title}</p>
      <p className="text-xs text-muted-foreground mt-1">{drill.instructions}</p>

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          disabled={finished}
          className="w-9 h-9 shrink-0 rounded-full border border-neon-cyan/50 flex items-center justify-center text-neon-cyan hover:bg-neon-cyan/10 disabled:opacity-40"
        >
          {running ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
        </button>
        <div className="flex-1">
          <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
            <div
              className="h-full bg-neon-cyan transition-all duration-1000 ease-linear"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-[10px] font-mono mt-1 text-muted-foreground">
            {finished ? "Nice — drill complete" : `${secondsLeft}s left`}
          </p>
        </div>
        {(finished || secondsLeft !== drill.durationSeconds) && (
          <button
            type="button"
            onClick={reset}
            className="w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

export function CoachDrawer({
  open,
  imageDataUrl,
  subject,
  onClose,
  onTrace,
}: {
  open: boolean;
  imageDataUrl: string | null;
  subject: string;
  onClose: () => void;
  /** Mount a step reference on the canvas as a ghost tracing layer. */
  onTrace?: (imageDataUrl: string) => void;
}) {
  const gen = useServerFn(generateLesson);
  const crit = useServerFn(critiqueArtwork);
  const stepImg = useServerFn(generateStepImage);
  const [prompt, setPrompt] = useState(subject);
  const [lesson, setLesson] = useState<CoachLesson | null>(null);
  const [done, setDone] = useState<Record<number, boolean>>({});
  const [critique, setCritique] = useState<string | null>(null);
  const [breakdown, setBreakdown] = useState<CritiqueBreakdown | null>(null);
  const [critiqueRegions, setCritiqueRegions] = useState<CritiqueRegion[]>([]);
  const [microDrill, setMicroDrill] = useState<MicroDrill | null>(null);
  const [critiquedImage, setCritiquedImage] = useState<string | null>(null);
  const [stepImages, setStepImages] = useState<Record<number, string>>({});
  const [loadingStep, setLoadingStep] = useState<number | null>(null);
  const voice = useVoiceGuidance();

  const activeStep = lesson?.steps.find((s) => !done[s.n]) ?? null;
  useAutoSpeakStep(
    voice,
    open && activeStep ? `Step ${activeStep.n}. ${activeStep.instruction}. Tip: ${activeStep.tip}` : null,
  );

  const lessonMut = useMutation({
    mutationFn: (subj: string) => gen({ data: { subject: subj, skillLevel: "beginner" } }),
    onSuccess: (res) => { voice.stop(); setLesson(res); setDone({}); setCritique(null); setCritiqueRegions([]); setMicroDrill(null); setStepImages({}); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Coach unavailable"),
  });

  async function loadStepImage(n: number, instruction: string) {
    if (stepImages[n] || loadingStep === n) return;
    const key = cacheKey(prompt || subject, instruction);
    const cached = stepImageCache.get(key);
    if (cached) {
      setStepImages((m) => ({ ...m, [n]: cached }));
      return;
    }
    setLoadingStep(n);
    try {
      const res = await stepImg({ data: { subject: prompt || subject, instruction } });
      stepImageCache.set(key, res.imageDataUrl);
      setStepImages((m) => ({ ...m, [n]: res.imageDataUrl }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not generate image");
    } finally {
      setLoadingStep(null);
    }
  }

  const critMut = useMutation({
    mutationFn: () => crit({
      data: {
        imageDataUrl: imageDataUrl!,
        subject: prompt || subject,
        stepInstruction: lesson?.steps.find((s) => !done[s.n])?.instruction,
      },
    }),
    onSuccess: (res) => {
      setCritique(res.critique);
      setBreakdown((res as { breakdown?: CritiqueBreakdown }).breakdown ?? null);
      setCritiqueRegions(res.regions ?? []);
      setMicroDrill(res.microDrill ?? null);
      setCritiquedImage(imageDataUrl);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Coach unavailable"),
  });

  const weakest = weakestFromBreakdown(breakdown);

  const improveMut = useMutation({
    mutationFn: () =>
      gen({ data: { subject: weakAreaLessonSubject(weakest.key, prompt || subject) } }),
    onSuccess: (res) => {
      voice.stop();
      setLesson(res);
      setDone({});
      setStepImages({});
      setCritique(null);
      setBreakdown(null);
      setCritiqueRegions([]);
      setMicroDrill(null);
      toast.success(`New lesson: ${res.title}`);
    },
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
        <button onClick={() => { voice.stop(); onClose(); }} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
      </div>

      <div className="px-4 py-2 border-b border-border/60">
        <VoiceGuidanceControls voice={voice} compact />
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
                <li
                  key={s.n}
                  className={`rounded-lg border p-3 ${
                    done[s.n]
                      ? "border-accent/40 bg-accent/5"
                      : activeStep?.n === s.n
                        ? "border-primary/60 bg-primary/5"
                        : "border-border/60"
                  }`}
                >
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!done[s.n]}
                      onChange={(e) => { voice.stop(); setDone((d) => ({ ...d, [s.n]: e.target.checked })); }}
                      className="mt-1 accent-primary"
                    />
                    <div className="flex-1">
                      <p className="text-sm">
                        <span className="font-mono text-neon-violet mr-2">{String(s.n).padStart(2, "0")}</span>
                        {s.instruction}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">Tip: {s.tip}</p>
                      {stepImages[s.n] ? (
                        <div className="mt-2">
                          <img
                            src={stepImages[s.n]}
                            alt={`Step ${s.n} reference`}
                            className="rounded-md border border-border w-full"
                          />
                          {onTrace && (
                            <button
                              type="button"
                              onClick={(e) => { e.preventDefault(); onTrace(stepImages[s.n]); }}
                              className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-neon-violet hover:opacity-80"
                            >
                              <ImageIcon className="w-3 h-3" /> Trace this on canvas
                            </button>
                          )}
                        </div>
                      ) : loadingStep === s.n ? (
                        <div className="mt-2 rounded-md border border-border w-full aspect-square bg-secondary/50 overflow-hidden relative">
                          <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-primary/10 via-transparent to-accent/10" />
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[11px] font-mono uppercase tracking-wider text-neon-cyan">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Drawing reference…
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); loadStepImage(s.n, s.instruction); }}
                          disabled={loadingStep !== null}
                          className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-neon-cyan hover:opacity-80 disabled:opacity-50"
                        >
                          <ImageIcon className="w-3 h-3" />
                          Show reference
                        </button>
                      )}
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
          <div className="space-y-3">
            <div className="p-3 rounded-lg border border-primary/40 bg-primary/5">
              <p className="text-xs font-mono uppercase tracking-widest text-neon-violet mb-1 flex items-center gap-1">
                <MessageSquareText className="w-3 h-3" /> Feedback
              </p>
              <p className="text-sm whitespace-pre-line">{critique}</p>
            </div>

            {breakdown && (
              <div className="p-3 rounded-lg border border-accent/40 bg-accent/5">
                <p className="text-xs font-mono uppercase tracking-widest text-neon-cyan mb-2">
                  Assessment complete
                </p>
                <ul className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {SKILL_AXES.map((a) => (
                    <li key={a.key} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{a.label}</span>
                      <span className={`font-mono ${weakest.key === a.key ? "text-neon-violet" : ""}`}>
                        {breakdown[a.key] === null ? "—" : Math.round(breakdown[a.key] as number)}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground mt-2">
                  Weakest right now: <span className="text-neon-violet">{weakest.label.toLowerCase()}</span>
                  {weakest.value !== null ? ` (${Math.round(weakest.value)})` : ""}.
                </p>
                <button
                  type="button"
                  onClick={() => improveMut.mutate()}
                  disabled={improveMut.isPending}
                  className="mt-3 w-full px-3 py-2 rounded-md bg-primary text-primary-foreground text-xs font-mono uppercase tracking-wider glow-violet disabled:opacity-50 inline-flex items-center justify-center gap-2"
                >
                  {improveMut.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  {improveMut.isPending
                    ? "Building lesson…"
                    : `Get a lesson to improve your ${weakest.label.toLowerCase()}`}
                </button>
              </div>
            )}

            {critiquedImage && critiqueRegions.length > 0 && (
              <div>
                <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1.5">
                  Tap a marker for details
                </p>
                <CritiqueImageWithRegions src={critiquedImage} regions={critiqueRegions} />
              </div>
            )}

            {microDrill && <MicroDrillCard drill={microDrill} key={microDrill.title} />}
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
