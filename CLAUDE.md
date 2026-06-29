# CLAUDE.md — workspace pointer

## Active work lives in `apps/slack`

The active work in this repo is **Sequences for Slack** — a Slack agent for the
**Slack Agent Builder Challenge** (deadline Jul 13 2026). It has its own,
authoritative agent guide:

> ## 👉 Read **[apps/slack/CLAUDE.md](apps/slack/CLAUDE.md)** before doing any work.
>
> It covers the two bots, isolation rule, MCP path, prompts convention, current
> state, and verification. From there: [ARCHITECTURE.md](apps/slack/ARCHITECTURE.md)
> (target design), [SLACK_PLAN.md](apps/slack/SLACK_PLAN.md) (current state),
> [OPERATIONS.md](apps/slack/OPERATIONS.md) (setup + deploy),
> [TESTING.md](apps/slack/TESTING.md), [HACKATHON_RULES.md](apps/slack/HACKATHON_RULES.md).

`apps/slack` is **self-contained**: it may depend on shared packages
(`@sequences/core`, `@sequences/platform`, pinned `@hyperframes/*@0.6.86`) but
must **never import from `apps/forge` or `apps/sequences`** — copy what it needs
in instead. The Railway sandbox app is the only live Slack process; never copy its
tokens locally or start a second Socket Mode process.

## Forge and Sequences are PAUSED ⏸

Forge (`apps/forge`), Sequences (`apps/sequences`), and the shared engine packages
they sit on (`packages/core`, `packages/platform`) are **frozen for the
hackathon.** Do not change them as part of Slack work. Their docs are preserved in
**[docs/paused/](docs/paused/)**:

- [docs/paused/WORKSPACE.md](docs/paused/WORKSPACE.md) — full workspace guide (the
  original **9 laws**, engine layout, working rules). Read if you resume engine work.
- [docs/paused/FORGE.md](docs/paused/FORGE.md) · [docs/paused/SEQUENCES.md](docs/paused/SEQUENCES.md)
  · [docs/paused/PLAN.md](docs/paused/PLAN.md) — the paused products.
- [docs/paused/LINEAR_DESIGN.md](docs/paused/LINEAR_DESIGN.md) ·
  [docs/paused/MOTION_RESEARCH.md](docs/paused/MOTION_RESEARCH.md) ·
  [docs/paused/MOTION_CATEGORIES.md](docs/paused/MOTION_CATEGORIES.md) — design/research.
- To resume: [docs/paused/README.md](docs/paused/README.md).
