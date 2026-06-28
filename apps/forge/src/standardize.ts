/**
 * Media standardization & slot extraction (FORGE.md §8).
 *
 * An extension is a *motion template*, not a recording — it must never ship a
 * specific customer's (or reference's) media. So on export, every piece of
 * *example* media the motion acts on is replaced by a typed **Media Slot**: a
 * contract (kind + aspect + a neutral graphite placeholder) instead of bundled
 * bytes. Real example bytes stay in the Document (for the gallery render); the
 * `.seqext` carries only the *shape* of media the motion needs, so the bundle is
 * portable, light, and copyright-clean. Sequences later binds the user's real
 * media into the slot.
 *
 * Pure & deterministic: same document in → byte-identical slots + placeholders
 * out, so it can be a golden fixture (FORGE.md §9).
 */
import { MediaSlotSchema } from "@sequences/core";
import type { z } from "zod";
import type { ForgeDocument } from "./document.ts";

export type MediaSlot = z.infer<typeof MediaSlotSchema>;

export interface ExtractedMedia {
  slots: MediaSlot[];
  /** Placeholder files to write under the bundle's `media/` dir. */
  placeholders: Array<{ file: string; svg: string }>;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/** Reduce pixel dims to a tidy "W:H" aspect label; falls back to "16:9". */
export function aspectOf(width?: number, height?: number): string {
  if (!width || !height || width <= 0 || height <= 0) return "16:9";
  const g = gcd(width, height) || 1;
  return `${Math.round(width / g)}:${Math.round(height / g)}`;
}

function aspectRatio(aspect: string): number {
  const [w, h] = aspect.split(":").map((n) => Number(n));
  if (!w || !h) return 16 / 9;
  return w / h;
}

/**
 * A neutral graphite placeholder mock at a canonical density — clean, generic,
 * license-clean (Design DNA: monochrome graphite, one silver hairline). Renders
 * something sensible before the user supplies real media, and keeps every
 * gallery preview looking like a product mock, not a leaked dashboard.
 */
export function placeholderSvg(aspect: string, kind: MediaSlot["mediaKind"]): string {
  const ratio = aspectRatio(aspect);
  const h = 360;
  const w = Math.round(h * ratio);
  const glyph =
    kind === "video"
      ? `<path d="M ${w / 2 - 18} ${h / 2 - 26} L ${w / 2 + 30} ${h / 2} L ${w / 2 - 18} ${h / 2 + 26} Z" fill="#c9cfd9" opacity="0.85"/>`
      : `<rect x="${w / 2 - 34}" y="${h / 2 - 26}" width="68" height="52" rx="6" fill="none" stroke="#c9cfd9" stroke-width="2.5" opacity="0.85"/><circle cx="${w / 2 - 12}" cy="${h / 2 - 6}" r="7" fill="#c9cfd9" opacity="0.85"/><path d="M ${w / 2 - 30} ${h / 2 + 20} L ${w / 2 - 6} ${h / 2 - 2} L ${w / 2 + 14} ${h / 2 + 12} L ${w / 2 + 30} ${h / 2 - 4}" fill="none" stroke="#c9cfd9" stroke-width="2.5" opacity="0.85"/>`;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${kind} placeholder ${aspect}">`,
    `<rect width="${w}" height="${h}" fill="#131518"/>`,
    `<rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" fill="none" stroke="#282c32" stroke-width="1"/>`,
    `<rect x="16.5" y="16.5" width="${w - 33}" height="${h - 33}" rx="10" fill="#191c20" stroke="#373c44" stroke-width="1"/>`,
    glyph,
    `<text x="${w / 2}" y="${h - 30}" fill="#70757e" font-family="ui-monospace, monospace" font-size="16" text-anchor="middle">${aspect} · ${kind}</text>`,
    `</svg>`,
  ].join("");
}

function slotMediaKind(assetKind: string, assetPath: string): MediaSlot["mediaKind"] {
  if (assetKind === "video") return "video";
  if (/\.svg$/i.test(assetPath)) return "svg";
  return "image";
}

/**
 * Walk the document's staged custom layers; every one bound to *example* media
 * becomes a Media Slot + a placeholder. Reference media and unbound assets are
 * ignored. Slot name = the staging layer id (stable, unique within the scene).
 */
export function extractMediaSlots(doc: ForgeDocument): ExtractedMedia {
  const slots: MediaSlot[] = [];
  const placeholders: Array<{ file: string; svg: string }> = [];
  const assetsById = new Map(doc.project.assets.map((a) => [a.id, a]));

  for (const layer of doc.scene.customLayers ?? []) {
    if (layer.kind !== "image" && layer.kind !== "video") continue;
    const assetId = layer.content.assetId;
    if (!assetId) continue;
    if (doc.referenceAssetIds.has(assetId)) continue;
    const asset = assetsById.get(assetId);
    if (!asset) continue;

    const aspect = aspectOf(asset.metadata.width, asset.metadata.height);
    const mediaKind = slotMediaKind(asset.kind, asset.path);
    const file = `media/${layer.id}.svg`;
    slots.push({ name: layer.id, mediaKind, aspect, placeholder: file });
    placeholders.push({ file, svg: placeholderSvg(aspect, mediaKind) });
  }

  // Validate each slot against the canonical schema before it can ship.
  for (const slot of slots) MediaSlotSchema.parse(slot);
  return { slots, placeholders };
}
