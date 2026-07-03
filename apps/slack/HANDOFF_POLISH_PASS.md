# HANDOFF — Slack Sequences polish pass (2026-07-03)

For the next agent (Fable, different account). Read this file, then
[CLAUDE.md](CLAUDE.md), then continue. The prior session (Sonnet 5 research +
plan, reviewed/revised under Fable) got through research, planning, the model
experiments (running in background at handoff time), and roughly a third of the
implementation. Everything landed so far is committed on branch
`slack/spatial-world-camera-rig`, typechecked, and green on all 258 tests.

## 1. The user's original request (condensed, faithful)

> You are in full control of Slack Sequences. Goal: overall improvement of
> current features + fix bugs found along the way — the final polish step
> before major breakthrough features. Research first, find the highest
> improvement areas, improve them one by one. If you find MAJOR
> ("breakthrough") things, do NOT build them — write a `BREAKTHROUGH_[name].md`
> plan for another agent.
>
> Overall goal: amazing motion-graphics SaaS videos using real techniques:
> motivated camera movement, eased (never linear) animation, staging/focus
> control, anticipation before reveals, follow-through/overlapping action,
> seamless UI-driven transitions, spatial continuity, layered parallax depth,
> subtle always-alive motion, rhythmic pacing with beats for key claims. No
> random movement — every animation guides attention, clarifies the product,
> improves polish, or supports the story.
>
> Specific asks:
> - Optimize the prompts we give to agents.
> - Easy toggle to see any fallbacks that happened, via `/sequences` in Slack
>   (for demos).
> - Keep fallbacks so judges never see an error, but retry first depending on
>   the issue type.
> - Replace the stopwatch with an **estimated time remaining** display, updated
>   after each major change (e.g. when a model finishes its output).
> - Look over Hyperframes for what it already does (reuse, don't rebuild;
>   NEVER modify Hyperframes code — repo may be updated later).
> - Storyboard preview in Slack should not show frames mid-animation.
> - Ensure componentry can actually do morphs and other animations properly.
> - Camera rig is underwhelming: too smooth, no action, no cool creative
>   shots. Wants motivated motion (movement that explains the product, guides
>   attention, or feels premium).
> - Maybe use GLM for more things — e.g. proper on-screen positioning; better
>   spacing tools so we stop re-prompting 20 times; position things depending
>   on the camera (components clip / go off-camera today).
> - Experiment (REAL OpenRouter calls) with: DeepSeek v4 Pro deep-reasoning
>   max effort, GLM with reasoning (GLM output ceiling ~33K tokens — chunking
>   possible but weigh cost), Hy3 Preview, Minimax M3, Kimi K2.7 Code.
>   Quality first; price/speed are secondary. Intelligence-index context given:
>   Fable 60, GLM 5.2 MAX 51, DS v4 pro max 44, Minimax M3 44, Kimi K2.7 43,
>   DS v4 flash high 37, Hy3 34.
> - Then: major documentation cleanup — agent-first, token-efficient + accurate
>   for future agents; align with current product; do NOT document future
>   features.
> - Finally: publish to GitHub (`scripts/publish-public.sh`) and deploy to
>   Railway via CLI (`railway up`), verify `/healthz`.
>
> The OpenRouter key from that session is DELETED. Ask the user for a fresh
> key before any further paid runs.

## 2. The approved, revised plan

The full plan the user approved (first drafted by Sonnet, then revised under
Fable — the revision matters, it re-aimed several weak choices):

1. **Model experimentation first** (informs defaults). Status: running, §4.
2. **Camera rig — action + motivation.** Emphasis on *shot-selection
   pressure*, not easing physics:
   a. Energy-curve → camera-verb mapping in the storyboard prompt (the concept
      pass ALREADY emits an `energyCurve` artifact that the storyboard prompt
      quotes but never binds to camera verbs — peaks should get whip / hard
      push-in / zoom-through cut; valleys hold+settle).
   b. Deterministic **camera-energy audit** fed into the storyboard
      findings-retry loop.
   c. `bindEvidence` scoring tweak in `storyboardMoments.ts`: prefer camera
      segments whose `toPart`/`toRegion` matches the moment's subject over
      mere time-overlap (no schema change).
   d. Physics polish: whip motion-blur, anticipation micro-segment, staggered
      settle, wider orbit (details + exact design decisions in §5).
3. **Positioning — world-layout station map**: GLM's storyboard optionally
   declares which `data-region` sits in which viewport-sized grid cell of the
   camera world; deterministic cell→pixel-rect conversion feeds the author
   prompt as explicit placement coordinates; degrade to today's free placement
   when absent. Plus a small always-on layout-guidance block in the author
   prompt derived from the locked storyboard (safe-area, morph-twin box shape,
   gap consistency) using layoutInspector's existing thresholds.
4. **Fallback**: failure classification; parse failures get a compact-mode
   structural-reminder retry; **flip deterministic fallback to default-ON**
   (opt-out `SLACK_SEQUENCES_ALLOW_DETERMINISTIC_FALLBACK=0`) so judges never
   see a raw error; `/sequences debug on|off` receipt trail. (Toggle: DONE §3.)
5. **ETA-remaining timer** across the whole run. (DONE §3.)
6. **Settled-frame thumbnails**: capture at `evidence.endSec + ~0.08s` clamped
   inside the scene AND before the outgoing cut window; fall back to today's
   `atSec + 0.42`, then scene-fallback. File: `directComposition.ts`
   `thumbnailCaptures` (~line 935).
7. **Morph verification**: browser test already proves it; add one live create
   exercising a `morphsWith` pair through the real pipeline; fix only real
   defects (`compileMorph` is genuinely implemented, FLIP twin measurement).
8. **Prompt optimization** after features land (dedupe
   `prompts/planning-director.md` ~562 lines against runtime-injected skill
   context; REPLACE weaker prose when adding new guidance, don't append).
9. **Breakthrough docs** (DONE §3): camera depth, speed ramping, match cut.
10. **Docs cleanup**: ROADMAP = single source of truth for "what's built";
    CLAUDE.md feature-wall shrinks to linked bullets; document all new
    features/env vars; no future speculation. (Partially done §3.)
11. **Verify → commit → publish (`bash scripts/publish-public.sh "<msg>"`) →
    deploy (`railway up`) → check healthz.** Publish ≠ deploy; both act on
    committed source only.

Explicitly OUT of scope (per user: write plans, don't build): true 3D orbit,
rack focus/DoF, speed ramping, general match cuts → the three
`BREAKTHROUGH_*.md` files in this directory.

## 3. DONE in the prior session (committed, tested: 258/258 pass, typecheck clean)

- **Thinking-mode operator knobs** (needed for the experiments, permanent
  value): `thinkingOverride()` in `src/engine/modelPolicy.ts`;
  `SLACK_SEQUENCES_STORYBOARD_THINKING` honored in `storyboardThinkingMode()`
  and `SLACK_SEQUENCES_AUTHOR_THINKING` in the new `authorThinkingMode()`
  (`compositionRunner.ts`). Unset/invalid → built-in defaults.
- **`/sequences debug on|off`** — `src/debugFlags.ts` (global JSON flag,
  jobStore idiom), subcommand branch in `index.ts`, `debugStages` on
  `ResultView` rendered as a "Debug — model stage receipts" section in
  `blocks.ts`, `StageReceipt.attempts?: number` added (type only — the attempt
  counters are NOT yet threaded from the retry loops, see §5).
- **ETA-remaining system** — `src/engine/stageTimings.ts` (seeded per-step
  estimates + persisted EMA in `.data/stage-timings.json`, `EtaTracker`,
  `formatEtaMs`); `StageProgressCallback` + `onStageProgress` pulses from
  `runStage` in `orchestrator.ts`; `BuildingView` class in `index.ts` replaces
  the old elapsed-seconds heartbeat + separate progress reporter for
  create/revise — one serialized message writer, ticks every 5s for the WHOLE
  build, honest per-stage phase copy, `~Xs remaining` context line, "still
  working…"/"wrapping up…" on overrun; render-phase headline shows
  `(~Xs remaining)` via `renderEtaLabel`; real render durations feed the EMA in
  `deliverVideo`. Undo/HD flows still use the old `makeProgressReporter`
  (fine — they're short).
- **Tests**: `test/stageTimings.test.ts`, `test/debugFlags.test.ts`, four new
  cases in `test/blocks.test.ts`.
- **Breakthrough docs**: `BREAKTHROUGH_camera_depth.md`,
  `BREAKTHROUGH_speed_ramping.md`, `BREAKTHROUGH_match_cut.md`.
- **Docs staleness fixes**: ARCHITECTURE.md §9 no longer claims the planner is
  "blind to the registry catalog" (capability sync + retrieval ARE built:
  `src/agent/capabilityIndex.ts`, `scripts/syncCapabilityIndex.ts`); the two
  superseded IMPLEMENTED-stamped handoff docs were deleted (their "what's
  next" content already lives in ROADMAP's Build Order); OPERATIONS.md now
  links to CLAUDE.md's verification ladder instead of duplicating the command
  blocks.
- **sequenceCheck.ts env report fix**: was reporting
  `SLACK_SEQUENCES_PRODUCTION_MODEL` (read by nothing); now reports
  `SEQUENCES_OPENROUTER_MODEL` + both new thinking knobs.

## 4. Model experiments — state at handoff

Driver: `bash <scratchpad>/model-experiments.sh` was launched in the
background with the (now-deleted) key exported; it runs **9 configs
sequentially**, ~10 min each, one fixed brief (product "Ledgerline", 18s,
crisp-saas, metrics + table/toast/stat-card/command-palette context).
Outputs land in
`C:\Users\vladh\AppData\Local\Temp\claude\C--dev-Coding-Sequences\a6c84a15-372b-49c3-8b13-b48f870ffa5a\scratchpad\experiments\<config>\`
(`run.log`, `sequence-check.json`, `sequence-check.md`). If the machine stayed
up, all 9 should be complete; **copy the whole `experiments/` folder somewhere
durable before doing anything else** (it's a temp dir).

Configs: `01-baseline-glm-medium` · `02-glm-high` (GLM 5.2, storyboard
reasoning high — the "GLM MAX-effort" analog; no separate max slug exists on
OpenRouter) · `03-minimax-m3-high` · `04-kimi-k27-medium` ·
`05-hy3-preview-medium` (storyboard-model swaps) · `06-dsv4pro-storyboard-high`
· `07-dsv4pro-author-max` (author reasoning max → OpenRouter effort xhigh) ·
`08-kimi-k27-author` · `09-dsv4flash-author-high` (author swaps).
Confirmed slugs: `z-ai/glm-5.2`, `deepseek/deepseek-v4-pro`,
`deepseek/deepseek-v4-flash`, `tencent/hy3-preview`, `minimax/minimax-m3`,
`moonshotai/kimi-k2.7-code`.

Score each `sequence-check.json` on: `status`, `result.elapsedMs`,
`result.stages[].durationMs`, `result.fallback`, `checks.momentCount` /
`unboundMomentCount` / `fullCameraMoveCount` / `componentBeatCount` /
`componentKinds` (did it cover the brief's asked-for kinds?) /
`motionWarningCount` / `qaWarningCount` / `staticWarningCount`, plus
`run.log` for retry counts (`attempt N/3` lines). Quality outranks price/speed
(user's explicit rule). Swap `modelPolicy.ts` constants only on a clear
quality win; leave a findings comment there either way.

**Baseline (run 01, GLM-medium storyboard + DS-pro author): PASS, 612s total
(storyboard 291s, author 279s), 14 moments all bound, 6 full camera moves, 6
QA warnings — but only 3 component beats and it missed the requested
command-palette kind.** Watch whether reasoning-high / other models cover
component kinds better; that was the baseline's clear weakness. Beware
storyboard-cache reuse across configs 07-09 (they share the baseline
storyboard config — cache hits make their storyboard stage ~0s; that's by
design, they test the AUTHOR axis).

## 5. REMAINING work, in order, with design decisions already made

Verified constraints you must respect: tsconfig has `erasableSyntaxOnly` (no
TS constructor parameter-properties); `validateCameraContract` requires the
`sequences-camera` island to `JSON.stringify`-equal `resolveCameraPlan(scenes)`
(so resolver changes automatically stay consistent — injection uses the same
function); the camera runtime registers global GSAP eases every composition;
never import from `apps/forge`/`apps/sequences`; never edit
`apps/slack/vendor/hyperframes` or `node_modules`.

1. **Camera energy (the "no action" fix).**
   - `cameraContract.ts`: export `auditCameraEnergy(storyboard: DirectScene[]): string[]`
     returning blocking findings: (a) film ≥12s and no high-energy element —
     no `whip`, no `push-in` with zoom ≥1.3, and no
     zoom-through/inverse-zoom/flash-white/object-match cut anywhere; (b) ≥4
     full camera moves all sharing one verb. Precisely-worded, trivially
     fixable by the model in one findings-retry.
   - Call it from `validateStoryboardPlan` (compositionRunner.ts ~line 1994,
     beside `validatePlannedMoments`).
   - Storyboard prompt (inside the `concept` block ~line 2391): require camera
     verbs to track the concept's `energyCurve` — peak scenes get whip/hard
     push-in/zoom-through-cut into them; valleys get hold+settle; never
     distribute one verb everywhere.
2. **Anticipation (zero runtime changes needed).** In `resolveCameraPlan`
   (cameraContract.ts ~line 294): when pushing a full move of kind
   `push-in`/`whip`/`track-to-anchor` and the gap-fill drift before it is
   ≥0.35s, split that fill: end it 0.18-0.25s early and insert a `drift`
   segment with `ease:"seqAnticipate"`, `blend: 0.06`, same target. The
   seqAnticipate ease dips NEGATIVE early → GSAP fromTo lerps the camera
   backward past its start, then commits — a real camera wind-up. (Verified:
   runtime `blend>0` branch lerps `state → framed` by `blend`, ease shapes it;
   ease functions may return <0.)
3. **Whip blur + wider orbit** (`templates/sequences-camera.v1.js`): when
   `segment.move === "whip"`, add two half-window tweens on a `{b:0}` proxy
   driving `world.style.filter = "blur(Npx)"` (N≈7 peak, back to 0; clear
   filter at end — mirror the orbit-lite dual-tween pattern ~line 250).
   `ORBIT_DEG` 2.2 → ~7. Note the runtime file is versioned by content hash
   (`cameraRuntimeHash`) — no version bump needed, but re-run
   `test/cameraContract.test.ts` + `film:demo`.
4. **Staggered settle** (`templates/sequences-components.v1.js`): when
   multiple beats in one scene share `atSec` within ±0.05s, add a 30-60ms
   cascading delay by beat index — follow-through, not simultaneity.
5. **World layout (positioning).**
   - `DirectScene` (directComposition.ts) gains
     `worldLayout?: Array<{ region: string; cell: [number, number] }>`.
   - Normalize in `parseStoryboard` (compositionRunner.ts ~line 1729, beside
     the camera normalize): keep kebab-case regions, integer cells in
     [-2..2], drop dupes/junk; keep only when the scene declares a camera path.
   - Storyboard prompt: teach it (declare for any shot with 2+ stations;
     cells are viewport-sized; [0,0] = entry framing; adjacency should match
     the camera journey).
   - `creationPrompt` (~line 2965, inside the locked-storyboard block): for
     each scene with worldLayout, render deterministic placement text — region
     R → rect `left: cx*1920px, top: cy*1080px, size ≈1400×800 centered in
     that cell, content ≥8% margin`, world plane must span all cells.
   - Add the small always-on layout-guidance block (safe-area reminder;
     morph twins need comparable boxes; ≥3 simultaneous beats → consistent
     gaps) derived from the locked storyboard.
6. **Settled thumbnails** (`directComposition.ts` `thumbnailCaptures` ~935):
   `atSec = clamp(evidence.endSec + 0.08, sceneStart, sceneEnd - 0.05 - outgoingCutWindow)`
   when a moment has evidence; keep existing fallbacks. Outgoing cut duration:
   reuse the cut plan (see `cutContract.ts` — cut windows near scene end).
7. **Fallback default flip** (`orchestrator.ts` ~line 754): allow fallback
   unless `SLACK_SEQUENCES_ALLOW_DETERMINISTIC_FALLBACK === "0"` (currently
   requires `=== "1"`). Update the option's doc comment, OPERATIONS.md env
   table, and ROADMAP/CLAUDE "honest failures" paragraphs — the labeled
   fallback + debug toggle keep it honest, judges never see a raw error.
8. **Attempts threading** (for the debug trail): the retry loops in
   `requestStoryboardPlan` / `authorComposition` know their attempt count;
   surface it — cleanest is an optional `attempts?: { count: number }`
   out-param on both functions' args, written each attempt, read by
   `runStage`'s callers in orchestrator.ts to set `StageReceipt.attempts`.
   Blocks.ts already renders it.
9. **Parse-failure retry**: storyboard parse failures ALREADY get
   findings-retry with reasoning dropped + budget capped (recoveryPass).
   Check the author loop's generic catch (~line 3155+): add one structural
   reminder line ("emit exactly one <index_html>/patches_json — no prose")
   when the caught error came from tag/JSON parsing rather than validation.
   Don't over-engineer; a `classifyAuthoringFailure` enum is only worth it if
   it also labels the debug receipts.
10. **Spring easing — decided to SKIP the runtime swap.** Rationale: the
    Hyperframes solver (`@hyperframes/core` `generateSpringEaseData`,
    `SPRING_PRESETS`) is real, but baking generated curves into the static
    runtime template adds build machinery + hash churn for a subtle visual
    delta; the existing hand-tuned curves are proven. If you want it cheap:
    generate ONE spring curve offline, paste as a static `seqSpring` ease into
    sequences-camera.v1.js with a provenance comment. Document either way.
11. **Morph live proof**: one paid create whose brief demands
    search→command-palette; confirm the morph beat survives the real pipeline
    (`checks.componentBeatCount`, morph in beats, browser QA pass).
12. **Prompt optimization pass** (§2.8 above).
13. **Docs cleanup finish**: document debug toggle, ETA, thinking knobs, new
    fallback default, worldLayout, camera-energy audit in ROADMAP (single
    source of truth) + short linked bullets in CLAUDE.md; shrink CLAUDE.md's
    "Current feature state" wall; delete this HANDOFF file and the plan-file
    leftovers when absorbed.
14. **Verify** (ladder in CLAUDE.md): slack typecheck + tests + `mcp:demo` +
    `direct:demo` + `sequence:check --demo --no-mcp` + `film:demo` (+ once
    with `VERIFY_RENDER=1`), one real paid live create inspecting: varied
    motivated camera, settled thumbnails, no clipping findings, ETA behavior,
    debug trail.
15. **Ship**: commit → `bash scripts/publish-public.sh "<msg>"` (pushes the
    public subset to `vladimirhegai/Slack_Sequences`) → `railway up` from repo
    root → `curl https://sequences-slack-production.up.railway.app/healthz` →
    `ready`. Publish and deploy are SEPARATE; GitHub autodeploy is OFF.

## 6. Gotchas discovered this session

- `npm run typecheck --workspace @sequences/slack` — root typecheck EXCLUDES
  apps/slack. Root `tsconfig` for slack uses `erasableSyntaxOnly`.
- Slack tests spawn real Chromium for browser QA; full suite ~60s.
- A pre-existing, unrelated `apps/forge` knowledge-retrieval test failure
  exists at the monorepo level (MOTION_CATEGORIES.md moved) — don't chase it.
- `.data/stage-timings.json` and `.data/debug-flags.json` are runtime state
  (gitignored with the rest of `.data`).
- The experiment driver exports env overrides that live only in that bash
  process — nothing to clean up in files. The key was pasted in the session
  transcript only; user deletes it after the session.
- `/sequences demo` preset path skips model stages entirely — `BuildingView`
  handles it with `["submit_plan","render_preview"]` expected steps.
