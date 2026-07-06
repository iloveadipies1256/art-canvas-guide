import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Studio } from "@/components/canvas/Studio";
import { CoachDrawer } from "@/components/CoachDrawer";
import { getArtwork, saveArtwork } from "@/lib/artwork.functions";
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

  const { data, isLoading } = useQuery({
    queryKey: ["artwork", artworkId],
    queryFn: () => fetchArtwork({ data: { id: artworkId } }),
    enabled: !isNew,
  });

  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState<string>(isNew ? "Untitled" : "");
  const [coachImage, setCoachImage] = useState<string | null>(null);

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
        saving={saving}
        onRequestCoach={(img) => setCoachImage(img)}
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
        onClose={() => setCoachImage(null)}
      />
    </AppShell>
  );
}