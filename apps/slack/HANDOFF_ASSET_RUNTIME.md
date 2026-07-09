# HANDOFF_ASSET_RUNTIME.md — finish the asset system (pack + runtime are DONE)

You are picking up mid-epic in `apps/slack` (Sequences for Slack, hackathon
deadline **Jul 13 2026**). Read first: **[CLAUDE.md](CLAUDE.md)** (rules —
isolation, Sentinel, live-probe policy), **[ASSETS.md](ASSETS.md)**,
**[SENTINEL.md](SENTINEL.md)**, the `slack-map` skill, and the original brief
**[HANDOFF_COMPONENT.md](HANDOFF_COMPONENT.md)**. The owner's ask on top of
that brief: pre-built UI components for almost any common SaaS, a clean
preview tool for components + invokables/tweaks/animations (the Asset Lab),
motion-design-grade animation per component, well-implemented transitions
(especially morph + morph tweaks), then a live probe analyzing whether the
agent actually uses the components — fixing agent architecture if weak — then
docs + commit.

## DONE this session (all committed, typecheck clean, tests green)

**1. The asset pack — 13 designer-grade parametric assets** in
`src/engine/assets/` (one `defineAsset` file each, registered in
`assets/index.ts`), covering all five silhouette families:

| family | assets |
| --- | --- |
| window | `browser-hero` (glass chrome + skeleton page that populates via `--bh-rise` staggered clamp()s) |
| card | `spark-card` (sparkline draws via `pathLength=1` + `--sk-draw`) · `logo-tile` (monogram tile + gloss sweep) · `flow-node` (pipeline stage, enters along flow axis, activation ring) |
| circle | `glass-metric` (reference) · `laurel-badge` (SVG laurels, bounce enter, gloss shine) · `notify-gem` (glossy counter, sonar ping via one `--ng-ping` prop) · `team-medallion` (avatar discs converge via `--tm-spread`) |
| bar | `metric-bar` (meter fills to `$fill`) · `rating-strip` (stars light via `--rs-fill` overlay clip) |
| pill | `delta-chip` (trend pill; `down` = tempered red) · `key-combo` (extruded keycaps; press = travel + shadow compress on `--kc-press`) · `cta-button` (bloom capsule; snap press payoff) |

Mechanics held everywhere: params → root custom props/data-attrs only, brand
tokens with fallbacks (frame.md rethemes all 13 for free), ONE spring per
animation (never linear — proven by test), size on one custom prop with em
interiors, honest `family`. Payoffs that BUILD toward the markup's final
state declare `preBeat:"from"` so pre-beat seeks show the empty state
(flash-of-full killed by construction).

**2. The in-film animation runtime (the hard piece) — SHIPPED.** Design
decision (differs from the original handoff's letter, matches its intent):
asset animations ride the EXISTING beat rails instead of a parallel system.

- `AssetAnimationSpecV1` gained `trigger: "enter" | "payoff" | "manual"`
  (validated: ≤1 enter) and `preBeat: "from"`.
- The plugin lowering (`assetPluginSpecs` in `assetContract.ts`) now emits ONE
  internal `asset`-kind component (root `data-part` = `<unit>-core`, stamped
  `pluginUid`) + host-derived typed **`animate` beats**: the `enter` animation
  at the shared `entranceAnchorSec` (moved to `pluginKernel.ts` — camera-
  arrival aware), then each `payoff` sequenced with 0.15s gaps. Because these
  are ordinary `scene.beats` flowing through `resolveComponentPlan`, pacing /
  motion-density / moments / complexity budgets / layout-QA motion windows all
  bind FOR FREE.
- **Sentinel L0**: `asset` kind + `animate` beat are host-only —
  `normalizeStoryboardComponents` / `normalizeStoryboardComponentBeats` reject
  them and the storyboard JSON schema enums use the new
  `PLANNER_COMPONENT_KINDS` / `PLANNER_COMPONENT_BEAT_KINDS` (models cannot
  even represent them). `componentPlanningVocabulary` /
  `componentAuthoringReference` filter `internal` kinds.
- `src/engine/assetRuntime.ts`: `resolveAssetPlan` (timing read FROM the
  resolved component plan so paperwork == execution; spring payload via new
  `compileAssetAnimationGsap` — decomposed GSAP vars + sampled ease + preBeat
  writes) and `validateAssetContract` (asset_island_missing /
  asset_island_stale / asset_runtime_missing; stands down when flag off).
- `templates/sequences-assets.v1.js`: `SequencesAssets.compile(tl, root)` —
  linear-interpolates the sampled spring ease (overshoot survives), first beat
  per part = reveal (immediateRender pre-renders hidden state), later beats =
  move + preBeat custom-prop inline writes, yoyo = repeat:1. Deterministic,
  no clocks/random.
- `sequences-components.v1.js` skips `animate` beats BEFORE element lookup
  (one owner per channel; a flag-flipped film can't crash the compile).
- Injection in `applyDeterministicSourceRepairs` (compositionRunner ~line
  4177): island + runtime tag + compile call, after fx, BEFORE recipes and the
  time-wrap (still LAST). Telemetry tag `asset-inject`. Kill switch
  `SLACK_SEQUENCES_ASSETS` (still default OFF). `sequences-assets` joined
  `HOST_PLAN_ISLAND_IDS`, `HOST_STAGED_RUNTIME_FILES`,
  `RUNTIME_SCRIPT_GLOBALS`; staged in `copyRuntimeAndAssets`, layoutInspector
  scratch, checkpoint/undo sidecars; allowlisted in referencedLocalPaths; in
  the QA static fingerprint. Storyboard cache `contract: 19 → 20` + an
  `assets:` cache key (flag/library keyed).
- `pacingAudit.ts`: `animate` joined `ENTRANCE_BEAT_KINDS` (introduction time
  = the spring entrance, camera-aware).
- Sentinel registry: rows `normalize.asset-lower` + `assets.contract`;
  `assetRuntime.ts` in `FINDING_SOURCE_FILES`. Kit CSS gained a minimal
  `.asset` unit-root baseline (catalog/kit coherence test).

**Proof (all green):** `npm run typecheck -w @sequences/slack` ·
`test/assetPack.test.ts` (92 tests — generic per-asset determinism, clamps,
escaping, token theming, non-linear springs, ≤3.5s choreography, arrival-aware
anchor, purity) · `test/assetRuntime.test.ts` (plan byte-stability, timing
mirror, $param/preBeat resolution, validation self-checks + kill-switch) ·
updated `test/assetContract.test.ts` · `test/componentContract.test.ts`,
`test/sentinel.test.ts`, `test/pacingAudit.test.ts` ·
**`test/assetRuntime.browser.test.ts`** — an all-asset film (glass-metric +
laurel-badge + cta-button, 3 units, 2 scenes) through REAL
validateDirectComposition + browser QA: zero errors, every declared moment
bound to `component` evidence from asset beats, zero static-verdict temporal
judgments, seek-safe. Run it via the npm script + `-t` name filter (see
gotchas).

## REMAINING WORK (in order)

**A. Asset Lab polish (small).** New assets already appear automatically
(`npm run assets` → 127.0.0.1:4322 — the lab derives everything from
`ASSET_LIBRARY`). Still wanted by the owner: (1) show each animation's
`trigger` badge (enter/payoff/manual) in the animations panel — the summary in
`studio/assetLab.ts` `assetSummary` must pass `trigger` through; (2) **morph
tweaks**: a spring-preset picker (+ optional duration override) for the morph
gesture — either recompute client-side from a `/api/assets` map of all 5
preset gestures (compile each via `compileAssetAnimation` server-side), or a
small `POST /api/morph {spring}` endpoint. Zero new deps, keep rendering
through the real contract. Prove every asset there (params, each animation,
morph against a rhyming partner + cross-family degrade badge).

**B. Auto-offer from the channel brief** (original handoff §3). When a channel
has a `/sequences asset` brief AND `assetsEnabled()`: append a declare-by-
default offer to the create context — seam is `src/index.ts` line ~593 where
`assetBriefContext(assetBrief)` joins `enrichedContext`. Add
`assetBriefPlanningOffer(brief)` to `src/assetBrief.ts`: name 3-4 fitting
`asset-<id>` kinds with the brief's accent prefilled
(`params:[{"name":"accent","value":"<brief accent>"}]`) and on-topic copy
instructions, phrased like the recipes "declare-by-default but droppable"
section (see `skillContext.ts`). Degrade-never-veto; the planner may decline.
Keep prompt bytes tight (`test/promptBudget.test.ts` is the budget).

**C. Verify ladder** before the probe: `npm run typecheck`, `npm run test`
(expect **3 pre-existing/environment failures unrelated to assets** — see
gotchas), `npm run film:demo`, then
`SLACK_SEQUENCES_ASSETS=1 npm run sequence:check -- <dense brief> --no-mcp`
(no Slack needed) and check the storyboard declares `asset-*` plugins and the
film carries the sequences-assets island.

**D. ONE paid live probe** with `SLACK_SEQUENCES_ASSETS=1` on a dense brief
(e.g. a launch with a hero stat + award + CTA so glass-metric / laurel-badge /
cta-button / browser-hero are natural picks). Apply the **live-probe policy**
(PROBE_LOG.md): any burned attempt with a mechanical cause → pause, fix
deterministically (SENTINEL.md placement tree), regression test, ONE log row,
resume. Analyze whether the planner actually declared assets and whether they
visibly beat model-drawn equivalents; if the planner under-uses them, the
sanctioned levers are the offer text (B), the planning lines
(`planningLine` in assetContract), or a host-side auto-declare — never gate
loosening. The owner explicitly allows agent-architecture changes if weak,
then a second probe.

**E. Flip the default** if the probe publishes clean: `assetsEnabled()` in
`sentinelFlags.ts` → `!== "0"`, with `SLACK_SEQUENCES_ASSETS=0` as the revert.
⚠️ The asset kinds join `PLUGIN_CATALOG` at MODULE LOAD — after flipping,
`test/helpers/enableAssetsFlag.ts` becomes redundant (keep it, it's harmless)
and the default-ON path gets exercised by the whole suite; re-run everything.

**F. Docs + publish.** Update: ASSETS.md (runtime shipped, trigger/preBeat
vocabulary, the beats-ride-component-rails decision, flag state), SENTINEL.md
(flag table + contract table rows `normalize.asset-lower`/`assets.contract`),
CLAUDE.md (assets paragraph — runtime no longer "NOT built"), ROADMAP.md,
studio/INTEGRATION.md (plugin-seam table: asset lowering now EMITS
components/beats; the injection-order row gains `assets` between fx and
recipes; kit CSS `.asset` baseline note), PROBE_LOG.md rows from D. Then
commit; publishing (`bash scripts/publish-public.sh`) and deploying
(`railway up`) are separate owner steps — flag, don't run, unless asked.

## Gotchas discovered this session (will bite you)

1. **Vitest invocation:** run tests ONLY via
   `npm run test --workspace @sequences/slack` (optionally `-- -t "<name>"`).
   Direct `npx vitest run <file>` hits a PRE-EXISTING
   `@hyperframes/core/dist/core.types` resolution error for any file that
   value-imports the directComposition chain (confirmed pre-existing on the
   untouched `.publish` snapshot), and `--root ../..` invocations also collect
   the stale `.publish/` tree — phantom duplicate results.
2. **Pre-existing suite failures (NOT yours, NOT asset-related):** the full
   suite has a small number of failures that exist without these changes —
   verify against `git stash` if unsure before chasing anything.
3. **Flag at module load:** `PLUGIN_CATALOG` appends asset kinds when
   `pluginContract.ts` EVALUATES. Tests that need the catalog path import
   `test/helpers/enableAssetsFlag.ts` FIRST. `sequence:check`/probes need the
   env var set when the process starts.
4. **Island equality is byte-exact:** `animate` beats live in BOTH the
   components island (paperwork, skipped by that runtime) and the assets
   island (spring payload). If you touch `ResolvedComponentBeatV1`, keep
   `animation` round-tripping in `parseComponentPlan` or every asset film
   fails `sequences-components island differs…`.
5. **Beat dedupe channel:** all `animate` beats on one unit share channel
   `"asset"` — overlapping windows on the same part would drop the later beat.
   The lowering sequences them (enter → payoffs, +0.15s gaps); keep it that
   way when adding choreography.
6. **`data-component="asset"`** is stamped by `renderAssetInstance` — the
   component gate requires it on the unit root; don't remove it from the
   wrapper markup.
7. The working tree also carried the (previously uncommitted) asset
   foundation from the prior session — everything is committed together now.
