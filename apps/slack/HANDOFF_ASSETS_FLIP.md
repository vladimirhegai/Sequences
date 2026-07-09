# HANDOFF_ASSETS_FLIP.md — finish the asset epic: probe analysis → default flip

You are picking up the LAST leg of the pre-built asset epic in `apps/slack`
(Sequences for Slack, hackathon deadline **Jul 13 2026**). Read first:
[CLAUDE.md](CLAUDE.md) (rules — isolation, Sentinel, live-probe policy),
[ASSETS.md](ASSETS.md), [PROBE_LOG.md](PROBE_LOG.md). The prior handoffs
([HANDOFF_COMPONENT.md](HANDOFF_COMPONENT.md) →
[HANDOFF_ASSET_RUNTIME.md](HANDOFF_ASSET_RUNTIME.md)) are DONE through their
verify ladders; they stay on disk only until the final audit below — then
delete both.

## DONE this session (2026-07-09, committed)

1. **asset-probe-1 audit + fix (PROBE_LOG rows logged).** The storyboard
   attempt-1 pacing rejection had ONE host-caused finding: `cameraArrivalSec`
   (pluginContract.ts) counted a same-station re-frame (hold AT `proof-stage`
   → push-in to `proof-stage`) as a late arrival, anchoring the asset enter at
   the 60% introduction cap of a 3s scene — a `pacing/holds` veto the host
   manufactured. **Fix:** arrival now honors the camera runtime's ENTRY frame
   (the scene opens framing the first path segment's from-else-to target —
   see `sequences-camera.v1.js` `entry`/`start`); a unit framed from scene
   start keeps the default entrance anchor. Storyboard cache contract 20→21.
   4 regression tests in `test/pluginContract.test.ts` (probe replay +
   entry-frame semantics; two older tests gained an opening hold elsewhere
   because their to-only first segments actually mean "camera starts on the
   station"). The OTHER 6 attempt-1 findings were planner-authored
   internal-move conflicts — the designed cheap findings-retry, not
   mechanical. asset-probe-1's author stage died environmentally: the probe
   ran without `--provider`, defaulted to `claude-code-cli`, and hit the
   account session limit. **Always pass `--provider openrouter-api`.**
2. **Verify ladder green:** typecheck · full suite **989/989** · film:demo.
3. **asset-probe-2 launched** (openrouter-api, `SLACK_SEQUENCES_ASSETS=1`,
   dense Pulseboard ARR+G2+CTA brief, job-id `asset-probe-2`). Logs:
   `.data/asset-probe-2.{stdout,stderr}.log`; artifacts:
   `.data/projects/asset-probe-2/`. State when this session ended:
   - storyboard **accepted on attempt 1** (the arrival fix held; no pacing
     findings). Planner declared `asset-laurel-badge` + `asset-rating-strip`
     (g2-proof) + a `lockup` plugin (cta-resolve) UNPROMPTED (no channel
     brief exists in sequence:check, so this is the pure-vocabulary test).
     Plugin governance capped `title` to 14 chars, clamped `score` to 5.
   - cut discovery upgraded scattered-signals→arr-hero to a validated
     **morph** (score 1.06) — shipped.
   - author attempt 1 burned on a browser-QA repair (see below); attempt 2
     (compact scene-slot repair of cta-resolve only) passed QA; the critic
     returned 5 directives and the run was still applying them at handoff.

## THE OPEN INCIDENT (fix-first before the flip)

**asset-probe-2, source-author attempt 1 burned.** QA requested a repair
listing: a dropped SUPPORTING moment (`final-still-hold` 22.5s, cta-resolve —
drop-with-warning class, should NOT block) and **5 `browser_warning: GSAP
target not found`** entries — the author wrote inline-timeline tweens against
selectors missing from its OWN markup (`#command-window .cmd-body >
div:last-child`, the same + ` .material`, an EMPTY selector, `#command-arr`,
`#chart-station .chart-panel`). A missing-target tween is a runtime NO-OP, so
the film's actual behavior is identical — the burn bought nothing.

**To do:** open `.data/projects/asset-probe-2/planning/author-run.json` and
the persisted attempt files to confirm WHICH finding class actually forced
the repair (the dead-tween warnings, the dropped moment, or something else
in the truncated list). Then walk SENTINEL.md's placement tree. Analysis so
far (verify before building):

- The obligation "authored tweens must bind" is mechanically checkable
  STATICALLY: parse selector-literal first args of `tl.to/from/fromTo/set`
  in the inline timeline and query them against the document (linkedom),
  exactly like `kitMarkupAudit.ts` re-runs the typed runtimes' bind queries.
- Candidate placements: (a) an L2 normalizer in
  `applyDeterministicSourceRepairs` that deterministically REMOVES tweens
  whose selector matches nothing (behavior-identical by construction; note
  the existing script-parse-revert machinery for inline-script edits — reuse
  it; a load-bearing missing tween still surfaces honestly as
  `moment_unbound`/motion-density), or (b) a static `kit_markup_incomplete`-
  style pre-browser finding naming the missing selectors (cheaper retry, but
  still burns the attempt). (a) matches degrade-never-veto; (b) only if (a)
  proves unsafe. Never loosen the browser gate itself.
- Add the regression test (a minimized film with one dead tween + one live
  one), one PROBE_LOG row, update SENTINEL.md's contract table if a new
  normalizer class is added.

## REMAINING WORK (in order)

**A. asset-probe-2 RESULT (run completed before handoff): PUBLISHED CLEAN.**
`status: pass`, `authoringMode: hyperframes-direct`, `fallbackStage: null`,
16/16 moments bound, 10 thumbnails, lint clean, 0 motion warnings, 8 browser
QA warnings (non-blocking — likely the residual dead-tween class below), the
`asset` component kind + sequences-assets island in the published film, the
critic's 5 directives applied and validated, and the DISCOVERED morph
(arr-fragment-c → arr-hero) shipped in scene 1. Storyboard passed on
attempt 1 (the arrival fix held). Remaining analysis for you: open the
thumbnails and judge whether the laurel badge + rating strip visibly beat
model-drawn equivalents; skim the 8 QA warnings in
`build/qa/sequence-check.json`.

**B. Fix the dead-tween incident** (above) + re-verify (typecheck, suite,
film:demo).

**C. Flip the default** (only if A published clean): `assetsEnabled()` in
`src/engine/sentinelFlags.ts` → `process.env.SLACK_SEQUENCES_ASSETS !== "0"`,
comment + SENTINEL.md flag-table row + ASSETS.md flag-state note + CLAUDE.md
assets paragraph updated to default-ON with `=0` revert. ⚠️ Asset kinds join
`PLUGIN_CATALOG` at MODULE LOAD — after flipping, the whole suite exercises
the default-ON path: re-run EVERYTHING (`test/helpers/enableAssetsFlag.ts`
becomes redundant but harmless). Also re-run `npm run film:demo`.

**D. ONE post-flip probe** (no env var — proving the DEFAULT path), e.g.
`npm run sequence:check --workspace @sequences/slack -- --provider
openrouter-api --product ... --job-id asset-flip-1 --format both` on a
different dense brief. Apply the probe policy to any burned attempt.

**E. Final audit + docs + cleanup + commit.** Audit every item in
HANDOFF_COMPONENT.md + HANDOFF_ASSET_RUNTIME.md against the tree (Tasks
A/B/runtime/pack were verified done this session — the flip items C/D/E are
what's left), then DELETE both files AND this one. Update ROADMAP.md (assets
default-ON), PROBE_LOG rows, SENTINEL.md flag table. Commit. Publishing
(`bash scripts/publish-public.sh`) and deploying (`railway up`) are separate
owner steps — flag, don't run.

## Gotchas (inherited + new)

1. Tests ONLY via `npm run test --workspace @sequences/slack` (direct vitest
   hits a pre-existing hyperframes resolution error; `--root ../..` collects
   the stale `.publish/` tree).
2. Flag at module load: probes need `SLACK_SEQUENCES_ASSETS=1` in the env at
   process start (until the flip).
3. **Probes MUST pass `--provider openrouter-api`** — the default provider is
   `claude-code-cli`, which shares the owner's Claude session limit (killed
   asset-probe-1's author stage; also what ran out mid-prior-session).
4. Island equality is byte-exact; `animate` beats live in BOTH the components
   island (paperwork) and the assets island (payload) — keep `animation`
   round-tripping in `parseComponentPlan`.
5. All `animate` beats on one unit share channel `"asset"`; the lowering
   sequences enter → payoffs +0.15s. `entranceAnchorSec` is arrival-aware but
   arrival is UNDEFINED when the camera opens on the unit's station (this
   session's fix) — don't "simplify" that back.
6. The storyboard cache contract is **21** — bump again on any lowering
   change.
