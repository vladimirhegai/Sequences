/* Media page — DaVinci-style: disk file browser (left), media viewer
 * (center), media pool with bins (bottom). Imports copy the file into the
 * project's assets/ and register it through an AddAsset command — the same
 * one-pathway rule as everything else. */

let mediaFsPath = null; // current disk folder (null until roots load)
let mediaFsRoots = [];
let mediaPreview = null; // { src, name, kind, info } shown in the viewer
let mediaBin = ""; // "" = all assets, otherwise assets/<bin>/ prefix
let mediaSelectedAssetId = null;

function mediaResetForProject() {
  mediaFsPath = null;
  mediaPreview = null;
  mediaBin = "";
  mediaSelectedAssetId = null;
}

function assetPoolHref(asset) {
  // serve straight from the project assets dir (subfolders included)
  return `/${asset.path.replace(/\\/g, "/")}`;
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
  host.innerHTML = "";
  const cols = el("div", { class: "page-cols" });

  const top = el("div", { class: "media-top" });
  top.append(buildFileBrowser(), buildMediaViewer());
  const bottom = el("div", { class: "media-bottom" });
  bottom.append(buildBins(), buildPool());
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
    el("div", { class: "fb-crumbs", id: "fbCrumbs" }),
    el("div", { class: "fb-list", id: "fbList" }, [el("div", { class: "pool-hint" }, ["loading…"])]),
  );
  return pane;
}

async function fillFileBrowser() {
  const rootsHost = $("fbRoots");
  const list = $("fbList");
  const crumbs = $("fbCrumbs");
  if (!rootsHost || !list) return;

  rootsHost.innerHTML = "";
  for (const root of mediaFsRoots) {
    const on = mediaFsPath && (mediaFsPath === root.path || mediaFsPath.startsWith(root.path));
    const btn = el("button", { class: `fb-root ${on ? "on" : ""}` }, [root.name]);
    btn.onclick = () => {
      mediaFsPath = root.path;
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
    return;
  }

  crumbs.innerHTML = "";
  const parts = listing.path.split(/[\\/]/).filter(Boolean);
  let acc = listing.path.startsWith("/") ? "/" : "";
  parts.forEach((part, i) => {
    acc = acc === "" ? part + "\\" : acc === "/" ? "/" + part : acc.replace(/[\\/]?$/, "") + (listing.path.includes("\\") ? "\\" : "/") + part;
    const target = acc;
    const node = el("span", { class: "fb-crumb" }, [part]);
    if (i < parts.length - 1)
      node.onclick = () => {
        mediaFsPath = target;
        fillFileBrowser();
      };
    crumbs.appendChild(node);
    if (i < parts.length - 1) crumbs.append(el("span", { class: "lr-crumb-sep" }, ["›"]));
  });

  list.innerHTML = "";
  if (listing.parent) {
    const up = el("div", { class: "fb-item" }, [
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
    const item = el("div", { class: "fb-item" }, [
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
      title: "click to preview · drag into the media pool to import · double-click imports",
    }, [
      el("span", { class: "fi-ico" }, [icon(f.kind === "audio" ? "music" : f.kind === "video" ? "film" : "image", 13)]),
      el("span", { class: "fi-name" }, [f.name]),
      el("span", { class: "fi-kind" }, [f.kind]),
    ]);
    item.onclick = () => {
      mediaPreview = {
        src: `/api/fs/file?path=${encodeURIComponent(f.path)}`,
        name: f.name,
        kind: f.kind,
        info: `${fmtBytes(f.size)} · on disk`,
        diskPath: f.path,
      };
      renderMediaPage();
    };
    item.ondblclick = () => importDiskFile(f.path);
    item.ondragstart = (e) => {
      e.dataTransfer.setData("application/x-seq-disk-path", f.path);
      e.dataTransfer.effectAllowed = "copy";
    };
    list.appendChild(item);
  }
  if (listing.dirs.length === 0 && listing.files.length === 0) {
    list.append(el("div", { class: "pool-hint" }, ["empty folder (only media files are listed)"]));
  }
}

async function importDiskFile(diskPath) {
  try {
    state = await api(`/api/assets/import`, { path: diskPath, folder: mediaBin });
    render();
    toast("imported into the media pool — referenced as an asset, undoable");
  } catch (err) {
    toast(`import failed — ${err.message}`, "err");
  }
}

/* ---------------- viewer (center) ---------------- */

function buildMediaViewer() {
  const pane = el("div", { class: "page-pane" });
  pane.append(
    el("div", { class: "pane-head" }, [
      el("span", { class: "ph-title" }, ["Viewer"]),
      el("span", { class: "ph-sub" }, [mediaPreview ? mediaPreview.name : "nothing selected"]),
    ]),
  );
  const stage = el("div", { class: "mv-stage" });
  if (!mediaPreview) {
    stage.append(
      el("div", { class: "mv-empty" }, [
        "Select a file on the left or an asset in the pool below.",
        el("br"),
        el("b", {}, ["Images, video and audio"]),
        " preview here before you commit them to the pool.",
      ]),
    );
  } else if (mediaPreview.kind === "image") {
    stage.append(el("img", { src: mediaPreview.src, alt: mediaPreview.name }));
  } else if (mediaPreview.kind === "video") {
    stage.append(el("video", { src: mediaPreview.src, controls: "true" }));
  } else {
    stage.append(el("audio", { src: mediaPreview.src, controls: "true" }));
  }
  pane.appendChild(stage);

  const bar = el("div", { class: "mv-bar" });
  if (mediaPreview) {
    bar.append(el("span", { class: "mono" }, [mediaPreview.name]), el("span", {}, [mediaPreview.info ?? ""]));
    if (mediaPreview.diskPath) {
      const importBtn = el("button", { class: "btn-sm", style: "margin-left:auto" }, [icon("plus", 12), "Add to pool"]);
      importBtn.onclick = () => importDiskFile(mediaPreview.diskPath);
      bar.append(importBtn);
    }
  } else {
    bar.append(el("span", {}, ["media viewer"]));
  }
  pane.appendChild(bar);
  return pane;
}

/* ---------------- bins (bottom left) ---------------- */

function binOfAsset(asset) {
  const parts = asset.path.replace(/\\/g, "/").split("/");
  return parts.length > 2 ? parts.slice(1, -1).join("/") : "";
}

function buildBins() {
  const pane = el("div", { class: "page-pane" });
  const addBin = el("button", { class: "mini-btn", title: "New bin (a folder inside assets/)" }, [icon("plus", 12)]);
  addBin.onclick = async () => {
    const name = prompt("Bin name (a folder inside assets/):", "");
    if (!name || !name.trim()) return;
    try {
      await api("/api/assets/folder", { name: name.trim() });
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
  body.appendChild(all);

  api("/api/assets/folders")
    .then(({ folders }) => {
      const known = new Set(folders);
      for (const bin of Object.keys(counts)) if (bin) known.add(bin);
      for (const bin of [...known].sort()) {
        const item = el("div", { class: `bin-item ${mediaBin === bin ? "on" : ""}` }, [
          icon("folder", 13),
          bin,
          el("span", { class: "bi-count" }, [String(counts[bin] ?? 0)]),
        ]);
        item.onclick = () => {
          mediaBin = bin;
          renderMediaPage();
        };
        body.appendChild(item);
      }
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
      el("span", { class: "ph-sub" }, [mediaBin ? `assets/${mediaBin}/` : "assets/"]),
      el("div", { class: "ph-tools" }, [
        el("span", { class: "ph-sub" }, ["drop files here · everything is referenced by asset id"]),
      ]),
    ]),
  );
  const body = el("div", { class: "pool-body" });
  body.append(el("div", { class: "pool-drop" }, ["Drop to import into the pool"]));

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
    e.preventDefault();
    body.classList.add("dragover");
  };
  body.ondragleave = () => body.classList.remove("dragover");
  body.ondrop = async (e) => {
    e.preventDefault();
    body.classList.remove("dragover");
    const diskPath = e.dataTransfer.getData("application/x-seq-disk-path");
    if (diskPath) return importDiskFile(diskPath);
    for (const file of e.dataTransfer.files || []) {
      try {
        const res = await fetch(
          `/api/assets/upload?name=${encodeURIComponent(file.name)}&folder=${encodeURIComponent(mediaBin)}`,
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
  };

  pane.appendChild(body);
  return pane;
}

function poolCard(asset) {
  const used = assetUsedBy(asset.id);
  const card = el("div", {
    class: `pool-card ${mediaSelectedAssetId === asset.id ? "sel" : ""}`,
    title: `${asset.path}\nclick to preview · double-click a slot in the inspector to use it`,
  });
  const thumb = el("div", { class: "pool-thumb" });
  if (asset.kind === "image") thumb.append(el("img", { src: assetPoolHref(asset), alt: asset.id, loading: "lazy" }));
  else thumb.append(icon(asset.kind === "audio" ? "music" : "film", 20));
  card.append(
    thumb,
    el("div", { class: "pool-meta" }, [
      el("div", { class: "pm-id" }, [asset.id]),
      el("div", { class: "pm-info" }, [`${asset.kind} · ${used.length ? `used in ${used.join(", ")}` : "unused"}`]),
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
    mediaPreview = {
      src: assetPoolHref(asset),
      name: asset.path.split("/").pop(),
      kind: asset.kind,
      info: `asset "${asset.id}" · in the pool`,
    };
    renderMediaPage();
  };
  return card;
}
