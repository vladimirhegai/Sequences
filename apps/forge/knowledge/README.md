# Forge prompt knowledge

These files are data owned by Forge's Stage and Create prompt pipelines. They
are not development-agent skills and must not be moved into `.claude/skills`,
`.codex/skills`, or another auto-discovery directory.

`source/gsap/` is a small, checked-in snapshot of the official GSAP skill
guidance used by retrieval. Its upstream license is stored beside it. The full
upstream repository may be kept locally at
`references/upstream/gsap-skills/`, but Forge never depends on that checkout.

`source/hyperframes/` is the equivalent checked-in snapshot of the HyperFrames
authoring contract (composition structure, the `data-*` timing attributes,
determinism rules, common mistakes, and visual techniques). Create's retrieval
(`createKnowledge.ts`) reads it so generated motion drafts honor the real
substrate without depending on `references/upstream/hyperframes/`. Provenance,
upstream version, and the refresh procedure are in that directory's `NOTICE.md`.
