/**
 * Deterministic Stage tweak operations — the token-saving edit path.
 *
 * For a SMALL change to the asset already on the stage, the model can return a
 * tiny op-list (`{ reply, ops:[…] }`) instead of re-emitting the whole asset.
 * `stageRunner` applies the ops here, deterministically, and re-derives the
 * contract. The model decides intent; this module only executes mechanical
 * string edits — it never invents design.
 *
 * Supported ops:
 *   - set-knob   { name, value }       rewrite a `@forge-var` default
 *   - set-text   { part, text }        replace the text of a named part
 *   - rename-part{ from, to }          rename a data-forge-component/part/affects
 *   - ensure-reduced-motion            append the a11y reduced-motion guard
 *
 * Unknown ops are collected in `errors[]`; valid ops still apply.
 */
import { ensureReducedMotionCss } from "./stagePolish.ts";

export interface StageOp {
  op?: string;
  name?: string;
  value?: string | number | boolean;
  part?: string;
  text?: string;
  from?: string;
  to?: string;
  [key: string]: unknown;
}

export interface TweakSource {
  html?: string;
  css?: string;
  js?: string;
  /** TSX, when the current asset is React. */
  reactTsx?: string;
}

export interface TweakResult {
  html: string;
  css: string;
  js: string;
  reactTsx?: string;
  applied: string[];
  errors: string[];
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeHtmlText(input: string): string {
  return input.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function formatKnobValue(value: string | number | boolean | undefined): string {
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  const s = String(value ?? "");
  return /[\s"']/.test(s) ? `"${s.replace(/["']/g, "")}"` : s;
}

/** Rewrite the `default=` of a `@forge-var <name>` directive wherever it appears. */
function setKnobIn(src: string, name: string, value: StageOp["value"]): { src: string; found: boolean } {
  let found = false;
  const formatted = formatKnobValue(value);
  const re = new RegExp(`(@forge-var\\s+${escapeRegExp(name)}\\b)([^\\n\\r*]*)`, "g");
  const out = src.replace(re, (_m, head: string, tail: string) => {
    found = true;
    if (/\bdefault\s*=/.test(tail)) {
      return head + tail.replace(/\bdefault\s*=\s*("[^"]*"|'[^']*'|[^\s]+)/, `default=${formatted}`);
    }
    return `${head}${tail.replace(/\s+$/, "")} default=${formatted} `;
  });
  return { src: out, found };
}

/** Replace the (text-only) contents of the element carrying data-forge-component/part="part". */
function setTextIn(src: string, part: string, text: string): { src: string; found: boolean } {
  let found = false;
  const safe = escapeHtmlText(text);
  const re = new RegExp(
    `(<([a-zA-Z][\\w-]*)\\b[^>]*\\bdata-forge-(?:component|part)\\s*=\\s*["']${escapeRegExp(part)}["'][^>]*>)([^<]*)(</\\2>)`,
  );
  const out = src.replace(re, (_m, open: string, _tag: string, _inner: string, close: string) => {
    found = true;
    return `${open}${safe}${close}`;
  });
  return { src: out, found };
}

/** Rename a part everywhere: the part attributes, the action's `affects`, and the affects attr. */
function renamePartIn(src: string, from: string, to: string): { src: string; count: number } {
  let count = 0;
  let out = src;
  for (const attr of ["data-forge-component", "data-forge-part", "data-forge-affects"]) {
    const re = new RegExp(`(${attr}\\s*=\\s*["'])${escapeRegExp(from)}(["'])`, "g");
    out = out.replace(re, (_m, p1: string, p2: string) => {
      count += 1;
      return `${p1}${to}${p2}`;
    });
  }
  // `@forge-action … affects=from` — affects may be quoted or bare.
  const affRe = new RegExp(`(affects\\s*=\\s*)(["']?)${escapeRegExp(from)}\\2(?![\\w-])`, "g");
  out = out.replace(affRe, (_m, p1: string, q: string) => {
    count += 1;
    return `${p1}${q}${to}${q}`;
  });
  return { src: out, count };
}

export function applyStageOps(source: TweakSource, ops: StageOp[]): TweakResult {
  let html = source.html ?? "";
  let css = source.css ?? "";
  let js = source.js ?? "";
  let reactTsx = source.reactTsx;
  const applied: string[] = [];
  const errors: string[] = [];

  for (const op of Array.isArray(ops) ? ops : []) {
    const kind = typeof op?.op === "string" ? op.op : "";
    switch (kind) {
      case "set-knob": {
        if (!op.name) {
          errors.push("set-knob requires a name");
          break;
        }
        const a = setKnobIn(css, op.name, op.value);
        const b = setKnobIn(html, op.name, op.value);
        const c = setKnobIn(js, op.name, op.value);
        css = a.src;
        html = b.src;
        js = c.src;
        if (reactTsx != null) {
          const d = setKnobIn(reactTsx, op.name, op.value);
          reactTsx = d.src;
          if (d.found) a.found = true;
        }
        if (a.found || b.found || c.found) applied.push(`set knob "${op.name}" = ${formatKnobValue(op.value)}`);
        else errors.push(`set-knob: no @forge-var "${op.name}" found`);
        break;
      }
      case "set-text": {
        if (!op.part || op.text == null) {
          errors.push("set-text requires part and text");
          break;
        }
        const h = setTextIn(html, op.part, String(op.text));
        html = h.src;
        let found = h.found;
        if (reactTsx != null) {
          const r = setTextIn(reactTsx, op.part, String(op.text));
          reactTsx = r.src;
          found = found || r.found;
        }
        if (found) applied.push(`set text of "${op.part}"`);
        else errors.push(`set-text: "${op.part}" not found or has child elements`);
        break;
      }
      case "rename-part": {
        if (!op.from || !op.to) {
          errors.push("rename-part requires from and to");
          break;
        }
        let count = 0;
        const h = renamePartIn(html, op.from, op.to);
        html = h.src;
        count += h.count;
        const c = renamePartIn(css, op.from, op.to);
        css = c.src;
        count += c.count;
        const j = renamePartIn(js, op.from, op.to);
        js = j.src;
        count += j.count;
        if (reactTsx != null) {
          const r = renamePartIn(reactTsx, op.from, op.to);
          reactTsx = r.src;
          count += r.count;
        }
        if (count > 0) applied.push(`renamed part "${op.from}" → "${op.to}"`);
        else errors.push(`rename-part: "${op.from}" not found`);
        break;
      }
      case "ensure-reduced-motion": {
        const guard = ensureReducedMotionCss(css, js, reactTsx ?? "");
        css = guard.css;
        if (guard.added) applied.push("added reduced-motion fallback");
        else applied.push("reduced-motion already handled");
        break;
      }
      default:
        errors.push(`unknown op: ${kind || "(missing op)"}`);
    }
  }

  return { html, css, js, reactTsx, applied, errors };
}
