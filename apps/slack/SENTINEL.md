# Sentinel — correctness and fallback contract

Sentinel exists to make failures cheaper, deterministic, and honest. The
executable sources are `src/engine/sentinel.ts`,
`src/engine/hostContract.ts`, and `src/engine/featureFlags.ts`; this document
explains how to change them.

## Place obligations at the lowest owner

| Layer | Owner | Rule |
| --- | --- | --- |
| L0 schema | Types/parsers | Reject malformed contracts before authoring. |
| L1 scaffold | Host generation | Emit required structure and plan islands correctly. |
| L2 normalize | Deterministic transforms | Delete, degrade, retime, rebind, or complete only when the result is exact and non-creative. |
| L3 static gate | Source/DOM analysis | Reject defects provable without a browser. |
| L4 browser gate | Rendered evidence | Measure geometry, visibility, interaction, framing, and motion. |
| L5 model retry | Bounded ladder | Repair creative/layout residue only after lower layers are exhausted. |

Decision rule: if the host can know the answer, the host owns it. A normalizer
must be bounded, idempotent, visible in telemetry, and committed only after the
whole plan revalidates. If it introduces a new finding class, revert the atomic
group and preserve the model artifact.

Normalizer order is an executable contract, not incidental array position.
Every pass declares its read/write fields, pre/postconditions, dependencies,
atomic group, and idempotence proof. Shared writes require a dependency path;
the full invariant audit runs once at the atomic-group boundary so later edits
cannot act on stale partial-audit results. Prefer one declared owner and one
group audit over repeated L2 churn across overlapping fields.

Do not loosen a gate, increase attempts, or add prompt prose to compensate for
a mechanical defect.

## Fallback and degradation

A fallback replaces or materially degrades the authored film. Receipt-level MCP
recovery and exact host normalization are resilience, not visual fallback.

`SLACK_SEQUENCES_ALLOW_DETERMINISTIC_FALLBACK=0` means fail loud: no replacement
film, a Slack diagnostic, and project `FAILURE.md`. Use this for paid probes.
Production uses the explicitly approved fallback setting so an outage can ship
the labeled proof film.

Every degradation must appear in `planning/sentinel-run.json` and in the final
status. Important dispositions are:

- `published`: accepted source, no material degradation;
- `published-degraded`: an authored film shipped with explicit degradations;
- `fallback`: labeled deterministic proof film replaced authoring;
- `fail-loud`: no video was published.

Never report `published-degraded` as a clean pass.

## Attempt discipline

When a paid stage burns an attempt:

1. Stop further paid retries when practical.
2. Preserve the exact raw response and rejected HTML/JSON.
3. Replay the artifact through current parsing or QA.
4. Minimize the failure into a regression.
5. Fix the lowest shared owner and rerun the exact artifact first.
6. Log the result in [PROBE_LOG.md](PROBE_LOG.md).

Scene-scoped repair may replace a whole-plan retry, but it remains a paid model
call and must be counted. Physical hedges and provider timeouts are recorded
separately from logical attempts. Environmental faults are not product fixes,
but they must not be described as a one-call success.

The current bounded ladders remain implementation details in the runner. Do not
raise them as a quality strategy.

## Executable registries

`src/engine/sentinel.ts` is the closed finding/normalizer registry. Each entry
states the obligation, layer, blocking policy, prompt cost, proof, and why that
layer owns it. `test/sentinel.test.ts` detects unregistered findings.

`src/engine/hostContract.ts` registers canonical contract bytes, parsers,
validators, adapters, and runtime injection. It does not decide orchestration
order.

`src/engine/featureFlags.ts` is the source of truth for behavior switches,
defaults, values, and rollback ownership. Source-scan tests reject unknown or
stale `SLACK_SEQUENCES_*` reads.

## Evidence and diagnostics

For a job directory, inspect:

- `planning/attempts/storyboard-*-*.raw.txt` and matching JSON;
- `planning/attempts/author-*-*.html` and matching JSON;
- `planning/author-run.json` for source attempts and terminal findings;
- `planning/sentinel-run.json` for calls, layers, normalizations, and
  degradations;
- `build/qa/sequence-check.json` for the terminal status;
- temporal strip, blocking overlay, important thumbnails, and MP4.

Use the strip for representative states, not to infer motion. Read the camera,
component, interaction, and authored GSAP code for movement between states.

Studio conversion telemetry is executable evidence, not catalog paperwork. An
asset counts only after plugin reconciliation stamps a UID and the augmented
storyboard passes its full plan gate; an unlowered declaration or a declined
duplicate must never seed the evidence-backed capsule.

## Adding or changing a rule

Before implementation:

- identify the first layer that has enough information;
- state whether the change deletes/degrades or invents creative content;
- define bounds, idempotence, ordering dependencies, and rollback behavior;
- add an exact incident fixture and negative control;
- register telemetry and the finding prefix;
- verify strict replay, focused unit/browser tests, and—when authorized—a
  cache-distinct live probe.

Prompt guidance is appropriate for taste and creative choice. It is not the
primary repair mechanism for selector syntax, timing arithmetic, contract
ownership, runtime ordering, or measured geometry.
