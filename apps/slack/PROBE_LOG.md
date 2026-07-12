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

### Briefly — `refactor-review-normal-1-20260711` (refactor-review session probe)

- The first run of the prepared calm production-shaped brief (16s,
  crisp-saas, fallback disabled). Terminal: 24.0m, `published-degraded`,
  8 QA warnings, 20.2s MP4, fallback not used, status `warn`.
- Storyboard: 1 logical attempt but 3 physical streams (two provider
  timeouts) + 2 hedge duplicates; then ~11 sentinel normalizations rewrote
  plan timing — including moving the staggered 2.2s/3.2s arrival beats of the
  opening "inputs pile up one by one" scene all to 0.28s (the
  entrance-cannot-be-blank normalizer erased the authored stagger), dropping
  camera moves for budget, and delaying a whip 2.5s.
- Source: attempt 1 browser-rejected (3 GSAP-null-target warnings — NodeList/
  empty/null dataflow forms that the literal dead-selector strip missed —
  plus important_safe_area 29px and camera_framed_sparse 6%); attempt 2
  compact repair (107,819-char prompt) failed slot validation, kept draft,
  re-reported the SAME classes with safe-area now 159px; attempt 3
  (110,924 chars) changed the locked scene count 5→4 and was atomically
  rejected; the ladder early-shipped attempt 2 as "browser-valid". Critic
  issued 4 directives; its patch regressed quality 20→21 and was rejected.
- Film look (strip + thumbs): five white app-window scenes floating small on
  a loud orange/blue wallpaper; low-contrast gray-on-white row text;
  ~1.2s empty opening card; seeded plugin copy mismatched the story
  ("Meeting recapped — Leo Diaz" toast in a weekly-update publish beat);
  final headline wraps mid-word ("Keep everyone in th / e loop"); sparse
  final lockup (6–10% painted). `composition_washed_out`,
  `camera_framed_sparse`, `important_safe_area`, `moment_static_frame`
  all shipped as warnings.
- Verdict: replicates SignalDock's classes on a CALM brief — repeated-class
  repair loop, prompt bloat, sparse/washed staging, normalizers overriding
  intended choreography, headline typography. Evidence feeds
  [REFACTOR_PLAN.md](REFACTOR_PLAN.md) S1.3, S5.4, S6.1, S8.1, and Phase 3.
  No second probe launched: stress + normal evidence now agree; next paid
  probe should follow Phase 0 tooling.

## 2026-07-11/12 Phase 3 LP-1 checkpoint (FrameProof)

### FrameProof — `phase3-lp1-camera-20260711-a…e` (five fail-loud runs, then pass)

Stress-shaped seven-scene brief, fallback disabled, continuity on, audit
composition, OpenRouter. Attempts A–D each stopped fail-loud at storyboard
planning, and each exposed one deterministic Phase 3 integration defect that
was fixed at the lowest owner with an exact-artifact replay plus a minimized
regression before the next paid run (full narratives in
[PHASE_3.md](PHASE_3.md)):

- **A** (`…-a`, 6 logical / 8 physical): idea gate counted same-target visits
  as competing ideas → semantic de-duplication by target + contextual framing
  (commit `22b9086`).
- **B** (`…-b`, 7/10): `topUpFramingFloor` could not upgrade a single
  continuity-owned hold chassis, and its finding message encouraged
  supporting-evidence tours → neutral-chassis upgrade to a bounded same-target
  push-in (commit `bbbfb80`).
- **C** (`…-c`, 4/8): plugin reconciliation kept a renamed one-child
  team-strip beside the typed load-bearing avatar stack, creating a second
  camera owner → retire the duplicate plugin (commit `14e86c7`).
- **D** (`…-d`, 8/9): a generic spatial focal did not receive its declared
  region as contextual framing, so the authored station move was claimed by a
  supporting phrase → region-as-context for spatial focals (commit `6f7064c`;
  intentional LaunchRelay replay refreeze).
- **E** (`…-e`, 24.0 min, 9 logical / 13 physical, 2 failed + 2 hedged
  physical requests — environmental): **storyboard accepted on the first
  logical attempt**; `published-degraded`, `runtimeValid=true`,
  `qualityResidue=1`, 20.2s MP4.

**LP-1 verdict vs LP-0 (SignalDock): PASS on all four criteria.** ≤1 primary
route/scene (2 full moves / 7 scenes vs 14 phrases / 4 scenes); primary
readable landings 7/7 (vs 4/8); occupancy in range 7/7 (vs 9/14); one
registry-known QA class, nothing new (1 warning vs 8; 3 jerk markers vs 30;
peak speed 0.776 vs 2.798 diag/s; 0% vs 26.7% dead eligible runtime).

Residue, honestly stated: `motion_jerk_excess` in `gathered-workspace`
repeated across both source attempts and shipped as the single quality
residue (`stagnant-polish-early-ship`). The artifact replays statically clean;
the class is the S8.4 gesture-settle contract and is logged there. Frame
inspection also shows Phase-8 staging classes (edge-cropped count-up
numerals, a near-black owner scene, loud wallpaper swipe covers) → S8.1/S8.6.
No camera-semantic defect remains; Phase 4 (state continuity) is next.

## Session conclusion

No fresh stress probe completed as a clean one-attempt motion-quality pass.
Exact-artifact fixes converged, but the final production-shaped run demonstrated
that camera/blocking/layout/repair ownership is too coupled for another local
patch cycle. Continue with [REFACTOR_HANDOFF.md](REFACTOR_HANDOFF.md).
