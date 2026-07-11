# Sequences for Slack — agent guide

Sequences turns a release thread into an on-brand launch film and returns the
storyboard and MP4 in Slack. The app is Bolt + Socket Mode; TypeScript runs
directly through `tsx`.

This file is the durable working guide. Read deeper docs only when the task
needs them:

- [ROADMAP.md](ROADMAP.md) — shipped system map, active work, parked risks;
- [SENTINEL.md](SENTINEL.md) — layer ownership, fallback contract, diagnostics,
  contract registry, budgets, and feature flags;
- [ARCHITECTURE.md](ARCHITECTURE.md) — target architecture;
- [OPERATIONS.md](OPERATIONS.md) — setup, publish, deploy, and recovery;
- [ASSETS.md](ASSETS.md) — parametric assets and `/sequences asset`;
- [PROBE_LOG.md](PROBE_LOG.md) — paid-probe evidence and attempt accounting;
- [studio/INTEGRATION.md](studio/INTEGRATION.md) — Recipe Studio seam table;
- [HACKATHON_RULES.md](HACKATHON_RULES.md) — challenge constraints;
- [docs/history/CHANGELOG.md](docs/history/CHANGELOG.md) — historical ledger,
  never current instructions.

## Delivery destination

Slack work publishes to **https://github.com/vladimirhegai/Slack_Sequences**.
The `vladimirhegai/Sequences` monorepo is the local development workspace, not
the public delivery repository.

From the monorepo root, commit first, then publish the standalone subset:

```bash
bash scripts/publish-public.sh "type(scope): concise message"
```

The script archives `HEAD`; uncommitted work is not published. Publishing and
deploying are separate. GitHub autodeploy is off; the live sandbox changes only
after `railway up` from the monorepo root. Verify `/healthz` returns `ready`.
Never publish or deploy unless the user explicitly asks. Full procedure:
[OPERATIONS.md](OPERATIONS.md).

## Scope and isolation

Active work lives in `apps/slack`. It may depend on `@sequences/core`,
`@sequences/platform`, and pinned `@hyperframes/*@0.6.86`, but it must never
import from `apps/forge` or `apps/sequences`. Copy and adapt required glue into
`apps/slack/src/engine`. Do not modify paused apps or `packages/*` for Slack
work unless the task explicitly expands scope.

The standalone public repository contains this app plus shared packages;
cross-app relative imports will break after publication.

## The two bots

Keep the two model boundaries distinct:

1. The context bot in `src/slackMcpContext.ts` uses the OpenAI Responses API
   (`gpt-5-mini`) to call `https://mcp.slack.com/mcp` with the invoking user's
   OAuth token. It reads permission-scoped Slack messages/files and returns an
   evidence pack. This path always needs `OPENAI_API_KEY`; OpenRouter cannot
   drive the Responses `mcp` tool.
2. The planning/authoring bot in `src/engine/compositionRunner.ts` runs through
   `SLACK_SEQUENCES_PROVIDER` (Railway uses `openrouter-api`). It turns the brief,
   evidence pack, and design capsule into a typed storyboard and canonical
   HyperFrames composition. An internal stdio Sequences MCP owns mutation,
   preview, render, and undo.

Editable system prompts live in `prompts/*.md`. Runtime-composed facts such as
brand tokens, retrieved skills, the locked storyboard, and scoped component
contracts stay in source. Do not bury general prompt prose in TypeScript.

## Current execution architecture

The live path is staged and transactional:

1. Slack collects a brief and the context bot retrieves workspace evidence.
2. The host creates `frame.md`; deterministic tools validate palette, contrast,
   embedded fonts, and spatial tokens.
3. Bounded planning produces a concept and typed storyboard. Parse-side
   normalizers make only deterministic, non-creative repairs and revalidate
   atomically.
4. The host emits scene skeletons and scene-addressable source slots. The model
   authors scene interiors; the host owns the document chassis, stage geometry,
   scene windows, timeline registration, and every plan/runtime seam.
5. Deterministic source repair strips model-authored host islands, reinjects the
   locked contracts, reconciles only unambiguous near-misses, and stages local
   assets.
6. Static validation runs before browser QA. Browser QA measures rendered
   geometry, interactions, framing, composition, transitions, temporal change,
   eye trace, and continuous motion.
7. A bounded vision critic receives compact representative-strip and primary-
   blocking PNGs plus numeric evidence, returns at most five directives, and
   may repair the banked draft under full non-regression QA. Its kill switch or
   any critic/capture failure keeps the pre-critique draft.
8. The orchestrator checkpoints the accepted source, uploads moment-led
   thumbnails, then renders and uploads the MP4 asynchronously.

MCP is the default execution path. `SLACK_SEQUENCES_USE_MCP=0` is a diagnostic
opt-out to the behaviorally equivalent in-process path. Receipts are always
argument-free: never place prompts, plan data, credentials, tokens, workspace
messages, or model output in a Slack receipt.

## Host-owned contracts and generated content

`src/engine/hostContract.ts` provides shared metadata and adapters for the nine
versioned host contracts: interaction, cut, camera, continuity, component,
time-ramp, FX, asset, and environment. Each adapter exposes canonical runtime
bytes/hash/injection plus parse, validation, kit, or staging hooks where the
legacy contract supports them. Orchestration order remains runner-owned.

Key ownership rules:

- The host owns cut/camera/continuity/component/interaction/time/FX/asset/
  environment plan islands, runtimes, compile calls, and seek semantics.
- The author owns scene interiors, copy, art direction inside the committed
  frame system, and creative choreography not already typed by a contract.
- Plugins are parameterized host generators lowered to ordinary components and
  beats. Current kinds include dashboard/notification/lockup/activity/terminal/
  team plus `flow-diagram`, `comparison-table`, and `pricing-reveal`.
- Recipes are proven fragments injected verbatim at Level 1. High-confidence
  offers with default-safe parameters may be auto-declared; reconciliation is
  degrade-never-veto. Author sources in `recipes/`, gate with
  `npm run recipes --workspace @sequences/slack -- gate <id>`, inspect the
  thumbnails, then export with
  `npm run recipes --workspace @sequences/slack -- export <id>`. A
  runtime/schema/injection seam change requires updating
  `studio/INTEGRATION.md` and re-running `npm run studio:golden`.

## Motion and composition invariants

- Continuity graph + camera blocking are default-on; set
  `SLACK_SEQUENCES_CONTINUITY_GRAPH=0` only for rollback comparison. Stable
  `entityId`s compile measured shared-element handoffs and graph-owned primary
  camera routes with explicit target, occupancy, anchor, arrival, dwell, and
  next-handoff paperwork. Supporting phrases never yank the lens.
- The environment contract is default-on. Every film deterministically stages
  one production-cleared MIT wallpaper plus its license notice and injects a
  desktop stage, screen-over-wallpaper, full-app view, or generated field.
  Ambient motion lives on imagery, furniture, and light outside the camera
  world; text and primary components stay still during readable holds.
- Camera fitting targets painted/text/media content, not raw station boxes.
  Sparse framing uses a 24×14 occupancy grid plus retained bbox evidence.
  Browser-proven station `fitScale` repair tightens undersized content before
  falling back to a bounded focal zoom.
- Whole-frame composition uses a 32×18 grid. Semantic content and explicit
  `data-composition-credit` environments count; bare canvas paint does not.
  `SLACK_SEQUENCES_COMPOSITION=audit` is the calibration default; `block`
  applies strict polish pressure and `0` disables it.
- Component roots may declare one scene entrance family (`rise`, `assemble`, or
  `materialize`). Typed beats may follow a beat/component with a bounded lag;
  the host caps follow depth and resolves cycles/conflicts safely. Exits are
  directional and subordinate. A host settle bloom decays after the final
  visible beat without transforming/filtering the root.
- Component morphs use a cloned material-shell bridge. Never restore scale on
  live source DOM; reverse seek must restore both endpoints.
- Declared bridged cuts receive a host-owned outgoing lead and are measured
  before the boundary. A degraded declared morph is surfaced and its shipped
  paperwork must describe what actually executed.
- Display type is a typed host-injected `ghost-word` moment, at most one per
  film, with bounded copy/timing and a declared focal relationship.
- Continuous evidence persists visibility/occupancy, velocity, acceleration,
  jerk, reversal, competition, settles, quiet windows, and rendered dead
  windows outside typed holds. Washout evidence combines a luminance histogram
  with focal/field separation. These can rank drafts and apply bounded polish
  pressure; runtime `ok` remains distinct from `strictOk`.

All behavior switches and operational `SLACK_SEQUENCES_*` inputs are classified
in `src/engine/featureFlags.ts`. Its source-scan test fails when a read is
unregistered or a registration is stale. Treat that registry—not scattered
documentation—as the source of truth for defaults, values, ownership, and
rollback.

## Sentinel and failure handling

Before adding any authoring gate, rule, or repair, read
[SENTINEL.md](SENTINEL.md). Put every obligation at the lowest layer that can
own it: schema, scaffold, deterministic normalize, static gate, browser gate,
then paid model retry. Register every finding class in
`src/engine/sentinel.ts`; `test/sentinel.test.ts` enforces the closed world.
Gates are not loosened—Sentinel changes where an obligation is enforced.

The fallback contract and recovery catalog are also in SENTINEL.md. During
prep, `SLACK_SEQUENCES_ALLOW_DETERMINISTIC_FALLBACK=0` is useful because a
failure produces `FAILURE.md` instead of the labeled proof film. Before judges
use the Railway sandbox, set it to `1` (or remove the override). Frame-design
failures always fail loud.

When a paid probe burns an attempt on a mechanical, non-architectural class:
stop, place the fix with the Sentinel tree, add a minimized regression, record
the attempt in `PROBE_LOG.md`, then continue. Never raise attempt counts or
loosen a gate to make the symptom disappear.

## Environment safety

One live Slack app runs in the Railway developer sandbox. Local work is source,
tests, deterministic demos, local browser/render checks, and explicitly
authorized paid probes. Never copy Railway credentials into `apps/slack/.env`
or start a second Socket Mode process with sandbox tokens; duplicate processes
produce duplicate replies.

Socket Mode carries Slack events. Railway exposes only `/healthz`,
`/slack/install`, and `/slack/oauth_redirect`; do not add Events API or
interactivity request URLs. Railway is not a public `/mcp` endpoint.

## Verification ladder

Run the smallest relevant rung while iterating, then the full rung required by
the change. Always report which layers actually ran.

### Fast inner loop

```powershell
npm run typecheck --workspace @sequences/slack
npm run test:unit --workspace @sequences/slack
```

Run focused Vitest files while developing. Browser regressions are isolated:

```powershell
npm run test:browser --workspace @sequences/slack
```

### Slack source gate

```powershell
npm run typecheck --workspace @sequences/slack
npm run test --workspace @sequences/slack
npm run mcp:demo --workspace @sequences/slack
npm run direct:demo --workspace @sequences/slack
npm run sequence:check --workspace @sequences/slack -- --demo --no-mcp --format both
npm run film:demo --workspace @sequences/slack
```

### Render and container gate

Required after engine/runtime/render/Chromium/FFmpeg/Docker changes:

```powershell
$env:VERIFY_RENDER = "1"
try { npm run film:demo --workspace @sequences/slack }
finally { Remove-Item Env:VERIFY_RENDER -ErrorAction SilentlyContinue }

docker build -t sequences-slack .
docker run --rm sequences-slack npm run mcp:demo -w @sequences/slack
docker run --rm -e VERIFY_RENDER=1 sequences-slack npm run film:demo -w @sequences/slack
```

### Change-specific proof

- Documentation only: inspect links/commands and run `git diff --check`.
- Manifest/scopes/events: paste the manifest, reinstall, refresh the token,
  redeploy, self-check, and exercise the affected sandbox flow.
- OAuth/hosted Slack MCP: source gate, `/slack/install`, self-check, real
  `/sequences`.
- Host contracts, temporal QA, camera, or cuts: focused unit/browser suites,
  full source gate, local rendered golden, then the plan-authorized paid probe.
- Rendering/Docker: render/container gate, sandbox demo, draft, and HD.

Unit tests do not prove OAuth, Socket Mode, Railway, Slack upload, or visual
quality. For motion work, inspect the MP4 and contact/temporal strips; a green
JSON report alone is not the acceptance result.
