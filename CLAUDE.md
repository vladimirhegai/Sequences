# CLAUDE.md — Sequences

Agent-first motion graphics editor for SaaS product video, built on HyperFrames.
Local-first, deterministic, TypeScript everywhere. **An agent does ~90%; a real
visual editor fixes the last 10% non-destructively.**

## Read first (don't skip)

- [CURRENT_STATE.md](CURRENT_STATE.md) — exhaustive description of what is
  actually present in the working tree.
- [UI_REWRITE_PLAN.md](UI_REWRITE_PLAN.md) — the current product priority:
  redesign the Studio before Phase 2.
- [DESIGN.md](DESIGN.md) — the single source for how the studio looks & feels.
  Preserve its durable principles, but treat the current component/layout
  specification as a rewrite hypothesis rather than immutable structure.
- `README_dev.md` and `SEQUENCES_MASTER_PLAN.md` are local working references.
  The former is an implementation guide; the latter is historical/aspirational.

When a contract changes, update `CURRENT_STATE.md`, the relevant public guide,
and `DESIGN.md` or `UI_REWRITE_PLAN.md` when the product interaction changes.
Documentation drift is a bug.

## The 8 laws (these ARE the product — never break them)

1. **One mutation pathway.** Every project change goes through `applyCommand`
   (in practice `ProjectStore.apply`). UI drag, CLI, autofix, agent/MCP are the
   same typed command underneath. Never mutate a `Project` outside `commands.ts`.
2. **Compiler is one-way.** `compile(Project) → HTML`. Generated HTML is never
   parsed back; surface info via `Manifest`/`CompileResult`, not HTML parsing.
3. **Token purity (T1).** No raw motion/style numerics in the scene graph or
   primitives — a literal `duration: 0.4` is a hard error. New values go in
   `tokens.ts`, referenced by id. Schemas enumerate token ids; `easing-whitelist`
   lint backstops the emit path.
4. **Validation gates the store.** A command whose result fails `validateProject`
   is rejected — the compiler never sees an invalid graph. Hard invariants →
   `validate.ts`; soft + fixable → the linter.
5. **Lint fixes are commands.** Logged, undoable, `source: "autofix"`. Never fix
   by mutating state.
6. **Inverses roundtrip exactly.** Every command returns an inverse where
   `apply(inverse(apply(p)))` deep-equals `p`. Add new commands to the `COMMANDS`
   list in `commands.test.ts`.
7. **Registry discipline.** Primitives/archetypes/profiles only via
   `registry/types.ts`, each with a `summary` written like a senior briefing a
   junior — `promptCatalog()` builds the planner prompt from these, so code and
   prompt can never drift.
8. **GSAP stays behind the seam.** Primitives emit `GsapStep` data; only the
   compiler serializes GSAP. This is the WAAPI-swap hedge.

Where taste lives (subjective = data, three files only): `tokens.ts`,
`registry/profiles.ts`, `registry/archetypes.ts`. The golden snapshot
(`compiler.test.ts`) is a tripwire — change it on purpose with `npx vitest run -u`.

## Layout

- `packages/core/` — `@sequences/core`: **pure, zero IO, zero UI deps.** Scene
  graph, tokens, registry, materialize, solver, compiler, linter, commands,
  store, validate, plan. All deterministic logic lives here.
- `apps/studio/` — `@sequences/studio`: **all IO.** server, workspace, render,
  thumbs, MCP, agent providers, CLI, and the vanilla-JS command-routed UI in
  `src/static/`.
- A project = a directory: `project.json` (canonical graph), `events.log`
  (append-only journal), `assets/`, `build/` (gitignored, regenerated).

## Substrate contract (HyperFrames — pinned `@hyperframes/*@0.6.86`)

Do **not** float the pin (upstream releases near-daily). `data-start`/
`data-duration` are in **seconds**; `data-track-index` is z-order and same-track
clips must not overlap in time. Root `#stage` carries `data-composition-id`/
`-width`/`-height`. Paused GSAP timeline registered at
`window.__timelines["<id>"]`. `compiler.test.ts` runs HF's own linter on our
output — **keep it green; it is the substrate handshake.**

## Working rules (tuned to how this repo bites)

- **Finish the scope.** First-pass code here has historically shipped defects
  that surfaced a review round later, because tests exercised too narrow a path.
  Cover the full/real build path and edge cases before declaring done — not just
  the happy partial case.
- **End every task green.** Run the full suite and confirm it passes before
  saying done — use the `/verify` skill. Don't declare success on a partial run.
- **Tests stay isolated.** No test touches the real home dir or live state — use
  temp dirs. (`SEQUENCES_LIBRARY_DIR` overrides the `~/Sequences` library.)
- **No build step / no bundler** (Node ≥22.18 strips types). So: explicit `.ts`
  import extensions; `erasableSyntaxOnly` (**no TS enums/namespaces/parameter-
  properties**); `verbatimModuleSyntax` (`import type` for types).
- **Cross-platform paths.** Windows dev box (PowerShell 5.1). Watch separators;
  the compiler must not flatten binned asset hrefs (`assets/<bin>/x.png`).
- **MCP/agent.** Default agent path is local CLI providers (`claude-code-cli` /
  `codex-cli`) — **NO API key**. API providers light up only with a key, never
  persisted. Prompts go over stdin, never argv.

## Commands

```powershell
npm test                 # vitest, full suite — must be green to finish
npm run typecheck        # tsc --noEmit (also gate before done)
npm run studio:web       # serve examples/demo-promo at http://localhost:4400
npm run render:example   # render the demo to renders/*.mp4
node scripts/ui-smoke.mjs <port>   # headless DOM smoke (also ui-smoke2/3); boot a studio first
npx sequences <init|compile|lint --fix|render|thumbs|plan|providers|mcp|studio|app> <dir>
```

## Design philosophy (chrome)

Monochrome graphite + one neutral **silver** accent (`{color.silver}` `#c9cfd9`)
for selection/focus/the single primary action — **no chromatic brand hue, no
neon, no AI sparkle, no mesh.** The chrome is monochrome so the user's video is
the only color on screen. The current four-region Timeline layout is the
starting hypothesis for the rewrite, not an untouchable result. Every editor
component must answer: does it mutate, inspect, preview, or command the project?
If it mutates, it maps to a typed command. Reference tokens by name
(`{color.silver-line}`, `{radius.md}`, `{type.mono}`).
