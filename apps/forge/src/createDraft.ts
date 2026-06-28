import fs from "node:fs";
import path from "node:path";
import {
  contentHash,
  DURATION_TOKENS,
  EASING_TOKENS,
  type DurationToken,
  type EasingToken,
  type PrimitiveKindT,
  type SeqextBundle,
} from "@sequences/core";

export const CREATE_ROUTES = [
  "interface-reveal",
  "micro-interaction",
  "data-moment",
  "brand-sting",
  "transition-bridge",
  "media-frame",
] as const;

export type CreateRoute = (typeof CREATE_ROUTES)[number];

export type CreateAction =
  | "reveal"
  | "dismiss"
  | "emphasize"
  | "transform"
  | "transition"
  | "demonstrate"
  | "quantify"
  | "assemble"
  | "sequence"
  | "orbit"
  | "sustain";

export interface CreateTaxonomy {
  family?: string;
  subject?: string;
  action?: CreateAction | string;
  technique?: string[];
  energy?: "calm" | "punchy";
  style?: "organic" | "mechanical";
  register?: string;
  context?: string[];
}

export interface CreateTimelineStep {
  asset: string;
  target: string;
  op: "fromTo" | "to" | "from" | "set" | "count";
  from?: Record<string, string | number | boolean>;
  to?: Record<string, string | number | boolean>;
  vars?: Record<string, string | number | boolean>;
  at: number;
  duration?: number;
  ease?: string;
}

export interface CreateActionTrigger {
  at: number;
  asset: string;
  trigger: string;
}

export interface CreateKnobAutomation {
  at: number;
  asset: string;
  name: string;
  value: string | number | boolean;
}

export interface CreateStageRequest {
  brief: string;
  aspect?: string;
  references?: string[];
  styleHints?: string;
  requiredParts?: string[];
  requiredActions?: string[];
  requiredKnobs?: string[];
  reason?: string;
}

export interface CreateValidationIssue {
  level: "info" | "warning" | "error";
  code: string;
  message: string;
}

export interface CreateCompiledMotion {
  primitiveKind: PrimitiveKindT;
  defaults: SeqextBundle["spec"]["defaults"];
  tokens: SeqextBundle["spec"]["tokens"];
  knobs: SeqextBundle["spec"]["knobs"];
  skeleton: SeqextBundle["spec"]["skeleton"];
  needsMask?: boolean;
  warnings: string[];
}

export interface ForgeExtensionDraft {
  id: string;
  name: string;
  summary: string;
  route: CreateRoute;
  primitiveKind: PrimitiveKindT;
  aspect: string;
  aspectLocked: true;
  durationSec: number;
  components: string[];
  media: string[];
  taxonomy: CreateTaxonomy;
  timeline: CreateTimelineStep[];
  actions: CreateActionTrigger[];
  knobAutomation: CreateKnobAutomation[];
  compiledMotion?: CreateCompiledMotion;
  liftSource: string;
  validation: CreateValidationIssue[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateDraftStore {
  currentId: string | null;
  drafts: ForgeExtensionDraft[];
}

const STORE_FILE = "drafts.json";
const AUDIT_DIR = "create-drafts";
const VALID_ROUTES = new Set<string>(CREATE_ROUTES);
const VALID_PRIMITIVE_KINDS = new Set<string>(["enter", "exit", "emphasis", "continuous"]);
const SAFE_NUMBERS = new Set([0, 1]);

function storePath(root: string): string {
  return path.join(root, STORE_FILE);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? [...new Set(value.map((item) => String(item ?? "").trim()).filter(Boolean))]
    : [];
}

function asNumber(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asPrimitiveKind(value: unknown): PrimitiveKindT {
  const raw = String(value ?? "").trim();
  return VALID_PRIMITIVE_KINDS.has(raw) ? raw as PrimitiveKindT : "enter";
}

function asRoute(value: unknown): CreateRoute {
  const raw = String(value ?? "").trim();
  return VALID_ROUTES.has(raw) ? raw as CreateRoute : "interface-reveal";
}

function asTimelineOp(value: unknown): CreateTimelineStep["op"] {
  const raw = String(value ?? "").trim();
  return raw === "to" || raw === "from" || raw === "set" || raw === "count" ? raw : "fromTo";
}

function asVars(value: unknown): Record<string, string | number | boolean> | undefined {
  const raw = asRecord(value);
  const out: Record<string, string | number | boolean> = {};
  for (const [key, item] of Object.entries(raw)) {
    if (typeof item === "string" || typeof item === "number" || typeof item === "boolean") out[key] = item;
  }
  return Object.keys(out).length ? out : undefined;
}

function slug(input: string): string {
  return (
    input
      .trim()
      .replace(/([a-z])([A-Z])/g, "$1-$2")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "motion-draft"
  );
}

function titleCaseSlug(input: string): string {
  return input
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function cleanIdentifier(input: string): string {
  const parts = input
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const camel = parts
    .map((part, index) => {
      const lower = part.charAt(0).toLowerCase() + part.slice(1);
      return index === 0 ? lower : lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join("");
  const out = camel || "token";
  return /^[a-zA-Z_]/.test(out) ? out : `v${out}`;
}

export function bundleNameFromDraft(draft: Pick<ForgeExtensionDraft, "name" | "primitiveKind">): string {
  const parts = slug(draft.name).split("-").filter(Boolean);
  const camel = parts.map((part, index) => index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)).join("");
  return `${draft.primitiveKind}.${camel || "motionDraft"}`;
}

const DEFAULT_EASE_BY_KIND: Record<PrimitiveKindT, string> = {
  enter: "power3.out",
  exit: "power2.in",
  emphasis: "power2.out",
  continuous: "sine.inOut",
};

function nearestDurationToken(seconds: number | null): DurationToken {
  if (seconds === null || !Number.isFinite(seconds)) return "base";
  const frames = seconds * 30;
  let best: DurationToken = "base";
  let bestDelta = Infinity;
  for (const [token, tokenFrames] of Object.entries(DURATION_TOKENS) as Array<[DurationToken, number]>) {
    const delta = Math.abs(tokenFrames - frames);
    if (delta < bestDelta) {
      best = token;
      bestDelta = delta;
    }
  }
  return best;
}

function nearestEasingToken(raw: string | null, kind: PrimitiveKindT): EasingToken {
  if (raw) {
    for (const [token, easing] of Object.entries(EASING_TOKENS) as Array<[EasingToken, (typeof EASING_TOKENS)[EasingToken]]>) {
      const runtime = easing.kind === "bezier" ? easing.runtimeName : easing.value;
      if (raw === runtime || raw === token || (easing.kind === "gsap" && raw === easing.value)) return token;
    }
    if (/none|linear/i.test(raw)) return "linear.mech";
    if (/elastic|back|spring/i.test(raw)) return "enter.settle";
    if (/power[34]|expo|circ/i.test(raw)) return kind === "exit" ? "exit.swift" : "enter.snap";
    if (/power1|sine/i.test(raw)) return kind === "exit" ? "exit.fade" : "enter.glide";
  }
  if (kind === "exit") return "exit.swift";
  if (kind === "continuous") return "linear.mech";
  return "enter.glide";
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

class TimelinePromoter {
  readonly tokens: SeqextBundle["spec"]["tokens"] = {};
  readonly knobs: SeqextBundle["spec"]["knobs"] = [];
  readonly warnings: string[];
  #used = new Set<string>();
  #durationToken: DurationToken = "base";
  #easingToken: EasingToken = "enter.glide";
  #sawDuration = false;
  #sawEase = false;
  #firstEase: string | null = null;
  readonly #primitiveKind: PrimitiveKindT;

  constructor(warnings: string[], primitiveKind: PrimitiveKindT) {
    this.warnings = warnings;
    this.#primitiveKind = primitiveKind;
  }

  get defaults(): SeqextBundle["spec"]["defaults"] {
    return { duration: this.#durationToken, easing: this.#easingToken };
  }

  #unique(base: string): string {
    const clean = cleanIdentifier(base);
    let candidate = clean;
    let n = 2;
    while (this.#used.has(candidate)) candidate = `${clean}${n++}`;
    this.#used.add(candidate);
    return candidate;
  }

  #addNumberKnob(name: string, value: number, description: string): void {
    this.knobs.push({ name, description, kind: "number", default: round(value) });
  }

  #addDurationKnob(): void {
    if (this.knobs.some((knob) => knob.name === "duration")) return;
    this.knobs.push({
      name: "duration",
      description: "Main authored motion duration.",
      kind: "duration",
      default: this.#durationToken,
    });
  }

  duration(value: number | undefined): string {
    if (!this.#sawDuration) {
      this.#sawDuration = true;
      this.#durationToken = nearestDurationToken(value ?? null);
      this.#addDurationKnob();
      return "$durationSec";
    }
    const name = this.#unique("durationSec");
    this.tokens[name] = round(value ?? 0.45);
    this.#addNumberKnob(name, value ?? 0.45, "Timeline secondary duration in seconds.");
    return `$${name}`;
  }

  ease(value: string | undefined): string {
    const raw = value ?? null;
    if (!this.#sawEase) {
      this.#sawEase = true;
      this.#firstEase = raw;
      this.#easingToken = nearestEasingToken(raw, this.#primitiveKind);
      this.knobs.push({
        name: "easing",
        description: raw ? `Main authored ease normalized from '${raw}'.` : "Main authored ease.",
        kind: "easing",
        default: this.#easingToken,
      });
    } else if (raw && raw !== this.#firstEase) {
      this.warnings.push(`Normalized secondary ease '${raw}' to the public easing knob; split the motion if it needs a distinct ease.`);
    }
    return "$ease";
  }

  number(prop: string, value: number, phase: string): number | string {
    if (SAFE_NUMBERS.has(value)) return value;
    const suffix = prop.toLowerCase().includes("percent")
      ? "Percent"
      : prop.toLowerCase().includes("scale")
        ? "Scale"
        : "Px";
    const name = this.#unique(`${prop}${phase}${suffix}`);
    this.tokens[name] = round(value);
    this.#addNumberKnob(name, value, `Timeline ${phase.toLowerCase()} '${prop}' value.`);
    return `$${name}`;
  }

  offset(value: number): string {
    if (value === 0) return "$startSec";
    const name = this.#unique("offsetSec");
    this.tokens[name] = round(value);
    this.#addNumberKnob(name, value, "Timeline offset from the motion start in seconds.");
    return `$startSec + ${name}`;
  }

  /** Promote a counter's target value to a token + number knob. */
  count(value: number): string {
    const name = this.#unique("countTo");
    this.tokens[name] = round(value);
    this.#addNumberKnob(name, value, "Counter target value the number races to.");
    return name;
  }
}

/** Strip a leading `$` so a token reference (`$durationSec`, `$startSec + off`)
 *  can be embedded inside a `custom` template's `${…}` interpolation. */
function exprOf(templateValue: string): string {
  return templateValue.startsWith("$") ? templateValue.slice(1) : templateValue;
}

/** A timeline target reads as container-level (mask/frame/scroller) vs. inner. */
function liftTargetFor(step: CreateTimelineStep): "container" | "inner" {
  const vars = { ...(step.from ?? {}), ...(step.to ?? {}), ...(step.vars ?? {}) };
  if (Object.keys(vars).some((key) => /clip|mask|scrolltop|scrollleft/i.test(key))) return "container";
  if (/container|frame|mask|root|backdrop|overlay|stage|viewport|scroll/i.test(step.target)) return "container";
  return "inner";
}

function usesMaskyProperty(vars: Record<string, string | number | boolean> | undefined): boolean {
  return Object.keys(vars ?? {}).some((key) => /clip|mask|yPercent/i.test(key));
}

function convertTimelineVars(
  vars: Record<string, string | number | boolean> | undefined,
  promoter: TimelinePromoter,
  phase: string,
): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(vars ?? {})) {
    out[key] = typeof value === "number" && Number.isFinite(value) ? promoter.number(key, value, phase) : value;
  }
  return out;
}

function defaultToVars(fromVars: Record<string, string | number | boolean> | undefined): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(fromVars ?? {})) {
    const lower = key.toLowerCase();
    if (lower === "opacity") out[key] = 1;
    else if (lower.includes("scale")) out[key] = 1;
    else if (lower === "filter" && typeof value === "string" && /blur\(/i.test(value)) out[key] = "blur(0px)";
    else out[key] = 0;
  }
  return out;
}

/** The set of animated property keys — a step's "shape", for grouping peers. */
function stepVarSignature(step: CreateTimelineStep): string {
  const keys = Object.keys({ ...(step.from ?? {}), ...(step.to ?? {}), ...(step.vars ?? {}) });
  return [...new Set([step.op, ...keys.map((key) => key.toLowerCase())])].sort().join(",");
}

const PEER_STAGGER_MIN_GAP = 0.03;
const PEER_STAGGER_MAX_GAP = 0.6;
const PEER_STAGGER_GAP_TOLERANCE = 0.7;
const PEER_STAGGER_MIN_RUN = 3;

/**
 * Find the first run of ≥3 same-shape beats on DISTINCT subjects at an even
 * cadence — a peer stagger (six cards cascading), not one subject's storyline.
 * Steps must be pre-sorted by `at`. Returns the inclusive index range or null.
 */
function findPeerStaggerRun(sorted: CreateTimelineStep[]): { start: number; end: number } | null {
  for (let i = 0; i < sorted.length; i++) {
    const signature = stepVarSignature(sorted[i]!);
    const subjects = new Set<string>([`${sorted[i]!.asset}::${sorted[i]!.target}`]);
    let firstGap: number | null = null;
    let j = i;
    while (j + 1 < sorted.length) {
      const gap = (sorted[j + 1]!.at ?? 0) - (sorted[j]!.at ?? 0);
      if (gap < PEER_STAGGER_MIN_GAP || gap > PEER_STAGGER_MAX_GAP) break;
      if (stepVarSignature(sorted[j + 1]!) !== signature) break;
      const subject = `${sorted[j + 1]!.asset}::${sorted[j + 1]!.target}`;
      if (subjects.has(subject)) break; // same element twice → a storyline, not peers
      if (firstGap === null) firstGap = gap;
      else if (Math.abs(gap - firstGap) > firstGap * PEER_STAGGER_GAP_TOLERANCE) break;
      subjects.add(subject);
      j++;
    }
    if (j - i + 1 >= PEER_STAGGER_MIN_RUN) return { start: i, end: j };
  }
  return null;
}

/**
 * A `.seqext` primitive is content-agnostic and animates a SINGLE layer, so a
 * peer-stagger of N subjects cannot be one primitive. Collapse it to the
 * representative per-subject beat (the engine's solver reproduces the stagger
 * across real layers). Returns the reduced steps and a note when it fired.
 */
export function collapsePeerStaggers(timeline: CreateTimelineStep[]): { steps: CreateTimelineStep[]; note: string | null } {
  const sorted = [...timeline].filter((step) => step && typeof step.at === "number").sort((a, b) => a.at - b.at);
  const run = findPeerStaggerRun(sorted);
  if (!run) return { steps: sorted, note: null };
  const count = run.end - run.start + 1;
  const kept = sorted.filter((_, index) => index <= run.start || index > run.end);
  return {
    steps: kept,
    note: `Authored as a ${count}-subject stagger; exported the reusable per-subject primitive. In Sequences the solver re-applies it across layers to reproduce the cascade — the multi-subject version stays in the Forge preview.`,
  };
}

/**
 * Compile structured Create timeline steps directly into Hyperframes
 * StepTemplate data. This is the Phase-6 path: the agent authors a compact
 * timeline, while Forge promotes authored seconds/pixels/eases into bundle
 * tokens without serializing through a raw GSAP source string.
 */
export function timelineToCompiledMotion(draft: Pick<ForgeExtensionDraft, "timeline" | "primitiveKind">): CreateCompiledMotion | undefined {
  const collapsed = collapsePeerStaggers(draft.timeline ?? []);
  const steps = collapsed.steps;
  if (!steps.length) return undefined;

  const warnings: string[] = [];
  if (collapsed.note) warnings.push(collapsed.note);
  const promoter = new TimelinePromoter(warnings, draft.primitiveKind);
  const skeleton: SeqextBundle["spec"]["skeleton"] = [];
  let needsMask = false;

  for (const step of steps) {
    const target = liftTargetFor(step) === "container" ? "$container" : "$inner";
    const atSec = promoter.offset(Math.max(0, Number.isFinite(step.at) ? step.at : 0));

    if (step.op === "set") {
      const vars = step.vars ?? step.to;
      if (!Object.keys(vars ?? {}).length) continue;
      needsMask = needsMask || usesMaskyProperty(vars);
      skeleton.push({
        kind: "set",
        target,
        vars: convertTimelineVars(vars, promoter, "Set"),
        atSec,
      });
      continue;
    }

    if (step.op === "count") {
      const bag = { ...(step.to ?? {}), ...(step.vars ?? {}) };
      const value = typeof bag.value === "number" ? bag.value : Number(bag.value);
      if (!Number.isFinite(value)) continue;
      const prefix = typeof bag.prefix === "string" ? bag.prefix : "";
      const suffix = typeof bag.suffix === "string" ? bag.suffix : "";
      const durExpr = exprOf(promoter.duration(Number.isFinite(step.duration as number) ? Math.max(0, step.duration as number) : 1.2));
      const easeTV = promoter.ease(step.ease || DEFAULT_EASE_BY_KIND[draft.primitiveKind]);
      const countName = promoter.count(value);
      const atExpr = exprOf(atSec);
      // A token-pure counter: the engine interpolates the selector (innerJs),
      // ease (easeJs), the promoted target value, and the timing against its emit
      // env. prefix/suffix are literal author text baked in JSON-safe.
      const code =
        `(function(){var el=document.querySelector(\${innerJs});if(!el)return;` +
        `var o={v:0};var fmt=function(v){return ${JSON.stringify(prefix)}+Math.round(v).toLocaleString("en-US")+${JSON.stringify(suffix)};};` +
        `el.textContent=fmt(0);` +
        `tl.to(o,{v:\${${countName}},duration:\${${durExpr}},ease:\${easeJs},onUpdate:function(){el.textContent=fmt(o.v);}},\${${atExpr}});})();`;
      skeleton.push({ kind: "custom", code, easesUsed: [easeTV] });
      continue;
    }

    if (step.op === "to") {
      const vars = step.vars ?? step.to;
      if (!Object.keys(vars ?? {}).length) continue;
      const durationSec = promoter.duration(Number.isFinite(step.duration as number) ? Math.max(0, step.duration as number) : 0.45);
      const ease = promoter.ease(step.ease || DEFAULT_EASE_BY_KIND[draft.primitiveKind]);
      needsMask = needsMask || usesMaskyProperty(vars);
      skeleton.push({
        kind: "to",
        target,
        vars: convertTimelineVars(vars, promoter, "To"),
        durationSec,
        ease,
        atSec,
      });
      continue;
    }

    if (step.op === "from") {
      const from = step.vars ?? step.from;
      if (!Object.keys(from ?? {}).length) continue;
      const durationSec = promoter.duration(Number.isFinite(step.duration as number) ? Math.max(0, step.duration as number) : 0.45);
      const ease = promoter.ease(step.ease || DEFAULT_EASE_BY_KIND[draft.primitiveKind]);
      needsMask = needsMask || usesMaskyProperty(from);
      skeleton.push({
        kind: "fromTo",
        target,
        from: convertTimelineVars(from, promoter, "From"),
        to: convertTimelineVars(defaultToVars(from), promoter, "To"),
        durationSec,
        ease,
        atSec,
      });
      continue;
    }

    const from = step.from;
    const to = step.to;
    if (!Object.keys(from ?? {}).length && !Object.keys(to ?? {}).length) continue;
    const durationSec = promoter.duration(Number.isFinite(step.duration as number) ? Math.max(0, step.duration as number) : 0.45);
    const ease = promoter.ease(step.ease || DEFAULT_EASE_BY_KIND[draft.primitiveKind]);
    needsMask = needsMask || usesMaskyProperty(from) || usesMaskyProperty(to);
    skeleton.push({
      kind: "fromTo",
      target,
      from: convertTimelineVars(from, promoter, "From"),
      to: convertTimelineVars(to, promoter, "To"),
      durationSec,
      ease,
      atSec,
    });
  }

  if (!skeleton.length) return undefined;
  return {
    primitiveKind: draft.primitiveKind,
    defaults: promoter.defaults,
    tokens: promoter.tokens,
    knobs: promoter.knobs,
    ...(needsMask ? { needsMask: true } : {}),
    skeleton,
    warnings,
  };
}

/** Serialize a vars bag to a GSAP object literal of only literal values. */
function varsLiteral(vars: Record<string, string | number | boolean> | undefined, extra: Record<string, string | number> = {}): string {
  const merged: Record<string, string | number | boolean> = { ...(vars ?? {}), ...extra };
  const parts: string[] = [];
  for (const [key, value] of Object.entries(merged)) {
    if (typeof value === "number" && Number.isFinite(value)) parts.push(`${JSON.stringify(key)}:${value}`);
    else if (typeof value === "boolean") parts.push(`${JSON.stringify(key)}:${value}`);
    else if (typeof value === "string") parts.push(`${JSON.stringify(key)}:${JSON.stringify(value)}`);
  }
  return `{${parts.join(",")}}`;
}

/**
 * Derive a liftable GSAP source deterministically from the structured timeline.
 *
 * This closes the fidelity gap: the agent can return only the structured
 * `timeline` (cheaper, fewer tokens), and export still ships the *actual* motion
 * DNA (durations/eases/transforms over the dominant subject) instead of a generic
 * default skeleton. Part-level targets collapse to the lift's `inner`/`container`
 * sandbox vars — the bundle skeleton is generalized by design (FORGE.md §6.2).
 * Returns `""` when there is no usable timeline so callers can fall back.
 */
export function timelineToLiftSource(draft: Pick<ForgeExtensionDraft, "timeline" | "primitiveKind">): string {
  const steps = [...(draft.timeline ?? [])]
    .filter((step) => step && typeof step.at === "number")
    .sort((a, b) => a.at - b.at);
  if (!steps.length) return "";
  const defaultEase = DEFAULT_EASE_BY_KIND[draft.primitiveKind] ?? "power3.out";
  const lines: string[] = ["const tl = gsap.timeline();"];
  for (const step of steps) {
    // Counters compile through the token-pure custom path, not the GSAP lift.
    if (step.op === "count") continue;
    const target = liftTargetFor(step);
    const at = Number.isFinite(step.at) ? Math.max(0, step.at) : 0;
    const duration = Number.isFinite(step.duration as number) ? Math.max(0, step.duration as number) : 0.45;
    const ease = step.ease || defaultEase;
    const meta = { duration, ease };
    if (step.op === "set") {
      lines.push(`tl.set(${target}, ${varsLiteral(step.vars ?? step.to)}, ${at});`);
    } else if (step.op === "to") {
      lines.push(`tl.to(${target}, ${varsLiteral(step.vars ?? step.to, meta)}, ${at});`);
    } else if (step.op === "from") {
      lines.push(`tl.from(${target}, ${varsLiteral(step.vars ?? step.from, meta)}, ${at});`);
    } else {
      lines.push(`tl.fromTo(${target}, ${varsLiteral(step.from)}, ${varsLiteral(step.to, meta)}, ${at});`);
    }
  }
  return lines.join("\n");
}

function defaultSummary(name: string): string {
  return `${name} motion snippet authored in Forge for Sequences.`;
}

function normalizeTaxonomy(value: unknown): CreateTaxonomy {
  const raw = asRecord(value);
  const taxonomy: CreateTaxonomy = {};
  if (typeof raw.family === "string") taxonomy.family = raw.family;
  if (typeof raw.subject === "string") taxonomy.subject = raw.subject;
  if (typeof raw.action === "string") taxonomy.action = raw.action;
  if (Array.isArray(raw.technique)) taxonomy.technique = asStringArray(raw.technique);
  if (raw.energy === "calm" || raw.energy === "punchy") taxonomy.energy = raw.energy;
  if (raw.style === "organic" || raw.style === "mechanical") taxonomy.style = raw.style;
  if (typeof raw.register === "string") taxonomy.register = raw.register;
  if (Array.isArray(raw.context)) taxonomy.context = asStringArray(raw.context);
  return taxonomy;
}

function normalizeTimeline(value: unknown): CreateTimelineStep[] {
  if (!Array.isArray(value)) return [];
  const out: CreateTimelineStep[] = [];
  for (const item of value) {
    const raw = asRecord(item);
    const asset = asString(raw.asset);
    const target = asString(raw.target);
    if (!asset || !target) continue;
    const step: CreateTimelineStep = {
      asset,
      target,
      op: asTimelineOp(raw.op),
      at: Math.max(0, asNumber(raw.at, 0)),
    };
    const from = asVars(raw.from);
    const to = asVars(raw.to);
    const vars = asVars(raw.vars);
    if (from) step.from = from;
    if (to) step.to = to;
    if (vars) step.vars = vars;
    const duration = asNumber(raw.duration ?? raw.durationSec, NaN);
    if (Number.isFinite(duration)) step.duration = Math.max(0, duration);
    if (typeof raw.ease === "string") step.ease = raw.ease;
    out.push(step);
  }
  return out;
}

function normalizeTriggers(value: unknown): CreateActionTrigger[] {
  if (!Array.isArray(value)) return [];
  const out: CreateActionTrigger[] = [];
  for (const item of value) {
    const raw = asRecord(item);
    const asset = asString(raw.asset);
    const trigger = asString(raw.trigger);
    if (!asset || !trigger) continue;
    out.push({ asset, trigger, at: Math.max(0, asNumber(raw.at, 0)) });
  }
  return out;
}

function normalizeKnobs(value: unknown): CreateKnobAutomation[] {
  if (!Array.isArray(value)) return [];
  const out: CreateKnobAutomation[] = [];
  for (const item of value) {
    const raw = asRecord(item);
    const asset = asString(raw.asset);
    const name = asString(raw.name);
    const value = raw.value;
    if (!asset || !name) continue;
    if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") continue;
    out.push({ asset, name, value, at: Math.max(0, asNumber(raw.at, 0)) });
  }
  return out;
}

export function normalizeStageRequest(value: unknown): CreateStageRequest | undefined {
  const raw = asRecord(value);
  const brief = asString(raw.brief);
  if (!brief) return undefined;
  return {
    brief,
    ...(typeof raw.aspect === "string" ? { aspect: raw.aspect } : {}),
    ...(Array.isArray(raw.references) ? { references: asStringArray(raw.references) } : {}),
    ...(typeof raw.styleHints === "string" ? { styleHints: raw.styleHints } : {}),
    ...(Array.isArray(raw.requiredParts) ? { requiredParts: asStringArray(raw.requiredParts) } : {}),
    ...(Array.isArray(raw.requiredActions) ? { requiredActions: asStringArray(raw.requiredActions) } : {}),
    ...(Array.isArray(raw.requiredKnobs) ? { requiredKnobs: asStringArray(raw.requiredKnobs) } : {}),
    ...(typeof raw.reason === "string" ? { reason: raw.reason } : {}),
  };
}

function normalizeValidation(value: unknown): CreateValidationIssue[] {
  if (!Array.isArray(value)) return [];
  const out: CreateValidationIssue[] = [];
  for (const item of value) {
    const raw = asRecord(item);
    const level = raw.level === "error" || raw.level === "warning" || raw.level === "info" ? raw.level : "info";
    const code = asString(raw.code, "note");
    const message = asString(raw.message);
    if (message) out.push({ level, code, message });
  }
  return out;
}

function normalizeCompiledMotion(value: unknown, primitiveKind: PrimitiveKindT): CreateCompiledMotion | undefined {
  const raw = asRecord(value);
  if (!Array.isArray(raw.skeleton) || raw.skeleton.length === 0) return undefined;
  const defaults = asRecord(raw.defaults);
  return {
    primitiveKind,
    defaults: {
      duration: typeof defaults.duration === "string" ? defaults.duration as DurationToken : "base",
      easing: typeof defaults.easing === "string" ? defaults.easing as EasingToken : "enter.glide",
      ...(typeof defaults.distance === "string" ? { distance: defaults.distance as CreateCompiledMotion["defaults"]["distance"] } : {}),
      ...(typeof defaults.scale === "string" ? { scale: defaults.scale as CreateCompiledMotion["defaults"]["scale"] } : {}),
    },
    tokens: asRecord(raw.tokens) as SeqextBundle["spec"]["tokens"],
    knobs: Array.isArray(raw.knobs) ? raw.knobs as SeqextBundle["spec"]["knobs"] : [],
    skeleton: raw.skeleton as SeqextBundle["spec"]["skeleton"],
    ...(raw.needsMask === true ? { needsMask: true } : {}),
    warnings: asStringArray(raw.warnings),
  };
}

export function normalizeCreateDraft(input: unknown, options: { fallbackAspect?: string; now?: string } = {}): ForgeExtensionDraft {
  const raw = asRecord(input);
  const now = options.now ?? new Date().toISOString();
  const name = asString(raw.name, "Untitled Motion Draft");
  const primitiveKind = asPrimitiveKind(raw.primitiveKind);
  const timeline = normalizeTimeline(raw.timeline);
  const components = asStringArray(raw.components ?? raw.assets);
  const compiledMotion =
    timelineToCompiledMotion({ primitiveKind, timeline }) ??
    normalizeCompiledMotion(raw.compiledMotion, primitiveKind);
  // The agent's explicit lift wins; otherwise derive the export motion DNA from
  // the structured timeline so every stored draft is faithful and inspectable.
  const liftSource = asString(raw.liftSource) || timelineToLiftSource({ primitiveKind, timeline });
  const seed = {
    name,
    primitiveKind,
    aspect: asString(raw.aspect, options.fallbackAspect ?? "16:9"),
    components,
    timeline,
    liftSource,
  };
  const id = asString(raw.id) || `draft-${contentHash(seed).slice(0, 12)}`;
  const summary = asString(raw.summary, defaultSummary(name));
  return {
    id,
    name,
    summary: summary.length >= 20 ? summary : defaultSummary(name),
    route: asRoute(raw.route),
    primitiveKind,
    aspect: asString(raw.aspect, options.fallbackAspect ?? "16:9"),
    aspectLocked: true,
    durationSec: Math.max(0.5, asNumber(raw.durationSec ?? raw.duration, 5)),
    components,
    media: asStringArray(raw.media),
    taxonomy: normalizeTaxonomy(raw.taxonomy),
    timeline,
    actions: normalizeTriggers(raw.actions),
    knobAutomation: normalizeKnobs(raw.knobs ?? raw.knobAutomation),
    ...(compiledMotion ? { compiledMotion } : {}),
    liftSource,
    validation: normalizeValidation(raw.validation),
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : now,
    updatedAt: now,
  };
}

export function readCreateDraftStore(root: string): CreateDraftStore {
  const file = storePath(root);
  if (!fs.existsSync(file)) return { currentId: null, drafts: [] };
  const raw = JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
  if (Array.isArray(raw)) {
    const drafts = raw.map((item) => normalizeCreateDraft(item));
    return { currentId: drafts[0]?.id ?? null, drafts };
  }
  const record = asRecord(raw);
  const drafts = Array.isArray(record.drafts) ? record.drafts.map((item) => normalizeCreateDraft(item)) : [];
  const currentId = typeof record.currentId === "string" && drafts.some((draft) => draft.id === record.currentId)
    ? record.currentId
    : drafts[0]?.id ?? null;
  return { currentId, drafts };
}

export function writeCreateDraftStore(root: string, store: CreateDraftStore): void {
  fs.mkdirSync(root, { recursive: true });
  const currentId = store.currentId && store.drafts.some((draft) => draft.id === store.currentId)
    ? store.currentId
    : store.drafts[0]?.id ?? null;
  const drafts = [...store.drafts].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  fs.writeFileSync(storePath(root), `${JSON.stringify({ currentId, drafts }, null, 2)}\n`);
  mirrorCreateDrafts(root, { currentId, drafts });
}

function safeWriteJson(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function mirrorCreateDrafts(root: string, store: CreateDraftStore): void {
  const dir = path.join(root, AUDIT_DIR);
  fs.mkdirSync(dir, { recursive: true });
  safeWriteJson(path.join(dir, "index.json"), {
    currentId: store.currentId,
    drafts: store.drafts.map((draft) => ({
      id: draft.id,
      name: draft.name,
      route: draft.route,
      primitiveKind: draft.primitiveKind,
      aspect: draft.aspect,
      updatedAt: draft.updatedAt,
      folder: draft.id,
    })),
  });
  const live = new Set<string>();
  for (const draft of store.drafts) {
    live.add(draft.id);
    const draftDir = path.join(dir, draft.id);
    safeWriteJson(path.join(draftDir, "draft.json"), draft);
    if (draft.compiledMotion) {
      safeWriteJson(path.join(draftDir, "compiled-motion.json"), draft.compiledMotion);
    }
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && !live.has(entry.name)) fs.rmSync(path.join(dir, entry.name), { recursive: true, force: true });
  }
}

export function writeCreateDraftBundleAudit(root: string, draftId: string, bundle: SeqextBundle): void {
  const bundleDir = path.join(root, AUDIT_DIR, draftId, "bundle");
  safeWriteJson(path.join(bundleDir, "manifest.json"), bundle.manifest);
  safeWriteJson(path.join(bundleDir, "spec.json"), bundle.spec);
}

export function listCreateDrafts(root: string): ForgeExtensionDraft[] {
  return readCreateDraftStore(root).drafts;
}

export function currentCreateDraft(root: string): ForgeExtensionDraft | null {
  const store = readCreateDraftStore(root);
  return store.drafts.find((draft) => draft.id === store.currentId) ?? store.drafts[0] ?? null;
}

export function upsertCreateDraft(root: string, input: unknown): { draft: ForgeExtensionDraft; store: CreateDraftStore } {
  const store = readCreateDraftStore(root);
  const incoming = asRecord(input);
  const existing = typeof incoming.id === "string"
    ? store.drafts.find((draft) => draft.id === incoming.id)
    : undefined;
  const merged = {
    ...(existing ?? {}),
    ...incoming,
    createdAt: existing?.createdAt ?? incoming.createdAt,
  };
  if (Object.prototype.hasOwnProperty.call(incoming, "timeline")) {
    delete (merged as Record<string, unknown>).compiledMotion;
    if (!Object.prototype.hasOwnProperty.call(incoming, "liftSource")) {
      delete (merged as Record<string, unknown>).liftSource;
    }
  }
  const draft = normalizeCreateDraft(
    merged,
  );
  const index = store.drafts.findIndex((item) => item.id === draft.id);
  if (index >= 0) store.drafts[index] = draft;
  else store.drafts.push(draft);
  store.currentId = draft.id;
  writeCreateDraftStore(root, store);
  return { draft, store: readCreateDraftStore(root) };
}

export function setCurrentCreateDraft(root: string, id: string): CreateDraftStore {
  const store = readCreateDraftStore(root);
  if (store.drafts.some((draft) => draft.id === id)) store.currentId = id;
  writeCreateDraftStore(root, store);
  return readCreateDraftStore(root);
}

export function deleteCreateDraft(root: string, id: string): CreateDraftStore {
  const store = readCreateDraftStore(root);
  const drafts = store.drafts.filter((draft) => draft.id !== id);
  const currentId = store.currentId === id ? drafts[0]?.id ?? null : store.currentId;
  const next = { currentId, drafts };
  writeCreateDraftStore(root, next);
  return readCreateDraftStore(root);
}
