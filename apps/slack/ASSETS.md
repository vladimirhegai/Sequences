# ASSETS.md — the pre-built parametric asset system

**Status (2026-07-09):** foundation shipped, flag-gated OFF
(`SLACK_SEQUENCES_ASSETS=1` opts the planner vocabulary in). One reference
asset (`glass-metric`). The Asset Lab works today: `npm run assets` →
`http://127.0.0.1:4322`.

## Why this exists

Model-drawn hero visuals look lame. Probe after probe showed the same thing
the plugin system's audit found for geometry and content: the author model is
reliably bad at *drawing* — flat washes, arbitrary radii, linear ease-outs,
Item-1/2/3 filler. The fix is not a better drawing prompt; it is the same fix
Sentinel applies everywhere: **move the obligation off the model.** Visual
quality becomes a *library* property (built once, by hands and eyes, in the
Asset Lab), and the models keep only what they're good at — choosing, timing,
and parameterizing.

## The core decision: tweak pre-built, never build from scratch

Considered and rejected: a "designer model" (GLM or otherwise) generating
per-job assets from a screenshot-derived `design.md`. Rejected because every
downstream promise breaks — generated markup can't guarantee morph twins,
silhouette rhymes, spring choreography, byte-stable re-injection, or safe
CSS; we'd be re-litigating the kit_markup_incomplete class per film. Instead:

- **Assets are code, authored at design time** (`src/engine/assets/*.ts`,
  built with `defineAsset` — definition typos throw at module load).
- **Tweakability is typed params** (color / number / text / enum with
  defaults, clamps, caps) that enter the DOM ONLY as CSS custom properties
  and data-attributes on the asset root. The static per-asset stylesheet is
  byte-stable regardless of params; free text never enters CSS.
- **Brand theming is free**: asset CSS reads the same tokens as the component
  kit (`--accent`, `--surface`, `--text`, `--muted`, `--cinema-radius`) with
  fallbacks, so the per-job `frame.md` palette rethemes every asset with zero
  asset-specific work. `glass-metric`'s accent param literally defaults to
  `var(--accent)`.

The future `/sequences asset` screenshot flow then becomes **parameter
extraction + selection, not generation**: brandCapture-style tools read the
user's UI screenshots, derive tokens (accent, surface temperature, radius,
type feel), pick matching assets, and store the tuned declarations — the
model chooses values inside clamped, typed ranges, and the result previews as
images in the channel. Same knobs a human turns in the Asset Lab.

## Motion: physics, not hand-tuned curves

`motionSpring.ts` is the single motion authority for asset animations: a
closed-form damped harmonic oscillator (`{frequencyHz, dampingRatio}`).
From one spring the host derives the position curve, the natural duration
(settle time — bouncier springs automatically play longer), a normalized
ease (GSAP `registerEase`-ready samples for the film runtime), and a CSS
`linear()` easing string (WAAPI, used by the Asset Lab). Five house presets
keep the library reading as one system: `bounce` (two visible bounces —
"expand" moves), `pop` (fast attack, one ~12% overshoot — entrances),
`settle` (~3% overshoot — state changes), `snap` (critically damped), and
`gentle`. An asset's invokable animations (`enter`, `expand`, `pulse`,
`ring-fill`, …) are typed track lists (`scale`/`translate`/`rotate`/
`opacity`/registered custom properties) eased by exactly one spring —
`compileAssetAnimation` resolves `$param` references so an animation can
drive to a declared value (ring fills to `ring=42`).

## Who may do what (the agent policy)

| Actor | May | May NOT |
| --- | --- | --- |
| Human (Asset Lab) | author new assets, tune params, prove animations/morphs | — |
| GLM planner | *declare* `asset-<id>` with params on a shot | invent asset kinds, exceed clamps |
| DeepSeek author | choreograph the unit's entrance by its wrapper `data-part` | see, author, or edit asset internals |

**Can the models create their own assets when the library lacks one? No.**
The escape hatch is the existing 23-kind component catalog + plugins — both
already gated. A missing asset degrades to governed components, never to
free-form hero markup. (If live probes show real coverage gaps, the answer is
a human authoring session in the Asset Lab — an hour of design work — not a
runtime generation path that reintroduces the quality problem permanently.)

Enforcement is structural, not prompt-based: assets ride the **plugin rails**
(`assetPluginSpecs(ASSET_LIBRARY)` appends `asset-<id>` kinds to
`PLUGIN_CATALOG` behind `sentinelFlags.assetsEnabled()`), so declarations get
the L2 governance (unknown → no-op, params default/clamp/drop, shared
`MAX_PLUGINS_PER_FILM` budget) and the host strips + re-injects the rendered
bytes on every repair pass — the author model physically cannot edit an
asset. `renderAssetInstance` is a pure function of (definition, coerced
params): same declaration, same bytes, every pass.

## Morph / match readiness

Every asset declares a silhouette `family` aligned with the cut contract's
shape-rhyme groups (`pill`·`bar` vs `card`·`circle`·`window`), and
`assetsRhyme(a, b)` answers whether a morph/match between two assets — or an
asset and a kit component — reads as a rhyme, so a cross-family morph can be
rejected at PLAN time (cheap findings-retry) instead of degrading at bind
time. The Asset Lab's morph panel previews the FLIP gesture between any two
library assets with the same settle spring the film would use, and shows the
rhyme verdict.

## The Asset Lab (`npm run assets`)

Terminal-launched operator webview, Recipe-Studio posture (localhost-only,
refuses `RAILWAY_ENVIRONMENT`, absent from the Docker CMD, zero deps):
browse the library; tweak every typed param live (color pickers, clamped
ranges, enum selects); fire each spring animation; retheme brand tokens
(theme presets + accent picker) to prove `frame.md` retheming; preview morph
transitions. It renders through `renderAssetInstance` /
`compileAssetAnimation` — never a forked copy — so what the lab shows is
byte-what a film would inject.

## Product workflow (step 2 shipped 2026-07-09)

1. User runs **`/sequences asset`** → a modal with a `file_input` block
   (Slack slash commands cannot carry files — the modal is the native path)
   takes up to 5 UI screenshots + optional notes.
2. `src/assetBrief.ts` extracts the palette DETERMINISTICALLY (chromium
   canvas pixel-sampling, no model): accent = dominant chromatic non-canvas
   color, background = dominant color; stores ONE brief per channel in
   `.data/asset-briefs.json` (`asset clear` forgets; nothing else from the
   channel is ever stored); posts a confirmation + an asset-kit-in-your-brand
   preview PNG. Requires the bot `files:read` scope (manifest.json,
   2026-07-09 — reinstall + refresh the bot token).
3. `/sequences <brief>` in that channel folds the brief into the create
   context (`assetBriefContext` — after hosted-MCP workspace context), so
   frame design commits the user's accent/canvas and the token-themed assets
   retheme automatically. Films default to ~24s when no length is picked
   (`DEFAULT_TARGET_LENGTH_SEC`); the target shapes the film through the
   always-on narrative/duration template scaffold in the storyboard prompt —
   never through a validation veto (a time miss never burns an attempt).
4. Future: the brief also auto-offers/parameterizes matching `asset-<id>`
   declarations once the flag defaults ON.

## Shipped / not yet

- ✅ `src/engine/motionSpring.ts` — spring physics + presets + samplers.
- ✅ `src/engine/assetContract.ts` — params, rendering, animation compile,
  rhyme families, plugin bridge (`test/assetContract.test.ts`).
- ✅ `src/engine/assets/glassMetric.ts` — the reference asset.
- ✅ Asset Lab (`studio/assetLab.ts` + `studio/ui/asset-lab.html`).
- ✅ Flag `SLACK_SEQUENCES_ASSETS` (default OFF) appending `asset-<id>` kinds
  to the plugin catalog.
- ⬜ Film-side asset ANIMATION runtime: compile declared asset animations as
  typed beats into the paused timeline (a `sequences-assets.v1.js` island
  registering the sampled spring eases with GSAP — `easeSamples` is already
  shaped for it). Until then an in-film asset is a themed static unit whose
  entrance the author animates like any content.
- ✅ `/sequences asset` (2026-07-09): screenshot intake modal → deterministic
  palette extraction → per-channel brief → context injection on every later
  create + asset-kit preview PNG (`src/assetBrief.ts`, `test/assetBrief.test.ts`).
- ⬜ Paid live probe with the flag ON, then default-ON decision.
- ⬜ Auto-offer parameterized `asset-<id>` declarations from the stored brief.
- ⬜ More assets (authored in the Asset Lab, one file each in
  `src/engine/assets/`).
