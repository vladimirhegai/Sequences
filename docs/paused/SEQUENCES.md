# SEQUENCES.md — Sequences application detail (paused)

> **Status: paused.** Active work is on **Forge** (see [FORGE.md](FORGE.md)).
> This file holds the Sequences-*application* detail that used to live in
> [CLAUDE.md](CLAUDE.md), moved out so the auto-loaded contract stays lean while
> Sequences is on hold. The shared engine laws, the HyperFrames substrate
> contract, and the repo working rules remain in CLAUDE.md because Forge depends
> on `packages/core` and produces `.seqext` output that flows through them.
>
> The deterministic engine (`packages/core`) is robust and stays. Read
> [PLAN.md](PLAN.md) before resuming Sequences rewrite work.

## Sequences: what we are building

The heavy 7-page studio is being replaced by a **simple 3-pane desktop app**:

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
  of `apps/sequences`' IO (project IO, render, thumbs, MCP, server API surface,
  CLI).

Until a piece is migrated, the current studio code still runs — don't delete it
out from under itself.

Two deliberate exceptions to law 1: `storyboard.json` and `design.json` were
portable *intent/scratch* sidecars, not canonical render state. (The rewrite
drops their editors; the sidecar concept may return as agent reference input.)

Where taste lives (subjective = data, three files only): `tokens.ts`,
`registry/profiles.ts`, `registry/archetypes.ts`. The golden snapshot
(`compiler.test.ts`) is a tripwire — change it on purpose with `npx vitest run -u`.

## Sequences architecture & data flow

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

The model **plans and selects**; deterministic code **performs motion design.**
The agent never writes HTML/CSS/JS/GSAP/keyframes/eases/coordinates — it chooses
named profiles, archetypes, layouts, slots, assets, durations, and camera moves.

## Sequences source layout (`apps/sequences/src/`)

```text
  apps/sequences/src/
    server.ts          localhost API + static/media server, app state
    workspace.ts       project library, disk browser, asset import, sidecars
    projectIo.ts       load/save/recovery, write-lock, atomic build publish
    projectTemplates.ts project init + demo path
    render.ts          browser/FFmpeg discovery + Producer execution
    thumbs.ts          scene/primitive capture + poster extraction
    mcp.ts             stdio MCP server (11 tools)
    agent/planRunner.ts provider request → cache → parse → apply
    agent/tweakRunner.ts zero-token / model tweak pipeline
    cli.ts             the `sequences` CLI
    desktopApp.ts      app-window launcher (being replaced by Tauri shell)
    static/            ⚠ current vanilla-JS UI — replaced per PLAN.md
  examples/sequences/demo-promo/ "Relay" reference animation (schema v3)
  fixtures/sequences/starter/ schema-v1 migration + golden-render fixture
```

`packages/core/src/` full file map (the deterministic spine, shared with Forge):

```text
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
```

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

The four mechanisms that make output good (semantic selection, constraints,
deterministic critic, event-sourcing) and the deterministic/agent cost boundary
are summarized in [CLAUDE.md](CLAUDE.md) under "How agents produce good motion"
because Forge Create reuses the same philosophy.

## Agent & MCP (Sequences)

Default agent path is **local CLI providers** (`claude-code-cli` / `codex-cli`) —
**NO API key**, reusing the user's existing subscription auth. API providers
(`anthropic-api` / `openai-api`) light up only with a key, never persisted.
Prompts go over **stdin, never argv**. Provider adapters are shared from
`packages/platform`; planning policy remains inside each app.

MCP (`mcp.ts`, stdio JSON-RPC, 11 tools): `get_planning_context`, `submit_plan`,
`get_project_outline`, `get_scene`, `apply_commands`, `lint_report`, `autofix`,
`undo`, `redo`, `render_preview`, `render`. MCP mutations take the same write
lock and ProjectStore as the Sequences app/CLI and refuse to overwrite a newer
snapshot. External agents get the workflow from
`apps/sequences/knowledge/agent-workflow.md`.

## Sequences commands

```powershell
npm run sequences:web    # serve the Sequences demo at http://localhost:4400
npm run test:perf        # command-to-compile p95 budget (300ms)
npm run test:golden      # two-pass deterministic scene-thumbnail hashes
npm run render:example   # render the demo to renders/*.mp4
node scripts/ui-smoke.mjs <port>   # headless DOM smoke; boot a studio first
npx sequences <init|compile|lint --fix|render|thumbs|plan|tweak|preview|providers|mcp|studio|app> <dir>
```

## Sequences design DNA (chrome) — silver, NOT for Forge

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

> Forge does **not** use this silver theme — Forge follows
> [LINEAR_DESIGN.md](LINEAR_DESIGN.md) (Linear-dark, one lavender accent).
