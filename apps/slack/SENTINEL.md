# Sentinel — correctness, fallback, and feature-control contract

Read this before adding an authoring gate, rule, repair, or fallback. This is
the one live document for correctness ownership, fallback diagnostics, budgets,
and feature switches. The executable sources of truth are
[`src/engine/sentinel.ts`](src/engine/sentinel.ts) and
[`src/engine/featureFlags.ts`](src/engine/featureFlags.ts).

## Thesis

Move every mechanically decidable obligation off the model. A violation should
be unrepresentable, host-emitted, or deterministically repaired before a paid
model is asked to try again. Gates are never loosened: Sentinel changes where an
obligation is enforced, not whether it matters.

The host owns the document chassis, scene wrappers/visibility, stage geometry,
paused timeline and registration, seek semantics, plan islands, runtime bytes,
and compile seams. The model still authors scene interiors. Missing interior
bindings therefore remain representable, but the recovery order is host
scaffold → scene-slot repair → deterministic reconciliation → named gate → paid
retry.

## Fallback contract

A fallback is any path where the authored film is replaced or degraded by host
behavior. Not every fallback changes quality.

### Prep-mode switch

`SLACK_SEQUENCES_ALLOW_DETERMINISTIC_FALLBACK` controls the visible model-free
proof film:

| Value | Behavior | Use |
| --- | --- | --- |
| `0` | Fail loud. Slack receives the diagnostic and the project gets `FAILURE.md`; no replacement film is published. | Prep and paid probes, so every failure is inspectable. |
| `1` / unset | Publish the labeled deterministic proof film after storyboard/source recovery is exhausted. | Judge-facing Railway sandbox. |

Before judging, set the Railway value to `1` or remove the prep override, then
redeploy. Frame-design failures always fail loud because brand direction cannot
be fabricated honestly.

### The five classes

| Class | Meaning | Policy |
| --- | --- | --- |
| **A. Visible proof film** | `buildFallbackComposition` replaces exhausted storyboard/source authoring with the labeled model-free reel. | Keep the audience safety net; eliminate its causes. |
| **B. Equivalent in-process resilience** | A failed stdio MCP operation repeats the same mutation/preview/render/undo in process. | Preserve it; this is receipt-level resilience, not a visual fallback. |
| **C. Recoverable paperwork** | A valid film misses an exact binding, known asset, host island, or ordering detail. | Own at L0–L2; it must not burn a paid attempt. |
| **D. Honest soft degradation** | An optional enhancement becomes a truthful executable analogue, or late polish becomes advisory. | Keep artifacts accurate and record `published-degraded`. |
| **E. Render/delivery degradation** | Chrome/FFmpeg/render failure leaves a valid thumbnail result in the Slack delivery path. | Preserve two-tier delivery; diagnose infrastructure separately. |

### Recoverable-paperwork catalog (class C)

The Sentinel registry is authoritative for individual normalizers. This table
records reusable seams. Walk the placement tree before adding a row; schema or
scaffold ownership is cheaper than another source regex.

| Seam | Symptom | Current owner |
| --- | --- | --- |
| Interaction/cut/camera bindings | `data-part` / `data-region` near miss | Exact-id, unique-semantic, or exact-name reconciliation; ambiguity blocks. |
| Missing component carrier | Declared component lacks its part/kind binding | Bind the sole exact-id/kind/unique-semantic candidate; never steal a bound sibling. |
| Incomplete rows/chart/progress markup | Typed beat has no revealable kit interior | Inject canonical neutral structure on exactly one empty root and record degradation if it ships. |
| Hallucinated host-kit asset | Model references a nonexistent `sequences-*.vN.js/css` sibling | Strip non-staged references; the host reinjects canonical kits/runtimes. |
| Runtime absent/misordered | `SequencesX is not defined` at bind | Canonicalize referenced runtime tags after GSAP and before the authored timeline. |
| Model-authored host island | Plan/runtime bytes disagree with the locked storyboard | Strip every model island and inject the canonical host plan/runtime. |
| Infinite repeat / dead selector / syntax artifact | Determinism lint or guaranteed GSAP no-op | Repair only mechanically certain repeats, literal dead selectors, and unambiguous syntax. |
| Volunteered bridged cut cannot bind | Optional object/shape match lacks safe endpoints | Degrade truthfully; brief-required effects remain blocking. |
| Moment/timing paperwork | Typed evidence exists but declaration arithmetic misses | Top up or retime from that evidence under atomic revalidation. |
| World station geometry | Missing layout, static-flow station, or sparse default cell | Derive cells, complete positioning, or tighten `fitScale`; adopt only after browser non-regression. |

If recovery is exact and content-free, repair it. If two reasonable choices
exist, or the brief explicitly requires the effect, keep it blocking rather
than ship a lie.

## Layer model

Every obligation lives at exactly one layer, at the lowest number that can own
it.

| Layer | Owner | Mechanism | Failure cost |
| --- | --- | --- | --- |
| **L0 — schema** | Structured response / typed plan | Enums, shapes, bounded fields, host-only vocabulary absent from model schema | Zero; invalid output cannot become a plan. |
| **L1 — scaffold** | Host composition | Scene chassis, stage, component/station carriers, plan/runtime seams, environment | Zero; host code and contract tests. |
| **L2 — normalize** | Deterministic transforms | Delete, degrade, retime, rebind, lower, or complete without inventing creative content | Zero paid attempts. |
| **L3 — static gate** | Plan/DOM/source analysis | Typed audits, linkedom, kit markup, invariant lint | Cheap storyboard/source retry. |
| **L4 — browser gate** | Measured truth | Geometry, pixels, interaction, temporal change, eye trace, framing, composition, continuous motion | Expensive; prefer scene-scoped repair. |
| **L5 — model retry** | Bounded authoring ladder | Scene repair, minimal-edit retry, rescue model | Paid attempt; last resort. |

Prompt prose is for creative judgment the model must internalize: hierarchy,
rhythm, energy, semantic storytelling, and silhouette choice. A mechanical rule
at L3+ that could be L0/L1/L2 is a Sentinel violation.

### Placement decision tree

```text
New obligation: “X must hold or the film is wrong.”
│
├─ Can schema make the violation unparseable? .............. L0
├─ Can the host emit X so the model never authors it? ....... L1
├─ Can deterministic code fix it without inventing content?  L2
├─ Is it decidable from the plan/static DOM/source? ......... L3
├─ Does it require measured pixels/geometry/timing? ......... L4
└─ None of the above ........................................ L5
```

Never add a prompt rule plus a post-hoc gate without recording why L0–L2 cannot
own it.

## Feature-addition protocol

1. Write the obligation as one sentence.
2. Place it with the tree above and document any skipped lower layer.
3. Register the owner in `src/engine/sentinel.ts`. The closed-world test fails
   on an emitted finding prefix or persisted canonical runner signature with no
   owner.
4. Keep prompt additions inside `test/promptBudget.test.ts`; delete prose made
   redundant by host ownership before adding craft guidance.
5. Add a minimized regression. For deterministic recovery, prove both that the
   exact case recovers and an ambiguous case remains blocking.
6. Choose honest degrade versus block: optional and mechanically replaceable may
   degrade; required or ambiguous work blocks.
7. Run the relevant unit/browser ladder and the plan-authorized paid probe. Log
   attempts and evidence in `PROBE_LOG.md`.

## Executable registries

### Finding/obligation registry

`src/engine/sentinel.ts` is the exact contract table. Each row records id,
group, layer, blocking policy, finding prefixes, prompt cost, proof, and the
reason that layer owns it. `test/sentinel.test.ts` scans emitted findings and
fails when a class is unregistered.

Blocking policies are:

- `impossible`: schema/scaffold makes the violation unrepresentable;
- `deterministic-repair`: L2 corrects it without a paid attempt;
- `blocking`: the attempt is rejected;
- `advisory-late`: strict polish pressure early, honest advisory on the final
  rung;
- `advisory`: measured evidence/ranking only, never a publication veto.

Representative current ownership (not a substitute for the source registry):

| Layer | Representative registered classes |
| --- | --- |
| L1 | scene stack, camera-world/station carriers, component roots, host plan islands, component settle bloom |
| L2 | source bindings/islands, camera budget/retime/landing/connective schedule, station positioning/size, component trim, morph twins, recipes/plugins/assets lowering, brand base, markup completion, finite repeats, dead tween/syntax repair |
| L3 | camera energy, component complexity/exits, cut coherence, pacing, moments, liveness, display-type budget, recipe/plugin/asset/kit/frame contracts |
| L4 | cut degradation/outgoing liveness, camera framing/blocking, interaction truth, 24×14 sparse framing, 32×18 composition floor, washout, temporal moments, eye trace, stale assets, continuous jerk/reversal/settle, rendered quiet/dead windows, runtime invariants |

### Host-contract registry

`src/engine/hostContract.ts` supplies one shared adapter shape:
`ContractResult {ok, findings, warnings, repairs}`, canonical runtime
version/file/source/hash/injection, and optional parse, validation, kit, plan
injection, and staging hooks. It currently registers interaction, cut, camera,
continuity, component, time, FX, asset, and environment. The runner still owns
execution order; the registry does not silently add publication gates.

### Feature/environment registry

`src/engine/featureFlags.ts` classifies every source-read
`SLACK_SEQUENCES_*` name as a behavior switch or explicit operational input.
The source-scan test fails on both unclassified reads and stale registrations.
Call sites may be migrated incrementally; classification, values, default,
owner, description, and rollback must land together.

## Normalization and retry discipline

Storyboard normalizers run before validation and must preserve load-bearing
moments. A normalization commits only when full revalidation clears or reduces
the model's existing finding classes without minting a new class. Otherwise the
host restores the model artifact. Every committed transform is logged,
telemetried, and rendered into `STORYBOARD.md`.

Order is load-bearing. Camera/moment/component retimes, connective scheduling,
world-layout completion, plugin/asset lowering, recipe reconciliation, and
moment top-up must not be casually reordered. Pin a replay before moving an
existing normalizer.

A rejected storyboard returns the exact rejected plan plus findings and asks
for a minimal edit. A scene-scoped repair may replace one whole-plan attempt
when findings name repairable scenes; otherwise the primary/rescue ladder
continues. Source slots use the same principle: repair named scenes while the
slot map is valid, then escalate to full-document work only when necessary.

## Budgets

These values are tested or source-owned; update documentation and tests in the
same change when a constant moves.

| Budget | Current value | Owner |
| --- | --- | --- |
| Storyboard ladder | 3 primary + 2 independent rescue attempts; one eligible scene repair can replace a whole attempt | `requestStoryboardPlan` |
| Source ladder | 3 attempts + independent source rescue | `authorCompositionLoop` |
| Repair edits | ≤16 exact patches | `MAX_REPAIR_PATCHES` |
| Whole-document segments | ≤3 | `MAX_AUTHOR_SEGMENTS` |
| Storyboard reasoning output | 30,720 tokens | `REASONING_STORYBOARD_MAX_TOKENS` |
| Scene-repair output | 16,384 tokens | `STORYBOARD_SCENE_REPAIR_MAX_TOKENS` |
| Authored document | 38,000 characters | `COMPOSITION_SOURCE_BUDGET_CHARS` |
| Base director prompt | ≤40,711 bytes | `test/promptBudget.test.ts` |
| Assembled slot-author prompt | ≤45,000 characters | `test/promptBudget.test.ts` |
| Full camera moves | `1 + floor(sceneSec / 3.5)`; ≤2 whips per film | `pacingAudit.ts` |
| Marginal pacing stretch | ≤1.5s, within the scene cap | `MAX_PACING_STRETCH_SEC` |

## Telemetry and degradation honesty

Per-job `planning/sentinel-run.json` records stage wall time/attempts, logical
and physical model requests, hedge launches, prompt/completion sizes, findings
by layer, normalizer tags, slot calls, scaffold coverage, tier-1/tier-2 time,
and disposition (`published`, `published-degraded`, `fallback`, `fail-loud`).

Anything visible that ships through a degradation must prevent a clean label:
least-bad selection, moment salvage, interaction quarantine, neutral kit
children, optional cut degradation, browser-infra bypass, or other registered
fallback. `npm run sentinel:report --workspace @sequences/slack -- <dir>`
aggregates runs; failed calls and hedges count toward physical cost.

## Behavior-switch table

This is the only documentation flag table. The typed registry is authoritative
for exact parsing and operational (non-feature) inputs.

| Flag | Default / values | Effect and rollback |
| --- | --- | --- |
| `SLACK_SEQUENCES_ALLOW_DETERMINISTIC_FALLBACK` | on; `0` off | Publish the labeled proof film after creative exhaustion; `0` fails loud. |
| `SLACK_SEQUENCES_ASSETS` | on; `0` off | Expose/inject host parametric assets through plugin rails. |
| `SLACK_SEQUENCES_COMPOSITION` | `audit`; `0/off`, `audit`, `block` | Whole-frame composition floor; use `audit` for report-only calibration. |
| `SLACK_SEQUENCES_CONCEPT_PASS` | on; `0` off | Cached concept/arc pass before storyboard expansion. |
| `SLACK_SEQUENCES_CONTINUITY_GRAPH` | on; `0` off | Entity continuity and graph-owned camera blocking; `0` restores legacy camera ownership. |
| `SLACK_SEQUENCES_CONTINUOUS_MOTION` | on; `0` off | Collect continuous focal/settle/quality evidence. |
| `SLACK_SEQUENCES_CREATIVE_CRITIC` | on; `0` off | Run the guarded post-author critic. |
| `SLACK_SEQUENCES_CRITIC_SKIP_CLEAN` | on; `0` off | Skip critic for pristine/stagnant banked drafts; `0` restores always-run eligibility. |
| `SLACK_SEQUENCES_CRITIC_SLOT_REPAIR` | on; `0` off | Route fully scene-named critic work through slot repair. |
| `SLACK_SEQUENCES_CUT_DISCOVERY` | on; `0` off | Upgrade mechanically proven cut rhymes. |
| `SLACK_SEQUENCES_DIRECTION_SCORE` | on; `0` off | Let automatic camera/FX consumers use the direction score. |
| `SLACK_SEQUENCES_ENVIRONMENT` | on; `0` off | Inject/stage the host-owned living canvas/environment. |
| `SLACK_SEQUENCES_EYE_TRACE` | `block`; `0/off`, `audit`, `block` | Measure eye-trace continuity; `audit` removes strict pressure. |
| `SLACK_SEQUENCES_HEDGED_REQUESTS` | on; `0` off | Allow bounded delayed duplicate provider requests. |
| `SLACK_SEQUENCES_INTERACTION_QA` | `block`; `audit`, `block` | Interaction-time enforcement; `audit` reports only (no off path). |
| `SLACK_SEQUENCES_PLUGINS` | on; `0` off | Lower/inject parameterized host generators. |
| `SLACK_SEQUENCES_QA_CACHE` | on; `0` off | Reuse successful byte-identical browser-QA evidence. |
| `SLACK_SEQUENCES_RECIPES` | on; `0` off | Retrieve, reconcile, and inject proven recipes. |
| `SLACK_SEQUENCES_RENDER_SUPERSAMPLE` | `auto`; `0` off, `auto`, `1` forced | 2× master + Lanczos downscale; auto limits to HD. |
| `SLACK_SEQUENCES_SENTINEL_SKELETON` | on; `0` off | Emit host scene/component/camera scaffolds; `0` restores bare shells. |
| `SLACK_SEQUENCES_SENTINEL_SLOTS` | on; `0` off | Scene-addressable authoring/repair; `0` restores whole-document path. |
| `SLACK_SEQUENCES_SHAPE_HINT` | on; `0` off | Run the bounded structural shape selector. |
| `SLACK_SEQUENCES_SHARED_PLANNING_CACHE` | on; `0` off | Reuse validated planning artifacts across sibling jobs. |
| `SLACK_SEQUENCES_STORYBOARD_SCENE_REPAIR` | on; `0` off | Replace one eligible whole-plan retry with locked-envelope scene repair. |
| `SLACK_SEQUENCES_TEMPORAL_JUDGE` | on; `0` off | Render before/mid/after moment evidence and detect static promises. |
| `SLACK_SEQUENCES_USE_MCP` | on; `0` off | Use stdio Sequences MCP; `0` selects the diagnostic in-process path. |
| `SLACK_SEQUENCES_VISION_CRITIC` | on; `0` off | Attach bounded strip/blocking PNGs to the critic; `0` retains text-only critique. |

Model selection, reasoning effort, timeouts, directories, hedge budgets, rescue
models, and numeric thresholds are explicit operational inputs in
`OPERATIONAL_ENV_REGISTRY`; they are not independent feature switches. Do not
add a raw `SLACK_SEQUENCES_*` read without classifying it in that registry.

## Diagnosing a fail-loud run

The same report appears in the Slack error, project `FAILURE.md`, and
stderr/Railway logs. Under `<projectDir>/planning/`, inspect:

- `author-run.json` for attempt modes, normalized finding signatures, and
  strategy changes;
- `attempts/author-<n>-<outcome>.*` and
  `attempts/storyboard-<n>-<outcome>.*` for rejected artifacts;
- `sentinel-run.json` for layer/cost/degradation accounting;
- `STORYBOARD.md`, `motion-plan.json`, and `build/qa/` for the accepted plan and
  measured evidence.

Useful no-new-model replays:

```powershell
npm run storyboard:replay --workspace @sequences/slack -- <raw-response-file>
npm run continuity:replay --workspace @sequences/slack -- <project-dir-or-id>
npm run temporal:replay --workspace @sequences/slack -- <project-dir>
npm run render:existing --workspace @sequences/slack -- <project-dir>
```

For a new class: reproduce, place it at the lowest layer, implement the exact
owner, add the recoverable/ambiguous regression pair, register it, run the
relevant ladder, and log paid evidence. Never turn a gate down to make a probe
look green.
