import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { completeDrill, getTodayDrill } from "@/lib/drill.functions";
import { Timer, CheckCircle2, Loader2, Palette } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/drill")({
  head: () => ({
    meta: [
      { title: "Daily Drill — Neon Canvas" },
      { name: "description", content: "A five-minute adaptive drawing warm-up targeting your weakest skill." },
      { property: "og:title", content: "Daily Drill — Neon Canvas" },
      { property: "og:description", content: "A five-minute adaptive drawing warm-up targeting your weakest skill." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DrillPage,
});

function DrillPage() {
  const todayFn = useServerFn(getTodayDrill);
  const doneFn = useServerFn(completeDrill);
  const qc = useQueryClient();

  const { data: drill, isLoading } = useQuery({
    queryKey: ["daily-drill"],
    queryFn: () => todayFn(),
    staleTime: 5 * 60_000,
  });

  const completeMut = useMutation({
    mutationFn: () => doneFn({ data: { id: drill!.id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["daily-drill"] });
      qc.invalidateQueries({ queryKey: ["practice-stats"] });
      toast.success("Drill logged — streak kept alive.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not log drill"),
  });

  return (
    <AppShell>
      <div className="max-w-[760px] mx-auto px-6 py-10">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-neon-cyan mb-2 flex items-center gap-2">
          <Timer className="w-3.5 h-3.5" /> Daily drill
        </p>
        <h1 className="font-display font-bold text-4xl mb-6">Five minutes, one skill</h1>

        {isLoading && (
          <div className="glass rounded-2xl p-10 flex items-center gap-3 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Picking today's warm-up…
          </div>
        )}

        {drill && (
          <div className="glass rounded-2xl p-6 border border-primary/40 glow-violet">
            <p className="font-mono text-[10px] uppercase tracking-widest text-neon-violet mb-1">
              Targeting {drill.focusLabel}
            </p>
            <h2 className="font-display font-bold text-2xl">{drill.title}</h2>
            <p className="mt-3 whitespace-pre-line">{drill.instructions}</p>
            <p className="text-xs font-mono text-muted-foreground mt-3">
              About {Math.round(drill.durationSeconds / 60)} minutes
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/edit/$artworkId"
                params={{ artworkId: "new" }}
                className="px-4 py-2 rounded-md bg-primary text-primary-foreground font-mono text-xs uppercase tracking-wider glow-violet flex items-center gap-2"
              >
                <Palette className="w-4 h-4" /> Open canvas
              </Link>
              {drill.completedAt ? (
                <span className="px-4 py-2 rounded-md border border-accent/40 bg-accent/5 text-neon-cyan font-mono text-xs uppercase tracking-wider flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> Done today
                </span>
              ) : (
                <button
                  onClick={() => completeMut.mutate()}
                  disabled={completeMut.isPending}
                  className="px-4 py-2 rounded-md border border-accent/40 text-neon-cyan font-mono text-xs uppercase tracking-wider hover:bg-accent/10 disabled:opacity-50 flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" /> Mark complete
                </button>
              )}
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground mt-6">
          Drills are picked from your weakest skill axis, so they change as your critiques change.
        </p>
      </div>
    </AppShell>
  );
}