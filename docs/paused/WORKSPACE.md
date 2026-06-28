# CLAUDE.md — Sequences

Agent-first motion-graphics app for SaaS / app product video, built on
HyperFrames. Local-first, deterministic, **TypeScript everywhere**. An agent
plans a structured first pass from a constrained motion vocabulary; a
deterministic engine performs layout, choreography, validation, compilation and
local rendering; a small visual app keeps every change inspectable and
reversible.

This is the **single source of truth** for the project. The only other docs are
[PLAN.md](PLAN.md) (the active ground-up rewrite) and
[MOTION_RESEARCH.md](MOTION_RESEARCH.md) (source-checked motion-design research,
non-canonical). Documentation drift is a bug — when a contract changes, update
this file.

## What we are building (the rewrite)

The deterministic engine is robust and stays. The heavy 7-page studio is being
replaced by a **simple 3-pane desktop app**:

```
┌ Agent ───────┬ Viewer ────────────────┬ Inspector ──┐
│ Claude/Codex │  HyperFrames player    │ generic     │
│ CLI, auto-   │  + simple playback     │ tweaks to   │
│ connected.   │  (NO timeline)         │ the current │
│ Plans, diffs │                        │ animation   │
└──────────────┴────────────────────────┴─────────────┘
```

- **Shell:** Tauri 2 (OS webview, ~MBs) + the existing Node engine as a spawned
  sidecar. Cross-platform: macOS, Linux, Windows.
- **Frontend:** Svelte 5.
- **Dropped from the old studio:** timeline UI, Excalidraw storyboard, SVG
  design page, references page, the 7-tab navigation.
- **Kept wholesale:** `packages/core` (the entire deterministic spine) and most
  of `apps/studio`'s IO (project IO, render, thumbs, MCP, agent providers,
  server API surface, CLI).

Read [PLAN.md](PLAN.md) before starting rewrite work. Until a piece is migrated,
the current studio code still runs — don't delete it out from under itself.

## The 9 laws (these ARE the product — never break them)

1. **One mutation pathway.** Every project change goes through `applyCommand`
   (in practice `ProjectStore.apply`). UI drag, CLI, autofix, agent/MCP are the
   same typed command underneath. Never mutate a `Project` outside `commands.ts`.
2. **Compiler is one-way.** `compile(Project) → HTML`. Generated HTML is never
   parsed back; surface info via `Manifest`/`CompileResult`, not HTML parsing.
3. **Token purity (T1).** No raw motion/style numerics in the scene graph or
   primitives — a literal `duration: 0.4` is a hard error. New values go in
   `tokens.ts`, referenced by id. Schemas enumerate token ids; the
   `easing-whitelist` lint backstops the emit path.
4. **Validation gates the store.** A command whose result fails `validateProject`
   is rejected — the compiler never sees an invalid graph. Hard invariants →
   `validate.ts`; soft + fixable → the linter.
5. **Lint fixes are commands.** Logged, undoable, `source: "autofix"`. Never fix
   by mutating state.
6. **Inverses roundtrip exactly.** Every command returns an inverse where
   `apply(inverse(apply(p)))` deep-equals `p`. Add new commands to the `COMMANDS`
   list in `commands.test.ts`.
7. **Registry discipline (T7).** Primitives / archetypes / profiles / transitions
   exist only via `registry/types.ts`, each with a `summary` written like a senior
   briefing a junior — `promptCatalog()` builds the planner prompt from these, so
   code and prompt can never drift.
8. **GSAP stays behind the seam (T8).** Primitives emit `GsapStep` data; only the
   compiler serializes GSAP. This is the WAAPI/Motion-swap hedge.
9. **Extensions scope the agent's vocabulary.** Registry entries are extensions;
   `project.extensions.enabled` (`null` = all, `[]` = none, or an explicit id
   list) gates what plans/commands may newly select. Disabling never invalidates
   existing scenes or uninstalls anything.

Two deliberate exceptions to law 1: `storyboard.json` and `design.json` were
portable *intent/scratch* sidecars, not canonical render state. (The rewrite
drops their editors; the sidecar concept may return as agent reference input.)

Where taste lives (subjective = data, three files only): `tokens.ts`,
`registry/profiles.ts`, `registry/archetypes.ts`. The golden snapshot
(`compiler.test.ts`) is a tripwire — change it on purpose with `npx vitest run -u`.

## Architecture & data flow

```text
brief / structured brief / references / assets
            │
            ▼   (agent: expensive plan, once)  ── law 1, 7
   typed plan  →  planToCommands  →  ProjectStore.apply
            │
            ▼
 schema-v3 Project JSON  (canonical; project.json + events.log journal)
            │
            ▼   materialize (archetype + profile + sparse overrides)
   MaterializedLayer[]
            │
            ▼   choreography solver (deterministic scheduling)
   timed scene graph
            │
            ▼   linter (zero-token critic + command fixes)  ── law 4, 5
   validated graph
            │
            ▼   compile()  →  HyperFrames HTML + paused GSAP timeline  ── law 2, 8
       ┌────┴────┐
       ▼         ▼
  live player   producer render (Chrome/Edge capture + FFmpeg) → mp4/webm/mov/png
```

The model **plans and selects**; deterministic code **performs motion design**.
The agent never writes HTML/CSS/JS/GSAP/keyframes/eases/coordinates — it chooses
named profiles, archetypes, layouts, slots, assets, durations, and camera moves.

## Layout

- `packages/core/` — `@sequences/core`: **pure, zero IO, zero UI deps.** Scene
  graph, tokens, registry, materialize, solver, compiler, linter, commands,
  store, validate, plan, brief, tweak, directions. All deterministic logic.
- `apps/studio/` — `@sequences/studio`: **all IO.** server, workspace, project
  IO, render, thumbs, MCP, agent providers, CLI, desktop launcher, and (being
  replaced) the vanilla-JS UI in `src/static/`.
- A project = a directory: `project.json` (canonical graph), `events.log`
  (append-only journal), `assets/`, `build/` (gitignored, regenerated),
  `renders/`.

```text
Sequences/
  packages/core/src/
    schema.ts          canonical zod Project schema (schema v3)
    migrations.ts      v1→v2→v3 pure migrations
    tokens.ts          ★ motion/type/color/solver token lattice (taste)
    registry/
      types.ts         primitive/archetype/profile/emission contracts (law 7)
      primitives.ts    16 GSAP-step motion primitives
      archetypes.ts    ★ 7 scene layouts (taste)
      profiles.ts      ★ 3 role→motion selection tables (taste)
      camera.ts        2 scene-level camera moves
      transitions.ts   8 transition plugins
      tokenSets.ts     built-in token-set plugin
      index.ts         registry aggregation, manifests, promptCatalog()
    materialize.ts     archetype + profile + sparse-override expansion
    solver.ts          deterministic choreography scheduling
    linter.ts          14 motion/project rules + auto-fix loop
    validate.ts        schema + referential validation (gates the store)
    commands.ts        ★ 33 command types, reducer, exact inverses (law 1,6)
    store.ts           validated immutable store, undo/redo, journal events
    compiler.ts        Project → HyperFrames HTML + manifest (law 2,8)
    hashing.ts         stable normalization + SHA-256 content hashes
    layout.ts          12-column grid + snap helpers
    plan.ts            plan schema, prompt, catalog, parse, planToCommands
    brief.ts           structured brief → deterministic plan
    directions.ts      deterministic 3-direction derivation
    tweak.ts           zero-token natural-language → command matcher
    extensionPreview.ts  miniature projects for live registry previews
    index.ts           public core exports
  apps/studio/src/
    server.ts          localhost API + static/media server, Studio state
    workspace.ts       project library, disk browser, asset import, sidecars
    projectIo.ts       load/save/recovery, write-lock, atomic build publish
    projectTemplates.ts project init + demo path
    render.ts          browser/FFmpeg discovery + Producer execution
    thumbs.ts          scene/primitive capture + poster extraction
    mcp.ts             stdio MCP server (11 tools)
    agent/providers.ts CLI/API provider abstraction + detection
    agent/planRunner.ts provider request → cache → parse → apply
    agent/tweakRunner.ts zero-token / model tweak pipeline
    assetMetadata.ts   dims, colors, OCR-ish SVG text, ffprobe
    cli.ts             the `sequences` CLI
    desktopApp.ts      app-window launcher (being replaced by Tauri shell)
    static/            ⚠ current vanilla-JS UI — replaced per PLAN.md
  examples/demo-promo/ "Pulse" showcase project (schema v3)
  projects/Starter/    schema-v1 migration + golden-render fixture
  evals/               canonical structured-brief planning evals
  scripts/             perf budget, golden renders, browser smokes
  skills/sequences/    MCP workflow skill for external agents
  hyperframes/         ⚠ gitignored local upstream checkout (research only)
```

## Substrate contract (HyperFrames — pinned `@hyperframes/*@0.6.86`)

Do **not** float the pin (upstream releases near-daily). Build *around* HF, never
fork it — the compiler being the single point of contact is the whole
drift-containment strategy. Reuse only `core` / `engine` / `producer` / `player`.

- `data-start` / `data-duration` are in **seconds**; `data-track-index` is z-order
  and same-track clips must not overlap in time.
- Root `#stage` carries `data-composition-id` / `-width` / `-height`.
- A paused GSAP timeline is registered at `window.__timelines["<id>"]`.
- Vendor scripts are copied beside compiled HTML.
- `compiler.test.ts` runs HF's own linter on our output — **keep it green; it is
  the substrate handshake.**

## The motion system (the moat)

Token lattice → primitives → archetypes → profiles. Counts today: **16
primitives, 7 archetypes, 3 profiles, 2 camera moves, 8 transitions, 1 token
set** (37 registry entries). The agent selects from these; it never authors.

- **Tokens** (`tokens.ts`): named duration / easing / distance / stagger / scale /
  blur / type / color values. 30-fps authored, scaled to preserve seconds at 60.
- **Primitives:** `enter.*` / `exit.*` / `emphasis.*` / `continuous.*`, each a
  pure `GsapStep` emitter with a params schema, tags, and a one-line summary.
- **Archetypes:** typed slots + copy budgets + layouts + duration heuristics +
  pure layer materialization + roles + `hierarchyRank` + grid geometry.
- **Profiles:** role → (enter, optional exit, optional continuous) selection
  tables + motion-density ceilings. (Number layers always use `enter.countUp`.)
- **Solver:** orders entrances by rank; staggers at `max(stagger, 65% of prev
  duration)`; caps concurrency at 3; schedules exits to finish at scene end.

### How agents produce GOOD motion (judgment, not taste)

Good animation is hard — the architecture, not the model, is what makes output
good. Four stacked mechanisms (see MOTION_RESEARCH.md and PLAN.md):

1. **Semantic selection, not parametric authoring.** The agent sees descriptions
   ("`enter.maskRevealUp` — clean confident reveal; best for headlines; pairs
   with crisp-saas"), never numbers. The catalog summaries are load-bearing.
2. **Relationships encoded as constraints, not suggestions.** Primitive tags +
   profile whitelists + linter rules make bad *combinations* unrepresentable.
3. **A deterministic critic.** Every compile runs the zero-token linter
   (readability, simultaneity cap, stagger, contrast, density, easing whitelist)
   with auto-fix. The agent's output has a critic that isn't the user's eyes.
4. **One source of truth, event-sourced.** Agent edits, drags, CLI, MCP are the
   same commands on the same JSON; undo / "revert what the agent just did" / diffs
   come free.

**The deterministic/agent boundary (cost discipline):** anything expressible as a
rule, table, or solver is deterministic (zero tokens) — layout, all timing, motion
execution, primitive assignment for standard cases, transition defaults, lint +
fixes, contrast, render, caching, undo. The expensive agent call (once per
project) does *only* the beat sheet: interpret the brief into ordered beats, pick
an archetype per beat, pick the one global profile. Cheap/occasional agent tier:
copywriting to slot budgets, NL-tweak→command, plan-repair on validation failure.

## Agent & MCP

Default agent path is **local CLI providers** (`claude-code-cli` / `codex-cli`) —
**NO API key**, reusing the user's existing subscription auth. API providers
(`anthropic-api` / `openai-api`) light up only with a key, never persisted.
Prompts go over **stdin, never argv**.

MCP (`mcp.ts`, stdio JSON-RPC, 11 tools): `get_planning_context`, `submit_plan`,
`get_project_outline`, `get_scene`, `apply_commands`, `lint_report`, `autofix`,
`undo`, `redo`, `render_preview`, `render`. MCP mutations take the same write
lock and ProjectStore as Studio/CLI and refuse to overwrite a newer snapshot.
External agents get the workflow from `skills/sequences/SKILL.md`.

## Commands

```powershell
npm test                 # vitest, full suite — must be green to finish
npm run typecheck        # tsc --noEmit (also gate before done)
npm run studio:web       # serve examples/demo-promo at http://localhost:4400
npm run test:perf        # command-to-compile p95 budget (300ms)
npm run test:golden      # two-pass deterministic scene-thumbnail hashes
npm run render:example   # render the demo to renders/*.mp4
node scripts/ui-smoke.mjs <port>   # headless DOM smoke (also 2/3); boot a studio first
npx sequences <init|compile|lint --fix|render|thumbs|plan|tweak|preview|providers|mcp|studio|app> <dir>
```

## Working rules (tuned to how this repo bites)

- **No build step / no bundler for the engine** (Node ≥22.18 strips types). So:
  explicit `.ts` import extensions; `erasableSyntaxOnly` (**no TS
  enums/namespaces/parameter-properties**); `verbatimModuleSyntax` (`import type`
  for types). The Svelte frontend has its own Vite build; the engine does not.
- **Finish the scope.** First-pass code here has historically shipped defects a
  review round later because tests exercised too narrow a path. Cover the
  full/real build path and edge cases before declaring done.
- **End every task green.** Run the full suite and confirm it passes before
  saying done — use the `/verify` skill. No declaring success on a partial run.
- **Tests stay isolated.** No test touches the real home dir or live state — use
  temp dirs. `SEQUENCES_LIBRARY_DIR` overrides the `~/Sequences` library.
- **Cross-platform paths.** Windows dev box (PowerShell). Watch separators; the
  compiler must not flatten binned asset hrefs (`assets/<bin>/x.png`).
- **Keep `{color.silver}` scarce; keep chrome monochrome** (see Design DNA).

## Design DNA (chrome)

Monochrome graphite + one neutral **silver** accent — **no chromatic brand hue,
no neon, no AI sparkle, no mesh.** The chrome is monochrome so the user's video is
the only color on screen. Vision: **After Effects × Cursor** — a docked
neutral-graphite shell fused with an agent rail, inspectable diffs, and a command
model. Color appears only where it means something (the preview, a lint state).

Durable tokens (mirror `styles.css` when implemented):

- **Graphite ladder:** `{color.canvas}` `#0a0b0d` (never `#000`) → `{color.surface}`
  `#0f1012` → `surface-raised` `#131518` → `surface-card` `#191c20` →
  `surface-active` `#21242a` → `surface-high` `#2a2e35`.
- **Silver (only accent):** `{color.silver}` `#c9cfd9` (selection/brand/active),
  `silver-hi` `#eef1f5` (focus/playhead/primary face), plus soft/mid/line alphas.
  Primary action = a silver **gradient**, one per viewport, maximum.
- **Lines:** hairlines `#1f2226` / `#282c32` / `#373c44` build depth; shadows only
  on floating layers (menus, modals, toasts).
- **Semantic (desaturated, functional only):** `good #79b88a`, `warn #d3b061`,
  `bad #d2796a`, `info #7c9fc4` — always paired with text/icon, never color alone.
- **Type:** neutral grotesque UI face (Inter / system stack), `ui-monospace` for
  everything precise (timecode, ids, tokens) with tabular figures. Brightness is
  hierarchy: ink `#e9ebee` → body `#a6abb4` → mute `#70757e` → faint `#4b4f56`.

Every component answers: does it **mutate, inspect, preview, or command** the
project? If it mutates, it maps to a typed command (law 1). Make every agent
change an inspectable, reversible diff — name the change, never "improved
animation."
