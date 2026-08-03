# What makes Neon Canvas different

Canva is a template tool for making assets. Procreate is a canvas. Neither teaches you to draw. Neon Canvas already has the seed of a real moat — a skill score inferred from your actual artwork, lessons whose granularity adapts to it, a fundamentals course, and skill-tagged practice streaks. The gap is that coaching only happens *after* you finish, and improvement is invisible.

These four features close that gap. The app adapts to both absolute beginners and improving hobbyists via the existing skill score.

## 1. Ghost trace layer (build first)

Turn lesson step reference images into something you draw *on*, not just look at.

- Each coach step's reference image mounts as a locked underlay beneath your paint layers, with an opacity slider (0-60%).
- Default opacity derived from skill score: beginner ~45%, intermediate ~25%, advanced 0% (off unless summoned). The trace wheels come off as you improve.
- Toggle, nudge/scale/flip controls, and a "hide ghost" button so you can check your work unaided.
- Never flattened into exports or saved artwork — it is scaffolding, not pixels.

## 2. Live coaching while drawing

The coach watches the canvas mid-session instead of only grading the finished piece.

- A "Coach watching" toggle in the studio. When on, after you pause for ~4 seconds and the canvas has meaningfully changed, the current flattened canvas plus the active lesson step is sent for a fast structured check.
- Returns at most one short, actionable nudge plus an optional bounding box drawn as a soft highlight on the canvas ("head is about 30% too small for that torso").
- Hard-rate-limited (minimum ~20s between checks, only on real change, capped per session) and fully dismissible, so it coaches rather than nags.
- Reuses the existing critique region structure, so the overlay renderer is shared with end-of-piece critique.

## 3. Skill radar + progress timeline

Make improvement visible — this is the retention engine and the thing worth paying for.

- Every critique already estimates line control, proportion, and shading, but only the blended score is stored. Persist each critique's per-axis numbers as a time series.
- New `/progress` page: a four-axis radar (line control, proportion, value/shading, perspective), a sparkline of the overall score over time, and a "then vs now" strip pairing your earliest and latest pieces on the same subject.
- Shareable progress card rendered to PNG in-browser — "60 days of practice" with the two pieces and the radar.

## 4. Daily adaptive drill

A five-minute warm-up that targets your weakest axis.

- `/drill` opens a stripped-down studio with a timer, one generated micro-exercise, and its ghost reference.
- Subject picked from your lowest radar axis, avoiding whatever you drilled yesterday; falls back to the existing skill-suggestion logic.
- Counts toward the existing streak, logs a practice event, and offers a one-tap critique at the end.
- Surfaced as a card on the Coach page and in the app shell when today's drill is undone.

## Technical notes

Backend (Lovable Cloud), one migration, all with GRANTs and `auth.uid()` RLS:
- `skill_snapshots` — `user_id`, `line_control`, `proportion`, `shading`, `perspective`, `overall`, `artwork_id`, `subject`, `created_at`. Written by `critiqueArtwork`, which currently computes the per-axis values and discards them.
- `daily_drills` — `user_id`, `drill_date`, `subject`, `focus_skill`, `completed_at`, unique on (user_id, drill_date).
- Add a `perspective` axis to the critique schema and prompt so the radar has a fourth real axis.

Frontend / server functions:
- Studio: a new non-exporting ghost layer above the background and below paint layers; excluded from `flatten()` and from autosave/save payloads.
- Live coach: `liveNudge` server function on `google/gemini-3.6-flash` returning `{ nudge, region? }` via a small `Output.object` schema (no schema bounds — limits stated in the prompt, clamped in code). Debounced client-side with a canvas-hash change check.
- `getProgressSeries` returns snapshots; radar and sparkline drawn with plain SVG (no chart dependency).
- `getTodaysDrill` / `completeDrill` reuse the existing lesson generation internals and `logPractice` for the streak.
- Progress card export reuses the existing flatten-to-PNG path onto an offscreen canvas.
- New routes under `_authenticated`: `/progress`, `/drill`, each with its own `head()` metadata; nav links added to `AppShell`.

## Build order

1. Migration (`skill_snapshots`, `daily_drills`), persist per-axis critique scores, add the perspective axis.
2. Ghost trace layer in the studio, wired to coach step images and skill-derived opacity.
3. `/progress`: radar, timeline, then-vs-now, share card.
4. Live coaching toggle, `liveNudge`, and the on-canvas highlight overlay.
5. `/drill` daily exercise, streak wiring, and the Coach-page prompt.