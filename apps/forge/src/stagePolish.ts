/**
 * Deterministic, zero-token "polish" pass for Stage assets.
 *
 * The model returns the design; this pass only performs MECHANICAL cleanup that
 * never makes a design decision — the kind of thing it would be wasteful to spend
 * model tokens on and risky to leave to a cheap model:
 *
 *   - strip a stray markdown code fence wrapping a whole field;
 *   - unwrap a `<style>` / `<script>` tag the model wrapped css/js in;
 *   - hoist `@import` rules to the top of the CSS (browsers ignore late @imports);
 *   - guarantee a `prefers-reduced-motion` fallback when the asset animates.
 *
 * It runs in `stageRunner` after parse, before contract extraction. Each change
 * is reported in `changed[]` so the reply can mention what was auto-cleaned.
 */

export interface StageSourceParts {
  html: string;
  css: string;
  js: string;
}

export interface PolishResult extends StageSourceParts {
  changed: string[];
}

/** A field that is entirely a single ```lang fenced block → its inner text. */
export function stripCodeFence(value: string): string {
  const trimmed = value.trim();
  const m = /^```[a-zA-Z0-9]*\r?\n([\s\S]*?)\r?\n?```$/.exec(trimmed);
  return m ? m[1]! : value;
}

/** `<style>…</style>` wrapping the whole css field → its inner text. */
function unwrapStyle(css: string): string {
  const m = /^\s*<style[^>]*>([\s\S]*)<\/style>\s*$/i.exec(css);
  return m ? m[1]! : css;
}

/** `<script>…</script>` wrapping the whole js field → its inner text. */
function unwrapScript(js: string): string {
  const m = /^\s*<script[^>]*>([\s\S]*)<\/script>\s*$/i.exec(js);
  return m ? m[1]! : js;
}

/**
 * Pull every top-level `@import …;` to the front of the stylesheet in original
 * order. Scans the whole sheet (not just the leading run), only touching imports
 * at brace depth 0, and respects strings / `url(...)` parens when finding the
 * terminating `;`. Returns `{ css, moved }` — `moved` is true when an import had
 * to be lifted past earlier content (i.e. a real reorder happened).
 */
export function hoistImports(css: string): { css: string; moved: boolean } {
  const imports: string[] = [];
  let body = "";
  let i = 0;
  let braceDepth = 0;
  let moved = false;
  let seenContent = false;
  while (i < css.length) {
    const ch = css[i]!;
    if (braceDepth === 0 && css.slice(i, i + 7).toLowerCase() === "@import") {
      let quote = "";
      let depth = 0;
      let end = -1;
      for (let j = i + 7; j < css.length; j += 1) {
        const c = css[j]!;
        const prev = css[j - 1];
        if (quote) {
          if (c === quote && prev !== "\\") quote = "";
        } else if (c === '"' || c === "'") quote = c;
        else if (c === "(") depth += 1;
        else if (c === ")" && depth > 0) depth -= 1;
        else if (c === ";" && depth === 0) {
          end = j + 1;
          break;
        }
      }
      if (end === -1) break; // malformed — leave the remainder as-is
      imports.push(css.slice(i, end).trim());
      if (seenContent) moved = true;
      i = end;
      continue;
    }
    if (ch === "{") braceDepth += 1;
    else if (ch === "}") braceDepth = Math.max(0, braceDepth - 1);
    else if (!/\s/.test(ch)) seenContent = true;
    body += ch;
    i += 1;
  }
  if (!imports.length) return { css, moved: false };
  return { css: `${imports.join("\n")}\n${body.replace(/^\s+/, "")}`, moved };
}

const REDUCED_MOTION_GUARD = `@media (prefers-reduced-motion: reduce){*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important;scroll-behavior:auto!important}}`;

/** True if the source animates (so a reduced-motion fallback is warranted). */
export function sourceAnimates(...sources: string[]): boolean {
  const all = sources.join("\n");
  return /transition\s*:|transition-|animation\s*:|animation-|@keyframes|\bgsap\b/i.test(all);
}

/** True if a reduced-motion fallback is already handled (CSS media query or JS matchMedia). */
export function handlesReducedMotion(...sources: string[]): boolean {
  return /prefers-reduced-motion/i.test(sources.join("\n"));
}

/**
 * Append the standard reduced-motion guard to CSS when the asset animates and
 * nothing already handles it. `extra` sources (js/react) are scanned too.
 */
export function ensureReducedMotionCss(css: string, ...extra: string[]): { css: string; added: boolean } {
  if (!sourceAnimates(css, ...extra)) return { css, added: false };
  if (handlesReducedMotion(css, ...extra)) return { css, added: false };
  const sep = css.trim() ? "\n" : "";
  return { css: `${css}${sep}${REDUCED_MOTION_GUARD}`, added: true };
}

/** Run the full mechanical polish over a Stage asset. */
export function polishStageAsset(
  asset: StageSourceParts,
  context?: { react?: string },
): PolishResult {
  const changed: string[] = [];

  let html = stripCodeFence(asset.html ?? "");
  let css = stripCodeFence(asset.css ?? "");
  let js = stripCodeFence(asset.js ?? "");
  if (html !== (asset.html ?? "") || css !== (asset.css ?? "") || js !== (asset.js ?? "")) {
    changed.push("stripped code fence");
  }

  const unwrappedCss = unwrapStyle(css);
  const unwrappedJs = unwrapScript(js);
  if (unwrappedCss !== css || unwrappedJs !== js) changed.push("unwrapped <style>/<script>");
  css = unwrappedCss;
  js = unwrappedJs;

  const hoisted = hoistImports(css);
  css = hoisted.css;
  if (hoisted.moved) changed.push("hoisted @import");

  const guard = ensureReducedMotionCss(css, js, context?.react ?? "");
  css = guard.css;
  if (guard.added) changed.push("added reduced-motion fallback");

  return { html, css, js, changed };
}
