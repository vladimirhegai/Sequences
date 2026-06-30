import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ForgeDocument } from "../src/document.ts";

function tmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "forge-doc-"));
}

describe("Forge Document — staging through real commands", () => {
  it("creates a near-blank stage that compiles through the real engine", () => {
    const doc = ForgeDocument.createBlank(tmp());
    const outline = doc.outline();
    expect(outline.compositionId).toBeTruthy();
    expect(outline.width).toBe(1280);
    expect(outline.height).toBe(720);
    // hook-opener gives a headline + decor backdrop.
    expect(outline.layers.length).toBeGreaterThan(0);
    expect(outline.layers.some((l) => l.id === "headline")).toBe(true);
  });

  it("adds a staged text object as an undoable custom layer", () => {
    const doc = ForgeDocument.createBlank(tmp());
    const before = doc.outline().layers.length;
    const result = doc.addObject({ kind: "text", text: "Hello" });
    expect(result.ok).toBe(true);
    const after = doc.outline();
    expect(after.layers.length).toBe(before + 1);
    const added = after.layers.find((l) => l.custom);
    expect(added).toBeDefined();
    expect(added!.kind).toBe("text");

    expect(after.canUndo).toBe(true);
    expect(doc.undo()).toBe(true);
    expect(doc.outline().layers.length).toBe(before);
    expect(doc.redo()).toBe(true);
    expect(doc.outline().layers.length).toBe(before + 1);
  });

  it("moves a staged object via the MoveLayer command (drag = typed command)", () => {
    const doc = ForgeDocument.createBlank(tmp());
    const { id } = doc.addObject({ kind: "text", text: "Drag me" }) as { ok: true; id: string };
    const outcome = doc.apply({ type: "MoveLayer", sceneId: doc.sceneId, layerId: id, x: 120, y: 64 });
    expect(outcome.ok).toBe(true);
    const layer = doc.outline().layers.find((l) => l.id === id);
    expect(layer).toBeDefined();
    expect(layer!.box.x).toBe(120);
    expect(layer!.box.y).toBe(64);
    // width/height preserved by the box-merge.
    expect(layer!.box.w).toBe(400);
  });

  it("resizes via ResizeLayer and restyles via SetText", () => {
    const doc = ForgeDocument.createBlank(tmp());
    const { id } = doc.addObject({ kind: "text", text: "x" }) as { ok: true; id: string };
    expect(doc.apply({ type: "ResizeLayer", sceneId: doc.sceneId, layerId: id, w: 520, h: 200 }).ok).toBe(
      true,
    );
    expect(doc.apply({ type: "SetText", sceneId: doc.sceneId, layerId: id, text: "renamed" }).ok).toBe(
      true,
    );
    const layer = doc.outline().layers.find((l) => l.id === id)!;
    expect(layer.box.w).toBe(520);
    expect(layer.box.h).toBe(200);
    expect(layer.label).toContain("renamed");
  });

  it("stages number and shape objects that compile", () => {
    const doc = ForgeDocument.createBlank(tmp());
    expect(doc.addObject({ kind: "number", number: { value: 42, suffix: "%" } }).ok).toBe(true);
    expect(doc.addObject({ kind: "shape", css: "#191c20" }).ok).toBe(true);
    const outline = doc.outline();
    expect(outline.layers.some((l) => l.kind === "number")).toBe(true);
    expect(outline.layers.some((l) => l.kind === "shape")).toBe(true);
    // distinct object ids
    const customIds = outline.layers.filter((l) => l.custom).map((l) => l.id);
    expect(new Set(customIds).size).toBe(customIds.length);
  });
});
