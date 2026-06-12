/* Resizable panel splitters. Each splittable layout reads a CSS custom
 * property (with a stylesheet fallback); a splitHandle drags that property
 * on :root and persists it to localStorage. Double-click resets to default.
 *
 * Loaded before app.js; handles are attached by app.js (static timeline
 * panels) and by each page builder (Media/Design/Storyboard/Render panes). */

(function restoreSplitSizes() {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith("seq.ui.size.--")) {
      document.documentElement.style.setProperty(key.slice("seq.ui.size.".length), localStorage.getItem(key));
    }
  }
})();

/**
 * A drag handle sitting on one edge of its parent pane.
 *  edge   — which edge of the OWNING pane it overlays ("left"|"right"|"top"|"bottom")
 *  cssVar — the :root custom property holding the pane's size
 *  min/max — px clamp
 *  onChange — called (throttled to the pointer events) while resizing
 */
function splitHandle({ edge, cssVar, min, max, onChange }) {
  const vertical = edge === "left" || edge === "right";
  const handle = document.createElement("div");
  handle.className = `split-handle ${vertical ? "v" : "h"} ${edge}`;
  handle.title = "drag to resize · double-click to reset";

  handle.onpointerdown = (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    handle.setPointerCapture(e.pointerId);
    handle.classList.add("active");
    const pane = handle.parentElement;
    const rect = pane.getBoundingClientRect();
    const startSize = vertical ? rect.width : rect.height;
    const startPos = vertical ? e.clientX : e.clientY;
    // Dragging away from the pane's anchored side grows it.
    const sign = edge === "right" || edge === "bottom" ? 1 : -1;
    handle.onpointermove = (ev) => {
      const delta = ((vertical ? ev.clientX : ev.clientY) - startPos) * sign;
      const next = Math.round(Math.min(max, Math.max(min, startSize + delta)));
      document.documentElement.style.setProperty(cssVar, `${next}px`);
      onChange?.();
    };
    const finish = () => {
      handle.onpointermove = null;
      handle.onpointerup = null;
      handle.onpointercancel = null;
      handle.classList.remove("active");
      const value = document.documentElement.style.getPropertyValue(cssVar);
      if (value) localStorage.setItem(`seq.ui.size.${cssVar}`, value);
      onChange?.();
    };
    handle.onpointerup = finish;
    handle.onpointercancel = finish;
  };

  handle.ondblclick = () => {
    document.documentElement.style.removeProperty(cssVar);
    localStorage.removeItem(`seq.ui.size.${cssVar}`);
    onChange?.();
  };
  return handle;
}
