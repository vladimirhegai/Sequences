/**
 * Scratch media — the "invisible media library" (FORGE.md Stage chat).
 *
 * Images pasted from the clipboard into the Stage composer are a one-shot
 * reference, not library media: they must NOT be registered as project assets or
 * appear in the media pool. They land in a hidden `.forge-scratch/` dir and are
 * referenced by id. The architecture stays identical to pool media — the Stage
 * runner resolves a scratch reference to a file path exactly like an asset — so
 * nothing downstream is special-cased; only the storage tier differs.
 */
import fs from "node:fs";
import path from "node:path";
import { mediaKind } from "@sequences/platform/media";

const SCRATCH_DIR = ".forge-scratch";

function dir(root: string): string {
  return path.join(root, SCRATCH_DIR);
}

function extFromName(fileName: string): string {
  const ext = path.extname(fileName || "").toLowerCase();
  return ext && /^\.[a-z0-9]+$/.test(ext) ? ext : ".png";
}

export interface ScratchItem {
  id: string;
  fileName: string;
  relPath: string;
  kind: "image";
}

/** Persist pasted bytes to the hidden scratch dir; only images are accepted. */
export function saveScratchImage(root: string, fileName: string, bytes: Buffer): ScratchItem {
  const ext = extFromName(fileName);
  // Reject anything that isn't an image (the agent can't view video; pasted clips
  // are images by definition, but guard the path anyway).
  if (mediaKind(`x${ext}`) !== "image" && ext !== ".svg") {
    throw new Error(`scratch only accepts pasted images (got ${ext})`);
  }
  fs.mkdirSync(dir(root), { recursive: true });
  const id = `scratch-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const relPath = path.join(SCRATCH_DIR, `${id}${ext}`).replace(/\\/g, "/");
  fs.writeFileSync(path.join(root, relPath), bytes);
  return { id, fileName: fileName || `${id}${ext}`, relPath, kind: "image" };
}

/** Resolve a scratch id to its absolute path, or null if gone. */
export function resolveScratch(root: string, id: string): string | null {
  if (!/^scratch-[a-z0-9-]+$/i.test(id)) return null;
  const folder = dir(root);
  if (!fs.existsSync(folder)) return null;
  const match = fs.readdirSync(folder).find((f) => f.slice(0, f.lastIndexOf(".")) === id || f.startsWith(`${id}.`));
  return match ? path.join(folder, match) : null;
}
