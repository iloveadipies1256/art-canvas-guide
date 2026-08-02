import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Flame, Sparkles, ArrowRight } from "lucide-react";
import { getPracticeStats, type PracticeStats as Stats } from "@/lib/practice.functions";

export function usePracticeStats() {
  const fn = useServerFn(getPracticeStats);
  return useQuery<Stats>({ queryKey: ["practice-stats"], queryFn: () => fn() });
}

function StreakFlame({ streak, today }: { streak: number; today: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`w-9 h-9 rounded-full flex items-center justify-center border ${
          today ? "border-neon-violet/60 bg-primary/10 glow-violet" : "border-border bg-secondary/40"
        }`}
      >
        <Flame className={`w-4 h-4 ${today ? "text-neon-violet" : "text-muted-foreground"}`} />
      </div>
      <div>
        <p className="font-display font-bold text-lg leading-none">
          {streak} <span className="text-sm font-normal text-muted-foreground">day{streak === 1 ? "" : "s"}</span>
        </p>
        <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mt-0.5">
          {today ? "Practiced today" : streak > 0 ? "Draw today to keep it" : "Start a streak"}
        </p>
      </div>
    </div>
  );
}

export function PracticeStatsPanel({
  onStartSuggestion,
  compact = false,
}: {
  onStartSuggestion?: (subject: string) => void;
  compact?: boolean;
}) {
  const { data } = usePracticeStats();
  if (!data) return null;

  return (
    <div
      className={`rounded-xl border border-border bg-secondary/20 ${compact ? "p-3" : "glass p-5 rounded-2xl"} space-y-3`}
    >
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <StreakFlame streak={data.streak} today={data.practicedToday} />
        <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          {data.totalSessions} practice day{data.totalSessions === 1 ? "" : "s"} total
        </p>
      </div>

      {data.recentSkills.length > 0 && (
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1.5">
            Recently practiced
          </p>
          <div className="flex flex-wrap gap-1.5">
            {data.recentSkills.map((s) => (
              <span
                key={s.tag}
                className="px-2.5 py-1 rounded-full border border-accent/30 bg-accent/5 text-neon-cyan font-mono text-[10px] uppercase tracking-wider"
              >
                {s.label} ×{s.count}
              </span>
            ))}
          </div>
        </div>
      )}

      {data.suggestion && (
        <div className="p-3 rounded-lg border border-primary/40 bg-primary/5">
          <p className="text-[10px] font-mono uppercase tracking-widest text-neon-violet mb-1 flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> Try next
          </p>
          <p className="text-sm">{data.suggestion.message}</p>
          {onStartSuggestion && (
            <button
              type="button"
              onClick={() => onStartSuggestion(data.suggestion!.lessonSubject)}
              className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground font-mono text-[10px] uppercase tracking-wider glow-violet"
            >
              Start {data.suggestion.suggestedLabel} lesson <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      {data.recentSkills.length === 0 && !data.suggestion && (
        <p className="text-xs text-muted-foreground">
          Finish a lesson, critique, or course module and your practiced skills will show up here.
        </p>
      )}
    </div>
  );
}
