import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listArtworks from "./tools/list-artworks";
import getArtwork from "./tools/get-artwork";
import generateLesson from "./tools/generate-lesson";

// Use the direct Supabase host as the OAuth issuer (RFC 8414). The Lovable
// Cloud proxy in SUPABASE_URL is rejected by mcp-js. VITE_SUPABASE_PROJECT_ID
// is inlined by Vite at build time.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "neon-canvas-mcp",
  title: "Neon Canvas",
  version: "0.1.0",
  instructions:
    "Tools for the signed-in user's Neon Canvas account. `list_artworks` and `get_artwork` read their saved drawings; `generate_lesson` produces a step-by-step drawing lesson for any subject.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listArtworks, getArtwork, generateLesson],
});