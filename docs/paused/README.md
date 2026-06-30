# Paused docs — Forge + Sequences

These documents are **paused, not abandoned.** Development on Forge
(`apps/forge`), Sequences (`apps/sequences`), and the shared engine
(`packages/core`, `packages/platform`) is frozen for the duration of the
**Slack Agent Builder Challenge** hackathon. The active work is in
[../../apps/slack/](../../apps/slack/).

## What's here

| File | What it is |
| --- | --- |
| [WORKSPACE.md](WORKSPACE.md) | The full workspace guide that used to be the root `CLAUDE.md` — the **9 laws**, package layout, substrate contract, working rules. The canonical engine reference. |
| [FORGE.md](FORGE.md) | The active-product doc for Forge (the component workshop). |
| [SEQUENCES.md](SEQUENCES.md) | App detail for the Sequences motion-graphics app + CLI. |
| [PLAN.md](PLAN.md) | The Sequences rewrite plan. |
| [LINEAR_DESIGN.md](LINEAR_DESIGN.md) | Forge UI chrome (Linear-dark design DNA). |
| [MOTION_RESEARCH.md](MOTION_RESEARCH.md) | Motion research notes. |
| [MOTION_CATEGORIES.md](MOTION_CATEGORIES.md) | Faceted motion taxonomy. |

## To resume Forge / Sequences after the hackathon

1. Move [WORKSPACE.md](WORKSPACE.md) back to the repo root as `CLAUDE.md`
   (or merge its guidance into whatever the root `CLAUDE.md` has become).
2. Move the other docs back to the repo root if you prefer them there — the
   cross-references between these files use same-folder links and keep working
   either way.
3. Unfreeze `packages/core`, `packages/platform`, `apps/forge`, `apps/sequences`.

## Note on links

Cross-references **between these docs** (e.g. `[FORGE.md](FORGE.md)`) still
resolve because they all moved together. Links to **source code**
(`packages/core/src/...`, `apps/forge/src/...`) inside these files are written
relative to the **repo root** — resolve them from there, not from `docs/paused/`.
