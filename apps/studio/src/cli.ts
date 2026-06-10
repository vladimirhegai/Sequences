#!/usr/bin/env node
/**
 * Sequences CLI:
 *   init | compile | lint | render | thumbs | plan | providers | mcp | studio
 *
 * Run with plain Node ≥ 22.18 (native type-stripping):
 *   node apps/studio/src/cli.ts studio examples/demo-promo
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyAutoFixes,
  createDefaultProject,
  createShowcaseProject,
  lintProject,
  ProjectStore,
  type Finding,
} from "@sequences/core";
import { appendEvent, buildProject, loadProject, saveProject } from "./projectIo.ts";
import { renderProject, type RenderFormat, type RenderQuality } from "./render.ts";
import { startStudio } from "./server.ts";
import { startMcpServer } from "./mcp.ts";
import { detectProviders, defaultProvider, type ProviderId } from "./agentConfig.ts";
import { runPlan } from "./agent/planRunner.ts";
import { extractRenderPoster, generateSceneThumbnails } from "./thumbs.ts";

const TEMPLATES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "templates");

function printFindings(findings: Finding[]): void {
  if (findings.length === 0) {
    console.log("lint: clean ✓");
    return;
  }
  for (const f of findings) {
    const where = [f.sceneId, f.layerId].filter(Boolean).join("/");
    console.log(
      `lint:${f.severity} [${f.rule}] ${where ? where + ": " : ""}${f.message}${f.fix ? "  (auto-fixable)" : ""}`,
    );
  }
}

function cmdInit(dir: string, name: string | undefined, showcase: boolean): void {
  if (fs.existsSync(path.join(dir, "project.json"))) {
    console.error(`refusing to overwrite existing project in ${dir}`);
    process.exit(1);
  }
  fs.mkdirSync(path.join(dir, "assets"), { recursive: true });
  fs.copyFileSync(
    path.join(TEMPLATES_DIR, "dashboard.svg"),
    path.join(dir, "assets", "dashboard.svg"),
  );
  const factory = showcase ? createShowcaseProject : createDefaultProject;
  const project = factory({
    title: name ?? path.basename(path.resolve(dir)),
    brandName: name ?? "Acme",
    screenshotAssetId: "dashboard",
  });
  project.assets.push({ id: "dashboard", path: "assets/dashboard.svg", kind: "image" });
  saveProject(dir, project);
  fs.writeFileSync(path.join(dir, "events.log"), "");
  console.log(`initialized project in ${dir}`);
  console.log(`next: node apps/studio/src/cli.ts studio ${dir}`);
}

function cmdCompile(dir: string): void {
  const project = loadProject(dir);
  const result = buildProject(dir, project);
  console.log(
    `compiled ${result.manifest.scenes.length} scenes, ${result.manifest.durationFrames}f ` +
      `(${result.manifest.durationSec}s) → ${path.join(dir, "build", "index.html")}`,
  );
  printFindings(lintProject(project));
}

function cmdLint(dir: string, fix: boolean): void {
  if (!fix) {
    printFindings(lintProject(loadProject(dir)));
    return;
  }
  const store = new ProjectStore(loadProject(dir), (entry) => appendEvent(dir, entry));
  const result = applyAutoFixes(store);
  if (result.applied.length > 0) {
    saveProject(dir, store.project);
    buildProject(dir, store.project);
  }
  console.log(`applied ${result.applied.length} auto-fixes`);
  printFindings(result.remaining);
}

function enumFlag<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T {
  if (value === undefined) return fallback;
  if ((allowed as readonly string[]).includes(value)) return value as T;
  throw new Error(`expected one of ${allowed.join(", ")}; got "${value}"`);
}

async function cmdRender(dir: string): Promise<void> {
  const project = loadProject(dir);
  printFindings(lintProject(project));
  const format = enumFlag<RenderFormat>(
    flag("format"),
    ["mp4", "webm", "mov", "png-sequence"],
    "mp4",
  );
  const quality = enumFlag<RenderQuality>(
    flag("quality"),
    ["draft", "standard", "high"],
    "standard",
  );
  const workersRaw = flag("workers");
  const workers = workersRaw === undefined ? undefined : Number(workersRaw);
  if (workers !== undefined && (!Number.isInteger(workers) || workers < 1)) {
    throw new Error(`--workers must be a positive integer; got "${workersRaw}"`);
  }

  const result = await renderProject(dir, project, {
    format,
    quality,
    output: flag("output") ?? flag("o"),
    workers,
    browserPath: flag("browser"),
  });
  console.log(
    `rendered ${result.manifest.durationFrames}f (${result.manifest.durationSec}s) ` +
      `as ${result.format}/${result.quality} -> ${result.outputPath}`,
  );
  if (format !== "png-sequence") {
    const poster = await extractRenderPoster(result.outputPath).catch(() => undefined);
    if (poster) console.log(`poster -> ${poster}`);
  }
}

async function cmdThumbs(dir: string): Promise<void> {
  const project = loadProject(dir);
  const result = await generateSceneThumbnails(dir, project);
  for (const [sceneId, rel] of Object.entries(result.files)) {
    console.log(`${sceneId} -> ${path.join(dir, "build", rel)}`);
  }
  console.log(`${Object.keys(result.files).length} thumbnails in ${result.elapsedMs}ms`);
}

async function cmdProviders(): Promise<void> {
  const infos = await detectProviders();
  const fallback = await defaultProvider();
  for (const info of infos) {
    const mark = info.available ? "✓" : "✗";
    const star = info.id === fallback ? " (default)" : "";
    console.log(`${mark} ${info.id} [${info.kind}]${star} — ${info.detail}`);
  }
  if (!fallback) {
    console.log(
      "\nno provider available. The no-API-key path: install the Codex CLI (npm i -g @openai/codex; codex login)" +
        "\nor Claude Code (https://claude.com/claude-code), sign in once, and `plan` will use it.",
    );
  }
}

async function cmdPlan(dir: string, brief: string | undefined): Promise<void> {
  if (!brief || !brief.trim()) {
    throw new Error('usage: cli.ts plan <projectDir> "<brief>" [--provider id]');
  }
  const providerId = (flag("provider") as ProviderId | undefined) ?? (await defaultProvider());
  if (!providerId) {
    throw new Error(
      "no agent provider available — run `cli.ts providers` for setup instructions (no API key needed)",
    );
  }
  const store = new ProjectStore(loadProject(dir), (entry) => appendEvent(dir, entry));
  console.log(`planning with ${providerId}…`);
  const result = await runPlan(providerId, brief, store);
  saveProject(dir, store.project);
  buildProject(dir, store.project);
  console.log(
    `plan applied: ${result.plan.scenes.length} scenes ` +
      `(${result.plan.scenes.map((s) => s.archetype).join(" → ")}), profile ${result.plan.motionProfile}`,
  );
  printFindings(lintProject(store.project));
  console.log(`next: node apps/studio/src/cli.ts studio ${dir}`);
}

const [, , command, dirArg, ...rest] = process.argv;
const dir = dirArg ?? ".";
const flag = (name: string): string | undefined => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : undefined;
};

try {
  switch (command) {
    case "init":
      cmdInit(dir, flag("name"), rest.includes("--showcase"));
      break;
    case "compile":
      cmdCompile(dir);
      break;
    case "lint":
      cmdLint(dir, rest.includes("--fix"));
      break;
    case "render":
      await cmdRender(dir);
      break;
    case "thumbs":
      await cmdThumbs(dir);
      break;
    case "plan":
      // First positional arg that is neither a flag nor a flag's value.
      await cmdPlan(
        dir,
        rest.find((a, i) => !a.startsWith("--") && !(i > 0 && rest[i - 1]!.startsWith("--"))),
      );
      break;
    case "providers":
      await cmdProviders();
      break;
    case "mcp":
      startMcpServer(path.resolve(dir));
      break;
    case "studio":
      startStudio(dir, Number(flag("port") ?? 4400));
      break;
    default:
      console.log(
        "usage: cli.ts <init|compile|lint|render|thumbs|plan|providers|mcp|studio> <projectDir>\n" +
          "  render: [--output FILE] [--format mp4|webm|mov|png-sequence] [--quality draft|standard|high] [--workers N] [--browser PATH]\n" +
          '  plan:   "<brief>" [--provider codex-cli|claude-code-cli|anthropic-api|openai-api]\n' +
          "  studio: [--port N]    init: [--name X] [--showcase]",
      );
      process.exit(command ? 1 : 0);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
