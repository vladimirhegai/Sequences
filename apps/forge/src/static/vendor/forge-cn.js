/* forge-cn.js — a tiny, dependency-free `cn()` for Stage previews.
 *
 * shadcn components compose class names with `cn(...)` (clsx + tailwind-merge).
 * The Forge preview has no bundler, so this provides a self-contained clsx-style
 * joiner on `window.cn` (and `window.clsx`). It does NOT dedupe conflicting
 * Tailwind utilities the way tailwind-merge does — the shadcn-stage skill tells
 * the agent to avoid emitting conflicting utilities. Injected only when an asset
 * declares `capabilities.tailwind`.
 */
(function () {
  "use strict";
  if (window.cn) return;

  function toVal(mix) {
    let str = "";
    if (typeof mix === "string" || typeof mix === "number") {
      str += mix;
    } else if (typeof mix === "object" && mix) {
      if (Array.isArray(mix)) {
        for (let i = 0; i < mix.length; i += 1) {
          if (mix[i]) {
            const y = toVal(mix[i]);
            if (y) str += (str && " ") + y;
          }
        }
      } else {
        for (const key in mix) {
          if (mix[key]) str += (str && " ") + key;
        }
      }
    }
    return str;
  }

  function cn() {
    let str = "";
    for (let i = 0; i < arguments.length; i += 1) {
      const arg = arguments[i];
      if (arg) {
        const x = toVal(arg);
        if (x) str += (str && " ") + x;
      }
    }
    return str;
  }

  window.cn = cn;
  window.clsx = cn;
})();
