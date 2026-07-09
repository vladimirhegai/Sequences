# PROBE_LOG.md — live-probe attempt ledger

**The policy (owner mandate, 2026-07-09).** Attempts and fallbacks in paid
probes waste real time and tokens; the shipped product must publish with the
minimum possible attempts. So, during ANY live probe or paid create:

1. A fallback fires, or an attempt is burned/retried → find the root cause in
   the run's artifacts (`FAILURE.md`, `planning/attempts/`,
   `planning/author-run.json`, `planning/sentinel-run.json`, Railway logs).
2. **If the fix is NOT a major architectural change** (it's a paperwork/
   binding/ordering/parse class — the usual case): **pause whatever task you
   were doing and fix it now, deterministically.** Walk SENTINEL.md's
   placement tree — the answer is almost always an L2 normalizer in
   `applyDeterministicSourceRepairs`, a parse-time normalize/top-up in
   `parseStoryboard`, or an L1 scaffold change. Never loosen a gate; never
   fix it in prompt prose.
3. Add the regression test that replays the minimized incident.
4. Log ONE entry here (table below), then resume the original task.
5. Architectural causes (would change a contract's shape, the stage ladder,
   or a runtime) get an entry here with `parked` and a matching item in
   ROADMAP.md instead — don't yak-shave mid-probe.

History note: incidents before this file lived in ROADMAP.md's audit sections
(the `palette-input` incident, the Cursorflow dense-UI fallback, the
plugin-probe-1/2 + plugin-live-1 lessons, `audit-final-a1/b1`, the
`improve-ws32-1` marginal-miss veto). New entries go here.

| date | probe / job | stage | burned | root cause (one line) | fix (file + mechanism) | test | status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-07-09 | asset-probe-1 | storyboard-plan | attempt 1 (findings-retry) | `cameraArrivalSec` read a same-station re-frame (hold AT `proof-stage` → push-in to `proof-stage`) as a 20.4s arrival, anchoring the asset enter at the 60% cap of a 3s scene — a host-manufactured `pacing/holds` rejection | `pluginContract.ts cameraArrivalSec`: honor the runtime's ENTRY frame (first segment's from-else-to target) — a unit framed from scene start keeps the default anchor; storyboard cache contract 20→21 | `pluginContract.test.ts` camera-arrival block (probe replay + entry-frame cases) | fixed |
| 2026-07-09 | asset-probe-2 | source-author | attempt 1 (compact repair) | author wrote inline-timeline tweens against selectors missing from its OWN markup (5× "GSAP target not found": `#command-window .cmd-body > div:last-child`, +` .material`, an empty selector, `#command-arr`, `#chart-station .chart-panel`) — dead tweens are runtime NO-OPs, so the burn bought nothing; a supporting moment also dropped (warning class) | OPEN — see HANDOFF_ASSETS_FLIP.md: confirm the blocking class in `author-run.json`, then either an L2 dead-tween strip in `applyDeterministicSourceRepairs` (behavior-identical by construction) or a static missing-selector audit alongside `kitMarkupAudit` | pending | open |
| 2026-07-09 | asset-probe-1 | source-author | 3 attempts (env) | authoring CLI (`claude.exe`) hit the account session usage limit (429 "resets 8:30pm America/Toronto") — environmental, not mechanical; the 5 remaining attempt-1 pacing findings were planner-authored internal-move conflicts the normalizers deliberately leave to the model | none (rerun after limit reset: asset-probe-2) | — | env |
