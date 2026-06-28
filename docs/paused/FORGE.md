# FORGE.md - Forge Component Workshop

> Working notes, not a contract. Canonical engine rules live in
> [CLAUDE.md](CLAUDE.md).

Forge is not After Effects and it is not a motion-engine debugger. Forge is where
AI helps make editable product UI assets, choreographs them into genuine motion
snippets, and packages those snippets as Sequences Extensions.

The center of gravity:

1. Stage creates high-quality SaaS UI assets.
2. Create choreographs saved assets with Hyperframes.
3. Export packages the finished Extension for Sequences.

The chrome follows [LINEAR_DESIGN.md](LINEAR_DESIGN.md): near-black canvas,
four-step surface ladder, hairline borders, and one lavender-blue accent
(`#5e6ad2`) reserved for primary actions, active state, focus, and selection.

## Product Shape

Forge has four tabs: Library, Stage, Create, Export.

### Library

Library is the media pool:

- File view: read-only disk browser; drag or double-click to import.
- Viewer: previews selected disk files or pool assets.
- Bins: folders under `assets/`.
- Media pool: imported draggable media cards and saved Components.

Every import copies bytes into the document workspace and registers them through
the same `AddAsset` command pathway used by the engine.

### Stage

Stage is where the AI builds assets: React/JSX or plain HTML/CSS/JS product
interfaces, dashboards, cards, search/results views, panels, and mini app
screens. These assets are not final motion sequences. They are clean source
surfaces for Create.

- Agent: chat-first pane with provider/model/thinking controls and reference
  chips. Drag media or docs into the composer to pass them as context.
- Viewer: renders the generated asset inside the Forge preview runtime.
- Inspector: shows only public knobs, actions, and named parts declared by the
  asset.
- Media pool: the same Library pool, available for drag references.

The Stage agent is built around the Create handoff: granular named parts, useful
knobs, triggerable actions, deterministic states, and polished SaaS front-end
design.

### Create

Create is the Hyperframes authoring surface. It will use saved Stage assets,
media, motion-design context, and reference material to build showcase-worthy
motion snippets that export as Sequences Extensions.

- The viewer has Preview/Code and delivery aspect ratios.
- The inspector shows snippet name, selected assets, public knobs, named parts,
  saved component library, and the media pool.
- The Create agent is wired: it compiles structured timelines into token-pure
  Hyperframes skeletons, runs a deterministic motion critic, validates against
  component contracts, and produces `.seqext` draft bundles. See "Current AI
  Status" and "Forge Create Full Plan" for what is shipped vs. still planned.

### Export

Export turns Create snippets into the Sequences handoff:

- Pick or review the current Create Extension draft.
- Fill export name, primitive kind, summary, and optional lifted GSAP source.
- Review bundle id, slots, tokens, guardrails, and validation output.
- Export a `.seqext` bundle with standardized placeholders, never the user's
  real media bytes.

## Current AI Status

Stage AI is wired for the current Forge pass. It generates and iterates
self-contained UI assets, renders them, extracts a deterministic contract, drives
Inspector tweaks/actions, and saves assets into the component library.

Create's motion-authoring agent compiles structured timelines directly into
token-pure Hyperframes skeletons (`createDraft.ts`), validates part/action/knob
references against component contracts, and runs a deterministic motion critic
(`createCritic.ts`) that enforces the MOTION BAR — concurrency cap, one loud beat,
transform/opacity preference, and a hard determinism/no-network gate — instead of
trusting the prompt prose. The critic is **stagger-aware**: a coherent cascade
counts as one stream, so the signature metric-cascade is never flagged as busy.

Authoring beyond `fromTo/to/from/set`: `op:"count"` compiles a data-moment number
counter into a token-pure `custom` StepTemplate (the value is promoted to a token),
so the data-moment route can actually count. Because a `.seqext` primitive is
content-agnostic and single-layer, a **peer stagger** of ≥3 distinct subjects
collapses on export to the reusable per-subject primitive (the solver reproduces
the cascade across layers); the full multi-subject version stays in the preview,
and Create surfaces an info note explaining the gap.

Component intake is contract-first: the Create prompt sends each component's
parts/knobs/actions every turn but full source only for components new to the turn
(established draft components send the contract alone), and it derives a
`foregroundAnalysis` so Create knows which part is a movable subject vs. backdrop —
it refuses to apply 3D/translation to a backdrop-only component (the parallax bug).

Split-text/per-char reveals, stagger-across-children, asset search, full showcase
preview scoring, and Export's AI metadata fill are still future work.

## Stage Orchestrator

```text
chat message + references
   |
   | resolve media to file paths, markdown docs to clipped text
   v
stagePrompt.ts
   | compact role, canvas rules, Forge contract, Hyperframes handoff
   | retrieved skill snippets from stageKnowledge.ts
   | on-disk playbook/source paths for deeper reads
   v
provider.complete() or provider.streamComplete()
   | strict JSON { reply, asset:{name,html,css,js,react?,capabilities?} }
   | SSE progress for providers that can stream
   v
stageRunner.ts
   | small-edit ops? apply them deterministically with stageTweak.ts
   | else: compile React TSX when present
   | detect/infer GSAP + Tailwind capability
   | polish pass with stagePolish.ts
   | extract contract from HTML/CSS/JS/React source
   v
preview iframe + forge runtime + optional React runtime + optional GSAP + optional Tailwind
   |
   v
Inspector tweaks/actions/parts + Save to library
```

### Prompt And Context

The Stage prompt is intentionally token-light:

- Referenced images/SVGs are passed as absolute file paths for local CLI agents
  to inspect. They are never base64-inlined.
- Markdown docs are inlined, clipped, and treated as reference material.
- `stageKnowledge.ts` retrieves a few relevant sections from the local skill
  corpus instead of dumping huge files into the prompt.
- Full source guidance stays on disk under `apps/forge/knowledge/` so local CLI
  agents can read deeper only when needed.

The retrieved corpus includes:

- `stage-ui-design.md`;
- anti-slop design skills: `impeccable`, `make-interfaces-feel-better`,
  `design-taste-frontend`;
- Forge-tuned `shadcn-stage`;
- typography, surfaces, performance, animation, and React-in-Stage guidance;
- Forge-specific GSAP Stage notes;
- the checked-in GSAP guidance snapshot under
  `apps/forge/knowledge/source/gsap/`.

Retrieval strips YAML frontmatter and skips harness-only sections such as a
skill's `## Setup` or `Commands`.

### Output Modes

The default output is plain HTML/CSS/JS:

```json
{
  "reply": "Built the search command surface.",
  "asset": { "name": "Search command", "html": "...", "css": "...", "js": "..." }
}
```

React/JSX is supported when structure or state benefits from it:

```json
{
  "asset": {
    "name": "Pipeline dashboard",
    "html": "<div id=\"forge-react-root\"></div>",
    "css": "...",
    "react": {
      "rootId": "forge-react-root",
      "tsx": "function App(){ return <main data-forge-component=\"root\" /> }"
    },
    "js": "",
    "capabilities": { "react": true }
  }
}
```

Forge compiles TSX with `reactCompile.ts`, preserves the original TSX on the
saved object, and renders it with `static/forgeReactRuntime.js`. The local
runtime supports function components, JSX, `React.useState`, `useEffect`,
`useMemo`, `useRef`, and `ForgeReact.useForgeVar(name, fallback)`. No imports,
exports, CDN, or ReactDOM render call are needed.

GSAP is supported as a local capability:

- The prompt tells the agent to set `capabilities.gsap=true` when GSAP is useful.
- The preview wrapper also detects `gsap` usage and injects the local vendor
  file.
- The server exposes it at `/static/vendor/gsap.min.js`.
- GSAP is for interaction/state polish inside a Stage asset: hover, open/close,
  selected states, focus pulses, drawer/menu motion.
- Create/Hyperframes owns the final entrance, emphasis, exit, timeline, and
  camera choreography.

shadcn/Tailwind is supported as a local capability:

- The agent authors shadcn-style markup with Tailwind utilities against shadcn's
  OKLCH design tokens. No npm imports, CDN, Radix runtime, or `lucide-react`.
- The preview injects Tailwind v4 in-browser build at
  `/static/vendor/tailwindcss-browser.js`, the shadcn token theme at
  `/static/vendor/shadcn-theme.css`, and `cn()` at
  `/static/vendor/forge-cn.js`.
- Icons are inline SVG.
- Stage preview iframes are sandboxed, so local vendor files are served with CORS
  headers. Without this, the Tailwind/shadcn theme fetch is blocked and assets
  render as raw browser-default HTML.
- Forge infers `capabilities.tailwind=true` from obvious utility classes so saved
  shadcn assets remain styled even when a model forgets the flag.

Two deterministic, zero-token mechanisms keep cheap models cheap and clean:

- Polish (`stagePolish.ts`): strip stray code fences, unwrap whole-field
  `<style>`/`<script>`, hoist `@import`, and add a reduced-motion guard when
  needed. It never makes design decisions.
- Small-edit ops (`stageTweak.ts`): for small changes, the model may return
  `{ "reply": "...", "ops": [...] }` instead of re-emitting the whole asset.
  Supported ops: `set-knob`, `set-text`, `rename-part`, and
  `ensure-reduced-motion`.

## Component Contract

The Forge contract is the handoff that makes a Stage asset Motion-AI-ready. It is
re-derived from source by `stageContract.ts`; model claims are not trusted.

- Parts: `data-forge-component="hero-title"` or
  `data-forge-part="hero-title"`. These are addressable animation targets for
  Create.
- Knobs:
  `/* @forge-var accent type=color default=#5e6ad2 label="Accent" */`.
  Supported types: `text`, `number`, `range`, `color`, `boolean`, `select`,
  `choice`, `image`.
- Actions:
  `/* @forge-action open-menu label="Open menu" affects="drawer" */` plus
  `data-forge-action="open-menu"` on the trigger. These are state changes Create
  can fire through `forge.trigger()`.

The preview runtime `static/forgeRuntime.js` provides:

- `forge.setVar(name, value)`;
- `forge.trigger(name)`;
- `forge.on(name, fn)`;
- `forge.vars`.

The Inspector and downstream Motion AI use that same runtime API.

## Saved Component Shape

A saved Forge Component contains:

- `name`;
- `html`;
- `css`;
- `js`;
- optional `react` source;
- optional `capabilities` (`react`, `gsap`, `tailwind`);
- `contract`;
- `components` (named parts);
- `variables` (public knobs);
- `actions`;
- saved knob values and media bindings.

Components are authoring artifacts in the Forge work directory. Create consumes
them, renders them through the Forge runtime, and converts the resulting motion
snippet into an Extension draft. Export never ships Components directly.

## Agent Setup

Forge reuses the Studio provider stack. Stage and Create both support the local
Claude Code, Codex, and Google Antigravity CLIs. Both panes also expose direct
DeepSeek and OpenModel-backed DeepSeek API providers.

Antigravity uses the authenticated `agy` executable installed by Google's
official installer. Forge invokes its non-interactive print mode in a terminal
sandbox. Stage-sized prompts are passed directly to avoid `agy` getting stuck in
file/tool mode; prompts too large for a conservative Windows command-line limit
fall back to a temporary added workspace that is removed after the turn. On
Windows, Forge also recovers the final answer from Antigravity's conversation
transcript when the current CLI's known non-TTY stdout bug produces an empty
output stream.

DeepSeek keys can be supplied with `DEEPSEEK_API_KEY` or entered in the Forge
composer settings. Browser-entered keys stay in `localStorage` and are sent per
request only.

OpenModel keys can be supplied with `OPENMODEL_API_KEY` or entered in the same
provider settings control. Forge calls OpenModel's Anthropic-compatible
`POST /v1/messages` endpoint with the preferred `X-Api-Key` header. The default
model is `deepseek-v4-flash`, which OpenModel currently offers free at 10 RPM /
100K TPM during its limited-time event.

- Claude models: Opus 4.8 / Sonnet 4.6.
- Codex models: GPT-5.5 / GPT-5.4 / 5.3 Codex.
- Antigravity models: the CLI's current default, plus Gemini 3.5 Flash (Medium).
- DeepSeek models: `deepseek-v4-flash` / `deepseek-v4-pro`.
- OpenModel models: `deepseek-v4-flash` (free-event default) /
  `deepseek-v4-pro`.
- Claude Code effort: `low`, `medium`, `high`, `xhigh`, `max`.
- Codex reasoning effort: `minimal`, `low`, `medium`, `high`, `xhigh`.
- Antigravity reasoning is selected by its model preset; Forge leaves its
  separate effort control on `auto`.
- OpenModel thinking defaults to `auto`; `enabled` sends the supported
  Anthropic-format `{type:"enabled"}` thinking option.
- DeepSeek effort defaults to `auto` to keep cost low. Selecting `low`,
  `medium`, or `high` enables DeepSeek thinking with matching
  `reasoning_effort`.

Codex and Claude prompts go over stdin. Antigravity's `--print` flag requires an
argument, so Forge uses a size-aware argv/temporary-file transport.

### Live reasoning streaming

Both the Stage and Create chat panes stream over SSE (`/api/*/chat/stream`) and
surface the model's reasoning live so a turn is never a silent spinner. The
shared `streamProviderTurn` plumbing emits `thinking` progress (the reasoning
trace) and `output` progress (partial answer) as they arrive:

- **Claude Code** streams token-level deltas via
  `--output-format stream-json --include-partial-messages` (`thinking_delta` →
  reasoning, `text_delta` → output; the final answer is the `result` event).
- **Codex** streams via `exec --json`; reasoning surfaces as whole blocks
  (`item.completed`/`reasoning`, or the older `agent_reasoning*` deltas) and the
  final answer is read from `--output-last-message`.
- **DeepSeek / OpenModel** surface reasoning best-effort (`reasoning_content` /
  `thinking_delta`) when thinking is enabled. **Antigravity** has no streaming
  transport, so its turn shows a heartbeat instead of a live trace.

The runner behind both routes is the same validated path as the non-streaming
endpoints — only the transport differs, so output quality is unchanged.

## Forge Create Full Plan

Create is the motion director. It does not replace Stage. It consumes Stage
assets, media, references, motion-design guidance, and Hyperframes skills to
produce a timed snippet that can stand alone as a showcase preview and export as
a valid Sequences Extension.

### North Star

Forge Create should make the missing motion vocabulary Sequences needs:

- small, polished, reusable motion snippets;
- grounded in real UI/assets, not abstract demo rectangles;
- authored against Hyperframes-compatible primitives and timelines;
- validated as `.seqext` bundles before the user can export;
- cheap enough that one ordinary prompt does not dump every skill, every
  component, and every media file into context.

The output is an Extension draft. Saved Components are inputs. Export packages
Extensions, not Components.

### Product Loop

1. User gives a brief: "make a product-card hover reveal", "make a dashboard
   metric cascade", "make a toast stack intro".
2. Create retrieves only the relevant motion/design/Hyperframes context.
3. Create inspects selected Components, media, and references.
4. If a needed asset is missing, Create calls Stage with a constrained asset
   request.
5. Create builds a motion draft using named parts, knobs, actions, and
   Hyperframes-compatible motion DNA.
6. Forge compiles and previews the draft as a snippet.
7. Forge validates token usage, target references, slot standardization, bundle
   schema, linter results, and browser rendering.
8. User iterates through small edit operations when possible.
9. Export writes a `.seqext` bundle with placeholders, manifest/spec metadata,
   and no private source media bytes.

### Snippet Types

Create should start with a small set of opinionated snippet categories. These
are not UI tabs; they are retrieval and validation routes.

- `interface-reveal`: dashboard/card/table/search/list entrances.
- `micro-interaction`: hover, press, focus, select, expand, notification.
- `data-moment`: metric count, chart path, row highlight, status change.
- `brand-sting`: logo, wordmark, tagline, CTA finish.
- `transition-bridge`: product state A to state B with spatial continuity.
- `media-frame`: screenshot/photo/video reveal with caption or UI chrome.

Each route gets its own prompt digest, examples, linter expectations, and
acceptance checks. This keeps prompts small and prevents the agent from trying
to solve every possible motion problem in one call.

### Motion Taste Rules

Create should retrieve and apply the useful parts of `MOTION_RESEARCH.md` as
house guidance:

- motion explains change: what appeared, changed, became related, or deserves
  attention;
- hierarchy beats quantity: hero/support timing matters more than animating
  everything;
- timing/easing are contextual tokens, not raw magic numbers;
- prefer transform and opacity unless a measured effect justifies more;
- one loud motion per snippet unless the user explicitly asks for spectacle;
- typography, contrast, composition, and copy clarity are part of motion
  quality;
- reduced-motion handling is validated for the authoring UI and offered as an
  output profile later, but video content is not silently changed by OS prefs.

The agent receives these as a compact checklist plus route-specific examples,
not the whole research document.

### Hyperframes Skill Use

Forge's Create-specific retrieval index (`createKnowledge.ts`) is self-contained
and uses:

- Sequences core tests for extension bundles, step templates, primitive
  previews, compiler/linter behavior, and transition conformance;
- `apps/forge/src/lift.ts`, `export.ts`, `standardize.ts`, and related tests;
- Forge's checked-in prompt knowledge under `apps/forge/knowledge/`, including
  the HyperFrames authoring snapshot at
  `apps/forge/knowledge/source/hyperframes/` (composition contract, `data-*`
  timing attributes, determinism rules, common mistakes, visual techniques —
  see that directory's `NOTICE.md` for provenance and the refresh procedure);
- selected GSAP skills when the requested snippet needs hand-authored motion
  DNA before lifting.

Retrieval must answer "what constraints matter for this request?" rather than
"what docs mention animation?" The prompt should include:

- 5-12 short bullets of relevant constraints;
- 1-3 tiny examples, clipped to the operation type;
- exact source file paths for local CLI agents that need deeper reading;
- never full Hyperframes docs by default.

Developers may consult `references/upstream/hyperframes/` for implementation
research, but prompt retrieval and tests must not depend on that optional
checkout.

### Context Budget

Default Create prompt budget:

- system/role and JSON contract: about 500-900 tokens;
- user brief and chat history summary: about 300-800 tokens;
- selected Component contract summaries: about 150-300 tokens each;
- media/doc/reference summaries: about 100-250 tokens each;
- retrieved motion/Hyperframes digest: about 800-1,500 tokens;
- current draft diff or small edit state: about 200-800 tokens.

Hard rule: one ordinary Create turn should stay under about 5k-7k prompt tokens.
Large source fields are sent only when editing that specific artifact. Images
are passed as file paths or thumbnails, never base64. Long docs are clipped and
summarized into durable notes.

### Retrieval Pipeline

Create needs a separate `createKnowledge.ts`:

1. Classify intent into snippet route, primitive kind, asset needs, and risk.
2. Extract terms from the user brief, selected Components, part names, media
   kinds, and current draft errors.
3. Search indexed local docs/tests/examples with BM25 or a tiny embedding cache.
4. Apply route filters so "toast stack" does not retrieve logo-sting examples.
5. Return compact cards: title, source path, why relevant, clipped guidance.
6. Cache the digest by `(route, terms, selected component ids, error codes)`.
7. On validation failure, retrieve again using the concrete failure messages.

For local CLI providers, include source paths. For API providers, inline only
the clipped cards.

### Asset And Reference Intake

Create can use:

- saved Components from Stage;
- Library media and bins;
- markdown docs and brand/design notes;
- pasted scratch images;
- disk files from the read-only browser;
- optional public asset search.

Public search should be an adapter layer, disabled by default until configured.
Candidate providers:

- [Openverse](https://api.openverse.org/) for openly licensed/public-domain
  media;
- [Pexels](https://www.pexels.com/api/documentation/) for free photo/video API
  search;
- [Pixabay](https://pixabay.com/api/docs/) for royalty-free images/videos under
  its content license;
- [Unsplash](https://unsplash.com/documentation) for photo search when an API
  key and terms compliance are configured.

Rules:

- Every imported result stores provider, author, source URL, license/terms URL,
  download timestamp, dimensions, and attribution text when required.
- Forge never assumes the API's license metadata is legally perfect; it records
  provenance and lets the user replace assets.
- Public assets can be used in showcase previews, but exported Extensions still
  standardize media into slots/placeholders unless the user intentionally ships
  an allowed bundled placeholder.
- Search results are thumbnails plus metadata first. Full bytes download only
  after selection.
- The retrieval agent sees only chosen assets, not entire result pages.

### Stage Tool Calling

Create may ask Stage for assets, but only through a narrow tool contract:

- missing UI surface;
- missing state needed for a transition;
- missing named parts/actions/knobs on an existing Component;
- visual reference needs a cleaner editable reconstruction.

Create sends Stage:

- short asset brief;
- required aspect;
- required parts/actions/knobs;
- selected references;
- style hints from existing Components;
- maximum complexity and performance constraints.

Stage returns a saved Component. Create then treats it like any other input.
Create must not ask Stage to author final cinematic timing; Stage only builds
editable visual material.

### Draft Model

Create should save an Extension draft separately from Components:

```json
{
  "id": "draft-uuid",
  "name": "Metric Cascade Reveal",
  "route": "data-moment",
  "primitiveKind": "enter",
  "aspect": "16:9",
  "components": ["obj-dashboard"],
  "media": ["asset-hero"],
  "slots": [],
  "timeline": [],
  "actions": [],
  "knobAutomation": [],
  "liftSource": "",
  "bundle": null,
  "validation": []
}
```

Near term, `liftSource` plus `exportDocument()` can produce valid `.seqext`
bundles. Medium term, the structured `timeline` becomes the primary authoring
format and can compile into token-pure skeletons without routing through raw
GSAP.

### Authoring Modes

Create should support three modes behind one chat surface:

- `compose`: create a new Extension draft from brief/components/media.
- `repair`: fix validation, linter, blank render, missing target, or schema
  errors.
- `iterate`: small subjective edits: slower, snappier, more premium, less busy,
  emphasize a part, retime a beat.

The agent response chooses the cheapest valid representation:

- small edit op for simple changes;
- structured timeline patch for target/action/slot changes;
- lifted GSAP source for expressive motion DNA;
- Stage tool call only when the visual asset is missing or malformed.

### Preview And Showcase Quality

A Create snippet is not done when JSON parses. It is done when it can be shown.

Verification loop:

1. Build a preview project with the draft Extension enabled.
2. Compile with the existing Sequences/Hyperframes path.
3. Run bundle validation and linter checks.
4. Run a browser smoke check for blank canvas, console errors, missing assets,
   oversized layout, and offscreen primary targets.
5. Capture stills at start/mid/end and, later, a short MP4/WebM preview.
6. Score the snippet with deterministic checks:
   - no unknown targets;
   - no unbounded random/time behavior;
   - no external network dependency in export;
   - transform/opacity preferred;
   - readable text at target resolution;
   - clear hero/support hierarchy;
   - no motion-density warning unless explicitly accepted.

Create should show the validation report in normal product language, then offer
one-click repair.

### Extension Compatibility

Every exported snippet must pass the same gates as handwritten `.seqext`:

- valid manifest id prefixed by `primitiveKind`;
- manifest/spec accepted by `validateBundle`;
- skeleton references only declared tokens/env identifiers;
- slots standardized by `standardize.ts`;
- placeholders generated under `media/`;
- no real user media bytes unless the format explicitly permits them later;
- installed bundle can compile through `extensionPreviewProject`;
- extension id appears in registry scope and respects enabled extension rules;
- exported output survives full test coverage for bundle IO and preview compile.

Export should refuse to package a draft that has not passed validation, unless
the user chooses "save draft only".

### UI Surface

Create should feel like a compact motion lab, not a timeline clone:

- left: agent chat with reference chips and tool progress;
- center: preview/code tabs with aspect selector and playback scrub;
- right: inspector with selected draft, selected Components, knobs/actions,
  validation, and media;
- bottom or modal: generated variants, each with thumbnail, route, duration,
  primitive kind, and validation status.

Expected controls:

- "Use component as context";
- "Ask Stage for missing asset";
- "Search free assets";
- "Generate 3 variants";
- "Repair validation";
- "Save Extension draft";
- "Export Extension".

Do not expose raw primitive catalogs as the first interaction. Show readable
labels and validation details, with engine ids available in advanced details.

### Implementation Phases

Phase 1 - Foundations:

- add `ForgeExtensionDraft` store (`drafts.json`);
- add draft CRUD routes;
- add Create prompt builder and `createKnowledge.ts`;
- index Hyperframes/Sequences/Forge motion docs and tests;
- update Export to read the current validated draft;
- keep `/api/doc/export` as the canonical package path.

Phase 2 - First Working Create Agent:

- support selected Component/media/doc refs in Create chat;
- emit lifted GSAP source for simple enter/emphasis snippets;
- call `liftGsapSource()` and `exportDocument()` server-side;
- preview through `extensionPreviewProject`;
- return validation errors with repair prompts.

Phase 3 - Stage Tool Integration:

- expose `stage.createAsset` and `stage.repairContract` as internal tools;
- pass required parts/actions/knobs;
- save returned assets into the component library;
- continue the Create turn with the new Component context.

Phase 4 - Showcase Preview:

- generate thumbnails or short clips for variants;
- add start/mid/end visual smoke checks;
- add deterministic quality checks from `MOTION_RESEARCH.md`;
- cache previews by draft hash.

Phase 5 - Public Asset Search:

- add provider adapter interface;
- implement Openverse first because license metadata is central to the product
  use case;
- add Pexels/Pixabay/Unsplash adapters behind settings/API keys;
- store provenance metadata with imported assets;
- keep exports placeholder-based.

Phase 6 - Structured Timeline Authoring:

- promote from raw lifted GSAP to structured timeline patches;
- compile patches to token-pure extension skeletons;
- add diff/undo for Create draft edits;
- expand route-specific examples and evals.

### Acceptance Criteria

Create is ready when a user can:

- select or generate a Component;
- ask for a named snippet;
- get at least three distinct variants;
- preview each variant in Forge;
- repair validation failures without hand-editing files;
- export a `.seqext`;
- install it into Sequences;
- see it compile in the Extensions preview;
- reuse it in a project without shipping private media bytes.

Engineering gates:

- typecheck passes;
- bundle/export tests cover generated drafts;
- Create prompt snapshots stay under budget;
- every generated Extension passes `validateBundle`;
- preview smoke catches blank output;
- public asset imports store provenance;
- Stage tool calls are auditable and bounded.

### What Create Sees

The Create agent should receive a compact scene packet, not a whole project dump:

- user brief and target aspect ratio;
- selected saved Components and media refs;
- each Component's rendered preview URL or source snapshot;
- each Component's contract: parts, knobs, actions, capabilities, and saved
  values;
- available Hyperframes primitives, tokens, constraints, and current timeline;
- retrieved Hyperframes/GSAP skills relevant to the requested shot;
- any brand/reference docs clipped the same way Stage clips docs.

The agent should not see giant raw skill files by default. It should get a
retrieval digest plus on-disk paths for deeper reads when using a local CLI
provider.

### Create Uses Components In Three Layers

1. Asset layer: Stage Components are rendered as HTML documents with the Forge
   runtime. Create can set knobs, fire actions, and select named parts.
2. Motion layer: Create writes Hyperframes-compatible motion intent over those
   named parts: entrance, emphasis, transition, exit, camera/framing, pacing.
3. Export layer: the finished Extension draft becomes a `.seqext` bundle with
   stable slots and neutral placeholders.

The Create agent should never animate anonymous DOM guesswork when a contract
exists. It should target `data-forge-component` parts and use `forge.setVar()` /
`forge.trigger()` for state changes.

### When Create Calls Stage

Create should be allowed to call the Stage orchestrator as a tool when the motion
brief needs an asset that does not exist yet.

Examples:

- "Show a billing settings screen sliding into view" and no billing settings
  Component exists.
- "Animate this screenshot into a polished dashboard mock" and the screenshot is
  only a visual reference.
- "Create a notification toast stack, then make it cascade in."

Tool contract:

```json
{
  "tool": "stage.createAsset",
  "input": {
    "brief": "Build a billing settings panel with invoice table and plan card.",
    "aspect": "16:9",
    "references": ["asset-or-doc-ids"],
    "styleHints": "match existing saved dashboard component",
    "requiredParts": ["settings-card", "invoice-row-active", "save-button"],
    "requiredActions": ["focus-search", "toggle-plan", "show-toast"]
  }
}
```

The Stage tool returns the same saved Component shape Create already consumes.
Create then uses it like any other Component. This keeps responsibilities clean:
Stage makes beautiful, editable UI; Create choreographs it.

### Hyperframes Skill Retrieval

Create needs its own retrieval index separate from Stage:

- Hyperframes primitives and authoring constraints;
- GSAP-to-Hyperframes lift rules where relevant;
- timing, pacing, camera, transitions, and typography-in-motion guidance;
- component-slot and media-standardization rules;
- examples of valid `.seqext` outputs and common failure cases.

Routing should be intent-based:

- "dashboard reveal" pulls interface entrance, camera/framing, and table/chart
  animation examples.
- "logo sting" pulls brand mark, typography, and timing skills.
- "scroll" pulls scroll/camera guidance only if Create supports that output.
- "existing component edit" pulls contract/knob/action usage, not Stage design
  guidance.

The retrieved prompt should be small enough for cheap models. Full skills remain
on disk for local agents to inspect on demand.

### React And Tailwind Compatibility

Do not remove React or Tailwind from Stage authoring. They are quality
multipliers for cheap models. The compatibility boundary is the rendered asset
document.

Current path:

- Stage stores original React TSX for edits and compiled JS for rendering.
- Stage stores `capabilities.tailwind=true` for Tailwind/shadcn assets.
- The preview renderer injects the Forge runtime, optional React runtime,
  optional GSAP, optional Tailwind browser build, and shadcn token layer.
- Create should use that same renderer when previewing or capturing the asset.

Video/export path:

- Near term: Create includes the same local runtime scripts while composing the
  HTML that Hyperframes renders.
- Medium term: add an asset bake step before export:
  - compile React TSX to JS;
  - precompile Tailwind utilities to static CSS;
  - inline the shadcn token layer actually used by the asset;
  - keep `forgeRuntime.js` or a smaller runtime subset for knobs/actions;
  - emit a plain HTML/CSS/JS document for Hyperframes.
- Long term: cache baked assets by content hash so repeated renders do not pay
  Tailwind browser cost.

The rule: Create and Hyperframes should not need to understand React or Tailwind
as authoring frameworks. They should receive a stable renderable document plus a
contract.

### Create Output Shape

Create should return JSON first, then the server validates and lifts it:

```json
{
  "reply": "Built a 12-second dashboard reveal with a settings-card focus beat.",
  "extensionDraft": {
    "name": "Dashboard Settings Reveal",
    "aspect": "16:9",
    "assets": ["settings-card"],
    "timeline": [
      {
        "target": "settings-card.card-body",
        "op": "fromTo",
        "from": { "opacity": 0, "y": 32 },
        "to": { "opacity": 1, "y": 0, "duration": 0.45, "ease": "power3.out" },
        "at": 0
      }
    ],
    "actions": [
      { "at": 1.2, "asset": "settings-card", "trigger": "focus-input" }
    ],
    "knobs": [
      { "asset": "settings-card", "name": "accent", "value": "#5e6ad2", "at": 0 }
    ]
  }
}
```

The exact schema can evolve, but the validator must enforce:

- only known asset ids;
- only known parts/actions/knobs from the Component contract;
- legal Hyperframes primitives and token ids;
- no network dependencies;
- deterministic timing;
- reduced-motion and performance rules.

### Create Verification Loop

Before saving/exporting a Create result:

1. Resolve or generate all needed Components.
2. Bake each Component to the render boundary.
3. Compile the Hyperframes preview.
4. Validate contract references.
5. Run a browser smoke check for blank canvas, missing assets, and script errors.
6. Save the Extension draft only if the compiled preview renders.

## Server Surface

Plain `node:http`, same-origin localhost. Key routes include:

Stage AI:

- `POST /api/stage/chat` - the Stage AI turn.
- `POST /api/stage/chat/stream` - the same Stage turn over SSE progress events
  (provider deltas + the live `thinking` stream for streaming providers).
- `POST /api/stage/paste` - hidden scratch image refs.

Create AI:

- `POST /api/create/chat` - the Create motion-draft turn.
- `POST /api/create/chat/stream` - the same Create turn over SSE progress events.
- `GET /api/create/drafts`, `POST /api/create/drafts/save`,
  `POST /api/create/drafts/current`, `POST /api/create/drafts/delete` - the
  Extension-draft store (`drafts.json`).
- `POST /api/create/stage-call` - Create's Stage tool call for a missing asset.
- `POST /api/lift` - lift a GSAP snippet into a token-pure skeleton preview.
- `GET /api/copilot/providers`, `POST /api/copilot` - the inspector copilot
  (motion/object modes) used for ad-hoc lift/object drafts.

Library, docs, components:

- `GET /api/docs`, `POST /api/docs/add`, `POST /api/docs/delete` - markdown refs.
- `GET /api/assets/folders`, `POST /api/assets/import`,
  `POST /api/assets/upload`, `POST /api/assets/move` - Library/media pool.
- `GET /api/objects`, `POST /api/objects/save`, `POST /api/objects/delete`,
  `POST /api/objects/move` - saved Stage Components.
- `POST /api/doc/export` - package the current validated Create Extension draft
  as `.seqext`.

Local preview vendors (served with CORS for sandboxed iframes):

- `GET /static/vendor/gsap.min.js` - local GSAP for Stage previews.
- `GET /static/vendor/tailwindcss-browser.js` - Tailwind v4 in-browser build.
- `GET /static/vendor/shadcn-theme.css` - shadcn OKLCH token theme.
- `GET /static/vendor/forge-cn.js` - self-contained `cn()` helper.

## What Not To Add Back

- Do not turn Stage or Library into a full layer/timeline editor.
- Do not show the motion primitive catalog inside Export.
- Do not make users choose engine primitives while creating an Extension draft.
- Do not expose engine details unless explicitly requested.
- Do not bring back the Sequences silver theme; Forge is Linear-dark.

The intended product loop:

1. Import media in Library.
2. Ask Stage AI to make or edit a SaaS-ready asset.
3. Inspect public knobs, actions, and named parts.
4. Save it as a Component.
5. Use Create to animate it with Hyperframes as an Extension draft.
6. Export the Extension for Sequences.
