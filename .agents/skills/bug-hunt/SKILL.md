---
name: bug-hunt
description: Empirically reproduce and fix Sequences for Slack pipeline defects from persisted jobs, rejected artifacts, demos, or typed fixtures. Use for bug hunts, pipeline hardening, failed probes, regressions, and pre-push defect review where Codex must identify the lowest deterministic owner, add proof, and keep exact replays and suites green.
---

# Bug-hunt mode

Verify every claimed bug against real state before fixing; never repair a
phantom. Read `apps/slack/SENTINEL.md` before changing a schema, scaffold,
normalizer, gate, retry, or fallback.

For the active 2026-07-12 hackathon stabilization work, first classify the
evidence. Hard runtime/contract/state/output failures are bugs; host-known
markup, binding, or load-bearing frame containment belongs to one bounded
deterministic repair; taste/quality preferences are advisory. If the artifact
is runtime-valid and human-acceptable with advisory residue only, record it and
stop—do not turn it into a bug hunt.

1. Reproduce from `.data/projects/<job>`, a model-free demo, or a minimized
   typed draft. Preserve the exact rejected storyboard/source and its ledger.
   For a persisted run, start with:

   ```powershell
   npm run probe:triage --workspace @sequences/slack -- <job-id-or-project-dir>
   npm run storyboard:replay --workspace @sequences/slack -- <raw-response-file> --strict
   npm run source:replay --workspace @sequences/slack -- <author-artifact.html> [project-dir]
   ```

2. Trace the first owner with enough information: L0 schema, L1 scaffold, L2
   deterministic normalize, L3 static gate, L4 browser evidence, then L5 paid
   retry. Keep shared-package changes inside `packages/core` or
   `packages/platform` only when that dependency owns the defect.
3. Add an exact incident fixture, a minimized regression, and a negative
   control in `apps/slack/test` or the owning package. Register new finding
   classes/normalizers and telemetry in `src/engine/sentinel.ts`. For an L2
   repair, declare bounds, idempotence, dependencies, and rollback behavior.
4. Fix only the lowest shared deterministic cause. Rerun the exact artifact
   first, then the focused regression. A frame-containment repair may adjust a
   measured wrapper/station/camera fit, but must not redesign copy, story order,
   component choice, timing, palette, typography, or motion style. Advisory
   findings get no production edit during the hackathon sprint.
5. Run Slack typecheck, the full Slack unit suite, root tests, and exact replay:

   ```powershell
   npm run typecheck --workspace @sequences/slack
   npm run test:unit --workspace @sequences/slack
   npm test
   npm run replay:all --workspace @sequences/slack
   ```

   Use the `verify` skill for browser, source/MCP, render, and temporal gates
   applicable to the changed owner.
6. For a paid artifact, record the artifact, replay, fix, and verification in
   `apps/slack/PROBE_LOG.md`. Run another paid probe only when explicitly
   authorized, fallback-disabled, and required by a hard or judge-visible
   failure. The active sprint stops after the first acceptable MP4 and allows
   at most two new probes total; never rerun to clear advisory residue.

Do not loosen a hard gate, hide a failure in prompt prose, mutate live project
state, raise attempt counts, or declare success from a filtered test. Do not
investigate a novel edge case unless it is hard, judge-visible, or responsible
for another paid call. Report the defect, lowest owner, exact replay,
regression, and complete verification.
