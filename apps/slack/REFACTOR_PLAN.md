# REFACTOR_PLAN.md — the canonical, resumable refactor + bug-fix plan

Status: **ACTIVE**. This file is the single source of truth for the refactor.
It supersedes the narrative in [REFACTOR_HANDOFF.md](REFACTOR_HANDOFF.md)
(keep that file — it is the architecture rationale; this file is the work
order).

## Agent protocol — read this first, follow it exactly

1. Find the first step whose checkbox is `[ ]` (top to bottom). Steps inside a
   phase are ordered; phases are ordered. Do not skip ahead unless a step is
   marked `BLOCKED` with a reason.
2. Do exactly that step. Each step is sized for a fraction of one session and
   states its own verification. Do not batch several steps into one commit.
3. Verify with the step's listed checks, plus always:
   `npm run typecheck --workspace @sequences/slack` and the focused tests the
   step names.
4. Commit with the step id in the message, e.g.
   `refactor(slack): S2.3 branded viewer-time in pacing audit`.
5. **Update this file in the same commit**: tick the checkbox, and append one
   entry to the Step Journal at the bottom (step id, date, what changed, files
   touched, verification run, anything the next agent must know, deviations).
   If you discovered new work, add it as a new step in the right phase —
   never do it silently.
6. If you run out of budget mid-step: do NOT tick the box. Append a Journal
   entry marked `PARTIAL` describing exactly where you stopped and what state
   the tree is in.
7. Paid probes only where a step says so; every probe result goes to
   [PROBE_LOG.md](PROBE_LOG.md) AND a one-line pointer in the Step Journal.
8. Behavior-preserving first: any step that moves code must leave exact
   replays byte-identical unless the step explicitly says it changes output.

Read [SENTINEL.md](SENTINEL.md) before any step that touches gates, retries,
normalizers, or fallback. Read the "Golden demo — what good means" section
before any motion step.

## Why (evidence, 2026-07-11)

Aggregate over 157 recorded runs (`npm run sentinel:report`):

| Metric | Target | Observed |
| --- | --- | --- |
| Storyboard attempts / run | ≤ 1.5 | 2.43 |
| Source attempts / run | ≤ 1.5 | 2.89 |
| Wall-clock to tier-1 | ≤ 8 min | 14.9 min |
| Author prompt size | ≤ 45k chars | up to 137k |
| Physical requests / clean run | ≤ 5 | 10.2 |
| Dispositions | published | 34 published / 102 published-degraded / 21 fail-loud |
| L2 normalizations | small | 7,359 (interaction-binding 1,749 · layout-intent 1,185 · slot-script-envelope 593 · plugin-inject 487 · world-layout-derive 457) |
| Hedge duplicates | rare | 236 |

The engine is ~63.6k lines of src + ~35.7k of tests for a product whose golden
film is 618 hand-written lines. The refactor's purpose is not smaller code —
it is: **one attempt, one owner per fact, honest status, and directed motion.**

Hotspots (lines): layoutInspector 5,775 · runner/repairs 5,580 · runner/ladder
4,505 · componentContract 2,400 · pluginContract 2,359 · runner/storyboardAudit
2,309 · sentinel 1,895 · pacingAudit 1,717 · directComposition 1,688 ·
cameraContract 1,512.

Probe evidence: SignalDock (`architecture-stress-5-20260711`) and this
session's probes (see "Live probe findings" below and PROBE_LOG.md).

## Golden demo — what "good" means

Source: `demos/slack-ad` (618 lines total; render output
`demo-output/slack-ad-luna`). Analyze it before motion work; these are the
mechanics that make it good, stated as *measurable properties*, not taste:

1. **One dominant idea per act.** 7 acts / 28s. Every act has exactly one
   subject; everything else is subordinate. SignalDock had 14 camera phrases
   over 4 scenes — paperwork, not ideas.
2. **The field is calm; content is the frame.** White field; the wallpaper
   exists only inside the two desktop scenes and sits *behind* a real UI
   window that owns ≥60% of frame attention. Probe films invert this: loud
   full-frame wallpaper, floating translucent content.
3. **Measured geometry, no guessed coordinates.** Every landing (camera math
   `camAt`, mark dock slot, cursor press point) is computed from
   `getBoundingClientRect()` at identity transforms before any tween exists.
4. **Anticipation → action → settle → readable hold** on every gesture, with
   explicit hold windows in the timing (e.g. zoomed read hold 15.87–16.30
   before the pull-back; reaction pops only on a settled frame).
5. **One energy peak** (the 2.3× superzoom dive+pan, 14.3–16.3s). Everything
   else is connective or ambient. Ambient motion lives on wallpaper/cards/
   light — never on copy being read.
6. **Cause and effect chain.** Clutter → collapses into the mark → mark is
   clicked → product flow → proof → lockup. Each transition is motivated by
   the previous shot's action.
7. **State never resets.** The typed text, the created channel, the message
   thread persist across camera moves. (Probe films reset metrics to 0% at
   every shot boundary.)
8. **Repeated transition grammar.** A small set of moves reused; not a zoo.
9. **Ends early, breathes.** Lockup lands ~24s; last 4s is a near-invisible
   1.4% scale breath. No motion after the resolve.
10. **Typewriters are physical** — width-reveal so the caret rides the edge;
    counts/carets are stepped, not eased opacity.

Translate these into constraints and host-owned mechanisms (Phases 4 & 8) —
never into more prompt adjectives.

## Live probe findings (this session, 2026-07-11)

> Keep this section updated as probes run. Full detail in PROBE_LOG.md.

- `refactor-review-normal-1-20260711` (Briefly, calm production-shaped brief,
  16s, fallback disabled): **published-degraded**, 24.0 min, 8 QA warnings.
  Full entry in PROBE_LOG.md. What it proves, step by step:
  - Storyboard: 1 logical / 3 physical streams + 2 hedges (provider
    timeouts) → S1.1 ledger; a single >18-min mega-call dominates tier-1
    latency.
  - ~11 sentinel normalizations rewrote plan timing, including collapsing
    the authored 2.2s/3.2s staggered arrivals to 0.28s — a normalizer erased
    the intended one-by-one storytelling → S5.3 (registry with declared
    write-sets) and the Phase 3/8 principle that hosts must not "direct by
    committee".
  - Author attempts 1→2 repeated the SAME three GSAP-null-target warnings
    (NodeList/empty/null dataflow forms) → S5.4; repair prompts hit
    107k/110k chars → S6.1; attempt 3 changed the locked scene count and was
    atomically rejected; attempt 2 early-shipped as "browser-valid" with
    open quality findings → S1.3.
  - Film: small windows adrift on a loud wallpaper (`camera_framed_sparse`
    6–10% painted, `composition_washed_out`), low-contrast row text,
    mid-word headline wrap ("th / e loop"), story-mismatched seeded plugin
    copy, 1.2s empty opening → S8.1 and a new step S8.6 below.
- SignalDock (`architecture-stress-5-20260711`, previous session) agrees on
  every class from the stress side; see PROBE_LOG.md.

## Staffing guide — which agent runs which steps

Two tiers: **HEAVY** (most capable/expensive model, high reasoning — for
coupled architecture, subtle byte-stability, and anything that judges motion
from rendered frames) and **LIGHT** (cheaper model — for mechanical,
test-verifiable work). When a phase mixes tiers, the HEAVY agent should do
the first step and leave crisp notes so a LIGHT agent can finish.

| Steps | Tier | Why |
| --- | --- | --- |
| S0.1 triage tool, S0.2 replay:all, S0.4 census | LIGHT | Read JSON/format reports; verified against recorded runs. |
| S0.3 dead file | LIGHT | Trivial, test-verified. |
| SP.1–SP.5 purge | LIGHT | Wide but mechanical; strong verification (root tests + slack fast loop + demo). Follow the steps literally; delete nothing outside the listed paths. |
| S1.1 attempt ledger | HEAVY | Must understand 4.5k-line ladder and reproduce counters exactly. |
| S1.2–S1.3 status derivation | LIGHT→HEAVY review | Mechanical once S1.1 exists; the rename semantics (S1.3) need HEAVY sign-off. |
| S2.1 time types | LIGHT | Well-specified, property-tested, pure. |
| S2.2 cascade retime | HEAVY | Byte-stable replays across pacing/ramp normalizers — subtle. |
| S2.3 audit migration | LIGHT | Mechanical after S2.2, grep-verifiable. |
| S3.1–S3.4 camera phrase | HEAVY | The hardest coupling in the codebase (blocking/runtime/QA unification). Keep one agent across all four steps if possible. |
| S4.1–S4.2 state handoff | HEAVY | Browser seek semantics + continuity graph. |
| S5.1–S5.2 megafile splits | LIGHT | Large but mechanical moves; byte-identical replay is the referee. |
| S5.3 normalizer deps | HEAVY | Declaring read/write sets and ordering needs real judgment. |
| S5.4 dead-dataflow check | LIGHT | Bounded, fixture-driven. |
| S6.1 prompt diet | HEAVY | Judging which prose is redundant vs load-bearing. |
| S6.2 basis gate | LIGHT | Small typed check + fixture. |
| S6.3 studio capsule | LIGHT build + HEAVY probe read | Counters are mechanical; the conversion judgment isn't. |
| S7.1–S7.3 flags/dead exports/compat | LIGHT | Evidence-driven deletion with full-suite verification. |
| S8.1–S8.5 motion gates | HEAVY | This is taste-to-measurement translation from the golden demo; requires reading rendered frames. |
| S9.1 probe:run tool | LIGHT | Wraps existing scripts. |
| S9.2 playbook doc | LIGHT | Documentation. |
| S9.3 acceptance probes | HEAVY | Paid probes + motion judgment; also every "one live probe" tail in Phase 8. |

Rules of thumb: anything whose verification is "exact replay byte-identical +
tests" can go LIGHT; anything that changes what ships visually, touches the
ladder/camera coupling, or interprets rendered evidence goes HEAVY. A LIGHT
agent that finds itself making a judgment call must stop, journal `BLOCKED`,
and leave it for a HEAVY agent — that is cheaper than a wrong guess.

## Live-probe checkpoints — when reality gets a vote

A live probe is the only proof the architecture works end-to-end; replays and
tests only prove we didn't change behavior. But probes cost real money and
20–40 minutes, so they run at **fixed checkpoints**, not per step. Every probe
needs explicit owner authorization, uses a cache-distinct brief + job id with
fallback disabled, and ends with `probe:triage` + a PROBE_LOG.md entry + a
Step Journal pointer. The fix-first policy always applies: a repeated
mechanical class blocks further probes until it is fixed and replayed.

| Checkpoint | When | What it must prove |
| --- | --- | --- |
| **LP-0 baseline** | DONE (SignalDock + `refactor-review-normal-1`) | The defect classes this plan targets. Compare every later probe's triage against these two. |
| **(no probes)** | Phases 0, P, 1, 2, 5, 7 | Behavior-preserving phases. The referee is `replay:all` + suites + the golden render. If a step here changes replay output unexpectedly, STOP and fix — do not "check with a probe". |
| **LP-1 camera** | After S3.4 (Phase 3 complete) | One stress-shaped probe (SignalDock-style brief). Triage vs LP-0: phrase count collapsed (≤1 primary route/scene), landings readable/in-range, occupancy in range, no new QA class. |
| **LP-2 state** | After S4.2 (Phase 4 complete) | One metric-continuity brief (value develops across ≥3 scenes). No reset flicker, morphs honest, reverse-seek clean. May combine with LP-1 into one probe if Phases 3+4 land together. |
| **LP-3 prompt diet** | After S6.1 (and S6.3's capsule probe folds in here) | One normal probe. Prompt changes alter MODEL behavior — replays prove nothing here. Watch: attempts, parse failures, findings-retry classes vs LP-0; acceptance quality must not drop. |
| **LP-4 per motion gate** | Tail of each S8.x that says so | One probe each: the new gate fires on real output without false-positives on the golden film. |
| **LP-5 acceptance** | S9.3 | One clean stress probe (1 logical storyboard + 1 logical source, no fallback/degradation) + one clean normal probe. This is the definition of done. |

Budget expectation: ~6–8 paid probes for the whole refactor outside Phase 8,
plus one per Phase 8 gate. If a checkpoint probe fails on a *mechanical*
class, the fix + replay is free — rerun the checkpoint only after replay:all
is green again, and count both runs honestly in PROBE_LOG.md.

---

# Phase 0 — Tooling and safety net (do this before any code moves)

### S0.1 `probe:triage` — one command that reads a job and says what happened
- [x] Add `scripts/probeTriage.ts` + npm script `probe:triage -- <jobId>`.
  Reads `planning/sentinel-run.json`, `planning/author-run.json`,
  `build/qa/sequence-check.json`, `planning/attempts/*` and prints ONE
  markdown triage: disposition; logical/physical calls per stage; every
  degradation + fallback with its stage and reason; every QA finding class
  with count and whether it is **new** (not in the registry's incident list)
  or **known**; and absolute paths to the evidence to open (MP4, temporal
  strip, blocking overlay, per-moment thumbs, rejected artifacts). End with
  the SENTINEL placement reminder: replay first, fix the lowest owner, add a
  regression, log in PROBE_LOG.md. Also emit `triage.json` next to the report
  for programmatic consumption.
- Verify: run it against `architecture-stress-5-20260711` and this session's
  probe; output matches PROBE_LOG.md's recorded numbers.
- This tool is the backbone of the continuous probe loop (Phase 9); build it
  first so every later step's probes are cheap to read.

### S0.2 Freeze behavior fixtures
- [x] Ensure exact rejected artifacts for LaunchRelay, PulseForge, GatePilot,
  RelayGuard, SignalDock (+ this session's probes) replay green via
  `npm run storyboard:replay` / the strict source replay path, and wire them
  into a single `npm run replay:all` script that exits nonzero on any drift.
  Do not copy artifacts into the repo if size forbids; reference
  `.data/projects/<job>/planning/attempts/` and skip-with-warning when a
  fixture is missing locally.
- Verify: `npm run replay:all` green at HEAD.

### S0.3 Delete dead code: `planRunner.ts`
- [x] `src/engine/planRunner.ts` has zero importers (the demo Plan path uses
  `@sequences/core` `planToCommands` directly from `orchestrator.ts` /
  `engine/mcp.ts`). Delete the file and any orphaned tests.
- Verify: typecheck + `npm run test:unit` + `npm run demo` (model-free).

### S0.4 Unused-export census (mechanical, no deletions yet)
- [x] Add `scripts/deadExports.ts` (or wire `ts-prune`) listing exports with
  zero external references across src/studio/scripts/test. Commit the report
  to `.reports/dead-exports.md`. Mark candidates; actual deletions happen in
  S7.x after the moves settle.
- Verify: script runs clean; report committed.

### S0.5 Fix stale doc pointers (workspace-level)
- [x] Root `CLAUDE.md` and the orientation skill referenced deleted docs
  (ARCHITECTURE.md, ROADMAP.md, FALLBACKS.md, ASSETS.md, …) and a pre-runner
  file layout. DONE 2026-07-11: `.claude/skills/slack-map` was replaced by
  `.claude/skills/sequences` (current doc set + runner layout), `forge-map`
  deleted, root `CLAUDE.md` rewritten to the Slack-only reality. If layout
  changes again, update the skill in the same commit.
- Verify: `grep -rn "ROADMAP.md\|FALLBACKS.md\|slack-map" CLAUDE.md
  .claude/skills/` returns nothing.

---

# Phase P — Monorepo purge: this repo is now just Slack Sequences

Owner decision (2026-07-11): Forge and the old Sequences studio are
**deprecated, not paused**. Delete everything that is not Slack Sequences or
one of its real dependencies. `apps/slack` depends on `@sequences/core`,
`@sequences/platform` (workspace packages — KEEP) and `@hyperframes/*@0.6.86`
from the npm registry (no vendored path — verified). Golden rule for every
step: delete, then prove the Slack surface still works
(`npm run typecheck --workspace @sequences/slack`, `npm run test:unit
--workspace @sequences/slack`, `npm run demo --workspace @sequences/slack`,
plus root `npm test` and root `npm run typecheck` for the kept packages).

### SP.1 Delete the retired apps
- [x] `git rm -r apps/forge apps/sequences examples/forge examples/sequences
  fixtures/sequences`. Root `package.json`: remove the `bin` entry
  (`apps/sequences/src/cli.ts`), the `sequences*`, `forge`,
  `compile:example`, `render:example`, `test:perf`, `test:forge-ui`,
  `test:golden` scripts, and fix `test:ci`. Delete
  `scripts/forge-ui-smoke.mjs`, `scripts/golden-renders.mjs`,
  `scripts/perf-budget.mjs`, `scripts/ui-smoke*.mjs`. Check
  `vitest.config.ts` and root `tsconfig.json` include/exclude lists still
  resolve (they glob `apps/*`; nothing should break, but run the suites).
  Known bonus: the pre-existing failing forge knowledge-retrieval test
  disappears with the app.
- Verify: root `npm test` green (packages only), root `npm run typecheck`
  green, slack fast loop green, `npm run demo --workspace @sequences/slack`.

### SP.2 Delete retired docs; keep Slack history
- [x] Delete `docs/paused/`. Move `docs/RECIPE_STUDIO_PLAN.md`,
  `docs/RECIPE_STUDIO_HANDOFF.md`, `docs/DETERMINISTIC_LAYOUT_REPAIR_PLAN.md`
  into `apps/slack/docs/history/` (they document the Slack studio). Delete
  the now-empty root `docs/`. Sweep root `AGENTS.md` for retired content.
  Also sweep `.claude/skills/`: `bug-hunt` and `verify` still describe
  Forge-first workflows — rewrite them Slack-first (or delete `bug-hunt` if
  redundant with SENTINEL discipline) and remove `/forge-map` mentions.
- Verify: `grep -rn "docs/paused\|forge" CLAUDE.md AGENTS.md .claude
  --include="*.md"` returns nothing load-bearing.

### SP.3 Delete `references/` vendored snapshots
- [x] `references/upstream` + `references/agent-sources` were Forge-era
  vendored HyperFrames sources. Confirm zero non-test consumers outside the
  deleted trees (`grep -rn "references/" packages apps/slack scripts
  Dockerfile railway.json --include-dir excludes node_modules`), then delete
  `references/`. If anything in `packages/*` genuinely reads it, move that
  fixture into the package and note it in the Journal.
- Verify: root `npm test` + slack fast loop; `npm run demo`.

### SP.4 Trim `evals/` (keep what packages tests consume)
- [x] `packages/core/test/agent-evals.test.ts` reads `evals/`. Keep the
  consumed files; delete the rest, or relocate under
  `packages/core/test/fixtures/` and update the test import if you prefer a
  clean root. Do not delete blindly.
- Verify: root `npm test` green.

### SP.5 Publish/deploy surfaces unaffected
- [x] Re-read `scripts/publish-public.sh` and the root `Dockerfile`: they
  must reference only `apps/slack`, `packages/core`, `packages/platform`.
  Remove any copy/step referencing deleted trees. Then run the model-free
  gate: `npm run mcp:demo --workspace @sequences/slack` and
  `npm run sequence:check --workspace @sequences/slack -- --demo --no-mcp
  --format both`.
- Verify: gates green; `git status` clean; commit. Do NOT publish or deploy
  without explicit owner authorization.

---

# Phase 1 — Attempt ledger and honest publication semantics

Goal (handoff §7): one immutable ledger; derive CLI/Slack/JSON status from it;
stop calling quality-degraded drafts "browser-valid".

### S1.1 Extract `AttemptLedger`
- [x] New `src/engine/runner/attemptLedger.ts`: append-only typed events
  (logical attempt start/end per stage, physical request, hedge launch/win,
  timeout, scene-repair call, critic call, degradation, fallback) with one
  writer. Ladder emits events; nothing else keeps counts. Keep the existing
  sentinel-run.json shape as a *derived view* so telemetry/tests don't break.
- Verify: unit test that replays a recorded run's events and reproduces the
  exact sentinel-run.json counters; `npm run replay:all`.

### S1.2 Derive all status from the ledger
- [x] `sequenceCheckStatus.ts`, Slack receipts, and sentinel telemetry read
  the ledger. Delete per-site counters. `probe:triage` switches to the ledger.
- Verify: run `sequence:check --demo`; JSON identical except additive fields.

### S1.3 Rename quality axes honestly
- [x] Split the internal "browser-valid" notion into `runtimeValid` (binds,
  seeks, finite) and `qualityResidue` (blocking-quality findings that remain).
  `published-degraded` must list which axis degraded. One-attempt success =
  no model repair + no proof-film + no material degradation + no repeated QA
  class (make this a computed ledger predicate, used by probe:triage).
- Verify: SignalDock replay reports `runtimeValid: true, qualityResidue: 8`.

---

# Phase 2 — One time domain

Goal (handoff §3): branded `SourceTime` / `ViewerTime` / `Duration` /
`SceneLocalTime`; one ramp-aware conversion service; one cascade transform.

### S2.1 Introduce branded time types + conversion service
- [x] New `src/engine/time.ts` with branded types, constructors, arithmetic,
  and ramp-aware `toViewer`/`toSource`. Property tests: monotonicity, boundary
  identity, round-trip, cascade preservation.
- Verify: new unit tests green; no call-site changes yet.

### S2.2 One cascade transform for scene stretching
- [x] Implement `cascadeRetime(plan, sceneId, delta)` returning a mapping
  applied to scenes, moments, beats, camera segments, interactions, grades,
  cuts, and evidence in ONE operation. Migrate the pacing stretch + marginal
  approach trim (`pacing-stretch`, `interaction-hold-retime`,
  `timeramp-retime` normalizers) onto it.
- Verify: 82 pacing tests + RelayGuard/PulseForge exact replays byte-stable.

### S2.3 Migrate audits off ad-hoc arithmetic
- [x] `pacingAudit.ts`, interaction audit, and motionDensity read through the
  time service only (grep-clean: no raw ramp math outside `time.ts`).
- Verify: full unit suite; replay:all.

---

# Phase 3 — One camera semantic model

Goal (handoff §4): single `CameraPhrase` consumed by blocking, runtime, and QA;
collapse zero-distance/same-target phrases; budget visual ideas.

### S3.1 Define `CameraPhrase` and compile into it
- [x] New `src/engine/cameraPhrase.ts` (target, contextual framing target,
  source/arrival pose, travel/settle/dwell/departure intervals, importance,
  evidence owner, occupancy contract, route ownership authored|continuity|
  host-derived). Compile authored paths AND continuity/blocking requests into
  phrases once, before runtime injection.
- Verify: camera browser tests; golden `film:demo` render unchanged.

### S3.2 Collapse degenerate phrases before runtime
- [x] Same-target/zero-distance/sub-threshold phrases merge or drop
  deterministically (L2, atomic, telemetry tag `camera-phrase-collapse`).
  SignalDock's 14 phrases / 4 scenes must collapse to ≤ 7.
- Verify: SignalDock storyboard replay shows the collapsed count; no QA
  regression on exact replays.

### S3.3 QA consumes phrases, not re-derived geometry
- [x] layoutInspector's camera-arrival/occupancy checks and eyeTrace read the
  same compiled phrases and tolerances the runtime executes (kill the
  QA/runtime occupancy mismatch class from GatePilot).
- Verify: targeted browser tests + one exact-artifact replay per seed fixture.

### S3.4 Idea budget, not phrase budget
- [ ] Replace raw per-scene move-count budgeting with: ≤1 primary route per
  scene + supporting development that cannot create a new lens route
  (handoff: "supporting evidence may develop the frame"). Plan-time gate
  message must say which idea to cut, not which number was exceeded.
- Verify: pacing/camera unit tests updated; a SignalDock-shaped fixture that
  previously passed with 14 phrases now yields a findings-retry with an
  actionable message.
- **Checkpoint LP-1:** Phase 3 is complete only after the LP-1 live probe
  (see "Live-probe checkpoints") passes triage comparison vs LP-0. If Phase 4
  is starting immediately, you may defer to a combined LP-1+LP-2 probe after
  S4.2 — journal the deferral.

---

# Phase 4 — State continuity (kills the 0% reset class)

Goal (handoff §5): a stable `entityId` optionally carries a typed state
handoff; morphs ship only with proven structure + state transfer.

### S4.1 Typed state handoff on continuity entities
- [ ] Extend the continuity graph entity with `state?: { kind: metric|button|
  progress|selection|shell; value }`. The scaffold initializes the incoming
  scene's component from the prior resolved state (host-owned, L1). Metrics
  must begin at the previous value — never 0.
- Verify: new browser test: two-scene metric 38→71→94 with a swipe cut never
  paints a lower value than already resolved; SignalDock replay loses its
  reset flicker.

### S4.2 Morph honesty gate
- [ ] A `morph` cut requires both endpoint structure AND state transfer
  proof; otherwise degrade to swipe/match AND initialize the incoming
  component from the handoff (extend the existing degrade path).
- Verify: GatePilot's impossible cross-kind morph fixture degrades cleanly;
  reverse seek restores both endpoint state and visibility (browser test).
- **Checkpoint LP-2:** Phase 4 is complete only after the LP-2 live probe
  (metric-continuity brief) shows no reset flicker and honest morphs on real
  output. Combine with a deferred LP-1 if applicable.

---

# Phase 5 — Split the two megafiles by responsibility

Goal (handoff §6). Mechanical moves, no behavior change; keep import facades.

### S5.1 layoutInspector: measurement vs policy
- [ ] Split into `layout/collect.ts` (browser evidence collectors),
  `layout/selectors.ts`, `layout/checks/*.ts` (pure: evidence → typed
  findings), `layout/score.ts`, `layout/report.ts`. `layoutInspector.ts`
  becomes a facade re-exporting the public surface.
- Verify: browser suite + QA cache hash unchanged on a cached project.

### S5.2 repairs: split by domain
- [ ] Split `runner/repairs.ts` into `repairs/htmlChassis.ts`,
  `repairs/cssSafety.ts`, `repairs/selectorDataflow.ts`,
  `repairs/timelineNormalize.ts`, `repairs/contractIslands.ts`,
  `repairs/boundedLayout.ts`. Each repair returns edits + proof (intended
  finding changed, no new class) — enforce with a shared wrapper.
- Verify: replay:all byte-identical; unit suite.

### S5.3 Normalizer registry gets real dependencies
- [ ] Extend `runner/normalizerRegistry.ts` entries with read/write fields,
  pre/postconditions, ordering deps, atomic group, and idempotence test ref.
  Add a test that builds the dependency graph and fails on write/write
  conflicts without declared order. Run the full audit once per atomic group
  (kill scattered stale partial audits).
- Verify: registry test green; replay:all.

### S5.4 Shallow dead-dataflow check for GSAP targets
- [ ] Extend `deadTweenRepair.ts`/static gate: flag `querySelector` results
  containing pseudo-elements and provably-absent literal selectors *through
  one variable assignment* (the SignalDock `.cmp-value::after` → null → GSAP
  class). No general JS rewriter; AST-lite only.
- Verify: minimized SignalDock fixture caught at L3, not browser.

---

# Phase 6 — Prompt diet and the studio→planner seam

Do this only after Phases 1–5 (handoff: don't optimize prompts before
eliminating contradictory contracts).

### S6.1 Prompt payload audit + budget enforcement
- [ ] Measure actual composed prompt sizes per stage (ledger already knows).
  Reinstate a hard budget test (author ≤45k chars; the 125–137k repair
  prompts are the target). Remove now-redundant prose that restates typed
  contracts (the contracts are injected; the prose was compensating).
- Verify: budget test green; one exact storyboard replay + one authored
  replay unchanged in acceptance.
- **Checkpoint LP-3:** prompt changes alter model behavior, so replays are
  NOT sufficient proof for this step — Phase 6 is complete only after the
  LP-3 live probe (see "Live-probe checkpoints") shows attempts and
  findings-retry classes at or below the LP-0 baseline. S6.3's capsule
  conversion check rides the same probe.

### S6.2 Frame/storyboard basis contradiction gate
- [ ] L0/L3: storyboard `production basis` (dark/light) must match frame.md's
  committed basis; mismatch is a cheap findings-retry before any authoring
  (SignalDock shipped dark-plan-on-light-frame).
- Verify: fixture from SignalDock's storyboard rejects at plan time with an
  actionable message.

### S6.3 Studio library capsule: offer only what converts
- [ ] `studioLibraryVocabulary()` currently advertises five catalogs on every
  run while conversion is near-zero for some (recipe-auto-declare: 3 in 157
  runs). Add per-catalog conversion counters to the ledger; keep offering
  only entries with a typed declaration path that has ever converted, and
  host-auto-declare recipes/assets where the brief matches (extend the
  existing `recipe-auto-declare` L2) instead of asking the planner to opt in.
- Verify: unit tests for the capsule; the LP-3 checkpoint probe shows the
  declared unit actually appearing in the plan.

---

# Phase 7 — Retire old systems and shrink the flag surface

### S7.1 Feature-flag audit
- [ ] For each of the 25 feature flags: when was it last set to non-default in
  any recorded run (`sentinel-run.json` env snapshots)? Classify: (a) load-
  bearing kill switch → keep; (b) experiment that won → collapse to always-on,
  delete flag + dead branch; (c) experiment that lost / never converted →
  delete feature behind it or park behind explicit `EXPERIMENTAL_` prefix.
  Every deletion is its own commit with replay:all green.
- Verify: featureFlags registry + source-scan test; OPERATIONS.md updated.

### S7.2 Dead-export deletions
- [ ] Execute the S0.4 census: delete confirmed-dead exports/files (candidates
  observed: parts of `cameraPatterns.ts`, `designDialects.ts`,
  `backgroundCatalog.ts`, `hyperframesCompatibility.ts`, `cutDiscovery.ts`,
  `directionScore.ts` — verify each; several are only reachable via the
  studio capsule string).
- Verify: typecheck, full unit+browser suites, `npm run demo`,
  `npm run studio:golden` (studio must still gate/export).

### S7.3 Legacy vocabulary compatibility sunset
- [ ] Legacy cut names (`cut-*`, `zoom-through`, `shape-match`, …) and other
  parse-time aliases: keep the normalizers (cheap, tested) but move them to
  one `compat.ts` with a table + one test file, so new code never imports
  scattered alias logic.
- Verify: old-plan replay still byte-identical.

---

# Phase 8 — Motion quality: encode the golden demo as gates and scaffolds

Each step here changes OUTPUT, so each ends with one authorized live probe
via the Phase 9 loop. Do not start Phase 8 before Phases 3–4 land: most of
these gates need CameraPhrase + state handoffs to be enforceable.

### S8.1 Background subordination gate
- [ ] Browser check: outside declared hero/lockup scenes, the environment
  layer (wallpaper/gradient) may not exceed a saturation×area share of the
  frame at any sampled landing; primary-subject contrast against its real
  composited background meets a floor (the translucent 40%/52% numerals must
  become findings). Prefer an L1 fix too: scaffold defaults the content
  surface (window/card) to own ≥60% of the frame at landings, wallpaper
  darkened/blurred under content.
- Verify: SignalDock replay flags it; golden film:demo does NOT flag.

### S8.2 One energy peak per film
- [ ] Plan-time: exactly one scene may carry the high-energy accent (dive/
  whip/ramp); others are connective. Extend `auditCameraEnergy` from
  repeat-verb heuristics to a single-peak contract with an actionable
  message ("move the accent to the approval payoff or drop it").
- Verify: unit tests; seed-fixture replays stay green (they already resemble
  single-peak films or get the actionable retry).

### S8.3 Cause-and-effect chain check
- [ ] Plan-time advisory → later blocking: each scene's entry must be
  motivated by the previous scene's exit action (cut carries the acted-on
  entity, or an explicit `handoff` field names the causal object). This is
  paperwork the planner already half-writes; make it typed and validated
  instead of prose.
- Verify: unit tests on seed storyboards.

### S8.4 Read-hold and settle enforcement at the gesture level
- [ ] The pacing audit holds copy; extend the same discipline to gestures:
  after any press/entrance, the affected surface must be settle-stable (no
  transform above threshold) for ≥0.35s before the next voice starts; cursor
  gets ONE approach path (kill the two-step corrective cursor class — host
  should compute the approach from measured geometry like the golden demo's
  `camAt`).
- Verify: browser test with a two-correction cursor fixture; SignalDock
  replay's five-simultaneous-voices window produces findings.

### S8.6 Typography and copy floor (from probe `refactor-review-normal-1`)
- [ ] Three cheap, host-ownable defects shipped in the Briefly film:
  (a) the final headline wrapped mid-word ("Keep everyone in th / e loop") —
  add an L2/L3 check that display-size text never soft-wraps inside a word
  and never wraps a phrase shorter than ~24ch onto an orphan line (fix:
  `text-wrap: balance` + width from measured text, golden-demo style);
  (b) seeded plugin copy mismatched the story domain ("Meeting recapped —
  Leo Diaz" inside a weekly-update publish beat) — `seedContent.ts` must
  derive copy from the brief's domain vocabulary or the plan's own labels,
  never from an unrelated generic pool;
  (c) the opening scene showed an empty card for ~1.2s — extend the
  entrance-liveness rule to require the first painted content within ~0.5s
  of scene 1 without destroying authored stagger (see S5.3's write-set fix:
  the current normalizer collapsed 2.2s/3.2s arrivals to 0.28s, which is the
  opposite failure).
- Verify: fixtures from the Briefly artifacts; replay converges without a
  model call. (Numbered S8.6 but placed before S8.5 deliberately: these are
  cheap fixture-driven fixes — LIGHT tier — do them first inside Phase 8.)

### S8.5 Ending discipline
- [ ] Final scene: resolve by ~85% of runtime, then a breath hold with only
  micro-motion (≤1.5% scale). Host-derive the hold from the plan instead of
  trusting the author's last-scene choreography.
- Verify: unit + one live probe; golden demo pattern unaffected.

---

# Phase 9 — The continuous probe loop (the product of this refactor)

The owner's target workflow: an agent runs
**live probe → triage → fix fallbacks/attempts at the lowest layer → check
motion design → probe again**. Everything it needs must be one command away.

### S9.1 `probe:run` — one command, one fresh probe
- [ ] `scripts/probeRun.ts` + npm script: generates a cache-distinct brief
  (rotating product-name/domain templates with golden-demo-derived direction
  language, or `--input <file>`), a unique job id, sets the probe env
  (fallback OFF, continuity ON, composition audit), runs sequence:check with
  `--mcp --render --temporal`, then immediately runs `probe:triage` on the
  result and appends a skeleton entry to PROBE_LOG.md.
- Verify: dry-run mode (`--plan-only` prints the command without paying).

### S9.2 Probe-loop playbook in OPERATIONS.md
- [ ] Write the decision tree the agent follows, referencing tools not prose:
  1. `npm run probe:run` (authorized, paid).
  2. Read triage. Any fallback/degradation/attempt>1 with a mechanical cause?
     → replay the exact artifact (`storyboard:replay` / source replay), fix at
     the lowest SENTINEL layer, add regression, `replay:all`, log.
  3. Motion pass: open the MP4, temporal strip, blocking overlay, per-moment
     thumbs (triage lists paths). Check against the Golden-demo checklist
     (one idea/scene, background subordination, no reset, readable landings,
     one peak, ending breath). File real defects as Phase 8-style gates or
     fixtures — the agent must KNOW where a fix goes: use SENTINEL.md's
     placement tree; creative-taste-only issues go to the prompt, everything
     mechanical goes L1–L3.
  4. Repeat until one clean probe (ledger predicate from S1.3), then one calm
     production-shaped probe.
- Verify: doc exists; a fresh agent can run the loop end-to-end from it.

### S9.3 Acceptance gate for the whole refactor
- [ ] One stress probe: 1 logical storyboard + 1 logical source attempt, no
  fallback, no material degradation, primary landings readable/in-range.
  One normal probe: no real layout/motion defects on inspection. MP4 shows
  one clear subject, motivated motion, settled payoffs, confident final hold.
  Then: update CLAUDE.md + OPERATIONS.md + SENTINEL.md to the post-refactor
  reality, mark this plan COMPLETE, and record final metrics
  (`sentinel:report`) next to the "Why" table above.

---

# Documentation debt (fold into the phases; listed for visibility)

- Root `CLAUDE.md` + orientation skill: fixed 2026-07-11 (S0.5 — skill is now
  `.claude/skills/sequences`); keep it updated when layout changes.
- `SENTINEL.md`: good; add the L2-churn principle from S5.3 when it lands.
- `OPERATIONS.md`: add probe:run/probe:triage (S9.2); refresh flag list after
  S7.1.
- `PROBE_LOG.md`: keep as the concise ledger; probe:run appends skeletons.
- `REFACTOR_HANDOFF.md`: mark superseded-by-this-plan in its header (keep the
  analysis).
- apps/slack/docs/history/: leave as history.

# Explicitly out of scope (do not drift)

- New Studio components, assets, recipes, plugins, backgrounds, or camera
  patterns (unless a concrete integration bug blocks the existing path).
- Loosening any gate to make numbers look better.
- Prompt rewrites before Phase 6's precondition is met.
- Modifying `packages/core` / `packages/platform` beyond what SP.x requires
  (they are Slack's dependencies; treat as stable).
- The "High quality" Claude-CLI-on-Railway tier — separate track, not part of
  this refactor plan.

---

# Step Journal

> Append entries here after every step. Newest at the bottom. Format:
> `## <step id> — <date> — <status: DONE|PARTIAL|BLOCKED>` then what changed,
> files, verification run, and notes for the next agent.

## S-init — 2026-07-11 — DONE
Plan authored from: REFACTOR_HANDOFF.md, PROBE_LOG.md, sentinel:report over
157 runs, golden-demo source analysis (`demos/slack-ad`), SignalDock artifact
review, dead-code census (planRunner.ts), doc-drift scan, and live probe
`refactor-review-normal-1-20260711` (published-degraded; see PROBE_LOG.md).
Also done in the authoring session (not steps, already applied):
- `.claude/skills/slack-map` + `forge-map` deleted; replaced by
  `.claude/skills/sequences` (current layout + doc set).
- Root `CLAUDE.md` rewritten to Slack-only reality; `apps/slack/CLAUDE.md`
  doc list + scope line updated (Forge/Sequences: retired, Phase P).
- S0.5 ticked as part of the above.
Owner additions that session: Phase P (monorepo purge), staffing guide
(HEAVY/LIGHT tiers), S8.6 (typography/copy floor from the Briefly probe).
Next agent: start at S0.1.

## S0.1 — 2026-07-11 — DONE
Added `scripts/probeTriage.ts` and the `probe:triage` workspace command. It
reads the persisted Sentinel, author, sequence-check, and attempt artifacts;
reports disposition, per-stage logical/physical call counts, degradations,
fallbacks, registry-known/new QA classes, and absolute evidence paths; and
writes `planning/triage.md` plus `planning/triage.json` beside each probe.
Files: `apps/slack/scripts/probeTriage.ts`, `apps/slack/package.json`, this
plan. Verification: triage for `architecture-stress-5-20260711` reproduced
10 logical / 14 physical calls and 8 QA warnings; triage for
`refactor-review-normal-1-20260711` reproduced 10 / 14 and 8; Slack
typecheck passed. No paid probe was run.

## S0.4 — 2026-07-11 — DONE
Added the mechanical TypeScript AST census at `scripts/deadExports.ts`, its
`dead-exports` command, and the committed report at
`.reports/dead-exports.md`. It scans 243 Slack source/studio/script/test files,
found 1,377 named exports, and marks 314 zero-reference candidates; no
deletions were made. Verification: `npm run dead-exports --workspace
@sequences/slack` and Slack typecheck passed. Namespace imports are treated
conservatively as references; S7.x must confirm candidates before deletion.

## S0.2 — 2026-07-11 — DONE
Added `replay:all` plus the strict model-free `source:replay` path. The replay
manifest references (without copying) the available LaunchRelay, PulseForge,
GatePilot, RelayGuard, SignalDock, and Briefly artifacts under
`.data/projects`; it freezes artifact and deterministic replay hashes, treats
the RelayGuard truncated response as an expected rejection, and skips missing
local fixtures with a warning. Files: `apps/slack/scripts/replayAll.ts`,
`apps/slack/scripts/sourceReplay.ts`, `apps/slack/package.json`, this plan.
Verification: `npm run replay:all --workspace @sequences/slack` passed 13
replays with 0 skips and 0 failures; Slack typecheck passed. No paid probe was
run.

## S0.3 — 2026-07-11 — DONE
Deleted the confirmed-unreferenced `apps/slack/src/engine/planRunner.ts`;
the active demo path already uses `@sequences/core` directly. No orphaned
tests or importers were present. Verification: Slack typecheck, Slack unit
tests, and the model-free Slack demo passed.

## SP.1 — 2026-07-11 — DONE
Deleted the retired `apps/forge`, `apps/sequences`, `examples/forge`,
`examples/sequences`, and `fixtures/sequences` trees plus the listed Forge,
golden-render, performance, and UI-smoke scripts. Removed the retired root
package scripts/bin and updated `test:ci`, CI, the package lock, and the
platform boundary test. The three extension fixtures consumed by the core
test suite moved to `packages/core/test/fixtures/extensions`; the Slack Studio
source test now resolves from its own workspace. Verification: root
typecheck and full root `npm test` passed; the purge-sensitive core/Studio
tests passed 12/12; Slack typecheck, unit suite (75 files / 1,275 tests), and
model-free demo passed. No paid probe was run.

## SP.2 — 2026-07-11 — DONE
Deleted `docs/paused/` and moved the three Slack studio plans into
`apps/slack/docs/history/`. Rewrote the local Slack bug-hunt and verification
guides, updated the workspace orientation and launch config, and removed stale
retired-path guidance from the tracked agent docs. Verification: the required
guidance scan has no `docs/paused` or retired-app references. The updated local
ignored `.claude` files are intentionally not tracked. No paid probe was run.

## SP.3 — 2026-07-11 — DONE
Confirmed there were no root `references/` consumers in packages, Slack source,
scripts, Docker, or Railway configuration outside documentation/skill links;
deleted the vendored `references/` snapshots and README. Verification: the
consumer scan is empty. No runtime code changed and no paid probe was run.

## SP.4 — 2026-07-11 — DONE
Moved the consumed `phase1-briefs.json` fixture to
`packages/core/test/fixtures/phase1-briefs.json`, updated
`agent-evals.test.ts`, and deleted the unused `evals/relay-launch-film.json`.
Verification: the core agent-evals test passed and root typecheck passed. No
paid probe was run.

## SP.5 — 2026-07-11 — DONE
Rechecked the public mirror and container surfaces. `scripts/publish-public.sh`
now archives only `apps/slack`, `packages/core`, and `packages/platform` plus
the required root configuration; its generated docs no longer mention removed
trees. The root Dockerfile copies only those three workspace manifests before
the source layer. Verification: `npm run mcp:demo --workspace
@sequences/slack` and `npm run sequence:check --workspace @sequences/slack --
--demo --no-mcp --format both` passed. The worktree still contains the
pre-existing S-init edits (`CLAUDE.md`, Slack docs/PROBE_LOG) and ignored
`.tmp/`; they were not staged or altered. No publish/deploy or paid probe was
run.

## S1.1 — 2026-07-11 — DONE
Added the append-only `src/engine/runner/attemptLedger.ts` (typed events, one
writer, pure fold) and rewrote `sentinelTelemetry.ts` as a thin context facade
over it: every `recordSentinel*` emitter now appends an event, no counter
state exists anywhere else, and `finalizeSentinelRun` derives the UNCHANGED
`planning/sentinel-run.json` shape via `deriveSentinelRunView` while also
persisting the raw events to `planning/attempt-ledger.json` (for S1.2/S1.3).
The ladder now emits `attempt-start`/`attempt-end` for both logical loops
(storyboard rungs incl. truncation/artifact-grace/rejection outcomes;
source-author full/patch/rescue via a `recordAuthorAttempt` helper at every
former `summary.attempts.push` site, plus a `published` end on ship),
`hedge-win` in `hedgedCompletion`, and `stream-timeout` in the idle watchdog.
The hedge budget (`claimSentinelHedge`) reads launches from the ledger.
Files: `attemptLedger.ts` (new), `sentinelTelemetry.ts`, `ladder.ts`,
`test/attemptLedger.test.ts` (new) + fixtures
`test/fixtures/sentinel-run-{briefly,signaldock}-20260711.json` (byte copies
of the two recorded probes). Verification: the new test reconstructs each
recorded run's events and reproduces the persisted counters EXACTLY (deep
equal minus the write-time `at`; both fold to 10 logical / 14 physical);
existing `sentinelTelemetry.test.ts` passes untouched; Slack typecheck, 1,284
unit tests, `replay:all` (13/0/0), and the model-free demo all green. Notes:
degradation dedupe moved record→view (ledger keeps every emission); the
finalize event stores the caller's disposition and the fold applies the
published→published-degraded honesty downgrade; S1.2 enriches fallback events
with the failed stage and bounded reason. No paid probe was run.

## S1.2–S1.3 — 2026-07-11 — DONE
Moved status ownership to the append-only ledger. Added final
`runtimeValid`/`qualityResidue` evidence, normalized QA-class events, degraded
axis labels, derived stage receipts, and the computed `oneAttemptSuccess`
predicate. `sequence:check`, Slack result receipts, Sentinel persistence, and
`probe:triage` now consume the ledger; legacy artifact fallbacks remain only
for pre-S1.3 projects without `attempt-ledger.json`. Removed orchestrator and
ladder telemetry out-parameter writes; the compatibility fields are ignored.
Renamed the internal banked-draft path from browser-valid to runtime-valid.
Files: `src/engine/runner/attemptLedger.ts`, `sentinelTelemetry.ts`,
`sequenceCheckStatus.ts`, `scripts/sequenceCheck.ts`, `scripts/probeTriage.ts`,
`src/orchestrator.ts`, `src/index.ts`, `src/blocks.ts`, runner ladder/
orchestration/types, focused tests, and this plan.
Verification: Slack typecheck; focused ledger/status/receipt tests; full Slack
unit suite (after correcting the obsolete out-parameter assertion);
`npm run replay:all --workspace @sequences/slack` (13/0/0); and model-free
`sequence:check --demo --no-mcp --format both` plus `probe:triage`, both green.
No paid probe, publish, or deploy. SignalDock status replay asserts
`runtimeValid: true, qualityResidue: 8`.

## S2.1 — 2026-07-11 — DONE
Added `src/engine/time.ts` as the typed boundary for `SourceTime`, `ViewerTime`,
`Duration`, and `SceneLocalTime`, including validated constructors, domain-safe
arithmetic, scene-local conversion, and a ramp-aware conversion service backed
by the existing authoritative time-ramp knot mapping. Added property tests for
monotonicity, ramp-boundary identity, round trips in both domains, and cascade
translation preservation. No call sites changed. Audited S1.2–S1.3 against the
ledger/status consumers and recorded SignalDock assertions; the checked status
derivation remains consistent with the plan (`runtimeValid: true`,
`qualityResidue: 8`, degraded axis `qualityResidue`). Files:
`src/engine/time.ts`, `test/time.test.ts`, this plan. Verification: focused
time/ledger/status/telemetry tests (32/32), Slack typecheck, full Slack unit
suite (76 files / 1,291 tests), and model-free `sequence:check --demo --no-mcp
--format both`, all green. No paid probe, publish, or deploy.

## S2.2 — 2026-07-11 — DONE
Added immutable `cascadeRetime(plan, sceneId, delta)` to the branded time
service. One operation now stretches the selected scene boundary and shifts
all later absolute owners together: scene starts, display type, time ramps,
grade shifts, camera segments, component beats, interactions, moments, and
bound evidence intervals. Cut entry/exit values remain relative by contract;
resolved cut `atSec` is re-derived from the shifted boundary and is covered by
the cascade regression. Migrated all five stretch-producing pacing passes,
including `interaction-hold-retime` and `pacing-stretch`, off their duplicated
cumulative-shift helper; later time-ramp declarations now travel through the
same cascade instead of separate arithmetic. Files: `src/engine/time.ts`,
`src/engine/pacingAudit.ts`, `test/time.test.ts`, this plan. Verification:
Slack typecheck; focused time/pacing/direct-composition/time-ramp tests (288);
all 82 pacing tests; full Slack unit suite (76 files / 1,293 tests); relevant
time-ramp browser test; `replay:all` (13/0/0), including RelayGuard and
PulseForge byte-stable; deterministic `film:demo` render and 100-frame temporal
strip inspected with all four cuts intact and no eligible dead-frame window.
No paid probe, publish, or deploy.

## S2.3 — 2026-07-11 — DONE
Migrated every source-to-viewer conversion consumer onto the branded
`timeConversionService`: pacing and interaction/eye-trace audits, eye-trace
repair, motion density, storyboard moments and normalization, direct capture,
layout sampling, and temporal inspection. Low-level `warpOf`/`warpInverseOf`
usage is now grep-clean outside the numerical kernel in `timeRamp.ts` and its
single adapter in `time.ts`; ramp solving/parsing remains with the existing
contract owner. Files: `pacingAudit.ts`, `eyeTrace.ts`, `eyeTraceRepair.ts`,
`motionDensity.ts`, `storyboardMoments.ts`, `runner/storyboardAudit.ts`,
`directComposition.ts`, `layoutInspector.ts`, `temporalInspector.ts`, this
plan. Verification: Slack typecheck; focused audit/time/direct suites (7 files,
319 tests); full Slack unit suite (76 files / 1,293 tests); `replay:all`
(13/0/0); time-ramp seek and rendered temporal-judge browser tests (2/2).
No paid probe, publish, or deploy. One initial browser command was invoked from
the repository root and found no matching project; rerunning from `apps/slack`
passed, so this was an operator command-location error, not a test failure.

## S3.1 — 2026-07-11 — DONE
Added `src/engine/cameraPhrase.ts` as the canonical typed semantic model and
made camera blocking compile authored segments plus direction/continuity
requests into it before injection. Every phrase now carries source/arrival
poses, travel/settle/dwell/departure intervals, importance, evidence owner,
occupancy/anchor contracts, and `authored|continuity|host-derived` route
ownership. The existing blocking names/island remain compatibility adapters;
runtime behavior is unchanged at this seam. Files: `cameraPhrase.ts`,
`cameraBlocking.ts`, focused fixtures/tests, `PHASE_3.md`, and this plan.
Verification: Slack typecheck; focused camera/blocking/environment unit tests
(87/87); camera depth, blocking landing, and continuity runtime browser tests
(14/14); deterministic `film:demo` completed with all four cuts, 0 eligible
dead-frame windows, and unchanged runtime routing. No paid probe, publish, or
deploy.

## S3.2 — 2026-07-11 — DONE
Moved runtime-route selection and degenerate collapse into the typed camera
phrase compiler. When a scene has primary phrases, non-routing support stays
local; only a distinct authored supporting destination can join the lens
route. Consecutive same-target/context poses below the semantic distance floor
merge into one phrase with a combined dwell/departure and provenance. The
canonical island reports input/collapsed counts, and the source normalizer
emits `camera-phrase-collapse` only when that island changes (replay remains
idempotent). SignalDock's exact accepted storyboard now compiles 14 phrases to
7 routes (1/2/2/2). Files: `cameraPhrase.ts`, `runner/repairs.ts`, `sentinel.ts`,
focused tests/fixture, replay expectations, `PHASE_3.md`, and this plan.
Verification: Slack typecheck; focused phrase/blocking/normalizer/Sentinel
tests (34/34); exact `replay:all` (13/0/0), with expected hashes intentionally
refrozen because the canonical camera island gained typed fields and collapsed
routes. No QA finding class was added or loosened; no paid probe, publish, or
deploy.

## S3.3 — 2026-07-11 — DONE
Made `cameraPhrase.ts` own parsing plus the frozen landing tolerances, and
migrated layout arrival/occupancy and eye-trace attention to the canonical
phrase plan. The two QA paths now share visibility, occupancy slack, anchor,
rest-speed, dwell, sample-inset, and segment-match values; this removes the
former exact-upper-bound vs 1.1x evidence mismatch. Eye trace uses the last/
first executed phrase targets at boundaries (typed cut focal parts still win),
not raw authored camera path guesses. The browser runtime now executes the
compiler's phrase list directly and no longer filters/merges routes again.
Browser fixtures were migrated through the same collapse pass. Files:
`cameraPhrase.ts`, `cameraBlocking.ts`, `layoutInspector.ts`, `eyeTrace.ts`,
camera/continuity runtime template, focused unit/browser tests, replay
expectations, `PHASE_3.md`, and this plan. Verification: Slack typecheck; 129
focused unit/layout tests; GatePilot-shaped continuity, blocking-landing, and
eye-trace browser tests (10/10); exact `replay:all` (13/0/0). An initial browser
run exposed a legacy fixture that depended on runtime-side compilation and an
over-zoom from applying QA slack to runtime targeting; the fixture now enters
through canonical collapse and runtime again targets nominal occupancy while
QA alone applies the shared measurement band. No paid probe, publish, or
deploy.
