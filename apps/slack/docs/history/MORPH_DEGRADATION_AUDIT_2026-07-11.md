# Morph degradation audit — 2026-07-11

WS-D2 mined 109 persisted JSON ledgers/caches across 39 project directories.
Rows were deduplicated by project, boundary, and normalized cause, leaving 76
unique observations:

| Cause | Count |
| --- | ---: |
| Aspect-ratio mismatch | 37 |
| Structure mismatch | 21 |
| Invisible paint | 7 |
| Zero-size endpoint | 6 |
| Semantic-family mismatch | 4 |
| Unknown/truncated | 1 |

Meridian contributed two invisible-paint observations and one aspect-ratio
observation. The two highest-confidence mechanical causes are now host-owned:
component-root opacity is ignored when the host animates that root, and a
light material shell with at most 12 nodes may bridge up to 3.5× aspect
distance. Dense surfaces keep the stricter cap. Discovery remains tighter at
2.0× and browser-rejects any proposed upgrade that degrades at runtime.

The remaining dense aspect and structural mismatches are not safely
normalizable: forcing them would turn unrelated silhouettes into the smear
class this workstream is meant to eliminate. `cutDiscovery.ts` now exposes a
duplicate-safe classifier/summarizer, and its focused regressions pin these
cause families for future probe comparisons.
