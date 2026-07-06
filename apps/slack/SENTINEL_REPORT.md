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

Populated from `npm run sentinel:report`. Per the user's decision, **one**
baseline probe (flags OFF) + **one** final probe (flags ON) were run on the §7.1
dense-UI brief (command-palette + modal + stat-card + button + terminal),
`--provider openrouter-api --no-mcp --render`, fail-loud ON. The full 3-brief ×
2 set is left for the Phase-5 pass.

Note: "Baseline" here is **not** truly pre-Sentinel — Phase 1's unconditional
island-strip is active even with flags OFF (it is not flag-gated). The baseline
below already shows it firing 10× (`island-strip: 10`), i.e. the model authored
10 host islands that would have reached validation pre-Sentinel (the incident-2
fallback risk). "Final" = `SENTINEL_SKELETON=1 SENTINEL_SLOTS=1`.

| Metric | Target | Baseline (flags OFF) | Final (flags ON) |
| --- | --- | --- | --- |
| Disposition | published | **published, no fallback** | **fail-loud** (see below) |
| Hard authoring failures (fail-loud) | 0 | 0 | 1 |
| Visible fallbacks | 0 | 0 | 0 (failed loud, not fallback) |
| Storyboard attempts / run (avg) | ≤ 1.5 | 3 | 4 |
| Source-author attempts / run (avg) | ≤ 1.5 | 3 | 4 (exhausted → rescue) |
| Wall-clock to tier-1 (avg) | ≤ 8 min | 22.1 min | n/a (never reached tier 1) |
| Wall-clock to tier-2 (avg) | ≤ 14 min | 24.1 min | n/a |
| Author prompt size (max chars) | ≤ 45,000 | 105,516 | 107,535 |
| Model calls / clean run (avg) | ≤ 5 | 8 | 9 (failed run) |

Baseline layer breakdown: normalize **26** (island-strip 10, interaction-binding
14, runtime-order 2), static 1, browser 2, model-retry 2; scaffold 0 (flags OFF).
Final layer breakdown: normalize **36** (island-strip 10, interaction-binding 23,
runtime-order 3), static 1, browser 3, model-retry 3; scaffold 0.
Project dirs (immutable): baseline `.data/projects/sentinel-baseline-denseui`;
final `.data/projects/sentinel-final-denseui`.

### Final probe — honest failure (flags ON)

**The flags-ON run FAILED (fail-loud) at source-author** —
`FAILURE.md`: `.data/projects/sentinel-final-denseui/FAILURE.md`. This is
reported, not retried into a clean table. What happened, from the persisted
artifacts:

- The Phase-2 **slot path was exercised live** (author attempts 1 and 3 logged
  `scene slots`; the per-scene attribution worked —
  `slot findings by scene — command-palette-hook:2 deploy-and-stream:2`).
- Author attempts 1/3 (slots) and 2 (compact patch) were rejected on
  **`near_blank_film` / `near_blank_scene`** — the scenes rendered as blank
  frames. The source-rescue rung (tencent/hy3-preview, whole-doc) also failed →
  fail-loud.
- **Root cause (evidence-backed).** The assembled slot document
  (`planning/attempts/author-1-static-rejected.html`) has **no `.scene` stage
  CSS**: the model's `<film_style>` supplied design tokens but omitted the
  structural rule (`.scene { position:absolute; inset:0; … }` and composition-root
  sizing) that the whole-doc path authors implicitly. Without it the
  `<section class="scene clip">` wrappers and their `data-camera-world` planes
  (4800×2160 absolute) are not stage-positioned, so content lands off-frame and
  every scene samples blank.
- **The shipping default is unaffected.** SLOTS/SKELETON default OFF; the same
  brief on the default path (the baseline) **published cleanly with no
  fallback**. The failure is entirely inside the opt-in Sentinel path.
- **Concrete fix for the resume** (not applied — user paused): the stage layout
  is host-owned, so `assembleSlotComposition` should inject a minimal
  deterministic stage `<style>` (`.scene` absolute/inset, root sizing,
  camera-world containment) into the assembled `<head>` — exactly as the cinema
  and component kits are injected — so scene positioning never depends on the
  model's `film_style`. This is a Phase-1-style "host owns structure" move and is
  the gate on flipping SLOTS on. Isolating whether SKELETON-only (slots off) is
  clean needs one more probe.

**Conclusion:** the baseline confirms the shipping default is healthy on the
hardest §7 brief (published, no fallback); the final probe shows the opt-in
slot path is **not yet judge-ready** and correctly stays flag-OFF. Phase 5's
default flip is appropriately blocked until the stage-CSS fix lands and a probe
confirms it.

**What the baseline proves about the plan's diagnosis** (the §1 doom loop, now
measured): storyboard-plan alone was **~16.9 min across 3 attempts** — by far the
dominant cost — and the author prompt was **105,516 chars** (2.3× the 45k
target). These are exactly what Phase 3 (normalize-before-retry + ladder/latency
retune) and Phase 4 (prompt-budget test) target and are **not yet built** (the
user paused after Phase 2). The Sentinel *paperwork* fixes (Phases 1-2) do not
by themselves move storyboard latency or prompt size; those two metrics move
only with Phase 3-4.

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

The user directed **Phase 2 only, then reassess**, and after Phase 2 chose to
**pause** (report finalized with one baseline + one final probe). The following
are therefore deliberately deferred, not dropped:

- **Slot-path stage CSS (the gate on flipping SLOTS on).** `assembleSlotComposition`
  must inject a host-owned minimal stage `<style>` (`.scene` absolute/inset, root
  sizing, `data-camera-world` containment) so scenes are positioned regardless of
  the model's `film_style`. The final probe failed loud precisely because this was
  missing (blank frames). This is the first thing to do when Phase 2 resumes,
  followed by a confirming probe. Until then SLOTS must stay default OFF.
- **Phase 3 — storyboard normalization + ladder/latency retune** (NOT built).
  The baseline measured the exact problem it targets: storyboard-plan ~16.9 min
  over 3 attempts, driven by *pacing/reading* and *moment-spacing* rejections
  (mechanically normalizable — reading-floor shift, moment top-up already exists
  partially). Highest-value remaining work for the Jul 13 latency target.
- **Phase 4 — contract manifest (`sentinel.ts`) + prompt-budget test +
  SENTINEL.md** (NOT built). The baseline author prompt was 105,516 chars (2.3×
  the 45k target); `test/promptBudget.test.ts` would enforce the ceiling. The
  closed-world finding-prefix CI test and the feature-addition protocol doc are
  the "airtight system + how to extend it" deliverable — still owed.
- **Phase 5 — flip defaults ON + full §7 probe set + Docker/Railway smoke** (NOT
  done). Flags remain default OFF; the legacy path is the shipping default.
- **Phase 2 full slot-scoped validation retry** — the cut-line shipped; the
  parallel per-scene re-request (the headline cost lever) is deferred (its
  attribution + assembly substrate are in place).

Probe artifacts (immutable):
- Baseline (flags OFF): `.data/projects/sentinel-baseline-denseui` — published,
  no fallback.
- Final (flags ON): `.data/projects/sentinel-final-denseui` — **failed loud**;
  `FAILURE.md` at `.data/projects/sentinel-final-denseui/FAILURE.md` (root cause
  + fix in "Final probe — honest failure" above).

---

## Auditor review + fixes (2026-07-05, Claude Fable)

Audit of the five Sentinel commits (`8e34aee`…`240c600`) against SENTINEL_PLAN.md,
the diff, and the persisted probe artifacts.

**Verdict:** Phase 0 PASS · Phase 1 PASS (both incident replays verified in the
suite; the staged-prompt-deletion and L2-runtime-block deviations are sound
calls) · Phase 2 cut-line met, and the reported flip-gate defect was real —
root-caused correctly from `attempts/author-1-static-rejected.html`. The report
was honest, with one stale contradiction (its closing line still said "no probe
failed loud" from the pre-probe commit — corrected above).

**Fixes applied by the auditor** (this commit):

1. **Slot stage floor + host-owned scene-window visibility** — the flip gate.
   `assembleSlotComposition` now injects `<style id="sequences-slot-stage">`
   (root sizing, `.scene{position:absolute;inset:0;opacity:0}`, `.clip`
   containment, overlay positioning) BEFORE the model's `film_style`, and emits
   host-owned `tl.set` reveal/clear pairs per scene AFTER the authored scene
   blocks (host wins insertion-order ties at window edges — an authored wrapper
   set can never leave a scene stuck hidden). Mirrors the proven
   `fallbackComposition.ts` convention. The slot prompt + continuation prompt
   now say the host owns stage + visibility (no wrapper opacity sets).
2. **`attributeFindingsToScenes` colon boundary.** Colon-delimited signatures —
   the exact shape of the live failure receipts
   (`component_root_missing:palette-ship:cmd-palette`) — previously fell into
   `__film__`; `:` joined the left token boundary.
3. **Skeleton overlay positioned inline.** The Phase-1 shell's
   `<div data-camera-overlay>` carried no style; copied verbatim it would sit in
   static flow and push the world plane. Now
   `style="position:absolute;inset:0;pointer-events:none"`.
4. **Tests hardened to prove the chassis, not the fixture.**
   `test/sceneSlots.browser.test.ts` now supplies NO structural CSS and NO
   wrapper visibility sets (the `sentinel-final-denseui` condition) and still
   passes the real gate (`validateDirectComposition` clean +
   `inspectDirectComposition` ok). `test/sceneSlots.test.ts` adds stage-floor /
   visibility-emission assertions and the colon-signature attribution case.

**Verification:** slack typecheck ✅ · full slack suite ✅ (all files, incl.
both slot tests + browser QA) · fix commit noted below.

**Remaining gate on flipping SLOTS on:** one paid probe (the §7.1 dense-UI
brief, `SENTINEL_SKELETON=1 SENTINEL_SLOTS=1`, fail-loud) must publish. The
stage-CSS root cause is fixed and browser-proven; the probe confirms it
end-to-end. A separate SKELETON-only probe isolates the two flags.
