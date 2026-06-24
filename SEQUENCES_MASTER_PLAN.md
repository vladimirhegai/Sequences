# SEQUENCES — Master Technical Plan (Compiled)

> **Current status — June 21, 2026:** Phase 1 is implemented and verified.
> The current product priority is **Phase 1.5: a complete Studio UI rewrite**
> before Phase 2. This document remains the long-range architecture and
> research plan, but implementation facts belong to `CURRENT_STATE.md`, and
> the active interface plan belongs to `UI_REWRITE_PLAN.md`. Historical Phase
> 1 estimates and technology choices below are preserved for rationale; where
> they conflict with current code, the current-state document wins.

*An open-source, agent-first motion graphics editor for SaaS & app product video, built on HyperFrames.*

> **What this document is.** A single compiled reference assembling the full Sequences plan plus all follow-up analysis (the six deep-dive questions, the pre-implementation review, and the plugin/website-designer decisions). It is organized as: **Part I** — synopsis & analysis; **Part II** — Phase 1 (the Foundation), with the accepted review amendments folded in; **Part III** — Phase 2 (quality pass & missing features); **Part IV** — Phase 3 (enhancements & launch); **Part V** — a reference section holding the technique deep-dives so they're findable in one place. Architecture is described in prose throughout. All facts were verified against the June 2026 state of HyperFrames, GSAP licensing, Qwen-Image-Layered, Claude Code/MCP auth, and the competitive landscape.

---

# PART I — SYNOPSIS & ANALYSIS

## 1. What Sequences is, in one paragraph

Sequences is a local-first motion graphics studio where an agent can create a
structured first pass and a visual editor lets the human revise it
non-destructively. It is aimed at **SaaS / app product motion design**—launch
promos, feature reveals, app previews, changelog videos, and demo overlays. It
compiles a typed **scene graph** to HyperFrames HTML and renders locally. The
model plans and selects from a human-authored motion system
(tokens → primitives → archetypes → profiles); deterministic code performs
materialization, scheduling, validation, compilation, and rendering.

## 2. Verified ground truth (June 2026)

- **HyperFrames is the current rendering substrate.** The repository pins its
  npm packages at `0.6.86` and verifies the emitted composition with
  HyperFrames' own linter. Compositions use HTML timing attributes; the
  Sequences render path combines browser capture with FFmpeg. Claims about
  upstream adoption, catalog size, or popularity require separate current
  verification and are not architectural assumptions.
- **HyperFrames already includes a visual studio package** (a "visual composition editor UI"). This confirms the decision to **not extend it**: its model is "edit the HTML composition," whereas Sequences' model is "edit the scene graph; HTML is a compile artifact." Reuse only `core` / `engine` / `producer` / `player`.
- **GSAP is now 100% free, including all formerly-paid plugins (SplitText, MorphSVG, DrawSVG, ScrollTrigger, Inertia) and commercial use** — Webflow made it free as of April 30, 2025. **However**, the new Standard License contains a "Prohibited Uses" clause covering tools that let users *visually build animations without code* in a way that competes with **Webflow's web-animation building**. Sequences builds *videos*, not website interactions, so it almost certainly falls outside the clause — Webflow's own FAQ says they "want to encourage developers to build on top of GSAP, including visual tools that don't directly compete." **Action items:** (a) keep GSAP strictly behind the primitive interface so the runtime is swappable to WAAPI/Motion (MIT) in days; (b) before any commercial/hosted launch, send Webflow the one-line clarification email their FAQ invites. A Phase-3 checkbox, not a Phase-1 blocker.
- **Image-layer decomposition remains a research candidate.** Qwen-Image-Layered
  is one model family to evaluate, but suitability for UI screenshots,
  licensing, deployment cost, latency, and correction UX must be verified
  against the exact version selected before implementation.
- **Animated product demonstrations are a plausible product need.** Sequences
  is built around the hypothesis that small product teams value repeatable,
  editable launch and feature videos. Conversion effects are not assumed and
  need to be measured for specific channels and audiences.

## 3. Market research

### 3.1 The buyer

Wedge persona: **indie hackers, solo SaaS founders, small product/marketing teams (1–10 people) with zero motion designers.** Jobs-to-be-done, in observed priority order: (1) launch video for Product Hunt / X (15–45s, screenshots + headline beats + logo sting); (2) feature-release clips for changelog/social (5–20s, recurring weekly/monthly); (3) App Store / Play Store preview videos (strict specs); (4) landing-page hero video / background loop; (5) demo overlays — screen recordings enhanced with zoom/pan, callouts, captions. Constraints: no After Effects skills, no agency budget per launch, need *brand consistency across repeated videos* (underweighted by every competitor — the recurring use case is feature clips, not the one-off launch film), and need edits in minutes when copy changes.

### 3.2 The competitive map (June 2026)

- **Browser motion editors (Jitter, ~$24/mo):** real keyframe motion design, nice templates — but still manual; the user *is* the motion designer; no agent; subscription.
- **Screen-recording polish (Screen Studio $89 macOS, Screenhance):** effortless auto-zoom on recordings — but only works on recordings; no compositional motion graphics; macOS-only.
- **3D device mockups (Rotato):** beautiful device renders — one trick, not an editor.
- **Agentic text-to-video SaaS (Agent Opus, Leadde):** prompt → finished video, brand kits — but closed, credit-priced, **no real editor** (when output is 90% right you regenerate and pray); motion is template-grade.
- **Generative video (Veo, Sora 2, Kling, PixVerse):** cinematic novelty — but uncontrollable, bad text, can't show *your actual UI* pixel-accurately, expensive per second.
- **Code-video frameworks (Remotion, HyperFrames + coding agent):** full control, deterministic — but code-only, no tweak loop for non-devs, LLM-authored motion has no taste; Remotion has paid company licensing.
- **Pro tools (After Effects):** everything — but weeks to learn, expensive, overkill.

### 3.3 The actual gap (honest read)

The product hypothesis is that **agent-assisted first passes + deterministic
motion constraints + a real visual editor + local rendering** form a useful
combination. This is not assumed to be an uncontested market category.
Differentiation must be demonstrated through output quality, editability,
iteration speed, and user preference.

### 3.4 Reality check on "virality is guaranteed"

It is not, and planning as if it is will hurt. Repository popularity and
launch engagement are uncertain. The product should be evaluated through
usable-output quality, revision speed, retention, and direct user feedback
rather than assumed virality.

## 4. Why this is not "Remotion + Claude Code" — the five separators (also the README pitch)

1. **Constrained motion space.** A coding agent writing raw GSAP explores an unbounded space where 99% of points are ugly. Sequences quantizes it: every duration, easing, distance, stagger is a *named token*; every animation a *named primitive*; every scene an *archetype instance*. The agent's job collapses from "author animation code" to "select and parameterize" — retrieval, not generation. Quality becomes a property of the system, not the sample.
2. **The non-destructive tweak loop.** "Make the headline bigger" with Claude Code means re-reading and rewriting HTML — slow, token-expensive, occasionally destructive. In Sequences it's one typed command on the scene graph (`SetTextStyle`), recompile in <300ms, full undo. Direct manipulation (drag a clip, scrub a value) costs **zero** tokens.
3. **A deterministic critic.** Every compile passes a zero-token motion linter (readability budgets, simultaneity caps, stagger enforcement, easing whitelist, contrast checks) with auto-fix. Coding-agent output has no critic except your eyes.
4. **One source of truth, event-sourced.** Agent edits, UI drags, CLI commands are the same operations on the same JSON document, logged. Undo/redo, "revert what the agent just did," and project diffs come free. HTML is a *compile artifact*, never parsed back.
5. **Cost profile.** One expensive plan call per project; everything after is cheap-model or zero-token (§6). A Claude Code session iterating on a 30s video routinely burns 50–100× more tokens.

## 5. Architecture (described in prose)

Think of the system as a stack of three bands.

**The value layer (what you build), top to bottom.** At the surface sits the Studio UI — four panels: timeline, preview, inspector, agent chat. Every interaction the UI produces is a *typed command*; everything it shows is a *hot-reloaded preview*. Beneath the UI is the canonical artifact: the **scene graph**, a versioned JSON document that is the single source of truth. It is wrapped by a command API and an append-only event log (which is what gives undo/redo and revert). Both the human UI *and* the agent planner mutate the scene graph only through that command API — the agent and the UI are the same operation underneath. From the scene graph, a **pure one-way compiler** produces HyperFrames-conformant HTML plus a GSAP animation module. Between the scene graph and the compiler output sits the **motion design system** (tokens → primitives → archetypes → profiles, plus a choreography solver that schedules intra-scene timing) and the **deterministic motion linter** (validate + auto-fix, zero tokens), which runs after every compile.

**The inherited layer (HyperFrames, Apache 2.0).** `core` (types/parser/linter/adapters), `engine` (headless-Chrome frame capture), `producer` (capture + encode + audio mix), `player` (live preview), plus the shader-transitions package, catalog blocks, and agent skills. Sequences shells out to this; it never reimplements capture or encode.

**The side-cars (separate localhost services, added in Phase 2).** A Python **decomposer** (Qwen-Image-Layered primary; SAM2 + LaMa fallback) and an **audio-analysis** service (onset/beat detection). The core never imports Python; if a side-car is absent, the relevant feature degrades gracefully.

**The one architectural law:** the scene graph JSON is canonical; both UI and agent mutate it only through the typed command API; the compiler is a pure one-way function `Project → HTML`; **generated HTML is never parsed back.** Importing foreign HF HTML is a separate best-effort Phase-3 feature, outside the loop.

## 6. Token economics

Design target: **a full project generation costs under ~$0.15 of BYO-key spend; a tweak under ~$0.002; direct manipulation $0.**

- **Plan** (brief + asset manifest → beat sheet): expensive model, once per project. ~3–6k input (system + catalog *summaries*, not bodies), 1–2k structured-JSON output. The only expensive call.
- **Direction variants** (2–3 alt plans): expensive, shares a cached prefix, +1–2k each, optional.
- **Fill** (slot copywriting, ordering): cheap model, once, ~1–2k in / 0.5–1k out.
- **NL tweak** → commands: cheap model, per tweak, <1.5k in / <200 out.
- **Visual critic** (contact-sheet VLM): cheap multimodal, optional, one image strip + <300 out.
- **Compile, lint, layout, choreography, render:** deterministic code — zero tokens, constant.

Current cost-control techniques include catalog summaries in prompts,
deterministic materialization, structured plan validation, a zero-token tweak
matcher for supported phrases, and scene/layer-scoped tweak context. Provider
cost and cache savings depend on the provider and request path and must be
measured rather than assumed.

## 7. Languages & runtime (final)

- **TypeScript everywhere in the core** — non-negotiable; the substrate (HyperFrames), runtime (GSAP), editor (React), and compile target (HTML/JS) are all JS-ecosystem, so a Rust/Go core buys nothing and costs interop. Strict mode; `zod` schemas as the single source of type + runtime validation.
- **Current monorepo:** npm workspaces, Node ≥22.18, no normal application
  build step, and FFmpeg as a rendering dependency.
- **Current editor:** vanilla JavaScript/HTML/CSS, with React used only for the
  Excalidraw storyboard bundle. The Phase 1.5 rewrite may choose a new frontend
  stack after the workflow and state boundaries are settled.
- **Python only in side-cars:** decomposition (PyTorch, Qwen-Image-Layered) and optional audio analysis (librosa) as separate localhost services with tiny HTTP APIs; core never imports Python; features degrade gracefully if absent.
- **No database.** A project is a directory: `project.json` (scene graph), `events.log` (command journal), `assets/`, `renders/`. Trivially git-able — itself a feature (PR-review your video).

## 8. Index of the research-grade techniques

(Detailed in their phases; implementation sketches in Part V §4. Together they support a credible systems paper: *"Sequences: Taste-Constrained Agentic Motion Design via Token-Quantized Scene Graphs."*)

- **T1 — Token-quantized motion space** (P1): collapse the animation parameter space onto a curated lattice; the agent selects, never authors.
- **T2 — Choreography solver** (P1): deterministic constraint-based scheduling of intra-scene timing (staggers, overlap budgets, settle gaps).
- **T3 — Deterministic motion linter with auto-fix** (P1): codified motion-design heuristics as zero-token compile passes.
- **T4 — Two-tier plan/fill agent with schema-constrained decoding** (P1): one expensive structured plan; deterministic + cheap-model expansion.
- **T5 — Event-sourced bidirectional editing** (P1): human + agent share one typed command algebra; HTML is a build artifact.
- **T6 — Screenshot → animatable layer decomposition** (P2): Qwen-Image-Layered (+SAM2/LaMa fallback) turns flat product images into rigged scenes.
- **T7 — Contact-sheet visual critic** (P2): one cheap VLM call on a tiled frame strip catches the subjective 20% the linter can't.
- **T8 — Beat-aligned retiming** (P2): onset detection → snap scene cuts/motion hits to music, as a constraint pass not a regeneration.
- **T9 — Taste vectors / preference-biased selection** (P2): user tweak history re-weights primitive & token selection priors per brand.
- **T10 — Incremental scene-level compile & render cache** (P2): hash-stable per-scene outputs; only dirty scenes re-render.
- **T11 — FLIP match-cut transitions** (P2): element-correspondence transitions computed from the graph (the "Apple keynote" cut).
- **T12 — Brand kit inference from a URL** (P3): scrape the landing page → colors, fonts, logo, tone → auto brand kit.


---

# PART II — PHASE 1: THE FOUNDATION

**Definition of done:** the §10 demo, recorded. Everything here exists because removing it breaks that demo or is brutally painful to retrofit. The UI may be ugly; the *motion output* may not — Phase 1 must already produce videos a founder would post.

*(The accepted review amendments are folded into the relevant sections below: the MCP planning tools + BYO-agent tier, the zero-token NL fast path and structured brief, the role-typed easings / 65% overlap / one-loud-motion / transform-origin / pre-roll motion rules, the reordering of `maskRevealUp` + `pushIn` to early primitives, and the plugin subsection.)*

## 1. The Scene Graph — full specification

A typed, versioned, validated JSON document. `zod` schemas are the single source of truth; TS types are inferred from them, and the same schemas validate agent output at runtime.

- `Project`: `schemaVersion`; `meta` (width, height, fps 30|60, durationFrames, background token); `brand` (BrandKit: semantic colors primary/surface/text/accent, fonts, logoAssetId); `motionProfile` (the active "vibe," constrains all downstream selection); `scenes[]`; `transitions[]` (keyed by from/to scene id); `audio[]` (music/VO stubs in P1; beat data in P2); `assets[]` (content-hashed ids).
- `Scene`: `id`; `archetype`; `layout` (archetype-defined variant); `startFrame`; `durationFrames`; `slots` (typed content per archetype slot); `layers[]` (materialized from archetype+slots by deterministic layout, with user/agent overrides as sparse patches); `choreography` (ChoreoSpec — entrance order, stagger token, overlap budget; see T2).
- `Layer`: `id`; `type` (text | image | video | shape | group | device, where "device" = framed screenshot); `trackIndex` (→ HF `data-track-index`); `content`; `box` (x,y,w,h in design units + anchor, grid-snapped); `style` (typography/color via brand tokens only); `motions[]`.
- `MotionRef`: `primitive` (e.g. `enter.slideUpSoft`); `at` (scene-in | scene-out | emphasis | {frame}, hooks resolved by the choreography solver); `params` (token references or slot references only — raw numbers are a validation error).

**Invariants (enforced in `validate()`, each unit-tested):** every motion/style/layout numeric is a token reference (a raw `duration: 0.4` anywhere is a hard error — this is T1, what lands agent output in the "good" region by construction); every assetId/primitive/archetype/profile/token resolves against the registry; per track, layer intervals don't overlap and scenes tile the project duration exactly (no orphan frames); slots match the archetype's slot schema (types, required/optional, copy-length budgets, e.g. `headline maxWords: 7`); a project that fails validation cannot reach the compiler.

## 2. The command API & event store (T5)

One mutation pathway for everything: `applyCommand(project, cmd) → { project, inverse }`.

**Complete Phase-1 command set:** `AddScene`, `RemoveScene`, `ReorderScene`, `SetSceneDuration`, `SetSceneArchetype`, `SetSceneLayout`, `SetSlotContent`, `SetTransition`, `AddLayer`, `RemoveLayer`, `MoveLayer` (box), `ResizeLayer`, `SetLayerStyle`, `SetText`, `AddMotion`, `RemoveMotion`, `SwapMotion`, `SetMotionParam`, `SetChoreography`, `SetMotionProfile`, `SetBrandToken`, `AddAsset`, `BatchCommand` (atomic group — what the agent emits).

Properties: every command returns its **inverse** (free undo/redo; "revert everything the agent just did" is `undo(batch)`); commands serialize to `events.log` (append-only JSONL — audit trail, crash recovery, time-travel, later collaboration); the agent's MCP tools **are** these commands one-to-one (a UI drag and a Claude Code tool call are literally the same operation — the headline of the architecture); after any command, `validate → compile (incremental) → hot-reload preview`, with a perceived-latency budget of **<300ms** that *is* the product feel — instrument it from day one.

## 3. The Compiler

Pure function `compile(Project) → { html, animation, manifest }`.

1. Emits the HF stage div with `data-composition-id`, `data-width`, `data-height`, fps metadata.
2. Each layer → the right HF element (`div`/`img`/`video`/`audio`) with `data-start`, `data-duration`, `data-track-index` computed from scene offsets. Boxes become absolute-positioned CSS with CSS-variable brand colors (so a brand-token change recompiles styles without touching structure).
3. Each `MotionRef` → lookup primitive implementation → emit GSAP timeline code with token values substituted. All timelines attach to one master timeline driven by HF's frame-seek (what makes capture deterministic — GSAP is seekable by design).
4. Transitions → CSS/GSAP cross-scene timelines or HF's `shader-transitions` blocks for GLSL wipes.
5. **Choreography resolution (T2):** before emission, the solver converts the
   scene's choreography selection, profile defaults, hierarchy ranks, and
   motion durations into concrete frame offsets. The current choreography
   override exposes `stagger`, `settleGap`, and explicit layer `order`; overlap
   comes from the profile and the simultaneity cap from core defaults. The
   solver is deterministic and covered by unit/property tests.

**Incremental compilation:** scenes compile independently and are content-hashed; only dirty scenes re-emit. (Full render caching is Phase 2 — but design the hash boundaries now.)

**Runtime isolation:** primitives emit `GsapStep` data from an `EmitContext`;
the compiler serializes those steps. There is no current `MotionRuntime`
interface. The emission boundary is the existing runtime seam.

## 4. The Motion Design System (T1) — the moat, fully enumerated

### 4.1 Tokens (the lattice)

A single TypeScript token lattice in `packages/core/src/tokens.ts`:

- **Durations (frames @30fps):** instant 6, quick 10, base 16, relaxed 24, slow 36, dramatic 54.
- **Easings (named, hand-tuned):** `snap` (cubic-bezier .2,.9,.3,1 — fast out, soft land), `glide` (.35,0,.15,1), `settle` (overshoot ~3%), `springSoft`/`springTight` (GSAP elastic configs with fixed physics), `linearMech` (mechanical/UI moves), `easeOutOnly` (entrances never ease-in from zero — a codified taste rule).
  - **Amendment (review): easings are role-typed.** Token sets are split by role — `enter.*` easings (fast-out/slow-settle), `exit.*` easings (slow-out/fast-in), `move.*` easings (near-linear middle, short ease both ends) — and the schema forbids cross-role use. (Rationale: pros almost never use symmetric easing.)
- **Distances (% of frame):** nudge 2%, step 6%, travel 14%, sweep 40%.
- **Staggers:** tight 2f, base 4f, loose 7f.
- **Scales:** subtle 1.03, pop 1.12, hero 1.35. Blurs, opacities similarly named.

Six-ish values per dimension is deliberate: small enough to eyeball every combination, large enough for range. *Tuning these by eye is a real, scheduled task for whoever has the best visual taste — budget two full days of just watching renders.*

### 4.2 Primitives (16 implemented; each = code + params schema + probe + one-line summary)

- **Enter:** `fadeIn`, `slideUpSoft`, `slideInDirectional`, `scaleIn`, `maskRevealUp` (clip-path wipe — the highest-taste-per-effort primitive), `blurIn`, `charCascade` (SplitText per-character rise, free now that SplitText is free).
- **Exit:** `fadeDown`, `slideExit`, `scaleAway`.
- **Emphasis:** `pop`, `pulseGlow`, `countUp` (number tween for stat callouts), `underlineSweep`.
- **Continuous:** `kenBurns` (slow scale+drift for screenshots), `floatIdle`.
- **Transitions:** `cutHold`, `crossFade`, `wipeDirectional`, `slidePush`, plus 2 curated HF shader transitions (e.g. `flash-through-white`).

**Amendment (review): `maskRevealUp` and the camera `pushIn` are the first primitives implemented after `fadeIn`** — the two highest signature-look-per-line items; M2's hand-authored demo should feature both. (The `pushIn` camera move belongs to the camera system formally introduced in Phase 2, but its primitive is brought forward so the Phase-1 demo can use it.)

**Current motion defaults:** profiles currently use a 65% overlap budget;
hierarchy ranks influence scheduling; layer anchors affect transform origin; and
the compiler supports entrance pre-roll around overlapping transitions. These
are authored defaults to evaluate, not universal professional rules.

Authoring standard per primitive: implemented against tokens only; params schema (zod); auto-generated 2s preview thumbnail (a CI script compiles a one-layer test scene — these thumbnails feed the picker UI and the future marketplace); a `summary` string for prompt assembly.

### 4.3 Archetypes (7 implemented — the niche, encoded)

`hook-opener` (bold claim text, optional product glimpse), `feature-reveal` (screenshot/device hero + headline + ≤3 benefit bullets; layouts media-left/right/center/full-bleed), `stat-callout` (big countUp number + caption), `ui-walkthrough` (screenshot with sequential callout/zoom beats), `social-proof` (logos row / quote), `logo-sting-cta` (logo + tagline + CTA url).

Each defines: typed slots with copy budgets; layout variants on a 12-column
grid with title-safe margins; default motion assignments per slot per profile;
a visual-hierarchy ranking; and duration heuristics. The seventh archetype,
`stat-chart`, extends the original six-beat vocabulary.

### 4.4 Profiles (3 at Phase-1 exit)

`crisp-saas` (quick durations, snap/glide easings, tight staggers, mask reveals, hard cuts — the Linear/Vercel look), `warm-startup` (relaxed durations, settle easing, fades and soft slides), `bold-launch` (dramatic durations, springs, scale-heavy, shader transitions). A profile is a *selection-bias table*: per archetype-slot, an ordered preference list of primitives + token choices. Deterministic fill walks this table; the planner only picks the profile.

### 4.5 Registry

Extend HF's catalog pattern: every token set, primitive, archetype, profile is a registry entry (`registry.json` + implementation + thumbnail + summary), installable, semver'd. The Phase-1 registry is local/static; remote install is Phase 3. The build step auto-generates the **prompt catalog** (the summaries the planner sees) from registry metadata — one source of truth from code to prompt.

## 5. The deterministic motion linter (T3) — full Phase-1 rule set

Runs as code after every compile; each rule is severity × autofix? × message. Auto-fixes are themselves **commands** (logged and undoable). Unresolved warnings go to the agent or user as plain text.

- `text-readability` — on-screen frames ≥ `12f + 9f×words` (≈180 wpm + entry/exit). Auto-fix: extend scene up to archetype max, else warn.
- `simultaneity-cap` — ≤3 layers with overlapping active animation windows. Auto-fix: re-run solver with larger stagger.
- `stagger-required` — sibling entrances ≥ `tight` apart. Auto-fix: apply profile stagger.
- `settle-gap` — ≥ `quick` hold between last entrance end and first exit start. Auto-fix: extend duration / compress entrances. (Floor raised per the "two-frame hold before a cut" pro rule.)
- `easing-whitelist` — only token easings in emitted code. Hard error (compiler bug if it fires).
- `safe-area` — text inside title-safe margins (5% inset). Auto-fix: nudge box.
- `grid-snap` — boxes on the 12-col grid ± tolerance. Auto-fix: snap.
- `contrast` — text/background ≥ WCAG 3:1 using resolved brand colors. Auto-fix: swap to brand `text-on-X` pairing, else warn.
- `duration-tiling` — scenes tile project exactly; transitions fit in overlap windows. Auto-fix: adjust trailing scene.
- `copy-budget` — slot text within archetype word budgets. Warn → agent/user shortens.
- `motion-density` — total animation-frames / scene-frames ≤ profile ceiling. Auto-fix: drop lowest-rank emphasis motions.
- `exit-coverage` — every entered layer exits or persists through transition (nothing pops out of existence). Auto-fix: add profile default exit.

## 6. The agent layer (T4) — full pipeline

In prose: the brief plus assets feed the expensive **Plan** call once, producing a beat sheet; the user picks one of 2–3 rendered **directions**; deterministic + cheap-model **Fill** expands the chosen plan into a full scene graph; the compiler runs; the linter validates and auto-fixes; the HF producer renders/previews. NL tweaks and direct edits loop back through the command API and never touch the expensive tier.

- **A — Plan (expensive, once).** Input: brief, asset manifest (filenames + auto-extracted metadata: dimensions, dominant colors, OCR'd headline if a screenshot), brand kit, prompt catalog (summaries). Output via tool call against the **plan schema**: ordered beats, each `{archetype, layoutHint, slotContent | slotContentDirective, durationIntent, transitionIntent}`, plus one global `motionProfile` and a music-mood tag. Closed enums everywhere an ID appears, so invalid plans are unrepresentable. Generate 2–3 *directions* by varying profile + opener archetype under a cached prefix; render each direction's **first scene only** as a still/2s clip (cheap). This is the single human taste-injection checkpoint.
- **B — Fill (deterministic + cheap).** Deterministic: archetype → layout → layers; profile table → primitives + tokens; choreography defaults; duration heuristics. Cheap model only for language: tightening copy to slot budgets, ordering bullets, the CTA line. If the user provided full copy, B is 100% zero-token.
- **C/D/E** as in §3/§5; render via HF `producer`.
- **Tweaks.** Cheap model with a tools-only prompt: the command API as tool schemas + the *selected scene's* graph slice. "Make the headline bigger and slow the intro" → `[SetLayerStyle(headline, scale:hero), SetChoreography(scene1, durationsBias:slow)]`. Fallback: if the tweak names nothing selectable, include the compact project outline (~400 tokens).
  - **A zero-token NL-tweak fast path.** A deterministic phrase matcher handles
    supported requests such as size, speed, profile, and motion changes; the
    provider path is the fallback. Coverage must be measured from real usage.
- **Provider abstraction.** `Provider` interface (messages + tool-calls + caching hints) with Anthropic + OpenAI implementations; BYO key stored locally; model-tier mapping in config.
- **MCP server (Phase 1, not later).** Expose `plan`, `applyCommands`, `getProjectOutline`, `getScene`, `renderPreview`, `lintReport` over MCP, plus a Sequences skill in the `vercel-labs/skills` format HF already uses.
  - **Amendment (review): two MCP planning tools for the BYO-agent tier** (see Part V §7): `get_planning_context()` (returns brief schema, asset manifest, brand kit, prompt catalog — the same summaries the internal planner sees) and `submit_plan(plan)` (validated against the plan schema; rejected plans return structured errors the external agent self-corrects from). These let a user's own Claude Code / Codex session perform the *plan* step, billed to the subscription they already pay for. Quality enforcement is identical because the plan schema + validator + deterministic fill do the work regardless of which brain plans.

**Amendment (review): a structured-brief form alongside freeform briefs.** A structured form (product name, 3 features, CTA, vibe slider) makes the plan near-deterministic for the standard promo — the expensive call becomes optional, used only for freeform briefs. Offer both entry points. (Shifts work deterministic-ward per the Part V §3 priority.)

**Prompting standards (Phase 1):** system prompts versioned in-repo with golden-output tests (snapshot the plan for 5 canonical briefs; assert schema-valid + beat-count sanity on every prompt change); few-shot examples are *real* plans from the examples directory; all numeric taste lives in the catalog, never in prose.

## 7. Plugins in Phase 1

**Plugins are not new infrastructure — they are the registry entries.** A primitive, archetype, profile, or token set is each a folder with implementation + params schema + thumbnail + summary + version. The Phase-1 "plugin system" is the discipline of making your own built-in content go through that exact format (dogfooding). If `enter.maskRevealUp` ships as a first-class registry entry rather than hardcoded compiler logic, then the marketplace, `sequences add`, and community contributions later are packaging problems, not architecture problems.

**Purposes plugins serve, in priority order:** (1) keep the core small and the taste curated — core ships ~10–14 excellent primitives; everything niche lives outside core where it can't dilute the default look (curation *is* the moat, and the plugin boundary enforces it); (2) grow the agent's vocabulary without growing prompts — each plugin adds one summary line to the catalog, so capability scales at near-zero token cost (the most underrated purpose); (3) the contribution surface — "write a primitive, get it merged" is how an OSS community forms; (4) future marketplace optionality (Phase 3 thinking — don't build for it now).

**Plugin types Phase 1 supports (the first four only):** **primitives** (the workhorse), **archetypes** (highest community value long-term), **profiles** (cheap to author, big perceived variety), **token sets** (rare; a "broadcast" or "lo-fi" feel). *(Phase 2+ adds effect overlays, export presets as data, asset providers, side-car capabilities.)*

**Concrete plugins to ship in Phase 1, beyond core:** wrap three things from HyperFrames' existing catalog as Sequences plugins — two shader transitions, the `data-chart` block as a `stat-chart` archetype, and a device-frame block. This proves the wrapper path ("HF catalog → Sequences plugin") with real third-party-ish code.

**Two hard contract rules (write them in from day one):** (a) plugins must be **token-pure** — a primitive that hardcodes `duration: 0.4` fails CI; it gets only tokens and params; (b) plugins must **pass the linter against a probe scene** in CI and ship an auto-rendered thumbnail. **Explicit Phase-1 non-goal:** no dynamic third-party code loading, no sandboxing — plugins are compiled into the project's HTML, so third-party plugin code is arbitrary code execution in the render. That security surface stays closed until the registry goes remote in Phase 3, and even then via review-gated publishing rather than sandboxing.

## 8. The minimal editor shell — UI at Phase 1

Honest description: **functional, dense, unstyled-but-tidy.** Default dark theme, system font, four fixed panels, no chrome animation polish.

In prose: a large **preview** area (HF player, fit-to-panel, play/pause/scrub, frame counter) occupies the top-left; a **timeline** runs along the bottom-left (scenes as blocks with archetype icon + name; layers as rows beneath the expanded scene; drag edges = duration, drag block = reorder); a right column holds the **inspector** (selected layer/scene: text, box, motion dropdowns, token pickers) above the **agent chat** (brief box, direction picker, tweak input).

Phase-1 UI rules: every interaction routes through commands (no cheating); selection syncs preview↔timeline↔inspector; Cmd-Z works everywhere; the direction picker (3 thumbnails after planning) is the only "designed" moment. DOM-based timeline is acceptable in Phase 1 (canvas rewrite is Phase 2); virtualize nothing yet.

## 8.5 The application shell — Main Menu + the seven workspace pages *(amendment, June 2026)*

The studio grows from a single editor screen into a **DaVinci Resolve–style application**: a project launcher in front, and a single top-bar tab strip that switches between seven workspace pages. The Phase-1 goal is the *foundation* — every page exists, has its real layout and interaction skeleton, and the load-bearing ones are genuinely usable; the polish pass is Phase 2.

**The Main Menu (project launcher).** Shown before any project opens, DaVinci-project-manager-inspired and deliberately calm: the title "Sequences" up top, a grid of project cards (poster thumbnail where available, name, last-modified) drawn from a local **project library** directory, with folders for organization. Bottom-right: three buttons — **New Project** (prompts for a name), **New Folder**, **Open** (path to any existing project). The bundled demo promo is always pinned in the list. The launcher is a front-end over the same `/api/project/*` endpoints the Project menu already uses — no second pathway.

**The seven pages**, left to right in the tab strip, with their phase assignments:

1. **References** *(shell in P1 → finished in P3).* A pinboard for inspiration: website references, motion-graphics examples, example projects. Phase 1 ships the layout only (non-functional, honest empty states); real capture/import lands in Phase 3 alongside the brand-from-URL machinery it shares scraping plumbing with.
2. **Media** *(core in P1 → polished in P2).* A DaVinci-style media page: a disk **file browser** on the left, a **viewer** (image/video/audio playback) center-top, and the **media pool** along the bottom with a folder ("bin") tree on its left. Drag from disk or browser into the pool to import; import copies the file into the project's `assets/` and registers it through an `AddAsset` command (one pathway, undoable). Everything else in the app — slot pickers, the Design and Storyboard pages, agent briefs — references pool assets by id.
3. **Design** *(core in P1 → Figma-like in P2).* A curated motion-design asset editor, not a general drawing app: shapes, gradients, text, SVG output. Phase 1 ships the deterministic core (select/draw/edit tools, fill/gradient/stroke properties, save-to-media-pool as SVG). Phase 2 layers on the generative half: own-skill asset creation, external import, Qwen layer separation, generative fills — the Scene Designer (§Part III 9) is its archetype-authoring sibling, not the same surface (Design makes *assets*; the Scene Designer makes *layouts*).
4. **Storyboard** *(core in P1 → agent-integrated in P2).* Pre-production sketching organized as **frames** (beats of the final video): freehand drawing, basic shapes, text, media placed from the pool, and **comments** attached by double-click — the comment is the user's intent annotation for the agent. The storyboard is a sidecar document (`storyboard.json`), *outside* the scene graph (it describes intent, not output), with a deterministic **storyboard → text serializer** so the planner can take it as reference today. Phase 2: token-optimized storyboard encoding, the agent *writing* storyboards back for the user to edit, and richer comments (curves, named transitions between frames).
5. **Timeline** *(P1, exists).* The current editor: agent panel, viewer, multi-track timeline, inspector. Phase 2 direction: more agent-forward — the agent asks, offers clickable options, "less is more."
6. **Render** *(simple in P1 → presets in P3).* Delivery page: render settings on the left (format, quality, workers), the rendered output playing on the right, a read-only scene strip and render history below. Export presets (§Part IV 1) slot in here later.
7. **Extensions** *(project skill list in P1 → marketplace in P3).* The skills & plugins surface. Phase 1 ships a working **per-project skill list**: every registry entry (primitive/archetype/profile/camera) is a card the user can enable or disable for the current project, persisted on the canonical graph as `project.extensions.enabled` (a `SetEnabledExtensions` command — undoable, shareable with the project). This is not cosmetic: the planning context, the plan prompt, and the inspector pickers all expose **only enabled** extensions, and plans/commands that reference a disabled extension are rejected. The point is agent focus — too large a vocabulary confuses the planner, so scoping the skill list per project is real motion-direction control, and a sharable skill list is the on-ramp. Disabling never uninstalls: disabled entries still render in existing scenes (so an inherited or shared project always plays). Phase 3 grows this same page into the storefront over a remote registry — browse/install community skills & plugins, stars, and AI-assisted authoring — once the registry goes remote.

**Rules that keep this from becoming scope creep:** pages that mutate the project do it through commands (Media imports, Extensions enable/disable via `SetEnabledExtensions`, future Design/Storyboard→scene flows); pages that don't (Storyboard sketching, Design canvas state before export) persist as sidecar files and never touch the scene graph; References stays a non-functional shell until its phase arrives — no half-features.

**CLI (parallel surface on the same packages):** `sequences init | plan "<brief>" --assets ./shots | preview | render | tweak "<nl>"`. The CLI is the demo surface for the developer audience and the CI surface for golden tests.

## 9. Testing & quality gates

- `scene-graph` + `compiler` + `motion-system` + `linter`: heaviest unit coverage; zero UI imports.
- **Golden renders:** ~10 reference projects rendered in CI (HF is deterministic — exact-hash or SSIM compare), mirroring HF's own golden-baseline setup. Catches "someone retuned a token and broke every video."
- **Property tests:** random valid scene graphs → compile → lint must pass post-autofix; choreography solver output always satisfies timing rules.
- **Agent evals:** 15 canonical briefs → plan must validate, beat counts in range, profile distribution sane. Run on every prompt/catalog change.
- Perf budgets in CI: command→preview p95 < 300ms on a reference project; full 20s/30fps render < 90s on a dev laptop.

## 10. Phase-1 milestones (≈ weeks 0–7, parallelizable)

- **W0 — Substrate spike.** HF init → render example MP4; embed player; read `@hyperframes/core` types; write down the exact data-attribute contract. *Exit: one rendered MP4 + a one-page contract doc.*
- **M1 — Spine.** Hand-written scene-graph JSON → compiler → HF HTML → MP4. One scene, one `fadeIn`, one duration token. *The whole architecture in miniature.*
- **M2 — Motion system v1.** Completed with 16 primitives, 7 archetypes,
  3 profiles, choreography solver, live extension previews, and primitive
  probes.
- **M3 — Linter v1.** All 12 rules + autofix-as-commands + report format.
- **M4 — Agent v1 (CLI-first).** Plan → directions → fill → compile → render from one sentence + screenshots. MCP server up (including the two planning tools). *Exit: brief → watchable video, <2 min, <$0.15.*
- **M5 — Editor shell.** Four panels, command-routed, undo, direction picker, NL tweak box (+ zero-token fast path).
- **M6 — Demo week.** Produce, polish, and record the §10 clip; write the README around it.

Team split (if friends join): ① scene-graph+compiler+linter (deterministic core), ② motion-system+examples (**give this to the best visual eye — it's the moat**), ③ agent+CLI+MCP, ④ studio UI.

## 11. The Phase-1 demo (the falsifiable bet)

> Drop in two product screenshots + a brand color + "a punchy 20-second promo for our analytics dashboard." Under two minutes later: a watchable, on-brand promo. Drag a scene longer on the timeline. Type "make the headline bigger and slow the intro." Re-render. All local, open source, no per-render fee — and a second window shows Claude Code driving the same project over MCP.

Record 30–45s. Post it (X + Show HN + r/SaaS). **Gate:** if it visibly outclasses a raw "Claude Code + HyperFrames" side-by-side and gets real engagement, proceed to Phase 2 at full effort. If it lands flat, diagnose (taste layer? demo craft? positioning?) before building more.


---

# PART III — PHASE 2: QUALITY PASS & MISSING FEATURES

**Goal:** go from "impressively good for an agent" to "indistinguishable from a junior motion designer's work" on the niche, and make the app itself feel like a product. Most research-grade techniques land here. Order within this phase = priority order.

## 1. The wow feature: screenshot → animatable layers (T6)

A flat product screenshot or logo becomes a **rigged scene** whose elements animate independently. Pipeline (Python side-car, `decomposer/`):

1. **Primary: Qwen-Image-Layered** (Apache 2.0). Image → N RGBA layers with clean alpha, correct occlusion order, inpainted hidden regions; `num_layers` controllable; any layer recursively re-decomposable. Flat UI/marketing graphics are in-distribution (PSD-trained) — your niche is the model's easy case.
2. **Refinement/fallback: SAM 2 + LaMa.** When Qwen's split is wrong for a region, the user clicks/boxes the element → SAM mask → LaMa inpaints the hole → new layer. Also the path for machines that can't run the diffusion model (or route to a hosted Qwen endpoint, ~8s/image, as the zero-GPU default behind a config flag).
3. **Semantic labeling (cheap VLM, one call):** name each layer ("nav bar", "chart card", "CTA button") and rank visual hierarchy → feeds choreography and lets tweaks say "pop the CTA."
4. **Scene-graph import:** layers land as `image` layers with boxes from alpha bounding boxes, stacked on tracks by occlusion order, hierarchy ranks attached.

**UX contract (the realism clause):** decomposition is presented as *suggested layers* in a review panel (merge / split / re-decompose / discard per layer) before import. Never promise "perfect"; promise "90% there, fix the rest with two clicks."

**What it unlocks immediately:** staggered UI build-ins (dashboard assembles itself), per-element emphasis (the stat card pops on its beat), **2.5D parallax** (layers get depth ranks → subtle differential translate/scale under the virtual camera — the premium look flat Ken Burns can't fake), and background-replaced product shots.

## 2. Virtual camera system

Add a `camera` track: keyframed (token-quantized) pan/zoom/rotate applied as a transform on a stage-wrapper element, with `cameraMove` primitives: `pushIn`, `pullReveal`, `panAcross`, `snapZoom` (whip-zoom with motion blur via directional CSS blur), `orbitSubtle` (fake 3D via perspective + rotateY micro-moves — *deferred to Phase 3 per the review*). The camera is what separates "slides with animation" from "filmed motion graphics," and it's nearly free on a transform wrapper. The solver treats camera moves as first-class scheduled motions (they count against the simultaneity cap; a `snapZoom` during a text entrance is a lint error).

**Amendment (review): camera scripts as archetype data.** A pro reads a screenshot like a cinematographer and decides the camera *journey* (establish wide → push to the feature → punch to the number → release). Encode this as an archetype-level "camera script": 3–4 named camera beats attached to `ui-walkthrough` and `feature-reveal`, whose targets bind to decomposed layer regions (or manual regions). The planner picks which script; geometry is solved deterministically from layer boxes.

## 3. Match cuts & morph transitions (T11)

The "Apple keynote" cut: an element in scene A *becomes* an element in scene B. Because both scenes live in one graph, correspondence is computable — same assetId, same slot role, or explicit `matchHint`. Implementation is FLIP: at transition time, compute first/last boxes, lift the element to a transition overlay track, GSAP-tween box+scale+style between them while the scenes crossfade beneath. Exposed as `transition.matchCut` (auto-detects candidates; the planner can request it; the linter verifies a valid correspondence exists, else falls back to `slidePush`). Used twice per video, it reads as "a designer made this."

## 4. Motion quality deep pass (the technique backlog)

- **Text choreography suite:** SplitText-powered `wordRise`, `lineMaskReveal` (per-line clip-path), `charBlurCascade`; kinetic-type archetype `type-beat` (full-screen word rhythm for hook openers). Rule: per-char only ≤ 4 words (linter), per-word above that.
- **Spring language unification:** all `settle`/`spring*` easings re-based on one underdamped-spring solver (stiffness/damping pairs as the tokens) so every bounce in a project shares physics.
- **Micro-shadows & elevation:** entering cards animate shadow+y together (material "lift"); tokenized elevation levels.
- **Screenshot dressing primitives:** `browserFrame` / `deviceFrame` (CSS device mockups with subtle 3D tilt), `glassPanel`, `gradientMeshBg` (animated brand-colored mesh — the default "nothing supplied" background), `gridFloor` (perspective grid).
- **`uiCursor` primitive:** a synthetic cursor that moves/clicks within a screenshot scene (token-eased, with click ripple) — sells "product walkthrough" without a screen recording.
- **Shader transition curation:** wrap ~6 of HF's shader-transitions as tokenized primitives with profile-gated usage (e.g. `bold-launch` only; `crisp-saas` gets cuts and wipes; the linter enforces profile/transition compatibility).
- **Idle life:** `breathe` (±0.5% scale on hero), `shimmerSweep` on CTAs — sub-perceptual motion that keeps held frames alive. Density-capped by the linter.
- **Color & grade pass:** optional film grain + vignette overlay layer (HF cinematic blocks to borrow), tokenized intensity, profile defaults. *(Deferred to Phase 3 per the review.)*

## 5. Audio: beat sync, VO, captions (T8)

1. **Music ingestion:** user drops a track (or picks from a small CC0 starter pack). Side-car (librosa) or in-browser (Web Audio + onset detection) produces `{bpm, beats[], onsets[], energyCurve[]}` on the audio track.
2. **Beat-aligned retiming as a constraint pass, not regeneration:** a deterministic retimer nudges scene boundaries (±15% duration budget per scene, linter-checked against readability minima) to the nearest strong beat, and aligns `emphasis` motions and `snapZoom` hits to onsets. One toggle: "Snap to beat." Zero tokens. **Constraint (review/Part V §5): sync only cuts + one accent per scene** — syncing everything looks robotic.
3. **Energy mapping:** scene `motion-density` ceilings and stagger choice biased by the local energy curve (quiet intro → relaxed tokens; drop → pop+snapZoom). Deterministic table lookup.
4. **TTS narration + word-synced captions:** lean on HF's existing TTS/transcribe skills; word timestamps drive a `captionTrack` with `wordRise` styling; captions are a first-class archetype slot (also the accessibility story).
5. **Audio mix:** ducking under VO (sidechain-style gain envelope computed offline, applied in the FFmpeg mix HF's producer already does).

## 6. The contact-sheet visual critic (T7)

After compile+lint, optionally render a low-res **contact sheet** (every 12th frame tiled into one image) plus the first frame of each scene at full quality, and make ONE cheap multimodal call with a fixed rubric: composition balance, color harmony vs brand, crowding, awkward mid-states, dead frames. Output: structured findings mapped to scenes, each paired where possible with a *suggested command* (e.g. `SetSceneLayout(s3, "media-right")`). User approves suggestions like lint fixes. Cost: ~1 image + 300 output tokens.

**Amendment (review): ship this opt-in, default-OFF initially.** Measure whether its suggestions get accepted before adding it to the default path — don't let an LLM pass creep back into a loop you fought to keep deterministic unless it earns it.

## 7. Taste vectors — preference-biased selection (T9)

Every accepted manual/NL tweak is already in the event log. Distill it: per project (and aggregated per brand kit), maintain counters like "user replaced `springSoft`→`glide` ×3", "duration overrides skew +20%", "always removes `pulseGlow`". These become **selection-bias weights** consumed by deterministic fill (B-stage) and the profile tables — the next generation for that brand starts where the user's taste left off. No fine-tuning, no embeddings for v1: it's a weighted re-ranking of the profile preference lists, fully inspectable ("Your style: calmer, slower, no glow — reset?"). The most paper-worthy cheap idea in the project: *closing the taste loop through the command log rather than through model weights.*

## 8. Performance: incremental render & preview (T10)

- **Scene-level render cache:** per-scene content hash (graph slice + assets + tokens + profile) → cached frame ranges; a tweak to scene 3 re-renders only scene 3 + adjacent transition overlaps; FFmpeg concat stitches. Typical tweak re-render drops from ~60s to ~5s.
- **Preview proxy mode:** the live player runs the *actual compiled HTML* (free, real-time); "rendered preview" uses 540p fast-encode; full quality only on export.
- **Canvas timeline rewrite:** virtualized canvas timeline with waveform lanes, beat markers, 60fps scrub; thumbnail strips per scene from the render cache.

## 9. The Scene Designer — generative archetype authoring (the website-designer idea, placed correctly)

A compiled Sequences scene is represented with HTML/CSS and a time axis.
The current seven archetypes cover the included demo and planned SaaS-oriented
scene roles, but their coverage of real user needs has not been measured.
Unusual layouts currently require a new archetype or direct implementation.

**The trap to avoid:** making freeform generated layouts a *runtime* path (agent generates HTML per scene, motion applied to whatever it produced) silently rebuilds "Claude Code + HyperFrames" inside the product and forfeits every separator — the solver loses hierarchy, the linter loses slots, tokens have nothing to grip, layouts aren't reusable, quality regresses to per-sample taste, and per-scene layout generation costs hundreds of times an archetype selection.

**The synthesis — an archetype *authoring* tool, not a runtime path.** Call it the **Scene Designer**: an OpenDesign-style generative layout flow whose *output format is a Sequences archetype*, not raw HTML. Flow: user or agent describes a layout → model generates it → a **normalizer** pass converts the result into the archetype contract (boxes on the 12-col grid, typed slots extracted from content, brand tokens substituted for raw colors/sizes, hierarchy ranks inferred from visual weight, portrait variant derived). It must pass `validate()` and the linter's static rules before it exists. From that moment it's just another archetype: the solver animates it, profiles style it, it's reusable across scenes and projects, and it appears in the agent's catalog as one summary line.

**Why this placement wins:** generation happens at design time, once, validated — then the deterministic machine takes over forever. Story: "the AI doesn't just fill templates, it can *make new templates* — which then animate themselves." It compounds: every kept Scene-Designer output is a candidate community archetype; the expensive generation is amortized across all future uses instead of paid per scene. The hard engineering is the normalizer (freeform HTML → archetype contract), ~two weeks because the target schema already exists; forking pieces of OpenDesign for the generation half is a sensible accelerant. Placement: **Phase 2, after decomposition, before or alongside the camera system.** *(Adjacent idea to write down and NOT build: exporting Sequences motion back to websites as GSAP/Lottie — real market, different product, scope trap. Parked in Phase 3's startup surface.)*

## 10. App UI — promoted to Phase 1.5 before Phase 2

The original plan treated major UI quality work as part of Phase 2. The current
decision is to complete the UI rewrite first. This avoids placing decomposition,
audio, camera, critic, and taste controls into an information architecture that
has not yet been validated. See `UI_REWRITE_PLAN.md`; the material below remains
useful design input, not an instruction to preserve the current shell.

Apply the "taste tokens" philosophy to the app itself. Real design system: 8-pt spacing, one display font + one mono, dark-first with brand-accent theming; restrained chrome — the user's video is the hero.

**The workspace pages mature here (per Part II §8.5):** **Media** gets in-app trimming/metadata, waveform previews, and asset dedup; **Design** becomes the Figma-for-motion-design surface — own skills as tools, external import, Qwen-Image-Layered layer separation (sharing the §1 decomposer), generative asset creation — while staying an *asset* editor (layouts belong to the Scene Designer, §9); **Storyboard** gets the token-optimized serialization format, agent-authored storyboards rendered back into the frames for the user to edit, and structured comments (easing curves, named frame-to-frame transitions) that map onto tokens and transition primitives; **Timeline** shifts agent-forward — the agent asks clarifying questions and presents clickable options instead of walls of text, "less is more." References and Extensions remain shells until Phase 3. **Timeline:** scene blocks show live thumbnails + archetype glyphs; layer lanes color-coded by type; beat markers under the ruler; magnetic snapping (beats, scene edges, grid). **Inspector:** token pickers as visual chips with hover-preview (hover `springSoft` → the selected layer previews it live — the feature that makes the motion system *learnable*); motion list per layer as reorderable pills. **Primitive/archetype browser:** searchable grid of auto-generated thumbnails; drag onto a layer/timeline. **Decomposition review panel** (per §1). **Agent panel:** plan progress as a beat-sheet checklist; every agent action rendered as a *diff chip* ("Scene 2: slideUpSoft → maskRevealUp ⤺") with one-click revert — the event store visualized; this is the trust UI. **Command palette (⌘K)** exposing every command + NL fallback. **Onboarding:** a 60-second "first project" flow.

## 11. Phase-2 exit criteria

- A blind side-by-side of 5 Sequences videos vs 5 Jitter-template videos, shown to 10 target users: Sequences preferred ≥ 6/10 (score honestly).
- Decomposition produces accepted layer sets on ≥ 70% of a 30-screenshot test corpus with ≤ 2 manual fixes each.
- Tweak-to-updated-render p95 ≤ 8s; brief-to-first-preview ≤ 90s.
- Beat-snap demo video (music-synced launch promo) recorded — launch asset #2.


---

# PART IV — PHASE 3: ENHANCEMENTS, QOL & LAUNCH

**Goal:** the final polish layer before public launch — remove every paper cut, widen the on-ramp, ship the ecosystem hooks, execute the launch deliberately.

## 1. Quality-of-life features

- **Brand kit from URL (T12):** paste your landing page URL → scrape → extract palette (dominant + semantic via clustering), font families (computed styles), logo (og:image / header heuristics), product name/tagline → pre-filled brand kit + a brief draft. One paste onboarding. (Deterministic + one cheap VLM call to sanity-check the logo pick.)
- **Export presets:** one-click renders for X (16:9 + square), Product Hunt, App Store preview specs (per-device resolutions/durations encoded as data), Instagram Reel/TikTok (9:16 **responsive re-layout** — archetype layouts define portrait variants, so aspect switch is a recompile, not a redesign; a quietly killer feature that falls out of the layout system).
- **Versioning & branches:** named snapshots of the event log ("v1-launch", "v2-shorter"); A/B export both.
- **Project as a single shareable file** (`.sequences` = zipped dir); "open in Sequences" deep link.
- **Template gallery:** 10–15 complete example projects (remixable) — doubles as docs and SEO surface.
- **Keyboard-complete editing**, autosave, crash-safe journal replay, asset dedup, missing-font fallback warnings.
- **Accessibility of output:** caption export (SRT/burned-in), reduced-motion render variant (token table swap — again falls out of the architecture).

## 2. Ecosystem & extensibility

- **Registry goes remote:** `sequences add primitive <name>` against a community index; publishing = PR with thumbnail + summary + tests (CI renders the thumbnail and runs the linter against a probe scene). Curated "core" vs "community" tiers — taste-gate core ruthlessly; the moat is curation, not volume. This is also where third-party plugin code becomes installable, via **review-gated publishing** rather than runtime sandboxing.
- **The Extensions page becomes a storefront (Part II §8.5 #7):** Phase 1 already shipped the page as a working per-project skill list (enable/disable registry entries to scope the agent's vocabulary). Phase 3 turns that same surface into the in-app storefront over the remote registry — browse/install default and community skills & plugins, stars, plus AI-assisted authoring ("describe a primitive, get a token-pure draft that must pass the probe-scene CI"). Because the enable/disable model and the `project.extensions.enabled` contract already exist, this is a content/remote-registry problem, not a layout problem.
- **The References page comes alive (Part II §8.5 #1):** pin websites (sharing the brand-from-URL scraper), motion-graphics examples, and remixable example projects (the template gallery above doubles as its default content).
- **MCP server v2:** project-level tools (`generateVariant`, `retimeToBeat`, `exportPreset`), streaming render progress; documented recipes for Claude Code, Cursor, Codex. Position: *Sequences is the motion-design tool your coding agent already knows how to use.*
- **Skills:** publish Sequences skills to the same `vercel-labs/skills` ecosystem HyperFrames uses — free distribution to the exact audience.
- **Optional generative inserts:** behind a flag, allow a Veo/Higgsfield/etc. clip as an *asset* inside an otherwise deterministic timeline (b-roll slots in `hook-opener`). Never on the critical path; never required.

## 3. Hardening & housekeeping

- GSAP license clarification email to Webflow before any hosted/commercial surface (Part I §2); WAAPI runtime spike (one primitive ported) as proof the seam works.
- HF version pinning + an upstream-drift CI job (compile the golden projects against HF@latest weekly; the compiler is the single contact point, so breakage is contained and visible). **Contribute upstream when you hit genuine engine gaps** (e.g. a frame-capture hook HF lacks) — upstream PRs to a 22k-star repo are résumé gold and build launch goodwill.
- Cross-platform pass: Windows (FFmpeg path quirks), Linux headless; Docker render image for CI users.
- Security: BYO keys in OS keychain; MCP server bound to localhost by default; asset path sandboxing.
- License audit: verify every dependency, model, asset pack, and distribution
  path before release; do not infer compatibility from a project summary.

## 4. Auth & access at Phase 3

- **"Sign in with Claude" OAuth (Tier 2)** lands here. Third-party apps can access Claude through a user's Claude account via OAuth, billed against the subscription's extra-usage credits rather than API billing. Requires registering as a third-party app and handling their flow. (Tier 1 BYO-key and Tier 3 BYO-agent-via-MCP ship in Phase 1 — see Part V §7.) Net: nobody is forced to buy API credits.

## 5. UI at Phase 3

Final coat: micro-interactions on the chrome using your own easing tokens (dogfooding as a design statement), empty states that teach, a polished direction-picker moment (the emotional peak of the flow), in-app changelog, "what did the agent do" session-summary view, plus the deferred `orbitSubtle` primitive and the film grain/grade pass. Nothing structurally new — Phase 3 UI work is subtraction and consistency.

## 6. Launch plan (virality as a sequence of bets, not an assumption)

1. **Asset #1:** the Phase-1 demo clip re-recorded at Phase-3 polish (brief → video → tweak → beat-snap → export presets, 45s).
2. **Asset #2:** the side-by-side — same brief given to (a) Claude Code + raw HyperFrames and (b) Sequences. Let the output difference make the argument.
3. **Asset #3:** "Claude Code edits my launch video over MCP" — targets the agent-tooling audience.
4. Sequenced release: Show HN (the architecture story — "the LLM is a planner, not an author") → X thread with clips → r/SaaS + r/SideProject (the buyer story) → HyperFrames Discord/community (the substrate audience) → a written deep-dive: *"Why LLMs can't do motion design (and how we constrained them until they could)"*.
5. **Honest success ladder:** 500 stars = credible résumé project; 2k = community forms, invest in registry; 10k+ = startup conversation is real.

## 7. Startup surface (deferred, for completeness)

Only if the ladder's top rung is reached: hosted rendering + sharing links, team brand kits with taste-vector sync, comment/review workflow, template marketplace with revenue share, an API ("Sequences Cloud") for programmatic changelog-video generation, and the parked website-export feature (Sequences motion → GSAP/Lottie for landing pages). The OSS local product remains fully functional forever — the trust contract that makes the wedge work.

## 8. Closing analysis — the three things that decide this project

1. **The taste layer is human work.** Tokens, primitives, and archetypes are only as good as the eye that tunes them — the highest-leverage, least-automatable task in the plan. Schedule it like engineering; review renders like code.
2. **The <300ms loop is the product.** Agent quality gets the first wow; the instant, undoable, command-driven tweak loop is why people stay. Protect that latency budget against every feature.
3. **The demo gate is real.** Phase 1 ends with a falsifiable public test. Pass it and the rest is a roadmap. Fail it and the most valuable section becomes the competitive read (Part I §3.3–3.4) — diagnose before building. Either way, the architecture is a strong systems-design résumé story, and that floor is secured by Phase 1 alone.


---

# PART V — REFERENCE: MOTION DESIGN, TECHNIQUE & DECISIONS

*This part collects the deep-dive analysis (the six questions, plus the plugin and website-designer discussions) in one findable place. Nothing here is new scope — it's the reasoning and reference behind the phase plans above.*

## 1. How agents genuinely produce good motion design

Core insight: agents can't have taste, but they can have **judgment**. Taste is knowing what a given easing *feels* like; judgment is knowing "this beat is a stat reveal, so use the stat treatment." LLMs are good at the second. The whole strategy is to move every taste decision into authored code and leave the agent only judgment decisions. Four mechanisms stack:

1. **Semantic selection, not parametric authoring.** The agent never sees numbers — it sees descriptions like "`enter.maskRevealUp` — clean, confident reveal; best for headlines and cards; pairs with crisp-saas." Choosing among 14 well-described primitives is a language task. The catalog descriptions are load-bearing: write them like a senior designer briefing a junior ("use when…", "never with…").
2. **Relationships encoded as constraints, not suggestions.** Most bad motion is bad *combinations* (a spring entrance next to a mechanical wipe; five things landing on one frame). Encode compatibility as data: each primitive carries tags (`energy: calm/punchy`, `weight: light/heavy`, `style: organic/mechanical`); profiles whitelist tag combinations; the linter rejects violations. The agent literally cannot produce the bad combination.
3. **Match cuts as a correspondence problem (solvable deterministically).** A match cut works when elements across a scene boundary share identity, shape class, or position. Score it from the graph: `sameAsset(3.0) + sameSlotRole(2.0) + shapeSimilarity(1.5) + positionOverlap(1.0)`; above threshold → matchCut is *offered*; the agent only says "yes, continuity here." The FLIP tween is pure code. The agent decides *whether*, the system decides *how* — the recipe for every advanced technique.
4. **Clean transitions = three authored rules around the cut.** (a) Exit direction agrees with the next scene's entrance direction (slide-out left → slide-in from right reads as one camera move); (b) transitions need "handles" — the settle-gap rule ensures nothing is mid-animation at the cut; (c) transition energy matches the audio energy curve. All linter/solver rules, zero tokens.

## 2. The common SaaS / commercial motion vocabulary (roughly by frequency)

This list is effectively the Phase 1–2 primitive roadmap, ordered by ROI: (1) mask/clip-path reveals (text rising out of an invisible line — *the* signature SaaS move); (2) slow push-in on a screenshot while elements stagger in (camera + choreography); (3) UI build-in — dashboard assembles itself piece by piece (feeds from decomposition); (4) number count-ups for stats; (5) 2.5D parallax on layered screenshots; (6) cursor-driven walkthroughs (synthetic cursor clicks, UI responds); (7) whip-pans / snap-zooms on beat hits; (8) word-by-word kinetic type for the hook; (9) device/browser frames with subtle 3D tilt; (10) match cuts on the logo or hero element; (11) animated gradient/mesh backgrounds in brand colors; (12) the "feature card cascade" — 3 cards staggering in with lift shadows; (13) underline/highlight sweeps on the key word; (14) logo sting with a single decisive motion + hold.

## 3. The deterministic / agent boundary (the cost discipline)

Rule of thumb: **anything expressible as a rule, table, or solver is deterministic; the agent only does language understanding and creative *selection* under constraints.**

**Deterministic (zero tokens), exhaustively:** layout (archetype grids, box placement, safe areas, grid snap, portrait re-layout); all timing (choreography solver, durations from heuristics, stagger, settle gaps); all motion *execution* (primitive code, easing curves, springs, FLIP math); primitive assignment for standard cases (profile preference tables); transition selection defaults + direction-agreement rules; match-cut correspondence scoring and execution; all linting + auto-fixes; beat detection and snapping; energy mapping; color/contrast resolution; render; caching; undo; taste-vector reweighting; brand extraction mechanics; caption timing from word timestamps; export preset conformance.

**Agent — expensive tier (once per project):** the beat sheet only — interpreting the brief into ordered narrative beats, picking an archetype per beat, picking the one global profile, deciding where a match cut or shader moment *belongs* narratively. Irreducibly a language/judgment task.

**Agent — cheap tier (small, occasional):** copywriting to slot budgets; NL-tweak → command translation; decomposition layer labeling; the optional contact-sheet critic; plan-repair on validation failure.

**Further deterministic opportunities:** expand the measured zero-token tweak
coverage, improve structured-brief planning, and retain provider-result caching
where safe. A complete zero-token project is a hypothesis for constrained
briefs, not a current product guarantee or competitor claim.

## 4. Research-grade technique implementation sketches

- **T1 — Token-quantized motion space.** Current tokens live in `tokens.ts`;
  schemas and registry contracts restrict project references to named values,
  and the compiler resolves those values at emission. The research hypothesis
  is that a constrained vocabulary reduces invalid and inconsistent plans.
  Compare constrained and less-constrained outputs rather than assuming pass
  rates or aesthetic validity.
- **T2 — Choreography solver.** Input = list of (layer, hierarchyRank, motionDuration) + ChoreoSpec. Sort by rank → greedily assign start frames at `prev_start + stagger`, clamping so concurrent-animation count never exceeds the cap (delay until a slot frees) → verify total fits scene duration minus settle gap, else compress stagger one token step or extend duration within archetype max. ~200 lines, property-tested.
- **T3 — Linter.** Each rule is a pure function `(CompiledScene) → Finding[]`; fixes emit Commands (logged/undoable). Architecturally an ESLint: rule registry, severity config, fix pass, report.
- **T4 — Plan/fill.** The plan schema *is* the tool-call schema with closed enums; the expensive call is one tool invocation; fill is a table walk over profile preference lists. Key detail: the **repair loop** feeds validator errors back once to the *cheap* model with the failing slice only — never re-running the expensive call.
- **T5 — Event sourcing.** `applyCommand` is a pure reducer; each command implements `invert(stateBefore)`; the log is JSONL per command; undo = apply inverse, redo = re-apply; snapshot every N events for fast load. The novelty is agent + human sharing one algebra.
- **T6 — Decomposition.** FastAPI side-car; `decompose(image, num_layers?) → RGBA[]` (Qwen-Image-Layered); `refine(image, mask)` (SAM2+LaMa); one VLM labeling call; importer maps alpha bboxes → layers/boxes/tracks. Integration trick: hierarchy ranks from the labeler feed T2's solver, so decomposed scenes choreograph themselves.
- **T7 — Visual critic.** Render every Nth frame at 160px → tile with ImageMagick/sharp → one multimodal call with a fixed rubric returning `{sceneId, issue, suggestedCommand?}[]`; suggested commands validated before display.
- **T8 — Beat retiming.** librosa `onset_detect`/`beat_track` → beats on the audio track; retimer does 1D snapping of scene boundaries to nearest beat within ±15%, then re-runs solver + linter. Pure, togglable, diffable.
- **T9 — Taste vectors.** Reduce the event log: count tweak patterns keyed by `(context, from, to)` → a weights map per brand → deterministic fill multiplies profile preference scores by these weights before ranking. Inspectable JSON, resettable. No ML.
- **T10 — Render cache.** `hash(sceneSlice + resolvedTokens + assetHashes + compilerVersion)` → keyed directory of frame ranges; FFmpeg concat-demuxer stitch; transitions force re-render of overlap windows on both sides.
- **T11 — FLIP match cuts.** Correspondence scoring as in §1; at compile time, the matched element is cloned to a transition track spanning the boundary, GSAP tweens box/scale/borderRadius/color between measured first/last states while scenes crossfade under it.
- **T12 — Brand-from-URL.** Headless fetch → extract CSS custom properties + computed font stacks + k-means on a screenshot for palette + og:image/logo heuristics → one cheap VLM sanity check → BrandKit.

## 5. The professional motion designer's technique inventory (mapped to implementation)

Each is a token, primitive refinement, solver rule, or linter rule — **none requires the agent to get better.** That is the validation of the whole architecture: professional technique is mostly *codified discipline*.

- **Easing asymmetry.** Entrances fast-out/slow-settle; exits slow-out/fast-in; UI near-linear middle. → role-typed easing tokens (`enter.*`/`exit.*`/`move.*`), cross-role use forbidden by schema. *(In Phase 1 §4.1.)*
- **Overlapping action / no dead air.** Next entrance begins at ~60–70% of the previous one. → solver default 65% overlap budget. *(Phase 1.)*
- **Hierarchy of arrival.** `hierarchyRank` gives the solver an authored signal
  for scheduling hero and support elements. “One loud motion per scene” is a
  Sequences default to evaluate, not a universal rule or quantified share of
  professional quality.
- **Anticipation & follow-through.** Big moves get a 2–3 frame counter-move and an overshoot+settle. → baked into primitives (`slideUpSoft` optional 2-frame dip; `pop` overshoot), profile-gated (`crisp-saas` skips, `bold-launch` uses).
- **Motion blur on fast moves.** Whip-pans/snap-zooms need directional blur. → CSS `filter: blur()` keyframed along the velocity peak, axis-aligned; intensity tied to distance token; only on `sweep`-distance moves (linter rule).
- **Scale from the right origin.** Card from center, tooltip from its arrow, menu from its trigger. → `transform-origin` in the layer box/anchor model; archetypes set it per slot. *(Phase 1.)*
- **The two-frame hold before a cut.** Cutting mid-settle feels cheap. → raise the settle-gap floor. *(Phase 1 linter.)*
- **Secondary motion an order quieter than primary.** Background mesh drifts at ~1/10 foreground speed; idle breathing ±0.5%. → tokenize "motion volume" per track depth; linter checks the ratio.
- **Counters never linear.** Count-ups ease out hard, snap to the exact final value. → encoded in `countUp`.
- **Color discipline in motion.** One element changes color at a time; brand accent appears in motion exactly where attention should go. → linter rule: ≤1 concurrent color animation; accent-colored motions count as "loud."
- **80/20 of music sync.** Sync *cuts* and *one accent per scene*; let the rest float (syncing everything looks robotic). → constrain the beat retimer to scene boundaries + the rank-1 emphasis motion only. *(Phase 2 §5.)*
- **Read the screenshot like a cinematographer.** Decide the camera journey (establish → push → punch → release). → archetype-level camera scripts bound to decomposed layer regions; planner picks, geometry solved deterministically. *(Phase 2 §2.)*

## 6. HyperFrames: build-around, don't fork (decision)

**Build around it. Do not fork. Do not maintain patches.** HF is two months old, moving fast, HeyGen-funded, with its own golden-test infra; a fork absorbs their maintenance burden and loses their improvements, and patches make every upstream release a rebase chore during the one summer you can't afford one. Everything you'd "specialize" lives naturally *above* the engine (tokens, primitives, archetypes, solver, linter, compiler); HF's "HTML in, deterministic MP4 out" contract is general by design and you want it boring and stable. The compiler being the single point of contact is the whole drift-containment strategy; forking destroys it. **The "motion-graphics-specialized HyperFrames" you imagined *is* Sequences — a layer, not a fork.** Refinements: contribute upstream on genuine engine gaps (résumé gold + goodwill); pin HF versions hard + the weekly drift-CI job. The only case that justifies a fork is HF abandonment or a hostile license change — and Apache 2.0 means you can fork *then*, with full history. That's the insurance policy you don't pay for up front.

## 7. Auth & access tiers (don't force API keys)

Support three tiers; the third is architecturally the most interesting.

- **Tier 1 — BYO API key.** The power-user and CI path. (Phase 1.)
- **Tier 2 — "Sign in with Claude" OAuth.** Third-party apps can access Claude through a user's Claude account via OAuth, billed against the subscription's extra-usage credits rather than API billing. A Pro/Max subscriber authorizes Sequences directly. Requires registering as a third-party app and handling the flow. (Phase 3.)
- **Tier 3 — Bring-your-own-agent via MCP (ship in Phase 1, nearly free).** Inverts the architecture: the user's existing agent (Claude Code / Codex app) becomes the planner and Sequences is a headless tool server. Claude Code users add it with one command; planning calls bill to the subscription they already pay for. Requirement: the MCP surface must let an external agent perform the *plan* step, via `get_planning_context()` and `submit_plan(plan)` (validated, structured errors for self-correction), plus `apply_commands`, `lint_report`, `render_preview`, and a Sequences skill teaching the workflow. Because the plan schema + validator + deterministic fill enforce quality, it doesn't matter whether the brain is your embedded provider call or the user's session. Honest caveat: Tier-3 quality varies with the user's model and prompt-cache economics differ — mitigate by making the validator's repair feedback unusually descriptive (your only lever over external agents). **This is a risk to keep on the register.** The Codex app similarly supports plan sign-in + MCP, so one server covers it.

Net: Phase 1 ships Tier 1 + Tier 3; Tier 2 lands in Phase 3. Nobody is forced to buy API credits.

## 8. Plugins (full discussion)

**Plugins are the registry entries** (primitive / archetype / profile / token set — each a folder with implementation + params schema + thumbnail + summary + version). The Phase-1 "plugin system" is the discipline of routing your own built-in content through that format. **Purposes:** keep core small and taste curated; grow the agent's vocabulary at near-zero token cost (one summary line per plugin); provide a low-friction contribution surface; future marketplace optionality. **Phase-1 types:** primitives, archetypes, profiles, token sets (effect overlays, export presets, asset providers, side-car capabilities come Phase 2+). **Ship beyond core in Phase 1:** two HF shader transitions, the `data-chart` block as a `stat-chart` archetype, a device-frame block — proving the "HF catalog → Sequences plugin" wrapper path. **Two hard contract rules:** token-purity (no hardcoded numbers; CI-enforced) and lint-pass-against-a-probe-scene + auto-thumbnail in CI. **Phase-1 non-goal:** no dynamic third-party code loading / sandboxing — plugin code compiles into the render (arbitrary code execution), so that surface stays closed until the registry goes remote in Phase 3, gated by review rather than sandboxing. *(Detailed in Phase 1 §7.)*

## 9. The Scene Designer (full discussion)

A scene *is* a webpage, so generative layout is a natural generalization of archetypes and solves the bespoke-10% ceiling. **But it must be an archetype *authoring* tool, not a runtime path** — freeform per-scene HTML generation rebuilds "Claude Code + HyperFrames" internally and forfeits every separator (solver loses hierarchy, linter loses slots, tokens lose grip, layouts aren't reusable, quality regresses, cost explodes). The synthesis: an OpenDesign-style flow whose output is *normalized into the archetype contract* (grid boxes, typed slots, brand tokens, hierarchy ranks, portrait variant), validated by `validate()` + the linter before it exists — after which it's just another archetype that animates itself. Generation happens at design time, once, and amortizes across all future uses; kept outputs become candidate community archetypes. Hard part is the normalizer (~2 weeks; target schema exists). Forking pieces of OpenDesign accelerates the generation half. **Placement: Phase 2** (after decomposition, before/alongside the camera system). *(Detailed in Phase 2 §9.)*
