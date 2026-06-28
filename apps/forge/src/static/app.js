/* Forge front-end — a four-tab component workshop (Library · Stage · Create ·
 * Export) over the Forge server. Vanilla ES module, no bundler (mirrors the
 * engine's no-build rule). The chrome follows LINEAR_DESIGN.md.
 *
 * AI is intentionally NOT wired here — the agent panes are real UI (provider
 * selection, chat, media @-references) but generation lands in a later pass. */

const $ = (sel) => document.querySelector(sel);

const MIME_ASSET = "application/x-forge-asset-id";
const MIME_DOC = "application/x-forge-doc-id";
const MIME_OBJECT = "application/x-forge-object-id";

// Stage and Create share local CLIs plus API-backed providers. Models default
// to the first entry for each provider; Claude -> Opus, DeepSeek -> V4 Flash.
const AGENT_PROVIDER_IDS = [
  "claude-code-cli",
  "codex-cli",
  "antigravity-cli",
  "deepseek-api",
  "openmodel-api",
];
const AGENT_MODEL_PRESETS = {
  "claude-code-cli": [
    { id: "", label: "Default" },
    { id: "claude-opus-4-8", label: "Opus 4.8" },
    { id: "claude-sonnet-4-6", label: "Sonnet 4.6" },
  ],
  "codex-cli": [
    { id: "", label: "Default" },
    { id: "gpt-5.5", label: "GPT-5.5" },
    { id: "gpt-5.4", label: "GPT-5.4" },
    { id: "gpt-5.3-codex", label: "5.3 Codex" },
  ],
  "antigravity-cli": [
    { id: "", label: "Default" },
    { id: "Gemini 3.5 Flash (Medium)", label: "3.5 Flash (Medium)" },
  ],
  "deepseek-api": [
    { id: "deepseek-v4-flash", label: "V4 Flash" },
    { id: "deepseek-v4-pro", label: "V4 Pro" },
  ],
  "openmodel-api": [
    { id: "deepseek-v4-flash", label: "V4 Flash · free" },
    { id: "deepseek-v4-pro", label: "V4 Pro" },
  ],
};
// Effort levels are per-provider per the official CLIs: Codex is
// minimal|low|medium|high|xhigh; Claude Code is low|medium|high|xhigh|max.
const THINKING_BY_PROVIDER = {
  "claude-code-cli": ["low", "medium", "high", "xhigh", "max"],
  "codex-cli": ["minimal", "low", "medium", "high", "xhigh"],
  "antigravity-cli": ["auto"],
  "deepseek-api": ["auto", "minimal", "low", "medium", "high"],
  "openmodel-api": ["auto", "enabled"],
};
const DEFAULT_THINKING = "high";
const DEFAULT_THINKING_BY_PROVIDER = {
  "antigravity-cli": "auto",
  "deepseek-api": "auto",
  "openmodel-api": "auto",
};
const DEFAULT_PROVIDER = "claude-code-cli";

const state = {
  tab: "library",
  providers: [],
  providerId: null,
  // media
  assets: [],
  folders: [],
  bin: "",
  fsRoots: [],
  fsPath: null,
  preview: null,
  selectedAssetId: null,
  zoom: 1,
  // markdown reference docs (Library)
  docs: [],
  // create objects
  objects: [],
  activeObjectId: null,
  objectValues: {},
  objectMediaBindings: {},
  objectExtras: {},
  createInspTab: "inspector",
  createBin: "",
  createRatio: "16:9",
  createAspectLocked: false,
  drafts: [],
  currentDraft: null,
  activeDraftId: null,
  createBusy: false,
  createLoop: false,
  createPlayback: { playing: false, progress: 0 },
  executions: { stage: null, create: null },
  planning: {
    stage: { active: false, providerId: null, current: null },
    create: { active: false, providerId: null, current: null },
  },
  // chat — refs are structured references {kind:"asset"|"doc"|"scratch", id, label, thumb?}
  chat: { stage: [], create: [] },
  refs: { stage: [], create: [] },
  // the live Stage asset the agent is building
  stage: { asset: null, values: {}, mediaBindings: {}, contract: null, busy: false },
  // export
  exportId: null,
};

/* ─────────────────────── tiny DOM + util helpers ─────────────────────── */

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v === true) node.setAttribute(k, "");
    else node.setAttribute(k, v);
  }
  for (const child of [].concat(children)) {
    if (child == null || child === false) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

/* Assigning iframe.srcdoc reloads the frame, which paints a blank (white) frame
 * before the content repaints. Re-renders on tab switch would reflash even when
 * the content is identical, so skip the write when nothing changed. */
function setSrcDoc(frame, html) {
  if (!frame) return;
  if (frame.srcdoc === html) return;
  frame.srcdoc = html;
}

const ICONS = {
  folder: "M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  image: "M3 5h18v14H3zM3 15l5-5 4 4 3-3 6 6",
  film: "M3 4h18v16H3zM3 8h18M3 16h18M8 4v16M16 4v16",
  music: "M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM21 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z",
  plus: "M12 5v14M5 12h14",
  x: "M6 6l12 12M18 6L6 18",
  upload: "M12 16V4M7 9l5-5 5 5M4 20h16",
  undo: "M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3",
  code: "M8 9l-4 3 4 3M16 9l4 3-4 3M13 6l-2 12",
  wand: "M15 4V2M15 10V8M11 6H9M21 6h-2M18 9l-9 9-3-3 9-9zM18 9l3-3",
  layers: "M12 3l9 5-9 5-9-5zM3 13l9 5 9-5",
  send: "M22 2L11 13M22 2l-7 20-4-9-9-4z",
  refresh: "M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5",
  sliders: "M4 6h10M18 6h2M4 12h2M10 12h10M4 18h8M16 18h4M14 4v4M6 10v4M12 16v4",
  trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13",
  play: "M6 4l14 8-14 8z",
  pause: "M7 4h4v16H7zM13 4h4v16h-4z",
  repeat: "M17 1l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3",
  zoomIn: "M11 5a6 6 0 1 0 0 12 6 6 0 0 0 0-12zM11 8v6M8 11h6M20 20l-4.3-4.3",
  zoomOut: "M11 5a6 6 0 1 0 0 12 6 6 0 0 0 0-12zM8 11h6M20 20l-4.3-4.3",
  fit: "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5",
  pen: "M4 20l4-1 11-11-3-3L5 16zM14 5l3 3",
  spark: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z",
  arrowUp: "M12 19V5M5 12l7-7 7 7",
  stop: "M7 7h10v10H7z",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM5 20a7 7 0 0 1 14 0",
  ratio: "M6 3v15a1 1 0 0 0 1 1h15M3 6h15a1 1 0 0 1 1 1v15",
  brain: "M9 3a3 3 0 0 0-3 3 3 3 0 0 0-1 5 3 3 0 0 0 2 4 3 3 0 0 0 6 0V4a2 2 0 0 0-2-1z",
  cpu: "M6 6h12v12H6zM9 9h6v6H9M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3",
  key: "M15 7a4 4 0 1 0-3.2 6.4L4 21l-1-1 2-2-2-2 2-2-2-2 2-2 1.6 1.6A4 4 0 0 0 15 7zM15 7h.01",
};

function icon(name, size = 14) {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("class", "ico");
  svg.setAttribute("width", size);
  svg.setAttribute("height", size);
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.8");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  for (const d of (ICONS[name] ?? "").split("M").filter(Boolean)) {
    const path = document.createElementNS(ns, "path");
    path.setAttribute("d", `M${d}`);
    svg.append(path);
  }
  return svg;
}

function hydrateIcons(root = document) {
  for (const node of root.querySelectorAll("[data-ico]")) {
    if (node.dataset.hydrated) continue;
    node.dataset.hydrated = "1";
    node.prepend(icon(node.dataset.ico, 14));
  }
}

async function getJson(url, opts) {
  const res = await fetch(url, opts);
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    // Non-JSON body (e.g. a plain-text 404 from a stale server) — surface a
    // readable error instead of a cryptic JSON.parse failure.
    throw new Error(`${res.status} ${res.statusText}: ${text.slice(0, 140)}`.trim());
  }
}
function postJson(url, body) {
  return getJson(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body ?? {}) });
}

async function postEventStream(url, body, handlers = {}) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
    signal: handlers.signal,
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${(await res.text()).slice(0, 180)}`);
  if (!res.body) throw new Error("stream response had no body");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let event = "message";
  let data = [];
  let result = null;

  const dispatch = () => {
    if (!data.length) {
      event = "message";
      return;
    }
    let payload;
    try {
      payload = JSON.parse(data.join("\n"));
    } catch {
      payload = { raw: data.join("\n") };
    }
    if (event === "progress") handlers.progress?.(payload);
    else if (event === "result") {
      result = payload;
      handlers.result?.(payload);
    }
    event = "message";
    data = [];
  };
  const consume = (chunk) => {
    buffer += chunk;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (line === "") dispatch();
      else if (line.startsWith("event:")) event = line.slice("event:".length).trim();
      else if (line.startsWith("data:")) data.push(line.slice("data:".length).trimStart());
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    consume(decoder.decode(value, { stream: true }));
  }
  consume(decoder.decode());
  if (buffer.trim()) consume("\n");
  dispatch();
  return result ?? { ok: false, errors: ["stream ended without a result"] };
}

function fmtStreamBytes(n) {
  if (!Number.isFinite(n) || n <= 0) return "";
  return n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`;
}

/**
 * Fold an SSE progress event into a pending chat message. Thinking deltas
 * populate a live reasoning trace; output deltas drive the status line.
 */
function applyStreamProgress(pending, p, fallback) {
  if (p.phase === "thinking" && p.thinking) {
    pending.thinking = p.thinking;
    if (!pending.sawOutput) pending.text = "thinking…";
    return;
  }
  const bytes = fmtStreamBytes(p.bytes || 0);
  if (p.reply) {
    pending.sawOutput = true;
    pending.text = p.reply;
  } else if (p.message) {
    pending.text = `${p.message}${bytes ? ` - ${bytes}` : ""}`;
  } else if (bytes) {
    pending.sawOutput = true;
    pending.text = `receiving response - ${bytes}`;
  } else {
    pending.text = fallback;
  }
}

function toast(message, kind = "") {
  const host = $("#toastHost");
  const node = el("div", { class: `toast ${kind}`.trim() }, [message]);
  host.append(node);
  setTimeout(() => {
    node.style.opacity = "0";
    node.style.transform = "translateY(10px)";
    setTimeout(() => node.remove(), 220);
  }, 2600);
}

function boot(message) {
  $("#boot").textContent = message;
}

function fmtBytes(n) {
  if (!Number.isFinite(n)) return "";
  const units = ["B", "KB", "MB", "GB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v >= 100 || i === 0 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}

function slug(input) {
  return (
    String(input || "component")
      .trim()
      .replace(/([a-z])([A-Z])/g, "$1-$2")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "component"
  );
}

/* ─────────────────────── asset helpers ─────────────────────── */

function assetName(asset) {
  return String(asset.path || asset.id).replace(/\\/g, "/").split("/").pop();
}
function binOfAsset(asset) {
  const parts = String(asset.path).replace(/\\/g, "/").split("/");
  return parts.length > 2 ? parts.slice(1, -1).join("/") : "";
}
function binOfObject(object) {
  return String(object?.folder || "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
}
function assetTag(asset) {
  const bin = binOfAsset(asset) || "media";
  const base = assetName(asset).replace(/\.[^.]+$/, "").replace(/\s+/g, "_");
  return `@${bin}/${base}`;
}

/* ─────────────────────── tabs ─────────────────────── */

function setTab(tab) {
  state.tab = tab;
  for (const button of document.querySelectorAll(".tab")) button.classList.toggle("active", button.dataset.tab === tab);
  for (const view of document.querySelectorAll(".view")) view.classList.toggle("hidden", view.id !== `view-${tab}`);
  if (tab === "library") renderLibrary();
  if (tab === "stage") renderStage();
  if (tab === "create") renderCreate();
  if (tab === "export") renderExport();
}

/* ─────────────────────── providers + agent pane ─────────────────────── */

function modelKey(id) {
  return `forge.agent.model.${id}`;
}
function thinkingKey(id) {
  return `forge.agent.thinking.${id}`;
}
function currentModel(id) {
  const presets = AGENT_MODEL_PRESETS[id] || [];
  const stored = localStorage.getItem(modelKey(id));
  return (stored && presets.some((p) => p.id === stored) && stored) || presets[0]?.id || "";
}
function currentThinking(id) {
  const stored = localStorage.getItem(thinkingKey(id));
  const valid = THINKING_BY_PROVIDER[id] || [DEFAULT_THINKING];
  const fallback = DEFAULT_THINKING_BY_PROVIDER[id] || DEFAULT_THINKING;
  return stored && valid.includes(stored) ? stored : valid.includes(fallback) ? fallback : valid[0];
}
function providerInfo(id) {
  return state.providers.find((p) => p.id === id);
}
function providerKey(id) {
  return `forge.agent.key.${id}`;
}
function storedProviderKey(id) {
  return id ? localStorage.getItem(providerKey(id)) || "" : "";
}
function providerUsable(info) {
  if (!info) return false;
  if (info.kind === "api") return info.available || !!storedProviderKey(info.id);
  return !!info.available;
}
function providerNeedsSettings(info) {
  return info?.kind === "api";
}

async function loadProviders(force = false) {
  const data = await getJson(`/api/copilot/providers${force ? "?force=1" : ""}`);
  // Forge exposes the local CLIs plus selected API providers.
  state.providers = (data.providers || [])
    .filter((p) => AGENT_PROVIDER_IDS.includes(p.id))
    .sort((a, b) => AGENT_PROVIDER_IDS.indexOf(a.id) - AGENT_PROVIDER_IDS.indexOf(b.id));
  const stored = localStorage.getItem("forge.agent.provider");
  state.providerId =
    (stored && state.providers.some((p) => p.id === stored) && stored) ||
    (state.providers.some((p) => p.id === DEFAULT_PROVIDER) && DEFAULT_PROVIDER) ||
    state.providers.find((p) => providerUsable(p))?.id ||
    state.providers[0]?.id ||
    null;
  for (const which of ["stage", "create"]) {
    const storedPlanProvider = localStorage.getItem(`forge.plan.provider.${which}`);
    state.planning[which].providerId =
      (storedPlanProvider && state.providers.some((p) => p.id === storedPlanProvider) && storedPlanProvider) ||
      state.providerId;
  }
}

const PROVIDER_SHORT = {
  "codex-cli": "Codex",
  "claude-code-cli": "Claude",
  "antigravity-cli": "Antigravity",
  "deepseek-api": "DeepSeek",
  "openmodel-api": "OpenModel",
};

/** Build the shared agent pane: chat first, a compact control bar in the
 * composer (provider / model / thinking live there, not a big block up top). */
function buildAgentPane(host, which) {
  host.innerHTML = "";
  const planState = state.planning[which];
  const selectedProviderId = planState.active ? planState.providerId : state.providerId;
  const info = providerInfo(selectedProviderId);
  const ready = providerUsable(info);

  host.append(
    el("div", { class: "panel-head" }, [
      "Agent",
      el("span", { class: `chip ${ready ? "ready" : "setup"}` }, [ready ? "ready" : "setup"]),
    ]),
  );

  const body = el("div", { class: "panel-body" });

  /* chat log (takes the room the config block used to) */
  const log = el("div", { class: "chat-log", id: `${which}ChatLog` });
  renderChatLog(log, which);
  body.append(log);

  /* composer */
  const composer = el("div", { class: "composer" });
  const box = el("div", { class: "composer-box" });
  const tagRow = el("div", { class: "composer-tags", id: `${which}Tags` });
  renderTagRow(tagRow, which);
  const textarea = el("textarea", {
    id: `${which}Prompt`,
    rows: "2",
    placeholder:
      which === "stage"
        ? "Describe the asset to build — drag media in to reference it"
        : "Describe the component to build from your media",
  });
  textarea.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendChat(which);
    }
  });
  textarea.addEventListener("input", () => {
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(200, textarea.scrollHeight)}px`;
  });

  /* compact control bar */
  const bar = el("div", { class: "composer-bar" });
  const left = el("div", { class: "cbar-left" });

  const addBtn = el("button", { class: "cbar-btn", title: "Reference media" }, [icon("plus", 16)]);
  addBtn.addEventListener("click", () => openMediaMenu(addBtn, which));

  // mode toggle — a two-segment control so the active mode is always explicit
  // (a single relabelling button left users unsure which mode was on)
  const setMode = (active) => {
    if (planState.active === active) return;
    planState.active = active;
    buildAgentPane(host, which);
  };
  const modeSeg = el("div", { class: "mode-seg", role: "group", "aria-label": "Agent mode" }, [
    el("button", {
      class: `mode-seg-btn ${planState.active ? "" : "active"}`,
      type: "button",
      title: "Build mode: implement directly with the selected model.",
      onclick: () => setMode(false),
    }, ["Build"]),
    el("button", {
      class: `mode-seg-btn ${planState.active ? "active" : ""}`,
      type: "button",
      title: "Plan mode: think through an approach first with a separately selected model.",
      onclick: () => setMode(true),
    }, ["Plan"]),
  ]);

  // provider select (compact)
  const providerSel = el(
    "select",
    {
      class: `cbar-select sel-provider ${ready ? "" : "status-warn"}`,
      title: info?.detail || "Select an agent provider",
      onchange: (e) => {
        if (planState.active) {
          planState.providerId = e.target.value;
          localStorage.setItem(`forge.plan.provider.${which}`, planState.providerId);
        } else {
          state.providerId = e.target.value;
          localStorage.setItem("forge.agent.provider", state.providerId);
        }
        buildAgentPane(host, which);
      },
    },
    state.providers.length
      ? state.providers.map((p) => el("option", { value: p.id, selected: p.id === selectedProviderId }, [PROVIDER_SHORT[p.id] || p.label]))
      : [el("option", { value: "" }, ["No provider"])],
  );

  // model select (compact) — preset models only, no custom entry
  const presets = AGENT_MODEL_PRESETS[selectedProviderId] || [];
  const selectedModel = currentModel(selectedProviderId);
  const modelSel = el(
    "select",
    {
      class: "cbar-select sel-model",
      title: "Model",
      onchange: (e) => {
        localStorage.setItem(modelKey(selectedProviderId), e.target.value);
        buildAgentPane(host, which);
      },
    },
    presets.map((p) => el("option", { value: p.id, selected: p.id === selectedModel }, [p.label])),
  );

  // thinking select (compact) — per-provider effort levels, default high
  const thinkingLevels = THINKING_BY_PROVIDER[selectedProviderId] || [DEFAULT_THINKING];
  const thinkingSel = el(
    "select",
    {
      class: "cbar-select sel-thinking",
      title: "Thinking effort",
      onchange: (e) => localStorage.setItem(thinkingKey(selectedProviderId), e.target.value),
    },
    thinkingLevels.map((m) => el("option", { value: m, selected: m === currentThinking(selectedProviderId) }, [m])),
  );

  left.append(addBtn, modeSeg, providerSel, modelSel, thinkingSel);
  if (providerNeedsSettings(info)) {
    const keyBtn = el("button", {
      class: `cbar-btn ${ready ? "" : "status-warn"}`,
      title: `${PROVIDER_SHORT[info.id] || info.label} API key`,
    }, [icon("key", 15)]);
    keyBtn.addEventListener("click", () => openProviderSettings(keyBtn, info, host, which));
    left.append(keyBtn);
  }

  const running = Boolean(state.executions[which]);
  const sendBtn = el(
    "button",
    {
      class: `send-btn${running ? " stop" : ""}`,
      id: `${which}Send`,
      title: running ? "Stop execution" : "Send (Enter)",
    },
    [icon(running ? "stop" : "arrowUp", 16)],
  );
  sendBtn.disabled = !ready && !running;
  sendBtn.addEventListener("click", () => state.executions[which] ? stopAgentTurn(which) : sendChat(which));

  bar.append(left, sendBtn);
  box.append(tagRow, textarea, bar);
  composer.append(box);

  // drag media / docs / components -> composer references
  box.addEventListener("dragover", (e) => {
    if (e.dataTransfer.types.includes(MIME_ASSET) || e.dataTransfer.types.includes(MIME_DOC) || e.dataTransfer.types.includes(MIME_OBJECT)) {
      e.preventDefault();
      box.classList.add("dropping");
    }
  });
  box.addEventListener("dragleave", () => box.classList.remove("dropping"));
  box.addEventListener("drop", (e) => {
    box.classList.remove("dropping");
    const assetId = e.dataTransfer.getData(MIME_ASSET);
    const docId = e.dataTransfer.getData(MIME_DOC);
    const objectId = e.dataTransfer.getData(MIME_OBJECT);
    if (!assetId && !docId && !objectId) return;
    e.preventDefault();
    if (assetId) addAssetRef(which, assetId);
    if (objectId) addObjectRef(which, objectId);
    if (docId) {
      const doc = state.docs.find((d) => d.id === docId);
      if (doc) addRef(which, { kind: "doc", id: doc.id, label: `@${doc.name}` });
    }
  });

  // paste images from the clipboard → the hidden scratch library (Stage only)
  if (which === "stage") {
    textarea.addEventListener("paste", (e) => {
      const items = [...(e.clipboardData?.items || [])].filter((it) => it.type.startsWith("image/"));
      if (!items.length) return;
      e.preventDefault();
      for (const item of items) {
        const file = item.getAsFile();
        if (file) void pasteImage(which, file);
      }
    });
  }

  body.append(composer);
  host.append(body);
}

function openProviderSettings(anchor, info, host, which) {
  closeMenu();
  const keyName = providerKey(info.id);
  const menu = el("div", { class: "menu provider-settings" });
  menu.append(
    el("div", { class: "menu-label" }, [`${PROVIDER_SHORT[info.id] || info.label} settings`]),
    el("label", { class: "fld" }, [
      el("span", {}, ["API key"]),
      el("input", {
        type: "password",
        value: storedProviderKey(info.id),
        placeholder: info.apiKeyEnv ? `${info.apiKeyEnv} or browser key` : "API key",
        autocomplete: "off",
      }),
    ]),
    el("div", { class: "provider-detail" }, [
      info.available
        ? `${info.apiKeyEnv || "API key"} is set in the server environment.`
        : "Stored in this browser only. It is sent with Stage requests and never written to project files.",
    ]),
  );
  const input = menu.querySelector("input");
  const save = el("button", { class: "btn-sm primary", type: "button" }, ["Save"]);
  const clear = el("button", { class: "btn-sm", type: "button" }, ["Clear"]);
  const rescan = el("button", { class: "btn-sm", type: "button" }, ["Re-scan"]);
  save.addEventListener("click", () => {
    const value = input.value.trim();
    if (value) localStorage.setItem(keyName, value);
    else localStorage.removeItem(keyName);
    closeMenu();
    buildAgentPane(host, which);
  });
  clear.addEventListener("click", () => {
    localStorage.removeItem(keyName);
    input.value = "";
    buildAgentPane(host, which);
  });
  rescan.addEventListener("click", async () => {
    rescan.disabled = true;
    try {
      await loadProviders(true);
      closeMenu();
      buildAgentPane(host, which);
    } catch (err) {
      toast(`provider scan failed - ${err.message}`, "err");
      rescan.disabled = false;
    }
  });
  menu.append(el("div", { class: "provider-actions" }, [save, clear, rescan]));

  document.body.append(menu);
  const r = anchor.getBoundingClientRect();
  const mh = menu.offsetHeight;
  menu.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - menu.offsetWidth - 8))}px`;
  menu.style.top = `${Math.max(8, r.top - mh - 6)}px`;
  input.focus();
  input.select();
  setTimeout(() => {
    document.addEventListener("pointerdown", onDocDown, { capture: true });
    document.addEventListener("keydown", onKey);
  }, 0);
  function onDocDown(e) {
    if (!menu.contains(e.target) && e.target !== anchor) closeMenu();
  }
  function onKey(e) {
    if (e.key === "Escape") closeMenu();
    if (e.key === "Enter" && document.activeElement === input) save.click();
  }
  closeMenu._cleanup = () => {
    document.removeEventListener("pointerdown", onDocDown, { capture: true });
    document.removeEventListener("keydown", onKey);
    menu.remove();
  };
}

/** Persist a pasted image to the scratch library and add it as a chip thumbnail. */
async function pasteImage(which, file) {
  const dataUrl = await new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.readAsDataURL(file);
  });
  try {
    const base64 = String(dataUrl).split(",")[1] || "";
    const res = await postJson("/api/stage/paste", { fileName: file.name || "pasted.png", base64 });
    if (!res.ok) throw new Error((res.errors || ["paste failed"]).join(" · "));
    addRef(which, { kind: "scratch", id: res.id, label: "pasted image", thumb: dataUrl });
  } catch (err) {
    toast(`couldn't attach image — ${err.message}`, "err");
  }
}

function draftMiniCard(draft) {
  const bad = (draft.validation || []).filter((item) => item.level === "error").length;
  return el("div", { class: "draft-mini" }, [
    el("div", { class: "dm-title" }, [draft.name || "Motion draft"]),
    el("div", { class: "dm-meta" }, [
      `${draft.route || "route"} · ${draft.primitiveKind || "enter"} · ${draft.aspect || "16:9"} · ${(draft.timeline || []).length} beats`,
    ]),
    el("div", { class: `dm-status ${bad ? "err" : "ok"}` }, [bad ? `${bad} validation issue${bad === 1 ? "" : "s"}` : "validated draft"]),
  ]);
}

function stageRequestCard(request, refs = []) {
  const box = el("div", { class: "stage-request-card" });
  box.append(
    el("div", { class: "src-title" }, [icon("layers", 14), "Stage asset request"]),
    el("div", { class: "src-brief" }, [request.brief || "Build missing component"]),
  );
  const rows = [
    request.aspect ? ["Aspect", request.aspect] : null,
    request.requiredParts?.length ? ["Parts", request.requiredParts.join(", ")] : null,
    request.requiredActions?.length ? ["Actions", request.requiredActions.join(", ")] : null,
    request.requiredKnobs?.length ? ["Knobs", request.requiredKnobs.join(", ")] : null,
  ].filter(Boolean);
  for (const [k, v] of rows) box.append(el("div", { class: "src-kv" }, [el("span", {}, [k]), el("b", {}, [v])]));
  if (request.reason) box.append(el("div", { class: "src-reason" }, [request.reason]));
  const actions = el("div", { class: "src-actions" });
  const yes = el("button", { class: "primary btn-sm", type: "button" }, [icon("play", 12), "Run Stage"]);
  yes.addEventListener("click", () => executeStageRequest(request, refs, yes));
  actions.append(yes);
  box.append(actions);
  return box;
}

/* The streaming "pending" turn. Built with stable, queryable nodes
 * (.pending-text, .think-trace) so `updatePendingTurn` can patch the live
 * status + reasoning in place — full re-renders on every byte caused the whole
 * chat to flicker. */
function pendingTurn(m) {
  const col = el("div", { class: "turn-col" }, [
    el("div", { class: "turn-name" }, ["Agent"]),
    el("div", { class: "bubble thinking" }, [
      el("span", { class: "dots" }, ["···"]),
      " ",
      el("span", { class: "pending-text" }, [m.text || "designing…"]),
    ]),
    el("div", { class: `think-trace${m.thinking ? "" : " is-empty"}` }, [
      el("div", { class: "think-trace-label" }, ["thinking"]),
      el("div", { class: "think-trace-body" }, [m.thinking || ""]),
    ]),
  ]);
  return el("div", { class: "turn agent pending-turn" }, [
    el("div", { class: "turn-avatar" }, [icon("spark", 13)]),
    col,
  ]);
}

/* Patch only the live pending turn during streaming instead of rebuilding the
 * whole log. Falls back to a full render if the pending node isn't present
 * (e.g. the user switched tabs). Keeps the view pinned to the bottom only when
 * it already was, so reading scrollback isn't yanked away mid-stream. */
function updatePendingTurn(which) {
  const log = $(`#${which}ChatLog`);
  if (!log) return;
  const pending = state.chat[which].find((m) => m.who === "pending");
  const turn = log.querySelector(".pending-turn");
  if (!pending || !turn) {
    if (log) renderChatLog(log, which);
    return;
  }
  const nearBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 80;
  const textEl = turn.querySelector(".pending-text");
  if (textEl) textEl.textContent = pending.text || "designing…";
  const trace = turn.querySelector(".think-trace");
  const body = turn.querySelector(".think-trace-body");
  if (trace && body) {
    trace.classList.toggle("is-empty", !pending.thinking);
    if (pending.thinking) body.textContent = pending.thinking;
  }
  if (nearBottom) log.scrollTop = log.scrollHeight;
}

function renderChatLog(log, which) {
  log.innerHTML = "";
  const messages = state.chat[which];
  if (messages.length === 0) {
    log.append(
      el("div", { class: "empty chat-empty" }, [
        el("div", { class: "empty-ico" }, [icon(which === "stage" ? "spark" : "film", 26)]),
        el("div", { class: "empty-title" }, [which === "stage" ? "Build an asset" : "Choreograph a snippet"]),
        el("div", { class: "empty-sub" }, [
          which === "stage"
            ? "Ask the agent to create an editable asset (React / HTML / CSS / JS) in the viewer, then save it to the media pool."
            : "Drag saved components or storyboard images into chat, then ask for a SaaS motion Extension draft.",
        ]),
      ]),
    );
    return;
  }
  for (const m of messages) {
    if (m.who === "note") {
      log.append(el("div", { class: `chat-note ${m.kind || ""}`.trim() }, [m.text]));
      continue;
    }
    if (m.who === "pending") {
      log.append(pendingTurn(m));
      continue;
    }
    const bubble = el("div", { class: "bubble" });
    if (m.who === "me" && m.refs?.length) {
      for (const r of m.refs) bubble.append(el("span", { class: "mtag" }, [r.label]), " ");
    }
    if (m.text) bubble.append(document.createTextNode(m.text));
    if (m.plan) {
      const plan = m.plan;
      const colors = el("div", { class: "plan-swatches" },
        (plan.palette?.colors || []).slice(0, 8).map((color) =>
          el("span", { class: "plan-swatch", title: color, style: `background:${color}` }),
        ),
      );
      const planCard = el("div", { class: "plan-card" }, [
        el("div", { class: "plan-title" }, [plan.summary || "Design plan"]),
        el("div", { class: "plan-direction" }, [plan.direction || ""]),
        colors,
        el("div", { class: "plan-type" }, [
          el("b", {}, [plan.typography?.display || "Display"]),
          " + ",
          plan.typography?.body || "Body",
        ]),
      ]);
      for (const question of plan.questions || []) {
        planCard.append(el("div", { class: "plan-question" }, [question.question]));
      }
      const use = el("button", { class: "btn-sm primary plan-use", type: "button" }, [
        plan.questions?.length ? "Answer above, then refine" : "Use plan and build",
      ]);
      use.addEventListener("click", () => {
        if (plan.questions?.length) {
          const prompt = $(`#${which}Prompt`);
          prompt?.focus();
          return;
        }
        void buildFromPlan(which, plan);
      });
      planCard.append(use);
      bubble.append(planCard);
    }
    if (m.stageRequest) {
      bubble.append(stageRequestCard(m.stageRequest, m.refs || []));
    }
    if (m.draft) {
      bubble.append(draftMiniCard(m.draft));
    }
    const turn = el("div", { class: `turn ${m.who}` }, [
      el("div", { class: "turn-avatar" }, [icon(m.who === "me" ? "user" : "spark", 13)]),
      el("div", { class: "turn-col" }, [el("div", { class: "turn-name" }, [m.who === "me" ? "You" : "Agent"]), bubble]),
    ]);
    log.append(turn);
  }
  log.scrollTop = log.scrollHeight;
}

function renderTagRow(row, which) {
  row.innerHTML = "";
  for (const ref of state.refs[which]) {
    const chip = el("span", { class: `tag ref-${ref.kind}` });
    if (ref.thumb) chip.append(el("img", { class: "tag-thumb", src: ref.thumb, alt: "" }));
    else chip.append(icon(ref.kind === "doc" || ref.kind === "component" ? "code" : "image", 11));
    chip.append(el("span", {}, [ref.label]));
    const rm = el("button", { title: "Remove reference" }, [icon("x", 11)]);
    rm.addEventListener("click", () => {
      state.refs[which] = state.refs[which].filter((r) => r !== ref);
      renderTagRow(row, which);
    });
    chip.append(rm);
    row.append(chip);
  }
}

function addRef(which, ref) {
  if (!ref || !ref.id) return;
  if (!state.refs[which].some((r) => r.kind === ref.kind && r.id === ref.id)) state.refs[which].push(ref);
  const row = $(`#${which}Tags`);
  if (row) renderTagRow(row, which);
}

function addAssetRef(which, assetId) {
  const asset = state.assets.find((a) => a.id === assetId);
  if (asset) addRef(which, { kind: "asset", id: asset.id, label: assetTag(asset) });
}

function addObjectRef(which, objectId) {
  const object = state.objects.find((o) => o.id === objectId);
  if (object) addRef(which, { kind: "component", id: object.id, label: `@${object.name}` });
}

function syncAgentSendButton(which) {
  const button = $(`#${which}Send`);
  if (!button) return;
  const running = Boolean(state.executions[which]);
  button.classList.toggle("stop", running);
  button.title = running ? "Stop execution" : "Send (Enter)";
  button.innerHTML = "";
  button.append(icon(running ? "stop" : "arrowUp", 16));
  const providerId = state.planning[which].active ? state.planning[which].providerId : state.providerId;
  button.disabled = running ? false : !providerUsable(providerInfo(providerId));
}

function stopAgentTurn(which) {
  const execution = state.executions[which];
  if (!execution) return;
  execution.stopped = true;
  execution.controller.abort();
  syncAgentSendButton(which);
}

async function sendChat(which) {
  if (state.executions[which]) return;
  const ta = $(`#${which}Prompt`);
  const text = ta.value.trim();
  if (!text && state.refs[which].length === 0) return;
  const refs = state.refs[which].map((r) => ({ kind: r.kind, id: r.id, label: r.label }));
  state.chat[which].push({ who: "me", text, refs: [...state.refs[which]] });
  state.refs[which] = [];
  ta.value = "";
  ta.style.height = "";
  const row = $(`#${which}Tags`);
  if (row) renderTagRow(row, which);

  if (state.planning[which].active) {
    await runPlanTurn(which, text, refs);
    return;
  }

  if (which !== "stage") {
    await runCreateTurn(text, refs);
    return;
  }

  await runStageTurn(text, refs);
}

function planContext(which, refs) {
  if (which === "stage") {
    return {
      aspect: "16:9",
      currentAsset: state.stage.asset ? {
        name: state.stage.asset.name,
        parts: state.stage.contract?.parts || [],
        actions: state.stage.contract?.actions?.map((action) => action.name) || [],
        knobs: state.stage.contract?.knobs?.map((knob) => `${knob.name}:${knob.type}`) || [],
      } : null,
      references: refs,
    };
  }
  return {
    aspect: state.createRatio,
    currentDraft: state.currentDraft ? {
      name: state.currentDraft.name,
      route: state.currentDraft.route,
      beats: state.currentDraft.timeline?.length || 0,
    } : null,
    components: refs.filter((ref) => ref.kind === "component"),
  };
}

async function runPlanTurn(which, text, refs) {
  const planState = state.planning[which];
  const providerId = planState.providerId || state.providerId;
  if (!providerUsable(providerInfo(providerId))) {
    state.chat[which].push({ who: "note", kind: "err", text: "Choose a ready planning provider or add its API key." });
    renderChatLog($(`#${which}ChatLog`), which);
    return;
  }
  const execution = { controller: new AbortController(), stopped: false };
  state.executions[which] = execution;
  syncAgentSendButton(which);
  const pending = { who: "pending", text: "planning the direction..." };
  state.chat[which].push(pending);
  let log = $(`#${which}ChatLog`);
  if (log) renderChatLog(log, which);
  let result;
  try {
    result = await postEventStream("/api/plan/chat/stream", {
      surface: which,
      message: text,
      context: planContext(which, refs),
      previousPlan: planState.current,
      provider: providerId,
      model: currentModel(providerId),
      thinkingMode: currentThinking(providerId),
      apiKey: storedProviderKey(providerId) || undefined,
    }, {
      signal: execution.controller.signal,
      progress: (progress) => {
        applyStreamProgress(pending, progress, "planning the direction...");
        updatePendingTurn(which);
      },
    });
  } catch (error) {
    result = execution.stopped || error.name === "AbortError"
      ? { ok: false, stopped: true }
      : { ok: false, errors: [error.message] };
  }
  if (state.executions[which] === execution) state.executions[which] = null;
  syncAgentSendButton(which);
  state.chat[which] = state.chat[which].filter((message) => message !== pending);
  if (result.stopped) {
    state.chat[which].push({ who: "note", text: "Planning stopped." });
  } else if (!result.ok || !result.plan) {
    state.chat[which].push({ who: "note", kind: "err", text: (result.errors || ["The planner could not produce a plan."]).join(" · ") });
  } else {
    planState.current = result.plan;
    state.chat[which].push({ who: "agent", text: result.reply || "Here is the plan.", plan: result.plan });
  }
  log = $(`#${which}ChatLog`);
  if (log) renderChatLog(log, which);
}

/** Commit a finished plan: leave plan mode and immediately run the build turn
 * with the plan attached (the plan stays in `state.planning[which].current`, so
 * the Stage/Create turn forwards it as `plan`). Previously this only flipped the
 * mode toggle and focused an empty composer, so the button appeared to do
 * nothing. */
async function buildFromPlan(which, plan) {
  if (state.executions[which]) return;
  state.planning[which].active = false;
  buildAgentPane($(`#${which}Agent`), which);
  const directive = plan?.summary
    ? `Build the plan: ${plan.summary}`
    : "Build the planned asset.";
  state.chat[which].push({ who: "me", text: directive, refs: [] });
  const log = $(`#${which}ChatLog`);
  if (log) renderChatLog(log, which);
  if (which === "stage") await runStageTurn(directive, []);
  else await runCreateTurn(directive, []);
}

/** The Stage AI turn: generate/iterate the asset, render it, populate Tweaks. */
async function runStageTurn(text, refs) {
  const info = providerInfo(state.providerId);
  if (!providerUsable(info)) {
    state.chat.stage.push({ who: "note", kind: "err", text: "Choose a ready provider or add an API key in settings." });
    const log0 = $("#stageChatLog");
    if (log0) renderChatLog(log0, "stage");
    return;
  }
  state.stage.busy = true;
  const execution = { controller: new AbortController(), stopped: false };
  state.executions.stage = execution;
  syncAgentSendButton("stage");
  const pending = { who: "pending", text: "connecting to the agent..." };
  state.chat.stage.push(pending);
  let log = $("#stageChatLog");
  if (log) renderChatLog(log, "stage");

  let result;
  try {
    result = await postEventStream("/api/stage/chat/stream", {
      message: text,
      references: refs,
      current: state.stage.asset
        ? {
            name: state.stage.asset.name,
            html: state.stage.asset.html,
            css: state.stage.asset.css,
            js: state.stage.asset.js,
            react: state.stage.asset.react,
            capabilities: state.stage.asset.capabilities,
          }
        : null,
      aspect: "16:9",
      provider: state.providerId,
      model: currentModel(state.providerId),
      thinkingMode: currentThinking(state.providerId),
      apiKey: storedProviderKey(state.providerId) || undefined,
      plan: state.planning.stage.current,
    }, {
      signal: execution.controller.signal,
      progress: (p) => {
        applyStreamProgress(pending, p, "designing the interface...");
        updatePendingTurn("stage");
      },
    });
  } catch (err) {
    result = execution.stopped || err.name === "AbortError"
      ? { ok: false, stopped: true }
      : { ok: false, errors: [err.message] };
  }

  if (state.executions.stage === execution) state.executions.stage = null;
  state.stage.busy = false;
  syncAgentSendButton("stage");
  state.chat.stage = state.chat.stage.filter((m) => m.who !== "pending");

  if (result.stopped) {
    state.chat.stage.push({ who: "note", text: "Execution stopped." });
  } else if (!result.ok || !result.asset) {
    state.chat.stage.push({ who: "note", kind: "err", text: (result.errors || ["The agent could not build that."]).join(" · ") });
  } else {
    state.chat.stage.push({ who: "agent", text: result.reply || "Built the asset." });
    applyStageAsset(result.asset);
  }
  log = $("#stageChatLog");
  if (log) renderChatLog(log, "stage");
}

async function runCreateTurn(text, refs) {
  const info = providerInfo(state.providerId);
  if (!providerUsable(info)) {
    state.chat.create.push({ who: "note", kind: "err", text: "Choose a ready provider or add an API key in settings." });
    const log0 = $("#createChatLog");
    if (log0) renderChatLog(log0, "create");
    return;
  }
  state.createBusy = true;
  const execution = { controller: new AbortController(), stopped: false };
  state.executions.create = execution;
  syncAgentSendButton("create");
  const pending = { who: "pending", text: "directing the motion..." };
  state.chat.create.push(pending);
  let log = $("#createChatLog");
  if (log) renderChatLog(log, "create");

  let result;
  try {
    result = await postEventStream("/api/create/chat/stream", {
      message: text,
      references: refs,
      aspect: state.createRatio,
      currentDraftId: state.currentDraft?.id || null,
      provider: state.providerId,
      model: currentModel(state.providerId),
      thinkingMode: currentThinking(state.providerId),
      apiKey: storedProviderKey(state.providerId) || undefined,
      plan: state.planning.create.current,
    }, {
      signal: execution.controller.signal,
      progress: (p) => {
        applyStreamProgress(pending, p, "directing the motion...");
        updatePendingTurn("create");
      },
    });
  } catch (err) {
    result = execution.stopped || err.name === "AbortError"
      ? { ok: false, stopped: true }
      : { ok: false, errors: [err.message] };
  }

  if (state.executions.create === execution) state.executions.create = null;
  state.createBusy = false;
  syncAgentSendButton("create");
  state.chat.create = state.chat.create.filter((m) => m.who !== "pending");
  if (result.drafts) state.drafts = result.drafts;
  if (result.currentId) state.activeDraftId = result.currentId;

  if (result.stopped) {
    state.chat.create.push({ who: "note", text: "Execution stopped." });
  } else if (result.stageRequest && !result.draft) {
    state.chat.create.push({
      who: "agent",
      text: result.reply || "I need Stage to build a missing component before choreographing this.",
      stageRequest: result.stageRequest,
      refs,
    });
  } else if (result.draft) {
    applyCreateDraft(result.draft);
    state.chat.create.push({
      who: "agent",
      text: result.reply || (result.ok ? "Built the motion draft." : "Built a draft with validation issues."),
      draft: result.draft,
      ...(result.stageRequest ? { stageRequest: result.stageRequest, refs } : {}),
    });
  } else {
    state.chat.create.push({ who: "note", kind: "err", text: (result.errors || ["The Create agent could not build that."]).join(" · ") });
  }
  log = $("#createChatLog");
  if (log) renderChatLog(log, "create");
}

async function executeStageRequest(request, refs, button) {
  const info = providerInfo(state.providerId);
  if (!providerUsable(info)) return toast("Choose a ready provider or add an API key first.", "err");
  if (button) {
    button.disabled = true;
    button.textContent = "Running Stage...";
  }
  const pending = { who: "pending", text: "Stage is building the missing asset..." };
  state.chat.create.push(pending);
  const log = $("#createChatLog");
  if (log) renderChatLog(log, "create");
  let result;
  try {
    result = await postJson("/api/create/stage-call", {
      request,
      references: refs,
      provider: state.providerId,
      model: currentModel(state.providerId),
      thinkingMode: currentThinking(state.providerId),
      apiKey: storedProviderKey(state.providerId) || undefined,
    });
  } catch (err) {
    result = { ok: false, errors: [err.message] };
  }
  state.chat.create = state.chat.create.filter((m) => m !== pending);
  if (!result.ok || !result.object) {
    state.chat.create.push({ who: "note", kind: "err", text: (result.errors || ["Stage could not build the component."]).join(" · ") });
    if (button) {
      button.disabled = false;
      button.textContent = "Run Stage";
    }
  } else {
    state.objects = result.objects || state.objects;
    addObjectRef("create", result.object.id);
    state.chat.create.push({
      who: "agent",
      text: `${result.object.name} is saved as a Stage Component and attached. Continue your motion brief and I'll choreograph it.`,
    });
    toast(`Stage created “${result.object.name}”.`, "ok");
    renderCreateInspector();
    // Smooth the hand-off: pre-fill the composer so the user can continue in one click.
    const prompt = $("#createPrompt");
    if (prompt && !prompt.value.trim()) {
      prompt.value = request.brief
        ? `Now choreograph ${result.object.name} into the snippet I asked for.`
        : `Choreograph ${result.object.name} into a polished motion snippet.`;
      prompt.focus();
    }
  }
  const log2 = $("#createChatLog");
  if (log2) renderChatLog(log2, "create");
}

/* a `+` popover listing pool media + reference docs to attach */
function openMediaMenu(anchor, which) {
  closeMenu();
  const menu = el("div", { class: "menu" });
  if (state.assets.length === 0 && state.docs.length === 0 && state.objects.length === 0) {
    menu.append(el("div", { class: "menu-label" }, ["No media or docs — import in Library"]));
  }
  if (state.assets.length) {
    menu.append(el("div", { class: "menu-label" }, ["Reference media"]));
    for (const asset of state.assets) {
      const item = el("button", { class: "menu-item" }, [
        asset.kind === "image" ? el("img", { class: "mi-thumb", src: asset.href, alt: "" }) : el("span", { class: "mi-thumb", style: "display:grid;place-items:center" }, [icon(asset.kind === "audio" ? "music" : "film", 13)]),
        el("span", { class: "mi-name" }, [assetTag(asset)]),
      ]);
      item.addEventListener("click", () => {
        addAssetRef(which, asset.id);
        closeMenu();
      });
      menu.append(item);
    }
  }
  if (state.docs.length) {
    menu.append(el("div", { class: "menu-label" }, ["Reference docs"]));
    for (const doc of state.docs) {
      const item = el("button", { class: "menu-item" }, [
        el("span", { class: "mi-thumb", style: "display:grid;place-items:center" }, [icon("code", 13)]),
        el("span", { class: "mi-name" }, [`@${doc.name}`]),
      ]);
      item.addEventListener("click", () => {
        addRef(which, { kind: "doc", id: doc.id, label: `@${doc.name}` });
        closeMenu();
      });
      menu.append(item);
    }
  }
  if (state.objects.length) {
    menu.append(el("div", { class: "menu-label" }, ["Reference components"]));
    for (const object of state.objects) {
      const item = el("button", { class: "menu-item" }, [
        el("span", { class: "mi-thumb", style: "display:grid;place-items:center" }, [icon("code", 13)]),
        el("span", { class: "mi-name" }, [`@${object.name}`]),
      ]);
      item.addEventListener("click", () => {
        addObjectRef(which, object.id);
        closeMenu();
      });
      menu.append(item);
    }
  }
  document.body.append(menu);
  const r = anchor.getBoundingClientRect();
  const mh = menu.offsetHeight;
  menu.style.left = `${r.left}px`;
  menu.style.top = `${Math.max(8, r.top - mh - 6)}px`;
  setTimeout(() => {
    document.addEventListener("pointerdown", onDocDown, { capture: true });
    document.addEventListener("keydown", onEsc);
  }, 0);
  function onDocDown(e) {
    if (!menu.contains(e.target) && e.target !== anchor) closeMenu();
  }
  function onEsc(e) {
    if (e.key === "Escape") closeMenu();
  }
  closeMenu._cleanup = () => {
    document.removeEventListener("pointerdown", onDocDown, { capture: true });
    document.removeEventListener("keydown", onEsc);
    menu.remove();
  };
}
function closeMenu() {
  if (closeMenu._cleanup) {
    closeMenu._cleanup();
    closeMenu._cleanup = null;
  }
}

/* ─────────────────────── media (Library + pools) ─────────────────────── */

async function loadDoc() {
  const outline = await getJson("/api/doc");
  state.assets = outline.assets || [];
  try {
    const { folders } = await getJson("/api/assets/folders");
    state.folders = folders || [];
  } catch {
    state.folders = [];
  }
  await loadDocs();
}

async function loadDocs() {
  try {
    const { docs } = await getJson("/api/docs");
    state.docs = docs || [];
  } catch {
    state.docs = [];
  }
}

function isMarkdownFile(file) {
  return /\.(md|markdown|mdx)$/i.test(file?.name || "");
}

/** Import markdown files as reference docs (not pool media). */
async function importDocFiles(files) {
  let added = 0;
  for (const file of files) {
    try {
      const text = await file.text();
      const res = await postJson("/api/docs/add", { name: file.name, text });
      if (!res.ok) throw new Error((res.errors || ["doc import failed"]).join(" · "));
      added += 1;
    } catch (err) {
      toast(`doc import failed — ${err.message}`, "err");
    }
  }
  if (added) {
    await loadDocs();
    if (state.tab === "library") renderLibrary();
    toast(`added ${added} reference doc${added === 1 ? "" : "s"}`);
  }
}

async function deleteDoc(id) {
  const doc = state.docs.find((d) => d.id === id);
  if (!confirm(`Remove reference doc “${doc?.name ?? id}”?`)) return;
  try {
    const res = await postJson("/api/docs/delete", { id });
    if (!res.ok) throw new Error("delete failed");
    state.docs = res.docs || [];
    for (const which of ["stage", "create"]) state.refs[which] = state.refs[which].filter((r) => !(r.kind === "doc" && r.id === id));
    if (state.tab === "library") renderLibrary();
    toast("Reference doc removed.");
  } catch (err) {
    toast(`delete failed — ${err.message}`, "err");
  }
}

/** A draggable doc card for the pools (drag into chat to reference). */
function docCard(doc) {
  const card = el("div", { class: "pool-card doc-card", draggable: "true", title: `${doc.name}\n@${doc.name} · drag into the chat to reference` });
  card.addEventListener("dragstart", (e) => {
    e.dataTransfer.setData(MIME_DOC, doc.id);
    e.dataTransfer.setData("text/plain", `@${doc.name}`);
    e.dataTransfer.effectAllowed = "copy";
  });
  const thumb = el("div", { class: "pool-thumb doc-thumb" }, [icon("code", 22)]);
  card.append(thumb, el("div", { class: "pool-meta" }, [el("div", { class: "pm-id" }, [doc.name]), el("div", { class: "pm-info" }, ["reference doc"])]));
  const del = el("button", { class: "pc-del", title: "Remove doc" }, [icon("x", 11)]);
  del.addEventListener("click", (e) => { e.stopPropagation(); deleteDoc(doc.id); });
  card.append(del);
  card.addEventListener("click", () => setLibPreview({ docId: doc.id, name: doc.name, kind: "doc", info: "reference doc" }));
  return card;
}

async function importDiskFile(diskPath, folder = state.bin) {
  try {
    const res = await postJson("/api/assets/import", { path: diskPath, folder });
    if (!res.ok) throw new Error((res.errors || ["import failed"]).join(" · "));
    await refreshMedia();
    toast(`imported into ${folder ? `assets/${folder}/` : "the pool"}`);
  } catch (err) {
    toast(`import failed — ${err.message}`, "err");
  }
}

async function uploadFiles(files, folder = state.bin) {
  const all = [...(files || [])];
  const docs = all.filter(isMarkdownFile);
  const media = all.filter((f) => !isMarkdownFile(f));
  if (docs.length) await importDocFiles(docs);
  for (const file of media) {
    try {
      const res = await fetch(`/api/assets/upload?name=${encodeURIComponent(file.name)}&folder=${encodeURIComponent(folder)}`, {
        method: "POST",
        body: file,
      });
      const json = await res.json();
      if (!json.ok) throw new Error((json.errors || ["upload failed"]).join(" · "));
    } catch (err) {
      toast(`upload failed — ${err.message}`, "err");
    }
  }
  await refreshMedia();
  if (media.length) boot(`imported ${media.length} file${media.length === 1 ? "" : "s"}`);
}

async function moveAssetToBin(assetId, folder) {
  try {
    const res = await postJson("/api/assets/move", { assetId, folder });
    if (!res.ok) throw new Error((res.errors || ["move failed"]).join(" · "));
    await refreshMedia();
    toast(`moved to ${folder ? `assets/${folder}/` : "assets/"}`);
  } catch (err) {
    toast(`move failed — ${err.message}`, "err");
  }
}

async function moveObjectToBin(objectId, folder) {
  try {
    const res = await postJson("/api/objects/move", { id: objectId, folder });
    if (!res.ok) throw new Error((res.errors || ["move failed"]).join(" · "));
    state.objects = res.objects || [];
    if (state.preview?.object?.id === objectId) {
      const object = state.objects.find((o) => o.id === objectId);
      if (object) state.preview = { ...state.preview, object, info: `component · ${binOfObject(object) || "components/"}` };
    }
    if (state.activeObjectId === objectId) {
      const object = state.objects.find((o) => o.id === objectId);
      if (object && state.tab === "create") setObjectSource(object);
    }
    if (state.tab === "library") renderLibrary();
    if (state.tab === "stage") renderStage();
    if (state.tab === "create" && state.createInspTab === "media") renderCreateMedia($("#createMediaPool"));
    toast(`moved component to ${folder ? `assets/${folder}/` : "assets/"}`);
  } catch (err) {
    toast(`move failed — ${err.message}`, "err");
  }
}

async function removeAsset(assetId) {
  const res = await postJson("/api/doc/command", { command: { type: "RemoveAsset", assetId } });
  if (!res.ok) return toast((res.errors || ["could not remove"]).join(" · "), "err");
  await refreshMedia();
}

async function refreshMedia() {
  await loadDoc();
  if (state.tab === "library") renderLibrary();
  if (state.tab === "stage") {
    renderPool($("#stagePool"), {
      bin: false,
      includeObjects: true,
      onSelect: (asset) => addAssetRef("stage", asset.id),
      onObjectSelect: (object) => {
        applyObjectToStage(object);
        toast(`Opened “${object.name}” on Stage.`);
      },
    });
    renderStageInspector();
  }
  if (state.tab === "create" && state.createInspTab === "media") renderCreateMedia($("#createMediaPool"));
}

/* Create's Media tab — the same Library pool, with a bin filter strip so you
 * can navigate bins without leaving Create. */
function renderCreateMedia(body) {
  if (!body) return;
  body.innerHTML = "";

  const counts = {};
  for (const a of state.assets) counts[binOfAsset(a)] = (counts[binOfAsset(a)] ?? 0) + 1;
  for (const o of state.objects) counts[binOfObject(o)] = (counts[binOfObject(o)] ?? 0) + 1;
  const known = new Set(state.folders);
  for (const a of state.assets) {
    const b = binOfAsset(a);
    if (b) known.add(b);
  }
  for (const o of state.objects) {
    const b = binOfObject(o);
    if (b) known.add(b);
  }
  if (state.createBin && !known.has(state.createBin)) state.createBin = "";

  const strip = el("div", { class: "bin-strip" });
  const allChip = el("button", { class: `bin-chip ${state.createBin === "" ? "on" : ""}` }, [
    icon("layers", 13),
    "All",
    el("span", { class: "bc-count" }, [String(state.assets.length + state.docs.length + state.objects.length)]),
  ]);
  allChip.addEventListener("click", () => {
    state.createBin = "";
    renderCreateMedia(body);
  });
  strip.append(allChip);
  for (const bin of [...known].sort()) {
    const chip = el("button", { class: `bin-chip ${state.createBin === bin ? "on" : ""}`, title: `assets/${bin}/` }, [
      icon("folder", 13),
      bin,
      el("span", { class: "bc-count" }, [String(counts[bin] ?? 0)]),
    ]);
    chip.addEventListener("click", () => {
      state.createBin = bin;
      renderCreateMedia(body);
    });
    strip.append(chip);
  }
  body.append(strip);

  const assets = state.assets.filter((a) => state.createBin === "" || binOfAsset(a) === state.createBin);
  const docs = state.createBin === "" ? state.docs : [];
  const objects = state.objects.filter((o) => state.createBin === "" || binOfObject(o) === state.createBin);
  if (assets.length === 0 && docs.length === 0 && objects.length === 0) {
    body.append(
      el("div", { class: "empty" }, [
        el("div", { class: "empty-ico" }, [icon("layers", 26)]),
        el("div", { class: "empty-title" }, [state.createBin ? "No media in this bin" : "No reusable items yet"]),
        el("div", { class: "empty-sub" }, ["Import media in the Library tab — bins and assets are shared."]),
      ]),
    );
  } else {
    const grid = el("div", { class: "pool-grid" });
    for (const object of objects) grid.append(objectCard(object, { select: false, openOnDblclick: false, onSelect: (o) => addObjectRef("create", o.id) }));
    for (const asset of assets) grid.append(poolCard(asset, { onSelect: (a) => addAssetRef("create", a.id) }));
    for (const doc of docs) grid.append(docCard(doc));
    body.append(grid);
  }

  // drop to import into the selected bin
  body.ondragover = (e) => {
    e.preventDefault();
    body.classList.add("dragover");
  };
  body.ondragleave = () => body.classList.remove("dragover");
  body.ondrop = (e) => {
    e.preventDefault();
    body.classList.remove("dragover");
    const objectId = e.dataTransfer.getData(MIME_OBJECT);
    if (objectId) return moveObjectToBin(objectId, state.createBin);
    if (e.dataTransfer.getData(MIME_ASSET)) return;
    const disk = e.dataTransfer.getData("text/forge-disk");
    if (disk) return importDiskFile(disk, state.createBin);
    if (e.dataTransfer.files?.length) return uploadFiles(e.dataTransfer.files, state.createBin);
  };
}

/* shared media pool grid */
function poolCard(asset, { onSelect } = {}) {
  const bin = binOfAsset(asset);
  const card = el("div", {
    class: `pool-card ${state.selectedAssetId === asset.id ? "sel" : ""}`,
    draggable: "true",
    title: `${asset.path}\n${assetTag(asset)} · drag onto a bin to move, or into the chat to reference`,
  });
  card.addEventListener("dragstart", (e) => {
    e.dataTransfer.setData(MIME_ASSET, asset.id);
    e.dataTransfer.setData("text/plain", assetTag(asset));
    e.dataTransfer.effectAllowed = "copyMove";
  });
  const thumb = el("div", { class: "pool-thumb" });
  if (asset.kind === "image") thumb.append(el("img", { src: asset.href, alt: asset.id, loading: "lazy" }));
  else thumb.append(icon(asset.kind === "audio" ? "music" : "film", 22));
  card.append(
    thumb,
    el("div", { class: "pool-meta" }, [
      el("div", { class: "pm-id" }, [assetName(asset)]),
      el("div", { class: "pm-info" }, [`${bin ? `${bin}/ · ` : ""}${asset.kind}`]),
    ]),
  );
  const del = el("button", { class: "pc-del", title: "Remove from pool" }, [icon("x", 11)]);
  del.addEventListener("click", (e) => {
    e.stopPropagation();
    removeAsset(asset.id);
  });
  card.append(del);
  card.addEventListener("click", () => {
    state.selectedAssetId = asset.id;
    if (onSelect) onSelect(asset);
  });
  return card;
}

function componentCardThumb(object) {
  const hasSource = Boolean(String(object.html || "").trim() || String(object.css || "").trim() || String(object.js || "").trim());
  const thumb = el("div", { class: `pool-thumb component-thumb ${hasSource ? "has-preview" : ""}` });
  if (!hasSource) {
    thumb.append(icon("code", 24));
    return thumb;
  }
  const frame = el("iframe", {
    class: "component-thumb-frame",
    title: `${object.name} preview`,
    sandbox: "allow-scripts",
  });
  frame.srcdoc = objectSrcDoc(object, { ...variableDefaults(object), ...(object.values || {}) });
  thumb.append(frame);
  return thumb;
}

function objectCard(object, { onSelect, select = true, openOnDblclick = true } = {}) {
  const bin = binOfObject(object);
  const card = el("div", {
    class: `pool-card component-card ${select && state.activeObjectId === object.id ? "sel" : ""}`,
    draggable: "true",
    title: `${object.name}\ncomponent · ${object.components?.length || 0} parts · ${object.variables?.length || 0} tweaks · drag onto a bin or into chat`,
  });
  card.addEventListener("dragstart", (e) => {
    e.dataTransfer.setData(MIME_OBJECT, object.id);
    e.dataTransfer.setData("text/plain", `@${object.name}`);
    e.dataTransfer.effectAllowed = "copyMove";
  });
  card.append(
    componentCardThumb(object),
    el("div", { class: "pool-meta" }, [
      el("div", { class: "pm-id" }, [object.name]),
      el("div", { class: "pm-info" }, [`${bin ? `${bin}/ · ` : ""}component · ${object.variables?.length || 0} tweaks`]),
    ]),
  );
  const del = el("button", { class: "pc-del", title: "Delete component" }, [icon("x", 11)]);
  del.addEventListener("click", (e) => {
    e.stopPropagation();
    deleteObject(object.id);
  });
  card.append(del);
  card.addEventListener("click", () => {
    if (select) state.activeObjectId = object.id;
    if (onSelect) {
      onSelect(object);
    } else {
      applyObjectToStage(object, { render: false });
      setLibPreview({ kind: "component", object, name: object.name, info: "saved component" });
    }
  });
  if (openOnDblclick) card.addEventListener("dblclick", () => openObjectOnStage(object));
  return card;
}

function renderPool(body, { bin = true, includeObjects = false, onSelect, onObjectSelect } = {}) {
  if (!body) return;
  body.innerHTML = "";
  const assets = bin ? state.assets.filter((a) => state.bin === "" || binOfAsset(a) === state.bin) : state.assets;
  // Docs are global (unbinned); show them in the "All" view and in unbinned pools.
  const docs = bin && state.bin !== "" ? [] : state.docs;
  const objects = includeObjects ? state.objects.filter((o) => !bin || state.bin === "" || binOfObject(o) === state.bin) : [];

  body.append(el("div", { class: "pool-drop" }, [`Drop files (or .md docs) to import${bin && state.bin ? ` into assets/${state.bin}/` : ""}`]));

  if (assets.length === 0 && docs.length === 0 && objects.length === 0) {
    body.append(
      el("div", { class: "empty" }, [
        el("div", { class: "empty-ico" }, [icon("layers", 26)]),
        el("div", { class: "empty-title" }, ["No media yet"]),
        el("div", { class: "empty-sub" }, ["Drag files (or a .md design doc) from your OS to import them."]),
      ]),
    );
  } else {
    const grid = el("div", { class: "pool-grid" });
    for (const object of objects) grid.append(objectCard(object, { onSelect: onObjectSelect }));
    for (const asset of assets) grid.append(poolCard(asset, { onSelect }));
    for (const doc of docs) grid.append(docCard(doc));
    body.append(grid);
  }

  body.ondragover = (e) => {
    e.preventDefault();
    body.classList.add("dragover");
  };
  body.ondragleave = () => body.classList.remove("dragover");
  body.ondrop = (e) => {
    e.preventDefault();
    body.classList.remove("dragover");
    const assetId = e.dataTransfer.getData(MIME_ASSET);
    if (assetId) {
      if (bin && state.bin !== "") moveAssetToBin(assetId, state.bin);
      return;
    }
    const objectId = e.dataTransfer.getData(MIME_OBJECT);
    if (objectId) {
      if (bin) moveObjectToBin(objectId, state.bin);
      return;
    }
    const disk = e.dataTransfer.getData("text/forge-disk");
    if (disk) return importDiskFile(disk, bin ? state.bin : "");
    if (e.dataTransfer.files?.length) return uploadFiles(e.dataTransfer.files, bin ? state.bin : "");
  };
}

/* ─────────────────────── Library tab ─────────────────────── */

function renderLibrary() {
  renderBins();
  renderPool($("#libPool"), { bin: true, includeObjects: true, onSelect: (asset) => setLibPreview({ src: asset.href, name: assetName(asset), kind: asset.kind, info: `asset · ${binOfAsset(asset) || "assets/"}` }) });
  renderLibViewer();
  $("#poolPath").textContent = state.bin ? `assets/${state.bin}/` : "assets/";
  fillFileBrowser();
}

function renderBins() {
  const body = $("#mediaBins");
  if (!body) return;
  body.innerHTML = "";
  const counts = {};
  for (const a of state.assets) counts[binOfAsset(a)] = (counts[binOfAsset(a)] ?? 0) + 1;
  for (const o of state.objects) counts[binOfObject(o)] = (counts[binOfObject(o)] ?? 0) + 1;

  const all = el("div", { class: `bin-item ${state.bin === "" ? "on" : ""}` }, [
    icon("layers", 14),
    el("span", { class: "bi-name" }, ["All items"]),
    el("span", { class: "bi-count" }, [String(state.assets.length + state.docs.length + state.objects.length)]),
  ]);
  all.addEventListener("click", () => {
    state.bin = "";
    renderLibrary();
  });
  wireBinDrop(all, "");
  body.append(all);

  const known = new Set(state.folders);
  for (const bin of Object.keys(counts)) if (bin) known.add(bin);
  for (const bin of [...known].sort()) {
    const item = el("div", { class: `bin-item ${state.bin === bin ? "on" : ""}`, title: `assets/${bin}/` }, [
      icon("folder", 14),
      el("span", { class: "bi-name" }, [bin]),
      el("span", { class: "bi-count" }, [String(counts[bin] ?? 0)]),
    ]);
    item.addEventListener("click", () => {
      state.bin = bin;
      renderLibrary();
    });
    const del = el("button", { class: "bin-del", title: `Delete bin assets/${bin}/` }, [icon("trash", 12)]);
    del.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteBin(bin, counts[bin] ?? 0);
    });
    item.append(del);
    wireBinDrop(item, bin);
    body.append(item);
  }
  body.append(el("div", { class: "bin-hint" }, ["Drag media or components onto a bin to move them."]));
}

async function deleteBin(bin, count) {
  const objectCount = state.objects.filter((o) => binOfObject(o) === bin).length;
  const assetCount = state.assets.filter((a) => binOfAsset(a) === bin).length;
  const warn = [
    assetCount > 0 ? `remove ${assetCount} asset${assetCount === 1 ? "" : "s"}` : "",
    objectCount > 0 ? `move ${objectCount} component${objectCount === 1 ? "" : "s"} back to All` : "",
  ].filter(Boolean).join(" and ");
  if (!confirm(`Delete bin “${bin}”${warn ? ` and ${warn}` : ""}? This can't be undone.`)) return;
  try {
    const res = await postJson("/api/assets/folder/delete", { name: bin });
    if (!res.ok) throw new Error((res.errors || ["failed"]).join(" · "));
    state.objects = res.objects || state.objects;
    if (state.bin === bin) state.bin = "";
    if (state.createBin === bin) state.createBin = "";
    await refreshMedia();
    renderLibrary();
    toast(`Deleted bin “${bin}”.`);
  } catch (err) {
    toast(`delete failed — ${err.message}`, "err");
  }
}

function wireBinDrop(item, bin) {
  item.ondragover = (e) => {
    e.preventDefault();
    item.classList.add("dragover");
  };
  item.ondragleave = () => item.classList.remove("dragover");
  item.ondrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    item.classList.remove("dragover");
    const assetId = e.dataTransfer.getData(MIME_ASSET);
    if (assetId) return moveAssetToBin(assetId, bin);
    const objectId = e.dataTransfer.getData(MIME_OBJECT);
    if (objectId) return moveObjectToBin(objectId, bin);
    const disk = e.dataTransfer.getData("text/forge-disk");
    if (disk) return importDiskFile(disk, bin);
    if (e.dataTransfer.files?.length) return uploadFiles(e.dataTransfer.files, bin);
  };
}

/* file browser */
async function fillFileBrowser() {
  const rootsHost = $("#fbRoots");
  const list = $("#fbList");
  if (!rootsHost || !list) return;

  if (state.fsPath === null) {
    try {
      const { roots } = await getJson("/api/fs");
      state.fsRoots = roots || [];
      state.fsPath = state.fsRoots[0]?.path ?? null;
    } catch {
      state.fsRoots = [];
    }
  }

  rootsHost.innerHTML = "";
  for (const root of state.fsRoots) {
    const on = state.fsPath && (state.fsPath === root.path || state.fsPath.startsWith(root.path));
    const btn = el("button", { class: `fb-root ${on ? "on" : ""}`, title: root.path }, [root.name]);
    btn.addEventListener("click", () => {
      state.fsPath = root.path;
      fillFileBrowser();
    });
    rootsHost.append(btn);
  }

  if (!state.fsPath) {
    list.innerHTML = "";
    list.append(el("div", { class: "pool-hint" }, ["No browse roots available."]));
    return;
  }

  let listing;
  try {
    listing = await getJson(`/api/fs?path=${encodeURIComponent(state.fsPath)}`);
  } catch (err) {
    list.innerHTML = "";
    list.append(el("div", { class: "pool-hint" }, [`Cannot read folder — ${err.message}`]));
    return;
  }
  fillPathbar(listing.path);

  list.innerHTML = "";
  if (listing.parent) {
    const up = el("div", { class: "fb-item fb-up" }, [el("span", { class: "fi-ico" }, [icon("undo", 13)]), el("span", { class: "fi-name" }, [".."])]);
    up.addEventListener("click", () => {
      state.fsPath = listing.parent;
      fillFileBrowser();
    });
    list.append(up);
  }
  for (const d of listing.dirs) {
    const item = el("div", { class: "fb-item", title: d.path }, [el("span", { class: "fi-ico" }, [icon("folder", 14)]), el("span", { class: "fi-name" }, [d.name])]);
    item.addEventListener("click", () => {
      state.fsPath = d.path;
      fillFileBrowser();
    });
    list.append(item);
  }
  for (const f of listing.files) {
    const sel = state.preview && state.preview.diskPath === f.path;
    const item = el(
      "div",
      { class: `fb-item ${sel ? "sel" : ""}`, draggable: "true", title: `${f.path}\nclick to preview · drag into the pool · double-click imports` },
      [
        el("span", { class: "fi-ico" }, [icon(f.kind === "audio" ? "music" : f.kind === "video" ? "film" : "image", 14)]),
        el("span", { class: "fi-name" }, [f.name]),
        el("span", { class: "fi-size" }, [fmtBytes(f.size)]),
      ],
    );
    item.addEventListener("click", () => {
      setLibPreview({ src: `/api/fs/file?path=${encodeURIComponent(f.path)}`, name: f.name, kind: f.kind, info: `${fmtBytes(f.size)} · on disk`, diskPath: f.path });
      fillFileBrowser();
    });
    item.addEventListener("dblclick", () => importDiskFile(f.path));
    item.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/forge-disk", f.path);
      e.dataTransfer.effectAllowed = "copy";
    });
    list.append(item);
  }
  if (listing.dirs.length === 0 && listing.files.length === 0) {
    list.append(el("div", { class: "pool-hint" }, ["Empty folder (only media files are listed)."]));
  }
}

function fillPathbar(p) {
  const bar = $("#fbPathbar");
  if (!bar) return;
  bar.innerHTML = "";
  const sep = p.includes("\\") ? "\\" : "/";
  const parts = p.split(/[\\/]/).filter(Boolean);
  const crumbs = el("div", { class: "fb-crumbs" });
  let acc = p.startsWith("/") ? "" : null;
  parts.forEach((part, i) => {
    acc = acc === null ? part + sep : acc === "" ? sep + part : acc + (acc.endsWith(sep) ? "" : sep) + part;
    const target = acc;
    const here = i === parts.length - 1;
    const node = el("span", { class: `fb-crumb ${here ? "here" : ""}`, title: target }, [part]);
    if (!here)
      node.addEventListener("click", () => {
        state.fsPath = target;
        fillFileBrowser();
      });
    crumbs.append(node);
    if (!here) crumbs.append(el("span", { class: "crumb-sep" }, ["›"]));
  });
  bar.append(crumbs);
  crumbs.scrollLeft = crumbs.scrollWidth;
}

/* library viewer */
function setLibPreview(next) {
  const key = next.src || next.docId || next.object?.id || next.name;
  const prevKey = state.preview?.src || state.preview?.docId || state.preview?.object?.id || state.preview?.name;
  const changed = !state.preview || state.preview.kind !== next.kind || prevKey !== key;
  state.preview = next;
  if (changed) state.zoom = 1;
  renderLibViewer();
  $("#libViewerName").textContent = next.name;
}

function applyZoom(figure, valueEl) {
  if (figure) {
    figure.style.transform = `scale(${state.zoom})`;
  }
  if (valueEl) valueEl.textContent = state.zoom === 1 ? "Fit" : `${Math.round(state.zoom * 100)}%`;
}

function renderLibViewer() {
  const body = $("#libViewerBody");
  if (!body) return;
  body.innerHTML = "";
  const p = state.preview;
  const stage = el("div", { class: "mv-stage" });
  let mediaEl = null;
  let figure = null;

  if (!p) {
    stage.append(
      el("div", { class: "mv-empty" }, [
        el("div", { class: "mv-empty-ico" }, [icon("image", 30)]),
        el("div", { class: "mv-empty-line" }, ["Select a file or pool asset to preview"]),
        el("div", { class: "mv-empty-sub" }, ["Images, video and audio play here."]),
      ]),
    );
    body.append(stage);
    $("#libViewerName").textContent = "nothing selected";
    return;
  }

  if (p.kind === "doc") {
    const reader = el("pre", { class: "mv-doc mono" }, ["loading…"]);
    stage.append(el("div", { class: "mv-doc-wrap" }, [reader]));
    body.append(stage);
    body.append(el("div", { class: "mv-bar" }, [el("span", { class: "mono" }, [p.name]), el("span", { class: "mv-info" }, ["reference doc"])]));
    fetch(`/api/docs/file?id=${encodeURIComponent(p.docId)}`)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error("not found"))))
      .then((text) => (reader.textContent = text))
      .catch(() => (reader.textContent = "(could not load doc)"));
    $("#libViewerName").textContent = p.name;
    return;
  }

  if (p.kind === "component") {
    const frame = el("iframe", { class: "component-frame lib-component-frame", title: "component preview", sandbox: "allow-scripts" });
    frame.srcdoc = objectSrcDoc(p.object, { ...variableDefaults(p.object), ...(p.object.values || {}) });
    stage.append(frame);
    body.append(stage);
    const bar = el("div", { class: "mv-bar" }, [
      el("span", { class: "mono" }, [p.name]),
      el("span", { class: "mv-info" }, [`${p.object.components?.length || 0} parts · ${p.object.variables?.length || 0} tweaks`]),
    ]);
    const open = el("button", { class: "btn-sm" }, [icon("arrowUp", 12), "Open in Stage"]);
    open.addEventListener("click", () => openObjectOnStage(p.object));
    bar.append(open);
    body.append(bar);
    $("#libViewerName").textContent = p.name;
    return;
  }

  if (p.kind === "image") {
    mediaEl = el("img", { class: "mv-media", src: p.src, alt: p.name });
  } else if (p.kind === "video") {
    mediaEl = el("video", { class: "mv-media", src: p.src, controls: "true", preload: "metadata", playsinline: "true", loop: "true" });
  } else {
    stage.append(
      el("div", { class: "mv-audio-card" }, [
        el("div", { class: "mv-audio-ico" }, [icon("music", 26)]),
        el("div", { class: "mv-audio-name mono" }, [p.name]),
        el("audio", { src: p.src, controls: "true", preload: "metadata" }),
      ]),
    );
  }

  if (mediaEl) {
    figure = el("div", { style: "max-width:100%;max-height:100%;transition:transform 170ms cubic-bezier(.22,1,.36,1)" }, [mediaEl]);
    stage.append(figure);
  }
  body.append(stage);

  // controls
  const strip = el("div", { class: "mv-controls" });
  if (p.kind === "image" || p.kind === "video") {
    const value = el("span", { class: "mv-zoom-value" }, [state.zoom === 1 ? "Fit" : `${Math.round(state.zoom * 100)}%`]);
    const out = el("button", { class: "mini-btn", title: "Zoom out" }, [icon("zoomOut", 14)]);
    const inn = el("button", { class: "mini-btn", title: "Zoom in" }, [icon("zoomIn", 14)]);
    const fit = el("button", { class: "mini-btn", title: "Fit" }, [icon("fit", 14)]);
    out.addEventListener("click", () => {
      state.zoom = Math.max(0.25, Math.round((state.zoom - 0.25) * 100) / 100);
      applyZoom(figure, value);
    });
    inn.addEventListener("click", () => {
      state.zoom = Math.min(4, Math.round((state.zoom + 0.25) * 100) / 100);
      applyZoom(figure, value);
    });
    fit.addEventListener("click", () => {
      state.zoom = 1;
      applyZoom(figure, value);
    });
    strip.append(el("div", { class: "mv-control-group" }, [out, value, inn, fit]));
  }
  body.append(strip);

  const bar = el("div", { class: "mv-bar" }, [
    el("span", { class: "mono", title: p.diskPath ?? p.name }, [p.name]),
    el("span", { class: "mv-info" }, [p.info ?? ""]),
  ]);
  if (p.diskPath) {
    const add = el("button", { class: "btn-sm" }, [icon("plus", 12), "Add to pool"]);
    add.addEventListener("click", () => importDiskFile(p.diskPath));
    bar.append(add);
  }
  body.append(bar);
}

/* ─────────────────────── Stage tab ─────────────────────── */

const STAGE_PLACEHOLDER = `<!doctype html><html><head><style>
html,body{height:100%;margin:0;display:grid;place-items:center;background:#0b0c0e;color:#5d616a;font:500 14px/1.6 Inter,system-ui,sans-serif}
.box{text-align:center;max-width:32ch;padding:24px}
.box b{display:block;color:#8a8f98;font-weight:600;margin-bottom:6px}
</style></head><body><div class="box"><b>Nothing on the stage yet</b>Ask the agent to build an asset. It will render here and you can save it as a component.</div></body></html>`;

const CREATE_PLACEHOLDER = `<!doctype html><html><head><style>
html,body{height:100%;margin:0;display:grid;place-items:center;background:#0b0c0e;color:#5d616a;font:500 14px/1.6 Inter,system-ui,sans-serif}
.box{text-align:center;max-width:34ch;padding:24px}
.box b{display:block;color:#8a8f98;font-weight:600;margin-bottom:6px}
</style></head><body><div class="box"><b>Blank Create canvas</b>The Create agent is not wired yet. Saved Stage components are available in Media.</div></body></html>`;

function splitCssImports(css = "") {
  const imports = [];
  let rest = String(css || "");
  while (true) {
    const prefix = rest.match(/^\s*/)?.[0] || "";
    if (!rest.slice(prefix.length).startsWith("@import")) break;
    let quote = "";
    let depth = 0;
    let end = -1;
    for (let i = prefix.length; i < rest.length; i++) {
      const ch = rest[i];
      const prev = rest[i - 1];
      if (quote) {
        if (ch === quote && prev !== "\\") quote = "";
      } else if (ch === '"' || ch === "'") {
        quote = ch;
      } else if (ch === "(") {
        depth += 1;
      } else if (ch === ")" && depth > 0) {
        depth -= 1;
      } else if (ch === ";" && depth === 0) {
        end = i + 1;
        break;
      }
    }
    if (end === -1) break;
    imports.push(rest.slice(0, end).trim());
    rest = rest.slice(end);
  }
  return { imports: imports.join("\n"), css: rest };
}

function knobDefaultValues(knobs = []) {
  return Object.fromEntries((knobs || []).map((k) => [k.name, k.default]));
}

function cssImageValue(value) {
  const raw = value == null ? "" : String(value).trim();
  if (!raw) return "none";
  if (/^(none|url\()/i.test(raw)) return raw;
  return `url("${raw.replace(/["\\\n\r]/g, "\\$&")}")`;
}

function cssVarValue(knob, value) {
  if (knob?.type === "image") return cssImageValue(value);
  if (value == null) return "";
  return String(value);
}

function sourceUsesTailwind(source) {
  return /\b(?:class|className)\s*=\s*["'`][^"'`]*(?:bg-card|bg-background|text-muted-foreground|text-primary-foreground|border-input|ring-ring|rounded-(?:sm|md|lg|xl|2xl)|shadow-sm|h-9|inline-flex|grid-cols-|data-\[[^\]]+\]:)[^"'`]*["'`]/.test(String(source || ""));
}

function makeSrcDoc(asset, values = {}) {
  const knobs = asset.contract?.knobs || objectKnobs(asset);
  const merged = { ...knobDefaultValues(knobs), ...(asset.values || {}), ...(values || {}) };
  const cssVars = knobs.map((k) => `--${k.name}: ${cssVarValue(k, merged[k.name])};`).join("");
  const { imports, css } = splitCssImports(asset.css || "");
  const initVars = JSON.stringify(merged);
  const initKnobs = JSON.stringify(knobs);
  const initActions = JSON.stringify(asset.contract?.actions || asset.actions || []);
  const caps = asset.capabilities || {};
  const usesGsap = caps.gsap || /\bgsap\s*\./.test(`${asset.js || ""}\n${asset.react?.tsx || asset.react || ""}`);
  const usesReact = caps.react || !!asset.react;
  const usesTailwind = !!caps.tailwind || sourceUsesTailwind(`${asset.html || ""}\n${asset.css || ""}\n${asset.js || ""}\n${asset.react?.tsx || asset.react || ""}`);
  const vendorScripts = [
    usesTailwind ? '<script src="/static/vendor/forge-cn.js"></script>' : "",
    usesGsap ? '<script src="/static/vendor/gsap.min.js"></script>' : "",
    usesReact ? '<script src="/static/forgeReactRuntime.js"></script>' : "",
  ].filter(Boolean).join("\n");
  // shadcn/Tailwind: an empty tailwindcss-input style is filled from the vendored
  // shadcn theme, then the in-browser Tailwind build is loaded to compile the
  // utility classes (it observes the DOM, so React-rendered classes are caught).
  const tailwindHead = usesTailwind ? '<style id="forge-tw" type="text/tailwindcss"></style>' : "";
  const tailwindBoot = usesTailwind
    ? `<script>(function(){function load(){var t=document.createElement('script');t.src='/static/vendor/tailwindcss-browser.js';t.onerror=function(){console.error('Forge Tailwind runtime failed to load')};document.head.appendChild(t)}fetch('/static/vendor/shadcn-theme.css').then(function(r){if(!r.ok)throw new Error('theme '+r.status);return r.text()}).then(function(css){var s=document.getElementById('forge-tw');if(s)s.textContent=css}).catch(function(e){console.warn('Forge shadcn theme unavailable',e)}).finally(load)})();<\/script>`
    : "";
  return `<!doctype html><html><head><meta charset="utf-8"><style>
${imports}
:root{${cssVars}}
html,body{margin:0;width:100%;min-height:100%;overflow-x:hidden;overflow-y:auto;background:transparent}
*{box-sizing:border-box}
${css}
</style>${tailwindHead}</head><body>${asset.html || ""}
<script>window.__FORGE_VARS__=${initVars};window.__FORGE_KNOBS__=${initKnobs};window.__FORGE_ACTIONS__=${initActions};<\/script>
<script src="/static/forgeRuntime.js"><\/script>
${vendorScripts}
<script>${asset.js || ""}<\/script>
${tailwindBoot}
</body></html>`;
}

function renderStage() {
  buildAgentPane($("#stageAgent"), "stage");
  if (state.stage.asset) renderStagePreview();
  else setSrcDoc($("#stagePreview"), STAGE_PLACEHOLDER);
  renderPool($("#stagePool"), {
    bin: false,
    includeObjects: true,
    onSelect: (asset) => addAssetRef("stage", asset.id),
    onObjectSelect: (object) => {
      applyObjectToStage(object);
      toast(`Opened “${object.name}” on Stage.`);
    },
  });
  renderStageInspector();
}

function clearStageWorkflow() {
  state.chat.stage = [];
  state.refs.stage = [];
  state.stage = { asset: null, values: {}, mediaBindings: {}, contract: null, busy: false };
  const prompt = $("#stagePrompt");
  if (prompt) {
    prompt.value = "";
    prompt.style.height = "";
  }
  $("#stagePreview").srcdoc = STAGE_PLACEHOLDER;
  renderStage();
  toast("Stage cleared.");
}

/* The Stage preview iframe: the asset wrapped in a scrollable motion viewport,
 * with knob values pre-applied as CSS vars + the forge runtime injected. */
function stageSrcDoc(asset, values) {
  return makeSrcDoc(asset, values);
}

function renderStagePreview() {
  const frame = $("#stagePreview");
  if (frame && state.stage.asset) setSrcDoc(frame, stageSrcDoc(state.stage.asset, state.stage.values));
}

/** Adopt a freshly generated/edited asset: render it and rebuild Tweaks. */
function applyStageAsset(asset) {
  state.stage.asset = asset;
  state.stage.contract = asset.contract || { parts: [], knobs: [], actions: [] };
  state.stage.values = { ...knobDefaultValues(state.stage.contract.knobs), ...(asset.values || {}) };
  state.stage.mediaBindings = Object.fromEntries((asset.mediaBindings || []).map((binding) => [binding.knob, binding]));
  renderStagePreview();
  renderStageInspector();
}

function objectStageAsset(object) {
  const contract = object.contract || {
    parts: object.components || parseComponents(object.html),
    knobs: objectKnobs(object),
    actions: object.actions || [],
  };
  return {
    id: object.id,
    name: object.name,
    html: object.html || "",
    css: object.css || "",
    js: object.js || "",
    react: object.react,
    capabilities: object.capabilities,
    contract,
    values: { ...knobDefaultValues(contract.knobs), ...(object.values || {}) },
    mediaBindings: object.mediaBindings || [],
  };
}

function applyObjectToStage(object, { render = true } = {}) {
  if (!object) return;
  state.stage.asset = objectStageAsset(object);
  state.stage.contract = state.stage.asset.contract;
  state.stage.values = { ...state.stage.asset.values };
  state.stage.mediaBindings = Object.fromEntries((state.stage.asset.mediaBindings || []).map((binding) => [binding.knob, binding]));
  if (render) {
    renderStagePreview();
    renderStageInspector();
  }
}

function openObjectOnStage(object) {
  applyObjectToStage(object);
  setTab("stage");
  toast(`Opened “${object.name}” on Stage.`);
}

/** Push a single tweak into the live preview without a full reload. */
function setStageVar(name, value) {
  state.stage.values[name] = value;
  const frame = $("#stagePreview");
  frame?.contentWindow?.postMessage({ type: "forge:setVar", name, value }, "*");
}

function clearStageImageVar(knob) {
  delete state.stage.mediaBindings[knob.name];
  setStageVar(knob.name, "");
  renderStageInspector();
}

function setStageImageAsset(knob, asset) {
  if (!asset) return clearStageImageVar(knob);
  const binding = {
    knob: knob.name,
    assetId: asset.id,
    href: asset.href,
    path: asset.path,
    kind: asset.kind,
    label: assetName(asset),
  };
  state.stage.mediaBindings[knob.name] = binding;
  setStageVar(knob.name, asset.href);
  renderStageInspector();
}

async function uploadStageImageKnob(knob, file) {
  try {
    const res = await fetch(`/api/assets/upload?name=${encodeURIComponent(file.name || `${knob.name}.png`)}&folder=${encodeURIComponent("stage-tweaks")}`, {
      method: "POST",
      body: file,
    });
    const json = await res.json();
    if (!json.ok) throw new Error((json.errors || ["upload failed"]).join(" · "));
    await refreshMedia();
    const asset = state.assets.find((a) => a.id === json.assetId) || json.outline?.assets?.find((a) => a.id === json.assetId);
    if (asset) setStageImageAsset(knob, asset);
    toast(`Uploaded ${file.name || "image"}.`, "ok");
  } catch (err) {
    toast(`image upload failed — ${err.message}`, "err");
  }
}

/** Fire an action in the live preview (the "test" button — same call the Motion AI uses). */
function triggerStageAction(name) {
  const frame = $("#stagePreview");
  frame?.contentWindow?.postMessage({ type: "forge:trigger", name }, "*");
}

function renderStageInspector() {
  const body = $("#stageInspectorBody");
  if (!body) return;
  body.innerHTML = "";
  const asset = state.stage.asset;
  const contract = state.stage.contract;

  if (!asset) {
    body.append(
      el("div", { class: "empty" }, [
        el("div", { class: "empty-ico" }, [icon("sliders", 26)]),
        el("div", { class: "empty-title" }, ["No tweaks yet"]),
        el("div", { class: "empty-sub" }, [
          "You can only tweak what the agent exposes. When it marks a value as public — a color, a label, a radius — its control appears here.",
        ]),
      ]),
    );
    return;
  }

  // asset name + save
  const nameInput = el("input", { value: asset.name });
  nameInput.addEventListener("input", () => (asset.name = nameInput.value.trim() || "Untitled asset"));
  body.append(el("label", { class: "fld" }, [el("span", {}, ["Asset name"]), nameInput]));

  // knobs (Tweaks)
  const knobs = el("div", { class: "section" }, [el("h3", {}, ["Tweaks"])]);
  if (!contract.knobs.length) {
    knobs.append(el("div", { class: "empty small" }, [el("div", { class: "empty-sub" }, ["The agent didn't expose any knobs. Ask it to expose one (a color, label, or radius)."])]));
  } else {
    for (const k of contract.knobs) knobs.append(stageKnobControl(k));
  }
  body.append(knobs);

  // actions (interactions the Motion AI can trigger)
  const actions = el("div", { class: "section" }, [el("h3", {}, ["Interactions"])]);
  if (!contract.actions.length) {
    actions.append(el("div", { class: "empty small" }, [el("div", { class: "empty-sub" }, ["No declared interactions."])]));
  } else {
    for (const a of contract.actions) {
      const row = el("div", { class: "action-row" }, [
        el("div", { class: "ar-meta" }, [
          el("div", { class: "ar-name mono" }, [a.name]),
          el("div", { class: "ar-sub" }, [a.affects ? `→ ${a.affects}` : a.label || ""]),
        ]),
      ]);
      const test = el("button", { class: "btn-sm", title: "Trigger this interaction in the preview" }, [icon("play", 12), "Test"]);
      test.addEventListener("click", () => triggerStageAction(a.name));
      row.append(test);
      actions.append(row);
    }
  }
  body.append(actions);

  // named parts (what the Motion AI can animate)
  const parts = el("div", { class: "section" }, [el("h3", {}, ["Animatable parts"])]);
  if (!contract.parts.length) parts.append(el("div", { class: "empty small" }, [el("div", { class: "empty-sub" }, ["No named parts — ask the agent to mark elements with data-forge-component."])]));
  else parts.append(el("div", { class: "tagrow" }, contract.parts.map((p) => el("span", { class: "part-tag" }, [p]))));
  body.append(parts);

  // save to library
  const save = el("button", { class: "primary" }, ["Save to library"]);
  save.addEventListener("click", () => saveStageAsset(asset));
  body.append(el("div", { class: "section" }, [save]));
}

/** Render one Tweak control by type; every change drives the live preview. */
function stageKnobControl(k) {
  const value = state.stage.values[k.name] ?? k.default;
  if (k.type === "boolean") {
    const input = el("input", { type: "checkbox" });
    input.checked = value === true || value === "true";
    input.addEventListener("change", () => setStageVar(k.name, input.checked));
    return el("label", { class: "checkrow" }, [input, k.label]);
  }
  if (k.type === "image") {
    const wrap = el("div", { class: "fld knob image-knob" }, [el("span", {}, [k.label])]);
    const binding = state.stage.mediaBindings[k.name];
    const preview = el("div", { class: `image-knob-preview ${value ? "" : "empty"}` });
    if (value) preview.append(el("img", { src: String(value), alt: binding?.label || k.label }));
    else preview.append(el("span", {}, ["No image selected"]));
    const images = state.assets.filter((asset) => asset.kind === "image");
    const select = el("select", {}, [
      el("option", { value: "" }, ["Choose from media pool"]),
      ...images.map((asset) => el("option", { value: asset.id, selected: binding?.assetId === asset.id || value === asset.href }, [assetName(asset)])),
    ]);
    select.addEventListener("change", () => {
      const asset = state.assets.find((item) => item.id === select.value);
      if (asset) setStageImageAsset(k, asset);
    });
    const file = el("input", { type: "file", accept: "image/*", hidden: true });
    file.addEventListener("change", () => {
      const picked = file.files?.[0];
      if (picked) void uploadStageImageKnob(k, picked);
      file.value = "";
    });
    const upload = el("button", { type: "button", class: "btn-sm" }, [icon("upload", 12), "Upload"]);
    upload.addEventListener("click", () => file.click());
    const clear = el("button", { type: "button", class: "btn-sm" }, [icon("x", 12), "Clear"]);
    clear.addEventListener("click", () => clearStageImageVar(k));
    wrap.append(preview, select, el("div", { class: "knob-button-row" }, [upload, clear]), file);
    return wrap;
  }
  if (k.type === "color") {
    const wrap = el("label", { class: "fld knob" }, [el("span", {}, [k.label])]);
    const color = el("input", { type: "color", value: String(value) });
    const text = el("input", { type: "text", value: String(value) });
    color.addEventListener("input", () => { text.value = color.value; setStageVar(k.name, color.value); });
    text.addEventListener("input", () => { color.value = text.value; setStageVar(k.name, text.value); });
    wrap.append(el("div", { class: "knob-color-row" }, [color, text]));
    return wrap;
  }
  if (k.type === "select") {
    const wrap = el("label", { class: "fld knob" }, [el("span", {}, [k.label])]);
    const sel = el("select", { onchange: (e) => setStageVar(k.name, e.target.value) },
      (k.options || []).map((o) => el("option", { value: o, selected: String(o) === String(value) }, [o])));
    wrap.append(sel);
    return wrap;
  }
  if (k.type === "choice") {
    const wrap = el("label", { class: "fld knob" }, [el("span", {}, [k.label])]);
    const seg = el("div", { class: "seg knob-seg" });
    for (const o of k.options || []) {
      const b = el("button", { type: "button", class: String(o) === String(value) ? "active" : "" }, [o]);
      b.addEventListener("click", () => {
        for (const c of seg.children) c.classList.toggle("active", c === b);
        setStageVar(k.name, o);
      });
      seg.append(b);
    }
    wrap.append(seg);
    return wrap;
  }
  if (k.type === "range") {
    const wrap = el("label", { class: "fld knob" }, [el("span", {}, [k.label])]);
    const out = el("span", { class: "knob-range-val mono" }, [String(value)]);
    const input = el("input", { type: "range", value: String(value) });
    if (k.min != null) input.min = String(k.min);
    if (k.max != null) input.max = String(k.max);
    if (k.step != null) input.step = String(k.step);
    input.addEventListener("input", () => {
      out.textContent = input.value;
      setStageVar(k.name, Number(input.value));
    });
    wrap.querySelector("span").append(out);
    wrap.append(input);
    return wrap;
  }
  // text / number
  const wrap = el("label", { class: "fld knob" }, [el("span", {}, [k.label])]);
  const input = el("input", { type: k.type === "number" ? "number" : "text", value: String(value) });
  if (k.type === "number") {
    if (k.min != null) input.min = String(k.min);
    if (k.max != null) input.max = String(k.max);
    if (k.step != null) input.step = String(k.step);
  }
  input.addEventListener("input", () => setStageVar(k.name, k.type === "number" ? Number(input.value) : input.value));
  wrap.append(input);
  return wrap;
}

async function saveStageAsset(asset) {
  try {
    const res = await postJson("/api/objects/save", {
      id: asset.id,
      name: asset.name,
      html: asset.html,
      css: asset.css,
      js: asset.js,
      react: asset.react,
      capabilities: asset.capabilities,
      values: state.stage.values,
      mediaBindings: Object.values(state.stage.mediaBindings || {}),
    });
    if (!res.ok) throw new Error((res.errors || ["save failed"]).join(" · "));
    state.objects = res.objects || state.objects;
    if (res.object) {
      state.stage.asset.id = res.object.id;
      state.stage.asset.values = res.object.values;
      state.stage.asset.mediaBindings = res.object.mediaBindings;
      state.activeObjectId = res.object.id;
    }
    if (state.tab === "library") renderLibrary();
    if (state.tab === "stage") renderStage();
    toast(`Saved “${res.object?.name || asset.name}” as a component.`, "ok");
  } catch (err) {
    toast(`save failed — ${err.message}`, "err");
  }
}

// The forge runtime reports back when an asset is ready / an action fired.
window.addEventListener("message", (e) => {
  const d = e.data;
  if (!d || typeof d !== "object") return;
  if (d.type === "forge:ready" && state.tab === "stage") {
    // contract from live DOM is advisory; the parsed contract stays canonical.
  }
  if (d.type === "forge:var" && state.stage.asset && d.name) {
    state.stage.values[d.name] = d.value;
  }
});

/* ─────────────────────── Create tab (object authoring) ─────────────────────── */

function parseComponents(html) {
  const names = new Set();
  for (const m of String(html || "").matchAll(/\bdata-forge-(?:component|part)\s*=\s*["']([^"']+)["']/gi)) {
    const clean = m[1]?.trim();
    if (clean) names.add(clean);
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}
function parseAttrs(tail) {
  const out = {};
  const re = /([a-zA-Z][\w-]*)\s*=\s*("[^"]*"|'[^']*'|[^\s*]+)/g;
  for (const m of String(tail || "").matchAll(re)) {
    out[m[1].toLowerCase()] = String(m[2] || "").replace(/^["']|["']$/g, "").trim();
  }
  return out;
}
function parseOptions(raw) {
  if (!raw) return undefined;
  const list = String(raw).split(/[,|]/).map((s) => s.trim()).filter(Boolean);
  return list.length ? list : undefined;
}
function asKnobType(raw) {
  const t = String(raw || "").toLowerCase();
  if (["text", "number", "range", "color", "boolean", "select", "choice", "image"].includes(t)) return t;
  if (t === "string") return "text";
  if (t === "bool" || t === "toggle" || t === "checkbox") return "boolean";
  if (t === "dropdown" || t === "enum") return "select";
  if (t === "segmented" || t === "buttons") return "choice";
  if (t === "slider") return "range";
  if (t === "media" || t === "asset" || t === "photo" || t === "picture") return "image";
  return "text";
}
function coerceDefault(raw, type) {
  if (type === "number" || type === "range") {
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  }
  if (type === "boolean") return raw === true || raw === "true" || raw === "1" || raw === "on";
  return raw == null ? "" : String(raw);
}
function parseVariables(source) {
  const out = [];
  const seen = new Set();
  const pattern = /@forge-var\s+([a-zA-Z][\w-]*)\s+([^\n\r*]+)/gi;
  for (const m of String(source || "").matchAll(pattern)) {
    const name = m[1];
    if (seen.has(name)) continue;
    seen.add(name);
    const a = parseAttrs(m[2]);
    const type = asKnobType(a.type);
    const rawDefault = a.default ?? (type === "boolean" ? "false" : type === "number" || type === "range" ? "0" : "");
    const knob = { name, type, default: coerceDefault(rawDefault, type), label: a.label || name, exposed: true };
    const options = parseOptions(a.options);
    if (options) knob.options = options;
    for (const key of ["min", "max", "step"]) {
      if (a[key] == null) continue;
      const n = Number(a[key]);
      if (Number.isFinite(n)) knob[key] = n;
    }
    if ((type === "select" || type === "choice") && !knob.options && typeof knob.default === "string") {
      knob.options = parseOptions(knob.default);
      if (knob.options) knob.default = knob.options[0];
    }
    out.push(knob);
  }
  return out;
}
function objectKnobs(object) {
  return Array.isArray(object?.variables) && object.variables.length
    ? object.variables
    : parseVariables(`${object?.html || ""}\n${object?.css || ""}\n${object?.js || ""}`);
}
function objectSource() {
  return {
    id: state.activeObjectId || undefined,
    name: $("#createCompName").textContent.trim() || "Untitled component",
    html: $("#objectHtml").value,
    css: $("#objectCss").value,
    js: $("#objectJs").value,
    ...(state.objectExtras.react ? { react: state.objectExtras.react } : {}),
    ...(state.objectExtras.capabilities ? { capabilities: state.objectExtras.capabilities } : {}),
    values: state.objectValues,
    mediaBindings: Object.values(state.objectMediaBindings || {}),
  };
}
function defaultComponent() {
  return {
    name: "Untitled component",
    html: "",
    css: "",
    js: "",
  };
}
function variableDefaults(object) {
  return knobDefaultValues(objectKnobs(object));
}
function objectSrcDoc(object, values = state.objectValues) {
  return makeSrcDoc({ ...object, contract: object.contract || { parts: parseComponents(object.html), knobs: objectKnobs(object), actions: object.actions || [] } }, values);
}
function setObjectSource(object) {
  const next = object || defaultComponent();
  state.activeObjectId = next.id || null;
  $("#createCompName").textContent = next.name || "Untitled component";
  $("#objectHtml").value = next.html || "";
  $("#objectCss").value = next.css || "";
  $("#objectJs").value = next.js || "";
  state.objectValues = { ...variableDefaults(next), ...(next.values || {}) };
  state.objectMediaBindings = Object.fromEntries((next.mediaBindings || []).map((binding) => [binding.knob, binding]));
  state.objectExtras = {
    ...(next.react ? { react: next.react } : {}),
    ...(next.capabilities ? { capabilities: next.capabilities } : {}),
  };
  updateObjectPreview();
}
function markObjectCodeEdited() {
  state.objectExtras = {};
  updateObjectPreview();
}
function updateObjectPreview() {
  const object = objectSource();
  const hasSource = Boolean(object.html.trim() || object.css.trim() || object.js.trim());
  $("#createPreview").srcdoc = hasSource ? objectSrcDoc(object) : CREATE_PLACEHOLDER;
  if (state.tab === "create" && state.createInspTab === "inspector") renderCreateInspector();
}

async function loadObjects() {
  const data = await getJson("/api/objects");
  state.objects = data.objects || [];
}

async function loadDrafts() {
  try {
    const data = await getJson("/api/create/drafts");
    state.drafts = data.drafts || [];
    state.currentDraft = data.current || null;
    state.activeDraftId = data.currentId || state.currentDraft?.id || null;
    state.createAspectLocked = Boolean(state.currentDraft);
    if (state.currentDraft?.aspect) state.createRatio = state.currentDraft.aspect;
  } catch {
    state.drafts = [];
    state.currentDraft = null;
    state.activeDraftId = null;
    state.createAspectLocked = false;
  }
}

/* Standard delivery ratios — this value will later be handed to the agent, so it
 * is always one of these named ratios, never an arbitrary frame size. */
const RATIOS = [
  { id: "16:9", label: "16:9 · YouTube / landscape", r: 16 / 9 },
  { id: "9:16", label: "9:16 · Shorts / Reels / TikTok", r: 9 / 16 },
  { id: "1:1", label: "1:1 · Square", r: 1 },
  { id: "4:5", label: "4:5 · Instagram portrait", r: 4 / 5 },
  { id: "4:3", label: "4:3 · Classic", r: 4 / 3 },
  { id: "21:9", label: "21:9 · Cinematic", r: 21 / 9 },
  { id: "custom", label: "Custom...", r: 16 / 9 },
];

function ratioValue(id) {
  const known = RATIOS.find((x) => x.id === id && id !== "custom");
  if (known) return known.r;
  const match = /^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/.exec(String(id || ""));
  if (match) {
    const w = Number(match[1]);
    const h = Number(match[2]);
    if (w > 0 && h > 0) return w / h;
  }
  return 16 / 9;
}

function ensureRatioOption(id) {
  const sel = $("#createRatio");
  if (!sel || !id || RATIOS.some((r) => r.id === id) || [...sel.options].some((o) => o.value === id)) return;
  sel.insertBefore(el("option", { value: id }, [id]), sel.querySelector('option[value="custom"]'));
}

function sizeCreateFrame() {
  const stage = $("#createPreviewPane");
  const frame = $("#createPreview");
  if (!stage || !frame) return;
  const ratio = ratioValue(state.createRatio);
  const pad = 40; // .component-stage padding (20px each side)
  const aw = stage.clientWidth - pad;
  const ah = stage.clientHeight - pad;
  if (aw <= 0 || ah <= 0) return;
  let w = aw;
  let h = w / ratio;
  if (h > ah) {
    h = ah;
    w = h * ratio;
  }
  frame.style.width = `${Math.round(w)}px`;
  frame.style.height = `${Math.round(h)}px`;
}

function currentDraftComponent(draft = state.currentDraft) {
  if (!draft) return null;
  for (const id of draft.components || []) {
    const object = state.objects.find((item) => item.id === id);
    if (object) return object;
  }
  return state.objects[0] || null;
}

function jsLiteral(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function createPreviewScript(draft) {
  const data = {
    timeline: draft.timeline || [],
    actions: draft.actions || [],
    knobs: draft.knobAutomation || [],
    durationSec: draft.durationSec || 5,
    loop: Boolean(state.createLoop),
    autoplay: true,
  };
  return `<script>
(function(){
  function boot(){
    if(!window.gsap){ setTimeout(boot, 30); return; }
    var data=${jsLiteral(data)};
    var tl=gsap.timeline({ paused:true, repeat:data.loop?-1:0, defaults:{ overwrite:"auto" } });
    // Resolve a named part, preferring the component (asset) it belongs to so two
    // components sharing a part name never collide.
    function target(asset, name){
      if(!name) return null;
      var sel='[data-forge-component="'+CSS.escape(name)+'"],[data-forge-part="'+CSS.escape(name)+'"]';
      if(asset){
        var scope=document.querySelector('[data-forge-asset="'+CSS.escape(asset)+'"]');
        if(scope){ var hit=scope.querySelector(sel); if(hit) return hit; }
      }
      return document.querySelector(sel);
    }
    // Only TRUE 3D moves (tilt/perspective/depth) on a root/background-named part
    // produce the "flat backdrop rotates with the UI" artifact. A root opacity
    // fade, uniform punch-in scale, or 2D pan is meant for the whole frame — leave
    // those on root so we don't yank intentional framing onto a random child.
    function hasCameraVars(vars){
      return Object.keys(vars||{}).some(function(k){ return /^(z|rotationX|rotationY|rotateX|rotateY|perspective|transformPerspective)$/.test(k); });
    }
    function foregroundFor(el, name, vars){
      if(!el || !hasCameraVars(vars)) return el;
      if(!/^(root|container|inner|stage|viewport|screen|frame|canvas|page|app|background|backdrop)$/i.test(String(name||""))) return el;
      var candidates=[].slice.call(el.querySelectorAll('[data-forge-component],[data-forge-part]')).filter(function(node){ return node !== el; });
      if(!candidates.length) return el;
      var preferred=candidates.find(function(node){
        var n=node.getAttribute('data-forge-component') || node.getAttribute('data-forge-part') || "";
        return /card|panel|modal|dialog|button|input|form|settings|table|chart|tile|row|toast|drawer|nav/i.test(n) &&
          !/background|backdrop|canvas|stage|screen|page|root/i.test(n);
      });
      return preferred || candidates[0] || el;
    }
    // Deterministic scroll: tween an element's scrollTop/scrollLeft via a proxy so
    // a snippet can move to content below the fold without any GSAP plugin.
    function splitScroll(vars){
      var move={}, scroll={};
      Object.keys(vars||{}).forEach(function(k){
        if(k==="scrollTop"||k==="scrollLeft") scroll[k]=Number(vars[k])||0; else move[k]=vars[k];
      });
      return { move:move, scroll:scroll };
    }
    function tweenScroll(el, prop, to, at, dur, ease){
      var proxy={ v: el[prop]||0 };
      tl.to(proxy, { v:to, duration:dur, ease:ease, onUpdate:function(){ el[prop]=proxy.v; } }, at);
    }
    data.knobs.forEach(function(k){
      tl.call(function(){ if(window.forge) window.forge.setVar(k.name, k.value); }, null, Math.max(0, Number(k.at)||0));
    });
    data.actions.forEach(function(a){
      tl.call(function(){ if(window.forge) window.forge.trigger(a.trigger); }, null, Math.max(0, Number(a.at)||0));
    });
    data.timeline.forEach(function(step){
      var el=target(step.asset, step.target);
      if(!el) return;
      var at=Math.max(0, Number(step.at)||0);
      var dur=Math.max(0, Number(step.duration)||0.35);
      var ease=step.ease || "power3.out";
      var raw = step.op==="from" ? (step.vars||step.from||{}) : (step.vars||step.to||{});
      var allVars=Object.assign({}, step.from||{}, step.to||{}, step.vars||{});
      el=foregroundFor(el, step.target, allVars);
      if(step.op==="count"){
        var cm=Object.assign({}, step.to||{}, step.vars||{});
        var cto=Number(cm.value)||0, pre=cm.prefix!=null?String(cm.prefix):"", suf=cm.suffix!=null?String(cm.suffix):"";
        var co={ v:0 }, cfmt=function(v){ return pre+Math.round(v).toLocaleString("en-US")+suf; };
        el.textContent=cfmt(0);
        tl.to(co, { v:cto, duration:Math.max(dur,0.6), ease:ease, onUpdate:function(){ el.textContent=cfmt(co.v); } }, at);
        return;
      }
      if(step.op==="set"){ tl.set(el, splitScroll(step.vars||step.to).move, at);
        var s0=splitScroll(step.vars||step.to).scroll; Object.keys(s0).forEach(function(p){ tl.call(function(){ el[p]=s0[p]; }, null, at); }); return; }
      var sp=splitScroll(raw);
      if(step.op==="to"){ if(Object.keys(sp.move).length) tl.to(el, Object.assign({}, sp.move, { duration:dur, ease:ease }), at); }
      else if(step.op==="from"){ if(Object.keys(sp.move).length) tl.from(el, Object.assign({}, sp.move, { duration:dur, ease:ease }), at); }
      else { tl.fromTo(el, step.from || {}, Object.assign({}, splitScroll(step.to||{}).move, { duration:dur, ease:ease }), at); sp.scroll=splitScroll(step.to||{}).scroll; }
      Object.keys(sp.scroll).forEach(function(p){ tweenScroll(el, p, sp.scroll[p], at, dur, ease); });
    });
    if(!data.timeline.length){
      tl.fromTo(document.body,{opacity:0,y:24},{opacity:1,y:0,duration:0.45,ease:"power3.out"},0);
    }
    var minDur=Math.max(Number(data.durationSec)||0, tl.duration() || 0.1);
    if(tl.duration() < minDur) tl.to({}, {duration:minDur - tl.duration()});
    window.__forgeCreateTimeline=tl;
    window.addEventListener("message", function(event){
      var msg=event.data||{};
      if(msg.type==="create:play") tl.play();
      if(msg.type==="create:pause") tl.pause();
      if(msg.type==="create:restart") tl.restart();
      if(msg.type==="create:loop"){ tl.repeat(msg.on?-1:0); if(msg.on) tl.play(); }
      if(msg.type==="create:progress") tl.pause().progress(Math.max(0, Math.min(1, Number(msg.progress)||0)));
    });
    tl.eventCallback("onUpdate", function(){
      parent.postMessage({ type:"create:progress", progress:tl.progress(), time:tl.time(), duration:tl.duration() }, "*");
    });
    if(data.autoplay) tl.play(0); else tl.pause(0);
  }
  boot();
})();<\/script>`;
}

/**
 * Merge every component a draft references into one previewable asset. Each
 * component is wrapped in a `display:contents` shell tagged with its id so the
 * timeline can scope a part to the right component, while flow layout is
 * unchanged for the common single-component case.
 */
function mergeDraftComponents(objects) {
  const wrap = (o) => `<div data-forge-asset="${o.id}" style="display:contents">${o.html || ""}</div>`;
  if (objects.length === 1) {
    const o = objects[0];
    return {
      ...o,
      html: wrap(o),
      capabilities: { ...(o.capabilities || {}), gsap: true },
      values: { ...variableDefaults(o), ...(o.values || {}) },
    };
  }
  const capabilities = { gsap: true };
  let react;
  const values = {};
  const mediaBindings = [];
  for (const o of objects) {
    if (o.capabilities?.react || o.react) {
      capabilities.react = true;
      if (!react && o.react) react = o.react;
    }
    if (o.capabilities?.tailwind) capabilities.tailwind = true;
    Object.assign(values, variableDefaults(o), o.values || {});
    for (const b of o.mediaBindings || []) mediaBindings.push(b);
  }
  return {
    id: objects.map((o) => o.id).join("+"),
    name: objects.map((o) => o.name).join(" + "),
    html: objects.map(wrap).join("\n"),
    css: objects.map((o) => o.css || "").join("\n"),
    js: objects.map((o) => o.js || "").filter(Boolean).join("\n;\n"),
    ...(react ? { react } : {}),
    capabilities,
    values,
    mediaBindings,
    contract: {
      parts: objects.flatMap((o) => o.components || []),
      knobs: objects.flatMap((o) => o.variables || []),
      actions: objects.flatMap((o) => o.actions || []),
    },
  };
}

function draftComponents(draft) {
  const picked = (draft?.components || [])
    .map((id) => state.objects.find((o) => o.id === id))
    .filter(Boolean);
  if (picked.length) return picked;
  const fallback = currentDraftComponent(draft);
  return fallback ? [fallback] : [];
}

function draftSrcDoc(draft) {
  const objects = draftComponents(draft);
  if (!objects.length) return CREATE_PLACEHOLDER;
  const merged = mergeDraftComponents(objects);
  return objectSrcDoc(merged, merged.values).replace("</body></html>", `${createPreviewScript(draft)}</body></html>`);
}

function applyCreateDraft(draft) {
  state.currentDraft = draft;
  state.activeDraftId = draft.id;
  state.createAspectLocked = true;
  state.createRatio = draft.aspect || state.createRatio;
  if (!state.drafts.some((item) => item.id === draft.id)) state.drafts.unshift(draft);
  else state.drafts = state.drafts.map((item) => (item.id === draft.id ? draft : item));
  updateCreatePreview();
  renderCreateInspector();
  if (state.tab === "export") renderExport();
}

async function switchCreateDraft(id) {
  if (!id || id === state.currentDraft?.id) return;
  const local = state.drafts.find((item) => item.id === id);
  if (local) applyCreateDraft(local);
  try {
    await postJson("/api/create/drafts/current", { id });
  } catch {
    /* best-effort: the local apply already updated the UI */
  }
}

async function deleteCreateDraftRow(id) {
  try {
    const data = await postJson("/api/create/drafts/delete", { id });
    state.drafts = data.drafts || state.drafts.filter((item) => item.id !== id);
    state.currentDraft = data.current ?? (state.currentDraft?.id === id ? null : state.currentDraft);
    state.activeDraftId = data.currentId ?? state.currentDraft?.id ?? null;
    state.createAspectLocked = Boolean(state.currentDraft);
    if (state.currentDraft?.aspect) state.createRatio = state.currentDraft.aspect;
    updateCreatePreview();
    renderCreateInspector();
    if (state.tab === "export") renderExport();
    toast("Draft deleted.");
  } catch (err) {
    toast(`Couldn't delete draft — ${err.message}`, "err");
  }
}

function updateCreatePreview() {
  const draft = state.currentDraft;
  $("#createCompName").textContent = draft ? draft.name : "no draft";
  const ratio = $("#createRatio");
  if (ratio) {
    ensureRatioOption(state.createRatio);
    ratio.value = state.createRatio;
    ratio.disabled = state.createAspectLocked;
    ratio.title = state.createAspectLocked ? "Aspect locked for this draft. Start a new draft to change it." : "Aspect ratio";
  }
  $("#objectHtml").value = draft ? JSON.stringify(draft, null, 2) : "";
  $("#objectCss").value = draft?.compiledMotion ? JSON.stringify(draft.compiledMotion, null, 2) : draft?.liftSource || "";
  $("#objectJs").value = draft ? (draft.validation || []).map((v) => `${v.level.toUpperCase()} ${v.code}: ${v.message}`).join("\n") : "";
  setSrcDoc($("#createPreview"), draft ? draftSrcDoc(draft) : CREATE_PLACEHOLDER);
  sizeCreateFrame();
}

function sendCreatePlayback(type, payload = {}) {
  const frame = $("#createPreview");
  frame?.contentWindow?.postMessage({ type, ...payload }, "*");
}

function renderCreate() {
  buildAgentPane($("#createAgent"), "create");
  updateCreatePreview();
  renderCreateInspector();
  sizeCreateFrame();
}

function renderDraftInspector(body) {
  const draft = state.currentDraft;
  if (!draft) {
    body.append(
      el("div", { class: "empty" }, [
        el("div", { class: "empty-ico" }, [icon("film", 26)]),
        el("div", { class: "empty-title" }, ["No motion draft yet"]),
        el("div", { class: "empty-sub" }, ["Reference saved components or storyboard frames, then ask Create for a motion snippet."]),
      ]),
    );
  } else {
    const errors = (draft.validation || []).filter((v) => v.level === "error");
    body.append(
      el("div", { class: "section" }, [
        el("h3", {}, ["Draft"]),
        el("div", { class: "kv" }, [el("span", { class: "k" }, ["Name"]), el("span", { class: "v" }, [draft.name])]),
        el("div", { class: "kv" }, [el("span", { class: "k" }, ["Route"]), el("span", { class: "v" }, [draft.route])]),
        el("div", { class: "kv" }, [el("span", { class: "k" }, ["Primitive"]), el("span", { class: "v" }, [draft.primitiveKind])]),
        el("div", { class: "kv" }, [el("span", { class: "k" }, ["Aspect"]), el("span", { class: "v" }, [`${draft.aspect} locked`])]),
        el("div", { class: "kv" }, [el("span", { class: "k" }, ["Duration"]), el("span", { class: "v" }, [`${Number(draft.durationSec || 0).toFixed(1)}s`])]),
        el("div", { class: `status ${errors.length ? "err" : "ok"}` }, [errors.length ? `${errors.length} issue${errors.length === 1 ? "" : "s"} to repair` : "Ready for Export"]),
      ]),
    );

    const taxonomy = draft.taxonomy || {};
    body.append(
      el("div", { class: "section" }, [
        el("h3", {}, ["Motion categories"]),
        el("div", { class: "tagrow" }, [
          taxonomy.family ? el("span", { class: "part-tag" }, [taxonomy.family]) : null,
          taxonomy.subject ? el("span", { class: "part-tag" }, [taxonomy.subject]) : null,
          taxonomy.action ? el("span", { class: "part-tag" }, [taxonomy.action]) : null,
          ...(taxonomy.technique || []).map((t) => el("span", { class: "part-tag" }, [t])),
          taxonomy.energy ? el("span", { class: "part-tag" }, [taxonomy.energy]) : null,
          taxonomy.style ? el("span", { class: "part-tag" }, [taxonomy.style]) : null,
        ].filter(Boolean)),
      ]),
    );

    const validation = el("div", { class: "section" }, [el("h3", {}, ["Validation"])]);
    if (!(draft.validation || []).length) validation.append(el("div", { class: "empty small" }, [el("div", { class: "empty-sub" }, ["No validation messages."])]));
    for (const item of draft.validation || []) {
      validation.append(el("div", { class: `validation-row ${item.level}` }, [el("b", {}, [item.code]), el("span", {}, [item.message])]));
    }
    body.append(validation);
  }

  const selected = el("div", { class: "section" }, [el("h3", {}, ["Selected components"])]);
  const selectedObjects = (draft?.components || []).map((id) => state.objects.find((o) => o.id === id)).filter(Boolean);
  if (!selectedObjects.length) selected.append(el("div", { class: "empty small" }, [el("div", { class: "empty-sub" }, ["No component selected. Drag one into chat or pick from the library below."])]));
  for (const object of selectedObjects) {
    selected.append(el("div", { class: "object-pill" }, [el("b", {}, [object.name]), el("small", {}, [`${object.components.length} parts`])]));
  }
  body.append(selected);

  const actions = el("div", { class: "section" });
  const newBtn = el("button", { class: "btn-sm", type: "button" }, [icon("plus", 12), "New draft"]);
  newBtn.addEventListener("click", () => {
    state.currentDraft = null;
    state.activeDraftId = null;
    state.createAspectLocked = false;
    updateCreatePreview();
    renderCreateInspector();
    toast("Create is ready for a new draft.");
  });
  const repair = el("button", { class: "btn-sm", type: "button" }, [icon("wand", 12), "Repair validation"]);
  repair.disabled = !draft || !(draft.validation || []).some((v) => v.level === "error");
  repair.addEventListener("click", () => {
    const prompt = $("#createPrompt");
    if (prompt) {
      prompt.value = "Repair the validation errors in the current draft while keeping the same aspect and motion concept.";
      prompt.focus();
    }
  });
  actions.append(el("div", { class: "knob-button-row" }, [newBtn, repair]));
  body.append(actions);

  if ((state.drafts || []).length > 1 || (state.drafts || []).length === 1) {
    const variants = el("div", { class: "section" }, [el("h3", {}, [`Drafts (${state.drafts.length})`])]);
    for (const item of state.drafts) {
      const bad = (item.validation || []).filter((v) => v.level === "error").length;
      const row = el("div", { class: `draft-row ${item.id === draft?.id ? "sel" : ""}` });
      const main = el("button", { class: "dr-main", type: "button", title: "Open this draft" }, [
        el("span", { class: "dr-name" }, [item.name || "Motion draft"]),
        el("small", {}, [`${item.route || "route"} · ${(item.timeline || []).length} beats · ${bad ? `${bad} issue${bad === 1 ? "" : "s"}` : "ok"}`]),
      ]);
      main.addEventListener("click", () => switchCreateDraft(item.id));
      const del = el("button", { class: "dr-del", type: "button", title: "Delete draft" }, [icon("trash", 12)]);
      del.addEventListener("click", (e) => {
        e.stopPropagation();
        deleteCreateDraftRow(item.id);
      });
      row.append(main, del);
      variants.append(row);
    }
    body.append(variants);
  }

  const lib = el("div", { class: "section" }, [el("h3", {}, ["Component library"])]);
  if (!state.objects.length) {
    lib.append(el("div", { class: "empty small" }, [el("div", { class: "empty-sub" }, ["No saved components yet. Build one in Stage."])]));
  } else {
    const list = el("div", { class: "object-list" });
    for (const object of state.objects) {
      const row = objectRow(object, {
        selected: draft?.components?.includes(object.id),
        onClick: () => addObjectRef("create", object.id),
      });
      list.append(row);
    }
    lib.append(list);
  }
  body.append(lib);
}

function renderCreateInspector() {
  const insp = state.createInspTab;
  $("#createInspectorBody").classList.toggle("hidden", insp !== "inspector");
  $("#createMediaPool").classList.toggle("hidden", insp !== "media");
  for (const b of document.querySelectorAll("#createInspectorTabs button")) b.classList.toggle("active", b.dataset.inspTab === insp);

  if (insp === "media") {
    renderCreateMedia($("#createMediaPool"));
    return;
  }

  const body = $("#createInspectorBody");
  body.innerHTML = "";
  renderDraftInspector(body);
}

function knobControl(v) {
  const value = state.objectValues[v.name] ?? v.default;
  const wrap = el("label", { class: "fld knob" }, [el("span", {}, [v.label])]);
  let input;
  if (v.type === "boolean") {
    input = el("input", { type: "checkbox" });
    input.checked = value === true || value === "true";
    const row = el("label", { class: "checkrow" }, [input, v.label]);
    input.addEventListener("change", () => updateKnob(v.name, input.checked));
    return row;
  }
  if (v.type === "image") {
    const box = el("div", { class: "fld knob image-knob" }, [el("span", {}, [v.label])]);
    const binding = state.objectMediaBindings[v.name];
    const preview = el("div", { class: `image-knob-preview ${value ? "" : "empty"}` });
    if (value) preview.append(el("img", { src: String(value), alt: binding?.label || v.label }));
    else preview.append(el("span", {}, ["No image selected"]));
    const images = state.assets.filter((asset) => asset.kind === "image");
    const select = el("select", {}, [
      el("option", { value: "" }, ["Choose from media pool"]),
      ...images.map((asset) => el("option", { value: asset.id, selected: binding?.assetId === asset.id || value === asset.href }, [assetName(asset)])),
    ]);
    select.addEventListener("change", () => {
      const asset = state.assets.find((item) => item.id === select.value);
      if (!asset) return;
      state.objectMediaBindings[v.name] = { knob: v.name, assetId: asset.id, href: asset.href, path: asset.path, kind: asset.kind, label: assetName(asset) };
      updateKnob(v.name, asset.href);
      renderCreateInspector();
    });
    const clear = el("button", { type: "button", class: "btn-sm" }, [icon("x", 12), "Clear"]);
    clear.addEventListener("click", () => {
      delete state.objectMediaBindings[v.name];
      updateKnob(v.name, "");
      renderCreateInspector();
    });
    box.append(preview, select, el("div", { class: "knob-button-row" }, [clear]));
    return box;
  }
  if (v.type === "color") {
    const color = el("input", { type: "color", value: String(value) });
    const text = el("input", { type: "text", value: String(value) });
    color.addEventListener("input", () => {
      text.value = color.value;
      updateKnob(v.name, color.value);
    });
    text.addEventListener("input", () => {
      color.value = text.value;
      updateKnob(v.name, text.value);
    });
    wrap.append(el("div", { class: "knob-color-row" }, [color, text]));
    return wrap;
  }
  if (v.type === "select") {
    const sel = el("select", { onchange: (e) => updateKnob(v.name, e.target.value) },
      (v.options || []).map((o) => el("option", { value: o, selected: String(o) === String(value) }, [o])));
    wrap.append(sel);
    return wrap;
  }
  if (v.type === "choice") {
    const seg = el("div", { class: "seg knob-seg" });
    for (const o of v.options || []) {
      const b = el("button", { type: "button", class: String(o) === String(value) ? "active" : "" }, [o]);
      b.addEventListener("click", () => {
        for (const c of seg.children) c.classList.toggle("active", c === b);
        updateKnob(v.name, o);
      });
      seg.append(b);
    }
    wrap.append(seg);
    return wrap;
  }
  if (v.type === "range") {
    const out = el("span", { class: "knob-range-val mono" }, [String(value)]);
    input = el("input", { type: "range", value: String(value) });
    if (v.min != null) input.min = String(v.min);
    if (v.max != null) input.max = String(v.max);
    if (v.step != null) input.step = String(v.step);
    input.addEventListener("input", () => {
      out.textContent = input.value;
      updateKnob(v.name, Number(input.value));
    });
    wrap.querySelector("span").append(out);
    wrap.append(input);
    return wrap;
  }
  input = el("input", { type: v.type === "number" ? "number" : "text", value: String(value) });
  if (v.type === "number") {
    if (v.min != null) input.min = String(v.min);
    if (v.max != null) input.max = String(v.max);
    if (v.step != null) input.step = String(v.step);
  }
  input.addEventListener("input", () => updateKnob(v.name, v.type === "number" ? Number(input.value) : input.value));
  wrap.append(input);
  return wrap;
}

function updateKnob(name, val) {
  state.objectValues[name] = val;
  $("#createPreview").srcdoc = objectSrcDoc(objectSource());
}

/** A component row: a clickable face + a delete button (no nested buttons). */
function objectRow(object, { selected, onClick }) {
  const row = el("div", { class: `object-row ${selected ? "sel" : ""}` });
  const main = el("button", { class: "or-main" }, [
    el("span", { class: "or-name" }, [object.name]),
    el("small", {}, [`${object.components.length} parts`]),
  ]);
  main.addEventListener("click", onClick);
  const del = el("button", { class: "or-del", title: "Delete component" }, [icon("trash", 13)]);
  del.addEventListener("click", (e) => {
    e.stopPropagation();
    deleteObject(object.id);
  });
  row.append(main, del);
  return row;
}

async function deleteObject(id) {
  const object = state.objects.find((o) => o.id === id);
  if (!confirm(`Delete “${object?.name ?? "this component"}”? This can't be undone.`)) return;
  try {
    const res = await postJson("/api/objects/delete", { id });
    if (!res.ok) throw new Error((res.errors || ["could not delete"]).join(" · "));
    state.objects = res.objects || [];
    if (state.activeObjectId === id) setObjectSource(null);
    if (state.exportId === id) state.exportId = state.objects[0]?.id || null;
    if (state.stage.asset?.id === id) state.stage = { asset: null, values: {}, mediaBindings: {}, contract: null, busy: false };
    if (state.preview?.object?.id === id) state.preview = null;
    for (const which of ["stage", "create"]) state.refs[which] = state.refs[which].filter((r) => !(r.kind === "component" && r.id === id));
    if (state.tab === "library") renderLibrary();
    if (state.tab === "stage") renderStage();
    if (state.tab === "create") renderCreateInspector();
    if (state.tab === "export") renderExport();
    toast("Component deleted.");
  } catch (err) {
    toast(`delete failed — ${err.message}`, "err");
  }
}

function buildObjectList() {
  const list = el("div", { class: "object-list" });
  if (state.objects.length === 0) {
    list.append(el("div", { class: "empty small" }, [el("div", { class: "empty-sub" }, ["No saved components yet."])]));
    return list;
  }
  for (const object of state.objects) {
    list.append(
      objectRow(object, {
        selected: object.id === state.activeObjectId,
        onClick: () => {
          setObjectSource(object);
          renderCreateInspector();
        },
      }),
    );
  }
  return list;
}

async function saveObject() {
  const result = await postJson("/api/objects/save", objectSource());
  if (!result.ok) return toast("Could not save component.", "err");
  state.objects = result.objects || [];
  setObjectSource(result.object);
  renderCreateInspector();
  toast(`Saved “${result.object.name}”.`, "ok");
}

/* ─────────────────────── Export tab ─────────────────────── */

function currentExportObject() {
  return state.objects.find((o) => o.id === state.exportId) || state.objects[0] || null;
}

function renderComponentExportLegacy() {
  const body = $("#exportBody");
  body.innerHTML = "";

  if (state.objects.length === 0) {
    body.append(
      el("div", { class: "empty" }, [
        el("div", { class: "empty-ico" }, [icon("layers", 26)]),
        el("div", { class: "empty-title" }, ["No components to export"]),
        el("div", { class: "empty-sub" }, ["Build and save a component in Create first."]),
      ]),
    );
    $("#exportPreview").srcdoc = STAGE_PLACEHOLDER;
    $("#exportPreviewName").textContent = "no component selected";
    return;
  }

  const object = currentExportObject();
  state.exportId = object.id;

  // component picker
  const pick = el("div", { class: "section" }, [el("h3", {}, ["Component"])]);
  const list = el("div", { class: "object-list" });
  for (const o of state.objects) {
    list.append(
      objectRow(o, {
        selected: o.id === state.exportId,
        onClick: () => {
          state.exportId = o.id;
          renderExport();
        },
      }),
    );
  }
  pick.append(list);
  body.append(pick);

  // export fields
  const nameInput = el("input", { id: "exportName", value: slug(object.name) });
  const summary = el("textarea", { id: "exportSummary", rows: "4", placeholder: "What this component is for in Sequences (20+ chars)." }, [
    `${object.name} component exported from Forge for Sequences.`,
  ]);
  body.append(
    el("div", { class: "section" }, [
      el("h3", {}, ["Handoff"]),
      el("label", { class: "fld" }, [el("span", {}, ["Export name"]), nameInput]),
      el("label", { class: "fld" }, [el("span", {}, ["Summary"]), summary]),
    ]),
  );

  // extracted contract (read-only)
  const contract = el("div", { class: "section" }, [el("h3", {}, ["Extension contract"])]);
  contract.append(
    el("div", { class: "kv" }, [el("span", { class: "k" }, ["Named parts"]), el("span", { class: "v" }, [object.components.join(", ") || "root"])]),
    el("div", { class: "kv" }, [el("span", { class: "k" }, ["Public knobs"]), el("span", { class: "v" }, [object.variables.map((v) => v.name).join(", ") || "none"])]),
    el("div", { class: "kv" }, [el("span", { class: "k" }, ["Bundle id"]), el("span", { class: "v" }, [`enter.${slug(nameInput.value || object.name)}`])]),
  );
  nameInput.addEventListener("input", () => {
    contract.querySelector(".kv:last-child .v").textContent = `enter.${slug(nameInput.value || object.name)}`;
  });
  body.append(contract);
  body.append(el("div", { class: "export-note" }, ["Forge writes a Sequences-compatible .seqext bundle: the component skeleton plus standardized media-slot placeholders. Your bytes are not shipped."]));

  // preview
  $("#exportPreview").srcdoc = objectSrcDoc(object, { ...variableDefaults(object), ...(object.values || {}) });
  $("#exportPreviewName").textContent = object.name;
}

async function exportComponent() {
  const object = currentExportObject();
  if (!object) return setExportStatus("Save a component first.", "err");
  const result = await postJson("/api/objects/export", {
    objectId: object.id,
    name: $("#exportName")?.value.trim(),
    summary: $("#exportSummary")?.value.trim(),
  });
  if (result.ok) setExportStatus(`Exported “${object.name}”.`, "ok");
  else setExportStatus((result.errors || ["Export failed."]).join("; "), "err");
}

function fillComponentExportAiLegacy() {
  // Presentational for now — AI authoring of export metadata lands in a later pass.
  const object = currentExportObject();
  const summary = $("#exportSummary");
  if (object && summary) {
    summary.value = `${object.name}: a reusable component with ${object.variables.length} tunable knob${object.variables.length === 1 ? "" : "s"} and ${object.components.length || 1} named part${object.components.length === 1 ? "" : "s"}, ready to drop into a Sequences scene.`;
  }
  toast("AI fill isn't wired up yet — drafted a placeholder summary.");
}

const EXPORT_PLACEHOLDER = `<!doctype html><html><head><style>
html,body{height:100%;margin:0;display:grid;place-items:center;background:#0b0c0e;color:#737985;font:500 14px/1.6 Inter,system-ui,sans-serif}
.box{text-align:center;max-width:36ch;padding:24px}
.box b{display:block;color:#a4a9b3;font-weight:650;margin-bottom:6px}
</style></head><body><div class="box"><b>Extension export</b>Export packages the current Create motion draft as a Sequences .seqext. Stage components stay in the Library for authoring context.</div></body></html>`;

function extensionIdFromFields() {
  const kind = $("#exportKind")?.value || "enter";
  const name = $("#exportName")?.value.trim() || "forge-extension";
  return `${kind}.${slug(name)}`;
}

function renderExport() {
  const body = $("#exportBody");
  body.innerHTML = "";
  const draft = state.currentDraft;

  if (!draft) {
    body.append(
      el("div", { class: "empty" }, [
        el("div", { class: "empty-ico" }, [icon("film", 26)]),
        el("div", { class: "empty-title" }, ["No Create draft"]),
        el("div", { class: "empty-sub" }, ["Use Create to generate and validate a motion Extension draft before exporting."]),
      ]),
    );
    setSrcDoc($("#exportPreview"), EXPORT_PLACEHOLDER);
    $("#exportPreviewName").textContent = "no extension draft";
    return;
  }

  const nameInput = el("input", { id: "exportName", value: slug(draft.name || "forge-extension") });
  const kind = el(
    "select",
    { id: "exportKind" },
    ["enter", "exit", "emphasis", "continuous"].map((value) => el("option", { value, selected: value === draft.primitiveKind }, [value])),
  );
  const summary = el("textarea", { id: "exportSummary", rows: "4", placeholder: "What this Extension contributes to Sequences (20+ chars)." }, [
    draft.summary || "A Forge-authored motion graphics Extension for Sequences.",
  ]);

  body.append(
    el("div", { class: "section" }, [
      el("h3", {}, ["Extension"]),
      el("label", { class: "fld" }, [el("span", {}, ["Name"]), nameInput]),
      el("label", { class: "fld" }, [el("span", {}, ["Primitive"]), kind]),
      el("label", { class: "fld" }, [el("span", {}, ["Summary"]), summary]),
    ]),
  );

  const bundleValue = el("span", { class: "v mono" }, [extensionIdFromFields()]);
  const syncBundleId = () => (bundleValue.textContent = extensionIdFromFields());
  nameInput.addEventListener("input", syncBundleId);
  kind.addEventListener("change", syncBundleId);
  body.append(
    el("div", { class: "section" }, [
      el("h3", {}, ["Bundle"]),
      el("div", { class: "kv" }, [el("span", { class: "k" }, ["Bundle id"]), bundleValue]),
      el("div", { class: "kv" }, [el("span", { class: "k" }, ["Source"]), el("span", { class: "v" }, ["Create motion draft"])]),
      el("div", { class: "kv" }, [el("span", { class: "k" }, ["Components"]), el("span", { class: "v" }, [String(draft.components?.length || 0)])]),
      el("div", { class: "kv" }, [el("span", { class: "k" }, ["Aspect"]), el("span", { class: "v" }, [draft.aspect])]),
    ]),
  );

  const taxonomy = draft.taxonomy || {};
  body.append(el("div", { class: "section" }, [
    el("h3", {}, ["Library metadata"]),
    el("div", { class: "tagrow" }, [
      taxonomy.family ? el("span", { class: "part-tag" }, [taxonomy.family]) : null,
      taxonomy.subject ? el("span", { class: "part-tag" }, [taxonomy.subject]) : null,
      taxonomy.action ? el("span", { class: "part-tag" }, [taxonomy.action]) : null,
      ...(taxonomy.technique || []).map((t) => el("span", { class: "part-tag" }, [t])),
    ].filter(Boolean)),
  ]));

  body.append(el("div", { class: "section" }, [
    el("h3", {}, ["Validation"]),
    ...(draft.validation || []).map((item) => el("div", { class: `validation-row ${item.level}` }, [el("b", {}, [item.code]), el("span", {}, [item.message])])),
  ]));
  body.append(el("div", { class: "export-note" }, ["Export writes a Sequences-compatible .seqext from the current Create document. Saved Stage components are context for Create and are not exported directly."]));

  const exportPreviewSrc = `/forge-create-preview/${encodeURIComponent(draft.id)}.html`;
  const exportFrame = $("#exportPreview");
  // guard against reloading (white flash) when re-rendering on tab switch
  if (exportFrame.getAttribute("srcdoc") !== null || exportFrame.getAttribute("src") !== exportPreviewSrc) {
    exportFrame.removeAttribute("srcdoc");
    exportFrame.src = exportPreviewSrc;
  }
  $("#exportPreviewName").textContent = draft.name;
}

async function exportExtension() {
  const id = extensionIdFromFields();
  const result = await postJson("/api/doc/export", {
    draftId: state.currentDraft?.id,
    id,
    primitiveKind: $("#exportKind")?.value || "enter",
    summary: $("#exportSummary")?.value.trim() || "A Forge-authored motion graphics Extension for Sequences.",
  });
  if (result.ok) setExportStatus(`Exported ${id}.`, "ok");
  else setExportStatus((result.errors || ["Export failed."]).join("; "), "err");
}

function fillWithAi() {
  const summary = $("#exportSummary");
  const draft = state.currentDraft;
  if (summary && draft) summary.value = draft.summary;
  toast(draft ? "Filled from the current Create draft." : "Create a draft first.");
}

function setExportStatus(message, kind = "") {
  const el2 = $("#exportStatus");
  if (!el2) return;
  el2.textContent = message;
  el2.className = `status ${kind}`.trim();
}

/* ─────────────────────── wiring ─────────────────────── */

for (const button of document.querySelectorAll(".tab")) button.addEventListener("click", () => setTab(button.dataset.tab));

for (const button of document.querySelectorAll("#createViewTabs button")) {
  button.addEventListener("click", () => {
    const view = button.dataset.createView;
    for (const b of document.querySelectorAll("#createViewTabs button")) b.classList.toggle("active", b === button);
    $("#createPreviewPane").classList.toggle("hidden", view !== "preview");
    $("#createPlayback").classList.toggle("hidden", view !== "preview");
    $("#createCodePane").classList.toggle("hidden", view !== "code");
    if (view === "preview") sizeCreateFrame();
  });
}

$("#createPlay")?.addEventListener("click", () => sendCreatePlayback("create:play"));
$("#createPause")?.addEventListener("click", () => sendCreatePlayback("create:pause"));
$("#createRestart")?.addEventListener("click", () => {
  const scrub = $("#createScrub");
  if (scrub) scrub.value = "0";
  sendCreatePlayback("create:restart");
});
$("#createLoop")?.addEventListener("click", () => {
  state.createLoop = !state.createLoop;
  $("#createLoop")?.classList.toggle("on", state.createLoop);
  sendCreatePlayback("create:loop", { on: state.createLoop });
});
$("#createScrub")?.addEventListener("input", (e) => {
  const progress = Number(e.target.value) / 1000;
  sendCreatePlayback("create:progress", { progress });
});
window.addEventListener("message", (event) => {
  const msg = event.data || {};
  if (msg.type !== "create:progress") return;
  const scrub = $("#createScrub");
  if (scrub && document.activeElement !== scrub) scrub.value = String(Math.round((Number(msg.progress) || 0) * 1000));
  const time = $("#createTime");
  if (time) {
    const t = Number(msg.time) || 0;
    const d = Number(msg.duration) || 0;
    time.textContent = d ? `${t.toFixed(1)} / ${d.toFixed(1)}s` : `${t.toFixed(1)}s`;
  }
});

// aspect-ratio dropdown for the Create viewer
const ratioSel = $("#createRatio");
for (const r of RATIOS) ratioSel.append(el("option", { value: r.id, selected: r.id === state.createRatio }, [r.label]));
ratioSel.addEventListener("change", () => {
  if (ratioSel.value === "custom") {
    const raw = prompt("Custom aspect ratio (for example 3:2, 2.39:1, 1080:1350):", state.createRatio.includes(":") ? state.createRatio : "16:9");
    if (!raw || !/^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/.test(raw.trim())) {
      ratioSel.value = state.createRatio;
      return;
    }
    state.createRatio = raw.trim();
    ensureRatioOption(state.createRatio);
    ratioSel.value = state.createRatio;
    sizeCreateFrame();
    return;
  }
  state.createRatio = ratioSel.value;
  sizeCreateFrame();
});
// keep the framed viewer fitted as its pane resizes
if (window.ResizeObserver) new ResizeObserver(() => sizeCreateFrame()).observe($("#createPreviewPane"));
window.addEventListener("resize", () => {
  if (state.tab === "create") sizeCreateFrame();
});

for (const button of document.querySelectorAll("#createInspectorTabs button")) {
  button.addEventListener("click", () => {
    state.createInspTab = button.dataset.inspTab;
    renderCreateInspector();
  });
}

for (const id of ["objectHtml", "objectCss", "objectJs"]) $(`#${id}`).addEventListener("input", markObjectCodeEdited);

$("#libImport").addEventListener("change", (e) => {
  if (e.target.files?.length) uploadFiles(e.target.files);
  e.target.value = "";
});

$("#addBin").addEventListener("click", async () => {
  const name = prompt("Bin name (a folder inside assets/):", "");
  if (!name?.trim()) return;
  try {
    const res = await postJson("/api/assets/folder", { name: name.trim() });
    if (!res.ok) throw new Error((res.errors || ["failed"]).join(" · "));
    state.bin = name.trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
    await refreshMedia();
    renderLibrary();
  } catch (err) {
    toast(`bin failed — ${err.message}`, "err");
  }
});

$("#exportComponent").addEventListener("click", exportExtension);
$("#fillAi").addEventListener("click", fillWithAi);
$("#stageClear").addEventListener("click", clearStageWorkflow);

/* ─────────────────────── resizable panes ─────────────────────── */

/** Mount a drag handle on `panel` that writes a px size into `cssVar` on
 * `container`. `getSize(ev, rect)` derives the size from the pointer. */
function mountResizer(panel, { container, cssVar, axis, edge, getSize, min, max }) {
  if (!panel || !container) return;
  const handle = el("div", { class: `resizer ${axis === "y" ? "ry" : "rx"} ${edge}` });
  handle.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    handle.setPointerCapture(e.pointerId);
    handle.classList.add("dragging");
    document.body.style.cursor = axis === "y" ? "row-resize" : "col-resize";
    document.body.style.userSelect = "none";
    const move = (ev) => {
      const rect = container.getBoundingClientRect();
      const v = Math.max(min, Math.min(max, getSize(ev, rect)));
      container.style.setProperty(cssVar, `${v}px`);
    };
    const up = () => {
      handle.classList.remove("dragging");
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
  });
  panel.append(handle);
}

function setupResizers() {
  const libTop = document.querySelector(".lib-top");
  const libBottom = document.querySelector(".lib-bottom");
  const viewLibrary = document.querySelector(".view-library");
  const viewStage = document.querySelector(".view-stage");
  const viewCreate = document.querySelector(".view-create");

  // Library: file view width
  mountResizer($("#fileBrowser"), { container: libTop, cssVar: "--lib-fb-w", axis: "x", edge: "right", min: 200, max: 560, getSize: (ev, r) => ev.clientX - r.left });
  // Library: bins width
  mountResizer($("#libBins"), { container: libBottom, cssVar: "--lib-bins-w", axis: "x", edge: "right", min: 130, max: 380, getSize: (ev, r) => ev.clientX - r.left });
  // Library: bottom row height (handle on the top edge of lib-bottom)
  mountResizer(libBottom, { container: viewLibrary, cssVar: "--lib-bottom-h", axis: "y", edge: "top", min: 150, max: 560, getSize: (ev, r) => r.bottom - ev.clientY });

  // Stage: agent width + inspector width
  mountResizer($("#stageAgent"), { container: viewStage, cssVar: "--stage-agent-w", axis: "x", edge: "right", min: 240, max: 520, getSize: (ev, r) => ev.clientX - r.left });
  mountResizer($("#stageInspector"), { container: viewStage, cssVar: "--stage-insp-w", axis: "x", edge: "left", min: 240, max: 520, getSize: (ev, r) => r.right - ev.clientX });

  // Create: agent width + inspector width
  mountResizer($("#createAgent"), { container: viewCreate, cssVar: "--create-agent-w", axis: "x", edge: "right", min: 240, max: 520, getSize: (ev, r) => ev.clientX - r.left });
  mountResizer($("#createInspector"), { container: viewCreate, cssVar: "--create-insp-w", axis: "x", edge: "left", min: 260, max: 540, getSize: (ev, r) => r.right - ev.clientX });
}

/* boot */
hydrateIcons();
setupResizers();
await loadProviders();
await loadDoc();
await loadObjects();
await loadDrafts();
setObjectSource(null);
setTab("library");
boot("ready");
