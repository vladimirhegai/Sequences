import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDefaultProject, ProjectStore, type EventEntry } from "@sequences/core";
import {
  appendEvent,
  buildProject,
  loadProject,
  readEventSequence,
  saveProject,
  withProjectWriteLock,
} from "../src/projectIo.ts";
import { appProfileDir } from "../src/desktopApp.ts";
import { contentAssetId, extractAssetMetadata, sha256File } from "../src/assetMetadata.ts";

function diskAsset(file: string, relPath: string, kind: "image" | "video" | "audio" = "image") {
  const contentHash = sha256File(file);
  return {
    id: contentAssetId(contentHash),
    path: relPath,
    kind,
    contentHash,
    metadata: extractAssetMetadata(file, kind),
  };
}

let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "seq-io-"));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("project host integrity", () => {
  it("buildProject supports an isolated build directory without touching live build/", () => {
    const projectDir = path.join(tmp, "project");
    const isolated = path.join(tmp, "job", "build");
    fs.mkdirSync(path.join(projectDir, "assets"), { recursive: true });
    fs.writeFileSync(path.join(projectDir, "assets", "shot.svg"), "<svg/>");
    const project = createDefaultProject();
    project.assets.push(
      diskAsset(path.join(projectDir, "assets", "shot.svg"), "assets/shot.svg"),
    );
    buildProject(projectDir, project, { buildDir: isolated });
    expect(fs.existsSync(path.join(isolated, "index.html"))).toBe(true);
    expect(fs.existsSync(path.join(isolated, "assets", "shot.svg"))).toBe(true);
    expect(fs.existsSync(path.join(projectDir, "build"))).toBe(false);
  });

  it("refuses unsafe asset paths before copying files", () => {
    const projectDir = path.join(tmp, "project");
    fs.mkdirSync(projectDir, { recursive: true });
    const project = createDefaultProject();
    project.assets.push({
      id: "asset-0000000000000000",
      path: "../../outside.png",
      kind: "image",
      contentHash: "0".repeat(64),
      metadata: { dominantColors: [] },
    });
    expect(() => buildProject(projectDir, project)).toThrow(/unsafe asset path|escapes/);
  });

  it("fails compilation when a registered asset file is missing", () => {
    const projectDir = path.join(tmp, "project");
    fs.mkdirSync(projectDir, { recursive: true });
    const project = createDefaultProject();
    project.assets.push({
      id: "asset-1111111111111111",
      path: "assets/missing.png",
      kind: "image",
      contentHash: "1".repeat(64),
      metadata: { dominantColors: [] },
    });
    expect(() => buildProject(projectDir, project)).toThrow(/asset file missing/);
  });

  it("lets Studio-style preview builds degrade around a deleted asset", () => {
    const projectDir = path.join(tmp, "project");
    fs.mkdirSync(projectDir, { recursive: true });
    const project = createDefaultProject();
    project.assets.push({
      id: "asset-1111111111111111",
      path: "assets/missing.png",
      kind: "image",
      contentHash: "1".repeat(64),
      metadata: { dominantColors: [] },
    });
    const result = buildProject(projectDir, project, { allowMissingAssets: true });
    expect(result.missingAssetPaths).toEqual(["assets/missing.png"]);
    expect(fs.existsSync(path.join(projectDir, "build", "index.html"))).toBe(true);
  });

  it("replays a write-ahead event after a crash before snapshot replacement", () => {
    const projectDir = path.join(tmp, "project");
    fs.mkdirSync(projectDir, { recursive: true });
    const initial = createDefaultProject();
    saveProject(projectDir, initial);
    const events: EventEntry[] = [];
    const store = new ProjectStore(initial, (entry) => events.push(entry));
    expect(
      store.apply({ type: "SetSceneDuration", sceneId: "hook", durationFrames: 123 }).ok,
    ).toBe(true);
    appendEvent(projectDir, events[0]!);

    const recovered = loadProject(projectDir);
    expect(recovered.scenes[0]!.durationFrames).toBe(123);
    expect(JSON.parse(fs.readFileSync(path.join(projectDir, "project.json"), "utf8")))
      .toEqual(recovered);
  });

  it("reads the highest durable event sequence and ignores malformed lines", () => {
    fs.writeFileSync(
      path.join(tmp, "events.log"),
      '{"seq":2}\nnot-json\n{"seq":9}\n{"seq":4}\n',
    );
    expect(readEventSequence(tmp)).toBe(9);
  });

  it("serializes concurrent project writers and cleans up its lock", async () => {
    let active = 0;
    let maximum = 0;
    const writer = () =>
      withProjectWriteLock(tmp, async () => {
        active += 1;
        maximum = Math.max(maximum, active);
        await new Promise((resolve) => setTimeout(resolve, 30));
        active -= 1;
      });

    await Promise.all([writer(), writer(), writer()]);
    expect(maximum).toBe(1);
    expect(fs.existsSync(path.join(tmp, ".sequences-write.lock"))).toBe(false);
  });

  it("recovers a project lock left by a dead writer", async () => {
    fs.writeFileSync(
      path.join(tmp, ".sequences-write.lock"),
      JSON.stringify({ pid: 2_147_483_647, id: "dead" }),
    );
    await expect(withProjectWriteLock(tmp, () => "recovered")).resolves.toBe("recovered");
    expect(fs.existsSync(path.join(tmp, ".sequences-write.lock"))).toBe(false);
  });

  it("keeps app browser profiles outside the project directory", () => {
    const projectDir = path.join(tmp, "project");
    const profile = appProfileDir(projectDir);
    expect(profile.startsWith(path.resolve(projectDir) + path.sep)).toBe(false);
    expect(profile).toContain(path.join(".sequences", "browser-profiles"));
    expect(appProfileDir(projectDir)).toBe(profile);
  });
});
