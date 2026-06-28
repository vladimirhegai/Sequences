/**
 * Markdown reference docs for Forge (FORGE.md Library — ".md files").
 *
 * A design.md / brand.md the user wants the Stage agent to reference is NOT
 * render media, so it never enters the engine asset pipeline (the canonical
 * `Asset.kind` is image/video/audio only — keeping the engine pristine, law 2).
 * Instead it lives in a small Forge-level store: the bytes under `docs/` and a
 * tiny `docs.json` index. Docs surface in the Library/Stage media area as
 * referenceable chips, and their TEXT is inlined into the Stage prompt (cheap,
 * high-signal).
 */
import fs from "node:fs";
import path from "node:path";
import { contentHash } from "@sequences/core";

export interface ForgeDoc {
  id: string;
  name: string;
  relPath: string;
  updatedAt: string;
}

const STORE_FILE = "docs.json";
const DOCS_DIR = "docs";

function indexPath(root: string): string {
  return path.join(root, STORE_FILE);
}

function slug(input: string): string {
  return (
    String(input || "doc")
      .trim()
      .toLowerCase()
      .replace(/\.md$/i, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "doc"
  );
}

export function readDocIndex(root: string): ForgeDoc[] {
  const file = indexPath(root);
  if (!fs.existsSync(file)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
    if (!Array.isArray(raw)) return [];
    // Drop entries whose file vanished, so the UI never lists a dead doc.
    return (raw as ForgeDoc[]).filter((d) => d && d.relPath && fs.existsSync(path.join(root, d.relPath)));
  } catch {
    return [];
  }
}

function writeDocIndex(root: string, docs: ForgeDoc[]): void {
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(indexPath(root), `${JSON.stringify(docs, null, 2)}\n`);
}

/** Add or replace a markdown reference doc (dedupes by name). */
export function addDoc(root: string, name: string, text: string): ForgeDoc {
  const cleanName = (name || "untitled.md").trim().replace(/[\\/]/g, "-");
  const base = slug(cleanName);
  const docsDir = path.join(root, DOCS_DIR);
  fs.mkdirSync(docsDir, { recursive: true });
  const docs = readDocIndex(root);
  const existing = docs.find((d) => slug(d.name) === base);
  const id = existing?.id ?? `doc-${base}-${contentHash({ name: cleanName }).slice(0, 6)}`;
  const relPath = path.join(DOCS_DIR, `${base}.md`).replace(/\\/g, "/");
  fs.writeFileSync(path.join(root, relPath), text ?? "");
  const entry: ForgeDoc = { id, name: cleanName, relPath, updatedAt: new Date().toISOString() };
  const next = [entry, ...docs.filter((d) => d.id !== id)];
  writeDocIndex(root, next);
  return entry;
}

export function deleteDoc(root: string, id: string): ForgeDoc[] {
  const docs = readDocIndex(root);
  const target = docs.find((d) => d.id === id);
  if (target) fs.rmSync(path.join(root, target.relPath), { force: true });
  const next = docs.filter((d) => d.id !== id);
  writeDocIndex(root, next);
  return next;
}

export function readDocText(root: string, id: string): string | null {
  const doc = readDocIndex(root).find((d) => d.id === id);
  if (!doc) return null;
  const file = path.join(root, doc.relPath);
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
}

export function findDoc(root: string, id: string): ForgeDoc | null {
  return readDocIndex(root).find((d) => d.id === id) ?? null;
}
