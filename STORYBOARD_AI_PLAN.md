# Storyboard → AI ("Copy for AI") — post-rewrite research plan

> **Status — June 21, 2026:** the current serializer, automatic Studio planning
> context, and MCP planning context are implemented. Semantic spatial encoding,
> continuity diffs, and multimodal frame export remain future work. This work
> is now scheduled after the Phase 1.5 UI rewrite so the storyboard's role in
> the new preparation/planning flow is designed first.

> How the storyboard becomes the agent's best reference for what the motion
> should look like. The storyboard is a *reference, not a specification* —
> the agent uses it to choose archetypes, layouts, slots, and motion
> primitives from the lattice; it never copies coordinates verbatim.
> Companion to SEQUENCES_MASTER_PLAN.md Part II §8.5 / Part III §10.

## 0. Where we are after the Phase-1 polish pass (June 11, 2026)

The serializer (`workspace.ts → storyboardToText`) already emits, per frame:

```
Storyboard (frames are sequential beats of the video; sketch coordinates are
on a 1280x720 canvas, origin top-left):

Frame 1 - Opener - note: punchy start
  - freehand sketch (3 strokes)
  - rectangle at (262, 105) size 298x322
  - text "Ship faster" at (180, 96) - intent: this is the hero headline
  - media asset "dashboard-shot" at (480, 110) size 360x220
  - MOTION PATH: the media asset "dashboard-shot" moves from (520, 420)
    to (980, 180) via (760, 220) during this beat - intent: settle softly
```

What landed this pass: a **fixed 1280×720 virtual stage** (coordinates are
now machine-independent), the **Motion Path tool** (explicit movement intent,
attached to a target element), arrow/line endpoints, and comment-forward
serialization. It rides along automatically with every `/api/agent/plan`
brief (capped at 4000 chars) and via the **Copy for AI** button.

## 1. Honest assessment: would the AI understand today's output?

Partially. What works and what doesn't:

| Signal | Today | Agent value |
|---|---|---|
| Beat count + frame names/notes | ✓ | High — maps 1:1 to scene planning |
| Comments ("intent:") | ✓ | Highest — explicit human intent |
| Motion paths | ✓ (new) | High — explicit movement direction |
| Media references by asset id | ✓ | High — ties sketch to the real pool |
| Text content | ✓ | High — copy candidates for slots |
| Raw shape coordinates | ✓ | **Low** — "rectangle at (262, 105) size 298x322" is ambiguous: a screenshot placeholder? a card? a button? The model must guess, and px values don't map to anything in its output vocabulary |
| Composition/grouping | ✗ | Missing — no "left half vs right half", no containment, no reading order |
| Frame-to-frame continuity | ✗ | Missing — the strongest motion-design signal there is |

The core insight: **the planner's output space is archetypes + layouts +
slots + token primitives.** The storyboard encoding is good exactly to the
degree it speaks that vocabulary. Raw geometry forces the model to do the
translation itself; a deterministic serializer can do it better, for zero
tokens, every time.

## 2. The plan (iterative — each step is independently shippable)

### v2.0 — Semantic spatial encoding (deterministic, zero-token) ← start here

Replace raw px with the layout language the compiler already uses:

- **Grid mapping.** Project the 1280×720 stage onto the same 12-column grid
  + thirds as `layout.ts`. Emit `"rectangle spanning cols 3–8, upper third,
  large (23% of frame)"` instead of `(262, 105) size 298x322`. Keep one
  numeric anchor (percent of frame) for disambiguation.
- **Role classification by heuristics** (pure functions over the element
  list, unit-testable):
  - image element → media placeholder (already have the asset id);
  - rect/ellipse *containing* a text element → labeled card / button
    ("rectangle card containing text 'Start free'");
  - text ranked by font size *relative to other text in the frame* →
    headline / subhead / caption;
  - ellipse or freehand loop *around* another element → emphasis ring on
    that element;
  - plain arrow between two elements (not a motion path) → relationship
    pointer ("arrow from the headline to the dashboard media").
- **Reading order.** Sort elements by (row-band, x) and emit them in that
  order; say so in the header. Order ≈ choreography rank.
- **De-noise.** Freehand strokes stay a count; collapse overlapping
  near-duplicates; drop sub-2%-of-frame shapes unless commented.

Where: all inside `storyboardToText` + helpers in `workspace.ts`. Add table
tests with hand-built boards (the motion-path test in `workspace.test.ts` is
the pattern).

### v2.1 — Motion semantics & frame-to-frame diffs (the big one)

- **Motion path summarization.** Beyond from/via/to: direction ("rightward,
  rising"), curvature ("gentle arc" / "straight" / "S-curve"), distance as %
  of frame width, and a *suggested* primitive: "closest lattice motion:
  enter.slideIn (from-left) or camera panAcross". Suggest, never prescribe —
  the line should read "use as reference; pick the closest primitive on the
  lattice".
- **Continuity detection.** Match elements across consecutive frames (same
  `sequenceAssetId`, same text string, or same element id if duplicated
  frames): emit a `TRANSITIONS Frame 1 → Frame 2:` block per frame pair:
  - "the dashboard media persists, moving from left half to right third and
    growing ~2x" → match-cut / continuity intent;
  - "the headline exits; the stat '12,480+' enters in its place" → beat
    handoff.
  This turns the storyboard from a list of *states* into a list of
  *transformations* — which is what motion design actually is, and what the
  planner needs to choose enter/exit/camera primitives well.

### v2.2 — The image channel (multimodal tier)

Text can't carry composition nuance; a picture can. Excalidraw ships
`exportToCanvas`/`exportToBlob` in the bundle we already vendor:

- On plan submission, export each non-empty frame to a PNG (downscaled,
  ~768px wide) server-side via the storyboard sidecar + a small
  `/api/storyboard/frames.png` endpoint, or client-side at save time into
  `storyboard-frames/` next to the sidecar.
- `anthropic-api` / `openai-api` providers attach the frame images to the
  plan request alongside the text serialization. CLI providers (the no-key
  default path) stay text-only — the text encoding therefore remains the
  canonical, always-available form, and the images are a bonus channel.
- The text block stays authoritative for ids ("Frame 2 = the attached image
  #2; asset ids in the text are the ground truth").

### v2.3 — Token-optimized encoding + prompt contract

- **Budget with priorities.** Replace the blunt 4000-char slice with
  priority-ordered emission: frame notes + comments > motion paths +
  transitions > media/text elements > shapes > freehand counts. Trim
  lowest-priority lines first, never mid-frame.
- **Structured compact form** for large boards (a YAML-ish block instead of
  prose) — also the foundation for the agent *writing* storyboards back
  (plan §8.5 Phase 2), since a structured form round-trips.
- **An explicit usage contract in the prompt header**, e.g.:
  > "The storyboard is the user's drawn intent. Honor explicit comments and
  > motion paths closely; treat geometry as composition guidance, not pixel
  > truth. Frames map to sequential beats (≈ one scene each) unless a note
  > says otherwise. Always choose the closest archetype/layout/primitive
  > from the catalog — never invent off-lattice values."
- **Evals** (plan Part II §9): ~10 canonical storyboards with expected plan
  properties (beat count, the asset placed in the right scene, slide
  direction matching the motion path). Run on every serializer/prompt
  change.

### v2.4 — Round-trip & richer comments (later)

Agent-written storyboards for the user to edit; structured comments (named
transitions between frames, easing words mapped to ease tokens). Out of
scope until v2.0–v2.3 are proven by the evals.

## 3. Previously identified gaps

1. **MCP parity — completed:** `get_planning_context` includes storyboard text,
   so external agents and the Studio plan from the same drawn intent.
2. **"Copy for AI" UX:** the copied block should include the §2.3 usage
   contract header so a paste into any chat works standalone.

## 4. What we deliberately do NOT do

- No LLM-based "storyboard understanding" preprocessing pass (a model
  summarizing for another model) — it burns tokens, adds nondeterminism,
  and the deterministic encoder + image channel covers it (the
  deterministic/agent boundary, plan Part V §3).
- No pixel-faithful reproduction of the sketch in the output video — the
  storyboard biases choices on the lattice; the lattice keeps quality.
- No new sidecar format — `storyboard.json` stays; everything here is
  serializer + prompt + provider plumbing.

## 5. Suggested order after the UI rewrite

1. Confirm the storyboard's place in the rewritten preparation/planning flow.
2. Add the standalone usage-contract header to Copy for AI.
3. Build v2.0 semantic spatial encoding + tests.
4. Build v2.1 continuity diffs + motion summaries.
5. Extend the existing eval harness for storyboard plan properties.
6. Add the optional image channel for API providers.
7. Add priority-aware token budgeting and a compact structured form.
