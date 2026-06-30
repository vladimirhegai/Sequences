/**
 * Forge media subsystem (FORGE.md §8).
 *
 * Importing media reuses the shared platform asset pipeline — `placeAsset`
 * copies bytes into the document's `assets/` with a content-hash id and probed
 * metadata, and the asset is registered through the `AddAsset` command (one
 * mutation pathway, law 1). Media therefore lands in the document exactly like
 * it does in a real Sequences project; standardization happens later, on export
 * (see standardize.ts), never on the way in.
 *
 * Two tiers (FORGE.md §8): *reference* media (the clip you're tracing — an
 * authoring aid, never exported) and *example* media (what you stage — becomes a
 * typed Media Slot on export). The tier is recorded on the document.
 */
import fs from "node:fs";
import { placeAsset, mediaKind } from "@sequences/platform/media";
import type { ForgeDocument } from "./document.ts";

export interface ImportMediaResult {
  ok: boolean;
  assetId?: string;
  duplicate?: boolean;
  errors?: string[];
}

export interface ImportMediaOptions {
  /** Mark as reference (tracing aid) rather than stageable example media. */
  reference?: boolean;
  /** Bin (a folder under assets/) to place the import into. */
  folder?: string;
}

/** True if Forge can import this filename as media (image/video/audio). */
export function isImportableMedia(fileName: string): boolean {
  return mediaKind(fileName) !== null;
}

/**
 * Import media into a document from a `write` callback that materializes the
 * bytes at a destination path. Dedupes by content hash; registers via AddAsset.
 */
export function importMedia(
  doc: ForgeDocument,
  fileName: string,
  write: (destination: string) => void,
  options: ImportMediaOptions = {},
): ImportMediaResult {
  if (!isImportableMedia(fileName)) {
    return { ok: false, errors: [`unsupported media type: ${fileName}`] };
  }
  const existing = new Set(doc.project.assets.map((a) => a.id));
  const placed = placeAsset(doc.dir, fileName, options.folder ?? "", existing, write);

  const duplicate = doc.project.assets.find((a) => a.contentHash === placed.contentHash);
  if (duplicate) {
    // Identical bytes already in the document — drop the copy, reuse the asset.
    fs.rmSync(`${doc.dir}/${placed.relPath}`, { force: true });
    if (options.reference) doc.markReference(duplicate.id, true);
    return { ok: true, assetId: duplicate.id, duplicate: true };
  }

  const outcome = doc.addAsset({
    id: placed.id,
    path: placed.relPath,
    kind: placed.kind,
    contentHash: placed.contentHash,
    metadata: placed.metadata,
  });
  if (!outcome.ok) {
    fs.rmSync(`${doc.dir}/${placed.relPath}`, { force: true });
    return { ok: false, errors: outcome.errors.map((e) => `${e.path}: ${e.message}`) };
  }
  if (options.reference) doc.markReference(placed.id, true);
  return { ok: true, assetId: placed.id };
}

/** Copy an existing on-disk file into the document (dependency-free import). */
export function importMediaFromPath(
  doc: ForgeDocument,
  sourcePath: string,
  options: ImportMediaOptions = {},
): ImportMediaResult {
  const fileName = sourcePath.replace(/\\/g, "/").split("/").pop() ?? "media";
  return importMedia(doc, fileName, (destination) => fs.copyFileSync(sourcePath, destination), options);
}

/** Write raw bytes (e.g. an upload) into the document as media. */
export function importMediaFromBytes(
  doc: ForgeDocument,
  fileName: string,
  bytes: Buffer,
  options: ImportMediaOptions = {},
): ImportMediaResult {
  return importMedia(doc, fileName, (destination) => fs.writeFileSync(destination, bytes), options);
}
