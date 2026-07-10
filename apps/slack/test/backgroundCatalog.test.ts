import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { BACKGROUND_CATALOG, backgroundById } from "../src/engine/backgroundCatalog.ts";

const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function jpegDimensions(file: string): { width: number; height: number } {
  const bytes = fs.readFileSync(file);
  expect(bytes[0]).toBe(0xff);
  expect(bytes[1]).toBe(0xd8);
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) { offset += 1; continue; }
    const marker = bytes[offset + 1]!;
    offset += 2;
    if (marker === 0xd8 || marker === 0xd9) continue;
    const length = bytes.readUInt16BE(offset);
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return { height: bytes.readUInt16BE(offset + 3), width: bytes.readUInt16BE(offset + 5) };
    }
    offset += length;
  }
  throw new Error(`JPEG dimensions not found: ${file}`);
}

describe("background moodboard catalog", () => {
  it("describes every vendored wallpaper exactly once", () => {
    expect(BACKGROUND_CATALOG).toHaveLength(18);
    expect(BACKGROUND_CATALOG.map((entry) => entry.id)).toEqual(
      Array.from({ length: 18 }, (_, index) => `wallpaper-${String(index + 1).padStart(2, "0")}`),
    );
    expect(new Set(BACKGROUND_CATALOG.map((entry) => entry.file)).size).toBe(18);
  });

  it("matches the real JPEG dimensions and carries usable crop metadata", () => {
    for (const entry of BACKGROUND_CATALOG) {
      const file = path.resolve(APP_ROOT, entry.file);
      expect(fs.existsSync(file), entry.id).toBe(true);
      expect(jpegDimensions(file), entry.id).toEqual(entry.dimensions);
      expect(entry.aspect.ratio, entry.id).toBeCloseTo(entry.dimensions.width / entry.dimensions.height, 4);
      expect(entry.focalPoint.x, entry.id).toBeGreaterThanOrEqual(0);
      expect(entry.focalPoint.x, entry.id).toBeLessThanOrEqual(1);
      expect(entry.focalPoint.y, entry.id).toBeGreaterThanOrEqual(0);
      expect(entry.focalPoint.y, entry.id).toBeLessThanOrEqual(1);
      expect(entry.crop.fit, entry.id).toBe("cover");
      expect(entry.crop.objectPosition, entry.id).toMatch(/^\d+% \d+%$/);
      expect(entry.overlay.opacity, entry.id).toBeGreaterThanOrEqual(0);
      expect(entry.overlay.opacity, entry.id).toBeLessThanOrEqual(0.6);
    }
  });

  it("is explicitly blocked from customer-project use without a license manifest", () => {
    for (const entry of BACKGROUND_CATALOG) {
      expect(entry.provenance).toMatchObject({
        status: "moodboard-only",
        licenseManifestPresent: false,
        customerProjectUse: "blocked",
      });
      expect(backgroundById(entry.id)).toBe(entry);
    }
  });
});
