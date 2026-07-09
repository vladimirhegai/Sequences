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
| _(none yet — file created 2026-07-09)_ | | | | | | | |
