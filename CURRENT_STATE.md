# Sequences: Current State

Snapshot date: **June 21, 2026**

This document describes the repository as it exists in the current working
tree, not merely the last commit on `main`. It is intended to be the practical
starting point for architecture review, motion-design research, technical
experimentation, and future implementation work.

## 1. Executive summary

Sequences is a local-first, agent-first motion-graphics editor for SaaS and app
product videos. The intended workflow is:

1. A human provides a brief, assets, and optionally a storyboard.
2. An agent chooses a compact beat sheet from a constrained catalog.
3. Deterministic code expands that plan into layouts, motion assignments, and
   timing.
4. A linter checks motion-design and project invariants.
5. A real editor lets the human make zero-token, non-destructive changes.
6. The project compiles to HyperFrames-compatible HTML and renders locally.

The implementation is no longer a small prototype. The current working tree
contains:

- A schema-v3 canonical scene graph with migrations from v1 and v2.
- A deterministic motion system with tokens, 16 primitives, 7 archetypes,
  3 profiles, 2 camera moves, and 8 transition identifiers.
- A choreography solver, validator, linter, command algebra, undo/redo store,
  content hashing, incremental-change metadata, and a one-way compiler.
- Content-addressed assets with metadata extraction.
- Image, video, audio, custom-layer, device-frame, camera, emphasis, and
  transition support in the core/compiler.
- Four agent providers, zero-token structured planning, direction variants,
  deterministic tweak matching, model-assisted tweak fallback, and an MCP
  server.
- A seven-page local Studio with project launcher, media management, SVG asset
  design, Excalidraw storyboard, timeline editing, rendering, and extension
  scoping.
- Local rendering through HyperFrames Producer, FFmpeg, and Chrome/Edge.
- 152 passing tests, property tests, HyperFrames conformance checks, a
  performance budget, deterministic golden renders, primitive probes, CI, and
  three passing browser smoke suites.

The architecture is coherent and unusually well-defended for an early product.
The immediate priority is now an interface-first **Phase 1.5**: redesign the
Studio around the real creative workflow before adding Phase 2 capabilities.
The engine's remaining opportunities—motion-taste tuning, deeper media/audio
editing, richer camera and transition semantics, true incremental rendering,
storyboard understanding, and font portability—need intentional homes in that
new interface.

## 2. Repository snapshot

### Version-control state

- Baseline branch: `main`
- Publication branch: `codex/current-state-and-ui-rewrite`
- Upstream: `origin/main`
- HEAD: `8e5f3ff`
- HEAD subject: `feat: add extension enablement support and validation for profiles, archetypes, and camera moves`
- The local branch is not ahead of or behind `origin/main`.
- Before this document was added, the working tree contained **85 entries**:
  **54 modified** and **31 untracked**.
- The working tree is therefore the meaningful current implementation. The
  committed HEAD significantly understates what is present.

The broad working-tree changes cover the core engine, Studio, agent planning,
rendering, project integrity, tests, CI, examples, and generated storyboard
bundle.

### Scale

Ignoring `node_modules`, `.git`, the local HyperFrames checkout, the local
Excalidraw notes directory, generated builds, and render-frame dumps:

- 110 first-party files
- 81 TypeScript/JavaScript/MJS files
- 23 test files
- Roughly 15,000 lines of readable first-party source, excluding the generated
  Excalidraw bundle
- `storyboard-excalidraw-bundle.js` is a generated, tracked bundle of roughly
  14 MB and hundreds of thousands of lines

### License and package model

- Root license: Apache License 2.0
- Monorepo manager: npm workspaces
- Root package: `sequences-monorepo@0.0.1`
- Packages:
  - `@sequences/core@0.0.1`
  - `@sequences/studio@0.0.1`
- Runtime requirement: Node `>=22.18`
- TypeScript runs directly through Node's native type stripping.
- There is no normal application compilation step.
- The exception is the Excalidraw storyboard browser bundle, generated with
  esbuild through `npm run build:storyboard`.

## 3. Product and architectural identity

The product is built around one central idea: **the model plans and selects;
deterministic code performs motion design**.

The architecture intentionally avoids allowing an LLM to write arbitrary
HTML, CSS, JavaScript, keyframes, GSAP timelines, easing curves, or raw motion
numbers. Instead, agent output is constrained to named profiles, archetypes,
layouts, slots, assets, durations, and optional camera moves.

The main data flow is:

```text
Brief / structured brief / storyboard / assets
                  |
                  v
          Plan: profile + scenes
                  |
                  v
      Typed commands through ProjectStore
                  |
                  v
       Canonical schema-v3 Project JSON
                  |
                  v
  Archetype materialization + profile motion table
                  |
                  v
       Deterministic choreography solver
                  |
                  v
    Compiler -> HyperFrames HTML + GSAP timeline
                  |
          +-------+-------+
          |               |
          v               v
     Live player      Producer render
                          |
                          v
                    MP4/WebM/MOV/PNG
```

The linter consumes the same resolved project and compiler output and emits
findings plus typed, undoable fixes.

### The eight load-bearing laws

The project documentation and implementation consistently enforce these laws:

1. **One mutation pathway.** Canonical project changes go through
   `applyCommand`, normally through `ProjectStore.apply`.
2. **One-way compilation.** `compile(Project)` produces HTML; generated HTML is
   never parsed back into project state.
3. **Token purity.** Motion/style choices use named tokens and registered
   primitives, not arbitrary numeric motion values.
4. **Validation gates state.** Invalid command results are rejected before the
   store changes.
5. **Lint fixes are commands.** Auto-fixes are journaled and undoable.
6. **Command inverses round-trip exactly.**
7. **Registry discipline.** Motion vocabulary comes through typed registry
   contracts and one-line summaries.
8. **GSAP is behind an emission seam.** Primitives emit `GsapStep` data; the
   compiler owns serialization.

Two intentional exceptions to the one-command pathway are `design.json` and
`storyboard.json`. They are portable intent/scratch sidecars, not canonical
render state. Assets exported from Design enter the canonical graph through
`AddAsset`.

## 4. Repository layout

```text
Sequences/
  packages/core/          Pure deterministic domain and compiler
  apps/studio/            All IO, local server, CLI, MCP, renderer, and UI
  examples/demo-promo/    Current Pulse demonstration project and renders
  projects/Starter/       Older schema fixture and golden-render project
  evals/                  Canonical structured-brief evaluation set
  scripts/                Performance, golden-render, and browser smoke tools
  skills/sequences/       Skill instructions for agents using the MCP server
  .github/workflows/      CI

  README.md               Public product, setup, and architecture overview
  DESIGN.md               Current editor design system
  CLAUDE.md               Engineering laws and contributor guidance
  UI_REWRITE_PLAN.md      Current product priority and interface rewrite gate
  README_dev.md           Local developer guide
  SEQUENCES_MASTER_PLAN.md
                          Product/research roadmap; intentionally aspirational
  STORYBOARD_AI_PLAN.md   Post-rewrite storyboard-to-agent research plan
  MOTION_RESEARCH.md      Consolidated, source-checked private research

  hyperframes/            Ignored local upstream checkout for research
  excalidraw/             Ignored local reference/notes directory
  node_modules/           Installed dependencies
```

`README_dev.md`, `SEQUENCES_MASTER_PLAN.md`, `STORYBOARD_AI_PLAN.md`,
`MOTION_RESEARCH.md`, `hyperframes/`, and `excalidraw/` are ignored by
`.gitignore`. They are local working references, not public sources of truth.

## 5. Runtime and dependency stack

### Root dependencies

- React 19 and React DOM 19
- `@excalidraw/excalidraw`
- esbuild
- TypeScript 5.9
- Vitest 3.2
- fast-check

React is not the main Studio framework. The Studio is mostly plain browser
JavaScript. React is used to host the Excalidraw storyboard bridge.

### Core package

- `zod` for schemas and runtime validation
- Development-time HyperFrames core conformance dependency

### Studio package

Pinned HyperFrames packages:

- `@hyperframes/core@0.6.86`
- `@hyperframes/engine@0.6.86`
- `@hyperframes/player@0.6.86`
- `@hyperframes/producer@0.6.86`

Other key dependencies:

- GSAP `^3.15.0`
- `puppeteer-core`
- `@sequences/core`

The hard HyperFrames pin is deliberate because the upstream project moves
quickly and its HTML/linter contract is the main substrate boundary.

## 6. Canonical project model

A project is a plain directory:

```text
project/
  project.json       Canonical scene graph
  events.log         Append-only JSONL mutation/recovery journal
  assets/            User media, optionally organized in folders/bins
  storyboard.json    Optional pre-production sidecar
  design.json        Optional design-canvas sidecar
  build/             Regenerated HTML, manifest, assets, vendors, thumbnails
  renders/           Finished videos, frame sequences, and poster images
```

### Project schema

Current schema version: **3**

Top-level project fields:

- `schemaVersion`
- `meta`
  - title
  - width
  - height
  - fps: 30 or 60
  - semantic background color token
- `brand`
  - name
  - five semantic colors
  - display and body font names
  - optional logo asset
- `motionProfile`
- ordered `scenes`
- transitions keyed by the scene they follow
- content-addressed `assets`
- `audio` clips
- per-project extension settings

### Scene model

A scene contains:

- Stable ID
- Archetype ID
- Optional archetype layout
- Duration in project frames
- Typed slot content
- Choreography settings
- Sparse materialized-layer overrides
- Optional explicit custom layers
- Optional scene-level camera move

Scene start times are derived from scene order and duration. They are not
stored, so nominal scenes tile the project by construction.

### Slot values

Supported slot content:

- Text
- Up to six text-list values
- Number with prefix/value/suffix
- Media reference with:
  - asset ID
  - optional `plain` or `device` presentation
  - optional `cover` or `contain` fit hint

### Layer overrides

Overrides can change:

- Partial box geometry
- Type token
- Color token
- Enter primitive
- Exit primitive
- Emphasis primitive
- Continuous primitive
- Emphasis frame
- Enter/emphasis duration token
- Text
- Hidden state

The materialized archetype remains intact underneath the sparse patch. This is
what makes layout/profile switching non-destructive.

### Custom layers

Explicit custom layers support:

- Roles: hero, support, media, list, badge, decor
- Kinds: text, number, image, video, device, shape
- Text, number, asset, or safe CSS color/gradient content
- Box, type token, color token, alignment, rank

Custom shape CSS is constrained to a single safe color or gradient. URLs,
image sets, quotes, markup delimiters, control characters, and other obvious
inline-style escape paths are rejected.

### Assets

Assets are:

- Images, video, or audio
- Stored under a safe forward-slash `assets/...` path
- Identified as `asset-<first 16 hex characters of SHA-256>`
- Required to have a full 64-character SHA-256 content hash
- Unique by ID, path, and content hash

Metadata may include:

- MIME type
- Byte size
- Width and height
- Duration
- Dominant colors
- OCR text
- Cache hint

### Audio graph

Audio clips support:

- music, voiceover, or SFX roles
- start frame
- optional duration
- `silent`, `bed`, or `full` volume token
- mute state

The compiler emits timed `<audio>` elements. Beat analysis, waveforms,
trimming, ducking, captions, and audio-focused UI are not implemented.

### Extensions

`extensions.enabled` has three meaningful states:

- `null`: all installed registry entries are available
- `[]`: no extension vocabulary is enabled
- explicit IDs: only those known IDs can be newly selected by plans/commands

Disabling an extension does not invalidate existing scenes. This allows a
shared project to continue rendering even when its planning vocabulary is
narrowed.

## 7. Schema migration and recovery

### Migrations

Migrations are pure and ordered:

- v1 -> v2:
  - converts legacy asset IDs to content-addressed IDs
  - adds content hashes and metadata defaults
  - remaps asset references throughout scenes, audio, and brand
  - maps `cut` to `cutHold`
  - maps `fade` to `crossFade`
  - adds audio
- v2 -> v3:
  - adds extension settings
  - preserves explicitly enabled dependencies already referenced by the graph

Newer-than-supported schema versions are rejected.

`projects/Starter/project.json` is still persisted as schema v1 and is migrated
in memory when loaded. That makes it an active backward-compatibility fixture.

### Journal recovery

Each event may contain:

- sequence number
- timestamp
- apply/undo/redo kind
- typed command
- source
- before hash
- after hash

Project commits write and fsync journal entries before atomically replacing
`project.json`. On load, hashed journal entries are replayed exactly once when
the snapshot matches `beforeHash` but not `afterHash`.

This is crash recovery for a snapshot that is one or more valid journaled
commands behind. It is **not** full event-sourced reconstruction:

- The current snapshot remains canonical.
- Undo/redo stacks are memory-only and do not survive host restart.
- There is no journal compaction or historical branch UI.

## 8. Motion token lattice

The token tables are the main location for subjective motion tuning.

### Duration tokens at 30 fps

| Token | Frames | Seconds |
|---|---:|---:|
| `instant` | 6 | 0.20 |
| `quick` | 10 | 0.33 |
| `base` | 16 | 0.53 |
| `relaxed` | 24 | 0.80 |
| `slow` | 36 | 1.20 |
| `dramatic` | 54 | 1.80 |

At 60 fps, authored 30-fps token values are scaled to preserve seconds.

### Easing tokens

- Enter:
  - `enter.snap`
  - `enter.glide`
  - `enter.settle`
  - `enter.springSoft`
- Exit:
  - `exit.swift`
  - `exit.fade`
- Movement:
  - `move.glide`
  - `linear.mech`

Bezier eases are registered through GSAP CustomEase with dot-free runtime
names. Native GSAP ease strings are used for the elastic, fade, and linear
tokens.

### Distance tokens

- `nudge`: 2% of frame height
- `step`: 6%
- `travel`: 14%
- `sweep`: 40%

### Stagger tokens

- `tight`: 2 frames
- `base`: 4 frames
- `loose`: 7 frames

### Scale tokens

- `subtle`: 1.03
- `pop`: 1.12
- `hero`: 1.35

### Blur tokens

- `soft`: 8 px at 1080p
- `heavy`: 24 px at 1080p

### Type scale at 1920x1080

| Token | Size | Weight | Line height |
|---|---:|---:|---:|
| `mega` | 220 | 800 | 1.00 |
| `display` | 120 | 800 | 1.05 |
| `headline` | 84 | 700 | 1.10 |
| `title` | 56 | 700 | 1.15 |
| `body` | 38 | 500 | 1.35 |
| `caption` | 28 | 500 | 1.30 |

### Semantic color tokens

- primary
- surface
- text
- muted
- accent

The actual colors live in each project's brand kit.

### Solver defaults

- 65% overlap budget
- Simultaneity cap of 3 non-continuous motions
- `quick` settle gap
- `base` stagger

The values are documented as first-pass choices, not final taste.

## 9. Motion primitive registry

The current registry contains **16** motion primitives.

### Enter primitives

| ID | Intended use |
|---|---|
| `enter.fadeIn` | Quiet arrival for supporting/background elements |
| `enter.slideUpSoft` | Polished lift for captions, bullets, and secondary copy |
| `enter.maskRevealUp` | Signature baseline reveal for headlines |
| `enter.slideInDirectional` | Side-aware panel/UI arrival |
| `enter.blurIn` | Atmospheric focus-to-sharp reveal |
| `enter.charCascade` | Per-character kinetic launch typography |
| `enter.scaleIn` | Card/media/badge growth from transform origin |
| `enter.countUp` | Exact eased number counter |

### Exit primitives

| ID | Intended use |
|---|---|
| `exit.fadeDown` | Quiet drift-away |
| `exit.slideExit` | Crisp upward energy into the next beat |
| `exit.scaleAway` | Decisive shrink-and-clear |

### Emphasis primitives

| ID | Intended use |
|---|---|
| `emphasis.pop` | Single scale attention tap |
| `emphasis.pulseGlow` | Short accent glow |
| `emphasis.underlineSweep` | Drawn accent underline |

### Continuous primitives

| ID | Intended use |
|---|---|
| `continuous.kenBurns` | Slow media scale/drift over a held scene |
| `continuous.floatIdle` | Gentle badge/card hover |

Primitive implementations are token-pure. Most emit structured `fromTo`,
`to`, or `set` steps. `charCascade`, `countUp`, and `underlineSweep` use the
controlled custom-code escape hatch.

## 10. Scene archetypes

The current registry contains **7** archetypes.

| Archetype | Required/optional slots | Layouts | 30-fps range |
|---|---|---|---:|
| `hook-opener` | headline*, subline | center, left | 60-150f |
| `feature-reveal` | headline*, media*, bullets | media-right, media-left, center, full-bleed | 75-240f |
| `stat-callout` | stat*, caption* | center | 60-150f |
| `logo-sting-cta` | tagline, cta* | center | 60-180f |
| `ui-walkthrough` | headline*, media*, steps* | media-right, media-left, full | 90-270f |
| `social-proof` | quote*, source*, logos | center, left | 75-210f |
| `stat-chart` | headline*, values*, caption | center, full | 75-210f |

Each archetype owns:

- Typed slot specifications
- Copy budgets
- Valid layouts and default layout
- Duration heuristics
- Pure layer materialization
- Layer roles and hierarchy ranks
- Grid geometry

`stat-chart` is marked as a HyperFrames-sourced wrapper in the registry
manifest, although its current implementation materializes regular Sequences
shape/text layers rather than embedding an opaque external block.

## 11. Motion profiles

### `crisp-saas`

- Tight pacing
- Mask-reveal hero
- Soft support movement
- Scale-in media
- Ken Burns media hold
- No per-layer exits
- Default cut
- Motion-density ceiling: 1.4

### `warm-startup`

- Relaxed, softer movement
- Soft hero slide
- Gentle fade-down exits
- More breathing room
- Ken Burns media hold
- Default fade/crossfade alias behavior
- Motion-density ceiling: 2.2

### `bold-launch`

- Character-cascade hero
- Blur support
- Directional media/list entrances
- Scale-away and slide exits
- Larger Ken Burns media scale
- Floating badges
- Tight, high-energy timing
- Default cut
- Motion-density ceiling: 2.6

The profile selection table maps each layer role to enter, optional exit, and
optional continuous motion. Number layers are a deliberate exception: they
always use `enter.countUp`.

## 12. Camera, transitions, and registry plugins

### Camera moves

- `pushIn`
- `pullBack`

Camera is scene-level. It scales the entire `.seq-camera` wrapper across the
scene. It is not yet a multi-keyframe camera track.

### Transition IDs

- Compatibility aliases:
  - `cut`
  - `fade`
- Native Sequences transitions:
  - `cutHold`
  - `crossFade`
  - `wipeDirectional`
  - `slidePush`
- HyperFrames-style shader wrappers:
  - `shader.flashThroughWhite`
  - `shader.pixelMelt`

Current behavior:

- Cut/cutHold gives the incoming scene a four-frame pre-roll.
- Other transitions use a ten-frame overlap window.
- Crossfade emits outgoing and incoming opacity steps.
- Directional wipe animates clip-path.
- Slide push translates incoming and outgoing scenes.
- Shader transitions emit metadata into `window.__hf.transitions` and use a
  CSS opacity fallback for live preview.
- Alternating/available track allocation prevents same-track overlap.

### Token-set plugin

`tokens.sequences-core` exposes the complete built-in duration, easing,
distance, stagger, scale, blur, and type tables.

### Registry totals

The full registry contains:

- 16 primitives
- 7 archetypes
- 3 profiles
- 2 camera moves
- 1 token-set plugin
- 8 transition plugins
- **37 total registry entries**

The Studio Extensions page currently displays only primitive, archetype,
profile, and camera entries: **28 cards**. Token-set and transition plugin
entries are not shown as cards.

## 13. Materialization and choreography

### Materialization

For each scene:

1. The archetype creates proto-layers from slots and canvas geometry.
2. Custom layers are appended.
3. The active profile assigns motion by layer role.
4. Number layers receive count-up.
5. Sparse overrides change geometry, style, text, visibility, or motion.
6. Hidden layers are omitted.

The result is a `MaterializedLayer[]`.

### Choreography solver

The solver:

- Orders entrances by explicit choreography order, then visual rank and ID.
- Starts the first entrance at frame 0.
- Starts later entrances after the larger of:
  - the stagger floor
  - 65% of the previous entrance duration
- Delays entrances when needed to keep concurrency at or below 3.
- Schedules exits in reverse order so they finish exactly at scene end.
- Runs continuous motions across the whole scene.
- Places emphasis during the hold unless an explicit frame is supplied.
- Reports, rather than mutates around:
  - settle shortfall
  - hero-not-loudest profile problems
  - peak concurrency

The solver is pure and deterministic.

## 14. Compiler and HyperFrames contract

Compiler version: `1.0.0`

`compile(project)` produces:

- Complete composition HTML
- Build manifest
- Asset copy plan
- Required vendor script list
- All emitted GSAP steps
- Content hashes
- Changed-scene IDs relative to an optional previous manifest

### Emitted composition

The compiler emits:

- A fixed-size `#stage`
- `data-composition-id`, `data-width`, and `data-height`
- Timed `.clip` scene elements
- `data-start`, `data-duration`, and `data-track-index` in seconds
- One `.seq-camera` wrapper per scene
- Absolutely positioned layer containers
- Brand CSS variables
- Local GSAP and CustomEase registration
- A paused master timeline in `window.__timelines[compositionId]`
- A final timeline extension step to force total duration
- HyperFrames runtime script

### Media output

- Images render as `<img>`.
- Video renders as timed `<video>`.
- Device presentation wraps media in a CSS device frame.
- Audio clips render as timed `<audio>`.
- Media paths preserve asset-bin subfolders.
- Unsafe asset paths are rejected even if validation is bypassed.

### Manifest

The manifest includes:

- Composition metadata
- Compiler version
- Project hash
- Per-scene hashes
- Scene start, pre-roll start, track, duration, transition, and camera
- Solver diagnostics
- Materialized layer labels and boxes
- Enter/exit/emphasis/continuous motion timing

### Incremental state today

The project has the foundations of incremental work:

- Stable project and scene hashes
- `changedSceneIds`
- Asset hash sidecars to avoid unnecessary copying
- Studio performance reporting for changed scenes

It does **not** yet have a persistent scene render cache or partial video
re-render/FFmpeg stitch. The full composition HTML is rebuilt and the Studio
recreates its player after every canonical project command.

## 15. Validation

Validation consists of:

1. Migration to the current schema
2. Zod schema parsing/default application
3. Referential and semantic checks

Checks include:

- Unique asset IDs, paths, and hashes
- Content-addressed ID correctness
- Valid brand logo reference
- Unique audio IDs and audio-kind assets
- Known, unique extension IDs
- Known motion profile
- Unique scene IDs
- Known archetypes and layouts
- Required and correctly typed slots
- Slot item limits
- Known media assets
- No unknown slot names
- Unique custom-layer IDs
- Valid custom-layer assets
- Valid choreography order
- Overrides targeting real layers
- Primitive existence and phase correctness
- Transitions targeting real scenes

Validation deliberately allows a project to disable an extension already used
by the existing graph. New commands and plans cannot newly select it.

## 16. Command API and store

There are **33 command types including `Batch`**.

### Scene commands

- AddScene
- RemoveScene
- ReorderScene
- SetSceneDuration
- SetSceneArchetype
- ReplaceScene
- SetSceneLayout
- SetSceneCamera
- SetChoreography
- SetSlotContent
- SetTransition

### Project and brand commands

- SetMotionProfile
- SetEnabledExtensions
- SetBrandColor
- SetBrandFont
- SetBrandLogo

### Layer commands

- OverrideLayerBox
- MoveLayer
- ResizeLayer
- SetLayerStyle
- SetText
- SetLayerOverride
- AddLayer
- RemoveLayer

### Motion commands

- SwapMotion
- AddMotion
- RemoveMotion
- SetMotionParam

### Asset/audio commands

- AddAsset
- RemoveAsset
- AddAudioClip
- RemoveAudioClip

### Composition command

- Batch

Every command:

- Is JSON-schema-like Zod validated
- Applies to a cloned project
- Returns an exact inverse
- Is revalidated through the store
- Can be journaled with a source label

The store:

- Deep-freezes accepted project state
- Keeps undo and redo stacks
- Clears redo on new apply
- Continues event sequence numbers from durable journal state
- Hashes state before and after every event
- Rejects commands referencing disabled extensions

## 17. Deterministic linter

The current linter contains **14 rules**:

| Rule | Purpose | Typical fix |
|---|---|---|
| `scene-duration-range` | Archetype duration heuristics | Clamp duration |
| `text-readability` | On-screen time based on word count | Extend scene |
| `settle-gap` | Hold after entrances before exit/cut | Extend scene |
| `simultaneity-cap` | No more than 3 concurrent entrances | Internal error if solver fails |
| `stagger-required` | Minimum sibling start separation | Apply profile stagger |
| `hero-loudest` | Supporting motion should not outlast hero | Informational |
| `copy-budget` | Archetype slot word budgets | Human/agent shortens copy |
| `safe-area` | Text/number inside 5% title-safe region | Move/resize box |
| `grid-snap` | Explicit horizontal geometry on 12-column grid | Snap box |
| `contrast` | At least 3:1 resolved contrast | Swap color token when possible |
| `motion-density` | Profile motion budget | Remove low-priority emphasis |
| `exit-coverage` | Exit-enabled profiles cover non-decor layers | Add profile exit |
| `duration-tiling` | Nominal tiling and valid transition overlaps | Adjust duration |
| `easing-whitelist` | Only registered runtime eases | Compiler/primitive error |

`applyAutoFixes` performs up to five passes through the store. Every successful
fix remains a normal journaled command.

## 18. Layout system

The layout system uses:

- 12 columns
- 5% horizontal title-safe margin
- A 24-pixel gutter scaled from 1920 width
- Fractional vertical positions
- Deterministic rounding

Helpers include:

- Grid box creation
- Grid metrics
- Nearest-grid snapping
- Full-bleed box
- Word counting

The Studio drag overlay currently snaps positions to a two-pixel lattice while
the linter offers true 12-column correction afterward.

## 19. Agent planning layer

### Plan schema

A plan contains:

- `motionProfile`
- 1 to 12 scenes

Each plan scene contains:

- Optional ID
- Archetype
- Optional layout
- Optional duration
- Typed slots
- Optional scene camera

Plans do not contain raw layer motion or manual timing. Those decisions are
filled deterministically.

### Planning prompt

The prompt includes:

- Versioned system instruction
- Enabled extension catalog
- Motion summaries and tags
- Archetype slots, layouts, and frame ranges
- Token values
- Brand and composition metadata
- Asset manifest and metadata
- Optional storyboard text
- Exact JSON output shape

The system prompt explicitly rejects:

- Prose around the JSON
- Raw HTML/CSS/JS/GSAP/keyframes
- Raw easing formulas
- Manual coordinates
- Unsupported 3D, cursor, ripple, match-cut, and micro-interaction syntax

### Plan application

`planToCommands`:

- Sets the motion profile
- Removes the current scenes
- Adds planned scenes with unique IDs
- Preserves brand, assets, meta, audio, and extension settings
- Wraps the whole replacement in one atomic Batch

One undo reverses the entire plan.

### Copy tightening

Model output is deterministically truncated to each archetype slot's word
budget before application.

### Plan caching

`planRunner` has an in-memory memoization cache keyed by:

- Provider
- Brief
- Brand
- Asset IDs, hashes, and metadata
- Extension settings
- FPS

The cache is process-local. It is not persisted and does not explicitly
include a prompt/catalog version, so registry-summary changes during one long
process deserve care.

### Structured zero-token planning

The structured brief contains:

- Product name
- Audience
- Promise
- 1-3 features
- CTA
- Vibe from 0 to 100

The deterministic planner chooses:

- warm-startup at low vibe
- crisp-saas at medium vibe
- bold-launch at high vibe

It creates a hook, product feature scene when media exists, and CTA. It can
therefore generate useful direction options without any provider call.

### Direction variants

Up to three directions are derived by:

- Varying the motion profile
- Varying the opener layout
- Keeping the same base narrative plan

The current Studio direction picker is textual. It does not yet render still
or video thumbnails for each direction.

## 20. Natural-language tweaks

The deterministic matcher currently recognizes common requests for:

- Bigger or smaller selected text
- Slower/longer or faster/shorter selected scene
- More launch energy
- Warmer/calmer motion
- Crisper/SaaS-like motion
- Crossfade
- Hard cut
- Wipe
- Slide-push
- Accent-colored text
- Pop/pulse emphasis
- Removing emphasis
- Center layout

When no deterministic match is confident:

- A provider receives the selected scene, selected layer, project profile,
  and a tool-shaped command request.
- The returned JSON command list is validated against `CommandSchema`.
- Commands are applied atomically when there is more than one.

The provider API currently falls back to prompt-embedded tool descriptions
rather than implementing provider-native tool calls.

## 21. Agent providers

The provider registry contains:

1. `codex-cli`
2. `claude-code-cli`
3. `anthropic-api`
4. `openai-api`

CLI providers are first because they reuse local subscription authentication
and require no API key.

### Codex CLI

- Finds `codex` on PATH
- Runs `codex exec`
- Uses read-only sandbox mode
- Writes the final message to a temporary file
- Passes the prompt over stdin
- Supports model and reasoning-effort overrides

### Claude Code CLI

- Finds `claude` on PATH
- Runs print mode
- Passes the prompt over stdin
- Supports model and effort overrides

### OpenAI API

- Uses `OPENAI_API_KEY` or a per-request key
- Calls `/v1/chat/completions`
- Supports a configurable model and low/medium/high reasoning mapping

### Anthropic API

- Uses `ANTHROPIC_API_KEY` or a per-request key
- Calls `/v1/messages`
- Supports configurable model and adaptive thinking/effort

Keys passed from the Studio are stored only in browser localStorage and sent
for the current request. The server does not write them to project state.

Provider and model names are hardcoded configuration surfaces and will require
ongoing maintenance as external CLIs/APIs evolve.

## 22. MCP server

The MCP server is a hand-written, newline-delimited JSON-RPC 2.0 stdio server.

Protocol version: `2025-06-18`

It handles:

- initialize
- ping
- tools/list
- tools/call

It exposes **11 tools**:

1. `get_planning_context`
2. `submit_plan`
3. `get_project_outline`
4. `get_scene`
5. `apply_commands`
6. `lint_report`
7. `autofix`
8. `undo`
9. `redo`
10. `render_preview`
11. `render`

The MCP planning context now includes a capped storyboard serialization. An
older note in `STORYBOARD_AI_PLAN.md` saying MCP plans without storyboard
context is no longer accurate.

MCP mutations:

- Synchronize against disk
- Acquire the same project write lock as Studio/CLI
- Use the same ProjectStore
- Commit journal and snapshot
- Rebuild the project
- Refuse to overwrite a newer external snapshot

The bundled `skills/sequences/SKILL.md` instructs agents to plan, lint,
autofix, preview, edit through commands, and render only after previews.

## 23. Host-side project integrity

### Atomic project writes

`saveProject`:

- Writes a temporary file
- fsyncs it
- Renames it over `project.json`
- Attempts a directory fsync where supported

### Cross-process write lock

Studio, CLI, and MCP serialize writes through `.sequences-write.lock`.

The lock:

- Is created exclusively
- Contains PID, token, and timestamp
- Checks whether its owner process is alive
- Recovers stale/dead-owner locks
- Polls every 25 ms
- Times out after 10 seconds by default
- Removes only the lock owned by the current token

### Build publication

Normal builds:

- Compile into a unique temporary build directory
- Validate and copy assets
- Write HTML and manifest
- Copy vendor files
- Preserve existing thumbnails
- Atomically swap the temporary directory into `build/`
- Restore the prior build if publication fails

Studio preview builds may tolerate registered assets missing on disk and add a
lint-like warning. CLI/render builds remain strict.

### Asset containment

The host:

- Resolves project-relative paths under the project root
- Rejects path traversal
- Resolves real paths to detect symlink escapes
- Preserves nested asset-bin paths
- Uses SHA-256 sidecars to skip unchanged asset copies

## 24. Asset metadata and import

Supported Studio import extensions:

- Images: PNG, JPEG, WebP, SVG
- Video: MP4, WebM
- Audio: MP3, WAV, OGG

The metadata extractor supports:

- PNG dimensions
- JPEG dimensions
- SVG dimensions or viewBox
- SVG text extraction as OCR-like context
- SVG fill/stroke dominant colors
- Lightweight sampled PNG dominant colors
- Video/audio dimensions and duration through ffprobe
- File size/MIME/cache hints

Imports:

- Copy into `assets/` or a selected bin
- Avoid filename collisions with numeric suffixes
- Hash the copied bytes
- Deduplicate by content hash
- Register through `AddAsset`
- Remove the copied file if registration fails

Moving an asset between bins copies the file and atomically removes/re-adds the
same asset record at the new path. The old file intentionally remains so undo
cannot reference missing bytes.

## 25. Rendering and thumbnails

### Rendering

Supported formats:

- MP4
- WebM
- MOV
- PNG sequence

Quality levels:

- draft
- standard
- high

Rendering:

- Requires FFmpeg
- Auto-discovers FFmpeg on PATH or common Windows winget locations
- Auto-discovers Edge/Chrome/Chromium
- Allows explicit browser override
- Builds into an isolated temporary directory
- Uses `@hyperframes/producer`
- Forces software GPU and screenshots for determinism
- Supports worker count
- Publishes output atomically inside the project directory
- Rejects output paths or symlink parents outside the project

Finished video renders can receive a poster JPEG extracted by FFmpeg.

### Scene thumbnails

Scene thumbnails:

- Build the real composition in an isolated temporary directory
- Serve it on an ephemeral localhost port
- Strip the HyperFrames runtime
- Open the page with Puppeteer
- Seek the registered GSAP timeline directly
- Apply clip visibility from timing attributes
- Capture the midpoint of each scene
- Publish to `build/thumbs/<sceneId>.png`

Primitive probes construct one scene per primitive and use the same capture
path.

## 26. Local Studio server

The Studio uses plain `node:http` and binds only to `127.0.0.1`.

### Boundary checks

Every request checks:

- Host header matches the actual localhost port
- Origin, when present, is the matching localhost origin
- `Sec-Fetch-Site` is not cross-site

Other protections:

- JSON/storyboard body cap: 16 MB
- Binary upload cap: 512 MB
- Safe path containment for builds, renders, assets, and vendor files
- `nosniff` headers
- SVG responses use a sandbox CSP
- Media supports HTTP Range requests

### API routes

Project/state:

- `GET /api/state`
- `GET /api/meta`
- `POST /api/project/open`
- `POST /api/project/new`
- `POST /api/project/demo`

Project library:

- `GET /api/projects`
- `POST /api/projects/folder`
- `GET /api/projects/poster`

Command/store:

- `POST /api/command`
- `POST /api/undo`
- `POST /api/redo`
- `POST /api/autofix`

Agent:

- `GET /api/agent`
- `POST /api/agent/plan`
- `POST /api/agent/directions`
- `POST /api/agent/apply-direction`
- `POST /api/agent/tweak`

Render/thumbs:

- `GET /api/render`
- `POST /api/render`
- `GET /api/renders/list`
- `GET /api/thumbs`
- `POST /api/thumbs`

Media/files:

- `GET /api/fs`
- `GET /api/fs/file`
- `POST /api/assets/import`
- `POST /api/assets/upload`
- `POST /api/assets/svg`
- `POST /api/assets/move`
- `POST /api/assets/folder`
- `GET /api/assets/folders`

Sidecars:

- `GET /api/design`
- `PUT /api/design`
- `GET /api/storyboard`
- `PUT /api/storyboard`
- `GET /api/storyboard/text`

Static/dynamic resources:

- `/build/...`
- `/renders/...`
- `/assets/...`
- `/ext-preview/...`
- HyperFrames player vendor file
- Excalidraw vendor assets

### Studio state payload

The state payload includes:

- Canonical project
- Project paths
- Manifest
- Lint findings
- Undo/redo availability
- Event count and recent events
- Build version
- Render state
- Agent state
- Thumbnail state
- Last command-to-preview build time
- Changed scene IDs
- 300 ms performance budget

## 27. CLI

The `sequences` CLI currently supports:

- `init`
- `compile`
- `lint`
- `render`
- `thumbs`
- `plan`
- `tweak`
- `preview`
- `providers`
- `mcp`
- `studio`
- `app`
- `exe`

Notable options:

- `init --name --showcase`
- `lint --fix`
- `render --output --format --quality --workers --browser`
- `thumbs --primitives`
- `plan --provider`
- `tweak --scene --layer --provider`
- `studio/app --port`

Port selection probes up to 20 consecutive ports when the requested port is
busy.

`app`/`exe` mode launches Chrome or Edge with `--app=<local URL>` and stores
the browser profile under the user's home directory, not inside the project.

## 28. Studio UI

The Studio is a desktop-first, dark graphite/silver editor. The current design
system intentionally keeps the chrome monochrome so project output remains the
only strong color.

### Main Menu

The launcher:

- Opens before the workspace unless `?workspace=1` is present
- Reads a local project library, defaulting to `~/Sequences`
- Supports nested organizing folders
- Pins the bundled Pulse demo
- Shows project posters when available
- Creates projects
- Creates folders
- Opens arbitrary existing project paths

`SEQUENCES_LIBRARY_DIR` can move the library.

### Workspace pages

There are seven top-bar pages:

1. References
2. Media
3. Design
4. Storyboard
5. Timeline
6. Render
7. Extensions

Panel sizes are resizable, persisted in localStorage, and reset on
double-click.

### References page

Current state: honest future-facing shell.

It describes planned categories:

- Websites
- Motion examples
- Example projects

It has no pin/import/scrape implementation yet.

### Media page

Current functionality:

- Read-only local disk browser
- Project/home/drive roots
- Breadcrumb and typed path navigation
- Media-only listing
- Click to preview
- Double-click to import
- Drag disk entries into the pool or bins
- Drag operating-system files into the pool
- Image/video/audio viewer
- Image/video zoom from 25% to 400%
- Video/audio play, pause, skip, loop, mute, and time display
- Asset bins backed by folders under `assets/`
- Create bins
- Move registered assets between bins
- Pool selection and preview
- Usage display by scene
- Removal when not referenced

The file browser is intentionally broad because the server is local-only. It
can read arbitrary media directories available to the user account.

### Design page

The Design page is a fixed 1280x720 SVG asset editor.

Tools:

- Select/move/resize
- Rectangle
- Ellipse
- Line
- Text
- Clear

Editable properties:

- Solid fill
- Two-color gradient
- Gradient angle
- Stroke color and width
- Corner radius
- Opacity
- Geometry
- Text content
- System font
- Font weight
- Font size
- Stacking order
- Duplicate
- Delete

Interaction:

- Pointer creation/move/resize
- Arrow-key nudging
- Shift-arrow larger nudging
- Keyboard tool shortcuts
- Ctrl/Cmd+D duplicate
- Delete/backspace removal
- Scratch autosave to `design.json`
- Export to `assets/design/<name>.svg`
- Export registration through the normal asset command path

Only system fonts are available.

### Storyboard page

The Storyboard page embeds Excalidraw on a locked virtual 1280x720 stage so
coordinates remain stable across machines and window sizes.

Tools:

- Selection
- Freehand
- Eraser
- Rectangle
- Diamond
- Ellipse
- Arrow
- Line
- Text
- Place image from media pool
- Motion path
- Clear

Frame operations:

- Add
- Select
- Reorder by buttons or drag/drop
- Delete while preserving at least one frame
- Automatic renumbering
- Debounced save

Agent-facing features:

- Frame-level beat note
- Per-element comment
- Double-click prompt for non-text elements
- Asset ID embedded in placed images
- Motion-path arrow attached to a selected target
- Motion path rendered as a dashed accent arrow
- Copy deterministic storyboard text
- Storyboard text automatically included in Studio plan requests
- Storyboard text included in MCP planning context

Text selection supports an eight-font Excalidraw catalog and size adjustment.
The storyboard can currently place image assets, not video/audio assets.

### Storyboard serializer

The serializer currently emits:

- Sequential frame headings
- Frame notes
- Freehand stroke counts
- Text, shape, media, arrow, and line descriptions
- Raw coordinates/sizes
- Element comments as intent
- Motion paths as target movement from point to point, including via points

It is deterministic and useful, but it does not yet provide:

- Semantic grid regions
- Containment/grouping
- Reading order
- Relative text hierarchy
- Frame-to-frame correspondence
- Motion direction/curvature summaries
- Priority-aware token budgeting
- Multimodal frame images

### Timeline page

Layout:

- Agent panel on the left
- Viewer in the center
- Inspector on the right
- Timeline along the bottom

Viewer/transport:

- Real HyperFrames player
- Play/pause
- Scrub
- Timecode and frame count
- Arrow-key frame stepping
- Shift-arrow ten-frame stepping
- Title-safe overlay
- Direct layer position mode
- Current resolution

Timeline:

- Time ruler
- Scene blocks proportional to duration
- Optional captured thumbnail backgrounds
- Selected-scene layer lanes
- Enter/exit/continuous motion labels
- Camera lane
- Drag scene body to reorder
- Drag right edge to retime
- Add-scene menu
- Scene and layer selection
- Playhead synchronized to player time

Inspector tabs:

- Scene
- Layers
- Brand
- Media

Scene inspector:

- Layout
- Duration
- Transition
- Stagger
- Camera move
- Camera scale token
- Typed slot editors
- Reorder buttons
- Remove scene

Layer inspector:

- Materialized layer identity, role, rank, and timing
- Enter primitive picker
- Enter duration token
- Reset sparse overrides

Brand inspector:

- Five semantic colors
- Display/body font names
- Motion profile
- Read-only composition size and FPS

Media inspector:

- Asset overview and usage
- Link to the full Media page

Direct layer positioning:

- Uses manifest geometry rather than reaching into compiled iframe DOM
- Clamps movement to canvas bounds
- Sends one `OverrideLayerBox` command on release

### Agent panel

Features:

- Provider selector
- Provider setup/detection
- Browser-local API key fields
- Hardcoded model preset menus
- Thinking/effort selector
- Freeform plan brief
- Structured zero-token brief
- Natural-language tweak action
- Async planning status and polling
- Chat-like session log
- One-batch/one-undo messaging

### Render page

Features:

- MP4/WebM/MOV format selection
- Draft/standard/high quality
- Read-only resolution and duration
- Async render launch and polling
- Render history
- Finished-video player
- Thumbnail-backed scene strip

PNG sequence exists in the CLI/server render API but is not offered in the
Render page's format picker.

### Extensions page

Features:

- Search
- Category filters
- 28 installed primitive/archetype/profile/camera cards
- Per-project enable/disable
- Undoable `SetEnabledExtensions`
- Keyboard card activation
- Live compiled preview modal
- Loop/replay controls

Extension previews use the actual compiler, solver, primitives, player, and
vendor scripts rather than GIFs or static mockups.

Important asymmetry: the full registry also contains transitions and a token
set, but the Extensions page does not display them. Because
`SetEnabledExtensions` governs the whole registry, this relationship should be
reviewed before the extension model is considered final.

### Status bar

Displays:

- Linter state and fixable count
- Lint popover with all findings
- Auto-fix all
- Project file path
- Solver scene count
- Journal operation count
- Recent events with source
- Build version
- Duration/FPS
- Command-to-preview time
- Dirty-scene count

## 29. Current examples and artifacts

### `examples/demo-promo`

Current canonical project:

- Title: Pulse
- Schema: 3
- Canvas: 1920x1080 at 30 fps
- Duration: 664 frames / 22.13 seconds
- Profile: `crisp-saas`
- Scenes: 6
- Assets: 3
- Audio clips: 0
- Explicitly enabled extension cards: 28
- Linter: clean

Scenes:

| Scene | Archetype/layout | Frames | Camera | Transition after |
|---|---|---:|---|---|
| `cold-open` | hook-opener/left | 115 | - | profile default |
| `screen-slam` | feature-reveal/media-right | 116 | pushIn | profile default |
| `stat-snap` | stat-callout/default | 97 | pushIn | crossFade |
| `side-whip` | feature-reveal/media-left | 116 | pullBack | profile default |
| `deck-break` | hook-opener/center | 103 | - | crossFade |
| `launch-sting` | logo-sting-cta/default | 117 | - | final |

Sidecars:

- One storyboard frame
- Six current Design scratch rectangles

Existing render area:

- Two finished MP4 files
- Two poster JPEGs
- One older HyperFrames work directory with 292 captured frame files
- Roughly 31.6 MB total render data

### `projects/Starter`

Raw on-disk project:

- Schema: 1, migrated on load
- 4 scenes
- 441 frames / 14.7 seconds
- `crisp-saas`
- One dashboard asset

It is used for:

- Golden render determinism
- Primitive thumbnail CI
- Migration compatibility

Its build directory contains generated HTML, manifest, vendors, asset copies,
scene thumbnails, and primitive thumbnails.

### Local upstream/reference trees

- `hyperframes/`: a sizeable ignored upstream checkout used for substrate
  inspection and research; the application depends on npm packages, not this
  directory.
- `excalidraw/`: a small ignored local reference/notes directory; the
  application depends on the npm Excalidraw package.

## 30. Tests and verification

The following were run successfully against this exact working tree on
June 21, 2026.

### Type checking

```text
npm run typecheck
PASS
```

### Unit/integration/property tests

```text
npm test
23 test files passed
152 tests passed
```

Coverage themes include:

- Token/schema synchronization
- Command schema and exact inverse round-trips
- Store immutability, undo/redo, validation, and sequencing
- Property-based arbitrary edit sequences
- 30/60-fps duration preservation
- Solver rank, overlap, stagger, cap, exits, and determinism
- Project validation and injection/path safety
- Compiler purity and HTML escaping
- HyperFrames' own linter
- Transition conformance for all transition IDs
- Linter rules and auto-fix convergence
- Plan parsing, prompt shape, disabled extensions, and atomic application
- Structured briefs and zero-token tweaks
- 15 canonical planning evaluations
- Registry manifests and strict primitive parameter schemas
- Live extension preview compilation
- Migration and Phase-1 completion contracts
- Asset metadata
- Project IO integrity, locking, crash recovery, and isolated builds
- Render output containment
- Studio server Host/Origin/body/SVG/preview boundaries
- MCP stdio round trips and external-write synchronization
- Workspace library, media, design, and storyboard services

The only test-run noise was HyperFrames package source-map warnings pointing to
missing upstream source files. The tests themselves passed.

### Performance

```text
npm run test:perf
command-to-compile p95: 1.47 ms
budget: 300 ms
PASS
```

This benchmark covers one command plus core compile on the default fixture. It
does not include disk build publication, browser player reload, or video
rendering.

### Golden render determinism

```text
npm run test:golden
4 scene thumbnails matched exactly across two captures
PASS
```

### Primitive visual probes

```text
node apps/studio/src/cli.ts thumbs projects/Starter --primitives
16 primitive thumbnails generated
PASS
```

### Browser smoke suites

All three manual browser suites passed against a live Studio:

- `ui-smoke.mjs`
  - Timeline shell
  - Player
  - Scene selection
  - Inspector tabs
  - Lint/events popovers
  - Project menu
  - Agent setup/provider state
- `ui-smoke2.mjs`
  - Playback
  - Frame stepping
  - Real reorder command
  - Journal increment
  - Undo
  - Add-scene menu
  - Profile menu
- `ui-smoke3.mjs`
  - Main Menu
  - All seven pages
  - Media browser/viewer/pool
  - Design drawing
  - Excalidraw mount/remount
  - Storyboard frame add/remove
  - Render page
  - 28 extension cards
  - Extension enable/undo
  - Live extension preview

The smoke scripts' temporary demo mutations were removed after verification.

### CI

`.github/workflows/ci.yml` runs on push and pull request with Node 22:

1. `npm ci`
2. typecheck
3. all tests
4. performance budget
5. golden render determinism
6. primitive probe thumbnails

The browser smoke suites are not currently part of CI.

## 31. Important gaps, limitations, and risks

### Motion taste remains first-pass

The architecture can enforce consistency, but the actual token curves,
distances, scale choices, archetype geometry, and profile assignments still
need sustained visual tuning against real videos. The three highest-leverage
taste files remain:

- `tokens.ts`
- `registry/profiles.ts`
- `registry/archetypes.ts`

### System-font portability

Projects store font-family names and use system fonts. Cross-machine renders
can therefore differ. There is no bundled-font asset pipeline, font embedding,
font license management, or missing-font linter warning.

### Audio is core-capable but UI-light

The schema, commands, validation, assets, and compiler support audio clips.
The Studio does not expose:

- Add/remove audio clip UI
- Audio timeline lanes
- Trimming
- Waveforms
- Beat detection
- Beat snapping
- Voiceover/caption workflows
- Ducking/mix automation

### Video support is uneven in the editor

The core, compiler, media page, structured planner, and asset system support
video. The Timeline scene-slot inspector currently lists image assets only,
which prevents straightforward manual assignment of a video to a media slot
from that inspector.

### Camera is intentionally simple

Only full-scene pushIn/pullBack scaling exists. There are no:

- Pan tracks
- Multi-beat camera scripts
- Region targets
- Rotation
- Keyframes
- Snap zoom
- Motion-blur-aware camera moves

### Transition planning is limited

The plan schema does not contain transition intent. Transitions come from the
profile default or later direct commands. Shader metadata exists, but preview
uses a fallback rather than a true shader renderer.

### Extension model asymmetry

The registry has 37 entries, but the Studio skill list manages 28. Transition
and token-set enablement is not represented in the page. This can make the
meaning of an explicit `extensions.enabled` list less obvious than the UI
suggests.

### Incremental rendering is not implemented

Scene hashes and dirty IDs exist, but there is no:

- Per-scene frame cache
- Transition-overlap cache invalidation
- Partial producer render
- FFmpeg concatenation of unchanged ranges

The live player is also recreated after each build.

### Event history is not a persistent editing timeline

Crash replay exists, but undo/redo history does not survive restart. There is
no event-log browser beyond the recent session events shown by Studio, and no
branch/version model.

### Storyboard semantics are still low-level

The storyboard serializer is comment-forward and motion-path-aware, but still
leans on raw geometry. It does not deterministically translate the drawing
into the same semantic vocabulary the planner emits.

### Design is an asset editor, not a scene/archetype designer

The current Design page exports flat SVG assets. It does not create reusable
archetypes, normalize layouts onto the scene schema, generate assets, separate
layers, or animate the design itself.

### References is not functional

There is no URL capture, reference board persistence, website scraping,
motion-reference import, or template-gallery integration.

### Agent robustness

Missing or incomplete areas:

- No automatic validator-error repair retry for provider plans
- No durable provider result cache
- No model eval against real provider outputs in CI
- Provider-native structured output/tool calling is not implemented
- Hardcoded model lists/defaults can age
- Direction variants do not have visual previews
- No streaming provider output

### Rendering quality/performance gates

The repository does not currently measure:

- Full 20-second render time in CI
- Encoder-quality regressions
- Audio/video sync
- Cross-platform pixel equivalence
- GPU versus software-render differences
- Browser-version drift

### Generated bundle size and source hygiene

`storyboard-excalidraw-bundle.js` is tracked and very large. Changes produce
massive diffs. A clearer generated-artifact policy, reproducibility check, or
release asset strategy would make review easier.

### Documentation status

The documentation was reconciled on June 21, 2026:

- `README.md` is the public entry point.
- `CURRENT_STATE.md` is the exhaustive implementation snapshot.
- `UI_REWRITE_PLAN.md` records the active Phase 1.5 decision.
- `DESIGN.md` separates durable design principles from layout hypotheses.
- Local planning documents carry status notes and no longer claim known-fixed
  gaps such as missing MCP storyboard context.
- The two raw research exports were replaced by one source-checked,
  explicitly non-canonical `MOTION_RESEARCH.md`.

Historical sections of the master plan still preserve original estimates and
rationale. Current implementation facts in this document take precedence.

## 32. Research and technique opportunities

The current system already implements the foundation for several research
ideas:

- T1: token-quantized motion space
- T2: deterministic choreography solver
- T3: deterministic linter with command fixes
- T4: constrained plan/fill agent boundary
- T5: shared command algebra for human and agent editing
- Partial T10 foundation: content hashes and dirty-scene detection

The strongest next research directions are below.

### 1. Semantic storyboard encoding

Highest near-term leverage because the storyboard already exists.

Add deterministic:

- 12-column region descriptions
- Upper/middle/lower-third classification
- Relative size classes
- Text hierarchy from relative font size
- Shape containment
- Reading order
- Media-role identification
- Emphasis-ring detection
- Arrow relationship descriptions
- Frame-to-frame element correspondence
- Motion direction, distance, and curvature summaries

This moves storyboard context into the planner's own vocabulary without adding
another model pass.

### 2. Motion-system tuning as measured research

Build a corpus of reference SaaS motion and evaluate:

- Token duration distributions
- Entrance overlap distributions
- Hero/support duration ratios
- Motion-density preference
- Cut/transition frequency
- Camera usage frequency
- Readability and hold timing

Then tune the token/profile tables and validate with:

- Blind preference tests
- Golden visual diffs
- Linter pass rates
- Tweak frequency after generation

### 3. Full camera scripts

Extend scene camera from one full-scene scale to tokenized camera beats:

- Establish
- Push
- Punch
- Release
- Pan across a target region

Bind targets to materialized layer boxes or decomposed screenshot regions.
Keep geometry deterministic and let the planner choose the script.

### 4. FLIP match cuts

Use the scene graph to score correspondence by:

- Same asset
- Same slot role
- Similar shape
- Similar position
- Explicit match hint

Compile a transition overlay that interpolates first/last boxes and style while
the scenes transition underneath.

### 5. Screenshot layer decomposition

Introduce a separate service for:

- Qwen-Image-Layered decomposition
- SAM-style manual refinement
- Inpainting hidden regions
- Semantic labels
- Hierarchy ranks

Import accepted layers as normal custom image layers so the existing solver,
linter, camera, and command system continue to work.

### 6. Beat-aligned audio retiming

Add deterministic onset/beat analysis and allow:

- Scene boundaries to move within readability/duration budgets
- One emphasis hit per scene to snap to an onset
- Profile density to react to music energy

Keep it a constraint pass, not a regeneration pass.

### 7. Taste vectors from the event journal

Reduce accepted edits into transparent preference weights:

- slower/faster bias
- primitive replacements
- removed emphasis
- preferred layouts
- avoided transitions

Use those weights to rerank profile defaults for a project or brand without
training a model.

### 8. Contact-sheet visual critic

Render representative frames into one contact sheet and make an optional,
structured multimodal critique pass. Suggested changes should be validated
typed commands requiring user approval.

Measure acceptance rate before making it default.

### 9. True incremental render cache

Use the existing scene hashes to cache:

- Frame ranges
- Audio ranges
- Transition handles
- Scene thumbnails

Re-render only dirty scenes and adjacent overlap windows, then stitch with
FFmpeg.

### 10. Scene Designer as archetype authoring

Generate or manually design a layout once, then normalize it into:

- Typed slots
- Grid boxes
- Brand/type tokens
- Hierarchy ranks
- Layout variants
- Copy budgets

The output should become a normal registry archetype rather than arbitrary
runtime HTML.

### 11. Brand inference and color assistance

The master plan explicitly notes that color selection needs help.

Potential deterministic/assisted pipeline:

- Extract CSS variables and computed colors from a URL
- Cluster screenshot colors
- Infer semantic roles
- Check contrast and accent scarcity
- Suggest palettes rather than silently applying them
- Store provenance and confidence

### 12. Provider and prompt research

Evaluate:

- Native structured output versus JSON extraction
- Provider-native tool calls for tweaks
- One-shot plan versus plan-repair loop
- Prompt catalog size versus plan accuracy
- Extension-vocabulary size versus invalid selections
- Storyboard text versus storyboard image channel
- Structured brief versus freeform brief cost and quality

## 33. Recommended near-term order

The active order is now:

1. Inventory every current UI control, command, state, and workflow.
2. Prototype the preparation, direction-selection, editing, lint/review, and
   render journeys at low fidelity.
3. Validate navigation, progressive disclosure, and button placement before
   committing to a frontend implementation.
4. Build the new shell while preserving the command/store/compiler boundaries.
5. Migrate current capabilities by workflow importance and add end-to-end UI
   coverage.
6. Tune motion tokens/profiles and close editor parity gaps inside the new UX.
7. Resume semantic storyboard, camera, audio, cache, visual-critic, and taste
   research only when each capability has an intentional product surface.

## 34. Root scripts

```text
npm test               Run all Vitest tests
npm run test:watch     Watch tests
npm run typecheck      Strict TypeScript check
npm run test:perf      Command-to-compile p95 budget
npm run test:golden    Two-pass deterministic scene thumbnail comparison
npm run test:ci        Typecheck + tests + performance
npm run build:storyboard
                       Rebuild the Excalidraw browser bundle
npm run studio         Open the Pulse demo in app mode
npm run studio:app     Same app-mode entry
npm run studio:exe     Alias to app/exe mode
npm run studio:web     Serve the Pulse demo as a normal local site
npm run compile:example
                       Compile the Pulse demo
npm run render:example Render the Pulse demo
```

## 35. File-by-file guide

### Root configuration and documentation

- `package.json`: npm workspaces, executable mapping, scripts, Node floor, and
  root React/Excalidraw/tooling dependencies
- `package-lock.json`: exact dependency resolution
- `tsconfig.base.json`: strict NodeNext/ES2023/type-stripping constraints
- `tsconfig.json`: first-party TypeScript include set
- `vitest.config.ts`: core/Studio test discovery and HyperFrames dependency
  inlining
- `.gitignore`: generated builds/renders, dependencies, app profiles, local
  upstream/reference trees, and several local planning documents
- `.github/workflows/ci.yml`: Node 22 CI quality gates
- `README.md`: public product overview, setup, architecture, and direction
- `CLAUDE.md`: engineering laws, substrate contract, and contributor rules
- `DESIGN.md`: durable visual language, tokens, and rewrite hypotheses
- `UI_REWRITE_PLAN.md`: active Phase 1.5 workflow and UI rewrite plan
- `README_dev.md`: local developer implementation guide
- `SEQUENCES_MASTER_PLAN.md`: product, architecture, research, and launch plan
- `STORYBOARD_AI_PLAN.md`: post-rewrite storyboard semantic/multimodal roadmap
- `LICENSE`: Apache License 2.0

### Core source

- `brief.ts`: structured brief schema and deterministic brief-to-plan mapping
- `commands.ts`: complete command schema, reducer, inverse generation, and
  extension gating
- `compiler.ts`: Project-to-HyperFrames HTML/manifest compiler
- `defaults.ts`: default and showcase project factories
- `directions.ts`: deterministic three-direction derivation
- `extensionPreview.ts`: real miniature projects for live registry previews
- `hashing.ts`: stable object normalization and SHA-256 content hashes
- `index.ts`: public core exports
- `layout.ts`: 12-column layout and snap helpers
- `linter.ts`: 14 motion/project quality rules and auto-fix loop
- `materialize.ts`: archetype/profile/override expansion
- `migrations.ts`: schema migration to v3
- `plan.ts`: plan schema, prompt, catalog context, parsing, JSON extraction,
  and plan-to-command conversion
- `quality.ts`: structural similarity and percentile helpers
- `schema.ts`: canonical Zod project schema
- `solver.ts`: choreography scheduling
- `store.ts`: validated immutable store, undo/redo, event emission
- `tokens.ts`: motion, type, color, and solver token lattice
- `tweak.ts`: zero-token natural-language matcher
- `validate.ts`: schema and referential validation

### Registry

- `archetypes.ts`: 7 deterministic scene layouts
- `camera.ts`: 2 scene-level camera definitions
- `index.ts`: registry aggregation, manifests, extension lists, and prompt
  catalog
- `primitives.ts`: 16 GSAP-step motion primitives
- `profiles.ts`: 3 role-to-motion selection tables
- `tokenSets.ts`: built-in token-set plugin
- `transitions.ts`: 8 transition plugin definitions
- `types.ts`: primitive/archetype/profile/emission contracts

### Studio host

- `agent/providers.ts`: CLI/API provider abstraction and detection
- `agent/planRunner.ts`: provider request, cache, parse, and apply pipeline
- `agent/tweakRunner.ts`: zero-token/model tweak pipeline
- `agentConfig.ts`: provider re-export surface
- `assetMetadata.ts`: hashes, dimensions, colors, OCR-like SVG text, ffprobe
- `cli.ts`: all CLI commands
- `desktopApp.ts`: Chrome/Edge app-window launcher
- `mcp.ts`: stdio MCP server and 11 tools
- `projectIo.ts`: load/save/recovery/locking/build publication
- `projectTemplates.ts`: project initialization and demo path
- `render.ts`: browser/FFmpeg discovery and Producer execution
- `server.ts`: localhost API/static/media server and Studio state
- `thumbs.ts`: scene/primitive capture and poster extraction
- `workspace.ts`: project library, disk browser, asset import, sidecars, and
  storyboard serializer

### Studio browser UI

- `index.html`: application shell and panel/page hosts
- `app.js`: Timeline, player, inspector, agent, commands, status, and top bar
- `pages.js`: page switching, References, Render, and Extensions
- `launcher.js`: project-library launcher
- `media.js`: disk browser, viewer, pool, and bins
- `design.js`: SVG asset editor
- `storyboard.js`: storyboard page/frame/sidebar orchestration
- `storyboard-excalidraw-entry.ts`: React/Excalidraw bridge
- `storyboard-excalidraw-bundle.js`: generated browser bundle
- `resize.js`: persistent split-panel handles
- `styles.css`: primary Timeline/editor design system
- `pages.css`: launcher and non-Timeline page styling
- `templates/dashboard.svg`: starter screenshot asset

### Tests

Core tests cover agent evals, briefs/tweaks, commands, compiler, extension
previews, linter, completion contracts, plans, property tests, quality gates,
registry, solver, tokens, transitions, and validation.

Studio tests cover providers, asset metadata, MCP, project IO, render path
containment, server boundaries, thumbnail probes, and workspace services.

### Scripts

- `perf-budget.mjs`: 100 command-plus-compile samples and p95 gate
- `golden-renders.mjs`: exact two-pass scene-thumbnail hash comparison
- `ui-smoke.mjs`: Studio shell/browser inspection
- `ui-smoke2.mjs`: playback, command, undo, and menu interactions
- `ui-smoke3.mjs`: launcher and all seven workspace pages

### Project data, fixtures, and evaluations

- `examples/demo-promo/project.json`: current Pulse showcase graph
- `examples/demo-promo/events.log`: Pulse journal
- `examples/demo-promo/storyboard.json`: Pulse storyboard sidecar
- `examples/demo-promo/design.json`: Pulse Design scratch sidecar
- `examples/demo-promo/assets/`: dashboard, screenshot, and video media
- `examples/demo-promo/build/`: generated compiled example
- `examples/demo-promo/renders/`: current and historical rendered output
- `projects/Starter/project.json`: schema-v1 compatibility/golden fixture
- `projects/Starter/events.log`: starter journal
- `projects/Starter/storyboard.json`: starter storyboard sidecar
- `projects/Starter/assets/`: starter dashboard asset
- `projects/Starter/build/`: generated CI/golden/probe artifacts
- `evals/phase1-briefs.json`: 15 canonical structured planning briefs
- `skills/sequences/SKILL.md`: MCP workflow instructions for external agents

## 36. Bottom line

Sequences currently has a strong deterministic spine and a surprisingly broad
working editor around it. The critical architecture is present and green:

- Canonical typed graph
- One command pathway
- Exact inverses
- Validation gate
- Registry-driven motion vocabulary
- Deterministic materialization and scheduling
- One-way HyperFrames compiler
- Zero-token linter and fixes
- Agent/MCP parity
- Local rendering
- Real browser editor

The project is ready for a product-interface rewrite backed by a mature-enough
deterministic engine. The next meaningful gain is making the existing power
coherent, discoverable, and fast to operate. Better motion taste, semantic
visual intent, richer camera/audio constraints, portable assets/fonts, and
incremental rendering remain valuable, but they follow the Phase 1.5 interface
gate—not a broader model-authored animation surface.
