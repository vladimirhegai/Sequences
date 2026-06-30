# CLAUDE.md — Forge + Sequences workspace

This repository contains two separate applications that share contracts and
local-runtime infrastructure but **never** import each other's app source:

- **Forge** (`apps/forge`) is the component workshop and the **active** product.
  It stages interface assets, authors motion snippets, and exports `.seqext`
  bundles Sequences can install.
- **Sequences** (`apps/sequences`) is the agent-first motion-graphics app and
  CLI. It is **paused** — its app-specific detail lives in [SEQUENCES.md](SEQUENCES.md).

> **Current focus: Forge.** Read [FORGE.md](FORGE.md) for active product work.
> Only resume Sequences work when explicitly asked; its rewrite plan is in
> [PLAN.md](PLAN.md) and its app detail in [SEQUENCES.md](SEQUENCES.md).

Shared deterministic contracts belong in `packages/core`; shared host services
belong in `packages/platform`. Never import from one app directory into the
other — the `packages/platform/test/architecture.test.ts` boundary test enforces
this. Documentation drift is a bug.

Doc map: [FORGE.md](FORGE.md) (active product) · [SEQUENCES.md](SEQUENCES.md) +
[PLAN.md](PLAN.md) (paused app) · [LINEAR_DESIGN.md](LINEAR_DESIGN.md) (Forge
chrome) · [MOTION_RESEARCH.md](MOTION_RESEARCH.md) +
[MOTION_CATEGORIES.md](MOTION_CATEGORIES.md) (motion research/taxonomy; also
Forge Create retrieval inputs — not engine contracts).

## The 9 laws (these ARE the engine — never break them)

These govern `packages/core`. Forge depends on it and produces `.seqext` output
that flows through it, so the laws bind Forge work too.

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

## Layout

- `packages/core/` — `@sequences/core`: **pure, zero IO, zero UI deps.** The
  deterministic spine: scene graph, tokens, registry, materialize, solver,
  compiler, linter, commands, store, validate, plan, brief, tweak. Forge's
  `lift`/`export`/`standardize` build `.seqext` bundles against it. (Full file
  map in [SEQUENCES.md](SEQUENCES.md).)
- `packages/platform/` — `@sequences/platform`: shared **local host services**
  used by both apps: `providers.ts` (agent CLI/API adapters + streaming),
  `assetMetadata.ts`, `media.ts`, `vendors.ts`. No product UI or project policy.
- `apps/forge/` — `@sequences/forge`: the **Forge application** (server, Stage +
  Create orchestration, document model, prompt retrieval, UI). May depend on
  `core` and `platform`; must not import `apps/sequences`.
- `apps/sequences/` — `@sequences/app`: the Sequences application (paused). See
  [SEQUENCES.md](SEQUENCES.md).
- A project = a directory: `project.json` (canonical graph), `events.log`
  (append-only journal), `assets/`, `build/` (gitignored, regenerated),
  `renders/`.

```text
Sequences/
  packages/core/src/        deterministic engine (see SEQUENCES.md for the map)
  packages/platform/src/
    providers.ts       shared CLI/API provider adapters + reasoning streaming
    assetMetadata.ts   shared media probing + hashes
    media.ts           shared disk browse + asset placement
    vendors.ts         shared GSAP/HyperFrames runtime resolution
  apps/forge/src/
    server.ts          localhost API, Stage/Create routes (+ SSE streaming)
    document.ts        Forge document model + commands
    stagePrompt.ts / stageRunner.ts / stageKnowledge.ts   Stage agent
    stageContract.ts / stageTweak.ts / stagePolish.ts     Stage contract + ops
    reactCompile.ts    in-browser React TSX → JS for Stage assets
    createPrompt.ts / createRunner.ts / createKnowledge.ts  Create agent
    createDraft.ts / createCritic.ts                       Create draft + critic
    lift.ts / export.ts / standardize.ts / bundleIo.ts     GSAP→.seqext export
    objects.ts / docs.ts / media.ts / scratch.ts           library + refs
    cli.ts             the `forge` CLI
    static/            Forge UI (vanilla JS + styles.css)
    knowledge/         Stage/Create prompt knowledge (retrieved, not skills)
      source/gsap/         vendored GSAP skill snapshot
      source/hyperframes/  vendored HyperFrames authoring snapshot (NOTICE.md)
  apps/sequences/      Sequences application (paused — see SEQUENCES.md)
  examples/forge/      Forge extension examples + local workspace
  references/          optional, gitignored upstream/research material
```

### Agent-skill and prompt-knowledge boundary

- `.claude/skills/` is only for workflows Claude should actively use while
  developing this repository. Keep it small and operational.
- `apps/forge/knowledge/` and `apps/sequences/knowledge/` are application data
  retrieved or injected into model prompts. Files there may use skill-like
  formatting, but Claude and Codex must not auto-activate them as development
  instructions.
- `references/upstream/` contains optional full upstream checkouts (gitignored).
  Production code, tests, and prompt retrieval must work when it is absent.

## Substrate contract (HyperFrames — pinned `@hyperframes/*@0.6.86`)

Do **not** float the pin (upstream releases near-daily; it is at 0.7.x). Build
*around* HF, never fork it — the compiler being the single point of contact is the
whole drift-containment strategy. Reuse only `core` / `engine` / `producer` /
`player`. A curated current snapshot of the HF authoring docs lives at
`apps/forge/knowledge/source/hyperframes/` for Forge Create retrieval.

- `data-start` / `data-duration` are in **seconds**; `data-track-index` is z-order
  and same-track clips must not overlap in time.
- Root `#stage` carries `data-composition-id` / `-width` / `-height`.
- A paused GSAP timeline is registered at `window.__timelines["<id>"]`.
- Vendor scripts are copied beside compiled HTML.
- `compiler.test.ts` runs HF's own linter on our output — **keep it green; it is
  the substrate handshake.**

## How agents produce good motion (Forge Create + Sequences share this)

Good animation is hard — the architecture, not the model, is what makes output
good. Four stacked mechanisms:

1. **Semantic selection, not parametric authoring.** The agent sees descriptions
   ("clean confident reveal; best for headlines"), never numbers. Catalog
   summaries are load-bearing.
2. **Relationships encoded as constraints, not suggestions.** Primitive tags +
   profile whitelists + linter/critic rules make bad *combinations*
   unrepresentable.
3. **A deterministic critic.** Every compile runs a zero-token critic
   (readability, simultaneity cap, stagger, contrast, density, easing whitelist)
   with auto-fix. (Forge Create has its own `createCritic.ts` enforcing the same
   MOTION BAR.)
4. **One source of truth, event-sourced.** Agent edits, drags, CLI, MCP are the
   same commands on the same JSON; undo / revert / diffs come free.

**The deterministic/agent boundary (cost discipline):** anything expressible as a
rule, table, or solver is deterministic (zero tokens). The expensive agent call
does only judgment — interpret intent, select named building blocks. Cheap tiers:
copywriting, NL-tweak→command, repair on validation failure.

The Sequences motion-system internals (16 primitives / 7 archetypes / 3 profiles,
the token lattice, the solver) are catalogued in [SEQUENCES.md](SEQUENCES.md).

## Commands

```powershell
npm test                 # vitest, full suite — must be green to finish
npm run typecheck        # tsc --noEmit (also gate before done)
npm run forge            # serve Forge
```

Sequences-specific commands (perf/golden/render/CLI) are in [SEQUENCES.md](SEQUENCES.md).

## Working rules (tuned to how this repo bites)

- **No build step / no bundler for the engine** (Node ≥22.18 strips types). So:
  explicit `.ts` import extensions; `erasableSyntaxOnly` (**no TS
  enums/namespaces/parameter-properties**); `verbatimModuleSyntax` (`import type`
  for types). Forge's `static/` UI is plain vanilla JS (no bundler).
- **Finish the scope.** First-pass code here has historically shipped defects a
  review round later because tests exercised too narrow a path. Cover the
  full/real path and edge cases before declaring done.
- **End every task green.** Run the full suite and confirm it passes before
  saying done — use the `/verify` skill. No declaring success on a partial run.
- **Tests stay isolated.** No test touches the real home dir or live state — use
  temp dirs. `SEQUENCES_LIBRARY_DIR` overrides the `~/Sequences` library.
- **Cross-platform paths.** Windows dev box (PowerShell). Watch separators; the
  compiler must not flatten binned asset hrefs (`assets/<bin>/x.png`).

## Design DNA

- **Forge** follows [LINEAR_DESIGN.md](LINEAR_DESIGN.md): Linear-dark, a four-step
  surface ladder, hairline borders, one lavender-blue accent (`#5e6ad2`) for
  primary action / active / focus / selection. Inline SVG icons; no second hue.
- **Sequences** uses a separate monochrome-graphite + silver chrome (see
  [SEQUENCES.md](SEQUENCES.md)). **Do not cross the two themes.**

Every component answers: does it **mutate, inspect, preview, or command** the
project? If it mutates, it maps to a typed command (law 1). Make every agent
change an inspectable, reversible diff — name the change, never "improved
animation."
