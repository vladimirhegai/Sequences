import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  compile,
  extensionPreviewProject,
  installBundle,
  uninstallBundlePrimitive,
  PRIMITIVES,
} from "@sequences/core";
import { listBundles, readBundle, writeBundle } from "../src/bundleIo.ts";

const EXT_ROOT = path.resolve(import.meta.dirname, "..", "..", "..", "examples", "forge", "extensions");

describe("Forge bundle IO", () => {
  it("lists the shipped example bundles", () => {
    const ids = listBundles(EXT_ROOT).map((b) => b.id);
    expect(ids).toContain("enter.countUp");
    expect(ids).toContain("enter.charCascade");
    expect(ids).toContain("enter.slideUpSoft");
  });

  it("round-trips a bundle through write → read", () => {
    const original = readBundle(path.join(EXT_ROOT, "enter.slideUpSoft.seqext"));
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forge-"));
    try {
      const dir = path.join(tmp, "enter.slideUpSoft.seqext");
      writeBundle(dir, original);
      expect(fs.existsSync(path.join(dir, "manifest.json"))).toBe(true);
      expect(fs.existsSync(path.join(dir, "spec.json"))).toBe(true);
      expect(readBundle(dir)).toEqual(original);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("installs a read bundle and previews it through the real compiler", () => {
    const cloned = readBundle(path.join(EXT_ROOT, "enter.slideUpSoft.seqext"));
    cloned.manifest.id = "enter.forgeIoProbe";
    try {
      installBundle(cloned);
      expect(PRIMITIVES["enter.forgeIoProbe"]).toBeDefined();
      const html = compile(extensionPreviewProject("primitive", "enter.forgeIoProbe")).html;
      expect(html).toContain("data-composition-id");
    } finally {
      uninstallBundlePrimitive("enter.forgeIoProbe");
    }
    expect(PRIMITIVES["enter.forgeIoProbe"]).toBeUndefined();
  });
});
