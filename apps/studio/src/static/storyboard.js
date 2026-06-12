/* Storyboard page - Excalidraw-powered pre-production frames.
 * The document remains a sidecar (`storyboard.json`), and comments attached
 * to Excalidraw elements are serialized for the agent.
 */

let sbBoard = null;
let sbFrameId = null;
let sbTool = "selection";
let sbSaveTimer = null;
let sbLoadedFor = null;
let sbKeysBound = false;
let sbHandle = null;
let sbSelection = { ids: [], count: 0, id: null, type: null, text: "", comment: "", assetId: null };

function sbSelectionSignature(selection) {
  return `${selection.ids.join(",")}|${selection.count}|${selection.id ?? ""}|${selection.type ?? ""}|${selection.assetId ?? ""}`;
}

function sbIsTypingSelectionComment() {
  const active = document.activeElement;
  return Boolean(active?.matches?.('textarea[data-sb-role="selection-comment"]'));
}

function storyboardResetForProject() {
  sbHandle?.unmount?.();
  sbHandle = null;
  sbBoard = null;
  sbFrameId = null;
  sbLoadedFor = null;
  sbSelection = { ids: [], count: 0, id: null, type: null, text: "", comment: "", assetId: null };
}

async function enterStoryboardPage() {
  sbBindKeys();
  if (!sbBoard || sbLoadedFor !== state.projectDir) {
    try {
      sbBoard = sbNormalizeBoard(await api("/api/storyboard"));
      sbLoadedFor = state.projectDir;
    } catch (err) {
      toast(`storyboard failed to load - ${err.message}`, "err");
      sbBoard = sbNormalizeBoard({ version: 1, frames: [{ id: "frame-1", name: "Frame 1", items: [] }] });
    }
  }
  if (!sbBoard.frames.some((f) => f.id === sbFrameId)) sbFrameId = sbBoard.frames[0]?.id ?? null;
  renderStoryboardPage();
}

function storyboardOnState() {
  if (activePage === "storyboard") renderSbSidebar();
}

function sbNormalizeBoard(board) {
  const frames = Array.isArray(board?.frames) && board.frames.length ? board.frames : [{ id: "frame-1", name: "Frame 1", items: [] }];
  return {
    version: 1,
    frames: frames.map((frame, index) => ({
      id: frame.id || `frame-${index + 1}`,
      name: frame.name || `Frame ${index + 1}`,
      ...(frame.comment ? { comment: frame.comment } : {}),
      items: Array.isArray(frame.items) ? frame.items : [],
      ...(frame.excalidraw ? { excalidraw: sbNormalizeExcalidraw(frame.excalidraw) } : {}),
    })),
  };
}

function sbNormalizeExcalidraw(raw) {
  return {
    elements: Array.isArray(raw?.elements) ? raw.elements : [],
    appState: raw?.appState && typeof raw.appState === "object" ? raw.appState : {},
    files: raw?.files && typeof raw.files === "object" ? raw.files : {},
  };
}

function sbFrame() {
  return sbBoard?.frames.find((f) => f.id === sbFrameId) ?? null;
}

function sbQueueSave() {
  clearTimeout(sbSaveTimer);
  sbSaveTimer = setTimeout(async () => {
    try {
      await sbSaveNow();
    } catch {
      /* Retried on the next change. */
    }
  }, 450);
}

async function sbSaveNow() {
  if (!sbBoard) return;
  clearTimeout(sbSaveTimer);
  sbSaveTimer = null;
  const response = await fetch("/api/storyboard", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(sbBoard),
  });
  if (!response.ok) throw new Error(`storyboard save failed (${response.status})`);
}

function sbNewId(prefix) {
  let n = 1;
  const taken = new Set((sbBoard?.frames ?? []).map((f) => f.id));
  while (taken.has(`${prefix}-${n}`)) n++;
  return `${prefix}-${n}`;
}

const SB_TOOLS = [
  ["selection", "cursor", "Select"],
  ["freedraw", "pen", "Freehand"],
  ["eraser", "eraser", "Eraser"],
  ["rectangle", "shape", "Rectangle"],
  ["diamond", "diamond", "Diamond"],
  ["ellipse", "circle", "Ellipse"],
  ["arrow", "arrow", "Arrow"],
  ["line", "line", "Line"],
  ["text", "text", "Text"],
  ["media", "image", "Place media from the pool"],
];

function renderStoryboardPage() {
  const host = pageHost("storyboard");
  sbHandle?.unmount?.();
  sbHandle = null;
  host.innerHTML = "";
  if (!sbBoard) return;

  const cols = el("div", { class: "page-cols" });
  cols.append(buildSbStrip(), buildSbToolRail(), buildSbStage(), buildSbSidePane());
  host.appendChild(cols);
  mountSbExcalidraw();
}

function buildSbStrip() {
  const strip = el("div", { class: "sb-strip" });
  sbBoard.frames.forEach((frame, i) => {
    const count = (frame.excalidraw?.elements ?? []).filter((item) => item && item.isDeleted !== true).length
      + (frame.excalidraw ? 0 : (frame.items?.length ?? 0));
    const card = el("div", { class: `sb-frame ${frame.id === sbFrameId ? "on" : ""}`, title: frame.comment || frame.name });
    card.append(el("span", { class: "sf-n" }, [String(i + 1)]));
    if (frame.comment || sbFrameHasElementComments(frame)) card.append(el("span", { class: "sf-dot", title: "has AI comments" }));
    card.append(el("span", { class: "sf-name" }, [`${frame.name}${count ? ` - ${count}` : ""}`]));
    if (sbBoard.frames.length > 1) {
      const del = el("button", { class: "sf-del", title: "Delete frame" }, [icon("x", 10)]);
      del.onclick = (e) => {
        e.stopPropagation();
        sbBoard.frames = sbBoard.frames.filter((f) => f.id !== frame.id);
        if (sbFrameId === frame.id) sbFrameId = sbBoard.frames[0].id;
        sbSelection = { ids: [], count: 0, id: null, type: null, text: "", comment: "", assetId: null };
        sbQueueSave();
        renderStoryboardPage();
      };
      card.append(del);
    }
    card.onclick = () => {
      sbFrameId = frame.id;
      sbSelection = { ids: [], count: 0, id: null, type: null, text: "", comment: "", assetId: null };
      renderStoryboardPage();
    };
    strip.appendChild(card);
  });
  const add = el("button", { class: "sb-add", title: "Add frame" }, [icon("plus", 15)]);
  add.onclick = () => {
    const id = sbNewId("frame");
    sbBoard.frames.push({ id, name: `Frame ${sbBoard.frames.length + 1}`, items: [] });
    sbFrameId = id;
    sbSelection = { ids: [], count: 0, id: null, type: null, text: "", comment: "", assetId: null };
    sbQueueSave();
    renderStoryboardPage();
  };
  strip.appendChild(add);
  return strip;
}

function buildSbToolRail() {
  const rail = el("div", { class: "tool-rail" });
  for (const [id, ico, tip] of SB_TOOLS) {
    const btn = el("button", { class: `tool-btn ${sbTool === id ? "on" : ""}`, title: tip });
    btn.append(icon(ico, 15));
    btn.onclick = () => {
      if (id === "media") return openSbMediaPicker();
      sbTool = id;
      sbHandle?.setTool?.(id);
      renderSbToolRailState();
    };
    rail.appendChild(btn);
  }
  rail.append(el("div", { class: "tool-sep" }));
  const clear = el("button", { class: "tool-btn", title: "Clear current frame" }, [icon("trash", 14)]);
  clear.onclick = () => {
    const frame = sbFrame();
    if (!frame) return;
    if (confirm(`Clear ${frame.name}?`)) sbHandle?.clear?.();
  };
  rail.appendChild(clear);
  return rail;
}

function renderSbToolRailState() {
  const rail = pageHost("storyboard").querySelector(".tool-rail");
  if (!rail) return;
  for (const btn of rail.querySelectorAll(".tool-btn")) btn.classList.remove("on");
  const index = SB_TOOLS.findIndex(([id]) => id === sbTool);
  rail.querySelectorAll(".tool-btn")[index]?.classList.add("on");
}

function buildSbStage() {
  const stage = el("div", { class: "sb-stage sb-stage-excal" });
  const wrap = el("div", { class: "sb-excal-wrap" });
  wrap.append(el("div", { id: "sbExcalidrawHost", class: "sb-excal-host" }));
  stage.appendChild(wrap);
  return stage;
}

function buildSbSidePane() {
  const side = el("div", { class: "page-pane" });
  side.append(
    el("div", { class: "pane-head" }, [
      el("span", { class: "ph-title" }, ["Frame"]),
      el("span", { class: "ph-sub", id: "sbPaneSub" }, [sbFrame() ? sbFrame().name : ""]),
    ]),
    el("div", { class: "pane-body", id: "sbSidebar" }),
  );
  return side;
}

function mountSbExcalidraw() {
  const frame = sbFrame();
  const host = $("sbExcalidrawHost");
  if (!frame || !host) return;
  if (!window.SequenceStoryboardExcalidraw?.mount) {
    host.append(el("div", { class: "pool-hint" }, ["Excalidraw storyboard bundle is missing. Run npm run build:storyboard."]));
    renderSbSidebar();
    return;
  }
  sbHandle = window.SequenceStoryboardExcalidraw.mount(host, {
    frame,
    palette: sbPalette(),
    onChange: (nextFrame) => {
      const idx = sbBoard.frames.findIndex((f) => f.id === nextFrame.id);
      if (idx >= 0) {
        sbBoard.frames[idx] = nextFrame;
        sbQueueSave();
      }
    },
    onSelectionChange: (summary) => {
      const sameTarget = sbSelectionSignature(sbSelection) === sbSelectionSignature(summary);
      sbSelection = summary;
      if (!sameTarget || !sbIsTypingSelectionComment()) renderSbSidebar();
    },
    onToast: (message, kind) => toast(message, kind),
  });
  renderSbSidebar();
}

function sbPalette() {
  const colors = state?.project?.brand?.colors ?? {};
  return {
    background: colors.surface ?? "#1a1d21",
    stroke: colors.text ?? "#c9cfd9",
    text: colors.text ?? "#eef1f5",
    accent: colors.accent ?? colors.primary ?? "#7c9fc4",
  };
}

function sbFrameHasElementComments(frame) {
  return (frame.excalidraw?.elements ?? []).some((item) => {
    const customData = item?.customData ?? {};
    return Boolean(customData.sequenceAiComment || customData.commentForAI);
  });
}

/* ---------------- media picker ---------------- */

function sbAssetBin(asset) {
  const parts = asset.path.replace(/\\/g, "/").split("/");
  return parts.length > 2 ? parts.slice(1, -1).join("/") : "";
}

function openSbMediaPicker() {
  closeModal();
  const images = state.project.assets.filter((a) => a.kind === "image");
  let selectedBin = "";
  const bins = [...new Set(images.map(sbAssetBin))].sort((a, b) => a.localeCompare(b));
  const body = el("div", { class: "modal-body sb-media-modal" });
  const binsHost = el("div", { class: "sb-media-bins" });
  const gridHost = el("div", { class: "sb-media-grid" });
  body.append(binsHost, gridHost);

  const renderPicker = () => {
    binsHost.innerHTML = "";
    const all = el("div", { class: `bin-item ${selectedBin === "" ? "on" : ""}` }, [
      icon("layers", 13),
      "All media",
      el("span", { class: "bi-count" }, [String(images.length)]),
    ]);
    all.onclick = () => {
      selectedBin = "";
      renderPicker();
    };
    binsHost.appendChild(all);
    for (const bin of bins.filter(Boolean)) {
      const count = images.filter((asset) => sbAssetBin(asset) === bin).length;
      const item = el("div", { class: `bin-item ${selectedBin === bin ? "on" : ""}` }, [
        icon("folder", 13),
        bin,
        el("span", { class: "bi-count" }, [String(count)]),
      ]);
      item.onclick = () => {
        selectedBin = bin;
        renderPicker();
      };
      binsHost.appendChild(item);
    }

    gridHost.innerHTML = "";
    const visible = images.filter((asset) => selectedBin === "" || sbAssetBin(asset) === selectedBin);
    if (visible.length === 0) {
      gridHost.append(el("div", { class: "pool-hint" }, ["No image assets in this folder."]));
      return;
    }
    const grid = el("div", { class: "pool-grid" });
    for (const asset of visible) {
      const card = el("div", { class: "pool-card" }, [
        el("div", { class: "pool-thumb" }, [el("img", { src: assetPoolHref(asset), alt: asset.id, loading: "lazy" })]),
        el("div", { class: "pool-meta" }, [
          el("div", { class: "pm-id" }, [asset.id]),
          el("div", { class: "pm-info" }, [asset.path.replace(/^assets\//, "")]),
        ]),
      ]);
      card.onclick = async () => {
        try {
          await sbHandle?.insertMedia?.({ ...asset, href: assetPoolHref(asset) });
          closeModal();
          sbTool = "selection";
          renderSbToolRailState();
        } catch (err) {
          toast(`place media failed - ${err.message}`, "err");
        }
      };
      grid.appendChild(card);
    }
    gridHost.appendChild(grid);
  };
  renderPicker();

  const close = el("button", { class: "btn btn-ghost" }, ["Cancel"]);
  close.onclick = closeModal;
  const modal = el("div", { class: "modal" }, [
    el("div", { class: "modal-head" }, [
      el("span", { class: "mh-ico" }, [icon("image", 15)]),
      el("div", {}, [el("div", { class: "mh-title" }, ["Place media"]), el("div", { class: "mh-sub" }, ["from organized media pool folders"])]),
    ]),
    body,
    el("div", { class: "modal-foot" }, [el("span", { class: "spacer" }), close]),
  ]);
  const backdrop = el("div", { id: "modalBackdrop" }, [modal]);
  backdrop.onclick = (e) => {
    if (e.target === backdrop) closeModal();
  };
  document.body.appendChild(backdrop);
}

/* ---------------- sidebar ---------------- */

function renderSbSidebar() {
  const body = $("sbSidebar");
  if (!body || !sbBoard) return;
  body.innerHTML = "";
  fillSbSidebar(body);
}

function fillSbSidebar(body) {
  const frame = sbFrame();
  if (!frame) return;

  const sec1 = el("div", { class: "insp-section" });
  const sec1Body = el("div", { class: "insp-sec-body", style: "padding-top:12px" });
  sec1Body.append(
    field("Frame name", el("input", {
      class: "input",
      value: frame.name,
      onchange: (e) => {
        frame.name = e.target.value.trim() || frame.name;
        sbQueueSave();
        renderStoryboardPage();
      },
    })),
  );
  const note = el("textarea", { class: "input", rows: 3, placeholder: "What happens in this beat?" });
  note.value = frame.comment ?? "";
  note.onchange = () => {
    frame.comment = note.value.trim() || undefined;
    sbQueueSave();
    renderStoryboardPage();
  };
  sec1Body.append(field("Frame note", note, "agent-visible"));
  sec1.appendChild(sec1Body);
  body.appendChild(sec1);

  const sec2 = el("div", { class: "insp-section" });
  const sec2Body = el("div", { class: "insp-sec-body", style: "padding-top:12px" });
  if (sbSelection.count === 0) {
    sec2Body.append(
      el("div", { class: "sb-note" }, [
        "Select any Excalidraw object to add a Comment for AI. Double-click an object for the same comment prompt.",
      ]),
    );
  } else {
    const label = sbSelection.count === 1
      ? `${sbSelection.type}${sbSelection.assetId ? ` - ${sbSelection.assetId}` : ""}`
      : `${sbSelection.count} selected objects`;
    sec2Body.append(el("div", { class: "sb-note" }, [el("b", {}, [label])]));
    const comment = el("textarea", {
      class: "input",
      rows: 4,
      placeholder: "What should the agent understand?",
      "data-sb-role": "selection-comment",
    });
    comment.value = sbSelection.comment ?? "";
    comment.oninput = () => {
      sbHandle?.setComment?.(comment.value);
      sbSelection = { ...sbSelection, comment: comment.value.trim() };
    };
    sec2Body.append(field("Comment for AI", comment));
  }
  sec2.appendChild(sec2Body);
  body.appendChild(sec2);

  const sec3 = el("div", { class: "insp-section" });
  const sec3Body = el("div", { class: "insp-sec-body", style: "padding-top:12px" });
  const copy = el("button", { class: "btn-sm" }, [icon("copy", 12), "Copy for AI"]);
  copy.onclick = async () => {
    try {
      await sbSaveNow();
      const { text } = await api("/api/storyboard/text");
      if (!text) return toast("storyboard is empty", "err");
      try {
        await navigator.clipboard.writeText(text);
        toast("storyboard text copied");
      } catch {
        openSbCopyTextModal(text);
        toast("clipboard blocked - text is ready");
      }
    } catch (err) {
      toast(`copy failed - ${err.message}`, "err");
    }
  };
  sec3Body.append(
    el("div", { class: "sb-note" }, [
      el("b", {}, ["The agent already sees this storyboard"]),
      " when you plan from the Timeline page. Element comments are included.",
    ]),
    el("div", { class: "btn-row" }, [copy]),
  );
  sec3.appendChild(sec3Body);
  body.appendChild(sec3);
}

function openSbCopyTextModal(text) {
  closeModal();
  const area = el("textarea", { class: "input sb-copy-text", readonly: "readonly" });
  area.value = text;
  const select = el("button", { class: "btn btn-primary" }, ["Select text"]);
  select.onclick = () => {
    area.focus();
    area.select();
  };
  const close = el("button", { class: "btn btn-ghost" }, ["Done"]);
  close.onclick = closeModal;
  const modal = el("div", { class: "modal" }, [
    el("div", { class: "modal-head" }, [
      el("span", { class: "mh-ico" }, [icon("copy", 15)]),
      el("div", {}, [el("div", { class: "mh-title" }, ["Storyboard AI context"])]),
    ]),
    el("div", { class: "modal-body" }, [area]),
    el("div", { class: "modal-foot" }, [el("span", { class: "spacer" }), close, select]),
  ]);
  const backdrop = el("div", { id: "modalBackdrop" }, [modal]);
  backdrop.onclick = (e) => {
    if (e.target === backdrop) closeModal();
  };
  document.body.appendChild(backdrop);
  setTimeout(() => {
    area.focus();
    area.select();
  }, 0);
}

function sbBindKeys() {
  if (sbKeysBound) return;
  sbKeysBound = true;
  document.addEventListener("keydown", (e) => {
    if (activePage !== "storyboard") return;
    const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName);
    if (typing) return;
    const key = e.key.toLowerCase();
    const toolMap = {
      v: "selection",
      d: "freedraw",
      x: "eraser",
      r: "rectangle",
      i: "diamond",
      e: "ellipse",
      a: "arrow",
      l: "line",
      t: "text",
    };
    if (toolMap[key]) {
      e.preventDefault();
      sbTool = toolMap[key];
      sbHandle?.setTool?.(sbTool);
      renderSbToolRailState();
    } else if (key === "m") {
      e.preventDefault();
      openSbMediaPicker();
    } else if (e.key === "Escape") {
      sbTool = "selection";
      sbHandle?.setTool?.("selection");
      renderSbToolRailState();
    }
  });
}
