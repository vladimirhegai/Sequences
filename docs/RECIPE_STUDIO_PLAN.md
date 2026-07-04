# Recipe Studio — internal motion-graphics recipe tool (starting-point plan)

Status: PLAN (2026-07-04). This is the seed plan; a follow-up agent will
enhance it. Owner-facing internal tool — never deployed, never part of the
hackathon submission surface.

## What it is

A local, operator-only "lite video editor + chatbot" for authoring reusable
**SaaS motion-graphics recipes** — the patterns you keep seeing in the wild
(e.g. **last-word roulette**: a locked sentence whose final word is a vertical
carousel that ticks through candidates and snaps onto the payoff word). You
build and polish a recipe interactively with GLM/DeepSeek, watch it live,
nudge things around, and when it's proven, **export it as knowledge** the
Slack Sequences agents retrieve automatically during real `/sequences`
creates.

The point is leverage: every feature the Slack app already has (five
host-owned contracts, deterministic QA gate, seek-safe runtime, thumbnails,
render) is reused as-is. The studio is a thin cockpit over the existing
engine, not a second engine.

## Where it lives

`apps/slack/studio/` + `npm run studio --workspace @sequences/slack` →
`http://127.0.0.1:<port>`. Living inside `apps/slack` keeps the isolation rule
intact (no cross-app imports; the engine in `src/engine/` is imported
directly), and the studio ships in the public repo as operator tooling but is
never started on Railway.

- Server: the same tiny `http.createServer` + `serveDir` idiom the engine
  already uses (no Express, no new heavy deps). JSON endpoints wrap existing
  engine functions.
- UI: one static page (vanilla JS or Lit via plain script) with:
  - **Preview pane** — an iframe serving the composition dir. Deterministic
    seek makes the scrubber trivial: drag = `window.__timelines[id].seek(t)`.
    Play = a host-side rAF loop calling seek (the composition itself stays
    paused — framework-owned playback invariant is untouched).
  - **Chat pane** — talk to GLM (plan/critique) and DeepSeek (source/patches)
    through the existing `compositionRunner` primitives with a "recipe brief"
    mode: small scope (one pattern, 3–10s, loop-friendly), full QA gate on
    every submission (`validateDirectComposition` + `inspectDirectComposition`
    — both now cache by content hash, so studio iteration is fast).
  - **Timeline strip** — moment/beat markers from the storyboard + motion
    plan; click = seek there. Thumbnails via `generateDirectThumbnails`.
  - **Nudge mode (move things around)** — select a `data-part`, then drag /
    arrow-keys emit *deterministic* patch edits (translate/scale/timing
    offset) applied through the existing `applyCompositionRepair` exact-patch
    machinery and re-gated. Zero tokens; the gate keeps every nudge seek-safe.

## Recipe format (`RecipeV1`) and the knowledge hookup

A recipe is a proven, versioned skill-pack entry at
`apps/slack/skills/sequences-recipes/<recipe-id>/`:

- `recipe.md` — the retrievable knowledge: when to use it (trigger keywords,
  component kinds, story beats), the storyboard vocabulary to declare (typed
  beats/camera/cut choices), and the authoring contract (markup skeleton,
  GSAP pattern, the seek-safety notes). Uses the same `<blueprint>` /
  `<motion-rule>` tag conventions the existing skill compaction already
  understands.
- `demo.html` — the canonical proven implementation (passed the full gate).
- `preview/` — thumbnail strip + optional MP4 for the operator gallery.
- `recipe.json` — machine header: id, title, tags, trigger patterns, duration
  window, QA evidence hash, revision.

Retrieval: extend `src/agent/skillContext.ts` to score
`sequences-recipes/*` against the brief (keyword/component-kind match, cap
1–2 recipes per create so the prompt budget stays bounded) and inject them
beside the existing blueprints — the storyboard prompt sees the recipe as
reuse-first vocabulary; the author prompt gets the markup contract only for
recipes the locked storyboard actually chose. Bump the storyboard cache key
with a `recipesVersion` (same pattern as `registryVersion`).

## Golden first recipe: `last-word-roulette`

Proves the whole loop end to end: sentence locked left, final-word slot is a
masked vertical wheel; each candidate word tick is a **storyboard moment**
(type-on/ui-state evidence), the wheel motion is translateY snap steps (pure
function of timeline time — seek-safe by construction), and the payoff word
landing is the scene's primary moment, eligible for a `timeRamp` dip. Export
it, then run one paid `/sequences` create with a brief that names the pattern
and confirm the planner declares it and the author reproduces it.

## Milestones

1. **M1 — Cockpit (1–2 days).** Serve an existing job dir; scrubber + moment
   strip + chat-create through the standard gate. No new persistence.
2. **M2 — Recipes as knowledge.** RecipeV1 save/export, `skillContext`
   retrieval wiring + cache-key bump, `last-word-roulette` golden recipe,
   one paid live-create proof.
3. **M3 — Direct manipulation.** data-part picker, drag/arrow nudges as
   gated patches, undo via the existing revision checkpoints.
4. **M4 — Stretch.** Recipe audition grid (render 2–3 variants side by
   side), morph/FLIP recipe kinds, recipe-aware critic directives.

## Guardrails

- Recipes obey the same runtime invariants as any composition (no wall-clock,
  no rAF-owned state, paused registered timeline) — enforced automatically
  because every save passes the existing deterministic gate.
- The studio never touches the demo path's determinism and never runs on
  Railway; it is a dev dependency-free local tool.
- Retrieval stays bounded: at most 1–2 recipes injected per create; recipes
  lose to brief-derived requirements on conflict.
- Recipe provenance is kept (QA evidence hash + revision) so a stale recipe
  that predates a contract change can be detected and re-proven mechanically.
