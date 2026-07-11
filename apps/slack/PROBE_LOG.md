# Current live-probe ledger

This is the concise active ledger. Exact rejected artifacts under
`.data/projects/<job>/planning/attempts/` are the detailed evidence. Older
incident narratives were removed from active docs; durable lessons belong in
tests, registries, and [REFACTOR_HANDOFF.md](REFACTOR_HANDOFF.md).

For every paid attempt: preserve the artifact, replay it without a model call,
fix the lowest deterministic owner, add a regression, and record the honest
terminal status. Provider faults are environmental but still count in call
accounting.

## 2026-07-11 audit sequence

### LaunchRelay — `architecture-audit-live-1-20260711`

- Baseline: 3 storyboard attempts, 3 source attempts, 13 logical / 17 physical
  calls, 35.9m, `published-degraded`, rendered 27.3s.
- Shared defects: camera chassis lost on rollback, plugin region loss,
  host-auto moments protecting optional motion, global GSAP escaping the
  seekable timeline, shared-station support stealing the lens, and a light
  pedestal on a dark basis.
- Result: exact rejected storyboard/source replays pass after common-layer
  fixes. The baseline itself remains evidence, not a quality pass.

### PulseForge — `architecture-stress-2-20260711`

- Stopped after one storyboard findings retry.
- Cause: ramped scenes measured the introduction/development floor in source
  time instead of viewer time.
- Result: bounded viewer-time cut extension now commits atomically; exact raw
  replay passes at 25.203s.

### GatePilot — `architecture-stress-3-20260711`

- Corrected fixture passed storyboard attempt 1; source attempt 1 produced
  seven browser findings and attempt 2 was stopped.
- Shared defects: wrong primary cue, late chassis loss, impossible cross-kind
  morph promise, cut/read dwell mismatch, QA/runtime occupancy mismatch,
  plugin-child camera ownership, and a zero-length post-cut route.
- Result: exact rejected source now reports `strictOk:true`, `ok:true`, zero
  warnings. Focused unit/browser checks and typecheck pass.

### RelayGuard — `architecture-stress-4-20260711`

- Attempt 1 provider-truncated; attempt 2 rejected with three pacing findings;
  the next stream faulted and the run was stopped.
- Shared defects: a long opener approach missed the scene-stretch cap by only
  260ms, reverting toast holds; duplicated camera paperwork protected a whip
  through click settlement.
- Result: marginal approach trim is bounded to 350ms / 15% with a 600ms floor;
  interaction retiming protects camera-only evidence and matches audit
  tolerance. Exact attempt-2 strict replay passes at 25.5s; 82 pacing tests and
  typecheck pass. Commit: `63a1064`.

### SignalDock — `architecture-stress-5-20260711` (final session probe)

- Terminal: 25.2m, logical storyboard stage reported one accepted attempt after
  two provider stream timeouts; one bounded scene-repair call; two source
  attempts; 10 logical / 14 physical model requests; `published-degraded`;
  penalty 32; 23s MP4; fallback film not used.
- The output is not a motion-quality pass: 8 QA warnings, 4/8 readable primary
  landings, 9/14 occupancy samples in range, 30 jerk markers, peak speed 2.798
  diagonals/s, and 26.7% dead eligible runtime.
- Important frames show 0% reset flickers, label/value collision, cropped 94%
  numerals, sparse staging, wrong workspace anchoring, and weak final hierarchy.
  Code shows 14 blocking phrases for four scenes, two-step cursor correction,
  and a pseudo-element `querySelector` passed to GSAP as `null`.
- The critic correctly rejected its patch (`32 → 34`). This probe marks the
  boundary for the broad refactor; no further paid probe was launched at the
  user's request.

## Session conclusion

No fresh stress probe completed as a clean one-attempt motion-quality pass.
Exact-artifact fixes converged, but the final production-shaped run demonstrated
that camera/blocking/layout/repair ownership is too coupled for another local
patch cycle. Continue with [REFACTOR_HANDOFF.md](REFACTOR_HANDOFF.md).
