---
name: sequences
description: Orientation map + rules for Sequences (apps/slack) — the Slack launch-video agent and the only active product in this repo. The two bots (OpenAI context retrieval + OpenRouter HyperFrames authoring), the staged runner pipeline, Sentinel failure discipline, the live-probe loop, the refactor plan, publish-vs-deploy, and Slack-native gotchas. Use at the start of ANY task in this repo ("add a command", "fix a gate", "run a probe", "change the result message", "render/upload", "prompts", "publish/deploy", "refactor step").
---

# Sequences — go straight to the right file (and don't break the rules)

**Sequences** (`apps/slack`) turns a Slack release brief into a storyboard,
preview, and MP4 in the channel. Bolt + Socket Mode; `tsx` runs TS directly.
It is the only active product here; keep all product work in that tree and the
two stable workspace packages.

Canonical docs — small set, read only what the task needs:

- [apps/slack/CLAUDE.md](../../../apps/slack/CLAUDE.md) — rules, model
  boundaries, execution contract, verification.
- [apps/slack/REFACTOR_PLAN.md](../../../apps/slack/REFACTOR_PLAN.md) — the
  ACTIVE step-by-step refactor. If you are doing refactor work, follow its
  agent protocol exactly (one step, verify, tick, journal, commit).
- [apps/slack/SENTINEL.md](../../../apps/slack/SENTINEL.md) — correctness
  ownership (L0–L5), fallback policy, attempt discipline. Read before adding
  any gate, normalizer, or repair.
- [apps/slack/OPERATIONS.md](../../../apps/slack/OPERATIONS.md) — probes,
  Railway, publish/deploy, recovery.
- [apps/slack/PROBE_LOG.md](../../../apps/slack/PROBE_LOG.md) — live-probe
  ledger. Every paid attempt/fallback gets an entry.
- [apps/slack/REFACTOR_HANDOFF.md](../../../apps/slack/REFACTOR_HANDOFF.md) —
  historical architecture rationale behind the plan (background reading, not
  the current work order).

Current state (2026-07-12): the first unchecked work is S6.9 in the pre-Phase-7
hackathon stabilization override. S7+ is frozen. Success for this sprint is the
first runtime-valid, human-acceptable MP4 within the bounded call/probe budget;
advisory-only `warn` is acceptable and does not justify another probe.

## The two bots (don't conflate them)

1. **Context bot** — `src/slackMcpContext.ts`: OpenAI Responses API +
   Slack hosted MCP with the invoking user's OAuth token. Needs
   `OPENAI_API_KEY`.
2. **Authoring bot** — `src/engine/runner/` (ladder/orchestration): plans a
   typed storyboard and authors HyperFrames HTML on
   `SLACK_SEQUENCES_PROVIDER` (production: `openrouter-api`; GLM for
   frame/storyboard, DeepSeek for source). Execution (mutation, preview,
   render, undo) goes through the internal stdio Sequences MCP
   (`src/engine/mcp*.ts`) — a different thing from Slack's hosted MCP.

## Where things live

- `src/index.ts` — Bolt app, all Slack I/O, two-tier delivery (thumbnails
  fast, MP4 after). `src/orchestrator.ts` — engine seam
  (create/revise/undo/render, provider resolution, progress receipts).
- `src/engine/runner/` — the authoring pipeline: `orchestration.ts` (stage
  flow) · `ladder.ts` (attempts, hedging, models, publication decisions) ·
  `storyboardAudit.ts` (plan parse + normalize) · `scaffold.ts` (skeletons +
  slots) · `prompts.ts` (composed authoring prompts) · `repairs.ts`
  (stable facade over domain modules in `repairs/`) · `browserQuality.ts` +
  `visionCritic.ts` (QA) · `normalizerRegistry.ts`.
  `src/engine/compositionRunner.ts` is a thin facade.
- Typed host contracts in `src/engine/`: cuts (`cutContract.ts`), camera
  (`cameraContract.ts`, `cameraBlocking.ts`), components
  (`componentContract.ts`), interactions, continuity (`continuityGraph.ts`),
  plugins (`pluginContract.ts`), assets (`assetContract.ts`, `assets/`),
  recipes (`recipeContract.ts`), FX/grade/environment/cinema kits; QA in
  `layout/` (stable facade `layoutInspector.ts`), `pacingAudit.ts`,
  `eyeTrace.ts`, `motionDensity.ts`, `temporalInspector.ts`; registries in
  `sentinel.ts`, `hostContract.ts`,
  `featureFlags.ts` (EVERY `SLACK_SEQUENCES_*` read must be registered).
- Editable general prompts: `prompts/*.md` (`planning-director.md`,
  `context-retrieval.md`). Deterministic per-run context stays in code.
- Operator Studio (never on Railway): `studio/` — `npm run studio`, the
  component/asset/recipe catalog viewer, recipe gate/export, and the Asset Lab
  alias (`npm run assets`). Coding agents author recipes in `recipes/`; the
  removed operator canvas/chat path is not a second engine.
- Golden reference film: `demos/slack-ad` (hand-authored, 618 lines) →
  `demo-output/slack-ad-luna`. This is the motion-quality bar; REFACTOR_PLAN
  §"Golden demo" lists its measurable properties.

## The rules

1. **Failure discipline.** Preserve paid artifacts and account for every call,
   then classify before fixing. Hard runtime/contract/state/output failures may
   block; host-known markup/binding/frame-containment defects get one bounded
   deterministic repair; taste findings remain visible advisories and do not
   buy author repair, rescue, critic patch, or another probe. Replay a real
   mechanical failure without a model call, fix the lowest SENTINEL layer, add
   a regression, and log it in PROBE_LOG.md. Never loosen a hard gate or add
   prompt prose to hide a mechanical failure.
2. **Motion goes through the engine gate, never hand-tuned.** Authored HTML
   passes lint → runtime invariants → typed contracts → layout/pacing/eye
   QA → bounded repair. Never hand-write motion JSON or timing numbers into
   a job. The host owns contracts, runtimes, compile order, scene windows,
   seek semantics, and camera blocking; the author owns scene interiors.
3. **Keep deterministic things deterministic.** `/sequences demo`, tweaks,
   undo, delivery plumbing are model-free; build new deterministic behavior
   in that layer.
4. **Dependencies:** `@sequences/core`, `@sequences/platform`,
   `@hyperframes/*@0.6.86` (npm). Never resurrect imports from the retired
   app/studio trees.
5. **Slack-native gotchas:** background work never crashes the process
   (`runInBackground` → `safeUpdate`/`safeNotify`); media via
   `files.uploadV2`; public channels auto-join, private need `/invite`;
   escape user content with `escapeMrkdwn`; scope changes mean
   `manifest.json` → reinstall → new `SLACK_BOT_TOKEN`.

## Commands

```powershell
npm run typecheck --workspace @sequences/slack
npm run test:unit --workspace @sequences/slack
npm run test:browser --workspace @sequences/slack
npm run replay:all --workspace @sequences/slack
npm run demo --workspace @sequences/slack          # model-free smoke
npm run mcp:demo --workspace @sequences/slack
npm run sequence:check --workspace @sequences/slack -- --demo --no-mcp --format both
npm run sentinel:report --workspace @sequences/slack
npm run storyboard:replay --workspace @sequences/slack -- <attempts-file> --strict
npm run probe:triage --workspace @sequences/slack -- <job-id-or-project-dir>
```

Paid live probe (only when explicitly authorized) — see OPERATIONS.md for the
full env + inspection list; fallback disabled and cache-distinct job id. Under
the active hackathon override, use one ordinary 14-18s brief, poll no more often
than every 60s, stop at the first acceptable MP4, and permit at most one rerun
after a hard/judge-visible failure is replayed and fixed. Never probe merely to
clear advisory residue.

## Ship it (publish ≠ deploy; both act on committed source)

- Publish source → GitHub: `bash scripts/publish-public.sh "<msg>"` →
  force-pushes the public subset to `vladimirhegai/Slack_Sequences`. Never
  treat a push to the private monorepo as publishing.
- Deploy live bot → Railway: `railway up` from the repo root (GitHub
  autodeploy is OFF). Verify `/healthz` → `ready`. Docs-only changes need a
  publish but not a redeploy.
- Railway owns the only live Socket Mode process; never run a second one
  with sandbox tokens.
