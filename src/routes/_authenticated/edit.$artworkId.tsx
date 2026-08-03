import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Studio } from "@/components/canvas/Studio";
import { CoachDrawer } from "@/components/CoachDrawer";
import { getArtwork, saveArtwork } from "@/lib/artwork.functions";
import { liveNudge } from "@/lib/live.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/edit/$artworkId")({
  component: EditPage,
});

function EditPage() {
  const { artworkId } = Route.useParams();
  const router = useRouter();
  const qc = useQueryClient();
  const isNew = artworkId === "new";
  const fetchArtwork = useServerFn(getArtwork);
  const save = useServerFn(saveArtwork);
  const nudge = useServerFn(liveNudge);

  const { data, isLoading } = useQuery({
    queryKey: ["artwork", artworkId],
    queryFn: () => fetchArtwork({ data: { id: artworkId } }),
    enabled: !isNew,
  });

  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState<string>(isNew ? "Untitled" : "");
  const [coachImage, setCoachImage] = useState<string | null>(null);
  const [ghost, setGhost] = useState<string | null>(null);
  const [liveChecking, setLiveChecking] = useState(false);

  if (!isNew && isLoading) {
    return <AppShell><div className="p-10 text-muted-foreground">Loading artwork…</div></AppShell>;
  }

  const currentTitle = title || data?.title || "Untitled";

  return (
    <AppShell>
      <Studio
        title={currentTitle}
        onTitleChange={setTitle}
        initialImageUrl={data?.imageUrl}
        artworkId={isNew ? undefined : artworkId}
        saving={saving}
        onRequestCoach={(img) => setCoachImage(img)}
        ghostImageUrl={ghost}
        onGhostClear={() => setGhost(null)}
        liveChecking={liveChecking}
        onLiveCheck={async (img) => {
          setLiveChecking(true);
          try {
            const res = await nudge({ data: { imageDataUrl: img, subject: currentTitle } });
            toast.message(res.focus || "Live check", {
              description: [res.encouragement, ...res.nudges].filter(Boolean).join(" · "),
              duration: 12000,
            });
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Coach unavailable");
          } finally {
            setLiveChecking(false);
          }
        }}
        onSave={async ({ imageDataUrl, thumbDataUrl, width, height }) => {
          setSaving(true);
          try {
            const res = await save({
              data: {
                id: isNew ? undefined : artworkId,
                title: currentTitle,
                width,
                height,
                imageDataUrl,
                thumbDataUrl,
              },
            });
            toast.success("Saved");
            qc.invalidateQueries({ queryKey: ["artworks"] });
            if (isNew) router.navigate({ to: "/edit/$artworkId", params: { artworkId: res.id }, replace: true });
          } finally {
            setSaving(false);
          }
        }}
      />
      <CoachDrawer
        open={!!coachImage}
        imageDataUrl={coachImage}
        subject={currentTitle}
        onTrace={(url) => { setGhost(url); toast.success("Reference mounted as a ghost layer"); }}
        onClose={() => setCoachImage(null)}
      />
    </AppShell>
  );
}