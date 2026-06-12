import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDefaultProject, createShowcaseProject } from "@sequences/core";
import { saveProject } from "./projectIo.ts";

const STUDIO_SRC_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(STUDIO_SRC_DIR, "../../..");
const TEMPLATES_DIR = path.join(STUDIO_SRC_DIR, "templates");

export function demoProjectDir(): string {
  return path.join(REPO_ROOT, "examples", "demo-promo");
}

export function resolveProjectPath(input: string, baseDir = process.cwd()): string {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("project path is empty");
  const withHome =
    trimmed === "~" || trimmed.startsWith(`~${path.sep}`) || trimmed.startsWith("~/")
      ? path.join(os.homedir(), trimmed.slice(1))
      : trimmed;
  return path.resolve(baseDir, withHome);
}

export function initializeProject(
  dir: string,
  options?: { name?: string; showcase?: boolean },
): void {
  if (fs.existsSync(path.join(dir, "project.json"))) {
    throw new Error(`refusing to overwrite existing project in ${dir}`);
  }

  fs.mkdirSync(path.join(dir, "assets"), { recursive: true });
  fs.copyFileSync(
    path.join(TEMPLATES_DIR, "dashboard.svg"),
    path.join(dir, "assets", "dashboard.svg"),
  );

  const name = options?.name ?? path.basename(path.resolve(dir));
  const factory = options?.showcase ? createShowcaseProject : createDefaultProject;
  const project = factory({
    title: name,
    brandName: name,
    screenshotAssetId: "dashboard",
  });
  project.assets.push({ id: "dashboard", path: "assets/dashboard.svg", kind: "image" });

  saveProject(dir, project);
  fs.writeFileSync(path.join(dir, "events.log"), "");
}
