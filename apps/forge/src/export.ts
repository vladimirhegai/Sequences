/**
 * Document → `.seqext` export (FORGE.md §4, §8).
 *
 * The extension is extracted *from* the Document, it is not the Document. The
 * Document keeps the real media and exact staging (for the gallery render); the
 * `.seqext` keeps only the generalized **skeleton** (the motion DNA) plus the
 * **slot contracts** for the media the motion acts on — standardized to neutral
 * placeholders so the bundle ships no one's bytes.
 *
 * Freshly hand-authored GSAP can now enter through the lift pipeline: raw
 * sandbox constants are promoted to extension tokens, then this module combines
 * the lifted skeleton with standardized media slots. Reusing an installed
 * source extension is still supported as a quick "borrow this motion DNA" path.
 */
import fs from "node:fs";
import path from "node:path";
import { validateBundle, type SeqextBundle } from "@sequences/core";
import { extractMediaSlots } from "./standardize.ts";
import { writeBundle } from "./bundleIo.ts";
import type { ForgeDocument } from "./document.ts";
import type { LiftedMotion } from "./lift.ts";

/** A safe, token-pure default skeleton (mirrors the slideUpSoft reference). */
const DEFAULT_SKELETON: SeqextBundle["spec"]["skeleton"] = [
  {
    kind: "fromTo",
    target: "$inner",
    from: { y: "$distancePx", opacity: 0 },
    to: { y: 0, opacity: 1 },
    durationSec: "$durationSec",
    ease: "$ease",
    atSec: "$startSec",
  },
];

const DEFAULT_DEFAULTS: SeqextBundle["spec"]["defaults"] = {
  duration: "base",
  easing: "enter.glide",
  distance: "step",
};

export interface ExportOptions {
  /** Bundle id — must be `<primitiveKind>.<name>` (validated). */
  id: string;
  summary: string;
  version?: string;
  primitiveKind?: SeqextBundle["spec"]["primitiveKind"];
  tags?: SeqextBundle["manifest"]["tags"];
  library?: SeqextBundle["manifest"]["library"];
  guardrails?: string[];
  relationships?: SeqextBundle["spec"]["relationships"];
  /** Fresh motion DNA produced by lift (preferred over a borrowed source). */
  lift?: LiftedMotion;
  /** Reuse this installed extension's motion DNA as the skeleton (see scope). */
  source?: SeqextBundle;
}

/**
 * Assemble a `.seqext` bundle from a Document: the chosen motion skeleton + the
 * standardized media slots extracted from the staged example media. Pure (no
 * IO); validates the result against the canonical schema before returning.
 */
export function documentToBundle(doc: ForgeDocument, options: ExportOptions): SeqextBundle {
  const kind = options.primitiveKind ?? options.lift?.primitiveKind ?? options.source?.spec.primitiveKind ?? "enter";
  const { slots } = extractMediaSlots(doc);
  const lifted = options.lift;

  const bundle: SeqextBundle = {
    manifest: {
      id: options.id,
      type: "primitive",
      version: options.version ?? "0.1.0",
      summary: options.summary,
      tags: options.tags ?? options.source?.manifest.tags ?? { energy: "calm", style: "organic" },
      ...(options.library ? { library: options.library } : {}),
      source: "forge",
    },
    spec: {
      primitiveKind: kind,
      defaults: lifted?.defaults ?? options.source?.spec.defaults ?? DEFAULT_DEFAULTS,
      ...(lifted?.needsMask ?? options.source?.spec.needsMask ? { needsMask: true } : {}),
      tokens: lifted?.tokens ?? options.source?.spec.tokens ?? {},
      knobs: lifted?.knobs ?? options.source?.spec.knobs ?? [],
      slots,
      relationships:
        options.relationships ??
        options.source?.spec.relationships ?? { pairsWith: [], conflictsWith: [] },
      guardrails: options.guardrails ?? lifted?.warnings ?? options.source?.spec.guardrails ?? [],
      skeleton: lifted?.skeleton ?? options.source?.spec.skeleton ?? DEFAULT_SKELETON,
    },
  };

  const validation = validateBundle(bundle);
  if (!validation.ok) {
    throw new Error(`export produced an invalid bundle:\n  ${validation.errors.join("\n  ")}`);
  }
  return bundle;
}

export interface ExportResult {
  ok: boolean;
  dir?: string;
  slots?: number;
  errors?: string[];
}

/**
 * Write a Document out as a `.seqext` folder under `outDir`: manifest + spec via
 * `writeBundle`, plus the standardized media placeholders under `media/`. The
 * real example bytes are intentionally NOT copied — only the slot placeholders.
 */
export function exportDocument(doc: ForgeDocument, outDir: string, options: ExportOptions): ExportResult {
  let bundle: SeqextBundle;
  try {
    bundle = documentToBundle(doc, options);
  } catch (err) {
    return { ok: false, errors: [String((err as Error).message)] };
  }

  const bundleDir = path.join(path.resolve(outDir), `${bundle.manifest.id}.seqext`);
  writeBundle(bundleDir, bundle);

  const { placeholders } = extractMediaSlots(doc);
  if (placeholders.length > 0) {
    fs.mkdirSync(path.join(bundleDir, "media"), { recursive: true });
    for (const ph of placeholders) {
      fs.writeFileSync(path.join(bundleDir, ph.file), ph.svg);
    }
  }

  return { ok: true, dir: bundleDir, slots: bundle.spec.slots.length };
}
