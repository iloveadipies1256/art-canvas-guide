import { Link, useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Images, Sparkles, GraduationCap, Timer, TrendingUp, Palette, LogOut, Home } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Floating brand button for the full-bleed studio. Replaces the site header so
 * the canvas owns the whole viewport.
 */
export function StudioNav() {
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="glass rounded-full w-9 h-9 grid place-items-center text-neon-violet text-lg border border-border/60 hover:border-primary transition-colors"
        aria-label="Menu"
      >
        ◆
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        <DropdownMenuItem asChild>
          <Link to="/"><Home className="w-4 h-4" /> Home</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/gallery"><Images className="w-4 h-4" /> Gallery</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/coach"><Sparkles className="w-4 h-4" /> Coach</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/course"><GraduationCap className="w-4 h-4" /> Course</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/drill"><Timer className="w-4 h-4" /> Drill</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/progress"><TrendingUp className="w-4 h-4" /> Progress</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/edit/$artworkId" params={{ artworkId: "new" }}>
            <Palette className="w-4 h-4" /> New drawing
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={async () => {
            await supabase.auth.signOut();
            router.navigate({ to: "/" });
          }}
        >
          <LogOut className="w-4 h-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}