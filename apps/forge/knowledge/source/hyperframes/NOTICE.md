# HyperFrames knowledge snapshot — provenance

These files are a small, curated, checked-in snapshot of HyperFrames authoring
documentation, used by Forge **Create**'s retrieval (`createKnowledge.ts`) so
motion drafts honor the real substrate contract without depending on the
optional `references/upstream/hyperframes/` checkout.

- Source: https://github.com/heygen-com/hyperframes (Apache License 2.0)
- Snapshot taken at upstream **v0.7.14** (2026-06).
- Runtime pin used by the engine: `@hyperframes/*@0.6.86` (do not float —
  see CLAUDE.md). These docs describe the stable authoring contract, which is
  forward/backward compatible across the 0.6→0.7 line for the `data-*` timing
  attributes and the single-paused-timeline model Forge relies on.

Files:

- `hf-authoring-contract.md` — Forge-curated distillation of the
  `hyperframes-core` skill (root forms, sizing/black-background bugs, the
  one-paused-timeline rule, non-negotiable determinism bans). No dangling
  cross-references.
- `hf-determinism-rules.md` — verbatim upstream determinism/runtime/layout
  reference.
- `hf-data-attributes.md` — verbatim `data-*` timing/media/composition contract.
- `hf-compositions.md` — verbatim composition structure + variables.
- `hf-gsap.md` — verbatim GSAP runtime contract for HyperFrames.
- `hf-common-mistakes.md` — verbatim production pitfalls (good for the repair
  route).
- `hf-motion-techniques.md` — verbatim "13 visual techniques" reference with
  code patterns.

To refresh: re-clone upstream (`docs`, `skills/hyperframes-core`,
`skills/hyperframes-animation/techniques.md`, `packages/cli/src/docs`,
`packages/core/docs`), re-copy the verbatim files, and re-distill the contract.
Unnecessary upstream files (SECURITY.md, lockfiles, Dockerfiles, CI config) are
intentionally excluded.
