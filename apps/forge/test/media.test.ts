import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ForgeDocument } from "../src/document.ts";
import { importMediaFromBytes, importMediaFromPath, isImportableMedia } from "../src/media.ts";

function tmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "forge-media-"));
}

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180"><rect width="320" height="180" fill="#191c20"/></svg>';

describe("Forge media import", () => {
  it("recognises importable media types", () => {
    expect(isImportableMedia("shot.png")).toBe(true);
    expect(isImportableMedia("clip.mp4")).toBe(true);
    expect(isImportableMedia("notes.txt")).toBe(false);
  });

  it("imports a file into the document and registers it via AddAsset", () => {
    const doc = ForgeDocument.createBlank(tmp());
    const src = path.join(tmp(), "diagram.svg");
    fs.writeFileSync(src, SVG);

    const result = importMediaFromPath(doc, src);
    expect(result.ok).toBe(true);
    expect(result.assetId).toBeTruthy();

    const outline = doc.outline();
    expect(outline.assets.some((a) => a.id === result.assetId)).toBe(true);
    // bytes actually landed under the doc's assets/
    const asset = doc.project.assets.find((a) => a.id === result.assetId)!;
    expect(fs.existsSync(path.join(doc.dir, asset.path))).toBe(true);
  });

  it("dedupes identical bytes by content hash", () => {
    const doc = ForgeDocument.createBlank(tmp());
    const src = path.join(tmp(), "logo.svg");
    fs.writeFileSync(src, SVG);
    const first = importMediaFromPath(doc, src);
    const second = importMediaFromPath(doc, src);
    expect(second.duplicate).toBe(true);
    expect(second.assetId).toBe(first.assetId);
    expect(doc.project.assets.length).toBe(1);
  });

  it("imports raw bytes and can mark them as reference media", () => {
    const doc = ForgeDocument.createBlank(tmp());
    const result = importMediaFromBytes(doc, "trace.svg", Buffer.from(SVG), { reference: true });
    expect(result.ok).toBe(true);
    expect(doc.referenceAssetIds.has(result.assetId!)).toBe(true);
  });
});
