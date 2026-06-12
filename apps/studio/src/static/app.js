/* Sequences studio frontend. Vanilla JS on purpose (Phase 1):
 * every interaction is a typed command POSTed to /api/command — the same
 * operations agents emit over MCP. No state lives here except selection;
 * the server's state JSON is the truth.
 *
 * Layout: DaVinci/AE-style shell — viewport + transport + multi-track
 * timeline on the left, inspector (Scene/Layers/Brand/Media) + agent chat
 * on the right, VS Code-style status bar (lint, events.log, build) below. */

let state = null; // /api/state payload
let meta = null; // /api/meta payload
let selectedSceneId = null;
let selectedLayerId = null;
let inspectorTab = "scene"; // scene | layers | brand | media
let lastBuildVersion = -1;
let renderPoll = null;
let agentPoll = null;
let thumbsPoll = null;
let lastRenderError = null;
let lastAgentError = null;
let dragMode = false;
let safeMode = false;
let chatLog = []; // session-only agent transcript
let player = null;
let activeProjectDir = null;

const $ = (id) => document.getElementById(id);

/* ---------- icons (inline SVG, lucide-style) ---------- */

const ICONS = {
  play: '<path d="M7 4.5v15l13-7.5z" fill="currentColor" stroke="none"/>',
  pause:
    '<rect x="6" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none"/><rect x="14" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
  chev: '<path d="m6 9 6 6 6-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  trash:
    '<path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>',
  check: '<path d="m5 13 4 4L19 7"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  film: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 5v14M17 5v14M3 12h4M17 12h4M3 8.5h4M17 8.5h4M3 15.5h4M17 15.5h4"/>',
  text: '<path d="M5 7V5h14v2M12 5v14M9 19h6"/>',
  cursor: '<path d="m4 3 7.5 18 2.2-7.4L21 11z"/>',
  pen: '<path d="m17 3 4 4L8 20l-5 1 1-5z"/><path d="m14 6 4 4"/>',
  eraser: '<path d="m7 21-4-4L14 6a2.8 2.8 0 0 1 4 0l1 1a2.8 2.8 0 0 1 0 4L9 21z"/><path d="M12 18h9"/>',
  circle: '<circle cx="12" cy="12" r="8"/>',
  diamond: '<path d="m12 3 9 9-9 9-9-9z"/>',
  arrow: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
  line: '<path d="M5 19 19 5"/>',
  image:
    '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m21 16-4.5-4.5L7 21"/>',
  device: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M9 21h6M12 17v4"/>',
  shape: '<rect x="4" y="4" width="16" height="16" rx="3"/>',
  camera: '<path d="m16.5 9.5 5-3v11l-5-3"/><rect x="2.5" y="6" width="14" height="12" rx="2.5"/>',
  sparkle:
    '<path d="M12 3l1.9 5.6L19.5 10.5l-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9zM19 3.5v3M20.5 5h-3" stroke-linejoin="round"/>',
  send: '<path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" stroke-linejoin="round"/>',
  safe: '<path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3"/>',
  move: '<path d="m5 9-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20"/>',
  wand: '<path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8 19 13M17.8 6.2 19 5M12.2 6.2 11 5M3 21l9-9"/>',
  zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" stroke-linejoin="round"/>',
  dot: '<circle cx="12" cy="12" r="4" fill="currentColor" stroke="none"/>',
  alert: '<path d="M12 3 2 21h20zM12 10v5M12 18.5v.01"/>',
  layers: '<path d="M12 2 2 7l10 5 10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  terminal: '<path d="m4 17 6-6-6-6M12 19h8"/>',
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  folder:
    '<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H10l2 2h6.5A2.5 2.5 0 0 1 21 9.5v7A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5z"/>',
};

function icon(name, size = 15) {
  const span = document.createElement("span");
  span.style.display = "inline-grid";
  span.style.placeItems = "center";
  span.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">${ICONS[name] ?? ICONS.dot}</svg>`;
  return span;
}

const LAYER_ICON = { text: "text", image: "image", device: "device", shape: "shape", number: "zap" };
const ARCH_ICON = {
  "hook-opener": "zap",
  "feature-reveal": "device",
  "stat-callout": "zap",
  "ui-walkthrough": "image",
  "social-proof": "layers",
  "logo-sting-cta": "sparkle",
};

/* ---------- tiny dom helpers ---------- */

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith("on")) node[k] = v;
    else if (k === "value") node.value = v;
    else node.setAttribute(k, v);
  }
  for (const child of children) node.append(child);
  return node;
}

function field(labelText, control, hint) {
  const label = el("div", { class: "field-label" }, [labelText]);
  if (hint) label.append(el("span", { class: "hint" }, [hint]));
  return el("div", { class: "field" }, [label, control]);
}

function selectInput(options, current, onchange, labels) {
  const node = el("select", { class: "input", onchange: (e) => onchange(e.target.value) });
  options.forEach((opt, i) => {
    const option = el("option", { value: opt }, [labels ? labels[i] : opt]);
    if (opt === current) option.selected = true;
    node.appendChild(option);
  });
  return node;
}

/* ---------- toast ---------- */

function toast(message, kind = "ok") {
  const wrap = $("toastWrap");
  const node = el("div", { class: `toast ${kind === "err" ? "err" : ""}` }, []);
  node.append(el("span", { class: "ti" }, [icon(kind === "err" ? "alert" : "wand", 13)]), message);
  wrap.appendChild(node);
  while (wrap.children.length > 2) wrap.firstChild.remove();
  setTimeout(() => node.remove(), kind === "err" ? 5200 : 3200);
}

/* ---------- api ---------- */

async function api(path, body) {
  const res = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) {
    const msg = (json.errors || []).map((e) => `${e.path}: ${e.message}`).join(" · ");
    throw new Error(msg || `HTTP ${res.status}`);
  }
  return json;
}

async function sendCommand(command) {
  try {
    state = await api("/api/command", { command, source: "user" });
    render();
    return true;
  } catch (err) {
    toast(`rejected — ${err.message}`, "err");
    render(); // reset any optimistic input values
    return false;
  }
}

function adoptState(nextState) {
  const changedProject = activeProjectDir !== null && nextState.projectDir !== activeProjectDir;
  state = nextState;
  if (changedProject) {
    selectedSceneId = state.project.scenes[0]?.id ?? null;
    selectedLayerId = null;
    lastBuildVersion = -1;
    lastRenderError = null;
    lastAgentError = null;
    chatLog = [];
    closeMenus();
    closeModal();
    clearTimeout(renderPoll);
    clearTimeout(agentPoll);
    clearTimeout(thumbsPoll);
    resetPagesForProject(); // pages.js — drop page-local editing state
  }
  activeProjectDir = state.projectDir;
}

async function switchProject(path, kind) {
  const endpoint =
    kind === "demo" ? "/api/project/demo" : kind === "new" ? "/api/project/new" : "/api/project/open";
  const nextState = await api(endpoint, path);
  adoptState(nextState);
  closeMenus();
  closeModal();
  hideLauncher(); // launcher.js — entering a project always lands in the workspace
  render();
  toast(`${state.project.meta.title} loaded`);
}

/* ---------- popup menus ---------- */

let openMenuEl = null;

function closeMenus() {
  if (openMenuEl) {
    openMenuEl.remove();
    openMenuEl = null;
  }
}

/** Attach a popup menu to an anchor (anchor must be position:relative-able). */
function openMenu(anchor, build, opts = {}) {
  if (openMenuEl && openMenuEl._anchor === anchor) {
    closeMenus();
    return;
  }
  closeMenus();
  const menu = el("div", { class: `menu ${opts.cls ?? ""}` });
  menu._anchor = anchor;
  build(menu);
  anchor.style.position = "relative";
  anchor.appendChild(menu);
  openMenuEl = menu;
}

document.addEventListener("pointerdown", (e) => {
  if (openMenuEl && !openMenuEl.contains(e.target) && !openMenuEl._anchor.contains(e.target)) closeMenus();
});

function menuOption({ name, desc, selected, onpick }) {
  const opt = el("div", { class: `menu-opt ${selected ? "sel" : ""}` });
  const main = el("div", { class: "mo-main" }, [el("div", { class: "mo-name" }, [name])]);
  if (desc) main.append(el("div", { class: "mo-desc" }, [desc]));
  opt.append(main);
  if (selected) opt.append(el("span", { class: "mo-check" }, [icon("check", 14)]));
  opt.onclick = () => {
    closeMenus();
    onpick();
  };
  return opt;
}

function menuSep() {
  return el("div", { class: "menu-sep" });
}

function projectModal(mode) {
  closeModal();
  closeMenus();

  const isNew = mode === "new";
  const pathInput = el("input", {
    class: "input mono",
    value: "",
    placeholder: isNew ? "C:\\dev\\Coding\\Sequences\\projects\\my-project" : "C:\\path\\to\\project",
    autocomplete: "off",
  });
  const nameInput = el("input", {
    class: "input",
    value: isNew ? "Untitled Promo" : "",
    placeholder: "Project name",
    autocomplete: "off",
  });
  const showcase = el("input", { type: "checkbox" });
  const body = el("div", { class: "modal-body" }, [
    el("div", { class: "modal-form" }, [
      field("Project folder", pathInput),
      ...(isNew
        ? [
            field("Name", nameInput),
            el("label", { class: "check-row" }, [showcase, "Use showcase timeline"]),
          ]
        : []),
    ]),
  ]);

  const primary = el("button", { class: "btn btn-primary" }, [icon(isNew ? "plus" : "folder", 13), isNew ? "Create" : "Open"]);
  primary.onclick = async () => {
    primary.disabled = true;
    try {
      await switchProject(
        isNew
          ? { dir: pathInput.value, name: nameInput.value, showcase: showcase.checked }
          : { dir: pathInput.value },
        isNew ? "new" : "open",
      );
    } catch (err) {
      toast(`${isNew ? "create" : "open"} failed — ${err.message}`, "err");
      primary.disabled = false;
    }
  };
  const cancel = el("button", { class: "btn btn-ghost" }, ["Cancel"]);
  cancel.onclick = closeModal;

  const modal = el("div", { class: "modal" }, [
    el("div", { class: "modal-head" }, [
      el("span", { class: "mh-ico" }, [icon(isNew ? "plus" : "folder", 15)]),
      el("div", {}, [
        el("div", { class: "mh-title" }, [isNew ? "New project" : "Open project"]),
        el("div", { class: "mh-sub mono" }, [state.projectDir]),
      ]),
    ]),
    body,
    el("div", { class: "modal-foot" }, [
      primary,
      el("span", { class: "spacer" }),
      cancel,
    ]),
  ]);
  const backdrop = el("div", { id: "modalBackdrop" }, [modal]);
  backdrop.onclick = (e) => {
    if (e.target === backdrop) closeModal();
  };
  document.body.appendChild(backdrop);
  pathInput.focus();
}

function openProjectMenu() {
  const btn = $("projectMenuBtn");
  openMenu(
    btn,
    (menu) => {
      menu.classList.add("left", "project-menu");
      menu.appendChild(
        menuOption({
          name: "New Project...",
          desc: "Create a local project folder",
          onpick: () => projectModal("new"),
        }),
      );
      menu.appendChild(
        menuOption({
          name: "Open Project...",
          desc: "Load an existing project.json",
          onpick: () => projectModal("open"),
        }),
      );
      if (meta.demoProjectDir) {
        menu.appendChild(
          menuOption({
            name: "Open Pulse Demo",
            desc: meta.demoProjectDir,
            selected: state.projectDir === meta.demoProjectDir,
            onpick: () => switchProject({}, "demo").catch((err) => toast(`demo failed — ${err.message}`, "err")),
          }),
        );
      }
      menu.appendChild(menuSep());
      menu.appendChild(
        menuOption({
          name: "Copy Project Path",
          desc: state.projectDir,
          onpick: async () => {
            try {
              await navigator.clipboard.writeText(state.projectDir);
              toast("project path copied");
            } catch {
              toast("copy failed — select the path in the status bar", "err");
            }
          },
        }),
      );
    },
    { cls: "left" },
  );
}

/* ---------- player + transport ---------- */

function fps() {
  return state.manifest.fps || 30;
}

function refreshPlayer() {
  if (state.buildVersion === lastBuildVersion) return;
  lastBuildVersion = state.buildVersion;
  const host = $("playerHost");
  const prev = host.querySelector("hyperframes-player");
  const keepTime = prev && prev.ready ? prev.currentTime : 0;
  const wasPlaying = prev && prev.ready ? !prev.paused : false;
  host.innerHTML = "";
  player = document.createElement("hyperframes-player");
  player.setAttribute("src", `/build/index.html?v=${state.buildVersion}`);
  player.setAttribute("width", String(state.manifest.width));
  player.setAttribute("height", String(state.manifest.height));
  player.style.width = "100%";
  player.style.height = "100%";
  player.addEventListener("ready", () => {
    player.seek(keepTime > 0 && keepTime < player.duration ? keepTime : 0);
    if (wasPlaying) player.play();
  });
  host.appendChild(player);
}

function playerTime() {
  if (!player || !player.ready) return 0;
  return player.currentTime || 0;
}

function seekSec(t) {
  if (!player || !player.ready) return;
  const dur = player.duration || state.manifest.durationSec;
  player.seek(Math.max(0, Math.min(t, Math.max(0, dur - 0.001))));
}

function seekFrame(f) {
  seekSec(f / fps());
}

function togglePlay() {
  if (!player || !player.ready) return;
  if (player.paused) player.play();
  else player.pause();
}

function timecode(frame) {
  const f = Math.max(0, Math.round(frame));
  const total = Math.floor(f / fps());
  const mm = String(Math.floor(total / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  const ff = String(f % fps()).padStart(2, "0");
  return `${mm}:${ss}<span class="sep">:</span>${ff}`;
}

let lastPlayingIcon = null;

function transportTick() {
  if (state && player) {
    const t = playerTime();
    const frame = Math.round(t * fps());
    const total = state.manifest.durationFrames || 1;
    $("timecode").innerHTML = timecode(frame);
    $("frameLabel").textContent = `${frame}f / ${total}f`;
    const fraction = Math.max(0, Math.min(1, frame / total));
    $("scrubFill").style.width = `${fraction * 100}%`;
    $("scrubKnob").style.left = `${fraction * 100}%`;
    const playing = player.ready && !player.paused;
    if (playing !== lastPlayingIcon) {
      lastPlayingIcon = playing;
      const btn = $("playBtn");
      btn.innerHTML = "";
      btn.append(icon(playing ? "pause" : "play", 15));
    }
    const playhead = $("tlPlayhead");
    if (playhead) {
      const lane = document.querySelector("#tlContent .tl-lane");
      if (lane) {
        const gutter = lane.offsetLeft;
        playhead.style.left = `${gutter + fraction * lane.offsetWidth}px`;
      }
    }
  }
  requestAnimationFrame(transportTick);
}

function initTransport() {
  $("playBtn").append(icon("play", 15));
  $("playBtn").onclick = togglePlay;

  const scrub = $("scrub");
  scrub.onpointerdown = (e) => {
    scrub.setPointerCapture(e.pointerId);
    const move = (ev) => {
      const rect = scrub.getBoundingClientRect();
      const fraction = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
      seekSec(fraction * (state.manifest.durationSec || 0));
    };
    move(e);
    scrub.onpointermove = move;
    scrub.onpointerup = () => {
      scrub.onpointermove = null;
      scrub.onpointerup = null;
    };
  };

  $("safeBtn").append(icon("safe", 15));
  $("safeBtn").onclick = () => {
    safeMode = !safeMode;
    $("safeBtn").classList.toggle("on", safeMode);
    renderOverlays();
  };
  $("dragToggle").append(icon("move", 15));
  $("dragToggle").onclick = () => {
    dragMode = !dragMode;
    $("dragToggle").classList.toggle("on", dragMode);
    renderOverlays();
  };
}

/* ---------- stage overlays (safe guides + drag positioning) ---------- */

/** The player letterboxes the stage centered in its box; mirror that. */
function stageRect() {
  const wrap = $("previewWrap");
  const host = $("playerHost");
  const stageW = state.manifest.width;
  const stageH = state.manifest.height;
  const scale = Math.min(host.clientWidth / stageW, host.clientHeight / stageH);
  const w = stageW * scale;
  const h = stageH * scale;
  return {
    left: host.offsetLeft + (host.clientWidth - w) / 2,
    top: host.offsetTop + (host.clientHeight - h) / 2,
    width: w,
    height: h,
    scale,
  };
}

function renderOverlays() {
  const wrap = $("previewWrap");
  for (const node of wrap.querySelectorAll(".stage-overlay")) node.remove();
  if (!state) return;
  const rect = stageRect();
  const place = (node) => {
    node.style.left = `${rect.left}px`;
    node.style.top = `${rect.top}px`;
    node.style.width = `${rect.width}px`;
    node.style.height = `${rect.height}px`;
    wrap.appendChild(node);
  };

  if (safeMode) {
    const safe = el("div", { class: "stage-overlay", id: "safeOverlay" });
    safe.append(el("div", { class: "safe-rect" }), el("div", { class: "safe-tag" }, ["title safe · 5%"]));
    place(safe);
  }

  if (dragMode) {
    const manifestScene = state.manifest.scenes.find((s) => s.id === selectedSceneId);
    if (!manifestScene) return;
    const overlay = el("div", { class: "stage-overlay", id: "dragOverlay" });
    const stageW = state.manifest.width;
    const stageH = state.manifest.height;
    for (const layer of manifestScene.layers) {
      const box = el("div", { class: "dragBox", title: `${layer.id} — drag to reposition` }, [layer.id]);
      box.style.left = `${layer.box.x * rect.scale}px`;
      box.style.top = `${layer.box.y * rect.scale}px`;
      box.style.width = `${layer.box.w * rect.scale}px`;
      box.style.height = `${layer.box.h * rect.scale}px`;
      box.onpointerdown = (e) => {
        e.preventDefault();
        box.setPointerCapture(e.pointerId);
        box.classList.add("dragging");
        const startX = e.clientX;
        const startY = e.clientY;
        const origX = layer.box.x;
        const origY = layer.box.y;
        let nextX = origX;
        let nextY = origY;
        box.onpointermove = (ev) => {
          if (!box.classList.contains("dragging")) return;
          // Stage-space delta, clamped to the canvas, snapped to the 2px
          // lattice the grid-snap lint rule enforces.
          nextX = Math.round((origX + (ev.clientX - startX) / rect.scale) / 2) * 2;
          nextY = Math.round((origY + (ev.clientY - startY) / rect.scale) / 2) * 2;
          nextX = Math.min(Math.max(nextX, 0), stageW - layer.box.w);
          nextY = Math.min(Math.max(nextY, 0), stageH - layer.box.h);
          box.style.left = `${nextX * rect.scale}px`;
          box.style.top = `${nextY * rect.scale}px`;
        };
        box.onpointerup = () => {
          box.classList.remove("dragging");
          box.onpointermove = null;
          box.onpointerup = null;
          if (nextX !== origX || nextY !== origY) {
            sendCommand({
              type: "OverrideLayerBox",
              sceneId: selectedSceneId,
              layerId: layer.id,
              box: { x: nextX, y: nextY },
            });
          }
        };
      };
      overlay.appendChild(box);
    }
    place(overlay);
  }
}

/* ---------- timeline ---------- */

function clipClass(kind) {
  return { text: "clip-text", image: "clip-image", device: "clip-device", shape: "clip-shape" }[kind] ?? "clip-shape";
}

const MOTION_COLORS = { enter: "#7c9fc4", exit: "#c4937c", continuous: "#8aa885" };

function motionChip(label, phase) {
  const chip = el("span", { class: "tl-mot" });
  chip.append(el("span", { class: "mk", style: `background:${MOTION_COLORS[phase] ?? "#999"}` }), label);
  return chip;
}

function renderTimeline() {
  const content = $("tlContent");
  content.innerHTML = "";
  const total = state.manifest.durationFrames || 1;
  const thumbs = (state.thumbs && state.thumbs.files) || {};

  const gutterCell = (iconName, label, indent) =>
    el("div", { class: "tl-gutter", style: indent ? "padding-left:22px" : "" }, [
      el("span", { class: "gi" }, [icon(iconName, 13)]),
      el("span", { class: "g-label" }, [label]),
    ]);

  // ruler (click/drag to seek)
  const rulerLane = el("div", { class: "tl-lane" });
  const ruler = el("div", { class: "tl-row", id: "tlRuler" }, [el("div", { class: "tl-gutter" }), rulerLane]);
  content.appendChild(ruler);
  const seconds = Math.ceil(total / fps());
  for (let s = 0; s <= seconds; s++) {
    const major = s % 5 === 0;
    const tick = el("div", { class: `tl-tick ${major ? "major" : ""}` }, [major ? `${s}s` : ""]);
    tick.style.left = `${((s * fps()) / total) * 100}%`;
    rulerLane.appendChild(tick);
  }
  rulerLane.onpointerdown = (e) => {
    rulerLane.setPointerCapture(e.pointerId);
    const move = (ev) => {
      const rect = rulerLane.getBoundingClientRect();
      const fraction = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
      seekFrame(fraction * total);
    };
    move(e);
    rulerLane.onpointermove = move;
    rulerLane.onpointerup = () => {
      rulerLane.onpointermove = null;
      rulerLane.onpointerup = null;
    };
  };

  // scenes track
  const scenesLane = el("div", { class: "tl-lane" });
  content.appendChild(
    el("div", { class: "tl-row tl-scenes" }, [gutterCell("film", "Scenes"), scenesLane]),
  );
  state.manifest.scenes.forEach((scene, idx) => {
    const block = el("div", {
      class: `tl-scene ${scene.id === selectedSceneId ? "sel" : ""}`,
      title: `${scene.id} — ${scene.archetype}${scene.transitionAfter ? ` → ${scene.transitionAfter}` : ""}`,
    });
    block.style.left = `${(scene.startFrame / total) * 100}%`;
    block.style.width = `calc(${(scene.durationFrames / total) * 100}% - 3px)`;
    if (thumbs[scene.id]) {
      block.classList.add("thumbed");
      block.style.backgroundImage = `url("${thumbs[scene.id]}?v=${state.thumbs.version}")`;
    }
    const body = el("div", { class: "tl-scene-body" }, [
      el("span", { class: "tl-scene-ico" }, [icon(ARCH_ICON[scene.archetype] ?? "film", 13)]),
      el("div", { class: "tl-scene-meta" }, [
        el("div", { class: "tl-scene-name" }, [`${idx + 1} · ${scene.archetype}`]),
        el("div", { class: "tl-scene-dur mono" }, [
          `${(scene.durationFrames / fps()).toFixed(1)}s · ${scene.durationFrames}f` +
            (scene.camera ? ` · ⤢${scene.camera.move}` : "") +
            (scene.transitionAfter && scene.transitionAfter !== "cut" ? ` · →${scene.transitionAfter}` : ""),
        ]),
      ]),
    ]);
    block.append(el("div", { class: "tl-scene-top" }), body);
    wireSceneBlock(block, scene, idx, scenesLane, total);
    scenesLane.appendChild(block);
  });

  // layer lanes for the selected scene
  const manifestScene = state.manifest.scenes.find((s) => s.id === selectedSceneId);
  if (manifestScene) {
    manifestScene.layers.forEach((layer, i) => {
      const lane = el("div", { class: "tl-lane" });
      const row = el("div", { class: `tl-row tl-lane-row ${i % 2 ? "alt" : ""}` }, [
        gutterCell(LAYER_ICON[layer.kind] ?? "shape", layer.id, true),
        lane,
      ]);
      const clip = el("div", {
        class: `tl-clip ${clipClass(layer.kind)} ${layer.id === selectedLayerId ? "sel" : ""}`,
        title: `${layer.label} · rank ${layer.rank}`,
      });
      clip.style.left = `${(manifestScene.startFrame / total) * 100}%`;
      clip.style.width = `calc(${(manifestScene.durationFrames / total) * 100}% - 3px)`;
      clip.append(el("span", { class: "tl-clip-label" }, [layer.label || layer.id]));
      if (layer.enter) {
        clip.append(
          motionChip(
            `${layer.enter.primitive.split(".")[1]} @${layer.enter.startFrame - manifestScene.startFrame}f`,
            "enter",
          ),
        );
      }
      if (layer.exit) clip.append(motionChip(layer.exit.primitive.split(".")[1], "exit"));
      if (layer.continuous) clip.append(motionChip(layer.continuous.primitive.split(".")[1], "continuous"));
      clip.onclick = () => {
        selectedLayerId = layer.id;
        inspectorTab = "layers";
        render();
      };
      lane.appendChild(clip);
      content.appendChild(row);
    });

    // camera lane
    if (manifestScene.camera) {
      const lane = el("div", { class: "tl-lane" });
      const clip = el("div", { class: "tl-clip clip-camera", title: "scene-level camera move" });
      clip.style.left = `${(manifestScene.startFrame / total) * 100}%`;
      clip.style.width = `calc(${(manifestScene.durationFrames / total) * 100}% - 3px)`;
      clip.append(
        el("span", { class: "tl-clip-label" }, [
          `cam.${manifestScene.camera.move} · ${manifestScene.camera.scale}`,
        ]),
      );
      content.appendChild(
        el("div", { class: "tl-row tl-lane-row" }, [gutterCell("camera", "Camera", true), lane]),
      );
      lane.appendChild(clip);
    }
  }

  // playhead (positioned by the transport loop)
  content.appendChild(el("div", { id: "tlPlayhead" }));

  $("durationLabel").innerHTML =
    `${state.manifest.scenes.length} scenes · ` +
    `<span class="mono">${state.manifest.durationFrames}f · ${state.manifest.durationSec}s @ ${fps()}fps</span>`;

  const thumbsState = state.thumbs || { status: "idle" };
  $("thumbsBtn").disabled = thumbsState.status === "generating";
  $("thumbsStatus").textContent =
    thumbsState.status === "generating" ? "capturing…" : thumbsState.status === "failed" ? "thumbs failed" : "";
  if (thumbsState.status === "failed" && thumbsState.error) $("thumbsStatus").title = thumbsState.error;
}

/** Scene block interactions: click = select, drag body = reorder,
 * drag right edge = duration. Both commit ONE command on release. */
function wireSceneBlock(block, scene, idx, lane, totalFrames) {
  const handle = el("div", { class: "tl-scene-handle", title: "drag to change duration" });
  block.appendChild(handle);

  handle.onpointerdown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    handle.setPointerCapture(e.pointerId);
    block.classList.add("resizing");
    const pxPerFrame = lane.clientWidth / totalFrames;
    const startX = e.clientX;
    const archetypeMeta = meta.archetypes.find((a) => a.id === scene.archetype);
    const min = archetypeMeta ? archetypeMeta.duration.min : 15;
    const max = archetypeMeta ? archetypeMeta.duration.max : 1800;
    let next = scene.durationFrames;
    const durLabel = block.querySelector(".tl-scene-dur");
    handle.onpointermove = (ev) => {
      next = Math.max(min, Math.min(max, scene.durationFrames + Math.round((ev.clientX - startX) / pxPerFrame)));
      block.style.width = `${next * pxPerFrame}px`;
      if (durLabel) durLabel.textContent = `${(next / fps()).toFixed(1)}s · ${next}f`;
    };
    handle.onpointerup = () => {
      handle.onpointermove = null;
      handle.onpointerup = null;
      block.classList.remove("resizing");
      if (next !== scene.durationFrames) {
        sendCommand({ type: "SetSceneDuration", sceneId: scene.id, durationFrames: next });
      } else {
        renderTimeline();
      }
    };
  };

  block.onpointerdown = (e) => {
    if (e.target === handle) return;
    block.setPointerCapture(e.pointerId);
    const startX = e.clientX;
    let dragging = false;
    let indicator = null;
    let toIndex = idx;
    const blocks = [...lane.querySelectorAll(".tl-scene")];

    block.onpointermove = (ev) => {
      const dx = ev.clientX - startX;
      if (!dragging && Math.abs(dx) > 5) {
        dragging = true;
        block.classList.add("lifting");
        indicator = el("div", { class: "tl-drop-indicator" });
        lane.appendChild(indicator);
      }
      if (!dragging) return;
      block.style.transform = `translateX(${dx}px)`;
      // insertion position = count of OTHER blocks whose midpoint is left of
      // the pointer — exactly ReorderScene's splice-out-then-insert index.
      toIndex = 0;
      for (const other of blocks) {
        if (other === block) continue;
        const r = other.getBoundingClientRect();
        if (ev.clientX > r.left + r.width / 2) toIndex++;
      }
      const edges = blocks.filter((b) => b !== block);
      let x;
      if (toIndex === 0) x = edges.length ? edges[0].offsetLeft : 0;
      else {
        const prev = edges[toIndex - 1];
        x = prev.offsetLeft + prev.offsetWidth + 1;
      }
      indicator.style.left = `${x}px`;
    };
    block.onpointerup = () => {
      block.onpointermove = null;
      block.onpointerup = null;
      block.style.transform = "";
      block.classList.remove("lifting");
      if (indicator) indicator.remove();
      if (!dragging) {
        selectedSceneId = scene.id;
        selectedLayerId = null;
        render();
      } else if (toIndex !== idx) {
        sendCommand({ type: "ReorderScene", sceneId: scene.id, toIndex });
      }
    };
  };
}

/* ---------- inspector ---------- */

const TABS = [
  ["scene", "Scene"],
  ["layers", "Layers"],
  ["brand", "Brand"],
  ["media", "Media"],
];

function renderInspectorTabs() {
  const host = $("inspectorTabs");
  host.innerHTML = "";
  for (const [id, label] of TABS) {
    const tab = el("button", { class: `tab ${inspectorTab === id ? "on" : ""}` }, [label]);
    tab.onclick = () => {
      inspectorTab = id;
      render();
    };
    host.appendChild(tab);
  }
  $("inspectorSub").textContent = inspectorTab === "scene" || inspectorTab === "layers" ? (selectedSceneId ?? "") : "";
}

function section(title, bodyNodes, tag) {
  const head = el("div", { class: "insp-sec-head" }, [el("span", { class: "t" }, [title])]);
  if (tag) head.append(el("span", { class: "x" }, [tag]));
  return el("div", { class: "insp-section" }, [head, el("div", { class: "insp-sec-body" }, bodyNodes)]);
}

function renderInspector() {
  renderInspectorTabs();
  const host = $("inspectorBody");
  const keepScroll = host.scrollTop;
  host.innerHTML = "";
  if (inspectorTab === "scene") renderSceneTab(host);
  else if (inspectorTab === "layers") renderLayersTab(host);
  else if (inspectorTab === "brand") renderBrandTab(host);
  else renderMediaTab(host);
  host.scrollTop = keepScroll;
}

/* ----- scene tab ----- */

function slotEditors(scene, archetypeMeta) {
  const nodes = [];
  for (const [slotName, spec] of Object.entries(archetypeMeta.slots)) {
    const value = scene.slots[slotName];
    if (spec.kind === "text") {
      const input = el("input", {
        class: "input",
        value: value ?? "",
        placeholder: spec.required ? "(required)" : "(optional)",
        onchange: (e) =>
          sendCommand({
            type: "SetSlotContent",
            sceneId: scene.id,
            slot: slotName,
            value: e.target.value === "" ? null : e.target.value,
          }),
      });
      nodes.push(field(slotName, input, spec.maxWords ? `≤${spec.maxWords} words` : undefined));
    } else if (spec.kind === "textList") {
      const area = el("textarea", {
        class: "input",
        rows: 3,
        placeholder: "one per line",
        onchange: (e) => {
          const items = e.target.value.split("\n").map((s) => s.trim()).filter(Boolean);
          sendCommand({
            type: "SetSlotContent",
            sceneId: scene.id,
            slot: slotName,
            value: items.length ? items.slice(0, spec.maxItems || 6) : null,
          });
        },
      });
      area.value = Array.isArray(value) ? value.join("\n") : "";
      nodes.push(field(slotName, area, spec.maxItems ? `≤${spec.maxItems} items` : undefined));
    } else if (spec.kind === "number") {
      const wrap = el("div", { style: "display:flex;gap:6px" });
      const num = el("input", { class: "input", type: "number", value: value ? value.value : 0 });
      const suffix = el("input", {
        class: "input",
        value: value ? (value.suffix ?? "") : "",
        placeholder: "suffix",
        style: "flex:0 0 76px",
      });
      const commit = () =>
        sendCommand({
          type: "SetSlotContent",
          sceneId: scene.id,
          slot: slotName,
          value: { value: Number(num.value) || 0, prefix: "", suffix: suffix.value },
        });
      num.onchange = commit;
      suffix.onchange = commit;
      wrap.append(num, suffix);
      nodes.push(field(slotName, wrap));
    } else if (spec.kind === "media") {
      const assets = state.project.assets.filter((a) => a.kind === "image");
      const current = value ? value.assetId : "";
      const node = selectInput(
        ["", ...assets.map((a) => a.id)],
        current,
        (assetId) =>
          sendCommand({
            type: "SetSlotContent",
            sceneId: scene.id,
            slot: slotName,
            value: assetId === "" ? null : { assetId },
          }),
        ["(none)", ...assets.map((a) => a.id)],
      );
      nodes.push(field(slotName, node, "media pool"));
    }
  }
  return nodes;
}

function renderSceneTab(host) {
  const scene = state.project.scenes.find((s) => s.id === selectedSceneId);
  if (!scene) {
    host.append(el("div", { class: "insp-empty" }, ["Select a scene in the timeline."]));
    return;
  }
  const sceneIndex = state.project.scenes.findIndex((s) => s.id === scene.id);
  const archetypeMeta = meta.archetypes.find((a) => a.id === scene.archetype);

  const durationInput = el("input", {
    class: "input",
    type: "number",
    value: scene.durationFrames,
    onchange: (e) =>
      sendCommand({
        type: "SetSceneDuration",
        sceneId: scene.id,
        durationFrames: Number(e.target.value) || scene.durationFrames,
      }),
  });

  host.append(
    section(
      `Scene · ${scene.archetype}`,
      [
        el("div", { class: "row2" }, [
          field(
            "Layout",
            selectInput(archetypeMeta.layouts, scene.layout || archetypeMeta.defaultLayout, (layout) =>
              sendCommand({ type: "SetSceneLayout", sceneId: scene.id, layout }),
            ),
          ),
          field("Duration", durationInput, `${archetypeMeta.duration.min}–${archetypeMeta.duration.max}f`),
        ]),
        el("div", { class: "row2" }, [
          field(
            "Transition after",
            selectInput(
              ["(profile)", ...meta.transitions],
              state.project.transitions[scene.id] ?? "(profile)",
              (kind) =>
                sendCommand({
                  type: "SetTransition",
                  afterSceneId: scene.id,
                  kind: kind === "(profile)" ? null : kind,
                }),
            ),
          ),
          field(
            "Stagger",
            selectInput(
              ["(profile)", ...meta.staggerTokens],
              scene.choreography.stagger ?? "(profile)",
              (token) =>
                sendCommand({
                  type: "SetChoreography",
                  sceneId: scene.id,
                  choreography: token === "(profile)" ? {} : { stagger: token },
                }),
            ),
          ),
        ]),
      ],
      `${sceneIndex + 1} of ${state.project.scenes.length}`,
    ),
  );

  // camera
  const camera = scene.camera ?? null;
  const cameraNodes = [
    field(
      "Move",
      selectInput(
        ["(none)", ...meta.cameraMoves.map((m) => m.id)],
        camera ? camera.move : "(none)",
        (move) =>
          sendCommand({
            type: "SetSceneCamera",
            sceneId: scene.id,
            camera: move === "(none)" ? null : { move, scale: camera ? camera.scale : "subtle" },
          }),
      ),
    ),
  ];
  if (camera) {
    const pick = el("div", { class: "token-pick" });
    for (const token of meta.scaleTokens) {
      const pill = el("button", { class: `token-pill ${camera.scale === token ? "on" : ""}` }, [token]);
      pill.onclick = () =>
        sendCommand({ type: "SetSceneCamera", sceneId: scene.id, camera: { move: camera.move, scale: token } });
      pick.appendChild(pill);
    }
    cameraNodes.push(field("Scale token", pick));
  }
  host.append(section("Camera", cameraNodes, "stage transform"));

  // content slots
  host.append(section("Content", slotEditors(scene, archetypeMeta), `${scene.id}`));

  // scene actions
  const moveLeft = el("button", { class: "btn-sm" }, [icon("undo", 12), "Move earlier"]);
  moveLeft.disabled = sceneIndex === 0;
  moveLeft.onclick = () => sendCommand({ type: "ReorderScene", sceneId: scene.id, toIndex: sceneIndex - 1 });
  const moveRight = el("button", { class: "btn-sm" }, ["Move later", icon("redo", 12)]);
  moveRight.disabled = sceneIndex === state.project.scenes.length - 1;
  moveRight.onclick = () => sendCommand({ type: "ReorderScene", sceneId: scene.id, toIndex: sceneIndex + 1 });
  const remove = el("button", { class: "btn-sm danger", style: "margin-left:auto" }, [icon("trash", 12), "Remove"]);
  remove.disabled = state.project.scenes.length <= 1;
  remove.onclick = () => sendCommand({ type: "RemoveScene", sceneId: scene.id });
  host.append(section("Arrange", [el("div", { class: "btn-row" }, [moveLeft, moveRight, remove])]));
}

/* ----- layers tab ----- */

function renderLayersTab(host) {
  const manifestScene = state.manifest.scenes.find((s) => s.id === selectedSceneId);
  const scene = state.project.scenes.find((s) => s.id === selectedSceneId);
  if (!manifestScene || !scene) {
    host.append(el("div", { class: "insp-empty" }, ["Select a scene in the timeline."]));
    return;
  }
  const enterPrimitives = meta.primitives.filter((p) => p.kind === "enter").map((p) => p.id);
  const body = el("div", { class: "insp-sec-body", style: "padding-top:12px" });

  for (const layer of manifestScene.layers) {
    const override = scene.overrides[layer.id] || {};
    const card = el("div", { class: `layer-card ${layer.id === selectedLayerId ? "sel" : ""}` });
    const head = el("div", { class: "layer-card-head" }, [
      el("span", { class: `layer-card-ico ${clipClass(layer.kind)}` }, [icon(LAYER_ICON[layer.kind] ?? "shape", 14)]),
      el("div", { class: "layer-card-meta" }, [
        el("div", { class: "nm" }, [layer.id]),
        el("div", { class: "ty" }, [
          `${layer.kind} · rank ${layer.rank} · ${layer.role}` +
            (layer.enter
              ? ` · enters @${layer.enter.startFrame - manifestScene.startFrame}f for ${layer.enter.durationFrames}f`
              : " · static"),
        ]),
      ]),
    ]);
    head.onclick = () => {
      selectedLayerId = layer.id === selectedLayerId ? null : layer.id;
      render();
    };
    card.appendChild(head);

    if (layer.enter) {
      const cardBody = el("div", { class: "layer-card-body" });
      cardBody.append(
        field(
          "Enter primitive",
          selectInput(enterPrimitives, layer.enter.primitive, (primitive) =>
            sendCommand({ type: "SwapMotion", sceneId: scene.id, layerId: layer.id, phase: "enter", primitive }),
          ),
        ),
      );

      // duration token pills — "(profile)" means no override
      const pick = el("div", { class: "token-pick" });
      const profilePill = el("button", { class: `token-pill ${override.enterDuration ? "" : "on"}` }, ["profile"]);
      profilePill.onclick = () => {
        if (!override.enterDuration) return;
        const rest = { ...override };
        delete rest.enterDuration;
        const commands = [{ type: "SetLayerOverride", sceneId: scene.id, layerId: layer.id, patch: null }];
        if (Object.keys(rest).length > 0) {
          commands.push({ type: "SetLayerOverride", sceneId: scene.id, layerId: layer.id, patch: rest });
        }
        sendCommand(commands.length === 1 ? commands[0] : { type: "Batch", commands });
      };
      pick.appendChild(profilePill);
      for (const token of meta.durationTokens) {
        const pill = el("button", { class: `token-pill ${override.enterDuration === token ? "on" : ""}` }, [token]);
        pill.onclick = () =>
          sendCommand({
            type: "SetLayerOverride",
            sceneId: scene.id,
            layerId: layer.id,
            patch: { enterDuration: token },
          });
        pick.appendChild(pill);
      }
      cardBody.append(field("Enter duration", pick, "token"));

      if (Object.keys(override).length > 0) {
        const reset = el("button", { class: "btn-sm", title: "Clear all overrides on this layer (undoable)" }, [
          icon("undo", 12),
          "Reset overrides",
        ]);
        reset.onclick = () =>
          sendCommand({ type: "SetLayerOverride", sceneId: scene.id, layerId: layer.id, patch: null });
        cardBody.append(el("div", { class: "btn-row" }, [reset]));
      }
      card.appendChild(cardBody);
    }
    body.appendChild(card);
  }

  const hint = el("div", { class: "media-note" }, [
    "Tip: toggle ",
    el("b", {}, ["position mode"]),
    " (✥ in the transport bar) to drag layers directly on the canvas — drops snap to the grid.",
  ]);
  body.appendChild(hint);
  host.append(el("div", { class: "insp-section" }, [body]));
}

/* ----- brand tab ----- */

function renderBrandTab(host) {
  const brand = state.project.brand;

  const grid = el("div", { class: "brand-grid" });
  for (const [key, value] of Object.entries(brand.colors)) {
    const tok = el("div", { class: "brand-tok", title: `change ${key}` }, [
      el("span", { class: "sw", style: `background:${value}` }),
      el("div", {}, [el("div", { class: "bt-name" }, [key]), el("div", { class: "bt-hex" }, [value])]),
    ]);
    const input = el("input", {
      type: "color",
      value,
      onchange: (e) => sendCommand({ type: "SetBrandColor", key, value: e.target.value }),
    });
    tok.appendChild(input);
    grid.appendChild(tok);
  }
  host.append(
    section(`Brand kit · ${brand.name}`, [
      grid,
      field(
        "Display font",
        el("input", {
          class: "input",
          value: brand.fonts.display,
          onchange: (e) => sendCommand({ type: "SetBrandFont", key: "display", value: e.target.value }),
        }),
      ),
    ]),
  );

  // motion profile
  const list = el("div", { style: "display:flex;flex-direction:column;gap:7px" });
  for (const profile of meta.profiles) {
    const on = profile.id === state.project.motionProfile;
    const opt = el("div", { class: `profile-opt ${on ? "on" : ""}` }, [
      el("div", { class: "po-meta" }, [
        el("div", { class: "po-name" }, [profile.id]),
        el("div", { class: "po-desc" }, [profile.summary]),
      ]),
    ]);
    if (on) opt.append(el("span", { class: "po-check" }, [icon("check", 15)]));
    opt.onclick = () => sendCommand({ type: "SetMotionProfile", profile: profile.id });
    list.appendChild(opt);
  }
  host.append(section("Motion profile", [list], "selection bias"));

  host.append(
    section("Composition", [
      el("div", { class: "row2" }, [
        field("Format", el("div", { class: "input", style: "display:flex;align-items:center" }, [
          `${state.project.meta.width} × ${state.project.meta.height}`,
        ])),
        field("Frame rate", el("div", { class: "input mono", style: "display:flex;align-items:center" }, [
          `${fps()} fps`,
        ])),
      ]),
    ]),
  );
}

/* ----- media tab ----- */

function assetHref(asset) {
  // serve straight from the project assets dir (bin subfolders included)
  return `/${asset.path.replace(/\\/g, "/")}`;
}

function renderMediaTab(host) {
  const assets = state.project.assets;
  const usedBy = {};
  for (const scene of state.project.scenes) {
    for (const value of Object.values(scene.slots)) {
      if (value && typeof value === "object" && "assetId" in value) {
        (usedBy[value.assetId] ??= []).push(scene.id);
      }
    }
  }

  const nodes = [];
  if (assets.length === 0) {
    nodes.push(el("div", { class: "insp-empty" }, ["No assets in this project yet."]));
  } else {
    const grid = el("div", { class: "media-grid" });
    for (const asset of assets) {
      const thumb = el("div", { class: "media-thumb" });
      if (asset.kind === "image") {
        thumb.append(el("img", { src: assetHref(asset), alt: asset.id, loading: "lazy" }));
      } else {
        thumb.append(icon(asset.kind === "audio" ? "music" : "film", 22));
      }
      const used = usedBy[asset.id];
      grid.appendChild(
        el("div", { class: "media-card", title: asset.path }, [
          thumb,
          el("div", { class: "media-meta" }, [
            el("div", { class: "mm-id" }, [asset.id]),
            el("div", { class: "mm-info" }, [`${asset.kind} · ${used ? `used in ${used.join(", ")}` : "unused"}`]),
          ]),
        ]),
      );
    }
    nodes.push(grid);
  }
  const mediaPageLink = el("b", { style: "cursor:pointer;color:var(--silver-hi)" }, ["Media page"]);
  mediaPageLink.onclick = () => setPage("media");
  nodes.push(
    el("div", { class: "media-note" }, [
      "This is the pool at a glance — import, preview, and organize on the ",
      mediaPageLink,
      " (drag files straight into it from disk).",
    ]),
  );
  host.append(el("div", { class: "insp-section" }, [el("div", { class: "insp-sec-body", style: "padding-top:12px" }, nodes)]));
}

/* ---------- agent panel ---------- */

function currentProviderId() {
  const providers = meta.agentProviders || [];
  const stored = localStorage.getItem("seq.agent.provider");
  return (providers.some((p) => p.id === stored) && stored) || meta.defaultAgentProvider || providers[0]?.id;
}

function providerInfo(id) {
  return (meta.agentProviders || []).find((p) => p.id === id);
}

function providerUsable(info) {
  if (!info) return false;
  if (info.available) return true;
  return info.kind === "api" && !!localStorage.getItem(`seq.agent.key.${info.id}`);
}

const AGENT_MODEL_PRESETS = {
  "codex-cli": [
    { id: "gpt-5.5", label: "GPT-5.5", desc: "Recommended for Codex" },
    { id: "gpt-5.4", label: "GPT-5.4", desc: "Strong general Codex work" },
    { id: "gpt-5.4-mini", label: "GPT-5.4 Mini", desc: "Faster, higher-usage coding" },
    { id: "gpt-5.3-codex", label: "GPT-5.3 Codex", desc: "Codex-specialized" },
    { id: "gpt-5.3-codex-spark", label: "GPT-5.3 Codex Spark", desc: "Fast Pro preview, when available" },
    { id: "gpt-5.2-codex", label: "GPT-5.2 Codex", desc: "Legacy / API-key workflows" },
    { id: "gpt-5.1-codex-max", label: "GPT-5.1 Codex Max", desc: "Legacy frontier Codex" },
    { id: "gpt-5.1-codex", label: "GPT-5.1 Codex", desc: "Legacy Codex" },
    { id: "gpt-5.1", label: "GPT-5.1", desc: "Legacy general GPT-5.1" },
  ],
  "claude-code-cli": [
    { id: "claude-fable-5", label: "Fable 5", desc: "Latest Claude Code model" },
    { id: "claude-opus-4-8", label: "Opus 4.8", desc: "Highest-capability Claude 4.x" },
    { id: "claude-opus-4-7", label: "Opus 4.7", desc: "Prior Opus" },
    { id: "claude-opus-4-6", label: "Opus 4.6", desc: "Prior Opus" },
    { id: "claude-sonnet-4-6", label: "Sonnet 4.6", desc: "Balanced Claude" },
  ],
  "openai-api": [
    { id: "gpt-5.5", label: "GPT-5.5", desc: "Latest capable model, if enabled" },
    { id: "gpt-5.4", label: "GPT-5.4", desc: "Strong general model" },
    { id: "gpt-5.4-mini", label: "GPT-5.4 Mini", desc: "Fast, efficient model" },
    { id: "gpt-5.1", label: "GPT-5.1", desc: "Broad compatibility" },
    { id: "gpt-5.1-mini", label: "GPT-5.1 Mini", desc: "Fast broad compatibility" },
  ],
  "anthropic-api": [
    { id: "claude-fable-5", label: "Fable 5", desc: "Latest Claude family" },
    { id: "claude-opus-4-8", label: "Opus 4.8", desc: "Highest-capability Claude 4.x" },
    { id: "claude-opus-4-7", label: "Opus 4.7", desc: "Prior Opus" },
    { id: "claude-opus-4-6", label: "Opus 4.6", desc: "Prior Opus" },
    { id: "claude-sonnet-4-6", label: "Sonnet 4.6", desc: "Balanced Claude" },
  ],
};

const THINKING_MODES = {
  auto: "Auto",
  low: "Low",
  medium: "Medium",
  high: "High",
  xhigh: "XHigh",
  max: "Max",
};

function agentModelKey(providerId) {
  return `seq.agent.model.${providerId}`;
}

function agentThinkingKey(providerId) {
  return `seq.agent.thinking.${providerId}`;
}

function currentAgentModel(providerId) {
  if (!providerId) return "";
  return localStorage.getItem(agentModelKey(providerId)) || modelPresetIds(providerId)[0] || "";
}

function currentThinkingMode(providerId) {
  const value = providerId ? localStorage.getItem(agentThinkingKey(providerId)) || "auto" : "auto";
  return Object.prototype.hasOwnProperty.call(THINKING_MODES, value) ? value : "auto";
}

function thinkingOptionsForProvider(providerId) {
  return providerId === "codex-cli" || providerId?.includes("claude") || providerId === "anthropic-api"
    ? ["auto", "low", "medium", "high", "xhigh", "max"]
    : ["auto", "low", "medium", "high"];
}

function modelPresetIds(providerId) {
  return (AGENT_MODEL_PRESETS[providerId] || []).map((preset) => preset.id);
}

function modelPreset(providerId, modelId) {
  return (AGENT_MODEL_PRESETS[providerId] || []).find((preset) => preset.id === modelId);
}

function modelLabel(providerId, modelId) {
  return modelPreset(providerId, modelId)?.label || modelId;
}

function providerChipLabel(info, providerId) {
  if (!info) return providerId ?? "none";
  return info.label.replace(" (ChatGPT login)", "").replace(" (subscription login)", "").replace(" (key)", "");
}

function renderAgentModelChip(info) {
  const providerId = info?.id ?? currentProviderId();
  const chip = $("modelChip");
  if (!chip) return;
  const model = currentAgentModel(providerId);
  const thinking = currentThinkingMode(providerId);
  chip.innerHTML = "";
  chip.append(
    icon("gear", 12),
    el("span", { class: "am-model", title: model }, [modelLabel(providerId, model)]),
    el("span", { class: "am-thinking" }, [THINKING_MODES[thinking]]),
    icon("chev", 11),
  );
  chip.onclick = () =>
    openMenu(chip, (menu) => {
      menu.classList.add("left", "up", "agent-model-menu");
      menu.append(el("div", { class: "menu-label" }, ["Model"]));
      for (const preset of AGENT_MODEL_PRESETS[providerId] || []) {
        menu.appendChild(
          menuOption({
            name: preset.label,
            desc: `${preset.desc} · ${preset.id}`,
            selected: model === preset.id,
            onpick: () => {
              localStorage.setItem(agentModelKey(providerId), preset.id);
              renderAgent();
            },
          }),
        );
      }
      menu.appendChild(
        menuOption({
          name: "Custom model...",
          desc: "Enter an exact model id or CLI alias",
          selected: model && !modelPresetIds(providerId).includes(model),
          onpick: () => {
            const next = prompt("Model id or alias", model || "");
            if (next === null) return;
            const cleaned = next.trim();
            if (cleaned) localStorage.setItem(agentModelKey(providerId), cleaned);
            else localStorage.removeItem(agentModelKey(providerId));
            renderAgent();
          },
        }),
      );
      menu.appendChild(menuSep());
      menu.append(el("div", { class: "menu-label" }, ["Thinking"]));
      for (const mode of thinkingOptionsForProvider(providerId)) {
        menu.appendChild(
          menuOption({
            name: THINKING_MODES[mode],
            selected: thinking === mode,
            onpick: () => {
              if (mode === "auto") localStorage.removeItem(agentThinkingKey(providerId));
              else localStorage.setItem(agentThinkingKey(providerId), mode);
              renderAgent();
            },
          }),
        );
      }
    });
}

function agentMessage(text, opts = {}) {
  const who = el("div", { class: `who ${opts.failed ? "failed" : ""}` }, [
    el("span", { class: "av" }, [opts.spinner ? el("span", { class: "spin" }) : icon(opts.failed ? "alert" : "sparkle", 11)]),
    opts.label ?? "Sequences Agent",
  ]);
  const body = el("div", { class: "body-txt" });
  body.innerHTML = text;
  return el("div", { class: "msg msg-agent" }, [who, body]);
}

function renderAgent() {
  const providers = meta.agentProviders || [];
  const agentState = state.agent || { status: "idle" };
  const current = currentProviderId();
  const info = providerInfo(current);

  $("agentProviderSub").textContent = providerUsable(info) ? "ready" : "setup";

  const body = $("agentBody");
  body.innerHTML = "";

  // intro / capability hint
  if (chatLog.length === 0) {
    body.append(
      agentMessage(
        "Describe the video below and I'll plan it — scenes, copy, motion and camera — applied as <b>one undoable batch</b> through the same command API you're using." +
          (providers.some((p) => p.kind === "cli" && p.available)
            ? " Using your local CLI sign-in, <b>no API key needed</b>."
            : providers.some((p) => providerUsable(p))
              ? ""
              : " <b>No provider detected</b> — open setup in the header to connect one."),
      ),
    );
  }

  for (const entry of chatLog) {
    if (entry.kind === "user") {
      body.append(el("div", { class: "msg msg-user" }, [el("div", { class: "bubble" }, [entry.text])]));
    } else {
      body.append(agentMessage(entry.html, { failed: entry.failed, spinner: entry.spinner, label: entry.label }));
    }
  }

  // live planning status (covers reloads mid-plan)
  if (agentState.status === "planning" && !chatLog.some((e) => e.spinner)) {
    body.append(
      agentMessage(`Planning with <b>${agentState.provider}</b>… CLI providers can take a minute.`, {
        spinner: true,
        label: "planning",
      }),
    );
  }

  body.scrollTop = body.scrollHeight;

  // provider chip in the panel header
  const chip = $("providerChip");
  chip.innerHTML = "";
  chip.append(el("span", { class: `prov-dot ${providerUsable(info) ? "ok" : "no"}` }), providerChipLabel(info, current), icon("chev", 11));
  chip.onclick = () =>
    openMenu(chip, (menu) => {
      for (const p of providers) {
        menu.appendChild(
          menuOption({
            name: `${providerUsable(p) ? "●" : "○"} ${p.label}`,
            desc: p.detail,
            selected: p.id === current,
            onpick: () => {
              localStorage.setItem("seq.agent.provider", p.id);
              renderAgent();
            },
          }),
        );
      }
      const setup = menuOption({ name: "Setup & detection…", desc: "install CLIs, paste keys, re-scan", onpick: openAgentSetup });
      menu.appendChild(setup);
    });

  const setupBtn = $("agentSetupBtn");
  if (setupBtn && !setupBtn.hasChildNodes()) setupBtn.append(icon("terminal", 13));
  if (setupBtn) setupBtn.onclick = openAgentSetup;

  renderAgentModelChip(info);

  // plan button + spark
  const spark = $("agentSpark");
  if (!spark.hasChildNodes()) spark.append(icon("sparkle", 14));
  const planBtn = $("planBtn");
  if (!planBtn.hasChildNodes()) planBtn.append(icon("send", 15));
  planBtn.disabled = agentState.status === "planning" || !providerUsable(info);
  $("composerHint").textContent =
    agentState.status === "planning"
      ? `planning with ${agentState.provider}…`
      : "";

  if (agentState.status !== "planning") $("composerHint").textContent = "";

  if (agentState.status === "failed" && agentState.error && agentState.error !== lastAgentError) {
    lastAgentError = agentState.error;
    chatLog = chatLog.filter((e) => !e.spinner);
    chatLog.push({ kind: "agent", html: `Plan failed — ${escapeHtml(agentState.error)}`, failed: true, label: "failed" });
    renderAgent();
    return;
  }
  if (agentState.status !== "failed") lastAgentError = null;
}

function escapeHtml(text) {
  return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function startPlan() {
  const brief = ($("agentBrief").value || "").trim();
  if (!brief) {
    toast("write a brief first", "err");
    return;
  }
  const providerId = currentProviderId();
  const info = providerInfo(providerId);
  if (!providerUsable(info)) {
    openAgentSetup();
    return;
  }
  const key = localStorage.getItem(`seq.agent.key.${providerId}`) || "";
  const model = currentAgentModel(providerId);
  const thinkingMode = currentThinkingMode(providerId);
  chatLog.push({ kind: "user", text: brief });
  chatLog.push({ kind: "agent", html: `Planning with <b>${providerId}</b>… CLI providers can take a minute.`, spinner: true, label: "planning" });
  $("agentBrief").value = "";
  sessionStorage.setItem("seq.agent.brief", "");
  try {
    state.agent = await api("/api/agent/plan", {
      brief,
      provider: providerId,
      ...(key ? { apiKey: key } : {}),
      ...(model ? { model } : {}),
      ...(thinkingMode !== "auto" ? { thinkingMode } : {}),
    });
    renderAgent();
    pollAgent();
  } catch (err) {
    chatLog = chatLog.filter((e) => !e.spinner);
    chatLog.push({ kind: "agent", html: `Plan failed — ${escapeHtml(err.message)}`, failed: true, label: "failed" });
    renderAgent();
  }
}

function pollAgent() {
  clearTimeout(agentPoll);
  if (!state.agent || state.agent.status !== "planning") return;
  agentPoll = setTimeout(async () => {
    try {
      const agent = await api("/api/agent");
      if (agent.status === "planning") {
        state.agent = agent;
        pollAgent();
      } else {
        state = await api("/api/state"); // pick up the new scenes + build
        if (agent.status === "complete") {
          chatLog = chatLog.filter((e) => !e.spinner);
          chatLog.push({
            kind: "agent",
            html: `Done — <b>${escapeHtml(agent.summary ?? "plan applied")}</b>. Everything is one batch: <b>Ctrl+Z</b> reverts it all.`,
          });
        }
        render();
      }
    } catch (err) {
      toast(`agent status failed: ${err.message}`, "err");
    }
  }, 1500);
}

/* ---------- agent setup modal ---------- */

const PROVIDER_GUIDES = {
  "claude-code-cli": {
    blurb: "Uses your Claude subscription through the Claude Code CLI — no API key.",
    steps: [
      { label: "1 · install (needs Node.js)", cmd: "npm install -g @anthropic-ai/claude-code" },
      { label: "2 · sign in once, then re-scan", cmd: "claude" },
    ],
  },
  "codex-cli": {
    blurb: "Uses your ChatGPT subscription through the Codex CLI — no API key.",
    steps: [
      { label: "1 · install (needs Node.js)", cmd: "npm install -g @openai/codex" },
      { label: "2 · sign in once, then re-scan", cmd: "codex" },
    ],
  },
};

function closeModal() {
  const backdrop = $("modalBackdrop");
  if (backdrop) backdrop.remove();
}

function openAgentSetup() {
  closeModal();
  closeMenus();
  const body = el("div", { class: "modal-body" });

  body.append(
    el("div", { class: "modal-note" }, [
      "Sequences plans videos with an agent ",
      el("b", {}, ["brain"]),
      " of your choice. The easiest path needs ",
      el("b", {}, ["no API key"]),
      ": if you already use Claude Code or Codex in a terminal, Sequences reuses that sign-in. Detection scans your PATH on the machine running the studio.",
    ]),
  );

  for (const p of meta.agentProviders || []) {
    const usable = providerUsable(p);
    const card = el("div", { class: "prov-card" });
    const status = el("div", { class: `pc-status ${usable ? "ok" : ""}` }, [
      el("span", { class: `prov-dot ${usable ? "ok" : "no"}` }),
      usable ? "ready" : "not detected",
    ]);
    card.append(
      el("div", { class: "prov-card-head" }, [
        icon(p.kind === "cli" ? "terminal" : "zap", 15),
        el("span", { class: "pc-name" }, [p.label, el("small", {}, [p.id])]),
        status,
      ]),
    );
    const cardBody = el("div", { class: "prov-card-body" });
    cardBody.append(el("div", { class: "prov-detail" }, [p.detail ?? ""]));

    const guide = PROVIDER_GUIDES[p.id];
    if (guide && !p.available) {
      cardBody.append(el("div", { class: "prov-detail" }, [guide.blurb]));
      for (const step of guide.steps) {
        const code = el("code", {}, [step.cmd]);
        const copy = el("button", { class: "mini-btn cmd-copy", title: "copy" }, [icon("copy", 13)]);
        copy.onclick = async () => {
          try {
            await navigator.clipboard.writeText(step.cmd);
            copy.innerHTML = "";
            copy.append(icon("check", 13));
            setTimeout(() => {
              copy.innerHTML = "";
              copy.append(icon("copy", 13));
            }, 1200);
          } catch {
            toast("copy failed — select the text instead", "err");
          }
        };
        cardBody.append(el("div", { class: "step-label" }, [step.label]), el("div", { class: "cmd-line" }, [code, copy]));
      }
    }

    if (p.kind === "api") {
      const keyName = `seq.agent.key.${p.id}`;
      const input = el("input", {
        class: "input",
        type: "password",
        value: localStorage.getItem(keyName) || "",
        placeholder: `${p.apiKeyEnv ?? "API key"} — stored in this browser only`,
        autocomplete: "off",
        onchange: (e) => {
          if (e.target.value) localStorage.setItem(keyName, e.target.value);
          else localStorage.removeItem(keyName);
          renderAgent();
        },
      });
      cardBody.append(
        field("API key", input, "never persisted server-side"),
      );
    }
    card.append(cardBody);
    body.append(card);
  }

  const rescan = el("button", { class: "btn btn-primary" }, [icon("undo", 13), "Re-scan PATH"]);
  rescan.onclick = async () => {
    rescan.disabled = true;
    try {
      meta = await api("/api/meta");
      openAgentSetup(); // rebuild with fresh detection
      renderAgent();
      toast("provider detection refreshed");
    } catch (err) {
      toast(`re-scan failed: ${err.message}`, "err");
      rescan.disabled = false;
    }
  };
  const close = el("button", { class: "btn btn-ghost" }, ["Close"]);
  close.onclick = closeModal;

  const modal = el("div", { class: "modal" }, [
    el("div", { class: "modal-head" }, [
      el("span", { class: "mh-ico" }, [icon("terminal", 15)]),
      el("div", {}, [
        el("div", { class: "mh-title" }, ["Agent setup"]),
        el("div", { class: "mh-sub" }, ["connect a brain — local CLI (no key) or BYO API key"]),
      ]),
    ]),
    body,
    el("div", { class: "modal-foot" }, [
      rescan,
      el("span", { class: "modal-note" }, ["scans the studio machine's PATH"]),
      el("span", { class: "spacer" }),
      close,
    ]),
  ]);
  const backdrop = el("div", { id: "modalBackdrop" }, [modal]);
  backdrop.onclick = (e) => {
    if (e.target === backdrop) closeModal();
  };
  document.body.appendChild(backdrop);
}

/* ---------- status bar (lint, events, build) ---------- */

function renderStatusBar() {
  const findings = state.findings;
  const errors = findings.filter((f) => f.severity === "error").length;
  const fixable = findings.filter((f) => f.fix).length;

  const chip = $("lintChip");
  chip.innerHTML = "";
  chip.append(
    el("span", { class: `status-dot ${errors ? "bad" : findings.length ? "warn" : "good"}` }),
    el("span", { class: "lc-label" }, ["Linter"]),
    el("span", { class: "mono" }, [
      findings.length === 0
        ? "clean"
        : `${findings.length} finding${findings.length > 1 ? "s" : ""}${fixable ? ` · ${fixable} auto-fixable` : ""}`,
    ]),
  );
  chip.onclick = toggleLintPop;

  const pathNode = $("projectPath");
  pathNode.title = state.projectFile || state.projectDir;
  pathNode.innerHTML = "";
  pathNode.append(el("span", { class: "mono" }, [state.projectFile || state.projectDir]));

  $("solverInfo").textContent = `solver · ${state.manifest.scenes.length} scenes scheduled`;

  const events = $("eventsChip");
  events.innerHTML = "";
  events.append(el("span", { class: "mono" }, [`events.log · ${state.eventCount} ops`]));
  events.onclick = toggleEventsPop;

  $("buildInfo").textContent = `build v${state.buildVersion} · ${state.manifest.durationSec}s @ ${fps()}fps`;

  // keep popovers live if open
  if (!$("lintPop").classList.contains("hidden")) renderLintPop();
  if (!$("eventsPop").classList.contains("hidden")) renderEventsPop();
}

function toggleLintPop() {
  $("eventsPop").classList.add("hidden");
  const pop = $("lintPop");
  pop.classList.toggle("hidden");
  if (!pop.classList.contains("hidden")) renderLintPop();
}

function toggleEventsPop() {
  $("lintPop").classList.add("hidden");
  const pop = $("eventsPop");
  pop.classList.toggle("hidden");
  if (!pop.classList.contains("hidden")) renderEventsPop();
}

function renderLintPop() {
  const pop = $("lintPop");
  pop.innerHTML = "";
  const findings = state.findings;
  const head = el("div", { class: "lint-pop-head" }, [
    icon(findings.length ? "alert" : "check", 15),
    el("span", { class: "t" }, ["Motion linter ", el("small", {}, ["· deterministic · zero-token"])]),
  ]);
  const closeBtn = el("button", { class: "mini-btn", style: "margin-left:auto" }, [icon("x", 13)]);
  closeBtn.onclick = () => pop.classList.add("hidden");
  head.append(closeBtn);
  pop.append(head);

  const list = el("div", { class: "lint-list" });
  if (findings.length === 0) {
    list.append(
      el("div", { class: "lint-item pass" }, [
        el("span", { class: "li-ico" }, [icon("check", 12)]),
        el("div", {}, [el("div", { class: "li-name" }, ["all rules pass"]), el("div", { class: "li-msg" }, ["compiled output is lint-clean"])]),
      ]),
    );
  }
  for (const f of findings) {
    const item = el("div", { class: `lint-item ${f.severity}` }, [
      el("span", { class: "li-ico" }, [icon(f.severity === "error" ? "x" : f.severity === "info" ? "dot" : "alert", 11)]),
      el("div", { style: "min-width:0" }, [
        el("div", { class: "li-name" }, [`${f.rule} · ${[f.sceneId, f.layerId].filter(Boolean).join("/") || "project"}`]),
        el("div", { class: "li-msg" }, [f.message]),
      ]),
    ]);
    if (f.fix) item.append(el("span", { class: "li-tag" }, ["fixable"]));
    list.append(item);
  }
  pop.append(list);

  const fix = el("button", { class: "btn-sm" }, [icon("wand", 12), "Auto-fix all"]);
  fix.disabled = !findings.some((f) => f.fix);
  fix.onclick = async () => {
    state = await api("/api/autofix", {});
    render();
    toast("auto-fixes applied — they're commands, Ctrl+Z reverts");
  };
  pop.append(
    el("div", { class: "lint-pop-foot" }, [
      fix,
      el("span", { class: "modal-note" }, ["fixes are journaled commands · undoable"]),
    ]),
  );
}

function renderEventsPop() {
  const pop = $("eventsPop");
  pop.innerHTML = "";
  const head = el("div", { class: "lint-pop-head" }, [
    icon("terminal", 14),
    el("span", { class: "t" }, ["events.log ", el("small", {}, [`· ${state.eventCount} ops · append-only journal`])]),
  ]);
  const closeBtn = el("button", { class: "mini-btn", style: "margin-left:auto" }, [icon("x", 13)]);
  closeBtn.onclick = () => pop.classList.add("hidden");
  head.append(closeBtn);
  pop.append(head);

  const list = el("div", { class: "lint-list" });
  for (const entry of state.recentEvents) {
    const cmd = entry.command;
    const detail =
      cmd.type === "Batch"
        ? `${cmd.commands.length} commands`
        : cmd.sceneId || cmd.afterSceneId || cmd.profile || cmd.key || "";
    list.append(
      el("div", { class: "event-item" }, [
        el("span", { class: "ev-seq" }, [`#${entry.seq}`]),
        el("span", { class: "ev-type" }, [entry.kind === "apply" ? cmd.type : `${entry.kind} ${cmd.type}`]),
        el("span", { class: "ev-detail" }, [String(detail)]),
        el("span", { class: `ev-src ${entry.source}` }, [entry.source]),
      ]),
    );
  }
  if (state.recentEvents.length === 0) {
    list.append(el("div", { class: "event-item" }, [el("span", { class: "ev-detail" }, ["no commands this session yet"])]));
  }
  pop.append(list);
}

/* ---------- topbar: profile, quality, render ---------- */

function renderTopbar() {
  $("projectTitle").innerHTML = `<b>${escapeHtml(state.project.meta.title)}</b> — ${escapeHtml(state.project.brand.name)}`;
  $("projectMenuBtn").innerHTML = "";
  $("projectMenuBtn").append("Project", icon("chev", 11));
  $("undoBtn").disabled = !state.canUndo;
  $("redoBtn").disabled = !state.canRedo;

  const profileChip = $("profileChip");
  profileChip.innerHTML = "";
  profileChip.append(el("b", {}, [state.project.motionProfile]), el("span", {}, ["profile"]), el("span", { class: "chev" }, [icon("chev", 12)]));
  profileChip.onclick = () =>
    openMenu(profileChip, (menu) => {
      for (const profile of meta.profiles) {
        menu.appendChild(
          menuOption({
            name: profile.id,
            desc: profile.summary,
            selected: profile.id === state.project.motionProfile,
            onpick: () => sendCommand({ type: "SetMotionProfile", profile: profile.id }),
          }),
        );
      }
    });

  const qualityChip = $("qualityChip");
  const quality = sessionStorage.getItem("seq.render.quality") || "standard";
  qualityChip.innerHTML = "";
  qualityChip.append(el("span", {}, [quality]), el("span", { class: "chev" }, [icon("chev", 12)]));
  qualityChip.onclick = () =>
    openMenu(qualityChip, (menu) => {
      for (const q of ["draft", "standard", "high"]) {
        menu.appendChild(
          menuOption({
            name: q,
            desc: { draft: "fast, 540p-ish — for checking motion", standard: "1080p, balanced", high: "1080p, best encode" }[q],
            selected: q === quality,
            onpick: () => {
              sessionStorage.setItem("seq.render.quality", q);
              renderTopbar();
            },
          }),
        );
      }
    });

  renderExport();
}

function renderExport() {
  const renderState = state.render || { status: "idle" };
  const btn = $("renderBtn");
  const status = $("renderStatus");
  const link = $("renderDownload");
  btn.disabled = renderState.status === "rendering";
  btn.innerHTML = "";
  btn.append(icon("film", 14), renderState.status === "rendering" ? "Rendering…" : "Render");
  link.style.display = "none";
  link.removeAttribute("href");
  status.className = "";

  if (renderState.status === "rendering") {
    status.textContent = `rendering ${renderState.quality} ${renderState.format ?? "mp4"}…`;
  } else if (renderState.status === "complete") {
    status.textContent = "✓";
    status.className = "ok";
    if (renderState.href) {
      link.href = renderState.href;
      link.download = renderState.outputName || "";
      link.textContent = renderState.outputName || "download";
      link.style.display = "inline";
    }
  } else if (renderState.status === "failed") {
    status.textContent = "render failed";
    status.className = "err";
    if (renderState.error && renderState.error !== lastRenderError) {
      lastRenderError = renderState.error;
      toast(renderState.error, "err");
    }
  } else {
    lastRenderError = null;
    status.textContent = "";
  }
}

function pollRender() {
  clearTimeout(renderPoll);
  if (!state.render || state.render.status !== "rendering") return;
  renderPoll = setTimeout(async () => {
    try {
      state.render = await api("/api/render");
      renderExport();
      renderActivePage(); // keep the Render page's status live
      pollRender();
    } catch (err) {
      toast(`render status failed: ${err.message}`, "err");
    }
  }, 1500);
}

function pollThumbs() {
  clearTimeout(thumbsPoll);
  if (!state.thumbs || state.thumbs.status !== "generating") return;
  thumbsPoll = setTimeout(async () => {
    try {
      const thumbs = await api("/api/thumbs");
      state.thumbs = thumbs;
      renderTimeline();
      if (thumbs.status === "generating") pollThumbs();
    } catch (err) {
      toast(`thumbs status failed: ${err.message}`, "err");
    }
  }, 1000);
}

/* ---------- add scene ---------- */

function nextSceneId(archetype) {
  const base = archetype.split("-")[0];
  let i = 1;
  while (state.project.scenes.some((s) => s.id === `${base}${i}`)) i++;
  return `${base}${i}`;
}

function defaultSlots(archetypeMeta) {
  const slots = {};
  for (const [name, spec] of Object.entries(archetypeMeta.slots)) {
    if (!spec.required) continue;
    if (spec.kind === "text") slots[name] = "Your copy here";
    else if (spec.kind === "textList") slots[name] = ["First point"];
    else if (spec.kind === "number") slots[name] = { value: 100, prefix: "", suffix: "+" };
    else if (spec.kind === "media") {
      const asset = state.project.assets.find((a) => a.kind === "image");
      if (!asset) return null; // caller surfaces the problem
      slots[name] = { assetId: asset.id };
    }
  }
  return slots;
}

function openAddSceneMenu() {
  const wrap = $("addSceneWrap");
  openMenu(
    wrap,
    (menu) => {
      menu.classList.add("left", "up");
      for (const a of meta.archetypes) {
        menu.appendChild(
          menuOption({
            name: a.id,
            desc: a.summary,
            onpick: async () => {
              const slots = defaultSlots(a);
              if (slots === null) {
                toast("this archetype needs an image asset — add one to the project's assets/ first", "err");
                return;
              }
              const id = nextSceneId(a.id);
              const ok = await sendCommand({
                type: "AddScene",
                scene: { id, archetype: a.id, durationFrames: a.duration.ideal, slots, choreography: {}, overrides: {} },
              });
              if (ok) {
                selectedSceneId = id;
                selectedLayerId = null;
                render();
              }
            },
          }),
        );
      }
    },
  );
}

/* ---------- root render ---------- */

function render() {
  if (!state.project.scenes.some((s) => s.id === selectedSceneId)) {
    selectedSceneId = state.project.scenes[0]?.id ?? null;
    selectedLayerId = null;
  }
  renderTopbar();
  renderTimeline();
  renderInspector();
  renderAgent();
  renderStatusBar();
  refreshPlayer();
  renderOverlays();
  renderActivePage(); // pages.js — refresh the active workspace page
}

/* ---------- init ---------- */

async function init() {
  meta = await api("/api/meta");
  adoptState(await api("/api/state"));
  initPages(); // pages.js — tab strip + page framework

  // topbar buttons
  $("projectMenuBtn").onclick = openProjectMenu;
  $("undoBtn").append(icon("undo", 16));
  $("redoBtn").append(icon("redo", 16));
  $("undoBtn").onclick = async () => {
    state = await api("/api/undo", {});
    render();
  };
  $("redoBtn").onclick = async () => {
    state = await api("/api/redo", {});
    render();
  };
  $("renderBtn").onclick = async () => {
    try {
      state.render = await api("/api/render", {
        format: "mp4",
        quality: sessionStorage.getItem("seq.render.quality") || "standard",
      });
      renderExport();
      pollRender();
    } catch (err) {
      toast(`render failed: ${err.message}`, "err");
    }
  };

  // timeline toolbar
  $("addSceneBtn").append(icon("plus", 14), "Scene");
  $("addSceneBtn").onclick = openAddSceneMenu;
  $("thumbsBtn").append(icon("image", 13), "Thumbs");
  $("thumbsBtn").onclick = async () => {
    try {
      state.thumbs = await api("/api/thumbs", {});
      renderTimeline();
      pollThumbs();
    } catch (err) {
      toast(`thumbs failed: ${err.message}`, "err");
    }
  };

  // transport
  initTransport();
  requestAnimationFrame(transportTick);

  // resizable panels (drag the edges; double-click resets)
  const refit = () => renderOverlays();
  $("agentPanel").appendChild(splitHandle({ edge: "right", cssVar: "--agent-w", min: 260, max: 560, onChange: refit }));
  $("right").appendChild(splitHandle({ edge: "left", cssVar: "--right-w", min: 260, max: 560, onChange: refit }));
  $("timelinePanel").appendChild(splitHandle({ edge: "top", cssVar: "--timeline-h", min: 140, max: 520, onChange: refit }));

  // agent composer
  const brief = $("agentBrief");
  brief.value = sessionStorage.getItem("seq.agent.brief") || "";
  brief.oninput = () => {
    sessionStorage.setItem("seq.agent.brief", brief.value);
    brief.style.height = "auto";
    brief.style.height = `${Math.min(brief.scrollHeight, 96)}px`;
  };
  brief.onkeydown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      startPlan();
    }
  };
  $("planBtn").onclick = startPlan;

  window.addEventListener("resize", () => {
    renderTimeline();
    renderOverlays();
  });

  document.addEventListener("keydown", (e) => {
    const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName);
    if (e.code === "Space" && !typing) {
      e.preventDefault();
      togglePlay();
    }
    if (!typing && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
      e.preventDefault();
      const step = (e.shiftKey ? 10 : 1) * (e.key === "ArrowLeft" ? -1 : 1);
      seekFrame(Math.round(playerTime() * fps()) + step);
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
      if (typing) return;
      e.preventDefault();
      $("undoBtn").click();
    }
    if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))) {
      if (typing) return;
      e.preventDefault();
      $("redoBtn").click();
    }
    if (e.key === "Escape") {
      closeMenus();
      closeModal();
      $("lintPop").classList.add("hidden");
      $("eventsPop").classList.add("hidden");
    }
  });

  pollRender();
  pollAgent();
  pollThumbs();
  render();

  // The Main Menu greets first (DaVinci-style); skip with ?workspace=1.
  if (!new URLSearchParams(location.search).has("workspace")) showLauncher();
}

init().catch((err) => {
  toast(`failed to load: ${err.message}`, "err");
  console.error(err);
});
