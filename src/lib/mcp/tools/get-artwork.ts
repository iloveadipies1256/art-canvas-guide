import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "get_artwork",
  title: "Get artwork",
  description:
    "Get one of the signed-in user's Neon Canvas artworks by id, including a temporary signed image URL.",
  inputSchema: {
    id: z.string().uuid().describe("Artwork id (UUID) as returned by list_artworks."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ id }, ctx: ToolContext) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );
    const { data: row, error } = await supabase
      .from("artworks")
      .select("id, title, width, height, image_path, updated_at")
      .eq("id", id)
      .single();
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    const { data: signed } = await supabase.storage
      .from("artworks")
      .createSignedUrl(row.image_path ?? "", 60 * 60);
    const result = { ...row, imageUrl: signed?.signedUrl ?? null };
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      structuredContent: { artwork: result },
    };
  },
});