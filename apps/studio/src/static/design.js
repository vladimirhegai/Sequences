/* Design page - curated motion-design asset editor.
 *
 * The working surface is an SVG in project-independent design units. Scratch
 * state lives in localStorage until the user saves the drawing into the media
 * pool as a normal SVG image asset.
 */

const DESIGN_W = 1280;
const DESIGN_H = 720;
const DESIGN_MIN_SIZE = 8;
const DESIGN_TEXT_MIN_W = 72;
const DESIGN_TEXT_MIN_H = 34;
const DESIGN_TEXT_DEFAULT_W = 360;
const DESIGN_TEXT_DEFAULT_H = 120;
const DESIGN_SHAPE_DEFAULT_W = 180;
const DESIGN_SHAPE_DEFAULT_H = 110;
const DESIGN_LINE_DEFAULT_W = 180;
const DESIGN_LINE_DEFAULT_H = 0;
const DESIGN_HANDLE_SIZE = 14;

let designTool = "select";
let designItems = [];
let designSelectedId = null;
let designLoaded = false;
let designIdSeq = 1;
let designSvg = null;
let designFocusTextOnRender = false;
let designKeysBound = false;

function designStorageKey() {
  return `seq.design.${state ? state.projectDir : ""}`;
}

function designResetForProject() {
  designItems = [];
  designSelectedId = null;
  designLoaded = false;
  designSvg = null;
}

function designPersist() {
  try {
    localStorage.setItem(designStorageKey(), JSON.stringify(designItems));
  } catch {
    /* Scratch persistence is best-effort. */
  }
}

function designRestore() {
  if (designLoaded) return;
  designLoaded = true;
  try {
    const raw = localStorage.getItem(designStorageKey());
    designItems = raw ? JSON.parse(raw).map(designNormalizeItem).filter(Boolean) : [];
  } catch {
    designItems = [];
  }
  if (!designItems.some((i) => i.id === designSelectedId)) designSelectedId = null;
}

function designNormalizeItem(raw) {
  if (!raw || typeof raw !== "object") return null;
  const type = ["rect", "ellipse", "line", "text"].includes(raw.type) ? raw.type : "rect";
  const item = {
    id: raw.id || designNewId(),
    type,
    x: num(raw.x, 80),
    y: num(raw.y, 80),
    w: num(raw.w, type === "text" ? DESIGN_TEXT_DEFAULT_W : DESIGN_SHAPE_DEFAULT_W),
    h: num(raw.h, type === "text" ? DESIGN_TEXT_DEFAULT_H : DESIGN_SHAPE_DEFAULT_H),
    fill: raw.fill || (type === "line" ? "#c9cfd9" : type === "text" ? "#eef1f5" : "#7c9fc4"),
    fill2: raw.fill2 || null,
    gradAngle: num(raw.gradAngle, 90),
    stroke: raw.stroke || (type === "line" ? "#c9cfd9" : null),
    strokeW: num(raw.strokeW, type === "line" ? 6 : 0),
    radius: num(raw.radius, type === "rect" ? 12 : 0),
    opacity: clamp(num(raw.opacity, 1), 0, 1),
    text: raw.text || "Text",
    fontSize: num(raw.fontSize, type === "text" ? 64 : 64),
  };
  if (type === "text") {
    item.w = Math.max(DESIGN_TEXT_MIN_W, Math.abs(item.w || DESIGN_TEXT_DEFAULT_W));
    item.h = Math.max(DESIGN_TEXT_MIN_H, Math.abs(item.h || DESIGN_TEXT_DEFAULT_H));
  } else if (type !== "line") {
    normalizePositiveBox(item, DESIGN_MIN_SIZE);
  }
  return item;
}

function enterDesignPage() {
  designBindKeys();
  designRestore();
  renderDesignPage();
}

function designOnState() {
  /* Design scratch state is local; exported SVGs enter project state. */
}

function designNewId() {
  while (designItems.some((i) => i.id === `d${designIdSeq}`)) designIdSeq++;
  return `d${designIdSeq++}`;
}

function designSelected() {
  return designItems.find((i) => i.id === designSelectedId) ?? null;
}

const DESIGN_TOOLS = [
  ["select", "cursor", "Select, move, resize"],
  ["rect", "shape", "Rectangle"],
  ["ellipse", "circle", "Ellipse"],
  ["line", "line", "Line"],
  ["text", "text", "Text box"],
];

function renderDesignPage() {
  const host = pageHost("design");
  host.innerHTML = "";
  const cols = el("div", { class: "page-cols" });

  const rail = el("div", { class: "tool-rail" });
  for (const [id, ico, tip] of DESIGN_TOOLS) {
    const btn = el("button", { class: `tool-btn ${designTool === id ? "on" : ""}`, title: tip });
    btn.append(icon(ico, 15));
    btn.onclick = () => {
      designTool = id;
      renderDesignPage();
    };
    rail.appendChild(btn);
  }
  rail.append(el("div", { class: "tool-sep" }));
  const clear = el("button", { class: "tool-btn", title: "Clear canvas" });
  clear.append(icon("trash", 14));
  clear.onclick = () => {
    if (designItems.length && confirm("Clear the design canvas?")) {
      designItems = [];
      designSelectedId = null;
      designPersist();
      renderDesignPage();
    }
  };
  rail.appendChild(clear);

  const stagePane = el("div", { class: "page-pane" });
  stagePane.append(
    el("div", { class: "pane-head" }, [
      el("span", { class: "ph-title" }, ["Design"]),
      el("span", { class: "ph-sub" }, [`${DESIGN_W}x${DESIGN_H} - SVG asset editor`]),
      el("div", { class: "ph-tools" }, [el("span", { class: "phase-tag" }, ["asset canvas"])]),
    ]),
  );
  const stage = el("div", { class: "design-stage" });
  const wrap = el("div", { class: "design-canvas-wrap" });
  wrap.appendChild(buildDesignSvg());
  stage.appendChild(wrap);
  stagePane.appendChild(stage);

  const props = el("div", { class: "page-pane" });
  props.append(
    el("div", { class: "pane-head" }, [
      el("span", { class: "ph-title" }, ["Properties"]),
      el("span", { class: "ph-sub" }, [designSelectedId ?? ""]),
    ]),
  );
  const propsBody = el("div", { class: "pane-body" });
  fillDesignProps(propsBody);
  props.appendChild(propsBody);

  cols.append(rail, stagePane, props);
  host.appendChild(cols);

  if (designFocusTextOnRender) {
    designFocusTextOnRender = false;
    setTimeout(() => {
      const input = $("designTextInput");
      input?.focus();
      input?.select?.();
    }, 0);
  }
}

/* ---------------- SVG construction ---------------- */

const SVG_NS = "http://www.w3.org/2000/svg";

function svgEl(tag, attrs = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

function buildDesignSvg() {
  const svg = svgEl("svg", {
    class: "design-svg",
    viewBox: `0 0 ${DESIGN_W} ${DESIGN_H}`,
    tabindex: "0",
    role: "application",
    "aria-label": "Design canvas",
  });
  svg.style.width = "min(100%, 1100px)";
  svg.style.aspectRatio = `${DESIGN_W}/${DESIGN_H}`;
  designSvg = svg;
  paintDesignSvg(svg);
  wireDesignCanvas(svg);
  return svg;
}

function paintDesignSvg(svg = designSvg) {
  if (!svg) return;
  svg.replaceChildren();
  svg.style.cursor = designCursor();

  const defs = svgEl("defs");
  svg.append(defs);

  for (const item of designItems) {
    svg.appendChild(designItemNode(item, defs, true));
  }

  const sel = designSelected();
  if (sel && designTool === "select") drawDesignSelection(svg, sel);
}

function designCursor() {
  if (designTool === "select") return "default";
  if (designTool === "text") return "text";
  return "crosshair";
}

function designFillFor(item, defs) {
  if (item.fill2 && item.type !== "line") {
    const gid = `grad-${item.id}`;
    const angle = ((item.gradAngle ?? 90) * Math.PI) / 180;
    const x2 = 0.5 + Math.cos(angle) / 2;
    const y2 = 0.5 + Math.sin(angle) / 2;
    const grad = svgEl("linearGradient", { id: gid, x1: 1 - x2, y1: 1 - y2, x2, y2 });
    grad.append(svgEl("stop", { offset: "0%", "stop-color": item.fill }));
    grad.append(svgEl("stop", { offset: "100%", "stop-color": item.fill2 }));
    defs.append(grad);
    return `url(#${gid})`;
  }
  return item.fill;
}

function designItemNode(item, defs, interactive) {
  const common = {
    opacity: item.opacity ?? 1,
    ...(item.stroke && item.strokeW && item.type !== "line" ? { stroke: item.stroke, "stroke-width": item.strokeW } : {}),
  };
  let node;
  if (item.type === "rect") {
    node = svgEl("rect", {
      x: item.x,
      y: item.y,
      width: Math.max(1, item.w),
      height: Math.max(1, item.h),
      rx: item.radius ?? 0,
      fill: designFillFor(item, defs),
      ...common,
    });
  } else if (item.type === "ellipse") {
    node = svgEl("ellipse", {
      cx: item.x + item.w / 2,
      cy: item.y + item.h / 2,
      rx: Math.max(1, item.w / 2),
      ry: Math.max(1, item.h / 2),
      fill: designFillFor(item, defs),
      ...common,
    });
  } else if (item.type === "line") {
    node = svgEl("line", {
      x1: item.x,
      y1: item.y,
      x2: item.x + item.w,
      y2: item.y + item.h,
      stroke: item.stroke || item.fill || "#c9cfd9",
      "stroke-width": item.strokeW || 6,
      "stroke-linecap": "round",
      opacity: item.opacity ?? 1,
    });
  } else {
    node = designTextNode(item, defs, interactive);
  }
  stampDesignId(node, item.id);
  if (interactive) node.style.cursor = designTool === "select" ? "move" : designCursor();
  return node;
}

function designTextNode(item, defs, interactive) {
  const clipId = `clip-${item.id}`;
  const clip = svgEl("clipPath", { id: clipId });
  clip.append(svgEl("rect", { x: item.x, y: item.y, width: Math.max(1, item.w), height: Math.max(1, item.h) }));
  defs.append(clip);

  const g = svgEl("g", { opacity: item.opacity ?? 1 });
  if (interactive) {
    g.append(
      svgEl("rect", {
        class: "design-text-hit",
        x: item.x,
        y: item.y,
        width: Math.max(1, item.w),
        height: Math.max(1, item.h),
        fill: "transparent",
        "pointer-events": "all",
      }),
    );
  }

  const text = svgEl("text", {
    x: item.x + 12,
    y: item.y + 10,
    fill: designFillFor(item, defs),
    "font-size": item.fontSize ?? 64,
    "font-family": "Segoe UI, system-ui, sans-serif",
    "font-weight": 650,
    "dominant-baseline": "hanging",
    "clip-path": `url(#${clipId})`,
  });
  const lineHeight = Math.round((item.fontSize ?? 64) * 1.16);
  for (const [i, line] of designWrapText(item).entries()) {
    const tspan = svgEl("tspan", { x: item.x + 12, dy: i === 0 ? 0 : lineHeight });
    tspan.textContent = line;
    text.append(tspan);
  }
  g.append(text);
  return g;
}

function stampDesignId(node, id) {
  node.dataset.id = id;
  for (const child of node.querySelectorAll("*")) child.dataset.id = id;
}

function designWrapText(item) {
  const fontSize = item.fontSize ?? 64;
  const maxChars = Math.max(1, Math.floor(Math.max(16, item.w - 24) / (fontSize * 0.54)));
  const raw = String(item.text || "Text").replace(/\r/g, "");
  const lines = [];
  for (const paragraph of raw.split("\n")) {
    const words = paragraph.trim() ? paragraph.split(/\s+/) : [""];
    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (next.length <= maxChars || !line) {
        line = next;
      } else {
        lines.push(line);
        line = word;
      }
    }
    lines.push(line);
  }
  return lines.length ? lines : ["Text"];
}

function designSelectionBox(item) {
  if (item.type === "line") {
    const x = Math.min(item.x, item.x + item.w);
    const y = Math.min(item.y, item.y + item.h);
    return { x, y, w: Math.max(1, Math.abs(item.w)), h: Math.max(1, Math.abs(item.h)) };
  }
  return { x: item.x, y: item.y, w: Math.max(1, item.w), h: Math.max(1, item.h) };
}

function drawDesignSelection(svg, item) {
  const box = designSelectionBox(item);
  const g = svgEl("g", { class: "dsel" });
  g.append(
    svgEl("rect", {
      class: "dsel-outline",
      x: box.x - 4,
      y: box.y - 4,
      width: box.w + 8,
      height: box.h + 8,
    }),
  );

  if (item.type === "line") {
    const start = svgEl("circle", { class: "dsel-handle line", cx: item.x, cy: item.y, r: 7 });
    start.dataset.handle = "line-start";
    const end = svgEl("circle", { class: "dsel-handle line", cx: item.x + item.w, cy: item.y + item.h, r: 7 });
    end.dataset.handle = "line-end";
    g.append(start, end);
  } else {
    for (const handle of ["nw", "n", "ne", "e", "se", "s", "sw", "w"]) {
      const p = designHandlePoint(box, handle);
      const h = svgEl("rect", {
        class: "dsel-handle",
        x: p.x - DESIGN_HANDLE_SIZE / 2,
        y: p.y - DESIGN_HANDLE_SIZE / 2,
        width: DESIGN_HANDLE_SIZE,
        height: DESIGN_HANDLE_SIZE,
        rx: 2,
      });
      h.dataset.handle = handle;
      h.style.cursor = designHandleCursor(handle);
      g.append(h);
    }
  }
  svg.append(g);
}

function designHandlePoint(box, handle) {
  const midX = box.x + box.w / 2;
  const midY = box.y + box.h / 2;
  const right = box.x + box.w;
  const bottom = box.y + box.h;
  return {
    x: handle.includes("w") ? box.x : handle.includes("e") ? right : midX,
    y: handle.includes("n") ? box.y : handle.includes("s") ? bottom : midY,
  };
}

function designHandleCursor(handle) {
  if (handle === "n" || handle === "s") return "ns-resize";
  if (handle === "e" || handle === "w") return "ew-resize";
  if (handle === "nw" || handle === "se") return "nwse-resize";
  return "nesw-resize";
}

function designPoint(svg, ev) {
  const rect = svg.getBoundingClientRect();
  return {
    x: clamp(((ev.clientX - rect.left) / rect.width) * DESIGN_W, 0, DESIGN_W),
    y: clamp(((ev.clientY - rect.top) / rect.height) * DESIGN_H, 0, DESIGN_H),
  };
}

function designTargetId(target) {
  const node = target?.closest ? target.closest("[data-id]") : null;
  return node?.dataset?.id ?? null;
}

function wireDesignCanvas(svg) {
  svg.onpointerdown = (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    svg.focus();
    const p = designPoint(svg, e);
    try {
      svg.setPointerCapture(e.pointerId);
    } catch {
      /* Some synthetic test events do not support capture. */
    }

    const handle = e.target?.dataset?.handle;
    if (designTool === "select" && handle) {
      designBeginResize(svg, e.pointerId, p, handle);
      return;
    }

    if (designTool === "select") {
      const id = designTargetId(e.target);
      designSelectedId = id;
      const item = designSelected();
      if (!item) {
        renderDesignPage();
        return;
      }
      designBeginMove(svg, e.pointerId, p, item);
      return;
    }

    if (designTool === "text") {
      designBeginCreate(svg, e.pointerId, p, "text");
      return;
    }

    designBeginCreate(svg, e.pointerId, p, designTool);
  };

  svg.ondblclick = (e) => {
    const id = designTargetId(e.target);
    const item = designItems.find((i) => i.id === id);
    if (!item || item.type !== "text") return;
    const next = prompt("Text:", item.text ?? "");
    if (next === null) return;
    item.text = next || "Text";
    designPersist();
    renderDesignPage();
  };
}

function designBeginMove(svg, pointerId, p, item) {
  const start = { x: item.x, y: item.y, px: p.x, py: p.y };
  let moved = false;
  svg.onpointermove = (ev) => {
    const q = designPoint(svg, ev);
    item.x = Math.round(start.x + (q.x - start.px));
    item.y = Math.round(start.y + (q.y - start.py));
    moved = true;
    paintDesignSvg(svg);
  };
  svg.onpointerup = () => finishDesignGesture(svg, pointerId, moved);
  svg.onpointercancel = () => finishDesignGesture(svg, pointerId, moved);
}

function designBeginResize(svg, pointerId, p, handle) {
  const item = designSelected();
  if (!item) return;
  const start = {
    x: item.x,
    y: item.y,
    w: item.w,
    h: item.h,
    right: item.x + item.w,
    bottom: item.y + item.h,
  };
  let changed = false;

  svg.onpointermove = (ev) => {
    const q = designPoint(svg, ev);
    if (item.type === "line") {
      if (handle === "line-start") {
        const endX = start.x + start.w;
        const endY = start.y + start.h;
        item.x = Math.round(q.x);
        item.y = Math.round(q.y);
        item.w = Math.round(endX - item.x);
        item.h = Math.round(endY - item.y);
      } else {
        item.w = Math.round(q.x - start.x);
        item.h = Math.round(q.y - start.y);
      }
    } else {
      resizeBoxWithHandle(item, handle, q, start, item.type === "text" ? DESIGN_TEXT_MIN_W : DESIGN_MIN_SIZE, item.type === "text" ? DESIGN_TEXT_MIN_H : DESIGN_MIN_SIZE);
    }
    changed = true;
    paintDesignSvg(svg);
  };
  svg.onpointerup = () => finishDesignGesture(svg, pointerId, changed);
  svg.onpointercancel = () => finishDesignGesture(svg, pointerId, changed);
}

function designBeginCreate(svg, pointerId, p, type) {
  const anchor = { x: Math.round(p.x), y: Math.round(p.y) };
  const item = designCreateItem(type, anchor);
  designItems.push(item);
  designSelectedId = item.id;
  let dragged = false;
  paintDesignSvg(svg);

  svg.onpointermove = (ev) => {
    const q = designPoint(svg, ev);
    dragged = Math.abs(q.x - anchor.x) + Math.abs(q.y - anchor.y) > 4;
    designUpdateCreatedItem(item, anchor, q, dragged);
    paintDesignSvg(svg);
  };
  svg.onpointerup = () => {
    if (!dragged) designApplyClickDefault(item);
    if (item.type !== "line") normalizePositiveBox(item, item.type === "text" ? DESIGN_TEXT_MIN_W : DESIGN_MIN_SIZE, item.type === "text" ? DESIGN_TEXT_MIN_H : DESIGN_MIN_SIZE);
    designTool = "select";
    designFocusTextOnRender = item.type === "text";
    finishDesignGesture(svg, pointerId, true);
  };
  svg.onpointercancel = () => finishDesignGesture(svg, pointerId, true);
}

function designCreateItem(type, p) {
  return {
    id: designNewId(),
    type,
    x: p.x,
    y: p.y,
    w: type === "text" ? DESIGN_TEXT_DEFAULT_W : type === "line" ? 1 : 1,
    h: type === "text" ? DESIGN_TEXT_DEFAULT_H : type === "line" ? 1 : 1,
    fill: type === "line" ? "#c9cfd9" : type === "text" ? "#eef1f5" : "#7c9fc4",
    fill2: null,
    gradAngle: 90,
    stroke: type === "line" ? "#c9cfd9" : null,
    strokeW: type === "line" ? 6 : 0,
    radius: type === "rect" ? 12 : 0,
    opacity: 1,
    text: "Text",
    fontSize: 64,
  };
}

function designUpdateCreatedItem(item, anchor, q, dragged) {
  if (item.type === "line") {
    item.x = anchor.x;
    item.y = anchor.y;
    item.w = Math.round(q.x - anchor.x);
    item.h = Math.round(q.y - anchor.y);
    return;
  }
  if (!dragged && item.type === "text") return;
  item.x = Math.round(Math.min(anchor.x, q.x));
  item.y = Math.round(Math.min(anchor.y, q.y));
  item.w = Math.round(Math.abs(q.x - anchor.x));
  item.h = Math.round(Math.abs(q.y - anchor.y));
}

function designApplyClickDefault(item) {
  if (item.type === "line") {
    item.w = DESIGN_LINE_DEFAULT_W;
    item.h = DESIGN_LINE_DEFAULT_H;
  } else if (item.type === "text") {
    item.w = DESIGN_TEXT_DEFAULT_W;
    item.h = DESIGN_TEXT_DEFAULT_H;
  } else {
    item.w = DESIGN_SHAPE_DEFAULT_W;
    item.h = DESIGN_SHAPE_DEFAULT_H;
  }
}

function finishDesignGesture(svg, pointerId, persist) {
  svg.onpointermove = null;
  svg.onpointerup = null;
  svg.onpointercancel = null;
  try {
    svg.releasePointerCapture(pointerId);
  } catch {
    /* ignore */
  }
  if (persist) designPersist();
  renderDesignPage();
}

function resizeBoxWithHandle(item, handle, q, start, minW, minH) {
  let x = start.x;
  let y = start.y;
  let w = start.w;
  let h = start.h;
  if (handle.includes("e")) w = Math.max(minW, q.x - start.x);
  if (handle.includes("s")) h = Math.max(minH, q.y - start.y);
  if (handle.includes("w")) {
    x = Math.min(q.x, start.right - minW);
    w = start.right - x;
  }
  if (handle.includes("n")) {
    y = Math.min(q.y, start.bottom - minH);
    h = start.bottom - y;
  }
  item.x = Math.round(x);
  item.y = Math.round(y);
  item.w = Math.round(w);
  item.h = Math.round(h);
}

function normalizePositiveBox(item, minW = DESIGN_MIN_SIZE, minH = minW) {
  if (item.w < 0) {
    item.x += item.w;
    item.w = -item.w;
  }
  if (item.h < 0) {
    item.y += item.h;
    item.h = -item.h;
  }
  item.w = Math.max(minW, item.w || minW);
  item.h = Math.max(minH, item.h || minH);
}

/* ---------------- properties panel ---------------- */

function colorInput(value, onchange) {
  const input = el("input", { class: "input", type: "color", value: value ?? "#7c9fc4" });
  input.oninput = (e) => onchange(e.target.value);
  input.onchange = (e) => onchange(e.target.value);
  return input;
}

function fillDesignProps(body) {
  const item = designSelected();
  if (!item) {
    body.append(
      el("div", { class: "props-empty" }, [
        "Choose a tool and draw on the canvas. Select an object to edit fill, stroke, size, opacity, and text.",
      ]),
    );
    body.append(designSaveSection());
    return;
  }

  const softCommit = () => {
    designPersist();
    paintDesignSvg();
  };
  const hardCommit = () => {
    designPersist();
    renderDesignPage();
  };

  const sec = el("div", { class: "insp-section" });
  const secBody = el("div", { class: "insp-sec-body", style: "padding-top:12px" });

  if (item.type === "text") {
    const textInput = el("textarea", {
      id: "designTextInput",
      class: "input",
      rows: 4,
      value: item.text ?? "",
      oninput: (e) => {
        item.text = e.target.value || "Text";
        softCommit();
      },
    });
    secBody.append(
      field("Text", textInput),
      field("Text size", numberBox(item.fontSize ?? 64, 8, 220, (v) => { item.fontSize = v; softCommit(); })),
    );
  }

  if (item.type === "line") {
    secBody.append(
      field("Color", colorInput(item.stroke || item.fill || "#c9cfd9", (v) => {
        item.stroke = v;
        item.fill = v;
        softCommit();
      })),
      field("Stroke width", numberBox(item.strokeW || 6, 1, 80, (v) => { item.strokeW = v; softCommit(); })),
    );
  } else {
    const fillRow = el("div", { class: "grad-row" }, [
      colorInput(item.fill, (v) => { item.fill = v; softCommit(); }),
      item.fill2
        ? colorInput(item.fill2, (v) => { item.fill2 = v; softCommit(); })
        : el("button", { class: "btn-sm", onclick: () => { item.fill2 = "#d2796a"; hardCommit(); } }, ["+ gradient"]),
    ]);
    if (item.fill2) {
      const remove = el("button", { class: "btn-sm", title: "Solid fill" }, [icon("x", 11)]);
      remove.onclick = () => { item.fill2 = null; hardCommit(); };
      fillRow.append(remove);
    }
    secBody.append(field(item.fill2 ? "Gradient" : "Fill", fillRow));
    if (item.fill2) {
      secBody.append(
        field("Gradient angle", numberBox(item.gradAngle ?? 90, -360, 360, (v) => { item.gradAngle = v; softCommit(); }, 1), "degrees"),
      );
    }
  }

  if (item.type !== "text" && item.type !== "line") {
    const strokeRow = el("div", { class: "grad-row" }, [
      colorInput(item.stroke ?? "#c9cfd9", (v) => {
        item.stroke = v;
        if (!item.strokeW) item.strokeW = 4;
        softCommit();
      }),
      numberBox(item.strokeW ?? 0, 0, 80, (v) => { item.strokeW = v; softCommit(); }),
    ]);
    secBody.append(field("Stroke", strokeRow));
  }

  if (item.type === "rect") {
    secBody.append(field("Corner radius", numberBox(item.radius ?? 0, 0, 400, (v) => { item.radius = v; softCommit(); })));
  }

  secBody.append(
    field("Opacity", numberBox(item.opacity ?? 1, 0, 1, (v) => { item.opacity = clamp(v, 0, 1); softCommit(); }, 0.05)),
    designGeometryFields(item, hardCommit),
  );

  const delBtn = el("button", { class: "btn-sm danger" }, [icon("trash", 12), "Delete"]);
  delBtn.onclick = () => {
    designItems = designItems.filter((i) => i.id !== item.id);
    designSelectedId = null;
    hardCommit();
  };
  secBody.append(el("div", { class: "btn-row" }, [delBtn]));
  sec.appendChild(secBody);
  body.append(sec, designSaveSection());
}

function designGeometryFields(item, commit) {
  const wrap = el("div", { class: "row2" });
  if (item.type === "line") {
    wrap.append(
      field("Start X", numberBox(item.x, 0, DESIGN_W, (v) => { item.x = v; commit(); })),
      field("Start Y", numberBox(item.y, 0, DESIGN_H, (v) => { item.y = v; commit(); })),
      field("End X", numberBox(item.x + item.w, 0, DESIGN_W, (v) => { item.w = v - item.x; commit(); })),
      field("End Y", numberBox(item.y + item.h, 0, DESIGN_H, (v) => { item.h = v - item.y; commit(); })),
    );
  } else {
    wrap.append(
      field("X", numberBox(item.x, -DESIGN_W, DESIGN_W, (v) => { item.x = v; commit(); })),
      field("Y", numberBox(item.y, -DESIGN_H, DESIGN_H, (v) => { item.y = v; commit(); })),
      field("W", numberBox(item.w, item.type === "text" ? DESIGN_TEXT_MIN_W : DESIGN_MIN_SIZE, DESIGN_W * 2, (v) => { item.w = v; commit(); })),
      field("H", numberBox(item.h, item.type === "text" ? DESIGN_TEXT_MIN_H : DESIGN_MIN_SIZE, DESIGN_H * 2, (v) => { item.h = v; commit(); })),
    );
  }
  return field("Geometry", wrap);
}

function numberBox(value, min, max, onchange, step = 1) {
  const input = el("input", { class: "input", type: "number", value, min, max, step });
  input.onchange = (e) => onchange(Number(e.target.value));
  return input;
}

function designSaveSection() {
  const sec = el("div", { class: "insp-section" });
  const secBody = el("div", { class: "insp-sec-body", style: "padding-top:12px" });
  const nameInput = el("input", { class: "input", value: "", placeholder: "asset name, e.g. cta-button", autocomplete: "off" });
  const save = el("button", { class: "btn btn-primary", style: "justify-content:center" }, [icon("save", 13), "Save to media pool"]);
  save.onclick = async () => {
    if (designItems.length === 0) {
      toast("the canvas is empty", "err");
      return;
    }
    const name = nameInput.value.trim() || `design-${Date.now().toString(36)}`;
    save.disabled = true;
    try {
      state = await api("/api/assets/svg", { name, svg: designToSvgString() });
      render();
      toast(`"${name}" saved to the media pool`);
      nameInput.value = "";
    } catch (err) {
      toast(`save failed - ${err.message}`, "err");
    }
    save.disabled = false;
  };
  secBody.append(
    field("Save as asset", nameInput, "assets/design/"),
    save,
    el("div", { class: "sb-note" }, [
      "Saved SVGs appear in the media pool and every image slot picker.",
    ]),
  );
  sec.appendChild(secBody);
  return sec;
}

function designToSvgString() {
  const svg = svgEl("svg", {
    xmlns: SVG_NS,
    viewBox: `0 0 ${DESIGN_W} ${DESIGN_H}`,
    width: DESIGN_W,
    height: DESIGN_H,
  });
  const defs = svgEl("defs");
  svg.append(defs);
  for (const item of designItems) svg.appendChild(designItemNode(item, defs, false));
  return new XMLSerializer().serializeToString(svg);
}

function designBindKeys() {
  if (designKeysBound) return;
  designKeysBound = true;
  document.addEventListener("keydown", (e) => {
    if (activePage !== "design") return;
    const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName);
    if (typing) return;
    const key = e.key.toLowerCase();
    const toolMap = { v: "select", r: "rect", e: "ellipse", l: "line", t: "text" };
    if (toolMap[key]) {
      e.preventDefault();
      designTool = toolMap[key];
      renderDesignPage();
    } else if ((e.key === "Delete" || e.key === "Backspace") && designSelectedId) {
      e.preventDefault();
      designItems = designItems.filter((i) => i.id !== designSelectedId);
      designSelectedId = null;
      designPersist();
      renderDesignPage();
    } else if (e.key === "Escape") {
      designTool = "select";
      designSelectedId = null;
      renderDesignPage();
    }
  });
}

function num(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
