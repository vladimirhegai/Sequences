# Sequences Developer Guide

Status: Phase 1 foundation complete; interface-first Phase 1.5 is current.

This is the local implementation guide for developers and agents. It is kept
out of the public repository because it contains machine-specific notes and
working plans. Use these documents in order:

1. `CURRENT_STATE.md` — exhaustive current implementation snapshot.
2. `UI_REWRITE_PLAN.md` — current product priority and rewrite boundaries.
3. `CLAUDE.md` — engineering laws and contributor rules.
4. `DESIGN.md` — durable visual and interaction language.
5. `SEQUENCES_MASTER_PLAN.md` — historical architecture and future research.

## Current system

Sequences is a local-first motion-graphics studio with:

- schema v3 and migrations from v1/v2;
- 16 primitives, 7 archetypes, 3 profiles, 2 camera moves, 8 transition ids,
  and 37 total registry entries;
- 33 command types with exact inverses;
- 14 deterministic linter rules;
- structured briefs, direction variants, deterministic/model-assisted tweaks,
  four providers, and 11 MCP tools;
- a seven-workspace vanilla-JS Studio, with React used only by Excalidraw;
- local HyperFrames/FFmpeg rendering;
- 23 test files and 152 tests at the June 21, 2026 snapshot.

Do not trust old dated test counts. Run the suite.

## Quick start

Requirements: Node 22.18+, npm, FFmpeg, and Chrome or Edge.

```powershell
npm install
npm run typecheck
npm test
npm run studio:web
```

```powershell
npx sequences init <dir> [--name Name] [--showcase]
npx sequences compile <dir>
npx sequences lint <dir> [--fix]
npx sequences preview <dir>
npx sequences plan <dir> "<brief>" [--provider id]
npx sequences tweak <dir> "<request>" [--scene id] [--layer id]
npx sequences render <dir> [--quality draft|standard|high]
npx sequences thumbs <dir> [--primitives]
npx sequences providers
npx sequences mcp <dir>
npx sequences studio <dir> [--port N]
npx sequences app <dir> [--port N]
```

## Repository map

```text
packages/core/            Pure domain, registry, solver, linter, compiler
apps/studio/              IO, CLI, MCP, server, renderer, and current UI
examples/demo-promo/      Pulse showcase project
projects/Starter/         Migration/golden fixture
evals/                    Structured planning evaluations
scripts/                  Performance, golden, and browser smoke tools
skills/sequences/         External-agent MCP workflow
```

A project directory contains:

```text
project.json              Canonical schema-v3 graph
events.log                Hashed append-only recovery journal
assets/                   Project-contained media
build/                    Regenerated compile output
storyboard.json           Portable intent sidecar, when present
design.json               Portable design scratch sidecar, when present
renders/                  Generated delivery files
```

## The eight laws

1. Every canonical mutation goes through `applyCommand`/`ProjectStore.apply`.
2. Compilation is one-way: `Project -> HTML`; generated HTML is never parsed.
3. Motion/style parameters use named tokens, not raw scene-graph numerics.
4. Validation gates accepted state.
5. Lint fixes are commands and remain undoable.
6. Every command inverse must round-trip exactly.
7. Motion vocabulary comes through typed registries with summaries.
8. GSAP stays behind the `GsapStep` emission seam.

`storyboard.json` and `design.json` are deliberate sidecar exceptions because
they describe intent/scratch state rather than canonical render output.

## HyperFrames contract

The repository pins `@hyperframes/*` at `0.6.86`.

- Clip `data-start` and `data-duration` values are seconds.
- `data-track-index` is z-order; same-track time intervals cannot overlap.
- `#stage` carries composition id, width, and height.
- A paused GSAP timeline is registered in `window.__timelines`.
- Vendor scripts are copied beside compiled HTML.
- HyperFrames Producer captures the compiled document and FFmpeg encodes it.
- The compiler conformance test runs HyperFrames' own linter.

Do not float the substrate version without deliberately revalidating this
contract.

## Agent and MCP behavior

The preferred no-key path uses installed `codex` or `claude` CLI providers.
Prompts travel over stdin, never argv. API providers are optional and keys are
not persisted by the server.

MCP exposes:

- `get_planning_context`
- `submit_plan`
- `get_project_outline`
- `get_scene`
- `apply_commands`
- `lint_report`
- `autofix`
- `undo`
- `redo`
- `render_preview`
- `render`

Storyboard text is included in planning context when available. Extension
enablement is enforced across planning and command application.

## UI rewrite boundary

The existing UI is a functional prototype. Replacing it is authorized and is
the current priority. The rewrite may change framework, navigation, panels,
and control placement, but it must not introduce:

- direct mutation of project objects;
- a second canonical frontend state model;
- HTML-as-source editing;
- raw off-lattice motion values;
- untracked agent edits;
- render behavior that differs from the core compiler.

Start from `UI_REWRITE_PLAN.md`, inventory every current command/control, then
migrate workflows in order of user value.

## Verification

```powershell
npm run typecheck
npm test
npm run test:perf
npm run test:golden
node apps/studio/src/cli.ts thumbs projects/Starter --primitives
```

Against a running Studio:

```powershell
node scripts/ui-smoke.mjs 4400
node scripts/ui-smoke2.mjs 4400
node scripts/ui-smoke3.mjs 4400
```

The June 21 snapshot passed typecheck, 152 tests, the performance budget,
four-scene golden determinism, all 16 primitive probes, and all three browser
smokes.

## Known constraints

- Windows/PowerShell is the primary development environment.
- Node executes TypeScript directly; imports use explicit `.ts` extensions and
  code must remain erasable under the current tsconfig.
- The generated Excalidraw bundle is large and intentionally checked in.
- System fonts are not yet portable across render machines.
- Video/audio editing is less complete than still-image and scene editing.
- Full persistent undo-stack reconstruction is not implemented, although
  write-ahead crash recovery is.
- The current frontend is vanilla JS; React is present for Excalidraw only.
- Phase 2 features are deferred until the UI rewrite has an intentional home
  for every existing capability.

## Where taste lives

Subjective motion defaults are concentrated in:

- `packages/core/src/tokens.ts`
- `packages/core/src/registry/profiles.ts`
- `packages/core/src/registry/archetypes.ts`

Tune them deliberately, inspect renders, and update golden expectations only
when the visual change is intended.
