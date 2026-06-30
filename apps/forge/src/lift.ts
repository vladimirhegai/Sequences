/**
 * GSAP -> StepTemplate lift (FORGE.md section 6.2).
 *
 * The sandbox is allowed to contain raw authored numbers; the bundle is not.
 * This module parses a deliberately small, common GSAP timeline subset and
 * promotes non-trivial constants into extension tokens so export can ship a
 * token-pure StepTemplate skeleton. No authored code is executed.
 */
import * as ts from "typescript";
import {
  DURATION_TOKENS,
  EASING_TOKENS,
  validateBundle,
  type DurationToken,
  type EasingToken,
  type PrimitiveKindT,
  type SeqextBundle,
} from "@sequences/core";

type Template = SeqextBundle["spec"]["skeleton"][number];
type TemplateVars = Extract<Template, { kind: "fromTo" }>["from"];
type TemplateValue = TemplateVars[string];

export interface LiftOptions {
  id: string;
  summary: string;
  primitiveKind?: PrimitiveKindT;
  version?: string;
  tags?: SeqextBundle["manifest"]["tags"];
  relationships?: SeqextBundle["spec"]["relationships"];
  guardrails?: string[];
}

export interface LiftedMotion {
  primitiveKind: PrimitiveKindT;
  defaults: SeqextBundle["spec"]["defaults"];
  tokens: SeqextBundle["spec"]["tokens"];
  knobs: SeqextBundle["spec"]["knobs"];
  skeleton: SeqextBundle["spec"]["skeleton"];
  needsMask?: boolean;
  warnings: string[];
}

const TIMELINE_METHODS = new Set(["fromTo", "to", "from", "set"]);
const MOTION_META_KEYS = new Set(["duration", "ease"]);
const SAFE_LITERALS = new Set([0, 1]);

function primitiveKindFromId(id: string, fallback: PrimitiveKindT = "enter"): PrimitiveKindT {
  const prefix = id.split(".")[0];
  return prefix === "enter" || prefix === "exit" || prefix === "emphasis" || prefix === "continuous"
    ? prefix
    : fallback;
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

function nodeText(node: ts.Node, source: ts.SourceFile): string {
  return node.getText(source).replace(/\s+/g, " ");
}

function propertyName(name: ts.PropertyName): string | null {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text;
  return null;
}

function literalValue(expr: ts.Expression): TemplateValue | undefined {
  if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) return expr.text;
  if (ts.isNumericLiteral(expr)) return Number(expr.text);
  if (expr.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (expr.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (
    ts.isPrefixUnaryExpression(expr) &&
    expr.operator === ts.SyntaxKind.MinusToken &&
    ts.isNumericLiteral(expr.operand)
  ) {
    return -Number(expr.operand.text);
  }
  return undefined;
}

function objectLiteral(expr: ts.Expression, source: ts.SourceFile, warnings: string[]): Record<string, TemplateValue> | null {
  if (!ts.isObjectLiteralExpression(expr)) {
    warnings.push(`Skipped non-object GSAP vars: ${nodeText(expr, source)}`);
    return null;
  }

  const out: Record<string, TemplateValue> = {};
  for (const prop of expr.properties) {
    if (!ts.isPropertyAssignment(prop)) {
      warnings.push(`Skipped unsupported object property: ${nodeText(prop, source)}`);
      continue;
    }
    const key = propertyName(prop.name);
    if (!key) {
      warnings.push(`Skipped computed object property: ${nodeText(prop.name, source)}`);
      continue;
    }
    const value = literalValue(prop.initializer);
    if (value === undefined) {
      warnings.push(`Skipped non-literal value for '${key}': ${nodeText(prop.initializer, source)}`);
      continue;
    }
    out[key] = value;
  }
  return out;
}

function targetValue(expr: ts.Expression, source: ts.SourceFile, warnings: string[]): string {
  if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) {
    if (expr.text === "$inner" || expr.text === "$container") return expr.text;
    if (/container|wrap|outer/i.test(expr.text)) return "$container";
    if (/inner|card|layer|target|el|node/i.test(expr.text)) return "$inner";
    warnings.push(`Mapped selector '${expr.text}' to $inner; use "$container" for container-level transforms.`);
    return "$inner";
  }
  if (ts.isIdentifier(expr)) {
    if (/container|wrap|outer/i.test(expr.text)) return "$container";
    return "$inner";
  }
  warnings.push(`Mapped unsupported target '${nodeText(expr, source)}' to $inner.`);
  return "$inner";
}

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

class TokenPromoter {
  readonly tokens: Record<string, number | string> = {};
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
    this.knobs.push({ name, description, kind: "number", default: value });
  }

  duration(value: TemplateValue | undefined): TemplateValue {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      this.#durationToken = this.#durationToken ?? "base";
      this.#addDurationKnob();
      return "$durationSec";
    }
    if (!this.#sawDuration) {
      this.#sawDuration = true;
      this.#durationToken = nearestDurationToken(value);
      this.#addDurationKnob();
      return "$durationSec";
    }
    const name = this.#unique("durationSec");
    this.tokens[name] = round(value);
    this.#addNumberKnob(name, value, "Lifted secondary duration in seconds.");
    return `$${name}`;
  }

  #addDurationKnob(): void {
    if (this.knobs.some((k) => k.name === "duration")) return;
    this.knobs.push({
      name: "duration",
      description: "Main authored motion duration.",
      kind: "duration",
      default: this.#durationToken,
    });
  }

  ease(value: TemplateValue | undefined): TemplateValue {
    const raw = typeof value === "string" ? value : null;
    if (!this.#sawEase) {
      this.#sawEase = true;
      this.#firstEase = raw;
      this.#easingToken = nearestEasingToken(raw, this.#primitiveKind);
      this.knobs.push({
        name: "easing",
        description: raw
          ? `Main authored ease, normalized from '${raw}' to a runtime-safe token.`
          : "Main authored ease.",
        kind: "easing",
        default: this.#easingToken,
      });
    } else if (raw && raw !== this.#firstEase) {
      this.warnings.push(
        `Normalized secondary ease '${raw}' to the public easing knob; split the motion if it needs a distinct ease.`,
      );
    }
    return "$ease";
  }

  number(prop: string, value: number, phase: string): TemplateValue {
    if (SAFE_LITERALS.has(value)) return value;
    const suffix = prop.toLowerCase().includes("percent")
      ? "Percent"
      : prop.toLowerCase().includes("scale")
        ? "Scale"
        : "Px";
    const name = this.#unique(`${prop}${phase}${suffix}`);
    this.tokens[name] = round(value);
    this.#addNumberKnob(name, value, `Lifted ${phase.toLowerCase()} '${prop}' value.`);
    return `$${name}`;
  }

  offset(value: number, label = "offsetSec"): TemplateValue {
    if (value === 0) return "$startSec";
    const name = this.#unique(label);
    this.tokens[name] = round(value);
    this.#addNumberKnob(name, value, "Timeline offset from the motion start in seconds.");
    return `$startSec + ${name}`;
  }
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function splitMotionMeta(vars: Record<string, TemplateValue>): {
  vars: Record<string, TemplateValue>;
  duration?: TemplateValue;
  ease?: TemplateValue;
} {
  const rest: Record<string, TemplateValue> = {};
  let duration: TemplateValue | undefined;
  let ease: TemplateValue | undefined;
  for (const [key, value] of Object.entries(vars)) {
    if (key === "duration") duration = value;
    else if (key === "ease") ease = value;
    else rest[key] = value;
  }
  return { vars: rest, duration, ease };
}

function convertVars(
  vars: Record<string, TemplateValue>,
  promoter: TokenPromoter,
  phase: string,
): TemplateVars {
  const out: TemplateVars = {};
  for (const [key, value] of Object.entries(vars)) {
    if (typeof value === "number") out[key] = promoter.number(key, value, phase);
    else out[key] = value;
  }
  return out;
}

function defaultToVars(fromVars: Record<string, TemplateValue>): Record<string, TemplateValue> {
  const out: Record<string, TemplateValue> = {};
  for (const [key, value] of Object.entries(fromVars)) {
    const lower = key.toLowerCase();
    if (lower === "opacity") out[key] = 1;
    else if (lower.includes("scale")) out[key] = 1;
    else if (lower === "filter" && typeof value === "string" && /blur\(/i.test(value)) out[key] = "blur(0px)";
    else out[key] = 0;
  }
  return out;
}

function atValue(arg: ts.Expression | undefined, source: ts.SourceFile, promoter: TokenPromoter): TemplateValue {
  if (!arg) return "$startSec";
  const literal = literalValue(arg);
  if (typeof literal === "number") return promoter.offset(literal);
  if (typeof literal === "string") {
    const relative = /^([+-])=(\d+(?:\.\d+)?)$/.exec(literal.trim());
    if (relative) {
      const sign = relative[1] === "-" ? -1 : 1;
      return promoter.offset(sign * Number(relative[2]), "relativeOffsetSec");
    }
    if (literal === "<" || literal === ">") {
      promoter.warnings.push(`Position '${literal}' was normalized to the motion start.`);
      return "$startSec";
    }
  }
  promoter.warnings.push(`Unsupported timeline position '${nodeText(arg, source)}' was normalized to startSec.`);
  return "$startSec";
}

function usesMaskyProperty(vars: Record<string, TemplateValue>): boolean {
  return Object.keys(vars).some((key) => /clip|mask|yPercent/i.test(key));
}

function gsapCalls(sourceFile: ts.SourceFile): ts.CallExpression[] {
  const out: ts.CallExpression[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      if (TIMELINE_METHODS.has(node.expression.name.text)) out.push(node);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return out;
}

function callMethod(call: ts.CallExpression): string {
  return ts.isPropertyAccessExpression(call.expression) ? call.expression.name.text : "";
}

/**
 * Lift authored GSAP calls into a StepTemplate skeleton. Supported calls:
 * tl.fromTo(target, fromVars, toVars, position?)
 * tl.to(target, vars, position?)
 * tl.from(target, vars, position?)
 * tl.set(target, vars, position?)
 */
export function liftGsapSource(source: string, options: Partial<LiftOptions> = {}): LiftedMotion {
  const primitiveKind = options.primitiveKind ?? primitiveKindFromId(options.id ?? "enter.lifted");
  const warnings: string[] = [];
  const promoter = new TokenPromoter(warnings, primitiveKind);
  const sourceFile = ts.createSourceFile("forge-authored-gsap.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const skeleton: SeqextBundle["spec"]["skeleton"] = [];
  let needsMask = false;

  for (const call of gsapCalls(sourceFile)) {
    const method = callMethod(call);
    const args = call.arguments;
    if (method === "fromTo") {
      if (args.length < 3) {
        warnings.push(`Skipped incomplete fromTo call: ${nodeText(call, sourceFile)}`);
        continue;
      }
      const fromRaw = objectLiteral(args[1]!, sourceFile, warnings);
      const toRaw = objectLiteral(args[2]!, sourceFile, warnings);
      if (!fromRaw || !toRaw) continue;
      const toSplit = splitMotionMeta(toRaw);
      needsMask = needsMask || usesMaskyProperty(fromRaw) || usesMaskyProperty(toSplit.vars);
      skeleton.push({
        kind: "fromTo",
        target: targetValue(args[0]!, sourceFile, warnings),
        from: convertVars(fromRaw, promoter, "From"),
        to: convertVars(toSplit.vars, promoter, "To"),
        durationSec: promoter.duration(toSplit.duration),
        ease: promoter.ease(toSplit.ease),
        atSec: atValue(args[3], sourceFile, promoter),
      });
      continue;
    }

    if (method === "to" || method === "from") {
      if (args.length < 2) {
        warnings.push(`Skipped incomplete ${method} call: ${nodeText(call, sourceFile)}`);
        continue;
      }
      const raw = objectLiteral(args[1]!, sourceFile, warnings);
      if (!raw) continue;
      const split = splitMotionMeta(raw);
      needsMask = needsMask || usesMaskyProperty(split.vars);
      if (method === "to") {
        skeleton.push({
          kind: "to",
          target: targetValue(args[0]!, sourceFile, warnings),
          vars: convertVars(split.vars, promoter, "To"),
          durationSec: promoter.duration(split.duration),
          ease: promoter.ease(split.ease),
          atSec: atValue(args[2], sourceFile, promoter),
        });
      } else {
        skeleton.push({
          kind: "fromTo",
          target: targetValue(args[0]!, sourceFile, warnings),
          from: convertVars(split.vars, promoter, "From"),
          to: convertVars(defaultToVars(split.vars), promoter, "To"),
          durationSec: promoter.duration(split.duration),
          ease: promoter.ease(split.ease),
          atSec: atValue(args[2], sourceFile, promoter),
        });
      }
      continue;
    }

    if (method === "set") {
      if (args.length < 2) {
        warnings.push(`Skipped incomplete set call: ${nodeText(call, sourceFile)}`);
        continue;
      }
      const raw = objectLiteral(args[1]!, sourceFile, warnings);
      if (!raw) continue;
      needsMask = needsMask || usesMaskyProperty(raw);
      skeleton.push({
        kind: "set",
        target: targetValue(args[0]!, sourceFile, warnings),
        vars: convertVars(raw, promoter, "Set"),
        atSec: atValue(args[2], sourceFile, promoter),
      });
    }
  }

  if (skeleton.length === 0) {
    throw new Error("lift found no supported GSAP timeline calls (expected tl.fromTo/to/from/set)");
  }

  return {
    primitiveKind,
    defaults: promoter.defaults,
    tokens: promoter.tokens,
    knobs: promoter.knobs,
    ...(needsMask ? { needsMask: true } : {}),
    skeleton,
    warnings,
  };
}

export function liftGsapToBundle(source: string, options: LiftOptions): SeqextBundle {
  const primitiveKind = options.primitiveKind ?? primitiveKindFromId(options.id);
  const lifted = liftGsapSource(source, { ...options, primitiveKind });
  const bundle: SeqextBundle = {
    manifest: {
      id: options.id,
      type: "primitive",
      version: options.version ?? "0.1.0",
      summary: options.summary,
      tags: options.tags ?? { energy: "punchy", style: "organic" },
      source: "forge",
    },
    spec: {
      primitiveKind,
      defaults: lifted.defaults,
      tokens: lifted.tokens,
      knobs: lifted.knobs,
      slots: [],
      relationships: options.relationships ?? { pairsWith: [], conflictsWith: [] },
      guardrails: options.guardrails ?? lifted.warnings,
      skeleton: lifted.skeleton,
      ...(lifted.needsMask ? { needsMask: true } : {}),
    },
  };
  const validation = validateBundle(bundle);
  if (!validation.ok) {
    throw new Error(`lift produced an invalid bundle:\n  ${validation.errors.join("\n  ")}`);
  }
  return bundle;
}
