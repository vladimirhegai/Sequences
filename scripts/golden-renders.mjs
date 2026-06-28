import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { loadProject } from "../apps/sequences/src/projectIo.ts";
import { generateSceneThumbnails } from "../apps/sequences/src/thumbs.ts";

// Keep the deterministic baseline free of video/audio decoder timing. Those
// paths have their own compiler tests; this gate compares static rendered pixels.
const dir = path.resolve(process.argv[2] ?? "fixtures/sequences/starter");
const project = loadProject(dir);
const hash = (file) => createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const first = await generateSceneThumbnails(dir, project);
const firstHashes = Object.fromEntries(
  Object.entries(first.files).map(([id, rel]) => [id, hash(path.join(dir, "build", rel))]),
);
const second = await generateSceneThumbnails(dir, project);
for (const [id, rel] of Object.entries(second.files)) {
  const next = hash(path.join(dir, "build", rel));
  if (firstHashes[id] !== next) throw new Error(`non-deterministic golden render: ${id}`);
}
console.log(`golden render determinism: ${Object.keys(firstHashes).length} scenes matched exactly`);
