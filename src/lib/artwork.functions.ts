import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function decodeDataUrl(dataUrl: string): { bytes: Uint8Array; contentType: string } {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error("Invalid data URL");
  const contentType = match[1];
  const bytes = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0));
  return { bytes, contentType };
}

export const saveArtwork = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        title: z.string().min(1).max(120),
        width: z.number().int().positive().max(4096),
        height: z.number().int().positive().max(4096),
        imageDataUrl: z.string(),
        thumbDataUrl: z.string(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const artworkId = data.id ?? crypto.randomUUID();
    const base = `${context.userId}/${artworkId}`;
    const image = decodeDataUrl(data.imageDataUrl);
    const thumb = decodeDataUrl(data.thumbDataUrl);

    const up1 = await context.supabase.storage
      .from("artworks")
      .upload(`${base}/image.png`, image.bytes, { contentType: image.contentType, upsert: true });
    if (up1.error) throw new Error(up1.error.message);

    const up2 = await context.supabase.storage
      .from("artworks")
      .upload(`${base}/thumb.png`, thumb.bytes, { contentType: thumb.contentType, upsert: true });
    if (up2.error) throw new Error(up2.error.message);

    const row = {
      id: artworkId,
      user_id: context.userId,
      title: data.title,
      width: data.width,
      height: data.height,
      image_path: `${base}/image.png`,
      thumbnail_path: `${base}/thumb.png`,
    };

    const { error } = await context.supabase.from("artworks").upsert(row);
    if (error) throw new Error(error.message);
    return { id: artworkId };
  });

export const listArtworks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("artworks")
      .select("id, title, width, height, image_path, thumbnail_path, updated_at")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    const withUrls = await Promise.all(
      rows.map(async (r) => {
        const { data: signed } = await context.supabase.storage
          .from("artworks")
          .createSignedUrl(r.thumbnail_path ?? "", 60 * 60);
        return { ...r, thumbUrl: signed?.signedUrl ?? null };
      }),
    );
    return withUrls;
  });

export const getArtwork = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("artworks")
      .select("id, title, width, height, image_path, updated_at")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    const { data: signed } = await context.supabase.storage
      .from("artworks")
      .createSignedUrl(row.image_path ?? "", 60 * 60);
    return { ...row, imageUrl: signed?.signedUrl ?? null };
  });

export const deleteArtwork = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const base = `${context.userId}/${data.id}`;
    await context.supabase.storage.from("artworks").remove([`${base}/image.png`, `${base}/thumb.png`]);
    const { error } = await context.supabase.from("artworks").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });