import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  defaultStoryboard,
  listLibrary,
  loadStoryboard,
  mediaKind,
  placeAsset,
  saveStoryboard,
  storyboardToText,
  type Storyboard,
} from "../src/workspace.ts";

let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "seq-ws-"));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("workspace host services", () => {
  it("mediaKind classifies by extension and rejects non-media", () => {
    expect(mediaKind("shot.PNG")).toBe("image");
    expect(mediaKind("clip.mp4")).toBe("video");
    expect(mediaKind("track.wav")).toBe("audio");
    expect(mediaKind("doc.pdf")).toBeNull();
    expect(mediaKind("evil.exe")).toBeNull();
  });

  it("placeAsset copies into assets/[folder], dedupes names and ids", () => {
    const ids = new Set<string>(["shot"]);
    const a = placeAsset(tmp, "Shot.png", "bin one", ids, (dest) => fs.writeFileSync(dest, "x"));
    expect(a.relPath).toBe("assets/bin one/Shot.png");
    expect(a.kind).toBe("image");
    expect(a.id).toBe("shot-2"); // "shot" already taken
    expect(fs.existsSync(path.join(tmp, "assets", "bin one", "Shot.png"))).toBe(true);

    // same file name again → file gets -2 suffix, id keeps deduping
    ids.add(a.id);
    const b = placeAsset(tmp, "Shot.png", "bin one", ids, (dest) => fs.writeFileSync(dest, "y"));
    expect(b.relPath).toBe("assets/bin one/Shot-2.png");
    expect(b.id).not.toBe(a.id);
  });

  it("placeAsset refuses escapes and non-media", () => {
    expect(() => placeAsset(tmp, "x.png", "../outside", new Set(), () => {})).toThrow(/escapes/);
    expect(() => placeAsset(tmp, "x.txt", "", new Set(), () => {})).toThrow(/unsupported/);
  });

  it("storyboard roundtrips through disk and survives corruption", () => {
    const board: Storyboard = {
      version: 1,
      frames: [
        {
          id: "frame-1",
          name: "Opener",
          comment: "logo flies in",
          items: [
            { id: "i1", type: "rect", x: 10, y: 20, w: 30, h: 15, comment: "the dashboard card" },
            { id: "i2", type: "text", x: 12, y: 50, text: "Ship faster" },
            { id: "i3", type: "arrow", points: [10, 10, 60, 40] },
            { id: "i4", type: "draw", points: [1, 1, 2, 2, 3, 3] },
            { id: "i5", type: "media", assetId: "dashboard", x: 50, y: 10, w: 40, h: 40 },
          ],
        },
      ],
    };
    saveStoryboard(tmp, board);
    expect(loadStoryboard(tmp)).toEqual(board);

    fs.writeFileSync(path.join(tmp, "storyboard.json"), "{nope");
    expect(loadStoryboard(tmp)).toEqual(defaultStoryboard());
  });

  it("storyboardToText is deterministic, comment-forward, and empty for empty boards", () => {
    expect(storyboardToText(defaultStoryboard())).toBe("");
    const board = loadStoryboard(tmp); // default (empty) — then build a real one
    board.frames[0]!.name = "Opener"; // legacy/custom names are ignored; order owns frame names.
    board.frames[0]!.comment = "punchy start";
    board.frames[0]!.items = [
      { id: "i1", type: "rect", x: 10, y: 20, w: 30, h: 15, comment: "the dashboard card" },
      { id: "i5", type: "media", assetId: "dashboard", x: 50, y: 10, w: 40, h: 40 },
    ];
    board.frames.push({ id: "frame-2", name: "Empty beat", items: [] });
    const text = storyboardToText(board);
    expect(text).toContain("Frame 1 - note: punchy start");
    expect(text).not.toContain("Opener");
    expect(text).toContain("rect at (10%, 20%) size 30%x15% - intent: the dashboard card");
    expect(text).toContain('media asset "dashboard"');
    expect(text).not.toContain("Empty beat");
    expect(storyboardToText(board)).toBe(text); // deterministic
  });

  it("storyboardToText includes Excalidraw elements and AI comments", () => {
    const board: Storyboard = {
      version: 1,
      frames: [
        {
          id: "frame-1",
          name: "Sketch",
          items: [],
          excalidraw: {
            elements: [
              {
                id: "e1",
                type: "rectangle",
                x: 120,
                y: 80,
                width: 300,
                height: 180,
                customData: { sequenceAiComment: "main product card" },
              },
              {
                id: "e2",
                type: "image",
                x: 480,
                y: 110,
                width: 360,
                height: 220,
                customData: { sequenceAssetId: "dashboard-shot" },
              },
            ],
          },
        },
      ],
    };
    const text = storyboardToText(board);
    expect(text).toContain("rectangle at (120, 80) size 300x180 - intent: main product card");
    expect(text).toContain('media asset "dashboard-shot" at (480, 110) size 360x220');
    expect(text).toContain("1280x720 canvas");
  });

  it("storyboardToText reads motion-path arrows as movement of their target", () => {
    const board: Storyboard = {
      version: 1,
      frames: [
        {
          id: "frame-1",
          name: "Sketch",
          items: [],
          excalidraw: {
            elements: [
              { id: "e1", type: "rectangle", x: 100, y: 100, width: 200, height: 120 },
              {
                id: "p1",
                type: "arrow",
                x: 200,
                y: 160,
                width: 400,
                height: 100,
                points: [
                  [0, 0],
                  [220, -60],
                  [400, 100],
                ],
                customData: { sequenceMotionPathFor: "e1", sequenceAiComment: "ease in, settle softly" },
              },
            ],
          },
        },
      ],
    };
    const text = storyboardToText(board);
    expect(text).toContain(
      "MOTION PATH: the rectangle at (100, 100) moves from (200, 160) to (600, 260) via (420, 100) during this beat - intent: ease in, settle softly",
    );
    // the arrow itself is not double-reported as a drawn shape
    expect(text).not.toContain("arrow from (200, 160)");
  });

  it("storyboardToText ignores stale legacy items once a frame uses Excalidraw", () => {
    const board: Storyboard = {
      version: 1,
      frames: [
        {
          id: "frame-1",
          name: "Migrated empty frame",
          items: [{ id: "old-rect", type: "rect", x: 10, y: 20, w: 30, h: 40 }],
          excalidraw: { elements: [], appState: {}, files: {} },
        },
      ],
    };
    expect(storyboardToText(board)).toBe("");
  });

  it("listLibrary separates folders from projects (folders first)", () => {
    process.env.SEQUENCES_LIBRARY_DIR = tmp;
    try {
      fs.mkdirSync(path.join(tmp, "zfolder"));
      fs.mkdirSync(path.join(tmp, "aproject"));
      fs.writeFileSync(
        path.join(tmp, "aproject", "project.json"),
        JSON.stringify({ meta: { title: "A Project" } }),
      );
      const { entries } = listLibrary("");
      expect(entries.map((e) => `${e.kind}:${e.name}`)).toEqual(["folder:zfolder", "project:aproject"]);
      expect(entries[1]!.title).toBe("A Project");
      expect(() => listLibrary("../escape")).toThrow(/escapes/);
    } finally {
      delete process.env.SEQUENCES_LIBRARY_DIR;
    }
  });
});
