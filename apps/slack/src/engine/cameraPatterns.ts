/**
 * Curated camera-pattern catalog for planning and Studio discovery.
 *
 * A pattern is executable storyboard data, not a CSS animation preset. Its
 * `camera` value is the same typed SceneCameraIntentV1 consumed by the camera
 * resolver/runtime. `stations` only give Studio a deterministic schematic of
 * the larger spatial world; authors still bind the ids to real data-region
 * elements in a composition.
 */
import type { SceneCameraIntentV1 } from "./cameraContract.ts";

export type CameraPatternStationRole = "entry" | "claim" | "proof" | "context" | "resolve";

export interface CameraPatternStationV1 {
  id: string;
  label: string;
  role: CameraPatternStationRole;
  x: number;
  y: number;
  width: number;
  height: number;
  description: string;
}

export interface CameraPatternV1 {
  version: 1;
  id: string;
  title: string;
  purpose: string;
  durationSec: number;
  motionDescription: string;
  eyeTrace: string;
  bestFor: string[];
  world: {
    width: number;
    height: number;
    viewportWidth: number;
    viewportHeight: number;
  };
  stations: CameraPatternStationV1[];
  /** Drop-in typed camera intent. Station ids match fromRegion/toRegion. */
  camera: SceneCameraIntentV1;
}

const WIDE_WORLD = {
  width: 3200,
  height: 1800,
  viewportWidth: 1280,
  viewportHeight: 720,
} as const;

/**
 * Deliberately different blocking patterns. Their station names are
 * semantic examples, not required production ids; callers may rename them as
 * long as every typed camera target and DOM data-region remain in agreement.
 */
export const CAMERA_PATTERNS: readonly CameraPatternV1[] = [
  {
    version: 1,
    id: "text-runway",
    title: "Text Runway",
    purpose: "Carry one sentence across adjacent full-frame claims without resetting to center.",
    durationSec: 6.4,
    motionDescription:
      "Open already moving on claim one, accelerate laterally into the continuation, then hand residual drift into the final phrase. Each landing is readable before the next commit.",
    eyeTrace: "A single left-to-right rail; typography leads and the camera follows the reading direction.",
    bestFor: ["chapter copy", "contrast statements", "zero-X / zero-Y claims"],
    world: WIDE_WORLD,
    stations: [
      { id: "claim-one", label: "ZERO ALIGNMENT.", role: "entry", x: 300, y: 610, width: 760, height: 520, description: "Opening claim fills the left station." },
      { id: "claim-two", label: "ZERO MOMENTUM.", role: "claim", x: 1220, y: 610, width: 760, height: 520, description: "Continuation inherits the same baseline." },
      { id: "claim-three", label: "UNTIL NOW.", role: "resolve", x: 2140, y: 610, width: 760, height: 520, description: "Short payoff lands with space to dwell." },
    ],
    camera: {
      version: 1,
      path: [
        { version: 1, move: "drift", fromRegion: "claim-one", toRegion: "claim-one", zoom: 1.03, startSec: 0, durationSec: 0.55, ease: "seqDrift" },
        { version: 1, move: "pan", toRegion: "claim-two", zoom: 1.1, startSec: 0.55, durationSec: 1, ease: "seqSwoosh" },
        { version: 1, move: "drift", toRegion: "claim-two", zoom: 1.13, startSec: 1.55, durationSec: 1.15, ease: "seqSettle" },
        { version: 1, move: "pan", toRegion: "claim-three", zoom: 1.08, startSec: 2.7, durationSec: 1, ease: "seqSwoosh" },
        { version: 1, move: "drift", toRegion: "claim-three", zoom: 1.12, startSec: 3.7, durationSec: 2.7, ease: "seqSettle" },
      ],
    },
  },
  {
    version: 1,
    id: "push-and-hold",
    title: "Push and Hold",
    purpose: "Commit to one proof detail, hold long enough to read it, and keep the held frame subtly alive.",
    durationSec: 5,
    motionDescription:
      "A measured push isolates the proof surface. A short explicit hold protects comprehension; two quiet drift windows carry chart, cursor, or light-travel micro-motion without abandoning the target.",
    eyeTrace: "The field contracts from product context to one proof panel and never asks the eye to reacquire it.",
    bestFor: ["search results", "metric proof", "cursor outcomes", "dense product UI"],
    world: WIDE_WORLD,
    stations: [
      { id: "surface", label: "PRODUCT SURFACE", role: "entry", x: 820, y: 420, width: 1560, height: 960, description: "Readable system context before the commit." },
      { id: "proof", label: "PROOF DETAIL", role: "proof", x: 1210, y: 650, width: 780, height: 500, description: "The exact row, chart, or result that owns attention." },
    ],
    camera: {
      version: 1,
      path: [
        { version: 1, move: "push-in", fromRegion: "surface", toRegion: "proof", zoom: 1.3, startSec: 0, durationSec: 0.9, ease: "seqAnticipate" },
        { version: 1, move: "drift", toRegion: "proof", zoom: 1.33, startSec: 0.9, durationSec: 1.6, ease: "seqSettle" },
        { version: 1, move: "hold", toRegion: "proof", zoom: 1.33, startSec: 2.5, durationSec: 0.55, ease: "none" },
        { version: 1, move: "drift", toRegion: "proof", zoom: 1.36, startSec: 3.05, durationSec: 1.95, ease: "seqSettle" },
      ],
    },
  },
  {
    version: 1,
    id: "pullback-system-reveal",
    title: "Pullback System Reveal",
    purpose: "Turn one local fact into a broader system explanation without cutting away from its origin.",
    durationSec: 5.8,
    motionDescription:
      "Begin tight on the triggering detail, pull back to expose the surrounding system, then use a parallax pass and residual drift to reveal relationships at different depths.",
    eyeTrace: "The detail remains the visual origin while context grows around it; the reveal expands understanding rather than changing subjects.",
    bestFor: ["architecture reveals", "dependency graphs", "before/after context", "feature ecosystems"],
    world: WIDE_WORLD,
    stations: [
      { id: "detail", label: "TRIGGER", role: "entry", x: 1340, y: 720, width: 520, height: 360, description: "The local fact that starts the explanation." },
      { id: "system", label: "CONNECTED SYSTEM", role: "context", x: 560, y: 330, width: 2080, height: 1140, description: "The wider relationship map revealed around the trigger." },
    ],
    camera: {
      version: 1,
      path: [
        { version: 1, move: "drift", fromRegion: "detail", toRegion: "detail", zoom: 1.2, startSec: 0, durationSec: 0.45, ease: "seqDrift" },
        { version: 1, move: "pull-back", toRegion: "system", zoom: 0.78, startSec: 0.45, durationSec: 1.05, ease: "seqAnticipate" },
        { version: 1, move: "parallax-pass", toRegion: "system", zoom: 0.84, startSec: 1.5, durationSec: 2.5, ease: "seqGlide" },
        { version: 1, move: "drift", toRegion: "system", zoom: 0.88, startSec: 4, durationSec: 1.8, ease: "seqSettle" },
      ],
    },
  },
  {
    version: 1,
    id: "lateral-stations",
    title: "Lateral Stations",
    purpose: "Travel through three product stations as one continuous world instead of presenting three slides.",
    durationSec: 7.2,
    motionDescription:
      "A quiet entry yields to a confident track across adjacent stations. The middle station gets a long parallax development window; a second pan carries its residual direction into the resolve.",
    eyeTrace: "Stable horizontal geography makes every destination predictable while scale and content change at each station.",
    bestFor: ["workflow demos", "three-step systems", "input-process-output", "product tours"],
    world: WIDE_WORLD,
    stations: [
      { id: "input", label: "01 / INPUT", role: "entry", x: 260, y: 610, width: 760, height: 520, description: "The initiating request or source surface." },
      { id: "process", label: "02 / PROCESS", role: "proof", x: 1220, y: 520, width: 760, height: 700, description: "The central product action receives the longest development." },
      { id: "outcome", label: "03 / OUTCOME", role: "resolve", x: 2180, y: 610, width: 760, height: 520, description: "The payoff inherits the established travel direction." },
    ],
    camera: {
      version: 1,
      path: [
        { version: 1, move: "drift", fromRegion: "input", toRegion: "input", zoom: 1.02, startSec: 0, durationSec: 0.45, ease: "seqDrift" },
        { version: 1, move: "pan", toRegion: "process", zoom: 1.1, startSec: 0.45, durationSec: 1, ease: "seqSwoosh" },
        { version: 1, move: "parallax-pass", toRegion: "process", zoom: 1.14, startSec: 1.45, durationSec: 2.4, ease: "seqGlide" },
        { version: 1, move: "pan", toRegion: "outcome", zoom: 1.08, startSec: 3.85, durationSec: 0.95, ease: "seqSwoosh" },
        { version: 1, move: "drift", toRegion: "outcome", zoom: 1.12, startSec: 4.8, durationSec: 2.4, ease: "seqSettle" },
      ],
    },
  },
  {
    version: 1,
    id: "proof-track",
    title: "Proof Track",
    purpose: "Move from claim to evidence to outcome with one explicit visual argument and no decorative detours.",
    durationSec: 6.4,
    motionDescription:
      "The camera eases off the claim, tracks diagonally into measured evidence, then makes one energetic but level pan into the outcome. Drift windows let counters and annotations overlap the travel.",
    eyeTrace: "A descending diagonal connects claim and proof; the final move rises into the result, forming a clear argument-shaped path.",
    bestFor: ["case studies", "metric narratives", "problem-proof-payoff", "executive summaries"],
    world: WIDE_WORLD,
    stations: [
      { id: "claim", label: "CLAIM", role: "entry", x: 300, y: 300, width: 780, height: 500, description: "The promise or problem statement." },
      { id: "evidence", label: "MEASURED PROOF", role: "proof", x: 1210, y: 940, width: 860, height: 560, description: "A chart, comparison, or verified product state." },
      { id: "result", label: "OUTCOME", role: "resolve", x: 2220, y: 380, width: 700, height: 520, description: "The result lands away from evidence but preserves its directional energy." },
    ],
    camera: {
      version: 1,
      path: [
        { version: 1, move: "drift", fromRegion: "claim", toRegion: "claim", zoom: 1.04, startSec: 0, durationSec: 0.4, ease: "seqDrift" },
        { version: 1, move: "pan", toRegion: "evidence", zoom: 1.16, startSec: 0.4, durationSec: 1, ease: "seqAnticipate" },
        { version: 1, move: "drift", toRegion: "evidence", zoom: 1.2, startSec: 1.4, durationSec: 1.6, ease: "seqSettle" },
        { version: 1, move: "pan", toRegion: "result", zoom: 1.1, startSec: 3, durationSec: 0.85, ease: "seqSwoosh" },
        { version: 1, move: "drift", toRegion: "result", zoom: 1.14, startSec: 3.85, durationSec: 2.55, ease: "seqSettle" },
      ],
    },
  },
  {
    version: 1,
    id: "snap-to-proof",
    title: "Snap to Proof",
    purpose: "Turn a broad product claim into one undeniable UI result with a single fast, motivated reframe.",
    durationSec: 4.2,
    motionDescription:
      "A short poised drift gives way to one sub-second whip into the proof detail; the remaining window settles forward while the product state develops.",
    eyeTrace: "The eye starts on the claim and is carried directly into the result, with no intermediate station to reacquire.",
    bestFor: ["feature proof", "search result", "automation payoff", "before-to-after reveal"],
    world: WIDE_WORLD,
    stations: [
      { id: "claim", label: "PROMISE", role: "entry", x: 300, y: 520, width: 880, height: 620, description: "A clean claim or initiating UI state." },
      { id: "proof", label: "SHIPPED RESULT", role: "proof", x: 1940, y: 570, width: 900, height: 620, description: "The exact result surface that pays off the claim." },
    ],
    camera: {
      version: 1,
      path: [
        { version: 1, move: "drift", fromRegion: "claim", toRegion: "claim", zoom: 1.02, startSec: 0, durationSec: 0.35, ease: "seqDrift" },
        { version: 1, move: "whip", toRegion: "proof", zoom: 1.2, startSec: 0.35, durationSec: 0.55, ease: "seqWhip" },
        { version: 1, move: "drift", toRegion: "proof", zoom: 1.25, startSec: 0.9, durationSec: 3.3, ease: "seqSettle" },
      ],
    },
  },
  {
    version: 1,
    id: "hero-arc-landing",
    title: "Hero Arc Landing",
    purpose: "Give one product hero a premium depth reveal, then land squarely on the control or metric that matters.",
    durationSec: 5.4,
    motionDescription:
      "The camera anticipates into a shallow orbit-lite arc, lets depth layers separate, then makes one compact push to a stable proof landing.",
    eyeTrace: "Context wraps around the hero without rolling the horizon; the final push pins attention to its actionable center.",
    bestFor: ["browser hero", "AI workflow", "integration map", "premium product reveal"],
    world: WIDE_WORLD,
    stations: [
      { id: "hero", label: "PRODUCT HERO", role: "entry", x: 920, y: 420, width: 1360, height: 920, description: "A layered product surface with a clear central subject." },
      { id: "action", label: "DECISIVE ACTION", role: "proof", x: 1250, y: 650, width: 700, height: 500, description: "The control, metric, or generated result that closes the reveal." },
    ],
    camera: {
      version: 1,
      path: [
        { version: 1, move: "orbit-lite", fromRegion: "hero", toRegion: "hero", zoom: 1.06, startSec: 0, durationSec: 1.15, ease: "seqAnticipate" },
        { version: 1, move: "parallax-pass", toRegion: "hero", zoom: 1.1, startSec: 1.15, durationSec: 1.55, ease: "seqGlide" },
        { version: 1, move: "push-in", toRegion: "action", zoom: 1.3, startSec: 2.7, durationSec: 0.8, ease: "seqSwoosh" },
        { version: 1, move: "drift", toRegion: "action", zoom: 1.33, startSec: 3.5, durationSec: 1.9, ease: "seqSettle" },
      ],
    },
  },
  {
    version: 1,
    id: "compare-swing",
    title: "Compare Swing",
    purpose: "Contrast two product states rapidly, then resolve on the winning state without a three-slide rhythm.",
    durationSec: 5.8,
    motionDescription:
      "A quick anticipate launches a lateral compare, the losing state gets only a brief read, and a faster return swing lands deeper on the winning proof.",
    eyeTrace: "One reversible horizontal rail makes the comparison legible; the deeper final zoom declares the winner.",
    bestFor: ["before/after", "manual versus automated", "legacy versus new", "plan comparison"],
    world: WIDE_WORLD,
    stations: [
      { id: "before", label: "BEFORE", role: "entry", x: 360, y: 560, width: 900, height: 620, description: "The constrained or manual state." },
      { id: "after", label: "AFTER", role: "resolve", x: 1940, y: 560, width: 900, height: 620, description: "The product-powered winning state." },
    ],
    camera: {
      version: 1,
      path: [
        { version: 1, move: "pan", fromRegion: "before", toRegion: "after", zoom: 1.1, startSec: 0, durationSec: 0.95, ease: "seqAnticipate" },
        { version: 1, move: "drift", toRegion: "after", zoom: 1.14, startSec: 0.95, durationSec: 1.5, ease: "seqSettle" },
        { version: 1, move: "pan", toRegion: "before", zoom: 1.04, startSec: 2.45, durationSec: 0.75, ease: "seqSwoosh" },
        { version: 1, move: "pan", toRegion: "after", zoom: 1.22, startSec: 3.2, durationSec: 0.7, ease: "seqWhip" },
        { version: 1, move: "drift", toRegion: "after", zoom: 1.26, startSec: 3.9, durationSec: 1.9, ease: "seqSettle" },
      ],
    },
  },
];

export function cameraPatternById(id: string): CameraPatternV1 | undefined {
  return CAMERA_PATTERNS.find((pattern) => pattern.id === id);
}
