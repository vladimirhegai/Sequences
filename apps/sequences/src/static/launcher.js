/* Main Menu — the project launcher shown before the workspace (plan Part II
 * §8.5). DaVinci-project-manager-inspired: title up top, the project library
 * as cards (folders for organization, the bundled demo always pinned), and
 * New Project / New Folder / Open on the bottom right. */

let launcherPath = ""; // current folder inside the library ("" = root)
let launcherData = null; // last /api/projects payload

function launcherVisible() {
  return !$("launcher").classList.contains("hidden");
}

function showLauncher() {
  $("launcher").classList.remove("hidden");
  refreshLauncher();
}

function hideLauncher() {
  $("launcher").classList.add("hidden");
}

async function refreshLauncher() {
  try {
    launcherData = await api(`/api/projects?path=${encodeURIComponent(launcherPath)}`);
  } catch (err) {
    toast(`project library failed: ${err.message}`, "err");
    launcherData = { entries: [], libraryDir: "?", demo: null };
  }
  renderLauncher();
}

function launcherCard({ name, sub, dir, kind, badge, current, onOpen }) {
  const card = el("div", { class: `lr-card ${current ? "current" : ""}` });
  const thumb = el("div", { class: `lr-thumb ${kind === "folder" ? "folder" : ""}` });
  if (kind === "folder") {
    thumb.append(icon("folder", 30));
  } else {
    const img = el("img", { src: `/api/projects/poster?dir=${encodeURIComponent(dir)}`, alt: "", loading: "lazy" });
    const fallback = el("div", { class: "lr-initial" }, [name.slice(0, 2).toUpperCase()]);
    img.onerror = () => {
      img.remove();
      thumb.append(fallback);
    };
    thumb.append(img);
  }
  if (badge) thumb.append(el("span", { class: "lr-badge" }, [badge]));
  card.append(
    thumb,
    el("div", { class: "lr-meta" }, [
      el("div", { class: "lr-name" }, [name]),
      el("div", { class: "lr-date" }, [sub]),
    ]),
  );
  card.onclick = onOpen;
  return card;
}

function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

async function launcherOpenProject(dir) {
  if (state && dir === state.projectDir) {
    hideLauncher();
    render();
    return;
  }
  try {
    await switchProject({ dir }, "open");
    hideLauncher();
  } catch (err) {
    toast(`open failed — ${err.message}`, "err");
  }
}

function renderLauncher() {
  const host = $("launcher");
  host.innerHTML = "";
  const data = launcherData ?? { entries: [], libraryDir: "?", demo: null };

  host.append(
    el("div", { class: "lr-head" }, [
      el("div", { class: "lr-mark" }),
      el("div", { class: "lr-title" }, ["Sequences"]),
      el("div", { class: "lr-sub" }, ["agent-first motion graphics — pick a project to begin"]),
    ]),
  );

  // breadcrumbs inside the library
  const crumbs = el("div", { class: "lr-crumbs" });
  const segments = launcherPath ? launcherPath.split("/") : [];
  const crumb = (label, target, here) => {
    const node = el("span", { class: `lr-crumb ${here ? "here" : ""}` }, [label]);
    if (!here)
      node.onclick = () => {
        launcherPath = target;
        refreshLauncher();
      };
    return node;
  };
  crumbs.append(crumb("Projects", "", segments.length === 0));
  segments.forEach((seg, i) => {
    crumbs.append(el("span", { class: "lr-crumb-sep" }, ["›"]));
    crumbs.append(crumb(seg, segments.slice(0, i + 1).join("/"), i === segments.length - 1));
  });
  host.append(crumbs);

  // cards
  const gridWrap = el("div", { class: "lr-grid-wrap" });
  const grid = el("div", { class: "lr-grid" });

  if (data.demo && launcherPath === "") {
    grid.append(
      launcherCard({
        name: data.demo.title ?? data.demo.name,
        sub: "bundled showcase reel",
        dir: data.demo.dir,
        kind: "project",
        badge: "demo",
        current: state && state.projectDir === data.demo.dir,
        onOpen: () => launcherOpenProject(data.demo.dir),
      }),
    );
  }

  for (const entry of data.entries) {
    if (entry.kind === "folder") {
      grid.append(
        launcherCard({
          name: entry.name,
          sub: "folder",
          dir: entry.dir,
          kind: "folder",
          onOpen: () => {
            launcherPath = launcherPath ? `${launcherPath}/${entry.name}` : entry.name;
            refreshLauncher();
          },
        }),
      );
    } else {
      grid.append(
        launcherCard({
          name: entry.title ?? entry.name,
          sub: `edited ${fmtDate(entry.modifiedAt)}`,
          dir: entry.dir,
          kind: "project",
          current: state && state.projectDir === entry.dir,
          onOpen: () => launcherOpenProject(entry.dir),
        }),
      );
    }
  }

  if (grid.children.length === 0) {
    grid.append(
      el("div", { class: "lr-empty" }, [
        "No projects here yet — ",
        el("b", {}, ["New Project"]),
        " creates your first one.",
      ]),
    );
  }
  gridWrap.appendChild(grid);
  host.append(gridWrap);

  // footer: library path + the three buttons (bottom right)
  const newProject = el("button", { class: "btn btn-primary" }, [icon("plus", 13), "New Project"]);
  newProject.onclick = launcherNewProject;
  const newFolder = el("button", { class: "btn btn-ghost" }, [icon("folder", 13), "New Folder"]);
  newFolder.onclick = launcherNewFolder;
  const open = el("button", { class: "btn btn-ghost" }, ["Open"]);
  open.onclick = () => projectModal("open");

  host.append(
    el("div", { class: "lr-foot" }, [
      el("span", { class: "lr-lib", title: "the project library — set SEQUENCES_LIBRARY_DIR to move it" }, [
        data.libraryDir + (launcherPath ? `${"\\"}${launcherPath.replaceAll("/", "\\")}` : ""),
      ]),
      el("span", { class: "spacer" }),
      newFolder,
      open,
      newProject,
    ]),
  );
}

/** "New Project" — the simple prompt: a name (and the showcase toggle). */
function launcherNewProject() {
  closeModal();
  const nameInput = el("input", { class: "input", value: "", placeholder: "My Launch Promo", autocomplete: "off" });
  const showcase = el("input", { type: "checkbox" });
  const create = el("button", { class: "btn btn-primary" }, [icon("plus", 13), "Create"]);
  create.onclick = async () => {
    const name = nameInput.value.trim();
    if (!name) {
      toast("give the project a name", "err");
      return;
    }
    create.disabled = true;
    const dirName = name.replace(/[\\/:*?"<>|]/g, "-");
    const rel = launcherPath ? `${launcherPath}/${dirName}` : dirName;
    try {
      await switchProject(
        { dir: `${launcherData.libraryDir}/${rel}`, name, showcase: showcase.checked },
        "new",
      );
      hideLauncher();
    } catch (err) {
      toast(`create failed — ${err.message}`, "err");
      create.disabled = false;
    }
  };
  const cancel = el("button", { class: "btn btn-ghost" }, ["Cancel"]);
  cancel.onclick = closeModal;

  const modal = el("div", { class: "modal" }, [
    el("div", { class: "modal-head" }, [
      el("span", { class: "mh-ico" }, [icon("plus", 15)]),
      el("div", {}, [
        el("div", { class: "mh-title" }, ["New project"]),
        el("div", { class: "mh-sub mono" }, [
          `${launcherData?.libraryDir ?? ""}${launcherPath ? "\\" + launcherPath.replaceAll("/", "\\") : ""}`,
        ]),
      ]),
    ]),
    el("div", { class: "modal-body" }, [
      el("div", { class: "modal-form" }, [
        field("Project name", nameInput),
        el("label", { class: "check-row" }, [showcase, "Start from the showcase timeline"]),
      ]),
    ]),
    el("div", { class: "modal-foot" }, [create, el("span", { class: "spacer" }), cancel]),
  ]);
  const backdrop = el("div", { id: "modalBackdrop" }, [modal]);
  backdrop.onclick = (e) => {
    if (e.target === backdrop) closeModal();
  };
  document.body.appendChild(backdrop);
  nameInput.focus();
  nameInput.onkeydown = (e) => {
    if (e.key === "Enter") create.click();
  };
}

function launcherNewFolder() {
  closeModal();
  const nameInput = el("input", { class: "input", value: "", placeholder: "Client work", autocomplete: "off" });
  const create = el("button", { class: "btn btn-primary" }, [icon("folder", 13), "Create folder"]);
  create.onclick = async () => {
    const name = nameInput.value.trim();
    if (!name) return;
    try {
      await api("/api/projects/folder", { path: launcherPath, name });
      closeModal();
      refreshLauncher();
    } catch (err) {
      toast(`folder failed — ${err.message}`, "err");
    }
  };
  const cancel = el("button", { class: "btn btn-ghost" }, ["Cancel"]);
  cancel.onclick = closeModal;
  const modal = el("div", { class: "modal" }, [
    el("div", { class: "modal-head" }, [
      el("span", { class: "mh-ico" }, [icon("folder", 15)]),
      el("div", {}, [el("div", { class: "mh-title" }, ["New folder"])]),
    ]),
    el("div", { class: "modal-body" }, [el("div", { class: "modal-form" }, [field("Folder name", nameInput)])]),
    el("div", { class: "modal-foot" }, [create, el("span", { class: "spacer" }), cancel]),
  ]);
  const backdrop = el("div", { id: "modalBackdrop" }, [modal]);
  backdrop.onclick = (e) => {
    if (e.target === backdrop) closeModal();
  };
  document.body.appendChild(backdrop);
  nameInput.focus();
  nameInput.onkeydown = (e) => {
    if (e.key === "Enter") create.click();
  };
}
