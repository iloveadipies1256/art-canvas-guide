# Make the studio one full-bleed canvas

Right now the studio stacks a site header, a dense toolbar row, a tool rail, and a fixed 264px right panel around a boxed canvas. Too many competing surfaces, and the canvas itself is the smallest thing on screen. The fix: the canvas becomes the page, and every control floats on top of it, quiet until you need it.

## What changes

**Canvas fills the window**
- On `/edit/$artworkId`, `/studio` and `/drill`, the app header hides and the canvas occupies the entire viewport edge to edge.
- The logo mark stays as a small floating button in the top-left; clicking it opens a compact menu with Gallery, Coach, Course, Drill, Progress and Sign out. Nav no longer eats a permanent 56px band.
- Canvas is centered and auto-fit to the available space, on a plain dark field with no boxed panel look.

**Controls become floating islands**
- Left: a slim vertical tool dock, glass pill, floating over the canvas with a margin — brushes and shapes only.
- Bottom-center: one small island with the brush essentials you touch constantly — color swatch, size slider, opacity. Everything else moves out of the way.
- Top-right: a single island with Save, Export, and a "..." overflow holding Ask coach, Live check, Show progress, canvas color, ghost trace controls and layers.
- Layers move into a panel that slides in over the canvas on demand instead of always occupying a column.
- Undo/redo/zoom collapse into a small bottom-left island with the zoom percentage.

**Quiet by default**
- Floating islands dim to ~40% opacity while you're actively drawing and return on pointer-up or hover, so the canvas is never crowded mid-stroke.
- Title becomes an unobtrusive inline text field top-center, no border until focused.
- Press `Tab` to hide all overlays for a clean look at the piece.

**Mobile**
- Same islands, smaller: tool dock becomes a horizontal scroller docked at the bottom, overflow menu holds everything else. No side drawers.

## Not changing

Drawing engine, brushes, history, autosave, save/export, coach, live check, assessment and progress logic are untouched. This is layout and chrome only.

## Technical notes

- `AppShell` gains a `chrome="floating"` mode (or the studio routes render without it) so the sticky header doesn't reserve height; canvas container switches from `h-[calc(100dvh-3.5rem)]` to `h-[100dvh]`.
- `Studio.tsx` restructures its JSX only: the toolbar row and two `<aside>` columns are replaced by absolutely positioned islands inside the existing canvas container; existing handlers, state and refs are reused as-is.
- Extract the right-panel contents (color, canvas color, ghost trace, layers) into small components so they can render in either the overflow popover or the slide-in layers panel without duplicating logic.
- Overlay dimming driven by the existing drawing/pointer state; `Tab` handled alongside the current keyboard shortcut listener.
- Islands use existing `glass` plus semantic tokens; no new colors.
