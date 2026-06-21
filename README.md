# Sequences

Sequences is a local-first, agent-first motion-graphics studio for SaaS and
app product videos. An agent plans from a constrained motion vocabulary; a
deterministic engine handles layout, choreography, linting, preview, and local
rendering; a visual editor keeps every correction inspectable and undoable.

The project is currently at the end of its Phase 1 foundation. The next
priority is an interface-first Phase 1.5: redesign the Studio around the real
creative workflow before adding Phase 2 research features.

## What exists today

- Schema-v3 scene graph with v1/v2 migrations
- One typed command path shared by UI, CLI, autofix, agent, and MCP
- 16 motion primitives, 7 archetypes, 3 profiles, 2 camera moves, and
  8 transition identifiers
- Deterministic materialization, choreography, validation, linting, and
  HyperFrames compilation
- Four agent providers, structured planning, direction variants, deterministic
  tweaks, and an 11-tool MCP server
- Seven Studio workspaces: References, Media, Design, Storyboard, Timeline,
  Render, and Extensions
- Local preview and rendering through HyperFrames, Chrome/Edge, and FFmpeg
- Property tests, HyperFrames conformance, performance gates, golden renders,
  primitive probes, CI, and browser smoke coverage

For the complete implementation inventory, read
[CURRENT_STATE.md](CURRENT_STATE.md).

## Quick start

Requirements:

- Node.js 22.18 or newer
- npm
- FFmpeg for video rendering
- Chrome or Edge for preview, thumbnails, and capture

```powershell
npm install
npm run typecheck
npm test
npm run studio:web
```

The demo Studio is served at `http://localhost:4400`.

Useful commands:

```powershell
npx sequences init <dir> [--name Name] [--showcase]
npx sequences compile <dir>
npx sequences lint <dir> [--fix]
npx sequences preview <dir>
npx sequences plan <dir> "<brief>" [--provider id]
npx sequences tweak <dir> "<request>" [--scene id] [--layer id]
npx sequences render <dir> [--quality draft|standard|high]
npx sequences mcp <dir>
```

## Architecture

The canonical artifact is `project.json`. Every canonical mutation becomes a
typed, validated, reversible command and is recorded in `events.log`.
Compilation is one-way:

```text
brief / storyboard / assets
            |
            v
   typed plan and commands
            |
            v
 schema-v3 project graph
            |
            v
 materialize -> solve -> lint -> compile
            |
            v
 HyperFrames HTML -> preview / local render
```

Generated HTML is never parsed back into project state. Motion parameters are
tokenized, registry entries define the available vocabulary, and GSAP remains
behind the primitive-emission seam.

## Current product direction

Phase 2 is intentionally paused while the Studio is redesigned. The existing
engine already exposes enough capability that adding more features before
settling the interaction model would make the interface harder to simplify.

The UI rewrite will focus on:

- making the creative loop obvious from first launch;
- deciding where primary actions belong from task frequency and context;
- keeping preview space dominant;
- separating planning, asset preparation, scene construction, refinement, and
  delivery without hiding their relationship;
- progressively revealing advanced motion controls;
- preserving the command model and deterministic engine underneath the new UI.

See [UI_REWRITE_PLAN.md](UI_REWRITE_PLAN.md) and [DESIGN.md](DESIGN.md).

## Verification

```powershell
npm run typecheck
npm test
npm run test:perf
npm run test:golden
node apps/studio/src/cli.ts thumbs projects/Starter --primitives
```

The browser smoke scripts can be run against a live Studio:

```powershell
node scripts/ui-smoke.mjs 4400
node scripts/ui-smoke2.mjs 4400
node scripts/ui-smoke3.mjs 4400
```

## Documentation

- [CURRENT_STATE.md](CURRENT_STATE.md) — exhaustive repository snapshot
- [UI_REWRITE_PLAN.md](UI_REWRITE_PLAN.md) — current product priority
- [DESIGN.md](DESIGN.md) — visual language and durable interaction principles
- [CLAUDE.md](CLAUDE.md) — engineering laws and contributor guidance
- [skills/sequences/SKILL.md](skills/sequences/SKILL.md) — MCP workflow for agents

The repository is Apache-2.0 licensed.
