---
name: verify
description: Verify Sequences for Slack changes before completion with root and Slack suites, exact artifact replays, model-free source/MCP gates, browser coverage, and rendered motion evidence. Use after implementing or fixing Slack code, contracts, normalizers, runtime, camera, cuts, rendering, temporal behavior, MCP seams, or delivery plumbing.
---

# Verify changes

Run the baseline from the repository root and report failures plainly:

```powershell
npm run typecheck
npm test
npm run typecheck --workspace @sequences/slack
npm run test:unit --workspace @sequences/slack
npm run demo --workspace @sequences/slack
```

`npm test` currently includes package tests plus Slack unit/browser tests; keep
the explicit Slack unit command because it is the fast product-owned signal.
Do not replace the baseline with a filtered suite.

For documentation/skill-only changes, do not burn the full runtime suite by
ritual. Run `git diff --check`, verify local links and named npm scripts, check
that the first unchecked refactor step remains correct, and run any focused
documentation contract test that exists. State explicitly that no product test
or paid probe was needed.

For deterministic storyboard/source normalization, parsing, contracts,
scaffolds, repair, or publication-status changes, also run exact replay:

```powershell
npm run replay:all --workspace @sequences/slack
```

Replay the exact incident first with `storyboard:replay` or `source:replay`
when the change came from a persisted artifact. Unexpected replay drift is a
failure unless the task explicitly changes output and updates its frozen proof.

For source-authoring or MCP seams, run:

```powershell
npm run mcp:demo --workspace @sequences/slack
npm run direct:demo --workspace @sequences/slack
npm run sequence:check --workspace @sequences/slack -- --demo --no-mcp --format both
```

For runtime, camera, cut, component, interaction, layout, render, or temporal
changes, run the focused browser regression and the full Slack browser suite:

```powershell
npm run test:browser --workspace @sequences/slack
```

For motion-affecting changes, run the deterministic golden film when applicable:

```powershell
npm run film:demo --workspace @sequences/slack
```

Inspect representative frames, the temporal strip, blocking evidence, and the
motion code between samples. A green report or thumbnail set alone is not a
motion-quality pass.

Confirm tests/scripts use temp or project-local state. Report exactly what ran,
including timeouts, flakes, skipped render evidence, and known limitations.
Never claim OAuth, Slack upload, Railway, or visual quality from unit tests.
Never publish, deploy, or run a paid probe without explicit authorization.

Under the active S6.9-S6.13 hackathon contract, verification distinguishes hard
failures from advisory quality evidence. A runtime-valid, human-acceptable MP4
with advisory-only `warn` may pass the sprint; do not demand a new provider call
or probe to manufacture zero residue. Mechanical load-bearing containment must
be proved by exact before/after browser measurement and a negative control that
leaves intentional cropping/taste choices untouched.
