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
    <div className="min-h-screen">
      <header className="glass border-b border-border/60 h-14 flex items-center justify-between px-4">
        <Link to="/" className="font-display font-bold flex items-center gap-2">
          <span className="text-neon-violet">◆</span> Neon<span className="text-neon-cyan">Canvas</span>
        </Link>
        <Link to="/auth" className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground font-mono text-xs uppercase tracking-wider glow-violet">
          Sign in to save
        </Link>
      </header>
      <Studio title="Untitled sketch" />
    </div>
  );
}