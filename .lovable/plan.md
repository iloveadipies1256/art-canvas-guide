# Neon Canvas — plan

A neon-dark drawing studio with multi-brush painting, layers, shapes, undo/redo, an AI drawing coach, and a personal cloud gallery.

## Look & feel
- Palette: ink `#0B0B12`, violet `#7C3AED`, cyan `#22D3EE`, paper `#F5F3FF`, subtle glow shadows and thin 1px violet/cyan hairlines.
- Type: Space Grotesk for display + JetBrains Mono for tool labels (via @fontsource).
- Chrome: floating glass toolbars, radial neon glow behind the canvas, keyboard-shortcut hints in mono.

## Routes
```
/                       Landing (hero + demo canvas + featured tutorials)
/auth                   Sign up / sign in (email + password)
/studio                 (public) — try the canvas without saving
/_authenticated/studio/$artworkId   Full studio with save + AI coach
/_authenticated/gallery             User's saved artworks grid
/_authenticated/coach               Browse AI tutorial prompts
```

## Canvas engine (frontend only)
Single `<canvas>` per layer, stacked absolutely inside a container.
- Tools: Pen, Marker, Airbrush, Pixel, Calligraphy, Neon-glow, Eraser
  (each is a brush config: size, opacity, flow, spacing, blend, glow).
- Shapes: rectangle, ellipse, line, arrow (drag-to-draw, shift = constrain).
- Color: HSL picker + swatch history + eyedropper.
- Layers panel: add/delete/reorder/rename, visibility toggle, opacity slider, active-layer highlight.
- Undo/redo: per-artwork stack of layer-bitmap snapshots (cap ~40 steps).
- Export: flatten layers → PNG download.

## AI Coach (Lovable AI, `google/gemini-3-flash-preview`)
Server function `getCoachLesson({ subject, skillLevel })` returns a structured lesson:
```
{ title, materials[], steps:[{n, instruction, tip}], challenge }
```
Rendered in a right-side drawer beside the canvas with a step-by-step checklist you tick as you go. A "Give me feedback" button sends the current flattened PNG (base64) + step text to `critiqueArtwork()` which returns short, encouraging critique + next-step suggestion. All prompts + `LOVABLE_API_KEY` stay server-side in `src/lib/coach.functions.ts`.

## Cloud (Lovable Cloud)
Tables (all with GRANTs + RLS scoped to `auth.uid()`):
- `profiles` (id → auth.users, display_name, avatar_url)
- `artworks` (id, user_id, title, width, height, thumbnail_url, updated_at)
- `artwork_layers` (id, artwork_id, index, name, opacity, visible, png_path)
- `lessons` (id, user_id, subject, payload jsonb, created_at) — cached coach output
Storage bucket `artworks/` (private, per-user folder) for layer PNGs + thumbnails.
Trigger auto-creates a profile row on signup.

## Auth
Email + password via Supabase (Lovable Cloud). `_authenticated` layout gates studio/gallery/coach. Landing + `/studio` (unsaved) stay public so shares work.

## Build order
1. Enable Lovable Cloud; create schema, RLS, storage bucket, profile trigger.
2. Design tokens in `src/styles.css` + font install; landing + auth pages.
3. Canvas engine: layers, brushes, shapes, undo/redo, export.
4. Save/load artworks + gallery grid + thumbnails.
5. AI coach server fns + lesson drawer + critique.
6. Polish: keyboard shortcuts, empty states, toasts, mobile touch support.

## Technical notes
- Pointer Events (`pointerdown/move/up`) with `getCoalescedEvents` for smooth strokes; `pressure` drives brush size where available.
- Neon-glow brush = shadowBlur + additive `globalCompositeOperation = "lighter"` on a dedicated layer.
- Coach lesson uses AI SDK `Output.object` with a Zod schema so the UI can trust the shape.
- Thumbnails: downscale flattened canvas to 512px, upload on save.
- No admin client in loaders; all writes via `createServerFn` with `requireSupabaseAuth`.