/**
 * `.seqext` bundle file IO for Forge. The engine (packages/core) stays zero-IO;
 * this is the thin disk layer that reads/writes the bundle folder shape
 * (manifest.json + spec.json) defined in FORGE.md §8.
 */
import fs from "node:fs";
import path from "node:path";
import { SeqextBundleSchema, type SeqextBundle } from "@sequences/core";

const BUNDLE_SUFFIX = ".seqext";

export function readBundle(dir: string): SeqextBundle {
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8"));
  const spec = JSON.parse(fs.readFileSync(path.join(dir, "spec.json"), "utf8"));
  return SeqextBundleSchema.parse({ manifest, spec });
}

export function writeBundle(dir: string, bundle: SeqextBundle): void {
  const parsed = SeqextBundleSchema.parse(bundle);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "manifest.json"), `${JSON.stringify(parsed.manifest, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, "spec.json"), `${JSON.stringify(parsed.spec, null, 2)}\n`);
}

export interface BundleEntry {
  id: string;
  dir: string;
  bundle: SeqextBundle;
}

/** List every well-formed `*.seqext` folder under `root` (malformed are skipped). */
export function listBundles(root: string): BundleEntry[] {
  if (!fs.existsSync(root)) return [];
  const entries: BundleEntry[] = [];
  for (const name of fs.readdirSync(root)) {
    if (!name.endsWith(BUNDLE_SUFFIX)) continue;
    const dir = path.join(root, name);
    if (!fs.statSync(dir).isDirectory()) continue;
    try {
      entries.push({ id: name.slice(0, -BUNDLE_SUFFIX.length), dir, bundle: readBundle(dir) });
    } catch {
      // skip malformed bundles — the gallery only shows valid ones
    }
  }
  return entries.sort((a, b) => a.id.localeCompare(b.id));
}
