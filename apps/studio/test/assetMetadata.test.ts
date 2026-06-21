import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  contentAssetId,
  extractAssetMetadata,
  sha256File,
} from "../src/assetMetadata.ts";

let dir: string | undefined;

afterEach(() => {
  if (dir) fs.rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});

describe("asset metadata extraction", () => {
  it("extracts SVG dimensions, dominant colors, OCR text, bytes, and cache hints", () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "seq-meta-"));
    const file = path.join(dir, "card.svg");
    fs.writeFileSync(
      file,
      '<svg width="640" height="360"><rect fill="#112233"/><text>Hello launch</text></svg>',
    );
    const hash = sha256File(file);
    const metadata = extractAssetMetadata(file, "image");
    expect(contentAssetId(hash)).toMatch(/^asset-[0-9a-f]{16}$/);
    expect(metadata).toMatchObject({
      width: 640,
      height: 360,
      dominantColors: ["#112233"],
      ocrText: "Hello launch",
    });
    expect(metadata.bytes).toBeGreaterThan(0);
    expect(metadata.cacheHint).toBeTruthy();
  });
});
