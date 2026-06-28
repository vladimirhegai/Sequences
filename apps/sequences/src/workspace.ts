/**
 * Workspace-page host services (Phase 1 foundation, plan Part II §8.5):
 *
 *  - the project LIBRARY behind the Main Menu launcher (a plain directory of
 *    project folders + organizing subfolders; the demo stays pinned),
 *  - read-only DISK BROWSING for the Media page's file view,
 *  - asset IMPORT into the media pool (copy into assets/, then the caller
 *    registers it through an AddAsset command — one mutation pathway).
 *
 * None of this touches the scene graph directly; everything that mutates the
 * project goes back out through the command API.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
export {
  fsRoots,
  listDisk,
  mediaKind,
  placeAsset,
  type FsListing,
  type FsRoot,
  type ImportedAsset,
} from "@sequences/platform/media";

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
  if (!clean || clean === "." || clean === ".." || /[\\/:*?"<>|]/.test(clean)) {
    throw new Error("invalid folder name");
  }
  const parent = safeChild(libraryDir(), rel || ".");
  if (!parent) throw new Error("path escapes the project library");
  const dir = safeChild(parent, clean);
  if (!dir) throw new Error("path escapes the project library");
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

/* ------------------------------------------------------------- path safety */

export function safeChild(root: string, rel: string): string | null {
  const rootPath = path.resolve(root);
  const file = path.resolve(rootPath, path.normalize(rel));
  if (file !== rootPath && !file.startsWith(rootPath + path.sep)) return null;
  return file;
}
