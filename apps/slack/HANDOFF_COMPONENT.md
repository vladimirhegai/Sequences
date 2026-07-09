# HANDOFF_OPUS.md — complete the pre-built asset system

You are Opus 4.8, working in `apps/slack` (Sequences for Slack — hackathon
deadline **Jul 13 2026**). Read, in order:
**[CLAUDE.md](CLAUDE.md)** (rules — especially isolation, Sentinel, the
live-probe policy), **[ASSETS.md](ASSETS.md)** (the system you're finishing),
**[SENTINEL.md](SENTINEL.md)** (before touching any gate/repair), and the
`slack-map` skill if available. The foundation is DONE and proven:
`src/engine/assetContract.ts` + `src/engine/motionSpring.ts` +
`src/engine/assets/` (one example: `glass-metric`), the Asset Lab webview
(`npm run assets` → 127.0.0.1:4322), the `asset-<id>` plugin-rail bridge
behind `SLACK_SEQUENCES_ASSETS=1` (default OFF), and `/sequences asset`
channel brand intake (`src/assetBrief.ts`). Your job is the four missing
pieces, in this order.

## 1. The asset pack (~10–14 assets) — your design taste, our mechanics

Author designer-grade assets in `src/engine/assets/` (one `defineAsset` file
each, registered in `assets/index.ts`). **The visual design is yours** — this
is the creative half of the task; make things that would not embarrass a
Linear/Stripe launch film. The mechanics are NOT yours to vary:

- params enter the DOM only as root custom properties (`cssVar`) or enum
  `data-*` attrs; every param has a default; free text never enters CSS;
- brand truth only through the shared tokens with fallbacks
  (`--accent`/`--surface`/`--surface-2`/`--text`/`--muted`/`--canvas`/
  `--cinema-radius`/`--cinema-edge`) so `frame.md` rethemes everything;
- every animation names ONE spring (`bounce`/`pop`/`settle`/`snap`/`gentle`
  or a bespoke config — sparingly) — never a linear or hand-tuned curve;
- size rides one custom property, interiors in `em` (see `glassMetric.ts`);
- declare an honest silhouette `family` — it gates morph/match rhymes.

Coverage to aim for (adjust with judgment): browser/app frame hero, metric
family (orb exists; add bar/delta/sparkline-card), badge/seal, keyboard-key /
shortcut chip, cursor-target button, integration/logo tile, notification
gem, pipeline/flow node, avatar/team medallion, terminal/code card, rating/
social-proof strip, CTA lockup. Prove EVERY asset in the Asset Lab (params,
each animation, a morph against a rhyming partner) before calling it done,
and keep `test/assetContract.test.ts`-style coverage per asset (determinism,
param clamps, escaping).

## 2. The in-film asset animation runtime (the hard engineering piece)

Today an in-film asset is a themed static unit. Build
`sequences-assets.v1.js`: a host-injected island that compiles declared
asset animations into the ONE paused GSAP timeline (seek-safe,
deterministic, byte-stable — study `sequences-components.v1.js` and
`componentContract.ts` for the architecture; `CompiledAssetAnimationV1.
easeSamples` is already shaped for `gsap.registerEase`). Storyboards should
invoke them as typed beats on the asset unit's `data-part` (extend the
plugin lowering to emit them, so pacing/motion-density/moments bind for
free). Requirements: injection inside `applyDeterministicSourceRepairs` in
the documented order (see the plugin row in
[studio/INTEGRATION.md](studio/INTEGRATION.md) — update the seam table),
Sentinel registration for any new finding class, kill switch riding
`SLACK_SEQUENCES_ASSETS`, a browser test proving beats fire under
out-of-order seek (`test/pluginRuntime.browser.test.ts` is the model), and
byte-identical strip-and-reinject.

## 3. Auto-offer assets from the channel brief

When a channel has a `/sequences asset` brief AND the flag is on, the
storyboard prompt should OFFER the matching parameterized declarations
(accent from the brief, on-topic copy) the way recipes are offered —
declare-by-default but droppable. Degrade-never-veto; the planner may
decline. Seam: where `assetBriefContext` joins the create context in
`src/index.ts` + the plugin vocabulary in `compositionRunner.ts`.

## 4. Prove it live, then flip the default

`npm run sequence:check -- ...` first (no Slack needed), then ONE paid probe
with `SLACK_SEQUENCES_ASSETS=1` on a dense brief. Apply the
**live-probe policy** ([PROBE_LOG.md](PROBE_LOG.md)): any burned attempt
with a mechanical cause gets fixed deterministically + tested + logged
before you continue. If the probe publishes clean and the assets visibly
beat the model-drawn equivalents, flip `assetsEnabled()` to default-ON with
`=0` as the revert (update SENTINEL.md's flag table + ASSETS.md + CLAUDE.md).

## Non-negotiables

Isolation (never import `apps/forge`/`apps/sequences`; never modify
`packages/*`). Gates move, never loosen. Prompt additions are byte-budgeted
(`test/promptBudget.test.ts`). Every engine seam you touch updates
`studio/INTEGRATION.md`. Full verify before done: `npm run typecheck`,
`npm run test`, `npm run film:demo`, and the ladder in CLAUDE.md §Verification.
Commit locally; publishing (`scripts/publish-public.sh`) and deploying
(`railway up`) are separate owner steps — flag, don't run, unless asked.
