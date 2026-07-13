# CLAUDE.md — workspace pointer

This repository is **Sequences for Slack** (`apps/slack`) — a Slack agent that
turns a release brief into a launch video in the channel. It is the only
active product here. Start any task by loading the `sequences` skill
(`.agents/skills/sequences/SKILL.md`; local tool-specific mirrors must keep the
same product rules), then:

> ## 👉 Read **[apps/slack/CLAUDE.md](apps/slack/CLAUDE.md)** before doing any work.

Canonical docs (all under `apps/slack/`): `CLAUDE.md` (rules),
`REFACTOR_PLAN.md` (the ACTIVE step-by-step refactor — follow its agent
protocol), `SENTINEL.md` (correctness/fallback discipline), `OPERATIONS.md`
(probes/publish/deploy), `PROBE_LOG.md` (live-probe ledger),
`REFACTOR_HANDOFF.md` (architecture rationale).

Current operating state (2026-07-13): the official creative route is the
single-session Luna workflow in `apps/slack/LUNA_WORKFLOW.md`. Ordinary creates
and structural revisions use the private Railway Codex worker with
`gpt-5.6-luna` at high reasoning. The former OpenRouter planner/author committee
is preserved only as the explicit `legacy-provider` rollback route and is never
an automatic fallback. The S6.9-S6.13 probe history remains useful evidence;
do not restart its paid-probe loop or turn advisory taste findings into blockers.

## GitHub destination — do not get this wrong

All Slack Sequences code publishes to:

> **https://github.com/vladimirhegai/Slack_Sequences**

This monorepo is the local development workspace, not the delivery
destination. After committing, `bash scripts/publish-public.sh "<message>"`
pushes the standalone public repo. **Deploying is separate:** use `railway up`
against the exact clean `.publish` snapshot (GitHub autodeploy is OFF) — see
[apps/slack/OPERATIONS.md](apps/slack/OPERATIONS.md). Never publish or deploy
without explicit authorization.

## Retired trees are gone

The retired app/studio trees, their examples and fixtures, paused docs, and
vendored research snapshots have been removed. Do not recreate or import from
those surfaces. What remains as real dependencies of `apps/slack`:
`packages/core`, `packages/platform` (workspace packages; treat as stable),
and `@hyperframes/*@0.6.86` from npm.
