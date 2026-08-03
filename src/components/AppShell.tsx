import { Link, useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Palette, Images, Sparkles, LogOut, GraduationCap, TrendingUp, Timer } from "lucide-react";
import type { ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 glass border-b border-border/60">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between px-4 h-14">
          <Link to="/" className="flex items-center gap-2 font-display font-bold tracking-tight">
            <span className="text-neon-violet text-xl">◆</span>
            <span className="text-lg">Neon<span className="text-neon-cyan">Canvas</span></span>
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <NavLink to="/gallery" icon={<Images className="w-4 h-4" />}>Gallery</NavLink>
            <NavLink to="/coach" icon={<Sparkles className="w-4 h-4" />}>Coach</NavLink>
            <NavLink to="/course" icon={<GraduationCap className="w-4 h-4" />}>Course</NavLink>
            <NavLink to="/drill" icon={<Timer className="w-4 h-4" />}>Drill</NavLink>
            <NavLink to="/progress" icon={<TrendingUp className="w-4 h-4" />}>Progress</NavLink>
            <NavLink to="/edit/new" icon={<Palette className="w-4 h-4" />}>New</NavLink>
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                router.navigate({ to: "/" });
              }}
              className="ml-2 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors font-mono text-xs"
              aria-label="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}

function NavLink({ to, icon, children }: { to: string; icon: ReactNode; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors font-mono text-xs uppercase tracking-wider"
      activeProps={{ className: "text-foreground bg-secondary" }}
    >
      {icon} {children}
    </Link>
  );
}