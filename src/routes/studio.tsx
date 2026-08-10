import { createFileRoute } from "@tanstack/react-router";
import { Studio } from "@/components/canvas/Studio";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/studio")({
  head: () => ({
    meta: [
      { title: "Studio — Neon Canvas" },
      { name: "description", content: "Try the Neon Canvas drawing studio in your browser." },
    ],
  }),
  component: PublicStudio,
});

function PublicStudio() {
  return (
    <Studio
      fullBleed
      title="Untitled sketch"
      navSlot={
        <div className="flex items-center gap-2">
          <Link
            to="/"
            className="glass rounded-full w-9 h-9 grid place-items-center text-neon-violet text-lg border border-border/60 hover:border-primary transition-colors"
            aria-label="Home"
          >
            ◆
          </Link>
          <Link
            to="/auth"
            className="px-3 h-9 inline-flex items-center rounded-full bg-primary text-primary-foreground font-mono text-[10px] uppercase tracking-wider glow-violet"
          >
            Sign in to save
          </Link>
        </div>
      }
    />
  );
}