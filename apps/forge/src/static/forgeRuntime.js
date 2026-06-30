/* Forge preview runtime — injected into every Stage asset iframe.
 *
 * This is the bridge that makes a Stage component's CONTRACT live:
 *   - knobs  → `forge.setVar(name, value)` writes the CSS custom property and
 *              `forge.vars[name]`, then fires a `forge:var` event.
 *   - actions→ `forge.trigger(name)` runs a registered handler, or, by default,
 *              toggles `[data-forge-open]` on the part named by the trigger's
 *              `data-forge-affects` (so simple "press → reveal" interactions need
 *              zero author JS). Clicking any `[data-forge-action]` auto-triggers.
 *
 * The SAME `forge.trigger` / `forge.setVar` API is what the Inspector calls to
 * test tweaks and what the downstream HyperFrames Motion AI calls to drive the
 * component inside a sequence — the author never wires the host, only declares.
 *
 * The host talks to this runtime over postMessage (`forge:setVar`,
 * `forge:trigger`, `forge:reset`); the runtime reports `forge:ready` with the
 * discovered contract so the panel can populate without re-parsing.
 */
(function () {
  "use strict";
  if (window.forge) return;

  const root = document.documentElement;
  const handlers = Object.create(null);
  const initial = (window.__FORGE_VARS__ && typeof window.__FORGE_VARS__ === "object") ? window.__FORGE_VARS__ : {};
  const knobList = Array.isArray(window.__FORGE_KNOBS__) ? window.__FORGE_KNOBS__ : [];
  const actionList = Array.isArray(window.__FORGE_ACTIONS__) ? window.__FORGE_ACTIONS__ : [];
  const knobMeta = Object.create(null);
  const actionMeta = Object.create(null);
  knobList.forEach((knob) => {
    if (knob && typeof knob.name === "string") knobMeta[knob.name] = knob;
  });
  actionList.forEach((action) => {
    if (action && typeof action.name === "string") actionMeta[action.name] = action;
  });

  const forge = {
    vars: Object.assign(Object.create(null), initial),
    /** Register a custom handler for an action (overrides the default toggle). */
    on(name, fn) {
      if (typeof fn === "function") handlers[name] = fn;
      return forge;
    },
    /** Set an exposed knob: writes `--name` and records the value. */
    setVar(name, value) {
      if (!name) return;
      forge.vars[name] = value;
      try {
        root.style.setProperty("--" + name, cssVarValue(name, value));
      } catch (_) {
        /* invalid var name — ignore */
      }
      // Boolean knobs also surface as a root attribute for attribute-driven CSS.
      if (value === true || value === false) {
        root.toggleAttribute("data-" + name, value === true);
      } else if (value == null || value === "") {
        root.removeAttribute("data-" + name);
      } else {
        root.setAttribute("data-" + name, String(value));
      }
      updateBoundElements(name, value);
      window.dispatchEvent(new CustomEvent("forge:var", { detail: { name, value } }));
      post({ type: "forge:var", name: name, value: value });
    },
    /** Fire a named interaction. Returns true if something handled it. */
    trigger(name, detail) {
      if (!name) return false;
      const ev = new CustomEvent("forge:action", { detail: Object.assign({ name }, detail), cancelable: true });
      window.dispatchEvent(ev);
      let handled = false;
      if (handlers[name]) {
        handlers[name](detail);
        handled = true;
      } else {
        handled = defaultAction(name);
      }
      post({ type: "forge:action", name: name, handled: handled });
      return handled;
    },
  };

  function knobType(name) {
    return knobMeta[name] && typeof knobMeta[name].type === "string" ? knobMeta[name].type : "";
  }

  function cssVarValue(name, value) {
    if (knobType(name) === "image") return imageCssValue(value);
    if (value == null) return "";
    return String(value);
  }

  function imageCssValue(value) {
    const raw = value == null ? "" : String(value).trim();
    if (!raw) return "none";
    if (/^(none|url\()/i.test(raw)) return raw;
    return 'url("' + raw.replace(/["\\\n\r]/g, "\\$&") + '")';
  }

  function setElementAttr(el, attr, value, type) {
    const raw = value == null ? "" : String(value);
    if (attr === "text") el.textContent = raw;
    else if (attr === "value" && "value" in el) el.value = raw;
    else if (attr === "background") el.style.backgroundImage = type === "image" ? imageCssValue(value) : raw;
    else if (raw) el.setAttribute(attr, raw);
    else el.removeAttribute(attr);
  }

  function updateBoundElements(name, value) {
    const type = knobType(name);
    const selector = '[data-forge-var="' + cssEscape(name) + '"]';
    document.querySelectorAll(selector).forEach((el) => {
      const raw = value == null ? "" : String(value);
      el.toggleAttribute("data-forge-empty", raw.trim() === "");
      const attr = el.getAttribute("data-forge-attr");
      if (attr) {
        setElementAttr(el, attr, value, type);
        return;
      }
      const tag = el.tagName ? el.tagName.toLowerCase() : "";
      if (type === "image") {
        if (tag === "img" || tag === "source" || tag === "video") setElementAttr(el, "src", value, type);
        else el.style.backgroundImage = imageCssValue(value);
        return;
      }
      if (tag === "input" || tag === "textarea" || tag === "select") setElementAttr(el, "value", value, type);
      else el.textContent = raw;
    });
  }

  /** Default interaction: toggle `[data-forge-open]` on the affected part(s). */
  function defaultAction(name) {
    const triggers = document.querySelectorAll('[data-forge-action="' + cssEscape(name) + '"]');
    let changed = false;
    const targets = new Set();
    const declaredAffects = actionMeta[name] && actionMeta[name].affects;
    if (typeof declaredAffects === "string") {
      declaredAffects.split(/[,\s]+/).filter(Boolean).forEach((part) => targets.add(part));
    }
    triggers.forEach((t) => {
      t.toggleAttribute("data-forge-pressed", !t.hasAttribute("data-forge-pressed"));
      const affects = t.getAttribute("data-forge-affects");
      if (affects) affects.split(/[,\s]+/).filter(Boolean).forEach((a) => targets.add(a));
    });
    targets.forEach((partName) => {
      document
        .querySelectorAll('[data-forge-component="' + cssEscape(partName) + '"],[data-forge-part="' + cssEscape(partName) + '"]')
        .forEach((part) => {
          part.toggleAttribute("data-forge-open", !part.hasAttribute("data-forge-open"));
          changed = true;
        });
    });
    return changed;
  }

  function cssEscape(s) {
    return String(s).replace(/["\\]/g, "\\$&");
  }

  /* ── discover the live contract (mirrors stageContract.ts, attributes only) ── */
  function discoverContract() {
    const parts = new Set();
    const objects = new Set();
    const layers = [];
    document.querySelectorAll("[data-forge-component],[data-forge-part]").forEach((el) => {
      const v = el.getAttribute("data-forge-component") || el.getAttribute("data-forge-part");
      if (v) {
        const part = v.trim();
        parts.add(part);
        const role = el.getAttribute("data-forge-layer");
        if (/^(backdrop|subject|overlay)$/.test(role || "")) layers.push({ part, role });
      }
    });
    document.querySelectorAll("[data-forge-object]").forEach((el) => {
      const value = el.getAttribute("data-forge-object");
      if (value) objects.add(value.trim());
    });
    const actions = new Set();
    document.querySelectorAll("[data-forge-action]").forEach((el) => {
      const v = el.getAttribute("data-forge-action");
      if (v) actions.add(v.trim());
    });
    return { parts: [...parts].sort(), actions: [...actions].sort(), objects: [...objects].sort(), layers };
  }

  /* ── host bridge ── */
  function post(msg) {
    try {
      if (window.parent && window.parent !== window) window.parent.postMessage(msg, "*");
    } catch (_) {
      /* cross-origin / detached — ignore */
    }
  }

  window.addEventListener("message", (e) => {
    const d = e.data;
    if (!d || typeof d !== "object") return;
    if (d.type === "forge:setVar") forge.setVar(d.name, d.value);
    else if (d.type === "forge:trigger") forge.trigger(d.name, d.detail);
    else if (d.type === "forge:reset") location.reload();
  });

  // Auto-wire declared actions on click (capture so author handlers still run).
  document.addEventListener(
    "click",
    (e) => {
      const t = e.target && e.target.closest ? e.target.closest("[data-forge-action]") : null;
      if (!t) return;
      forge.trigger(t.getAttribute("data-forge-action"));
    },
    true,
  );

  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    root.setAttribute("data-forge-reduced-motion", "");
  }

  // Apply any initial knob values that arrived as a global, then announce.
  for (const k in initial) forge.setVar(k, initial[k]);
  window.forge = forge;

  const announce = () => post({ type: "forge:ready", contract: discoverContract() });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", announce);
  else announce();
})();
