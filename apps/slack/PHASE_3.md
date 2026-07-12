# Phase 3 implementation and audit log

Date: 2026-07-11
Scope requested: Phase 3 camera phrase work and LP-1 validation.

## Specification reconciliation

The user request names S3.1-S3.5. The checked-in `REFACTOR_PLAN.md` defines
Phase 3 as S3.1-S3.4 followed by the LP-1 checkpoint; no S3.5 entry exists in
the repository. This implementation treats LP-1 as the fifth deliverable and
does not invent an undocumented refactor step.

## Safety and ownership constraints loaded

- Read root `CLAUDE.md`, `apps/slack/CLAUDE.md`, the complete Phase 3 section
  of `REFACTOR_PLAN.md`, `REFACTOR_HANDOFF.md` section 4, `SENTINEL.md`,
  `OPERATIONS.md`, and `.claude/skills/sequences/SKILL.md`.
- Existing user-owned change detected in `apps/slack/PROBE_LOG.md`; it is
  preserved and will not be included in step commits unless LP-1 needs a new,
  separately attributable ledger entry.
- Existing untracked `.tmp/` is left alone except for a new cache-distinct
  LP-1 input if the checkpoint reaches the paid-probe stage.
- No publish or deploy is authorized or planned.

## Baseline architecture audit

- `cameraContract.ts` owns authored move normalization and compiles it into
  `CameraPlanV1` segments.
- `cameraBlocking.ts` independently turns direction-score and continuity data
  into `CameraBlockingPhraseV1` objects. Those objects already contain target,
  contextual framing, occupancy, arrival anchor, corridor, dwell, and handoff
  information, but omit source pose, explicit travel/settle/departure
  intervals, evidence owner, and route ownership.
- `sequences-camera.v1.js` reads both the camera and blocking JSON islands. In
  continuity mode it routes the lens from blocking phrases, with additional
  runtime-only primary/supporting filtering and same-target collapse.
- `layoutInspector.ts` parses the blocking island for primary landing and
  occupancy checks, but also falls back to independently derived camera
  segments for sparse-framing samples.
- `eyeTrace.ts` derives incoming attention from the raw first authored camera
  move rather than the route the runtime executes.
- `pacingAudit.ts` budgets raw full-move counts using scene duration and its L2
  normalizer deletes low-energy authored moves. Phase 3 requires replacing
  that count budget with one primary route/idea per scene.

## Planned migration seam

1. Introduce `cameraPhrase.ts` as the typed semantic owner and compile the
   existing authored-camera plus direction/continuity inputs into it once.
2. Preserve the existing blocking-island id as a wire-compatibility adapter,
   while making its payload the canonical phrase plan used by runtime and QA.
3. Move deterministic same-pose/same-target collapse out of browser runtime
   selection and into the typed compiler; register `camera-phrase-collapse`.
4. Make layout and eye-trace resolve attention, landing samples, occupancy,
   anchors, and tolerances from the canonical phrase fields.
5. Replace raw move-count budgeting with primary-route ownership and an
   actionable finding naming the competing scene ideas.

## Execution log

Implementation and verification entries will be appended below as each
S3.x commit is completed.

### S3.1 — canonical phrase compilation

- Added `src/engine/cameraPhrase.ts` with the required phrase fields: focal
  target, optional contextual framing target, source/arrival semantic poses,
  travel/settle/dwell/departure intervals, importance, evidence owner,
  occupancy and screen-anchor contracts, and typed route ownership.
- `resolveCameraBlockingPlan` now performs the join with the already-resolved
  authored `CameraPlanV1`. A matching non-connective authored segment owns the
  route; graph identity/handoffs own continuity routes; remaining direction
  requests are host-derived.
- Kept `CameraBlockingPhraseV1` and `CameraBlockingPlanV1` as deprecated type
  aliases and kept the existing JSON island id. This is deliberate wire
  compatibility while runtime/QA consumers migrate in S3.2-S3.3.
- Added unit coverage for authored, continuity, and host-derived compilation.
- Verification: Slack typecheck passed; 87 focused unit tests passed; 14
  camera/blocking/continuity browser tests passed; `film:demo` rendered all
  four cuts, reported zero eligible dead-frame windows, and completed without
  changing the runtime route.
- No paid calls, publish, or deploy.

### S3.2 — deterministic collapse before runtime

- Added a pure collapse pass to the phrase compiler. Once a scene declares a
  primary route, supporting direction evidence stays local unless it owns an
  independently authored destination. Consecutive phrases with the same
  target/context and a sub-threshold semantic pose are merged, extending the
  readable dwell and retaining `collapsedPhraseIds` provenance.
- The canonical summary now distinguishes input phrases, executed phrases,
  and collapsed phrases. The source normalizer emits
  `camera-phrase-collapse` only when it changes the host island, preserving
  idempotent replay telemetry.
- Exact SignalDock evidence from
  `.data/projects/architecture-stress-5-20260711/composition/manifest.json`:
  14 input phrases became 7 routes — `scattered-signals=1`,
  `gather-workspace=2`, `dependency-approval=2`, `resolve-94=2`.
- Added a minimized 14-phrase regression encoding the same ownership and
  repeated-target shape.
- `replay:all` initially failed all seven source hashes, as expected: the
  canonical camera island intentionally gained new fields and fewer routes.
  Artifact hashes and all storyboard hashes were unchanged. Refroze only the
  seven deterministic source replay hashes, then reran 13/13 successfully.
- Verification: Slack typecheck; 34 focused phrase/blocking/normalizer/
  Sentinel tests; exact replay 13 passed, 0 skipped, 0 failed.
- No gate was loosened, and no paid call, publish, or deploy occurred.
