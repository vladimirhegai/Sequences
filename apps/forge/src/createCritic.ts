/**
 * Deterministic Create critic (FORGE.md "Preview And Showcase Quality").
 *
 * The Create prompt states the MOTION BAR as guidance — one loud motion at a
 * time, at most ~3 things moving at once, prefer transform/opacity, stay
 * deterministic. Guidance the model may ignore. This module re-encodes those
 * rules as a deterministic critic that runs on every authored draft, mirroring
 * the engine's zero-token linter (CLAUDE.md law 4, "a critic that isn't the
 * user's eyes"). It selects nothing and authors nothing; it only reports.
 *
 * Determinism violations are errors (they break the export gate); taste/density
 * violations are warnings/info that surface in the inspector. Errors feed back
 * into the next turn's repair prompt; warnings are advisory.
 */
import { collapsePeerStaggers } from "./createDraft.ts";
import type { CreateTimelineStep, CreateValidationIssue, ForgeExtensionDraft } from "./createDraft.ts";

const MAX_CONCURRENT_STREAMS = 3;
const DEFAULT_DURATION = 0.45;
const LOUD_DISTANCE_PX = 80;
const LOUD_PERCENT = 40;
const LOUD_SCALE_DELTA = 0.4;
const LOUD_DURATION_SEC = 0.8;
const FLAT_HIERARCHY_MIN_STEPS = 4;
const SIMULTANEITY_EPSILON = 0.001;
// A regular stagger (≥3 same-shape beats at an even cadence) reads as ONE stream
// — the eye follows a cascade as a single gesture, not N competing motions. The
// concurrency/emphasis rules count streams, not raw steps, so the product's
// signature "metric cascade" is never punished as over-busy.
const STAGGER_MIN_GAP = 0.03;
const STAGGER_MAX_GAP = 0.6;
const STAGGER_GAP_TOLERANCE = 0.7;
const STAGGER_MIN_RUN = 3;

/** Patterns that make a snippet non-deterministic or network-dependent. */
const NONDETERMINISTIC_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /\bMath\s*\.\s*random\b/, label: "Math.random" },
  { re: /\bDate\s*\.\s*now\b/, label: "Date.now" },
  { re: /\bperformance\s*\.\s*now\b/, label: "performance.now" },
  { re: /\bnew\s+Date\b/, label: "new Date" },
  { re: /\bfetch\s*\(/, label: "fetch()" },
  { re: /\bXMLHttpRequest\b/, label: "XMLHttpRequest" },
  { re: /\bimport\s*\(/, label: "dynamic import()" },
  { re: /\bset(?:Timeout|Interval)\s*\(/, label: "setTimeout/setInterval" },
  { re: /https?:\/\//, label: "external URL" },
];

/** Layout-thrashing properties — prefer transform/opacity instead. */
const EXPENSIVE_PROP =
  /^(width|height|top|left|right|bottom|inset|margin|padding|font-?size|line-?height|border-?width|flex-?basis|gap)/i;

function issue(level: CreateValidationIssue["level"], code: string, message: string): CreateValidationIssue {
  return { level, code, message };
}

function isMoving(step: CreateTimelineStep): boolean {
  return step.op !== "set";
}

function stepStart(step: CreateTimelineStep): number {
  return Number.isFinite(step.at) ? Math.max(0, step.at) : 0;
}

function stepDuration(step: CreateTimelineStep): number {
  if (!isMoving(step)) return 0;
  return Number.isFinite(step.duration as number) ? Math.max(0, step.duration as number) : DEFAULT_DURATION;
}

function mergedVars(step: CreateTimelineStep): Record<string, string | number | boolean> {
  return { ...(step.from ?? {}), ...(step.to ?? {}), ...(step.vars ?? {}) };
}

function numberFor(value: string | number | boolean | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function usesMaskyProperty(vars: Record<string, string | number | boolean>): boolean {
  return Object.keys(vars).some((key) => /clip|mask|yPercent/i.test(key));
}

/**
 * A "loud" beat draws primary attention: big travel, big scale, long, or masked.
 * Each phase bag is scanned independently — a `from: { y: 120 }` / `to: { y: 0 }`
 * still travels 120px even though the merged value is 0.
 */
function isLoud(step: CreateTimelineStep): boolean {
  if (!isMoving(step)) return false;
  if (stepDuration(step) >= LOUD_DURATION_SEC) return true;
  if (usesMaskyProperty(mergedVars(step))) return true;
  for (const bag of [step.from, step.to, step.vars]) {
    for (const [key, value] of Object.entries(bag ?? {})) {
      const n = numberFor(value);
      if (n === null) continue;
      const lower = key.toLowerCase();
      if ((lower === "x" || lower === "y") && Math.abs(n) >= LOUD_DISTANCE_PX) return true;
      if ((lower === "xpercent" || lower === "ypercent") && Math.abs(n) >= LOUD_PERCENT) return true;
      if (lower.includes("scale") && Math.abs(n - 1) >= LOUD_SCALE_DELTA) return true;
    }
  }
  return false;
}

/** A perceptual unit of motion: a standalone beat or a whole stagger run. */
interface Stream {
  start: number;
  end: number;
  loud: boolean;
}

function overlaps(a: Stream, b: Stream): boolean {
  return a.start < b.end - SIMULTANEITY_EPSILON && b.start < a.end - SIMULTANEITY_EPSILON;
}

/** The set of animated property keys — a step's "shape", for grouping staggers. */
function varSignature(step: CreateTimelineStep): string {
  return [...new Set(Object.keys(mergedVars(step)).map((key) => key.toLowerCase()))].sort().join(",");
}

/**
 * Collapse movers into perceptual streams: a run of ≥3 same-shape beats at a
 * roughly even cadence becomes one stream spanning the whole cascade; everything
 * else is its own stream. Movers must be pre-sorted by start time.
 */
function buildStreams(movers: CreateTimelineStep[]): Stream[] {
  const streams: Stream[] = [];
  let i = 0;
  while (i < movers.length) {
    const signature = varSignature(movers[i]!);
    let firstGap: number | null = null;
    let j = i;
    while (j + 1 < movers.length) {
      const gap = stepStart(movers[j + 1]!) - stepStart(movers[j]!);
      if (gap < STAGGER_MIN_GAP || gap > STAGGER_MAX_GAP) break;
      if (varSignature(movers[j + 1]!) !== signature) break;
      if (firstGap === null) firstGap = gap;
      else if (Math.abs(gap - firstGap) > firstGap * STAGGER_GAP_TOLERANCE) break;
      j++;
    }
    if (j - i + 1 >= STAGGER_MIN_RUN) {
      const last = movers[j]!;
      streams.push({
        start: stepStart(movers[i]!),
        end: stepStart(last) + stepDuration(last),
        loud: movers.slice(i, j + 1).some(isLoud),
      });
      i = j + 1;
    } else {
      const start = stepStart(movers[i]!);
      streams.push({ start, end: start + Math.max(stepDuration(movers[i]!), SIMULTANEITY_EPSILON), loud: isLoud(movers[i]!) });
      i++;
    }
  }
  return streams;
}

/** Peak number of streams overlapping a single instant. */
function peakConcurrency(streams: Stream[]): number {
  const events = streams.flatMap((s) => [
    { t: s.start, delta: 1 },
    { t: s.end, delta: -1 },
  ]);
  // Process exits before entries at the same instant so back-to-back streams
  // that merely touch are not counted as concurrent.
  events.sort((a, b) => a.t - b.t || a.delta - b.delta);
  let current = 0;
  let peak = 0;
  for (const event of events) {
    current += event.delta;
    if (current > peak) peak = current;
  }
  return peak;
}

function checkDeterminism(draft: Pick<ForgeExtensionDraft, "timeline" | "liftSource">, issues: CreateValidationIssue[]): void {
  const found = new Set<string>();
  const scan = (text: string): void => {
    for (const { re, label } of NONDETERMINISTIC_PATTERNS) if (re.test(text)) found.add(label);
  };
  scan(draft.liftSource ?? "");
  for (const step of draft.timeline ?? []) {
    for (const value of Object.values(mergedVars(step))) {
      if (typeof value === "string") scan(value);
    }
  }
  if (found.size) {
    issues.push(
      issue(
        "error",
        "nondeterministic",
        `Motion uses non-deterministic or network-dependent code (${[...found].join(", ")}). Exported snippets must render identically every time with no external dependency — drive variation through knobs instead.`,
      ),
    );
  }
}

function checkExpensiveProps(timeline: CreateTimelineStep[], issues: CreateValidationIssue[]): void {
  const props = new Set<string>();
  for (const step of timeline) {
    for (const key of Object.keys(mergedVars(step))) if (EXPENSIVE_PROP.test(key)) props.add(key);
  }
  if (props.size) {
    issues.push(
      issue(
        "warning",
        "expensive-prop",
        `Animating layout properties (${[...props].join(", ")}) can jank the render. Prefer transform (x/y/scale/rotation) and opacity unless a measured effect needs more.`,
      ),
    );
  }
}

function checkSimultaneity(streams: Stream[], issues: CreateValidationIssue[]): void {
  const peak = peakConcurrency(streams);
  if (peak > MAX_CONCURRENT_STREAMS) {
    issues.push(
      issue(
        "warning",
        "simultaneity",
        `Up to ${peak} independent motions run at once; keep it to ~${MAX_CONCURRENT_STREAMS}. A coherent stagger counts as one — this is genuinely separate movement competing for the eye.`,
      ),
    );
  }
}

function checkCompetingEmphasis(streams: Stream[], issues: CreateValidationIssue[]): void {
  const loud = streams.filter((s) => s.loud);
  for (let i = 0; i < loud.length; i++) {
    for (let j = i + 1; j < loud.length; j++) {
      if (overlaps(loud[i]!, loud[j]!)) {
        issues.push(
          issue(
            "warning",
            "competing-emphasis",
            "Two loud motions overlap in time. Keep one loud beat per moment — let the others settle or shrink so a single thing owns the viewer's attention.",
          ),
        );
        return;
      }
    }
  }
}

function checkFlatHierarchy(movers: CreateTimelineStep[], issues: CreateValidationIssue[]): void {
  if (movers.length < FLAT_HIERARCHY_MIN_STEPS) return;
  const firstStart = stepStart(movers[0]!);
  if (movers.every((step) => Math.abs(stepStart(step) - firstStart) <= SIMULTANEITY_EPSILON)) {
    issues.push(
      issue(
        "info",
        "flat-hierarchy",
        `${movers.length} elements enter at the same instant with no stagger. Hierarchy beats quantity — lead with one hero beat, then bring the rest in behind it.`,
      ),
    );
  }
}

/**
 * Run the deterministic motion critic over a normalized, reference-resolved
 * draft. Returns issues to merge into the draft's validation list. `error`-level
 * issues fail the draft (and feed the next repair turn); `warning`/`info` are
 * advisory and shown in the inspector.
 */
export function critiqueCreateDraft(
  draft: Pick<ForgeExtensionDraft, "timeline" | "liftSource" | "primitiveKind">,
): CreateValidationIssue[] {
  const issues: CreateValidationIssue[] = [];
  const timeline = draft.timeline ?? [];
  const movers = timeline.filter(isMoving).sort((a, b) => stepStart(a) - stepStart(b));
  const streams = buildStreams(movers);

  checkDeterminism(draft, issues);
  checkExpensiveProps(timeline, issues);
  checkSimultaneity(streams, issues);
  // Explain the preview≠export gap when a multi-subject cascade collapses to a
  // single reusable primitive on export.
  const peerNote = collapsePeerStaggers(timeline).note;
  if (peerNote) issues.push(issue("info", "peer-stagger-collapsed", peerNote));
  // Ambient/continuous loops are meant to sustain several subtle motions at
  // once; the "one loud beat" and "stagger the entrance" rules do not apply.
  if (draft.primitiveKind !== "continuous") {
    checkCompetingEmphasis(streams, issues);
    checkFlatHierarchy(movers, issues);
  }
  return issues;
}
