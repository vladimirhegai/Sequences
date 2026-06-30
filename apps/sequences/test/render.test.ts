import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDefaultProject } from "@sequences/core";
import { resolveRenderOutputPath } from "../src/render.ts";

let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "seq-render-path-"));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("render output containment", () => {
  it("keeps custom outputs inside the project", () => {
    const project = createDefaultProject();
    expect(() =>
      resolveRenderOutputPath(tmp, project, { output: "../escape.mp4" }),
    ).toThrow(/inside the project/);
    expect(resolveRenderOutputPath(tmp, project, { output: "renders/demo.mp4" })).toBe(
      path.join(tmp, "renders", "demo.mp4"),
    );
  });

  it("rejects an output parent that escapes through a directory link", () => {
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), "seq-render-outside-"));
    const link = path.join(tmp, "linked");
    try {
      fs.symlinkSync(outside, link, process.platform === "win32" ? "junction" : "dir");
      expect(() =>
        resolveRenderOutputPath(tmp, createDefaultProject(), { output: "linked/demo.mp4" }),
      ).toThrow(/through a link/);
    } finally {
      fs.rmSync(link, { recursive: true, force: true });
      fs.rmSync(outside, { recursive: true, force: true });
    }
  });
});
