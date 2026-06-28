/**
 * The Stage component contract (FORGE.md "Stage" + AI architecture).
 *
 * A Stage asset is ordinary HTML/CSS/JS — but the agent annotates it with three
 * statically-parseable declarations so the downstream HyperFrames *Motion AI*
 * (and the Inspector) can understand it WITHOUT executing it:
 *
 *   1. Parts    — `data-forge-component="hero-title"` (also `data-forge-part`):
 *                 addressable, animatable elements (entrance/emphasis/exit
 *                 targets the Motion AI may choreograph).
 *   2. Knobs    — `@forge-var accent type=color default=#5e6ad2 label="Accent"`:
 *                 the values the author chose to expose in Tweaks.
 *   3. Actions  — `@forge-action open-menu label="Open menu" affects=drawer`
 *                 paired with `data-forge-action="open-menu"`: interactions the
 *                 Motion AI can *trigger* (e.g. press a button → a menu opens).
 *
 * This module is the single source of truth for that grammar. Parsing is pure
 * and deterministic — the contract is a property of the source text, never of a
 * running page — which keeps it cheap, golden-testable, and safe (no eval).
 */

export type KnobType = "text" | "number" | "range" | "color" | "boolean" | "select" | "choice" | "image";

export const KNOB_TYPES: readonly KnobType[] = [
  "text",
  "number",
  "range",
  "color",
  "boolean",
  "select",
  "choice",
  "image",
];

export interface KnobSpec {
  /** Used as the CSS custom property `--<name>` and `forge.vars[name]`. */
  name: string;
  type: KnobType;
  default: string | number | boolean;
  label: string;
  /** `select` / `choice` only — the allowed values. */
  options?: string[];
  /** `number` / `range` only. */
  min?: number;
  max?: number;
  step?: number;
  /** Always true today (only exposed knobs are declared); kept for symmetry. */
  exposed: boolean;
}

export interface ActionSpec {
  /** Invoked via `forge.trigger("<name>")` and `data-forge-action="<name>"`. */
  name: string;
  label: string;
  /** The named part this action animates/reveals (the causal link). */
  affects?: string;
  description?: string;
}

export type StageLayerRole = "backdrop" | "subject" | "overlay";

export interface StageLayerSpec {
  part: string;
  role: StageLayerRole;
}

export interface StageContract {
  parts: string[];
  knobs: KnobSpec[];
  actions: ActionSpec[];
  /** Explicit motion-layer roles; inferred from part names when omitted. */
  layers: StageLayerSpec[];
  /** Independently choreographable top-level subjects inside one Stage asset. */
  objects: string[];
}

/* ─────────────────────── small grammar helpers ─────────────────────── */

/** Pull `key=value` / `key="quoted value"` attributes out of a directive tail. */
function attrs(tail: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([a-zA-Z][\w-]*)\s*=\s*("[^"]*"|'[^']*'|[^\s*]+)/g;
  for (const m of tail.matchAll(re)) {
    out[m[1]!.toLowerCase()] = (m[2] ?? "").replace(/^["']|["']$/g, "").trim();
  }
  return out;
}

function num(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function options(raw: string | undefined): string[] | undefined {
  if (!raw) return undefined;
  const list = raw
    .split(/[,|]/)
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length ? list : undefined;
}

function coerceDefault(raw: string, type: KnobType): string | number | boolean {
  if (type === "number" || type === "range") {
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  }
  if (type === "boolean") return raw === "true" || raw === "1" || raw === "on";
  return raw;
}

function asKnobType(raw: string | undefined): KnobType {
  const t = (raw ?? "").toLowerCase();
  if ((KNOB_TYPES as readonly string[]).includes(t)) return t as KnobType;
  if (t === "string") return "text";
  if (t === "bool" || t === "toggle" || t === "checkbox") return "boolean";
  if (t === "dropdown" || t === "enum") return "select";
  if (t === "segmented" || t === "buttons") return "choice";
  if (t === "slider") return "range";
  if (t === "media" || t === "asset" || t === "photo" || t === "picture") return "image";
  return "text";
}

/* ─────────────────────── parsers ─────────────────────── */

/** Named, addressable parts. Accepts `data-forge-component` and `data-forge-part`. */
export function parseParts(html: string): string[] {
  const names = new Set<string>();
  for (const m of String(html).matchAll(/\bdata-forge-(?:component|part)\s*=\s*["']([^"']+)["']/gi)) {
    const clean = m[1]?.trim();
    if (clean) names.add(clean);
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

export function parseObjects(html: string): string[] {
  const names = new Set<string>();
  for (const match of String(html).matchAll(/\bdata-forge-object\s*=\s*["']([^"']+)["']/gi)) {
    const name = match[1]?.trim();
    if (name) names.add(name);
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

export function parseLayers(html: string): StageLayerSpec[] {
  const layers = new Map<string, StageLayerRole>();
  for (const match of String(html).matchAll(/<[\w:-]+\b[^>]*>/g)) {
    const tag = match[0];
    const part = /\bdata-forge-(?:component|part)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]?.trim();
    const rawRole = /\bdata-forge-layer\s*=\s*["'](backdrop|subject|overlay)["']/i.exec(tag)?.[1]?.toLowerCase();
    if (part && rawRole) layers.set(part, rawRole as StageLayerRole);
  }
  return [...layers].map(([part, role]) => ({ part, role })).sort((a, b) => a.part.localeCompare(b.part));
}

/** Exposed Tweak knobs, declared with `@forge-var` comments anywhere in source. */
export function parseKnobs(source: string): KnobSpec[] {
  const out: KnobSpec[] = [];
  const seen = new Set<string>();
  // Capture the directive name + the rest of the line as an attribute tail.
  const re = /@forge-var\s+([a-zA-Z][\w-]*)\s+([^\n\r*]+)/gi;
  for (const m of String(source).matchAll(re)) {
    const name = m[1]!;
    if (seen.has(name)) continue;
    const a = attrs(m[2] ?? "");
    const type = asKnobType(a.type);
    const rawDefault = a.default ?? (type === "boolean" ? "false" : type === "number" || type === "range" ? "0" : "");
    seen.add(name);
    const knob: KnobSpec = {
      name,
      type,
      default: coerceDefault(rawDefault, type),
      label: a.label || name,
      exposed: true,
    };
    const opts = options(a.options);
    if (opts) knob.options = opts;
    if (num(a.min) !== undefined) knob.min = num(a.min);
    if (num(a.max) !== undefined) knob.max = num(a.max);
    if (num(a.step) !== undefined) knob.step = num(a.step);
    // A select/choice with no options and a comma-bearing default degrades gracefully.
    if ((type === "select" || type === "choice") && !knob.options && typeof knob.default === "string") {
      knob.options = options(knob.default);
      if (knob.options) knob.default = knob.options[0]!;
    }
    out.push(knob);
  }
  return out;
}

/**
 * Actions = the union of `@forge-action` declarations (rich: label/affects/desc)
 * and bare `data-forge-action="name"` attributes (auto-discovered so an author
 * who only wires the attribute still ships a triggerable interaction).
 */
export function parseActions(html: string, css = "", js = ""): ActionSpec[] {
  const byName = new Map<string, ActionSpec>();
  const declaredRe = /@forge-action\s+([a-zA-Z][\w-]*)\s*([^\n\r*]*)/gi;
  for (const m of `${html}\n${css}\n${js}`.matchAll(declaredRe)) {
    const name = m[1]!;
    const a = attrs(m[2] ?? "");
    const spec: ActionSpec = { name, label: a.label || titleCase(name) };
    if (a.affects) spec.affects = a.affects;
    if (a.desc || a.description) spec.description = a.desc ?? a.description;
    byName.set(name, spec);
  }
  for (const m of String(html).matchAll(/\bdata-forge-action\s*=\s*["']([^"']+)["']/gi)) {
    const name = m[1]?.trim();
    if (name && !byName.has(name)) byName.set(name, { name, label: titleCase(name) });
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function titleCase(slug: string): string {
  return slug
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

/** Extract the full contract from a Stage asset's source. */
export function extractContract(input: { html?: string; css?: string; js?: string; react?: string }): StageContract {
  const html = input.html ?? "";
  const css = input.css ?? "";
  const js = input.js ?? "";
  const react = input.react ?? "";
  const markup = `${html}\n${react}`;
  return {
    parts: parseParts(markup),
    knobs: parseKnobs(`${markup}\n${css}\n${js}`),
    actions: parseActions(markup, css, js),
    layers: parseLayers(markup),
    objects: parseObjects(markup),
  };
}

/** Default values for every knob, keyed by name (drives the live preview). */
export function knobDefaults(knobs: KnobSpec[]): Record<string, string | number | boolean> {
  return Object.fromEntries(knobs.map((k) => [k.name, k.default]));
}

/** Part names that read as the frame/backdrop, not a movable subject. */
const BACKDROP_PART =
  /^(root|container|stage|viewport|screen|frame|canvas|page|app|background|backdrop|wrapper|shell|surface|scene)$/i;

export interface ForegroundAnalysis {
  /** Parts that are real, movable subjects (a card, panel, table, button…). */
  foregroundParts: string[];
  /** Parts that read as frame/backdrop and should usually stay static. */
  backdropParts: string[];
  /** True when there is at least one subject distinct from the backdrop. */
  separated: boolean;
}

/**
 * Decide, from part names alone, whether a component separates a movable subject
 * from its backdrop. When it does not (only `root`/`background`-style parts, or
 * no parts at all), Create has nothing safe to move in 3D space — animating the
 * only part drags the backdrop with it (the classic "card parallax tilts the
 * whole screen" bug). Deterministic and source-derived, like the rest of the
 * contract, so both Stage (at author time) and Create (at choreograph time) can
 * read it without running the page.
 */
export function foregroundAnalysis(parts: string[], layers: StageLayerSpec[] = []): ForegroundAnalysis {
  const explicit = new Map(layers.map((layer) => [layer.part, layer.role]));
  const foregroundParts = parts.filter((part) => {
    const role = explicit.get(part);
    return role ? role !== "backdrop" : !BACKDROP_PART.test(part);
  });
  const backdropParts = parts.filter((part) => {
    const role = explicit.get(part);
    return role ? role === "backdrop" : BACKDROP_PART.test(part);
  });
  return { foregroundParts, backdropParts, separated: foregroundParts.length > 0 };
}
