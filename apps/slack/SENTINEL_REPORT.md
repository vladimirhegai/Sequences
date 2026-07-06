# SENTINEL_REPORT.md — implementer's report

Companion to [SENTINEL_PLAN.md](SENTINEL_PLAN.md). Structured per plan §8 and
updated per phase. Every claim that needs evidence names its file/command; a
probe that fell back is recorded here with its `FAILURE.md` path, never retried
silently into a clean table.

**Implementer:** Claude (Opus 4.8). **Started:** 2026-07-05.

Verification legend for "commands run": ✅ ran clean · ⚠️ ran with caveat · ⏳
not yet run (paid probe / infra layer). Which layers actually ran is summarized
at the end of each phase.

---

## Phase 0 — telemetry baseline

**Status:** code complete + instrument proven on a real (model-free) run. Paid
baseline numbers deferred to the probe step (see Open items).

### What changed (files + why)

- **`src/engine/sentinelTelemetry.ts`** (new) — one `planning/sentinel-run.json`
  per job: per-stage wall-clock + attempts, model-call count, prompt/completion
  chars, findings-by-layer (L0→L5), deterministic-normalization tags, tier-1 /
  tier-2 wall-clock, and the run disposition
  (`published | published-degraded | fallback | fail-loud`). Collection uses
  `AsyncLocalStorage` (`beginSentinelRun` via `enterWith`) so the deep model-call
  and repair seams never grow a `projectDir` parameter. Diagnostic-only: no
  context ⇒ every record is a silent no-op; a disk fault never disturbs a build.
- **`src/engine/sentinelFlags.ts`** (new) — the single source of truth for the
  Sentinel kill-switches (`sentinelSkeletonEnabled` / `sentinelSlotsEnabled`),
  both default OFF until Phase 5 flips them.
- **`src/engine/compositionRunner.ts`** — `completeWithRetry` /
  `completeReasoningWithRetry` record one logical (de-hedged) model call each
  with prompt/completion chars; `applyDeterministicSourceRepairs` records L2
  normalizations for the six paperwork classes Phase 1 targets
  (island-strip, contract-binding, camera-world-plane, component-binding,
  component-alias, interaction-binding, runtime-order); `authorComposition`
  attributes each rejected attempt to `static` (L3) / `browser` (L4) and counts
  paid re-authors as `model-retry` (L5).
- **`src/orchestrator.ts`** — `createVideo` enters a Sentinel run at the top of
  both the model-authoring branch and the preset/demo branch, records tier-1
  (authoring→submit) and tier-2 (incl. MP4) wall-clock, attaches the stage
  receipts, and finalizes the disposition — including `fail-loud` on both throw
  paths. Reuses the existing `stages`/`performance.now()` timings; **ETA
  behavior (`stageTimings.ts`) is untouched.**
- **`scripts/sentinelReport.ts` + `npm run sentinel:report`** (new) — aggregates
  every `sentinel-run.json` (+ sibling `author-run.json`) under a directory into
  the mission metric table (markdown or `--json`), with a `--label` for
  before/after captures and a per-run detail table.

### Deviations from the plan

- **Tier wall-clock basis.** The plan lists "wall-clock to tier-1 (thumbnails
  posted)" and "tier-2 (MP4)". `createVideo` returns after tier-1 in the live
  two-tier flow, and `render_preview`/`render` live inside `buildPreviews`, so
  `tier1Ms` is measured as **authoring→submit** (the model-bound portion that
  dominates tier-1 wall-clock; the thumbnail `render_preview` is fast and
  infra-bound, already timed in `stage-timings.json`). `tier2Ms` is the full
  elapsed including MP4 when a run renders in one call (as `sequence:check`
  does). This is labeled in the report and is honest about what it measures.
- The plan suggested `scripts/sentinel-report.mjs`; implemented as a `tsx`
  script (`sentinelReport.ts`) to match the repo's script convention and reuse
  `SLACK_SEQUENCES_DATA_DIR` resolution.

### Flags added

`SLACK_SEQUENCES_SENTINEL_SKELETON` (Phase 1),
`SLACK_SEQUENCES_SENTINEL_SLOTS` (Phase 2) — both default OFF.

### Tests / commands run

- `npm run typecheck --workspace @sequences/slack` — ✅ exit 0.
- `npm run sequence:check --workspace @sequences/slack -- --demo --no-mcp
  --format json --job-id sentinel-phase0-demo` — ✅ produced a real
  `planning/sentinel-run.json` (disposition `published`, 0 model calls — the
  demo is model-free).
- `npm run sentinel:report --workspace @sequences/slack -- <project-dir>` — ✅
  produced the metric table from that real run (shown below).
- Regression subset (orchestrator, authorReliability, directComposition,
  stageTimings): ✅ 158/158 passed.

Evidence path:
`.data/projects/sentinel-phase0-demo/planning/sentinel-run.json`.

### Acceptance verdict

**PASS (instrument).** The report script produces the metric table for a real
`createVideo` run. Model-path fields (storyboard/source attempts, model calls,
author prompt chars, layer/normalization counts) populate only on a paid run;
those baseline numbers are captured in the Metrics table below once the probe
step runs. `stageTimings.ts` (ETA) behavior unchanged.

---

## Phase 1 — kill model-owned paperwork (PRIORITY, shippable)

**Status:** code + tests complete, full suite green, `film:demo` byte-stable.
Flag-gated behind `SLACK_SEQUENCES_SENTINEL_SKELETON` (default OFF until Phase 5).

### What changed (files + why)

1. **Host plan islands are host-owned, always** (unconditional, not flag-gated —
   the L2 fix for 2026-07-05 incident 2). `compositionRunner.ts`:
   `stripAllHostPlanIslands` + `HOST_PLAN_ISLAND_IDS` remove **every**
   model-authored `sequences-{interactions,cuts,camera,components,time}` island
   before the per-plan injection re-emits the canonical island. The old
   `stripUnusedHostPlanIslands` only removed islands with *no* matching plan, so
   a shadow island that mirrored a real plan (wrong `version`, non-array
   `scenes`) survived to validation. Now nothing the model hand-writes about an
   island can reach the gate. `stripUnusedHostPlanIslands` is retained/exported
   (still unit-tested) but no longer on the pipeline.
2. **Camera-world plane + stations in the skeleton** (flag-gated, incident 1a).
   `buildSceneSkeleton`/`buildSceneSkeletons` emit, for a camera scene, the
   `data-camera-world` plane sized by `cameraWorldStyle` and each `data-region`
   station at its exact `worldStationRects` rect (the same math
   `worldLayoutGuidance` renders as prose), plus a screen-space
   `data-camera-overlay` when the scene has interactions.
3. **Component roots + focal-part carriers in the skeleton** (flag-gated,
   incident 1b). `componentContract.ts`: `componentSkeletonMarkup` stamps the
   catalog exemplar (correct tag, `cmp cmp-<kind>` class, `data-component`, valid
   interior) with the component's real id as `data-part`. Region-bearing
   components nest in their station; cut/camera focal parts that name no
   component get a bare `data-part` carrier. `component_root_missing`,
   `component_beat_unbound`, and the cut/camera focal-part classes become
   unrepresentable.
4. **Runtime script block / registration seam** — see Deviations. The obligation
   already lives at L2 (`ensureRuntimeScriptOrdering`, unconditional); kept there.
5. **`gsap.timeline({ paused: true })` false-reject fixed** (`directComposition.ts`).
   `hasPausedTimeline` replaces the `[^}]*` regex with a brace-balanced scan, so
   `gsap.timeline({ defaults: { ease: "none" }, paused: true })` no longer
   false-rejects a valid composition (FALLBACKS.md "Known open risks" — now
   closed).
6. **Prompt** (`planning-director.md`) — the interactions "copy those interaction
   objects into a JSON island and call compile" instruction and the "load
   `sequences-interactions.v1.js`" runtime rule are replaced with a one-line
   "the host injects/owns every contract island, runtime, and compile call —
   never author them" statement (their obligation moved to L2). See Deviations
   for why the larger scaffold-prose deletions are staged to the Phase-5 flip.

### Deviations from the plan

- **Item 4 (runtime block in skeleton).** Not emitted in the prompt skeleton.
  The obligation is already fully owned at L2 by `ensureRuntimeScriptOrdering`
  (unconditional — it collapses/orders all five runtime `<script src>` tags and
  injects missing ones after GSAP), and neither incident was a script-order
  failure. Emitting a large runtime literal for the model to reproduce would
  *add* a failure surface for no gain, so the L2 mechanism stays the owner and
  the load-bearing "Load GSAP as `<script src="gsap.min.js">`" / "one paused
  timeline registered under the composition id" rules are kept (GSAP itself is
  not host-injected). Rationale: minimal deviation, no incident class left open.
- **Prompt deletions are staged.** The scaffold (items 2-3) is flag-gated OFF by
  default, so the world-building / component-root prose is still needed by the
  default (flag-OFF) path; deleting it now would degrade the shipping default.
  Only the island-authoring obligation (item 1, unconditional L2) was removed
  from the prompt in Phase 1. The larger scaffold-prose deletions land with the
  Phase-5 default flip, when the skeleton is authoritative. Net Phase-1 prompt
  delta is therefore ~neutral (a rewrite, not a shrink): 36,950 → 37,010 bytes.
- **Skeleton flag ON is unit-proven, not yet paid-probed.** The builder is proven
  by direct unit tests; the full flag-ON model path is validated by a Phase-5
  paid probe (pending).

### Flags added

`SLACK_SEQUENCES_SENTINEL_SKELETON` (default OFF; `=1` enables the scaffold).

### Tests added (names)

`test/authorReliability.test.ts`, new describe blocks:
- **"Sentinel Phase 1 — skeleton scaffold makes paperwork classes
  unrepresentable"**: incident-1 replay asserts the skeleton emits the plane +
  stations (with exact rects) + component root and that
  `reconcileCameraWorldPlanes`/`reconcileComponentBindings`/`reconcileContractBindings`
  report **0 repairs** on a doc built from the skeleton; a contrast test proves
  bare shells lack both (the class was real); a test asserts the component root
  stamps the real id + kit class and does not leak the exemplar id.
- **"Sentinel Phase 1 — host plan islands are host-owned, always"**:
  `stripAllHostPlanIslands` removes all five islands unconditionally; incident-2
  replay proves a shadow `sequences-camera` island (non-array `scenes`) is
  replaced by the canonical plan (exactly one island, `scenes` is a real array)
  and a shadow `sequences-interactions` island (`version: 9`) is removed when the
  plan declares no interactions.
- **"hasPausedTimeline — Sentinel Phase 1 false-reject fix"**: accepts nested-config
  + bare paused forms, rejects a non-paused nested-config timeline.

### Commands run

- `npm run typecheck --workspace @sequences/slack` — ✅ exit 0.
- `npm run test --workspace @sequences/slack` — ✅ **483/483** across 40 files
  (all browser gates included).
- `npm run film:demo --workspace @sequences/slack` — ✅ passes; the model-free
  path shares none of the changed code (`applyDeterministicSourceRepairs`,
  `creationPrompt`, `buildSceneSkeletons` are not on it) and the `gsap` gate
  only relaxed, so it is byte-stable.

### Acceptance verdict

**PASS.** Both 2026-07-05 incident replays pass on attempt 1 with **zero
repairs** logged for the camera-world, component-root, and island classes.
`SLACK_SEQUENCES_SENTINEL_SKELETON=0` reverts to bare shells (default). Legacy
paths intact; full suite + `film:demo` green.

---

## Phase 2 — scene-scoped authoring (slots)

**Status:** cut-line shipped (slot artifact boundary + host assembly + validation
attribution + truncation-tail recovery), flag-gated behind
`SLACK_SEQUENCES_SENTINEL_SLOTS` (default OFF). Full slot-scoped *validation*
retry is the reassess item (see Deviations). Full suite green (491/491),
`film:demo` byte-stable.

### What changed (files + why)

- **`src/engine/sceneSlots.ts`** (new) — the artifact-boundary change:
  - `extractSceneSlots(raw)` parses `<film_style>` + per-scene `<scene_html id>` /
    `<scene_script id>`, tolerant of a truncated tail (an unclosed slot marks
    `truncated` and is dropped; completed slots are kept).
  - `assembleSlotComposition(...)` deterministically builds the canonical
    document: chassis + shared `<style>` + host-owned `<section>` wrappers
    (id/timing/track) around each interior + one paused timeline that invokes
    each scene's statements in its own `(function (tl) { … })(tl)` scope +
    host-owned `window.__timelines` init/registration/seek. Byte-stable for
    fixed inputs; `applyDeterministicSourceRepairs` then injects runtimes,
    islands, compile calls, and kits exactly as for a whole-doc composition.
  - `attributeFindingsToScenes(findings, ids)` maps each rejection to the
    scene(s) it names (arrows `a->b` attribute to both; a dashed id never
    matches inside a longer one; film-level findings land under `__film__`).
- **`src/engine/compositionRunner.ts`**:
  - `buildSceneSkeletonInterior` extracted from `buildSceneSkeleton` (+
    `sceneSkeletonOpenTag`, `skeletonContext`), and `buildSceneSlotInteriors`
    exposes the per-scene interior templates the slot prompt shows.
  - `slotSceneTemplates` / `slotResponseContract` — the slot prompt (host owns
    the wrappers/chassis/timeline; author returns film_style + interiors +
    per-scene statement blocks). `creationPrompt` grows a `slots` mode.
  - `authorSlotDraft` runs the first authoring pass as slots: request → parse →
    **truncation-tail recovery** (re-request only the missing scenes, keeping
    every completed one — the `slotContinuationPrompt`) → assemble. Wired into
    `authorCompositionLoop` behind `useSlots` (`sentinelSlotsEnabled()` &&
    locked storyboard && first full pass). `logSlotFindingAttribution` reports
    findings-by-scene on a slot rejection.
- **`src/engine/sentinelFlags.ts`** — `sentinelSlotsEnabled()`.

### Deviations from the plan

- **Retries after the first slot pass stay whole-doc (the §3 cut-line).** The
  plan's full slot-scoped *validation* retry (re-request only failing scenes in
  parallel, cap 2, then a whole-doc terminal rung) is **not** implemented; a slot
  attempt that fails validation falls through to the existing whole-doc ladder
  (compact patch / full re-author on the assembled document). This ships "slot
  validation attribution but whole-doc retries," which the plan explicitly names
  as the shippable Phase-2 cut-line. The parallel slot-scoped validation retry is
  the reassess item — the artifact boundary + attribution it needs are now in
  place (`attributeFindingsToScenes`, `authorSlotDraft`).
- **Truncation recovery is implemented** (Phase 2.4): `authorSlotDraft` keeps
  completed scenes and re-requests only the missing tail once before falling
  back, rather than deleting `MAX_AUTHOR_SEGMENTS` (which stays for the whole-doc
  path until the slot path is default-on and probe-confirmed).

### Flags added

`SLACK_SEQUENCES_SENTINEL_SLOTS` (default OFF; `=1` enables slot authoring).

### Tests added (names)

- **`test/sceneSlots.test.ts`** (7): `extractSceneSlots` (parse, truncation,
  fence-strip); `assembleSlotComposition` (canonical wrappers/timeline,
  determinism, missing-scene reporting); `attributeFindingsToScenes`.
- **`test/sceneSlots.browser.test.ts`** (1): a two-scene slot response is
  assembled + repaired and passes the **real gate** — `validateDirectComposition`
  clean and `inspectDirectComposition` ok. (This caught a real bug: the assembly
  must `window.__timelines = window.__timelines || {}` before registration —
  now fixed and asserted by the gate.)

### Commands run

- `npm run typecheck --workspace @sequences/slack` — ✅ exit 0.
- `npm run test --workspace @sequences/slack` — ✅ **491/491** across 42 files.
- `npm run film:demo --workspace @sequences/slack` — ✅ identical output
  (lint clean · 3 static warnings · 48 samples · 6 warnings), byte-stable.

### Acceptance verdict

**PARTIAL (cut-line met).** The scene-addressable artifact boundary, host
assembly, per-scene validation attribution, and truncation-tail recovery are in
and gated; an assembled composition passes the real browser gate. The plan's
headline cost-lever metric ("a seeded single-scene failure costs one ~4k call")
requires the full slot-scoped validation retry, which is deferred to the
reassess along with its paid-probe confirmation.

---

## Metrics table (baseline vs post-Phase-5)

Populated from `npm run sentinel:report`. Baseline = pre-Sentinel defaults
(flags OFF); Final = Phase-5 defaults (flags ON).

| Metric | Target | Baseline | Final |
| --- | --- | --- | --- |
| Hard authoring failures (fail-loud) | 0 | ⏳ | ⏳ |
| Storyboard attempts / run (avg) | ≤ 1.5 | ⏳ | ⏳ |
| Source-author attempts / run (avg) | ≤ 1.5 | ⏳ | ⏳ |
| Wall-clock to tier-1 (avg) | ≤ 8 min | ⏳ | ⏳ |
| Wall-clock to tier-2 (avg) | ≤ 14 min | ⏳ | ⏳ |
| Author prompt size (max chars) | ≤ 45,000 | ⏳ | ⏳ |
| Model calls / clean run (avg) | ≤ 5 | ⏳ | ⏳ |

⏳ = requires a paid `sequence:check` probe (§7). Not yet run — see Open items.

---

## Prompt diff summary

`prompts/planning-director.md` byte counts:

| | bytes | lines |
| --- | --- | --- |
| before Phase 1 | 36,950 | 625 |
| after Phase 1 | 37,010 | 624 |

Phase-1 delta is a rewrite (island-authoring instruction → host-owned reminder),
not a shrink — the scaffold-prose deletions are staged to the Phase-5 flip (see
Phase 1 Deviations). Assembled author prompt (fixture job): enforced by Phase-4
`test/promptBudget.test.ts` (≤ 45k) — ⏳ pending Phase 4.

---

## Incident replays (2026-07-05)

Both incidents pass on attempt 1 with **zero repairs** for their classes, proven
by `test/authorReliability.test.ts` (all 64 file tests green):

- **Incident 1** (`incident 1 replay: skeleton emits the camera-world plane +
  component root; zero repairs`): the skeleton for the camera scene contains
  `data-camera-world` + both `data-region` stations at their exact rects, and the
  component scene contains `data-part="cmd-palette"` / `data-component`; a doc
  built from the skeleton yields `reconcileCameraWorldPlanes`,
  `reconcileComponentBindings`, and `reconcileContractBindings` **repairs = 0**.
- **Incident 2** (`incident 2 replay: a model-authored shadow sequences-camera
  island is replaced with the canonical plan`): a shadow `sequences-camera`
  island with `"scenes":"not-an-array"` becomes exactly one canonical island
  whose `scenes` is a real array after `applyDeterministicSourceRepairs`; a
  shadow `sequences-interactions` island (`version: 9`) is removed when the plan
  declares no interactions.

Evidence: `apps/slack/test/authorReliability.test.ts`; run with
`npm run test --workspace @sequences/slack`.

---

## Open items

- **Paid baseline numbers.** The mission metrics table needs the §7 probe set
  run once at baseline (flags OFF) and once post-Phase-5 (flags ON). The
  instrument is proven on a real model-free run; the paid runs are a spend
  decision and are pending. When run, each records its project dir here.
