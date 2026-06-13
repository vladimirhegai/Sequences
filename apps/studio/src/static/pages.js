/* Workspace pages — the DaVinci-style tab strip in the top bar and the page
 * framework (plan Part II §8.5). The Timeline page is the original editor in
 * app.js; this file owns switching plus the References, Render, and
 * Extensions pages. Media/Design/Storyboard live in their own files.
 *
 * Load order: this file loads BEFORE app.js but every function here runs
 * AFTER app.js init — so referencing app.js globals (state, el, icon, api…)
 * inside function bodies is safe. */

const PAGE_ICONS = {
  bookmark: '<path d="M7 3h10a1 1 0 0 1 1 1v17l-6-4-6 4V4a1 1 0 0 1 1-1z"/>',
  grid2: '<rect x="3" y="4" width="8" height="7" rx="1"/><rect x="13" y="4" width="8" height="7" rx="1"/><rect x="3" y="13" width="8" height="7" rx="1"/><rect x="13" y="13" width="8" height="7" rx="1"/>',
  sliders: '<path d="M5 21v-6M5 11V3M12 21v-10M12 7V3M19 21v-4M19 13V3M2 15h6M9 7h6M16 17h6"/>',
  clapper: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M7.5 3l3 6M13.5 3l3 6"/>',
  box: '<path d="M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  pen: '<path d="m15 5 4 4L8 20l-5 1 1-5z"/>',
  cursor: '<path d="m5 3 14 7-6.5 1.6L9 18z" stroke-linejoin="round"/>',
  circle: '<circle cx="12" cy="12" r="8"/>',
  line: '<path d="M5 19 19 5"/>',
  arrow: '<path d="M5 19 17 7M17 7h-6.5M17 7v6.5"/>',
  comment2: '<path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.3c-1.2 0-2.4-.2-3.4-.7L4 20l1-4.2A8.3 8.3 0 1 1 21 11.5z"/>',
  save: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>',
  home: '<path d="m3 11 9-8 9 8M5 9.5V21h14V9.5"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-2.6-6.4M21 3v5h-5"/>',
  route: '<circle cx="6" cy="19" r="2.5"/><circle cx="18" cy="5" r="2.5"/><path d="M8.5 19H15a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h6.5" stroke-dasharray="3 2.4"/>',
};

const PAGES = [
  { id: "references", label: "References", icon: "bookmark" },
  { id: "media", label: "Media", icon: "folder" },
  { id: "design", label: "Design", icon: "pen" },
  { id: "storyboard", label: "Storyboard", icon: "grid2" },
  { id: "timeline", label: "Timeline", icon: "sliders" },
  { id: "render", label: "Render", icon: "clapper" },
  { id: "extensions", label: "Extensions", icon: "box" },
];

let activePage = "timeline";

/** Per-page hooks: onEnter (first display + every activation), onState
 * (project/state changed while the page is active). */
const PAGE_HOOKS = {};

function pageHost(id) {
  return $(`page-${id}`);
}

function setPage(id) {
  if (activePage === id) return;
  activePage = id;
  for (const p of PAGES) pageHost(p.id).classList.toggle("on", p.id === id);
  renderPageTabs();
  PAGE_HOOKS[id]?.onEnter?.();
}

function renderPageTabs() {
  const nav = $("pageTabs");
  nav.innerHTML = "";
  for (const p of PAGES) {
    const tab = el("button", { class: `page-tab ${p.id === activePage ? "on" : ""}`, title: p.label });
    tab.append(
      el("span", { class: "pt-ico" }, [icon(p.icon, 13)]),
      el("span", { class: "pt-label" }, [p.label]),
    );
    tab.onclick = () => setPage(p.id);
    nav.appendChild(tab);
  }
}

function initPages() {
  Object.assign(ICONS, PAGE_ICONS);
  renderPageTabs();
  renderReferencesPage();
  renderExtensionsPage();
  PAGE_HOOKS.references = { onEnter: () => renderReferencesPage(), onState: () => renderReferencesPage() };
  PAGE_HOOKS.media = { onEnter: () => renderMediaPage(), onState: () => renderMediaPage() };
  PAGE_HOOKS.design = { onEnter: () => enterDesignPage(), onState: () => designOnState() };
  PAGE_HOOKS.storyboard = { onEnter: () => enterStoryboardPage(), onState: () => storyboardOnState() };
  PAGE_HOOKS.render = { onEnter: () => renderRenderPage(), onState: () => renderRenderPage() };
  PAGE_HOOKS.extensions = { onEnter: () => renderExtensionsPage(), onState: () => renderExtensionsPage() };
}

/** Called from app.js render() after every state change. */
function renderActivePage() {
  PAGE_HOOKS[activePage]?.onState?.();
}

/** Project switched — drop page-local editing state. */
function resetPagesForProject() {
  designResetForProject();
  storyboardResetForProject();
  mediaResetForProject();
  if (activePage !== "timeline") PAGE_HOOKS[activePage]?.onEnter?.();
}

/* ============================================================
   REFERENCES — Phase-3 shell (layout in place, honestly empty)
   ============================================================ */

function renderReferencesPage() {
  const host = pageHost("references");
  host.innerHTML = "";
  const wrap = el("div", { class: "refs-wrap" });
  const inner = el("div", { class: "refs-inner" });

  inner.append(
    el("div", { class: "refs-hero" }, [
      el("div", { class: "refs-icon" }, [icon("bookmark", 22)]),
      el("h2", { class: "refs-h2" }, ["References"]),
      el("p", { class: "refs-lead" }, [
        "A quiet pinboard for the work that sets the tone — landing pages, motion you admire, projects worth remixing — kept beside the canvas so the agent can read it.",
      ]),
      el("span", { class: "phase-tag" }, ["Arrives in Phase 3"]),
    ]),
  );

  const cats = [
    ["bookmark", "Websites", "Pin a URL; it shares plumbing with the brand-kit scraper."],
    ["clapper", "Motion examples", "Clips and reels that capture the feel you're after."],
    ["box", "Example projects", "Remixable Sequences projects — the template gallery."],
  ];
  const list = el("div", { class: "refs-cats" });
  for (const [ico, title, desc] of cats) {
    list.append(
      el("div", { class: "refs-cat" }, [
        el("span", { class: "refs-cat-ico" }, [icon(ico, 15)]),
        el("div", { class: "refs-cat-meta" }, [
          el("div", { class: "refs-cat-name" }, [title]),
          el("div", { class: "refs-cat-desc" }, [desc]),
        ]),
      ]),
    );
  }
  inner.append(list);
  wrap.appendChild(inner);
  host.appendChild(wrap);
}

/* ============================================================
   EXTENSIONS — Phase-3 empty shell (the registry's future storefront)
   ============================================================ */

let extCategory = "all";
let extQuery = "";

const EXT_CATS = [
  ["all", "All"],
  ["primitive", "Motion primitives"],
  ["archetype", "Archetypes"],
  ["profile", "Profiles"],
  ["camera", "Camera"],
];

const EXT_TYPE_META = {
  primitive: { icon: "sparkle", label: "Primitive" },
  archetype: { icon: "grid2", label: "Archetype" },
  profile: { icon: "sliders", label: "Profile" },
  camera: { icon: "clapper", label: "Camera" },
};

function titleWord(word) {
  const lower = word.toLowerCase();
  if (lower === "saas") return "SaaS";
  if (lower === "cta") return "CTA";
  if (lower === "ui") return "UI";
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function extensionTitle(id) {
  const raw = String(id).includes(".") ? String(id).split(".").pop() : String(id);
  return raw
    .replace(/[-_]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/\s+/)
    .filter(Boolean)
    .map(titleWord)
    .join(" ");
}

function extensionKindTitle(kind) {
  return kind ? titleWord(kind) : "";
}

function extCatalog() {
  const entries = [];
  for (const p of meta.primitives || []) entries.push({ type: "primitive", id: p.id, kind: p.kind, summary: p.summary });
  for (const a of meta.archetypes || []) entries.push({ type: "archetype", id: a.id, summary: a.summary });
  for (const p of meta.profiles || []) entries.push({ type: "profile", id: p.id, summary: p.summary });
  for (const m of meta.cameraMoves || []) entries.push({ type: "camera", id: m.id, summary: m.summary });
  return entries;
}

function enabledExtensionSet() {
  const all = extCatalog().map((e) => e.id);
  const configured = state?.project?.extensions?.enabled;
  if (!Array.isArray(configured)) return new Set(all);
  return new Set(configured);
}

async function toggleExtension(id) {
  const enabled = enabledExtensionSet();
  if (enabled.has(id)) enabled.delete(id);
  else enabled.add(id);
  const ordered = extCatalog().map((e) => e.id).filter((entryId) => enabled.has(entryId));
  await sendCommand({ type: "SetEnabledExtensions", enabled: ordered });
}

function extensionKindNode(entry) {
  const tm = EXT_TYPE_META[entry.type];
  const nodes = [tm.label];
  if (entry.kind) nodes.push(" · ", el("span", { class: "ext-kind-em" }, [extensionKindTitle(entry.kind)]));
  return nodes;
}

function openExtensionView(entry) {
  closeModal();
  closeMenus();
  const tm = EXT_TYPE_META[entry.type];
  const modal = el("div", { class: "modal ext-view-modal" }, [
    el("div", { class: "modal-head" }, [
      el("span", { class: "mh-ico" }, [icon(tm.icon, 15)]),
      el("div", {}, [
        el("div", { class: "mh-title" }, [extensionTitle(entry.id)]),
        el("div", { class: "mh-sub" }, extensionKindNode(entry)),
      ]),
    ]),
    el("div", { class: "modal-body ext-view-body" }),
    el("div", { class: "modal-foot" }, [
      el("span", { class: "spacer" }),
      el("button", { class: "btn btn-ghost", onclick: closeModal }, ["Close"]),
    ]),
  ]);
  const backdrop = el("div", { id: "modalBackdrop" }, [modal]);
  backdrop.onclick = (event) => {
    if (event.target === backdrop) closeModal();
  };
  document.body.appendChild(backdrop);
}

function renderExtensionsPage() {
  const host = pageHost("extensions");
  host.innerHTML = "";
  const wrap = el("div", { class: "ext-wrap" });

  wrap.append(
    el("div", { class: "ext-head" }, [
      el("h2", {}, ["Extensions"]),
      el("span", { class: "phase-tag" }, ["project skill list"]),
      el("span", { class: "sub" }, ["enable only the motion vocabulary this project should give the agent"]),
    ]),
  );

  const search = el("input", {
    class: "ext-search-input",
    type: "search",
    placeholder: "Search installed extensions…",
    value: extQuery,
    autocomplete: "off",
  });
  search.oninput = () => {
    extQuery = search.value;
    fillExtGrid();
  };
  wrap.append(el("div", { class: "ext-search" }, [icon("search", 14), search]));

  const cats = el("div", { class: "ext-cats" });
  for (const [id, label] of EXT_CATS) {
    const count = id === "all" ? extCatalog().length : extCatalog().filter((e) => e.type === id).length;
    const btn = el("button", { class: `ext-cat ${extCategory === id ? "on" : ""}` }, [
      label,
      el("span", { class: "ext-cat-n" }, [String(count)]),
    ]);
    btn.onclick = () => {
      extCategory = id;
      renderExtensionsPage();
    };
    cats.appendChild(btn);
  }
  wrap.append(cats);

  wrap.append(
    el("div", { class: "ext-banner" }, [
      icon("box", 14),
      el("span", {}, [
        "Click a card to include or remove it from the agent's planning catalog. Disabled extensions stay installed, so existing scenes still render.",
      ]),
    ]),
  );

  wrap.append(el("div", { class: "ext-grid", id: "extGrid" }));
  host.appendChild(wrap);
  fillExtGrid();
}

function fillExtGrid() {
  const grid = $("extGrid");
  if (!grid) return;
  grid.innerHTML = "";
  const q = extQuery.trim().toLowerCase();
  const entries = extCatalog().filter(
    (e) =>
      (extCategory === "all" || e.type === extCategory) &&
      (!q ||
        e.id.toLowerCase().includes(q) ||
        extensionTitle(e.id).toLowerCase().includes(q) ||
        (e.summary || "").toLowerCase().includes(q)),
  );
  if (entries.length === 0) {
    grid.append(el("div", { class: "ext-none" }, ["No installed extensions match that search."]));
    return;
  }
  const enabled = enabledExtensionSet();
  for (const e of entries) {
    const tm = EXT_TYPE_META[e.type];
    const on = enabled.has(e.id);
    const view = el("button", { class: "btn-sm ext-view-btn", title: `View ${extensionTitle(e.id)}` }, [
      icon("film", 12),
      "View",
    ]);
    view.onclick = (event) => {
      event.stopPropagation();
      openExtensionView(e);
    };
    const card = el("div", {
      class: `ext-card ${on ? "on" : "off"}`,
      role: "button",
      tabindex: "0",
      title: `${on ? "Disable" : "Enable"} ${extensionTitle(e.id)}`,
    }, [
      el("div", { class: "ext-card-head" }, [
        el("span", { class: `ext-card-ico ext-ico-${e.type}` }, [icon(tm.icon, 15)]),
        el("div", { class: "ext-card-id" }, [
          el("div", { class: "ext-card-name" }, [extensionTitle(e.id)]),
          el("div", { class: "ext-card-kind" }, extensionKindNode(e)),
        ]),
      ]),
      el("div", { class: "ext-card-summary" }, [e.summary || ""]),
      el("div", { class: "ext-card-foot" }, [
        el("span", { class: `ext-installed ${on ? "on" : "off"}` }, [
          icon(on ? "check" : "x", 11),
          on ? "Enabled" : "Disabled",
        ]),
        view,
        el("span", { class: "ext-core" }, ["core"]),
      ]),
    ]);
    card.onclick = () => toggleExtension(e.id);
    card.onkeydown = (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggleExtension(e.id);
      }
    };
    grid.appendChild(card);
  }
}

/* ============================================================
   RENDER — settings left, output right, scene strip + history below
   ============================================================ */

let renderPageSelectedHref = null;

function fmtBytes(n) {
  if (n > 1e9) return `${(n / 1e9).toFixed(2)} GB`;
  if (n > 1e6) return `${(n / 1e6).toFixed(1)} MB`;
  return `${Math.ceil(n / 1e3)} KB`;
}

async function renderRenderPage() {
  if (activePage !== "render") return;
  const host = pageHost("render");
  host.innerHTML = "";
  const cols = el("div", { class: "page-cols" });

  /* ---- left: settings + history ---- */
  const left = el("div", { class: "page-pane" });
  left.append(
    el("div", { class: "pane-head" }, [el("span", { class: "ph-title" }, ["Render settings"])]),
  );
  const form = el("div", { class: "rd-form" });

  const fmt = sessionStorage.getItem("seq.render.format") || "mp4";
  const quality = sessionStorage.getItem("seq.render.quality") || "standard";
  const outputFields = el("div", { class: "rd-section-body" }, [
    field("Format", selectInput(["mp4", "webm", "mov"], fmt, (v) => {
      sessionStorage.setItem("seq.render.format", v);
    })),
    field("Quality", selectInput(["draft", "standard", "high"], quality, (v) => {
      sessionStorage.setItem("seq.render.quality", v);
      renderTopbar();
    }), "draft ≈ 540p fast"),
    el("div", { class: "row2 rd-row2" }, [
      field("Resolution", el("div", { class: "input mono", style: "display:flex;align-items:center" }, [
        `${state.project.meta.width} × ${state.project.meta.height}`,
      ])),
      field("Duration", el("div", { class: "input mono", style: "display:flex;align-items:center" }, [
        `${state.manifest.durationSec}s @ ${fps()}fps`,
      ])),
    ]),
  ]);
  form.append(
    el("div", { class: "rd-section" }, [
      el("div", { class: "rd-section-head" }, [
        el("span", { class: "rd-section-title" }, ["Output"]),
        el("span", { class: "rd-section-sub mono" }, [fmt]),
      ]),
      outputFields,
    ]),
  );

  const renderState = state.render || { status: "idle" };
  const go = el("button", { class: "btn btn-primary", style: "justify-content:center" }, [
    icon("clapper", 14),
    renderState.status === "rendering" ? "Rendering…" : "Render",
  ]);
  go.disabled = renderState.status === "rendering";
  go.onclick = async () => {
    try {
      state.render = await api("/api/render", {
        format: sessionStorage.getItem("seq.render.format") || "mp4",
        quality: sessionStorage.getItem("seq.render.quality") || "standard",
      });
      renderExport();
      pollRender();
      renderRenderPage();
    } catch (err) {
      toast(`render failed: ${err.message}`, "err");
    }
  };
  form.append(go);
  if (renderState.status === "rendering") {
    form.append(el("div", { class: "sb-note" }, [`rendering ${renderState.quality} ${renderState.format ?? "mp4"}… the page refreshes when it lands`]));
  } else if (renderState.status === "failed" && renderState.error) {
    form.append(el("div", { class: "sb-note", style: "color:var(--bad)" }, [renderState.error]));
  }
  left.appendChild(form);

  // history
  left.append(
    el("div", { class: "pane-head", style: "border-top:1px solid var(--line)" }, [
      el("span", { class: "ph-title" }, ["Renders"]),
      el("span", { class: "ph-sub" }, ["renders/"]),
    ]),
  );
  const histBody = el("div", { class: "pane-body", style: "padding:10px" });
  const hist = el("div", { class: "rd-history" }, [el("div", { class: "sb-note" }, ["loading…"])]);
  histBody.appendChild(hist);
  left.appendChild(histBody);
  left.appendChild(splitHandle({ edge: "right", cssVar: "--render-left-w", min: 260, max: 520 }));

  /* ---- right: player + scene strip ---- */
  const right = el("div", { class: "page-pane" });
  const stage = el("div", { class: "rd-stage" });
  right.appendChild(stage);

  const stripWrap = el("div", { class: "rd-strip-wrap" });
  const strip = el("div", { class: "rd-strip" });
  const total = state.manifest.durationFrames || 1;
  const thumbs = (state.thumbs && state.thumbs.files) || {};
  state.manifest.scenes.forEach((scene, i) => {
    const block = el("div", { class: "rd-strip-scene", title: scene.id }, [
      el("span", {}, [`${i + 1} · ${extensionTitle(scene.archetype)}`]),
    ]);
    block.style.flex = `${scene.durationFrames / total} 1 0`;
    if (thumbs[scene.id]) block.style.backgroundImage = `url("${thumbs[scene.id]}?v=${state.thumbs.version}")`;
    strip.appendChild(block);
  });
  stripWrap.appendChild(strip);
  stripWrap.appendChild(splitHandle({ edge: "top", cssVar: "--render-strip-h", min: 60, max: 240 }));
  right.appendChild(stripWrap);

  cols.append(left, right);
  host.appendChild(cols);

  // async: load history, pick the playing file
  try {
    const { renders } = await api("/api/renders/list");
    hist.innerHTML = "";
    if (renders.length === 0) {
      hist.append(el("div", { class: "sb-note" }, ["No renders yet — hit Render and the result plays on the right."]));
    }
    const playing =
      renderPageSelectedHref && renders.some((r) => r.href === renderPageSelectedHref)
        ? renderPageSelectedHref
        : (state.render && state.render.status === "complete" && state.render.href) || renders[0]?.href || null;
    for (const r of renders) {
      const item = el("div", { class: `rd-hist-item ${r.href === playing ? "on" : ""}` }, [
        icon("film", 13),
        el("span", { class: "rh-name" }, [r.name]),
        el("span", { class: "rh-size" }, [fmtBytes(r.size)]),
      ]);
      item.onclick = () => {
        renderPageSelectedHref = r.href;
        renderRenderPage();
      };
      hist.appendChild(item);
    }
    stage.innerHTML = "";
    if (playing) {
      const video = el("video", { src: playing, controls: "true" });
      stage.appendChild(video);
    } else {
      stage.append(
        el("div", { class: "rd-empty" }, [
          "No render yet.",
          el("br"),
          "Settings on the left — the finished video plays here.",
        ]),
      );
    }
  } catch {
    hist.innerHTML = "";
    hist.append(el("div", { class: "sb-note" }, ["render history unavailable"]));
  }
}
