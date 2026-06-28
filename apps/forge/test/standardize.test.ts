import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Asset } from "@sequences/core";
import { ForgeDocument } from "../src/document.ts";
import { aspectOf, extractMediaSlots, placeholderSvg } from "../src/standardize.ts";

function tmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "forge-std-"));
}

/** Build a mock asset with a valid content-addressed id (`asset-<hash[0:16]>`). */
function mockAsset(hashChar: string, relPath: string, w: number, h: number, kind: Asset["kind"] = "image"): Asset {
  const contentHash = hashChar.repeat(64);
  return {
    id: `asset-${contentHash.slice(0, 16)}`,
    path: relPath,
    kind,
    contentHash,
    metadata: { width: w, height: h, dominantColors: [] },
  };
}

describe("media standardization", () => {
  it("reduces pixel dims to a tidy aspect, with a safe fallback", () => {
    expect(aspectOf(1920, 1080)).toBe("16:9");
    expect(aspectOf(1600, 900)).toBe("16:9");
    expect(aspectOf(1000, 1000)).toBe("1:1");
    expect(aspectOf(undefined, undefined)).toBe("16:9");
    expect(aspectOf(0, 0)).toBe("16:9");
  });

  it("renders a deterministic, generic graphite placeholder", () => {
    const a = placeholderSvg("16:9", "image");
    const b = placeholderSvg("16:9", "image");
    expect(a).toBe(b); // deterministic → golden-fixture safe
    expect(a.startsWith("<svg")).toBe(true);
    expect(a).toContain("16:9 · image");
    // license-clean: no embedded bytes, no external image refs.
    expect(a).not.toContain("data:");
    expect(a).not.toContain("xlink:href");
    expect(a).not.toContain("<image");
    expect(placeholderSvg("1:1", "video")).toContain("1:1 · video");
  });

  it("extracts a Media Slot per staged example image (not reference media)", () => {
    const doc = ForgeDocument.createBlank(tmp());
    const asset = mockAsset("a", "assets/shot.png", 1600, 900);
    doc.addAsset(asset);
    const added = doc.addObject({ kind: "image", assetId: asset.id });
    expect(added.ok).toBe(true);

    const { slots, placeholders } = extractMediaSlots(doc);
    expect(slots.length).toBe(1);
    expect(slots[0]!.mediaKind).toBe("image");
    expect(slots[0]!.aspect).toBe("16:9");
    expect(slots[0]!.placeholder).toBe(`media/${slots[0]!.name}.svg`);
    expect(placeholders.length).toBe(1);
    expect(placeholders[0]!.svg).toContain("<svg");
  });

  it("classifies .svg media as an svg slot", () => {
    const doc = ForgeDocument.createBlank(tmp());
    const asset = mockAsset("c", "assets/logo.svg", 512, 512);
    doc.addAsset(asset);
    doc.addObject({ kind: "image", assetId: asset.id });
    const { slots } = extractMediaSlots(doc);
    expect(slots[0]!.mediaKind).toBe("svg");
    expect(slots[0]!.aspect).toBe("1:1");
  });

  it("excludes reference media from slot extraction", () => {
    const doc = ForgeDocument.createBlank(tmp());
    const asset = mockAsset("d", "assets/ref.png", 1920, 1080);
    doc.addAsset(asset);
    doc.addObject({ kind: "image", assetId: asset.id });
    doc.markReference(asset.id, true);
    expect(extractMediaSlots(doc).slots.length).toBe(0);
  });
});
