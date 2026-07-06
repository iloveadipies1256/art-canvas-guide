import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { deleteArtwork, listArtworks } from "@/lib/artwork.functions";
import { Palette, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/gallery")({
  head: () => ({
    meta: [
      { title: "My gallery — Neon Canvas" },
      { name: "description", content: "Every artwork you've saved on Neon Canvas." },
    ],
  }),
  component: GalleryPage,
});

function GalleryPage() {
  const list = useServerFn(listArtworks);
  const del = useServerFn(deleteArtwork);
  const qc = useQueryClient();
  const router = useRouter();
  const { data, isLoading } = useQuery({ queryKey: ["artworks"], queryFn: () => list() });
  const removeMutation = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["artworks"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <AppShell>
      <div className="max-w-[1400px] mx-auto px-6 py-10">
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-neon-cyan mb-2">Your gallery</p>
            <h1 className="font-display font-bold text-4xl">Saved artworks</h1>
          </div>
          <Link to="/edit/$artworkId" params={{ artworkId: "new" }} className="px-4 py-2 rounded-md bg-primary text-primary-foreground font-mono text-xs uppercase tracking-wider glow-violet flex items-center gap-2">
            <Palette className="w-4 h-4" /> New artwork
          </Link>
        </div>

        {isLoading ? (
          <div className="text-muted-foreground">Loading…</div>
        ) : !data || data.length === 0 ? (
          <div className="glass rounded-2xl p-12 text-center">
            <p className="text-lg font-display mb-2">No artworks yet</p>
            <p className="text-sm text-muted-foreground mb-6">Start something in the studio and save it here.</p>
            <Link to="/edit/$artworkId" params={{ artworkId: "new" }} className="px-4 py-2 rounded-md bg-primary text-primary-foreground font-mono text-xs uppercase tracking-wider glow-violet inline-flex items-center gap-2">
              <Palette className="w-4 h-4" /> Open studio
            </Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.map((a) => (
              <div key={a.id} className="group glass rounded-2xl overflow-hidden hover:glow-violet transition-shadow">
                <button
                  onClick={() => router.navigate({ to: "/edit/$artworkId", params: { artworkId: a.id } })}
                  className="block w-full aspect-[3/2] bg-background overflow-hidden"
                >
                  {a.thumbUrl ? (
                    <img src={a.thumbUrl} alt={a.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">No preview</div>
                  )}
                </button>
                <div className="p-3 flex items-center justify-between">
                  <div>
                    <p className="font-display font-medium">{a.title}</p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {new Date(a.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={() => { if (confirm("Delete this artwork?")) removeMutation.mutate(a.id); }}
                    className="opacity-0 group-hover:opacity-100 p-2 text-muted-foreground hover:text-destructive"
                    aria-label="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}