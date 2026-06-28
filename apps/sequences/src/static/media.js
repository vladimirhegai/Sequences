/* Media page — DaVinci-style: disk file browser (left), media viewer
 * (center), media pool with bins (bottom). Imports copy the file into the
 * project's assets/ and register it through an AddAsset command — the same
 * one-pathway rule as everything else. Moving an asset between bins copies
 * the file and re-registers it as one atomic Batch (undo keeps working). */

let mediaFsPath = null; // current disk folder (null until roots load)
let mediaFsRoots = [];
let mediaPreview = null; // { src, name, kind, info } shown in the viewer
let mediaBin = ""; // "" = all assets, otherwise assets/<bin>/ prefix
let mediaSelectedAssetId = null;
let mediaPathEditing = false;
let mediaZoom = 1;
let mediaLoop = false;
let mediaMuted = false;

const MIME_DRAG_ASSET = "application/x-seq-asset-id";
const MIME_DRAG_DISK = "application/x-seq-disk-path";

function mediaResetForProject() {
  mediaFsPath = null;
  mediaPreview = null;
  mediaBin = "";
  mediaSelectedAssetId = null;
  mediaPathEditing = false;
  mediaZoom = 1;
  mediaLoop = false;
  mediaMuted = false;
}

function assetPoolHref(asset) {
  // serve straight from the project assets dir (subfolders included)
  return `/${asset.path.replace(/\\/g, "/")}`;
}

function mediaClamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function setMediaPreview(next) {
  const changed = !mediaPreview || mediaPreview.src !== next.src || mediaPreview.kind !== next.kind;
  mediaPreview = next;
  if (changed) {
    mediaZoom = 1;
    mediaLoop = false;
    mediaMuted = false;
  }
}

function applyMediaZoom() {
  const host = pageHost("media");
  const viewport = host?.querySelector(".mv-viewport");
  if (viewport) viewport.classList.toggle("zoomed", mediaZoom > 1);
  const figure = host?.querySelector(".mv-figure");
  if (figure) {
    figure.style.width = `${mediaZoom * 100}%`;
    figure.style.height = `${mediaZoom * 100}%`;
  }
  const pct = host?.querySelector(".mv-zoom-value");
  if (pct) pct.textContent = mediaZoom === 1 ? "Fit" : `${Math.round(mediaZoom * 100)}%`;
}

function mediaAdjustZoom(direction) {
  if (!mediaPreview || (mediaPreview.kind !== "image" && mediaPreview.kind !== "video")) return false;
  const step = direction > 0 ? 0.25 : -0.25;
  mediaZoom = mediaClamp(Math.round((mediaZoom + step) * 100) / 100, 0.25, 4);
  applyMediaZoom();
  return true;
}

function assetUsedBy(assetId) {
  const used = [];
  for (const scene of state.project.scenes) {
    for (const value of Object.values(scene.slots)) {
      if (value && typeof value === "object" && value.assetId === assetId) used.push(scene.id);
    }
  }
  return used;
}

async function renderMediaPage() {
  if (activePage !== "media") return;
  const host = pageHost("media");

  // keep scroll positions across re-renders (selection should not jump lists)
  const keepScroll = {
    fb: $("fbList")?.scrollTop ?? 0,
    bins: $("mediaBins")?.scrollTop ?? 0,
    pool: host.querySelector(".pool-body")?.scrollTop ?? 0,
  };

  host.innerHTML = "";
  const cols = el("div", { class: "page-cols" });

  const top = el("div", { class: "media-top" });
  top.append(buildFileBrowser(), buildMediaViewer());
  const bottom = el("div", { class: "media-bottom" });
  bottom.append(buildBins(), buildPool());
  bottom.appendChild(splitHandle({ edge: "top", cssVar: "--media-bottom-h", min: 170, max: 520 }));
  cols.append(top, bottom);
  host.appendChild(cols);

  if (mediaFsPath === null) {
    try {
      const { roots } = await api("/api/fs");
      mediaFsRoots = roots;
      mediaFsPath = roots[0]?.path ?? null;
    } catch {
      mediaFsRoots = [];
    }
  }
  await fillFileBrowser();

  const fbList = $("fbList");
  if (fbList) fbList.scrollTop = keepScroll.fb;
  const bins = $("mediaBins");
  if (bins) bins.scrollTop = keepScroll.bins;
  const pool = host.querySelector(".pool-body");
  if (pool) pool.scrollTop = keepScroll.pool;
}

/* ---------------- file browser (left) ---------------- */

function buildFileBrowser() {
  const pane = el("div", { class: "page-pane", id: "mediaFb" });
  pane.append(
    el("div", { class: "pane-head" }, [
      el("span", { class: "ph-title" }, ["File view"]),
      el("span", { class: "ph-sub" }, ["drag files into the pool"]),
    ]),
    el("div", { class: "fb-roots", id: "fbRoots" }),
    el("div", { class: "fb-pathbar", id: "fbPathbar" }),
    el("div", { class: "fb-list", id: "fbList" }, [el("div", { class: "pool-hint" }, ["loading…"])]),
  );
  pane.appendChild(splitHandle({ edge: "right", cssVar: "--media-fb-w", min: 210, max: 540 }));
  return pane;
}

function fbPathSeparator(p) {
  return p.includes("\\") ? "\\" : "/";
}

/** Crumbs with cumulative absolute targets ("C:\" → "C:\Users" → …). */
function fbCrumbTargets(p) {
  const sep = fbPathSeparator(p);
  const parts = p.split(/[\\/]/).filter(Boolean);
  const targets = [];
  let acc = p.startsWith("/") ? "" : null; // posix roots start at ""
  for (const part of parts) {
    acc = acc === null ? part + sep : acc === "" ? sep + part : acc + (acc.endsWith(sep) ? "" : sep) + part;
    targets.push({ label: part, target: acc });
  }
  return targets;
}

function fillFbPathbar(listingPath) {
  const bar = $("fbPathbar");
  if (!bar) return;
  bar.innerHTML = "";
  bar.title = listingPath;

  if (mediaPathEditing) {
    const input = el("input", { class: "input mono fb-path-input", value: listingPath, spellcheck: "false" });
    input.onkeydown = (e) => {
      if (e.key === "Enter") {
        mediaPathEditing = false;
        mediaFsPath = input.value.trim() || listingPath;
        fillFileBrowser();
      } else if (e.key === "Escape") {
        mediaPathEditing = false;
        fillFileBrowser();
      }
    };
    input.onblur = () => {
      if (!mediaPathEditing) return;
      mediaPathEditing = false;
      fillFileBrowser();
    };
    bar.appendChild(input);
    setTimeout(() => {
      input.focus();
      input.select();
    }, 0);
    return;
  }

  const crumbs = el("div", { class: "fb-crumbs" });
  const targets = fbCrumbTargets(listingPath);
  targets.forEach(({ label, target }, i) => {
    const here = i === targets.length - 1;
    const node = el("span", { class: `fb-crumb ${here ? "here" : ""}`, title: target }, [label]);
    if (!here)
      node.onclick = () => {
        mediaFsPath = target;
        fillFileBrowser();
      };
    crumbs.appendChild(node);
    if (!here) crumbs.append(el("span", { class: "lr-crumb-sep" }, ["›"]));
  });
  const edit = el("button", { class: "fb-path-edit", title: "type a path (Enter to go)" }, [icon("pen", 11)]);
  edit.onclick = () => {
    mediaPathEditing = true;
    fillFbPathbar(listingPath);
  };
  bar.append(crumbs, edit);
  crumbs.scrollLeft = crumbs.scrollWidth; // the deepest folder stays visible
}

async function fillFileBrowser() {
  const rootsHost = $("fbRoots");
  const list = $("fbList");
  if (!rootsHost || !list) return;

  rootsHost.innerHTML = "";
  for (const root of mediaFsRoots) {
    const on = mediaFsPath && (mediaFsPath === root.path || mediaFsPath.startsWith(root.path));
    const btn = el("button", { class: `fb-root ${on ? "on" : ""}`, title: root.path }, [root.name]);
    btn.onclick = () => {
      mediaFsPath = root.path;
      mediaPathEditing = false;
      fillFileBrowser();
    };
    rootsHost.appendChild(btn);
  }
  if (!mediaFsPath) {
    list.innerHTML = "";
    list.append(el("div", { class: "pool-hint" }, ["no browse roots available"]));
    return;
  }

  let listing;
  try {
    listing = await api(`/api/fs?path=${encodeURIComponent(mediaFsPath)}`);
  } catch (err) {
    list.innerHTML = "";
    list.append(el("div", { class: "pool-hint" }, [`cannot read folder — ${err.message}`]));
    fillFbPathbar(mediaFsPath);
    return;
  }

  fillFbPathbar(listing.path);

  list.innerHTML = "";
  if (listing.parent) {
    const up = el("div", { class: "fb-item fb-up" }, [
      el("span", { class: "fi-ico" }, [icon("undo", 12)]),
      el("span", { class: "fi-name" }, [".."]),
    ]);
    up.onclick = () => {
      mediaFsPath = listing.parent;
      fillFileBrowser();
    };
    list.appendChild(up);
  }
  for (const d of listing.dirs) {
    const item = el("div", { class: "fb-item", title: d.path }, [
      el("span", { class: "fi-ico" }, [icon("folder", 13)]),
      el("span", { class: "fi-name" }, [d.name]),
    ]);
    item.onclick = () => {
      mediaFsPath = d.path;
      fillFileBrowser();
    };
    list.appendChild(item);
  }
  for (const f of listing.files) {
    const item = el("div", {
      class: `fb-item ${mediaPreview && mediaPreview.diskPath === f.path ? "sel" : ""}`,
      draggable: "true",
      title: `${f.path}\nclick to preview · drag into the pool or a bin · double-click imports`,
    }, [
      el("span", { class: "fi-ico" }, [icon(f.kind === "audio" ? "music" : f.kind === "video" ? "film" : "image", 13)]),
      el("span", { class: "fi-name" }, [f.name]),
      el("span", { class: "fi-size" }, [fmtBytes(f.size)]),
      el("span", { class: "fi-kind" }, [f.kind]),
    ]);
    item.onclick = () => {
      setMediaPreview({
        src: `/api/fs/file?path=${encodeURIComponent(f.path)}`,
        name: f.name,
        kind: f.kind,
        info: `${fmtBytes(f.size)} · on disk`,
        diskPath: f.path,
      });
      renderMediaPage();
    };
    item.ondblclick = () => importDiskFile(f.path);
    item.ondragstart = (e) => {
      e.dataTransfer.setData(MIME_DRAG_DISK, f.path);
      e.dataTransfer.effectAllowed = "copy";
    };
    list.appendChild(item);
  }
  if (listing.dirs.length === 0 && listing.files.length === 0) {
    list.append(el("div", { class: "pool-hint" }, ["empty folder (only media files are listed)"]));
  }
}

async function importDiskFile(diskPath, folder = mediaBin) {
  try {
    state = await api(`/api/assets/import`, { path: diskPath, folder });
    render();
    toast(`imported into ${folder ? `assets/${folder}/` : "the media pool"} — undoable`);
  } catch (err) {
    toast(`import failed — ${err.message}`, "err");
  }
}

async function moveAssetToBin(assetId, folder) {
  try {
    state = await api(`/api/assets/move`, { assetId, folder });
    render();
    toast(`moved "${assetId}" to ${folder ? `assets/${folder}/` : "assets/"} — undoable`);
  } catch (err) {
    toast(`move failed — ${err.message}`, "err");
  }
}

async function uploadFiles(files, folder = mediaBin) {
  for (const file of files || []) {
    try {
      const res = await fetch(
        `/api/assets/upload?name=${encodeURIComponent(file.name)}&folder=${encodeURIComponent(folder)}`,
        { method: "POST", body: file },
      );
      const json = await res.json();
      if (!res.ok) throw new Error((json.errors || []).map((x) => x.message).join(" · "));
      state = json;
    } catch (err) {
      toast(`upload failed — ${err.message}`, "err");
    }
  }
  render();
}

/* ---------------- viewer (center) ---------------- */

function buildMediaViewer() {
  const pane = el("div", { class: "page-pane" });
  let mediaEl = null;
  pane.append(
    el("div", { class: "pane-head" }, [
      el("span", { class: "ph-title" }, ["Viewer"]),
      el("span", { class: "ph-sub" }, [mediaPreview ? mediaPreview.name : "nothing selected"]),
    ]),
  );
  const stage = el("div", { class: `mv-stage ${mediaPreview ? "has-media" : ""}` });
  if (!mediaPreview) {
    stage.append(
      el("div", { class: "mv-empty" }, [
        el("div", { class: "mv-empty-ico" }, [icon("image", 24)]),
        el("div", { class: "mv-empty-line" }, ["Select a file or a pool asset to preview"]),
        el("div", { class: "mv-empty-sub" }, ["Images, video and audio play here"]),
      ]),
    );
  } else if (mediaPreview.kind === "image") {
    stage.append(buildMediaViewport(el("img", { class: "mv-media", src: mediaPreview.src, alt: mediaPreview.name })));
  } else if (mediaPreview.kind === "video") {
    mediaEl = el("video", {
      class: "mv-media",
      src: mediaPreview.src,
      controls: "true",
      preload: "metadata",
      playsinline: "true",
    });
    mediaEl.loop = mediaLoop;
    mediaEl.muted = mediaMuted;
    stage.append(buildMediaViewport(mediaEl));
  } else {
    mediaEl = el("audio", { class: "mv-audio-el", src: mediaPreview.src, controls: "true", preload: "metadata" });
    mediaEl.loop = mediaLoop;
    mediaEl.muted = mediaMuted;
    stage.append(
      el("div", { class: "mv-audio-card" }, [
        el("div", { class: "mv-audio-ico" }, [icon("music", 24)]),
        el("div", { class: "mv-audio-name mono" }, [mediaPreview.name]),
        mediaEl,
      ]),
    );
  }
  pane.appendChild(stage);
  if (mediaPreview) pane.appendChild(buildMediaControls(mediaEl));

  const bar = el("div", { class: "mv-bar" });
  if (mediaPreview) {
    bar.append(
      el("span", { class: "mono", title: mediaPreview.diskPath ?? mediaPreview.name }, [mediaPreview.name]),
      el("span", { class: "mv-info" }, [mediaPreview.info ?? ""]),
    );
    if (mediaPreview.diskPath) {
      const importBtn = el("button", { class: "btn-sm", style: "margin-left:auto" }, [icon("plus", 12), "Add to pool"]);
      importBtn.onclick = () => importDiskFile(mediaPreview.diskPath);
      bar.append(importBtn);
    }
  } else {
    bar.append(el("span", { style: "color:var(--text-dim)" }, ["No media selected"]));
  }
  pane.appendChild(bar);
  return pane;
}

function buildMediaViewport(node) {
  const viewport = el("div", { class: `mv-viewport ${mediaZoom > 1 ? "zoomed" : ""}` });
  const figure = el("div", { class: "mv-figure" });
  figure.style.width = `${mediaZoom * 100}%`;
  figure.style.height = `${mediaZoom * 100}%`;
  figure.append(node);
  viewport.appendChild(figure);
  return viewport;
}

function buildMediaControls(mediaEl) {
  const strip = el("div", { class: "mv-controls" });

  if (mediaPreview.kind === "image" || mediaPreview.kind === "video") {
    const zoomOut = el("button", { class: "mini-btn", title: "Zoom out" }, [icon("zoomOut", 12)]);
    const zoomIn = el("button", { class: "mini-btn", title: "Zoom in" }, [icon("zoomIn", 12)]);
    const fit = el("button", { class: "mini-btn", title: "Fit to viewer" }, [icon("fit", 12)]);
    const value = el("span", { class: "mv-zoom-value mono" }, [mediaZoom === 1 ? "Fit" : `${Math.round(mediaZoom * 100)}%`]);
    zoomOut.onclick = () => {
      mediaAdjustZoom(-1);
    };
    zoomIn.onclick = () => {
      mediaAdjustZoom(1);
    };
    fit.onclick = () => {
      mediaZoom = 1;
      applyMediaZoom();
    };
    strip.append(el("div", { class: "mv-control-group" }, [zoomOut, value, zoomIn, fit]));
  }

  if (mediaEl) {
    const play = el("button", { class: "mini-btn", title: "Play / pause" }, [icon("play", 12)]);
    const back = el("button", { class: "mini-btn", title: "Back 5 seconds" }, [icon("skipBack", 12)]);
    const fwd = el("button", { class: "mini-btn", title: "Forward 5 seconds" }, [icon("skipForward", 12)]);
    const loop = el("button", { class: `mini-btn ${mediaLoop ? "on" : ""}`, title: "Loop" }, [icon("repeat", 12)]);
    const mute = el("button", { class: `mini-btn ${mediaMuted ? "on" : ""}`, title: "Mute" }, [icon(mediaMuted ? "volumeOff" : "volume", 12)]);
    const time = el("span", { class: "mv-time mono" }, ["00:00 / 00:00"]);
    const fmt = (seconds) => {
      if (!Number.isFinite(seconds)) return "00:00";
      const s = Math.max(0, Math.floor(seconds));
      return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
    };
    const sync = () => {
      play.replaceChildren(icon(mediaEl.paused ? "play" : "pause", 12));
      mute.replaceChildren(icon(mediaEl.muted ? "volumeOff" : "volume", 12));
      mute.classList.toggle("on", mediaEl.muted);
      loop.classList.toggle("on", mediaEl.loop);
      time.textContent = `${fmt(mediaEl.currentTime)} / ${fmt(mediaEl.duration)}`;
    };
    play.onclick = async () => {
      if (mediaEl.paused) {
        try {
          await mediaEl.play();
        } catch {
          /* Native controls remain available if autoplay policy blocks this click. */
        }
      } else {
        mediaEl.pause();
      }
      sync();
    };
    back.onclick = () => {
      mediaEl.currentTime = Math.max(0, (mediaEl.currentTime || 0) - 5);
      sync();
    };
    fwd.onclick = () => {
      mediaEl.currentTime = Math.min(mediaEl.duration || Number.MAX_SAFE_INTEGER, (mediaEl.currentTime || 0) + 5);
      sync();
    };
    loop.onclick = () => {
      mediaEl.loop = !mediaEl.loop;
      mediaLoop = mediaEl.loop;
      sync();
    };
    mute.onclick = () => {
      mediaEl.muted = !mediaEl.muted;
      mediaMuted = mediaEl.muted;
      sync();
    };
    mediaEl.addEventListener("loadedmetadata", sync);
    mediaEl.addEventListener("timeupdate", sync);
    mediaEl.addEventListener("play", sync);
    mediaEl.addEventListener("pause", sync);
    strip.append(el("div", { class: "mv-control-group mv-playback" }, [play, back, fwd, loop, mute, time]));
    setTimeout(sync, 0);
  }

  return strip;
}

/* ---------------- bins (bottom left) ---------------- */

function binOfAsset(asset) {
  const parts = asset.path.replace(/\\/g, "/").split("/");
  return parts.length > 2 ? parts.slice(1, -1).join("/") : "";
}

/** Bins accept drops: pool cards (move), disk files (import), OS files (upload). */
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
    const assetId = e.dataTransfer.getData(MIME_DRAG_ASSET);
    if (assetId) return moveAssetToBin(assetId, bin);
    const diskPath = e.dataTransfer.getData(MIME_DRAG_DISK);
    if (diskPath) return importDiskFile(diskPath, bin);
    if (e.dataTransfer.files?.length) return uploadFiles(e.dataTransfer.files, bin);
  };
}

function buildBins() {
  const pane = el("div", { class: "page-pane" });
  const addBin = el("button", { class: "mini-btn", title: "New bin (a folder inside assets/)" }, [icon("plus", 12)]);
  addBin.onclick = async () => {
    const name = prompt("Bin name (a folder inside assets/):", "");
    if (!name || !name.trim()) return;
    try {
      await api("/api/assets/folder", { name: name.trim() });
      mediaBin = name.trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
      renderMediaPage();
    } catch (err) {
      toast(`bin failed — ${err.message}`, "err");
    }
  };
  pane.append(
    el("div", { class: "pane-head" }, [
      el("span", { class: "ph-title" }, ["Bins"]),
      el("div", { class: "ph-tools" }, [addBin]),
    ]),
  );
  const body = el("div", { class: "pane-body", style: "padding:6px", id: "mediaBins" });
  pane.appendChild(body);
  pane.appendChild(splitHandle({ edge: "right", cssVar: "--media-bins-w", min: 140, max: 360 }));

  const assets = state.project.assets;
  const counts = {};
  for (const a of assets) counts[binOfAsset(a)] = (counts[binOfAsset(a)] ?? 0) + 1;

  const all = el("div", { class: `bin-item ${mediaBin === "" ? "on" : ""}` }, [
    icon("layers", 13),
    "All media",
    el("span", { class: "bi-count" }, [String(assets.length)]),
  ]);
  all.onclick = () => {
    mediaBin = "";
    renderMediaPage();
  };
  wireBinDrop(all, "");
  body.appendChild(all);

  api("/api/assets/folders")
    .then(({ folders }) => {
      const known = new Set(folders);
      for (const bin of Object.keys(counts)) if (bin) known.add(bin);
      for (const bin of [...known].sort()) {
        const item = el("div", { class: `bin-item ${mediaBin === bin ? "on" : ""}`, title: `assets/${bin}/ — drop assets or files here` }, [
          icon("folder", 13),
          el("span", { class: "bi-name" }, [bin]),
          el("span", { class: "bi-count" }, [String(counts[bin] ?? 0)]),
        ]);
        item.onclick = () => {
          mediaBin = bin;
          renderMediaPage();
        };
        wireBinDrop(item, bin);
        body.appendChild(item);
      }
      body.append(
        el("div", { class: "bin-hint" }, ["drag pool items onto a bin to move them"]),
      );
    })
    .catch(() => {});
  return pane;
}

/* ---------------- the pool (bottom right) ---------------- */

function buildPool() {
  const pane = el("div", { class: "page-pane" });
  pane.append(
    el("div", { class: "pane-head" }, [
      el("span", { class: "ph-title" }, ["Media pool"]),
      el("span", { class: "ph-sub mono" }, [mediaBin ? `assets/${mediaBin}/` : "assets/"]),
      el("div", { class: "ph-tools" }, [
        el("span", { class: "ph-sub" }, ["referenced by asset id"]),
      ]),
    ]),
  );
  const body = el("div", { class: "pool-body" });
  body.append(el("div", { class: "pool-drop" }, [`Drop to import into ${mediaBin ? `assets/${mediaBin}/` : "the pool"}`]));

  const assets = state.project.assets.filter((a) => mediaBin === "" || binOfAsset(a) === mediaBin);
  if (assets.length === 0) {
    body.append(
      el("div", { class: "pool-hint" }, [
        "The pool is empty",
        mediaBin ? ` in this bin` : "",
        ". ",
        el("b", {}, ["Drag files"]),
        " from the file view (or straight from your OS) to import — they're copied into ",
        el("b", {}, [`assets/${mediaBin ? mediaBin + "/" : ""}`]),
        " and registered as an undoable AddAsset command.",
      ]),
    );
  } else {
    const grid = el("div", { class: "pool-grid" });
    for (const asset of assets) {
      grid.appendChild(poolCard(asset));
    }
    body.appendChild(grid);
  }

  // OS file drop + in-app disk-file drop
  body.ondragover = (e) => {
    // dragging a pool card around the "All media" view is a no-op — no overlay
    if (e.dataTransfer.types.includes(MIME_DRAG_ASSET) && mediaBin === "") return;
    e.preventDefault();
    body.classList.add("dragover");
  };
  body.ondragleave = () => body.classList.remove("dragover");
  body.ondrop = (e) => {
    e.preventDefault();
    body.classList.remove("dragover");
    const assetId = e.dataTransfer.getData(MIME_DRAG_ASSET);
    if (assetId) {
      if (mediaBin !== "") return moveAssetToBin(assetId, mediaBin);
      return; // dropping back into "All media" view is a no-op
    }
    const diskPath = e.dataTransfer.getData(MIME_DRAG_DISK);
    if (diskPath) return importDiskFile(diskPath);
    return uploadFiles(e.dataTransfer.files);
  };

  pane.appendChild(body);
  return pane;
}

function poolCard(asset) {
  const used = assetUsedBy(asset.id);
  const bin = binOfAsset(asset);
  const card = el("div", {
    class: `pool-card ${mediaSelectedAssetId === asset.id ? "sel" : ""}`,
    draggable: "true",
    title: `${asset.path}\nclick to preview · drag onto a bin to move · double-click a slot in the inspector to use it`,
  });
  card.ondragstart = (e) => {
    e.dataTransfer.setData(MIME_DRAG_ASSET, asset.id);
    e.dataTransfer.effectAllowed = "move";
  };
  const thumb = el("div", { class: "pool-thumb" });
  if (asset.kind === "image") thumb.append(el("img", { src: assetPoolHref(asset), alt: asset.id, loading: "lazy" }));
  else thumb.append(icon(asset.kind === "audio" ? "music" : "film", 20));
  const place = mediaBin === "" && bin ? `${bin}/ · ` : "";
  card.append(
    thumb,
    el("div", { class: "pool-meta" }, [
      el("div", { class: "pm-id" }, [asset.id]),
      el("div", { class: "pm-info" }, [`${place}${asset.kind} · ${used.length ? `used in ${used.join(", ")}` : "unused"}`]),
    ]),
  );
  const del = el("button", { class: "pc-del", title: used.length ? "in use — remove it from scenes first" : "remove from pool (file stays on disk)" }, [icon("x", 11)]);
  del.disabled = used.length > 0;
  del.onclick = (e) => {
    e.stopPropagation();
    sendCommand({ type: "RemoveAsset", assetId: asset.id });
  };
  card.append(del);
  card.onclick = () => {
    mediaSelectedAssetId = asset.id;
    setMediaPreview({
      src: assetPoolHref(asset),
      name: asset.path.split("/").pop(),
      kind: asset.kind,
      info: `asset "${asset.id}" · in the pool${bin ? ` · bin ${bin}/` : ""}`,
    });
    renderMediaPage();
  };
  return card;
}
