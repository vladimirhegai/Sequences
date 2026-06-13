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
let sbSelection = sbEmptySelection();
let sbDragFrameId = null;
let sbSideTab = "frame";

function sbEmptySelection() {
  return { ids: [], count: 0, id: null, type: null, text: "", comment: "", assetId: null, fontFamily: null, fontSize: null, motionPathFor: null };
}

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
  sbSelection = sbEmptySelection();
  sbSideTab = "frame";
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
  const normalized = {
    version: 1,
    frames: frames.map((frame, index) => ({
      id: frame.id || `frame-${index + 1}`,
      name: sbFrameName(index),
      ...(frame.comment ? { comment: frame.comment } : {}),
      items: Array.isArray(frame.items) ? frame.items : [],
      ...(frame.excalidraw ? { excalidraw: sbNormalizeExcalidraw(frame.excalidraw) } : {}),
    })),
  };
  return sbRenumberFrames(normalized);
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

function sbFrameName(index) {
  return `Frame ${index + 1}`;
}

function sbFrameLabel(frame) {
  const index = sbBoard?.frames.findIndex((f) => f.id === frame?.id) ?? -1;
  return index >= 0 ? sbFrameName(index) : "Frame";
}

function sbRenumberFrames(board = sbBoard) {
  if (!board?.frames) return board;
  board.frames.forEach((frame, index) => {
    frame.name = sbFrameName(index);
  });
  return board;
}

function sbMoveFrameBy(id, delta) {
  if (!sbBoard) return false;
  const from = sbBoard.frames.findIndex((frame) => frame.id === id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= sbBoard.frames.length) return false;
  const [frame] = sbBoard.frames.splice(from, 1);
  sbBoard.frames.splice(to, 0, frame);
  sbRenumberFrames();
  return true;
}

function sbMoveFrameTo(dragId, targetId, placeAfter) {
  if (!sbBoard || dragId === targetId) return false;
  const moving = sbBoard.frames.find((frame) => frame.id === dragId);
  if (!moving) return false;
  const rest = sbBoard.frames.filter((frame) => frame.id !== dragId);
  let targetIndex = rest.findIndex((frame) => frame.id === targetId);
  if (targetIndex < 0) targetIndex = rest.length;
  if (placeAfter) targetIndex += 1;
  rest.splice(Math.min(targetIndex, rest.length), 0, moving);
  sbBoard.frames = rest;
  sbRenumberFrames();
  return true;
}

function sbDeleteFrame(id) {
  if (!sbBoard || sbBoard.frames.length <= 1) return false;
  const index = sbBoard.frames.findIndex((frame) => frame.id === id);
  if (index < 0) return false;
  sbBoard.frames.splice(index, 1);
  if (sbFrameId === id) {
    sbFrameId = sbBoard.frames[Math.min(index, sbBoard.frames.length - 1)]?.id ?? sbBoard.frames[0]?.id ?? null;
  }
  sbRenumberFrames();
  return true;
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
  sbRenumberFrames();
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
  ["motionpath", "route", "Motion path - select an object, then draw the path it moves along during this beat"],
];

function sbArmMotionPath() {
  if (!sbHandle?.armMotionPath?.()) return;
  sbTool = "motionpath";
  renderSbToolRailState();
  toast("draw the movement path - it attaches to the selected object");
}

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
    const frameName = sbFrameName(i);
    const card = el("div", {
      class: `sb-frame ${frame.id === sbFrameId ? "on" : ""}`,
      title: frame.comment || frameName,
      draggable: "true",
    });
    card.append(el("span", { class: "sf-n" }, [String(i + 1)]));
    if (frame.comment || sbFrameHasElementComments(frame)) card.append(el("span", { class: "sf-dot", title: "has AI comments" }));
    card.append(el("span", { class: "sf-name" }, [`${frameName}${count ? ` - ${count}` : ""}`]));
    const actions = el("div", { class: "sf-actions" });
    const leftAttrs = { class: "sf-act", title: "Move frame left" };
    if (i === 0) leftAttrs.disabled = "true";
    const left = el("button", leftAttrs, [icon("arrow", 10)]);
    left.firstChild.style.transform = "rotate(180deg)";
    left.onclick = (e) => {
      e.stopPropagation();
      if (!sbMoveFrameBy(frame.id, -1)) return;
      sbFrameId = frame.id;
      sbSelection = sbEmptySelection();
      sbQueueSave();
      renderStoryboardPage();
    };
    const rightAttrs = { class: "sf-act", title: "Move frame right" };
    if (i === sbBoard.frames.length - 1) rightAttrs.disabled = "true";
    const right = el("button", rightAttrs, [icon("arrow", 10)]);
    right.onclick = (e) => {
      e.stopPropagation();
      if (!sbMoveFrameBy(frame.id, 1)) return;
      sbFrameId = frame.id;
      sbSelection = sbEmptySelection();
      sbQueueSave();
      renderStoryboardPage();
    };
    actions.append(left, right);
    if (sbBoard.frames.length > 1) {
      const del = el("button", { class: "sf-act sf-del", title: "Delete frame" }, [icon("x", 10)]);
      del.onclick = (e) => {
        e.stopPropagation();
        sbDeleteFrame(frame.id);
        sbSelection = sbEmptySelection();
        sbQueueSave();
        renderStoryboardPage();
      };
      actions.append(del);
    }
    card.append(actions);
    card.onclick = () => {
      sbFrameId = frame.id;
      sbSelection = sbEmptySelection();
      renderStoryboardPage();
    };
    card.ondragstart = (e) => {
      sbDragFrameId = frame.id;
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", frame.id);
      card.classList.add("dragging");
    };
    card.ondragend = () => {
      sbDragFrameId = null;
      card.classList.remove("dragging", "drop-before", "drop-after");
    };
    card.ondragover = (e) => {
      if (!sbDragFrameId || sbDragFrameId === frame.id) return;
      e.preventDefault();
      const rect = card.getBoundingClientRect();
      const after = e.clientX > rect.left + rect.width / 2;
      card.classList.toggle("drop-before", !after);
      card.classList.toggle("drop-after", after);
    };
    card.ondragleave = () => card.classList.remove("drop-before", "drop-after");
    card.ondrop = (e) => {
      e.preventDefault();
      const dragId = e.dataTransfer.getData("text/plain") || sbDragFrameId;
      const rect = card.getBoundingClientRect();
      const after = e.clientX > rect.left + rect.width / 2;
      card.classList.remove("drop-before", "drop-after");
      if (!sbMoveFrameTo(dragId, frame.id, after)) return;
      sbFrameId = dragId;
      sbSelection = sbEmptySelection();
      sbQueueSave();
      renderStoryboardPage();
    };
    strip.appendChild(card);
  });
  const add = el("button", { class: "sb-add", title: "Add frame" }, [icon("plus", 15)]);
  add.onclick = () => {
    const id = sbNewId("frame");
    sbBoard.frames.push({ id, name: sbFrameName(sbBoard.frames.length), items: [] });
    sbRenumberFrames();
    sbFrameId = id;
    sbSelection = sbEmptySelection();
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
      if (id === "motionpath") return sbArmMotionPath();
      sbTool = id;
      sbHandle?.setTool?.(id);
      renderSbToolRailState();
    };
    rail.appendChild(btn);
  }
  rail.append(el("div", { class: "tool-sep" }));
  const clear = el("button", { class: "tool-btn danger", title: "Clear current frame" }, [icon("trash", 14)]);
  clear.onclick = () => {
    const frame = sbFrame();
    if (!frame) return;
    if (confirm(`Clear ${sbFrameLabel(frame)}?`)) sbHandle?.clear?.();
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
    el("div", { class: "pane-head sb-pane-head" }, [buildSbSideTabs()]),
    el("div", { class: "pane-body", id: "sbSidebar" }),
  );
  side.appendChild(splitHandle({ edge: "left", cssVar: "--sb-side-w", min: 220, max: 480 }));
  return side;
}

function buildSbSideTabs() {
  const tabs = el("div", { class: "tabs sb-pane-tabs", id: "sbSideTabs" });
  for (const [id, label] of [["frame", "Frame"], ["selection", "Selection"]]) {
    const tab = el("button", { class: `tab ${sbSideTab === id ? "on" : ""}` }, [label]);
    tab.onclick = () => {
      sbSideTab = id;
      $("sbSideTabs")?.replaceWith(buildSbSideTabs());
      renderSbSidebar();
    };
    tabs.appendChild(tab);
  }
  return tabs;
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
        sbBoard.frames[idx] = { ...nextFrame, name: sbFrameName(idx) };
        sbRenumberFrames();
        sbQueueSave();
      }
    },
    onSelectionChange: (summary) => {
      const sameTarget = sbSelectionSignature(sbSelection) === sbSelectionSignature(summary);
      sbSelection = summary;
      if (sbTool === "motionpath" && summary.motionPathFor) {
        // the path landed — the canvas already switched itself back to select
        sbTool = "selection";
        renderSbToolRailState();
      }
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
  fillSbSidebarTabbed(body);
}

function sbSection(headLabel, headHint) {
  const sec = el("div", { class: "insp-section" });
  const head = [el("span", { class: "t" }, [headLabel])];
  if (headHint) head.push(el("span", { class: "x" }, [headHint]));
  sec.append(el("div", { class: "insp-sec-head" }, head));
  const secBody = el("div", { class: "insp-sec-body" });
  sec.appendChild(secBody);
  return { sec, secBody };
}

function fillSbSidebarTabbed(body) {
  const frame = sbFrame();
  if (!frame) return;

  if (sbSideTab === "frame") {
    const frameSec = sbSection("Frame", sbFrameLabel(frame));
    const note = el("textarea", { class: "input", rows: 3, placeholder: "What happens in this beat?" });
    note.value = frame.comment ?? "";
    note.onchange = () => {
      frame.comment = note.value.trim() || undefined;
      sbQueueSave();
      renderStoryboardPage();
    };
    frameSec.secBody.append(field("Beat note", note, "agent-visible"));
    body.appendChild(frameSec.sec);

    const contextSec = sbSection("Agent context");
    const copy = el("button", { class: "btn-sm", style: "width:100%;justify-content:center" }, [icon("copy", 12), "Copy storyboard for AI"]);
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
    contextSec.secBody.append(
      el("div", { class: "sb-note" }, [
        "The agent reads this storyboard automatically when you plan from the Timeline.",
      ]),
      copy,
    );
    body.appendChild(contextSec.sec);
    return;
  }

  const selectionSec = sbSection("Selection");
  if (sbSelection.count === 0) {
    selectionSec.secBody.append(
      el("div", { class: "sb-empty" }, [
        el("span", { class: "sb-empty-ico" }, [icon("cursor", 16)]),
        el("div", { class: "sb-empty-line" }, ["Nothing selected"]),
        el("div", { class: "sb-empty-sub" }, ["Select an object to add a comment for the agent."]),
      ]),
    );
  } else {
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
    selectionSec.secBody.append(field("Comment for AI", comment));
  }
  body.appendChild(selectionSec.sec);
}

function fillSbSidebar(body) {
  const frame = sbFrame();
  if (!frame) return;

  /* ---- Frame: the beat-level note ---- */
  const f1 = sbSection("Frame", sbFrameLabel(frame));
  const note = el("textarea", { class: "input", rows: 3, placeholder: "What happens in this beat?" });
  note.value = frame.comment ?? "";
  note.onchange = () => {
    frame.comment = note.value.trim() || undefined;
    sbQueueSave();
    renderStoryboardPage();
  };
  f1.secBody.append(field("Beat note", note, "agent-visible"));
  body.appendChild(f1.sec);

  /* ---- Selection: per-object comment + motion path ---- */
  const f2 = sbSection("Selection");
  if (sbSelection.count === 0) {
    f2.secBody.append(
      el("div", { class: "sb-empty" }, [
        el("span", { class: "sb-empty-ico" }, [icon("cursor", 16)]),
        el("div", { class: "sb-empty-line" }, ["Nothing selected"]),
        el("div", { class: "sb-empty-sub" }, [
          "Select an object to attach a comment, or press ",
          el("b", {}, ["P"]),
          " to draw the path it moves along this beat.",
        ]),
      ]),
    );
  } else {
    const label = sbSelection.count === 1
      ? `${sbSelection.type}${sbSelection.assetId ? ` · ${sbSelection.assetId}` : ""}`
      : `${sbSelection.count} objects`;
    f2.secBody.append(el("div", { class: "sb-sel-tag" }, [label]));
    if (sbSelection.motionPathFor) {
      f2.secBody.append(
        el("div", { class: "sb-note sb-motion-note" }, [
          icon("route", 11),
          " motion path — how the attached object moves this beat",
        ]),
      );
    }
    if (sbSelection.count === 1 && sbSelection.type === "text") {
      const fonts = window.SequenceStoryboardExcalidraw?.FONT_FAMILIES ?? [];
      if (fonts.length) {
        const fontSel = selectInput(
          fonts.map((f) => String(f.id)),
          String(sbSelection.fontFamily ?? fonts[0].id),
          (v) => {
            sbHandle?.setFontFamily?.(Number(v));
            sbSelection = { ...sbSelection, fontFamily: Number(v) };
          },
          fonts.map((f) => f.label),
        );
        const sizeBox = el("input", { class: "input", type: "number", min: 8, max: 220, step: 2, value: sbSelection.fontSize ?? 36 });
        sizeBox.onchange = () => {
          sbHandle?.setFontSize?.(Number(sizeBox.value) || 36);
          sbSelection = { ...sbSelection, fontSize: Number(sizeBox.value) || 36 };
        };
        f2.secBody.append(
          el("div", { class: "row2" }, [field("Font", fontSel), field("Size", sizeBox)]),
        );
      }
    }
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
    f2.secBody.append(field("Comment for AI", comment));
  }
  body.appendChild(f2.sec);

  /* ---- Agent context: the storyboard rides with the plan ---- */
  const f3 = sbSection("Agent context");
  const copy = el("button", { class: "btn-sm", style: "width:100%;justify-content:center" }, [icon("copy", 12), "Copy storyboard for AI"]);
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
  f3.secBody.append(
    el("div", { class: "sb-note" }, [
      "The agent reads this storyboard automatically when you plan from the Timeline.",
    ]),
    copy,
  );
  body.appendChild(f3.sec);
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
    } else if (key === "p") {
      e.preventDefault();
      sbArmMotionPath();
    } else if (e.key === "Escape") {
      sbTool = "selection";
      sbHandle?.setTool?.("selection");
      renderSbToolRailState();
    }
  });
}
