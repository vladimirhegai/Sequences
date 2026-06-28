# CLAUDE.md — workspace pointer

## Current focus: the Slack hackathon bot (`apps/slack`)

The active work in this repo is **Sequences for Slack** — a Slack agent for the
**Slack Agent Builder Challenge** (~16-day hackathon). All hackathon work lives
in **[apps/slack/](apps/slack/)**.

> **Read [apps/slack/CLAUDE.md](apps/slack/CLAUDE.md) before doing any work.**
> The hackathon spec is [apps/slack/SLACK_PLAN.md](apps/slack/SLACK_PLAN.md).

## Forge and Sequences are PAUSED ⏸

Forge (`apps/forge`) and Sequences (`apps/sequences`) — and the shared engine
packages they sit on (`packages/core`, `packages/platform`) — are **frozen for
the duration of the hackathon.** Do not change them as part of Slack work.

Their documentation is preserved (not deleted) in **[docs/paused/](docs/paused/)**:

- [docs/paused/WORKSPACE.md](docs/paused/WORKSPACE.md) — the full workspace guide
  that used to be this file (the **9 laws**, engine layout, working rules). Read
  this if you resume engine work.
- [docs/paused/FORGE.md](docs/paused/FORGE.md) · [docs/paused/SEQUENCES.md](docs/paused/SEQUENCES.md)
  · [docs/paused/PLAN.md](docs/paused/PLAN.md) — the paused products.
- [docs/paused/LINEAR_DESIGN.md](docs/paused/LINEAR_DESIGN.md) ·
  [docs/paused/MOTION_RESEARCH.md](docs/paused/MOTION_RESEARCH.md) ·
  [docs/paused/MOTION_CATEGORIES.md](docs/paused/MOTION_CATEGORIES.md) — design/research.

To resume Forge/Sequences after the hackathon, see
[docs/paused/README.md](docs/paused/README.md).

## How the hackathon app relates to the engine

`apps/slack` is **self-contained**. It may depend on the **shared packages**
(`@sequences/core`, `@sequences/platform`, pinned `@hyperframes/*@0.6.86`), but
it must **never import from `apps/forge` or `apps/sequences`** — copy what it
needs in instead. Full rule in [apps/slack/CLAUDE.md](apps/slack/CLAUDE.md).

## Commands

```powershell
npm run dev --workspace @sequences/slack   # run the Slack bot (socket mode)
npm test                                    # full engine suite (must stay green)
npm run typecheck                           # engine typecheck (excludes apps/slack)
```
