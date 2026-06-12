/**
 * Workspace-page host services (Phase 1 foundation, plan Part II §8.5):
 *
 *  - the project LIBRARY behind the Main Menu launcher (a plain directory of
 *    project folders + organizing subfolders; the demo stays pinned),
 *  - read-only DISK BROWSING for the Media page's file view,
 *  - asset IMPORT into the media pool (copy into assets/, then the caller
 *    registers it through an AddAsset command — one mutation pathway),
 *  - the STORYBOARD sidecar (storyboard.json) and its deterministic
 *    text serialization for agent reference.
 *
 * None of this touches the scene graph directly; everything that mutates the
 * project goes back out through the command API.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/* ---------------------------------------------------------------- library */

export function libraryDir(): string {
  return process.env.SEQUENCES_LIBRARY_DIR ?? path.join(os.homedir(), "Sequences");
}

export interface LibraryEntry {
  kind: "project" | "folder";
  name: string;
  /** Absolute directory. */
  dir: string;
  modifiedAt: string;
  /** projects only: meta pulled from project.json (best effort) */
  title?: string;
}

function isProjectDir(dir: string): boolean {
  return fs.existsSync(path.join(dir, "project.json"));
}

function projectTitle(dir: string): string | undefined {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(dir, "project.json"), "utf8")) as {
      meta?: { title?: string };
    };
    return raw.meta?.title;
  } catch {
    return undefined;
  }
}

/** List one level of the library at `rel` ("" = root). Folders first. */
export function listLibrary(rel: string): { path: string; entries: LibraryEntry[] } {
  const root = libraryDir();
  const target = safeChild(root, rel || ".");
  if (!target) throw new Error("path escapes the project library");
  const entries: LibraryEntry[] = [];
  if (fs.existsSync(target)) {
    for (const name of fs.readdirSync(target)) {
      if (name.startsWith(".")) continue;
      const dir = path.join(target, name);
      let stat: fs.Stats;
      try {
        stat = fs.statSync(dir);
      } catch {
        continue;
      }
      if (!stat.isDirectory()) continue;
      if (isProjectDir(dir)) {
        entries.push({
          kind: "project",
          name,
          dir,
          modifiedAt: projectMtime(dir).toISOString(),
          title: projectTitle(dir),
        });
      } else {
        entries.push({ kind: "folder", name, dir, modifiedAt: stat.mtime.toISOString() });
      }
    }
  }
  entries.sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === "folder" ? -1 : 1));
  return { path: rel, entries };
}

function projectMtime(dir: string): Date {
  try {
    return fs.statSync(path.join(dir, "project.json")).mtime;
  } catch {
    return fs.statSync(dir).mtime;
  }
}

export function createLibraryFolder(rel: string, name: string): string {
  const clean = name.trim();
  if (!clean || /[\\/:*?"<>|]/.test(clean)) throw new Error("invalid folder name");
  const parent = safeChild(libraryDir(), rel || ".");
  if (!parent) throw new Error("path escapes the project library");
  const dir = path.join(parent, clean);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Poster image for a project card: newest render poster, else a thumb. */
export function findProjectPoster(dir: string): string | null {
  const candidates: Array<{ file: string; mtime: number }> = [];
  const scan = (sub: string, exts: string[]) => {
    const d = path.join(dir, sub);
    if (!fs.existsSync(d)) return;
    for (const name of fs.readdirSync(d)) {
      if (!exts.includes(path.extname(name).toLowerCase())) continue;
      const file = path.join(d, name);
      try {
        candidates.push({ file, mtime: fs.statSync(file).mtimeMs });
      } catch {
        /* ignore */
      }
    }
  };
  scan("renders", [".jpg", ".jpeg", ".png"]);
  scan(path.join("build", "thumbs"), [".png", ".jpg"]);
  candidates.sort((a, b) => b.mtime - a.mtime);
  return candidates[0]?.file ?? null;
}

/* ------------------------------------------------------------- disk browse */

const MEDIA_EXT: Record<string, "image" | "video" | "audio"> = {
  ".png": "image", ".jpg": "image", ".jpeg": "image", ".gif": "image", ".webp": "image",
  ".svg": "image", ".bmp": "image", ".avif": "image",
  ".mp4": "video", ".mov": "video", ".webm": "video", ".mkv": "video", ".avi": "video",
  ".mp3": "audio", ".wav": "audio", ".ogg": "audio", ".m4a": "audio", ".flac": "audio",
};

export function mediaKind(file: string): "image" | "video" | "audio" | null {
  return MEDIA_EXT[path.extname(file).toLowerCase()] ?? null;
}

export interface FsRoot { name: string; path: string }

export function fsRoots(projectDir: string): FsRoot[] {
  const roots: FsRoot[] = [
    { name: "Project", path: path.resolve(projectDir) },
    { name: "Home", path: os.homedir() },
  ];
  if (process.platform === "win32") {
    for (let c = 67; c <= 90; c++) {
      const drive = `${String.fromCharCode(c)}:\\`;
      if (fs.existsSync(drive)) roots.push({ name: drive, path: drive });
    }
  } else {
    roots.push({ name: "/", path: "/" });
  }
  // dedupe (Project may live under Home)
  const seen = new Set<string>();
  return roots.filter((r) => (seen.has(r.path) ? false : (seen.add(r.path), true)));
}

export interface FsListing {
  path: string;
  parent: string | null;
  dirs: Array<{ name: string; path: string }>;
  files: Array<{ name: string; path: string; size: number; mtime: string; kind: string }>;
}

/** Read-only directory listing; media files only. Local tool, localhost-bound. */
export function listDisk(target: string): FsListing {
  const abs = path.resolve(target);
  const dirs: FsListing["dirs"] = [];
  const files: FsListing["files"] = [];
  for (const name of fs.readdirSync(abs)) {
    if (name.startsWith(".") || name.startsWith("$")) continue;
    const p = path.join(abs, name);
    let stat: fs.Stats;
    try {
      stat = fs.statSync(p);
    } catch {
      continue; // permission/locked — skip silently
    }
    if (stat.isDirectory()) {
      dirs.push({ name, path: p });
    } else {
      const kind = mediaKind(name);
      if (kind) files.push({ name, path: p, size: stat.size, mtime: stat.mtime.toISOString(), kind });
    }
  }
  dirs.sort((a, b) => a.name.localeCompare(b.name));
  files.sort((a, b) => a.name.localeCompare(b.name));
  const parent = path.dirname(abs);
  return { path: abs, parent: parent === abs ? null : parent, dirs, files };
}

/* ------------------------------------------------------------ asset import */

function slugify(base: string): string {
  const slug = base.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug || "asset";
}

export interface ImportedAsset {
  id: string;
  /** project-relative, forward slashes (Asset.path contract) */
  relPath: string;
  kind: "image" | "video" | "audio";
}

/**
 * Place a media file into <project>/assets/[folder/]. Returns the Asset
 * fields for the AddAsset command the caller MUST apply through the store.
 */
export function placeAsset(
  projectDir: string,
  fileName: string,
  folder: string,
  existingIds: ReadonlySet<string>,
  write: (destination: string) => void,
): ImportedAsset {
  const kind = mediaKind(fileName);
  if (!kind) throw new Error(`unsupported media type: ${path.extname(fileName) || fileName}`);
  const assetsRoot = path.join(projectDir, "assets");
  const cleanFolder = folder.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  const destDir = cleanFolder ? safeChild(assetsRoot, cleanFolder) : assetsRoot;
  if (!destDir) throw new Error("asset folder escapes assets/");
  fs.mkdirSync(destDir, { recursive: true });

  const ext = path.extname(fileName);
  const base = path.basename(fileName, ext);
  let name = `${base}${ext}`;
  let n = 2;
  while (fs.existsSync(path.join(destDir, name))) name = `${base}-${n++}${ext}`;
  write(path.join(destDir, name));

  let id = slugify(path.basename(name, ext));
  n = 2;
  while (existingIds.has(id)) id = `${slugify(base)}-${n++}`;

  const rel = ["assets", ...(cleanFolder ? [cleanFolder] : []), name].join("/");
  return { id, relPath: rel, kind };
}

export function safeChild(root: string, rel: string): string | null {
  const rootPath = path.resolve(root);
  const file = path.resolve(rootPath, path.normalize(rel));
  if (file !== rootPath && !file.startsWith(rootPath + path.sep)) return null;
  return file;
}

/* -------------------------------------------------------------- storyboard */

export interface StoryboardItem {
  id: string;
  type: "draw" | "rect" | "ellipse" | "arrow" | "text" | "media";
  /** percent coordinates of the frame canvas (0–100) */
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  /** draw/arrow: flat [x1,y1,x2,y2,...] percent coordinates */
  points?: number[];
  text?: string;
  assetId?: string;
  color?: string;
  /** the user's intent annotation — what the agent reads */
  comment?: string;
}

export interface StoryboardFrame {
  id: string;
  name: string;
  /** frame-level intent note */
  comment?: string;
  items: StoryboardItem[];
  /** Excalidraw scene payload for the Phase-1 storyboard editor. */
  excalidraw?: {
    elements?: Array<Record<string, unknown>>;
    appState?: Record<string, unknown>;
    files?: Record<string, unknown>;
  };
}

export interface Storyboard {
  version: 1;
  frames: StoryboardFrame[];
}

export function defaultStoryboard(): Storyboard {
  return { version: 1, frames: [{ id: "frame-1", name: "Frame 1", items: [] }] };
}

export function loadStoryboard(projectDir: string): Storyboard {
  const file = path.join(projectDir, "storyboard.json");
  if (!fs.existsSync(file)) return defaultStoryboard();
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as Storyboard;
    if (raw && raw.version === 1 && Array.isArray(raw.frames)) return raw;
  } catch {
    /* corrupted → fresh */
  }
  return defaultStoryboard();
}

export function saveStoryboard(projectDir: string, board: Storyboard): void {
  if (board.version !== 1 || !Array.isArray(board.frames)) throw new Error("invalid storyboard");
  fs.writeFileSync(path.join(projectDir, "storyboard.json"), JSON.stringify(board, null, 2) + "\n");
}

const pct = (v: number | undefined) => `${Math.round(v ?? 0)}%`;

/**
 * Deterministic storyboard → text for the planner (T-storyboard v1).
 * Compact, positional, comment-forward; Phase 2 optimizes the encoding.
 */
export function storyboardToText(board: Storyboard): string {
  const frames = board.frames.filter((f) => storyboardItemsForText(f).length > 0 || excalidrawElements(f).length > 0 || f.comment);
  if (frames.length === 0) return "";
  const lines: string[] = ["Storyboard (frames are sequential beats of the video):"];
  frames.forEach((frame, i) => {
    lines.push(`\nFrame ${i + 1} - ${frame.name}${frame.comment ? ` - note: ${frame.comment}` : ""}`);
    const items = storyboardItemsForText(frame);
    const sketches = items.filter((it) => it.type === "draw");
    if (sketches.length > 0) lines.push(`  - freehand sketch (${sketches.length} strokes)`);
    for (const it of items) {
      if (it.type === "draw") continue;
      const at = `at (${pct(it.x)}, ${pct(it.y)})${it.w ? ` size ${pct(it.w)}x${pct(it.h)}` : ""}`;
      const desc =
        it.type === "text"
          ? `text "${it.text ?? ""}" ${at}`
          : it.type === "media"
            ? `media asset "${it.assetId ?? "?"}" ${at}`
            : it.type === "arrow"
              ? `arrow from (${pct(it.points?.[0])}, ${pct(it.points?.[1])}) to (${pct(it.points?.[2])}, ${pct(it.points?.[3])})`
              : `${it.type} ${at}`;
      lines.push(`  - ${desc}${it.comment ? ` - intent: ${it.comment}` : ""}`);
    }
    for (const line of excalidrawFrameToText(frame)) lines.push(line);
  });
  return lines.join("\n");
}

function storyboardItemsForText(frame: StoryboardFrame): StoryboardItem[] {
  return frame.excalidraw ? [] : frame.items;
}

function excalidrawElements(frame: StoryboardFrame): Array<Record<string, unknown>> {
  return (frame.excalidraw?.elements ?? []).filter((el) => el && el.isDeleted !== true);
}

function excalidrawComment(el: Record<string, unknown>): string {
  const customData = el.customData as Record<string, unknown> | undefined;
  return String(customData?.sequenceAiComment ?? customData?.commentForAI ?? "").trim();
}

function excalidrawAssetId(el: Record<string, unknown>): string | null {
  const customData = el.customData as Record<string, unknown> | undefined;
  const value = customData?.sequenceAssetId;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function excalidrawFrameToText(frame: StoryboardFrame): string[] {
  const elements = excalidrawElements(frame);
  if (elements.length === 0) return [];
  const lines: string[] = [];
  const freehandCount = elements.filter((el) => el.type === "freedraw").length;
  if (freehandCount > 0) lines.push(`  - Excalidraw freehand sketch (${freehandCount} strokes)`);
  for (const el of elements) {
    if (el.type === "freedraw") continue;
    const type = String(el.type ?? "element");
    const x = Math.round(Number(el.x ?? 0));
    const y = Math.round(Number(el.y ?? 0));
    const w = Math.round(Number(el.width ?? 0));
    const h = Math.round(Number(el.height ?? 0));
    const at = `at scene (${x}, ${y})${w || h ? ` size ${w}x${h}` : ""}`;
    const comment = excalidrawComment(el);
    const assetId = excalidrawAssetId(el);
    const text = typeof el.text === "string" ? el.text.trim() : "";
    const desc =
      type === "text"
        ? `Excalidraw text "${text}" ${at}`
        : type === "image"
          ? `Excalidraw media asset "${assetId ?? "embedded"}" ${at}`
          : type === "arrow" || type === "line"
            ? `Excalidraw ${type} ${at}`
            : `Excalidraw ${type} ${at}`;
    lines.push(`  - ${desc}${comment ? ` - intent: ${comment}` : ""}`);
  }
  return lines;
}
