# Sequences for Slack — agent guide

Sequences turns a Slack release brief into a storyboard, preview, and MP4. The
app is Bolt + Socket Mode and runs TypeScript through `tsx`.

Keep the active documentation set small:

- [REFACTOR_PLAN.md](REFACTOR_PLAN.md): the ACTIVE step-by-step refactor work
  order — if you are here for refactor work, follow its agent protocol.
- [OPERATIONS.md](OPERATIONS.md): local probes, publish, deploy, and recovery.
- [SENTINEL.md](SENTINEL.md): correctness ownership, retries, and fallback.
- [PROBE_LOG.md](PROBE_LOG.md): current paid-probe evidence.
- [REFACTOR_HANDOFF.md](REFACTOR_HANDOFF.md): architecture rationale behind
  the plan.

## Delivery and scope

Slack work publishes to **https://github.com/vladimirhegai/Slack_Sequences**.
This monorepo is only the development workspace. From the repository root:

```bash
bash scripts/publish-public.sh "type(scope): concise message"
```

Publishing and deploying are separate. The live sandbox changes only after
`railway up`. Never publish or deploy unless the user explicitly asks.

Active work lives in `apps/slack`. It may use `@sequences/core`,
`@sequences/platform`, and pinned HyperFrames packages. The retired app/studio
trees are gone (REFACTOR_PLAN.md Phase P); never recreate or import from them.
Treat `packages/*` as stable dependencies.

## Model boundaries

There are two different bots:

1. `src/slackMcpContext.ts` uses the OpenAI Responses API and Slack hosted MCP
   with the invoking user's OAuth token. This path requires `OPENAI_API_KEY`.
2. `src/engine/compositionRunner.ts` plans and authors through
   `SLACK_SEQUENCES_PROVIDER` (production uses `openrouter-api`). The internal
   Sequences MCP owns mutation, preview, render, and undo.

Editable general prompts belong in `prompts/*.md`. Runtime facts, typed
contracts, frame tokens, and the locked storyboard belong in source.

## Execution contract

The pipeline is staged and transactional:

1. Collect the brief and permission-scoped Slack evidence.
2. Build and validate `frame.md`.
3. Plan a typed storyboard; deterministic normalizers may make only
   non-creative, atomic, revalidated repairs.
4. Emit scene skeletons and source slots. The author fills scene interiors;
   the host retains the document chassis and all typed plan islands.
5. Reinject canonical interaction, cut, camera, continuity, component,
   time-ramp, FX, asset, and environment contracts.
6. Run static and browser QA, then the bounded vision critic.
7. Checkpoint accepted source, capture moment thumbnails, and render the MP4.

`SLACK_SEQUENCES_USE_MCP=0` is diagnostic only. Receipts never contain prompts,
credentials, workspace content, plan data, or model output.

## Ownership and motion truths

- The host owns typed contracts, runtimes, compile order, scene windows, seek
  semantics, structural stage geometry, and camera blocking.
- The author owns scene interiors, copy, and creative choreography not already
  expressed by a typed contract.
- Plugins and assets lower into ordinary components and beats. Recipes are
  proven fragments; reconciliation is degrade-never-veto.
- Continuity and camera blocking are default-on. Stable `entityId`s should
  produce measured shared-element handoffs and one primary lens route.
- Supporting phrases do not move the lens. Camera fitting uses painted content,
  not empty station boxes.
- Ambient motion belongs on imagery, furniture, and light. Primary copy holds
  still while it is meant to be read.
- A gesture follows anticipation → action → settle → readable hold. The film
  gets one energy peak; connective motion stays subordinate.
- A green JSON report is not a motion-quality pass. Inspect representative
  frames and blocking evidence, then read the motion code for movement between
  those frames.

The authoritative environment-variable registry is
`src/engine/featureFlags.ts`. Do not add an unregistered
`SLACK_SEQUENCES_*` read.

## Failure discipline

Read [SENTINEL.md](SENTINEL.md) before adding a rule or repair. Put each
obligation at the lowest layer that can own it: schema, scaffold,
deterministic normalize, static gate, browser gate, then paid retry. Register
finding classes in `src/engine/sentinel.ts`.

For a paid attempt or fallback:

1. Stop the retry loop when practical.
2. Preserve the exact rejected artifact.
3. Reproduce it without a model call.
4. Fix only the shared deterministic cause and add a minimized regression.
5. Record it in [PROBE_LOG.md](PROBE_LOG.md), then rerun only if authorized.

Never raise attempt counts, loosen a gate, or add prompt prose merely to hide a
mechanical failure.

## Safety and verification

Railway owns the only live Socket Mode process. Never copy Railway tokens into
local `.env` or start a second process with sandbox credentials.

Fast loop:

```powershell
npm run typecheck --workspace @sequences/slack
npm run test:unit --workspace @sequences/slack
npm run test:browser --workspace @sequences/slack
```

Source gate:

```powershell
npm run mcp:demo --workspace @sequences/slack
npm run direct:demo --workspace @sequences/slack
npm run sequence:check --workspace @sequences/slack -- --demo --no-mcp --format both
```

Runtime, camera, cut, render, or temporal changes also require the relevant
browser tests and a rendered golden/probe inspection. Report exactly what ran;
unit tests do not prove OAuth, Slack upload, Railway, or visual quality.
