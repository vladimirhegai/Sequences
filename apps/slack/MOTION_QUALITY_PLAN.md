# MOTION_QUALITY_PLAN — make the films real motion design

**Audience:** the next long-horizon agent session (GPT 5.6 SOL Ultra).
**Written:** 2026-07-10, after a full audit of probe evidence, docs, architecture,
and motion-design research. Owner mandate: current renders "look uncoordinated,
messy, bad morphing and transitions" — make them actual Motion Design.

**Read first:** [CLAUDE.md](CLAUDE.md) (rules), [SENTINEL.md](SENTINEL.md)
(placement tree — walk it before adding ANY gate/repair),
[PROBE_FEEDBACK.md](PROBE_FEEDBACK.md) (art residuals ledger),
[PROBE_LOG.md](PROBE_LOG.md) (attempt economics).

---

## 0. Operating rules for this session (owner mandates — not optional)

1. **Live-probe fix-first.** Any paid probe that burns an attempt, falls back, or
   fails: STOP the current task, fix the root cause deterministically at the
   lowest Sentinel layer (usually an L2 normalizer in
   `applyDeterministicSourceRepairs` or a parse-time normalize/top-up), add the
   regression test, log one PROBE_LOG.md row, then resume. Architectural causes:
   log + park in ROADMAP. Never loosen a gate as the "fix". A probe that takes
   way too long is also a failure — read stage receipts
   (`planning/sentinel-run.json`), don't poll or grow timeouts.
2. **Be smart with subagents.** Thinking too high on small tasks wastes time and
   degrades output. Owner's calibration:
   - **5.6 Luna, medium or high thinking** — design judgment and small tasks
     (frame/palette review, contact-strip critique, doc edits, single-file fixes).
   - **5.6 Terra** — implementation, most of the time (write the module + tests
     from a precise spec).
   - **5.6 Sol** — orchestration, auditing, planning, and implementing the few
     genuinely *hard* features (cross-cutting engine seams, the enforcement-flip
     calibration below). Reserve yourself for these; delegate the rest.
   Give subagents narrow, evidence-anchored briefs (project dir + finding +
   file:line), not open-ended "improve X".
3. **A passing gate is not a good film.** Review the actual MP4 / contact strip
   (`build/qa/temporal/strip.png`) / blocking overlay (`blocking.png`) after
   every probe. `published-degraded` is internal evidence, never success.
4. **Commit in reviewable increments** so the owner can hand off at usage limits.
   Publishing (`bash scripts/publish-public.sh`) and deploying (`railway up`)
   remain separate, root-level, committed-source-only steps.
5. **Verification ladder** (CLAUDE.md §Verification): typecheck + tests + demo
   suite locally before any probe; one paid live probe before calling a
   model-facing change proven.

---

## 1. Diagnosis — why the films don't read as motion design

Evidence base: 2026-07-10 contact strips (`motion-v3-replay-monogram-r4`,
`continuity-ab-signalpath-1`, `motion-v3-replay-roamly-r1`), PROBE_FEEDBACK.md,
PROBE_LOG.md, per-film `sentinel-run.json` + `temporal.json`.

**Attempt economics baseline:** every recent live create ships
`published-degraded` — never clean. 2–5 storyboard attempts, 2–4 source
attempts, 10–16 min wall clock, 30–135 L2 normalizations per film;
`motion-design-live-parcelpilot-20260710` failed outright (fail-loud, 4
attempts). **The technical attempt-burner layer is effectively solved** — films
now die only on model-formatting flukes; do not spend this session's budget
adding more L2 repairs unless a probe burns an attempt (rule 0.1).

**What ships degraded is almost entirely art direction.** Hard numbers:
`meanOccupancyFraction` 0.10–0.21; `tinyFocalSamples` 71 (monogram), 93
(ledgerflow), 149 (roamly); primary landings readable only 3/7 on two films;
`jerkMarkerCount` 16–17; settles on time 6/14 (monogram); beaconops shipped on
a stagnant-polish early-ship with penalty **77**.

Ranked failure classes (what the viewer sees; full detail in PROBE_FEEDBACK):

1. **The void — tiny subject in empty canvas.** `cta-button occ 1.8%`,
   `status-pill occ 3.0%` at landings on otherwise-empty frames. Gates exist
   (`camera_framed_sparse`, blocking occupancy ranges) but are demoted to
   advisory on the final rung, the final-scene compact exemption excuses tiny
   closing lockups, and union-bbox is gameable. The #1 "PowerPointy" tell.
2. **Dead time inside scenes.** 4–5 near-identical strip frames per scene;
   roamly spends ~9s (≈40%) on two consecutive end-cards. `motionDensity`
   counts activities, not perceptible change; nothing ambient moves between
   beats.
3. **Transitions don't earn the change.** Static outgoing morph/match frames
   (ledgerflow `exception-review→payout-approval`, threadline
   `brief-lockup→metric-cta`): the temporal judge sees it but supporting static
   frames are advisory by design. Declared morphs also silently degrade to
   zoom-through (`cut_degraded` paperwork) — every one is a "bad morphing"
   data point.
4. **Uncoordinated entrances — no overlapping action.** Elements enter as
   disconnected islands: same easing, same duration, no lead–follow. The
   engine has no vocabulary for "B follows A by 80ms with a subtler ease".
5. **Washed-out near-white treatments.** Weak fg/bg value separation
   (ledgerflow, threadline, monogram). Only per-text WCAG `contrast_aa` exists;
   nothing measures compositional value structure, so films pass at AA and
   still look like fog.
6. **Semantic graphics that mean nothing.** Topology connectors that terminate
   nowhere (signalpath), chart lines disconnected from the story (beaconops).
   The prompt asks for endpoint-bound lines; nothing verifies binding.
7. **Camera landings missing their anchor / still moving.** 10 landings >14%
   anchor miss on ledgerflow — measured by Codex's new cameraBlocking layer,
   which is default-OFF and advisory.
8. **Structure waste + clutter at the edges.** Double end-cards, 4s static cold
   opens, oversized ghost words (`SYNTHESIS`) competing with product evidence,
   half-clipped secondary cards reading as accidents.

**The pattern:** the deterministic system polices correctness per element and
has instrumented most of the residual (occupancy, jerk, anchor, settle, static
frames) — **it simply refuses to block or even rank on it.** The gap is ~60%
"measured-but-advisory" and ~40% genuine taste (washout, hierarchy, semantic
graphics, motivation) that bounds checks structurally cannot see.

## 2. What real motion design does (research distillation)

The owner remembers "constant movement" — correct, with a catch. The craft:

- **Nothing is ever completely still, but stillness is hierarchical.** A
  produced film always has a *primary* action plus *secondary/ambient* motion
  (parallax drift, lagged shadows, texture shimmer, slow light/grade movement)
  carrying life between beats WITHOUT competing. Holding a pose ≠ freezing the
  frame. (Disney #5 follow-through/overlapping action, #8 secondary action.)
- **Overlapping action / offset & delay.** Related elements never move in
  lockstep and never as disconnected islands: the lead moves first, followers
  start 60–120ms later with subtler ease and settle after it. Staggers are for
  *moments*, not every list.
- **Easing carries meaning.** Arrive = ease-out; depart = ease-in; state-change
  while visible = ease-in-out; loops = linear; professional tools = springs with
  bounce 0 (overshoot only at celebration payoffs). Uniform easing everywhere is
  the #1 AI-slop fingerprint; so are pulsing indicators, blur-on-every-entrance,
  stagger-spam
  (`.claude/skills/design-motion-principles/references/anti-checklist.md`).
- **Anticipation before decisive moves; settle after.** `seqAnticipate` /
  `seqSettle` exist — the gap is usage discipline, wired per-move by the host.
- **Transitions transform; they don't just cut.** Apple/Linear product films
  morph one composition into the next: an element from scene A *becomes* scene
  B's anchor, or the camera travels through the world. Every boundary proves
  spatial continuity.
- **The frame is always composed.** Full-bleed environments, depth layers,
  content filling its station; negative space is a deliberate shape, not
  leftover void; the focal element is the highest-contrast thing on frame.

Sources: Disney's 12 principles
([Animation Mentor](https://www.animationmentor.com/blog/follow-through-and-overlapping-action-the-12-basic-principles-of-animation/),
[Adobe](https://www.adobe.com/creativecloud/animation/discover/principles-of-animation.html)),
[UX in Motion Manifesto](https://medium.com/ux-in-motion/creating-usability-with-motion-the-ux-in-motion-manifesto-a87a4584ddc),
[VMG's 10 principles](https://blog.vmgstudios.com/10-principles-motion-design),
[Figma Principles in Motion](https://www.figma.com/blog/principles-in-motion/),
plus the in-repo skill `design-motion-principles` (Emil Kowalski / Jakub Krehel
/ Jhey Tompkins: restraint, custom curves, exit subtlety, anti-slop checklist).

## 3. Workstreams

**WS-0 first** — it is enforcement-policy on data already collected and pays for
everything else. Then A/B/C attack the loudest visuals; D/E finish transitions
and art direction; F is architecture paydown; G grows the proven library;
H rebalances the prompt; I is the taste-tail critic. Within each:
spec → Terra implements → probe → fix-first → PROBE_LOG.

### WS-0 — Stop excusing what you already measure (fastest wins)

- **0a. Turn the Continuity Graph + Camera Blocking Director ON by default.**
  The exact A/B proved it (visibility 61.9%→91.0%, off-frame 118→21, jerk
  43→22.6, PROBE_LOG 2026-07-10). Keep `SLACK_SEQUENCES_CONTINUITY_GRAPH=0` as
  the rollback. Prerequisite: the parcelpilot classes below are fixed.
- **0b. Make `browserQualityPenalty` rank on the measured art signals** —
  occupancy shortfall, anchor miss, unsettled-at-cut, dead-frame windows — so
  the least-bad pick prefers a fuller, calmer draft. Ranking pressure first,
  soft block later; never unpublish.
- **0c. Set continuousMotion thresholds.** The "pending cross-film evidence"
  condition is met (5+ films of jerk/reversal/settle data in temporal.json).
  Derive advisory→blocking thresholds from the corpus (golden film must pass);
  wire them as strictOk-blocking polish findings like `eye_trace_jump`.
- **0d. Ship the parked occupancy-grid gate (ROADMAP "WS5 v2", ~L1376):** the
  24×14 cell grid replaces the gameable union-bbox, and **drop the final-scene
  compact exemption** that excuses tiny closing lockups. Calibrate: monogram's
  void frames fail, roamly's browse scenes pass.
- **0e. Primary-moment static frames already block strictOk — extend the same
  treatment to declared-transition outgoing frames** (see D1 for the compile-
  side fix; this is the measurement side).

### WS-A — Composed frames: kill the void

- **A1. Host-owned environments.** The committed `backgroundCatalog.ts`
  (18 wallpapers with per-image crop/focal/scrim/motion art direction) +
  `designDialects.ts` are the start: every scene gets a frame.md-derived
  environment layer (tinted texture / gradient field / depth cards) injected
  host-side like cinemaKit, so "empty canvas" becomes unrepresentable rather
  than detected. Brand-token tinted, never pure white/black, H.264-safe.
- **A1b. Wallpaper staging patterns (owner mandate, 2026-07-10).** The
  `vendor/wallpapers` images are to be USED in films, in three scene shapes:
  1. **Desktop stage** — the scene is a simulated desktop: wallpaper
     full-bleed, "desktop" furniture (dock/taskbar of app icons, floating
     app windows) composed over it. Kill-shot for empty-canvas app scenes.
  2. **Screen-over-wallpaper** — the product UI lives inside ONE framed
     screen (white/branded surface, rounded corners, real shadow) floating
     over the wallpaper; the wallpaper fills every margin. This directly
     fixes the verify-1 lateral-entry class: a small app window drifting in
     an empty lavender void becomes a screen composed over a rich field.
  3. **Full app view** — the app fills most of the frame; the wallpaper
     survives as deep margins/backdrop so edges are never bare `--canvas`.
  Use each image's catalog metadata (objectPosition crop, textSafeSide,
  scrim mode/opacity, motion mode + maxTravel/maxScale — several are
  deliberately `static`). Respect the catalog's ambient-motion caps; the
  wallpaper drifts, the SCREEN and its text do not (see WS-B evidence).
  ⚠ Provenance: the catalog is still marked `moodboard-only` (no license
  manifest). The owner has mandated production use for the hackathon demo —
  flip the provenance policy deliberately in one commit (and record it) or
  swap in licensed equivalents; do not ship customer-facing films on
  silently-un-flipped assets. Likely mechanism: a `data-depth` environment
  layer + a new `wallpaper-stage` / `desktop-stage` plugin kind (or frame.md
  background policy) so the pattern rides existing rails — decide placement
  with the SENTINEL tree.
- **A2. Station sizing discipline.** When a declared station's content union is
  a fraction of its cell, world-layout derivation shrinks the cell or scales
  the cluster (L2, sibling of `normalize.world-layout-derive`) so fit zoom
  lands composed.
- **A3. Whole-frame composition floor** (after A1 gives authors the tools):
  painted/textured coverage of the WHOLE frame at landings + mid-windows, where
  deliberate environment counts and bare `--canvas` does not.
  `SLACK_SEQUENCES_COMPOSITION=audit` first; strictOk-blocking after one
  calibrated probe. Register the finding class in sentinel.ts.

### WS-B — Ambient life: constant movement, hierarchically

**Shaky-text evidence (2026-07-10 evening, owner-reported and measured).** The
"shaky text/assets/components" the owner sees in renders was the operated-hold
lens float: the camera drifted ~6.5px AND scale-breathed 0.35% through every
readable dwell, putting every glyph in constant subpixel re-raster (measured
31–38dB consecutive-frame PSNR at "rest" on the verify-1 render; H.264 turns
that into visible edge churn). Fixed at the runtime: scale breathing is
REMOVED everywhere, dwells under 1.2s now rest completely (43–52dB after), and
holds ≥1.2s keep a translate-only drift ONLY because the quiet-window liveness
metric still needs a moving lens. **B1 is therefore also the shakiness
endgame:** once ambient life exists off the text block (parallax layers,
wallpaper drift, shadow/light breathing), delete the long-hold lens drift
entirely and let the FRAME hold while the environment lives. Any drifting
layer that contains text must move in whole pixels or not at all; drift
belongs to imagery/depth layers (the wallpaper catalog's motion modes are the
vocabulary).

- **B1. Living-canvas runtime.** Seek-safe ambient drift as a pure function of
  timeline time — slow parallax on `data-depth` layers, ±2–4px float on
  decorative elements, key-light/grade micro-shift — amplitude host-derived
  from `directionScore` (quiet during copy-reading windows, fuller during
  travel), kept OFF the primary block's screen region during dwells (blocking
  evidence gives that region). Decide placement (camera island extension vs 9th
  island) after studying the filter-on-world and preserve-3d landmines in
  CLAUDE.md's camera notes.
- **B2. Settle-and-breathe instead of freeze.** After a component's last beat
  the runtime eases shadow/glow to rest over ~1s (follow-through as a compile
  step, not a model choice).
- **B3. Dead-frame ratio** in continuousMotion temporal evidence (consecutive
  near-zero-change samples outside declared holds) so probes quantify liveness
  and WS-0b can rank on it.

### WS-C — Choreography vocabulary: overlapping action

- **C1. Typed `follows` relationship.** Beats may declare
  `follows: <beatId|componentId>` (+ optional lag). The HOST compiles the
  offset/delay chain: follower starts 60–120ms after the lead, subtler ease,
  settles last. Capped chain depth; one budget unit.
- **C2. Entrance families per scene.** One entrance grammar per scene ("rise
  from baseline", "assemble from edges", "materialize in place") declared once;
  host applies it to the scene's components with per-element offsets. Kills
  uniform-fade-in AND disconnected-islands in one move. Start with 3 families.
- **C3. Exit choreography.** Exits subtler + directional (recede ≤40%, ease-in,
  toward the next scene's spatial origin when a directional cut follows).

### WS-D — Transitions that earn the change

- **D1. Outgoing-motion floor at declared bridged cuts.** Host-compiled pre-cut
  phrase: the outgoing element moves toward its bridge role during the last
  ~0.4s (anticipation), so the morph reads as caused. Extends
  `sequences-cuts.v1.js`, which already owns boundary windows.
- **D2. Raise morph conversion.** Mine `cut_degraded` reasons across ledgers;
  fix the top mechanical causes host-side (twin geometry, aspect caps) instead
  of accepting degrade paperwork.
- **D3. Match-cut discovery v2.** Continuity entityIds give better match
  candidates than silhouette rhyme; revisit the one-per-film cap with fresh
  evidence after WS-0a.

### WS-E — Art direction: tonal hierarchy + semantic graphics

- **E1. Washout heuristic.** Luminance histogram + focal-vs-field value delta
  from the screenshots browser QA already takes for `contrast_aa`
  (`layoutInspector.ts` ~L3031). A frame whose whole histogram sits in a narrow
  near-white band with low focal separation = `composition_washed_out`
  findings-retry at frame/storyboard level (pick the denser dialect), never a
  paid-attempt veto. Catches ledgerflow + threadline directly.
- **E2. Kill free-form decorative SVG.** New plugin kind `flow-diagram` with
  seeded, endpoint-anchored edges (nodes = real `data-part` elements); extend
  the unbound-decorative-SVG repair into policy: connector/graph visuals come
  from the plugin or don't exist.
- **E3. Ghost-word budget.** One display-type moment per film, host-policed at
  storyboard parse (cheap findings-retry), sized relative to the scene's focal.

### WS-F — Architecture paydown (schedule F1/F4/F5 early; F2 needs a quiet tree)

Facts (2026-07-10 audit): `compositionRunner.ts` ≈ 12,900 lines / 82 exports /
11 concerns; 54 inline normalizers in `applyDeterministicSourceRepairs` with no
registry (sentinel.ts's 44 normalize rows are a hand-synced manifest that does
not drive execution); 9 bespoke contracts with no shared interface; ~45
`SLACK_SEQUENCES_*` flags, only 8 centralized; CLAUDE.md 934 lines + ROADMAP
2,136 lines duplicating a dated changelog.

- **F1 (M). Normalizer registry.** Ordered `NORMALIZERS: {id, run}[]` driven by
  one loop recording Sentinel telemetry automatically; sentinel.ts normalize
  rows generated/validated from registry ids. Pin current order with a golden
  replay test BEFORE moving anything (order is load-bearing).
- **F2 (L). Split compositionRunner into `runner/`** — parse / storyboard-audit
  / repairs / ladder / prompts / scaffold / orchestration; move-only commits;
  barrel re-export. It is the merge-conflict epicenter — do it only when no
  other agent has the file hot.
- **F3 (M). Shared `HostContract` interface** (`ContractResult {ok, findings,
  warnings, repairs}` + `validate(plan, ctx)`); migrate one contract per
  commit; continuity implements it from day one.
- **F4 (S). Flag centralization** + a test failing on raw
  `process.env.SLACK_SEQUENCES_` outside the flags module.
- **F5 (S). Unit/browser test split** (`vitest --project unit` inner loop;
  browser suite before probes/commits).
- **F6 (S). Docs pass** (§5).

### WS-G — Recipes, plugins, assets (grow the proven-good library)

- **G1.** Close the recipe-consumption gap (planner declines offered recipes —
  add host-side auto-declare at high retrieval confidence; degrade-never-veto).
- **G2.** New plugin kinds where free-form authoring keeps failing:
  `flow-diagram` (E2), `comparison-table`, `pricing-reveal`.
- **G3.** Author 3–5 recipes through the studio gate (`npm run recipes -- gate/
  export <id>`) that encode WS-B/WS-C craft — ambient-hero opener, overlapping-
  entrance dashboard, outgoing-motion morph seam — so live creates consume
  proven choreography verbatim. Eyeball gate thumbnails before export.

### WS-H — Prompt rebalance (planning-director.md)

Today: ~68% of 632 lines is host-ownership paperwork for seams the host
enforces deterministically anyway; the craft sections that exist are aimed at
tells the gates already kill, while the surviving residuals are untaught.
Compress the repeated ownership warnings and reinvest the byte budget
(`test/promptBudget.test.ts` — only ~2.5KB headroom, so cut before adding):

- product staging: "the subject fills 30–60% of frame; under ~15% reads as a
  speck in a void";
- value hierarchy as distinct from WCAG legibility (focal = highest contrast);
- ghost-word restraint; one worked example of a correct endpoint-bound
  topology graphic;
- overlapping-action defaults referencing the C1/C2 vocabulary once it exists.

### WS-I — Vision critic for the taste tail

The genuinely-unrepresentable residuals (semantic graphics, hierarchy, clipped-
accident vs depth, motivated background shifts) are exactly what a human wrote
into PROBE_FEEDBACK by looking at strips. Automate that seat: a bounded
vision-model pass over `strip.png` + `blocking.png` at the existing continuity-
critic seam (≤5 directives, applied as patches under full QA, kill-switch, any
failure keeps the pre-critique draft — same discipline as the GLM critic).
This is the only path to the taste tail; do it AFTER WS-0/A/B so the critic
isn't spending its directives on mechanizable classes.

## 4. Live-probe protocol for this session

- Continuity graph ON (`SLACK_SEQUENCES_CONTINUITY_GRAPH=1`). Use
  `npm run sequence:check --workspace @sequences/slack -- --render …` (no Slack
  creds needed); treat exit + `status-report.json` as the result; a requested
  render with no non-empty MP4 is a FAIL.
- Start ONE probe early (background); review strip + blocking + MP4; fix-first
  on any attempt. Then one probe after each workstream lands. Vary briefs
  across motion profiles and both light and dark treatments (light exposes E1).
- Free replay before paying again: `storyboard:replay`, `continuity:replay`,
  `temporal:replay`, `render:existing`.
- Known parcelpilot classes (2026-07-10, mid-fix at handoff — verify before the
  first probe): `interaction_seek_instability` (QA v21 now compares
  cursor-to-anchor relationship), `camera_blocking_landing` occupancy 30% > 24%
  cap on a stat target, `contrast_aa` 1.09:1 at a payoff, rescue-rung
  `invalid_inline_script_syntax`. If any reappear they are host-side — fix in
  QA/blocking compiler, not by re-prompting.
- **Fixed 2026-07-10 evening (verify probes 1–2, PROBE_LOG has full rows):**
  `camera_blocking_landing` now judges ENSEMBLE phrases by the framing
  station's contract (subject-solo range only binds on collapse);
  `deriveDiveWindows` extends the held window for a covered payoff's
  `OUTCOME_HOLD_SEC` before the pull-back; the component kit survives inline
  SVG siblings (`classString`); a single-station camera path is never a late
  plugin "arrival"; storyboard cache contract v23. The operator can now audit
  every rendered probe (video + strip + blocking overlay + attempt table) in
  the Studio **Probes tab** (`npm run studio` → Probes).
- Fresh art evidence for WS-A/E from the same probes: verify-1 lateral-entry
  is the void classic (tiny app window drifting a lavender bloom for 6.5s);
  quillsign's light treatment washes out (pale-gray contract copy on white),
  inverts to a strong dark "signed" scene whose toast is microscopic, and
  clips its closing sub-headline at the frame edge. The wallpaper staging
  patterns (WS-A1b) are the highest-leverage single fix for all of these.

## 5. Docs cleanup charter (fold into WS-F6)

- CLAUDE.md 934 → ~250 lines: keep the durable map (bots, isolation,
  determinism, delivery, MCP, verification); move the dated 2026-07-0x
  changelog into ROADMAP/history.
- ROADMAP.md: split live tasks from history (`docs/history/CHANGELOG.md`).
- Merge FALLBACKS.md into SENTINEL.md (one layer model, one flag table).
- Fix stale references: `SENTINEL_PLAN.md` is cited ~10× in source + 16× in
  docs but lives in `docs/history/` — repoint to SENTINEL.md.
- `AGENTS.md` stays a pointer to CLAUDE.md, nothing more.
- Archive PROBE_FEEDBACK entries once their classes are fixed and logged.

## 6. What success looks like

- A live create publishes **clean** (not `published-degraded`) with ≤2 source
  attempts, and its strip shows: no frame under the composition floor, no
  >1.5s dead window outside declared holds, every declared morph executed or
  re-planned (not silently degraded), one coherent entrance grammar per scene,
  and light-treatment films with visible tonal hierarchy.
- The owner can watch the MP4 without pointing at a single "why is that tiny
  thing floating in nothing" frame.
- Normalizations per film trend DOWN (classes become unrepresentable), not up.

## 7. Deliberately left open (SOL Ultra: exercise judgment)

- Exact thresholds for 0c/0d/A3/E1 — calibrate against the golden film + the
  2026-07-10 strips; advisory-first always.
- B1's placement (camera island vs new island) — study the seek-safety and
  filter-on-world landmines first.
- Which G3 recipes matter most for the demo brief.
- Anything here contradicted by fresh probe evidence — evidence wins; update
  this file and PROBE_LOG as you go. You will find failure classes this audit
  didn't; the fix-first mandate covers them regardless.
