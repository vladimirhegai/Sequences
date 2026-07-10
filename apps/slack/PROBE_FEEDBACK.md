# Probe Feedback

This file records visual/motion-design observations that survived technical
validation but are not safe deterministic fixes for the Continuity Graph +
Camera Blocking Director. A later art-direction agent should use the named
project, latest revision, temporal strip, and corrected MP4 as exact evidence.

## 2026-07-10 — SignalPath (`session26-camera-probe-7` / corrected clone `continuity-ab-signalpath-1` r13)

User review of the original probe, confirmed against the final contact strip:

- The opening frame is cluttered and has no clean hierarchy. The trace id is
  centered while anomaly/log copy crowds the upper-left; memory/latency lines
  overlap and compete with the intended signal.
- `SignalPath // Topology` is malformed as an information graphic: connector
  lines do not terminate convincingly at nodes and do not explain a route.
- The MTTR payoff changes from the blue-black visual world to a white flash and
  back. The background discontinuity is not motivated by the narrative.

Handled by the continuity feature rather than parked: repeated attention on
`trace.parent_id` now compiles as one held station (no zoom-out/zoom-in
oscillation); graph-owned camera routes do not execute authored orbit/roll;
supporting annotations cannot cause a late lens move; and camera travel only
serves declared primary blocks, so automated remediation is not enlarged
without a primary reason.

## 2026-07-10 — BeaconOps (`continuity-live-beaconops-20260710` r6)

- The dependency-descent scene uses a thin line/chart near the lower edge that
  reads disconnected from the service list and correlation story.
- The film is technically coherent and dark-premium, but the dependency
  topology still needs authored endpoint/node semantics rather than decorative
  line work.

## 2026-07-10 — LedgerFlow (`continuity-live-ledgerflow-20260710` r5)

- The near-white treatment is washed out, with weak foreground/background
  separation and very large empty fields.
- A second app window remains partially visible at the opener's right edge; it
  reads like accidental clipping rather than deliberate continuity.
- `exception-review` → `payout-approval` has a static outgoing match frame; the
  semantic handoff passes, but the authored transition lacks a visible action.
- The closing lockup and CTA are technically safe but too small relative to the
  empty canvas.

## 2026-07-10 — ThreadlineAI (`continuity-live-threadline-20260710` r4)

- The pale editorial treatment is similarly washed out and low-contrast.
- The brief-lockup scene leaves a secondary card partially clipped at the right
  edge. It may be intentional depth/context, but currently reads accidental.
- `brief-lockup` → `metric-cta` has a static outgoing morph frame; the final CTA
  is readable, but the authored transition does not visually earn the change.
- The oversized ghost words (`SYNTHESIS`, `BRIEF`) compete with the actual
  product evidence and should be reconsidered as art direction.

## Evidence locations

Each corrected project stores:

- `build/qa/temporal/strip.png` — final frame contact strip;
- `build/qa/temporal/blocking.png` — focal trajectory, dwell, occupancy, and
  continuity overlay;
- `build/qa/temporal/temporal.json` — sampled motion evidence;
- `renders/` — initial paid render plus the newest corrected exact-source MP4.

