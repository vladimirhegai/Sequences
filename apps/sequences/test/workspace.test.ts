import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createLibraryFolder,
  listLibrary,
  mediaKind,
  placeAsset,
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
    expect(a.id).toMatch(/^asset-[0-9a-f]{16}$/);
    expect(a.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(fs.existsSync(path.join(tmp, "assets", "bin one", "Shot.png"))).toBe(true);

    // same file name again → file gets -2 suffix, id keeps deduping
    ids.add(a.id);
    const b = placeAsset(tmp, "Shot.png", "bin one", ids, (dest) => fs.writeFileSync(dest, "y"));
    expect(b.relPath).toBe("assets/bin one/Shot-2.png");
    expect(b.id).not.toBe(a.id);
  });

  it("placeAsset refuses escapes and non-media", () => {
    expect(() => placeAsset(tmp, "x.png", "../outside", new Set(), () => {})).toThrow(
      /invalid asset folder|escapes/,
    );
    expect(() => placeAsset(tmp, "x.png", "safe/../outside", new Set(), () => {})).toThrow(
      /invalid asset folder/,
    );
    expect(() => placeAsset(tmp, "x.txt", "", new Set(), () => {})).toThrow(/unsupported/);
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

  it("createLibraryFolder rejects parent-directory traversal", () => {
    process.env.SEQUENCES_LIBRARY_DIR = tmp;
    try {
      expect(() => createLibraryFolder("", "..")).toThrow(/invalid folder name/);
      expect(() => createLibraryFolder("", ".")).toThrow(/invalid folder name/);
      const created = createLibraryFolder("", "Client work");
      expect(created).toBe(path.join(tmp, "Client work"));
    } finally {
      delete process.env.SEQUENCES_LIBRARY_DIR;
    }
  });
});
