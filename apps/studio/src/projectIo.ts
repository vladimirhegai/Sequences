/**
 * Project directory IO — the host-side persistence the core deliberately
 * doesn't do. A project is a plain directory (no database, plan §7):
 *
 *   project.json   — the scene graph (always current; saved on every command)
 *   events.log     — append-only JSONL command journal (audit/time-travel)
 *   assets/        — user media, referenced by Asset.path
 *   build/         — compile artifacts (HTML + vendor scripts + manifest)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  compile,
  validateProject,
  type CompileResult,
  type EventEntry,
  type Project,
} from "@sequences/core";

export function loadProject(dir: string): Project {
  const file = path.join(dir, "project.json");
  if (!fs.existsSync(file)) {
    throw new Error(`no project.json in ${dir} — run "sequences init ${dir}" first`);
  }
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  const result = validateProject(raw);
  if (!result.ok || !result.project) {
    const issues = result.issues.map((i) => `  ${i.path}: ${i.message}`).join("\n");
    throw new Error(`project.json is invalid:\n${issues}`);
  }
  return result.project;
}

export function saveProject(dir: string, project: Project): void {
  fs.writeFileSync(path.join(dir, "project.json"), JSON.stringify(project, null, 2) + "\n");
}

export function appendEvent(dir: string, entry: EventEntry): void {
  fs.appendFileSync(path.join(dir, "events.log"), JSON.stringify(entry) + "\n");
}

/** Resolve a vendored runtime file shipped inside an npm package. */
function resolveVendor(specifier: string, relative: string): string {
  const resolved = fileURLToPath(import.meta.resolve(specifier));
  let root = path.dirname(resolved);
  while (!fs.existsSync(path.join(root, "package.json"))) {
    const parent = path.dirname(root);
    if (parent === root) throw new Error(`cannot find package root for ${specifier}`);
    root = parent;
  }
  const file = path.join(root, relative);
  if (!fs.existsSync(file)) throw new Error(`vendor file missing: ${file}`);
  return file;
}

export function vendorFiles(): Record<string, string> {
  return {
    "gsap.min.js": resolveVendor("gsap", "dist/gsap.min.js"),
    "CustomEase.min.js": resolveVendor("gsap", "dist/CustomEase.min.js"),
    "hyperframe.runtime.iife.js": fileURLToPath(
      import.meta.resolve("@hyperframes/core/runtime"),
    ),
    "hyperframes-player.global.js": resolveVendor(
      "@hyperframes/player",
      "dist/hyperframes-player.global.js",
    ),
  };
}

/** Compile the project and write build/ next to it. Returns the result. */
export function buildProject(dir: string, project: Project): CompileResult {
  const result = compile(project);
  const buildDir = path.join(dir, "build");
  fs.mkdirSync(path.join(buildDir, "assets"), { recursive: true });
  fs.writeFileSync(path.join(buildDir, "index.html"), result.html);
  fs.writeFileSync(
    path.join(buildDir, "manifest.json"),
    JSON.stringify(result.manifest, null, 2) + "\n",
  );
  const vendors = vendorFiles();
  for (const name of result.vendorScripts) {
    const source = vendors[name];
    if (source) fs.copyFileSync(source, path.join(buildDir, name));
  }
  for (const asset of result.assets) {
    const source = path.join(dir, asset.sourcePath);
    if (fs.existsSync(source)) {
      fs.copyFileSync(source, path.join(buildDir, asset.href));
    }
  }
  return result;
}
