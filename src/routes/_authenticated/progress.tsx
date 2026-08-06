import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { AppShell } from "@/components/AppShell";
import { AssessPiece } from "@/components/AssessPiece";
import { getSkillHistory } from "@/lib/progress.functions";
import { SKILL_AXES, axisAverages, type SkillSnapshot } from "@/lib/skill.axes";
import { TrendingUp } from "lucide-react";

export const Route = createFileRoute("/_authenticated/progress")({
  head: () => ({
    meta: [
      { title: "Your Progress — Neon Canvas" },
      { name: "description", content: "See your drawing skill radar and how line control, proportion, value and perspective improve over time." },
      { property: "og:title", content: "Your Progress — Neon Canvas" },
      { property: "og:description", content: "Track how your drawing skills improve over time." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProgressPage,
});

function polar(cx: number, cy: number, r: number, i: number, n: number) {
  const a = (Math.PI * 2 * i) / n - Math.PI / 2;
  return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
}

function Radar({ values }: { values: (number | null)[] }) {
  const size = 260;
  const c = size / 2;
  const R = 96;
  const n = values.length;
  const rings = [0.25, 0.5, 0.75, 1];
  const pts = values.map((v, i) => polar(c, c, (R * (v ?? 0)) / 100, i, n));
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ") + " Z";
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[280px]" role="img" aria-label="Skill radar">
      {rings.map((r) => (
        <polygon
          key={r}
          points={Array.from({ length: n }, (_, i) => polar(c, c, R * r, i, n)).map((p) => `${p.x},${p.y}`).join(" ")}
          className="fill-none stroke-border"
          strokeWidth={1}
        />
      ))}
      {Array.from({ length: n }, (_, i) => polar(c, c, R, i, n)).map((p, i) => (
        <line key={i} x1={c} y1={c} x2={p.x} y2={p.y} className="stroke-border" strokeWidth={1} />
      ))}
      <path d={path} className="fill-primary/25 stroke-primary" strokeWidth={2} />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3} className="fill-accent" />
      ))}
    </svg>
  );
}

function Sparkline({ snapshots }: { snapshots: SkillSnapshot[] }) {
  const w = 640;
  const h = 120;
  if (snapshots.length < 2) return null;
  const step = w / (snapshots.length - 1);
  const d = snapshots
    .map((s, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${(h - (s.overall / 100) * h).toFixed(1)}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-28" role="img" aria-label="Overall skill over time">
      <path d={`${d} L${w},${h} L0,${h} Z`} className="fill-accent/10" />
      <path d={d} className="fill-none stroke-accent" strokeWidth={2} />
    </svg>
  );
}

function ProgressPage() {
  const historyFn = useServerFn(getSkillHistory);
  const { data: history } = useQuery({ queryKey: ["skill-history"], queryFn: () => historyFn() });
  const snapshots = useMemo(() => history ?? [], [history]);
  const now = useMemo(() => axisAverages(snapshots, 5), [snapshots]);
  const then = useMemo(() => axisAverages(snapshots.slice(0, 5), 5), [snapshots]);

  return (
    <AppShell>
      <div className="max-w-[1000px] mx-auto px-6 py-10">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-neon-cyan mb-2 flex items-center gap-2">
          <TrendingUp className="w-3.5 h-3.5" /> Progress
        </p>
        <h1 className="font-display font-bold text-4xl mb-6">Proof you're getting better</h1>

        <div className="mb-6">
          <AssessPiece />
        </div>

        {snapshots.length === 0 ? (
          <div className="glass rounded-2xl p-10 text-center">
            <p className="font-display text-lg mb-1">No charts yet</p>
            <p className="text-sm text-muted-foreground">
              Assess your first piece above and the coach will start charting your line control, proportion,
              value and perspective.
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="glass rounded-2xl p-6 flex flex-col items-center">
              <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4 self-start">
                Skill radar
              </p>
              <Radar values={SKILL_AXES.map((a) => now[a.key])} />
              <ul className="mt-4 w-full space-y-1.5">
                {SKILL_AXES.map((a) => {
                  const cur = now[a.key];
                  const prev = then[a.key];
                  const delta = cur !== null && prev !== null ? cur - prev : null;
                  return (
                    <li key={a.key} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{a.label}</span>
                      <span className="font-mono">
                        {cur === null ? "—" : Math.round(cur)}
                        {delta !== null && Math.abs(delta) >= 1 && (
                          <span className={delta > 0 ? "text-neon-cyan ml-2" : "text-muted-foreground ml-2"}>
                            {delta > 0 ? "+" : ""}
                            {Math.round(delta)}
                          </span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="glass rounded-2xl p-6">
              <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">
                Overall score over time
              </p>
              <Sparkline snapshots={snapshots} />
              <p className="text-xs text-muted-foreground mt-2">
                {snapshots.length} critique{snapshots.length === 1 ? "" : "s"} · latest{" "}
                {Math.round(snapshots[snapshots.length - 1].overall)}
              </p>
              <div className="mt-6 space-y-2">
                <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Recent pieces</p>
                {snapshots.slice(-6).reverse().map((s, i) => (
                  <div key={i} className="flex items-center justify-between text-sm border-b border-border/40 pb-1">
                    <span className="truncate mr-3">{s.subject || "Untitled"}</span>
                    <span className="font-mono text-neon-violet shrink-0">{Math.round(s.overall)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}