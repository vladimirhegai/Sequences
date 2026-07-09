# Live Probe Ledger

## Policy

When a paid probe burns an attempt or falls back, inspect its run artifacts.
For any non-architectural cause, fix it deterministically, add a regression
test, record the result here, then resume the original work. Follow the
placement tree in [SENTINEL.md](SENTINEL.md); do not loosen a gate or compensate
with prompt prose. Park architectural changes in [ROADMAP.md](ROADMAP.md).

Older incident detail remains in ROADMAP audit sections. This ledger is the
current source of truth for probe outcomes from 2026-07-09 onward.

| Date | Probe / Job | Stage | Burned | Root Cause | Fix And Evidence | Status |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-07-09 | asset-probe-1 | storyboard-plan | 1 findings-retry | `cameraArrivalSec` read a same-station re-frame as a late arrival and anchored an asset entrance inside a required hold. | `pluginContract.ts` now honors the camera entry frame; camera-arrival regressions in `pluginContract.test.ts`. | Fixed |
| 2026-07-09 | asset-probe-1 | source-author | 3 environmental attempts | The probe defaulted to `claude-code-cli` and hit its session limit. | Probes must pass `--provider openrouter-api`; no product defect. | Environmental |
| 2026-07-09 | asset-probe-2 | source-author | 1 compact repair | Five author-authored GSAP tweens targeted selectors absent from the final markup; GSAP warned but performed no work. A dropped supporting moment was already non-blocking. | L2 `stripDeadGsapTweens` removes only standalone literal-selector no-ops after host injection; regression in `authorReliability.test.ts`. Published clean: 16/16 moments, 10 thumbnails, critic applied, no fallback. | Fixed; assets default ON |
