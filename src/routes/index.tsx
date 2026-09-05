import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { Palette, Sparkles, Layers, Wand2 } from "lucide-react";
import { InstallAppButton } from "@/components/InstallAppButton";

const TITLE = "Neon Canvas — install the AI drawing studio";
const DESCRIPTION =
  "Draw on a neon-dark canvas with seven brushes, real layers, and an AI coach that turns any subject into a step-by-step lesson. Installable on phone and desktop.";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://art-canvas-guide.lovable.app/" },
    ],
    links: [{ rel: "canonical", href: "https://art-canvas-guide.lovable.app/" }],
  }),
});

function Landing() {
  return (
    <div className="min-h-screen">
      <header className="max-w-[1400px] mx-auto flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2 font-display font-bold text-lg tracking-tight">
          <span className="text-neon-violet text-2xl leading-none">◆</span>
          Neon<span className="text-neon-cyan">Canvas</span>
        </div>
        <nav className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider">
          <Link to="/studio" className="px-3 py-1.5 text-muted-foreground hover:text-foreground">Try canvas</Link>
          <Link to="/auth" className="px-4 py-2 rounded-md bg-primary text-primary-foreground glow-violet hover:opacity-90">Sign in</Link>
        </nav>
      </header>

      <section className="max-w-[1200px] mx-auto px-6 pt-16 pb-24 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-neon-cyan mb-6">A drawing studio with a coach</p>
        <h1 className="font-display font-bold text-5xl sm:text-7xl leading-[1.05] tracking-tight max-w-4xl mx-auto">
          Draw anything.
          <br />
          <span className="text-neon-violet">The coach</span> walks you
          <br />
          through every stroke.
        </h1>
        <p className="mt-8 text-lg text-muted-foreground max-w-xl mx-auto">
          Layered brushes, shapes, undo, export — plus an AI coach that turns any subject into a step-by-step lesson and critiques your work.
        </p>
        <div className="mt-10 flex items-center justify-center gap-3">
          <Link to="/studio" className="px-6 py-3 rounded-lg bg-primary text-primary-foreground font-mono text-xs uppercase tracking-wider glow-violet hover:opacity-90 inline-flex items-center gap-2">
            <Palette className="w-4 h-4" /> Open the canvas
          </Link>
          <Link to="/auth" className="px-6 py-3 rounded-lg border border-border font-mono text-xs uppercase tracking-wider hover:bg-secondary">
            Save your work →
          </Link>
          <InstallAppButton className="px-6 py-3" />
        </div>
      </section>

      <section className="max-w-[1200px] mx-auto px-6 pb-24 grid sm:grid-cols-3 gap-4">
        <Feature icon={<Layers className="w-5 h-5" />} title="Real layers" body="Stack, reorder, toggle. Neon-glow, marker, calligraphy, pixel, airbrush — seven brushes, plus shapes and eraser." />
        <Feature icon={<Sparkles className="w-5 h-5" />} title="AI coach" body="Give it a subject; it returns a numbered lesson. Ask for feedback and it looks at your canvas." />
        <Feature icon={<Wand2 className="w-5 h-5" />} title="Cloud gallery" body="Save to your account. Come back, pick up where you left off, export as PNG anytime." />
      </section>

      <footer className="max-w-[1200px] mx-auto px-6 py-8 font-mono text-xs text-muted-foreground border-t border-border/60 flex justify-between">
        <span>◆ Neon Canvas</span>
        <span>Built with Lovable</span>
      </footer>
    </div>
  );
}

function Feature({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="glass rounded-2xl p-6">
      <div className="w-10 h-10 rounded-lg bg-primary/20 text-neon-violet flex items-center justify-center mb-3">{icon}</div>
      <h3 className="font-display font-bold text-lg mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
