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

`prompts/planning-director.md` byte counts, before/after Phase 1:

| | bytes |
| --- | --- |
| before Phase 1 | ⏳ |
| after Phase 1 | ⏳ |

Assembled author prompt (fixture job), before/after: ⏳ (enforced by Phase-4
`test/promptBudget.test.ts`).

---

## Incident replays (2026-07-05)

Proof both incidents pass on attempt 1 with zero repairs for those classes —
populated in Phase 1.

---

## Open items

- **Paid baseline numbers.** The mission metrics table needs the §7 probe set
  run once at baseline (flags OFF) and once post-Phase-5 (flags ON). The
  instrument is proven on a real model-free run; the paid runs are a spend
  decision and are pending. When run, each records its project dir here.
