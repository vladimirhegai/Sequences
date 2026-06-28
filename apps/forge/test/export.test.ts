import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  compile,
  extensionPreviewProject,
  installBundle,
  uninstallBundlePrimitive,
  validateBundle,
  type Asset,
} from "@sequences/core";
import { ForgeDocument } from "../src/document.ts";
import { documentToBundle, exportDocument } from "../src/export.ts";
import { readBundle } from "../src/bundleIo.ts";
import { liftGsapSource } from "../src/lift.ts";

const EXT_ROOT = path.resolve(import.meta.dirname, "..", "..", "..", "examples", "forge", "extensions");

function tmp(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function mockAsset(hashChar: string, relPath: string, w: number, h: number): Asset {
  const contentHash = hashChar.repeat(64);
  return {
    id: `asset-${contentHash.slice(0, 16)}`,
    path: relPath,
    kind: "image",
    contentHash,
    metadata: { width: w, height: h, dominantColors: [] },
  };
}

const SUMMARY = "A confident upward reveal for staged product imagery.";

describe("document → .seqext export", () => {
  it("assembles a valid bundle with the default skeleton when no source is given", () => {
    const doc = ForgeDocument.createBlank(tmp("forge-exp-"));
    const bundle = documentToBundle(doc, { id: "enter.myReveal", summary: SUMMARY });
    expect(validateBundle(bundle).ok).toBe(true);
    expect(bundle.spec.skeleton.length).toBeGreaterThan(0);
    expect(bundle.manifest.source).toBe("forge");
  });

  it("rejects an id that doesn't match its primitiveKind", () => {
    const doc = ForgeDocument.createBlank(tmp("forge-exp-"));
    expect(() => documentToBundle(doc, { id: "wrong.prefix", summary: SUMMARY, primitiveKind: "enter" })).toThrow();
  });

  it("reuses a source extension's skeleton as the motion DNA", () => {
    const source = readBundle(path.join(EXT_ROOT, "enter.slideUpSoft.seqext"));
    const doc = ForgeDocument.createBlank(tmp("forge-exp-"));
    const bundle = documentToBundle(doc, { id: "enter.fromSource", summary: SUMMARY, source });
    expect(bundle.spec.skeleton).toEqual(source.spec.skeleton);
    expect(bundle.spec.defaults).toEqual(source.spec.defaults);
  });

  it("uses lifted authored GSAP as the exported motion DNA", () => {
    const doc = ForgeDocument.createBlank(tmp("forge-exp-"));
    const lift = liftGsapSource(
      'tl.fromTo(inner,{scale:0.82,opacity:0},{scale:1,opacity:1,duration:0.42,ease:"back.out(1.5)"},0);',
      { id: "enter.liftedExport", summary: SUMMARY },
    );
    const bundle = documentToBundle(doc, { id: "enter.liftedExport", summary: SUMMARY, lift });
    expect(validateBundle(bundle).ok).toBe(true);
    expect(bundle.spec.skeleton).toEqual(lift.skeleton);
    expect(bundle.spec.tokens.scaleFromScale).toBe(0.82);
    expect(bundle.spec.defaults.easing).toBe("enter.settle");
  });

  it("turns staged example media into standardized slots + placeholders on disk", () => {
    const doc = ForgeDocument.createBlank(tmp("forge-doc-"));
    const asset = mockAsset("b", "assets/hero.png", 1920, 1080);
    doc.addAsset(asset);
    doc.addObject({ kind: "image", assetId: asset.id });

    const out = tmp("forge-out-");
    const result = exportDocument(doc, out, { id: "enter.heroReveal", summary: SUMMARY });
    expect(result.ok).toBe(true);
    expect(result.slots).toBe(1);

    const bundleDir = result.dir!;
    expect(fs.existsSync(path.join(bundleDir, "manifest.json"))).toBe(true);
    expect(fs.existsSync(path.join(bundleDir, "spec.json"))).toBe(true);

    const written = readBundle(bundleDir);
    expect(validateBundle(written).ok).toBe(true);
    expect(written.spec.slots.length).toBe(1);
    const placeholder = written.spec.slots[0]!.placeholder!;
    expect(fs.existsSync(path.join(bundleDir, placeholder))).toBe(true);
    // The real example bytes are NOT shipped — only the placeholder.
    expect(fs.existsSync(path.join(bundleDir, "assets"))).toBe(false);
  });

  it("the exported bundle installs and previews through the unchanged engine", () => {
    const doc = ForgeDocument.createBlank(tmp("forge-doc-"));
    const out = tmp("forge-out-");
    const result = exportDocument(doc, out, { id: "enter.roundtrip", summary: SUMMARY });
    expect(result.ok).toBe(true);
    try {
      const written = readBundle(result.dir!);
      installBundle(written);
      const html = compile(extensionPreviewProject("primitive", "enter.roundtrip")).html;
      expect(html).toContain("data-composition-id");
    } finally {
      uninstallBundlePrimitive("enter.roundtrip");
    }
  });
});
