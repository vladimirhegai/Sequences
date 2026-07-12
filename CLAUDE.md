# CLAUDE.md — workspace pointer

This repository is **Sequences for Slack** (`apps/slack`) — a Slack agent that
turns a release brief into a launch video in the channel. It is the only
active product here. Start any task by loading the `sequences` skill
(`.claude/skills/sequences/SKILL.md`), then:

> ## 👉 Read **[apps/slack/CLAUDE.md](apps/slack/CLAUDE.md)** before doing any work.

Canonical docs (all under `apps/slack/`): `CLAUDE.md` (rules),
`REFACTOR_PLAN.md` (the ACTIVE step-by-step refactor — follow its agent
protocol), `SENTINEL.md` (correctness/fallback discipline), `OPERATIONS.md`
(probes/publish/deploy), `PROBE_LOG.md` (live-probe ledger),
`REFACTOR_HANDOFF.md` (architecture rationale).

## GitHub destination — do not get this wrong

All Slack Sequences code publishes to:

> **https://github.com/vladimirhegai/Slack_Sequences**

This monorepo is the local development workspace, not the delivery
destination. After committing, `bash scripts/publish-public.sh "<message>"`
pushes the standalone public repo. **Deploying is separate:** `railway up`
from the repo root (GitHub autodeploy is OFF) — see
[apps/slack/OPERATIONS.md](apps/slack/OPERATIONS.md). Never publish or deploy
without explicit authorization.

## Retired trees are gone

The retired app/studio trees, their examples and fixtures, paused docs, and
vendored research snapshots have been removed. Do not recreate or import from
those surfaces. What remains as real dependencies of `apps/slack`:
`packages/core`, `packages/platform` (workspace packages; treat as stable),
and `@hyperframes/*@0.6.86` from npm.
