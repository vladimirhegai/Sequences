#!/usr/bin/env node
/**
 * Sequences CLI:
 *   init | compile | lint | render | thumbs | plan | providers | mcp | studio | app
 *
 * Run with plain Node ≥ 22.18 (native type-stripping):
 *   node apps/studio/src/cli.ts studio examples/demo-promo
 */
import path from "node:path";
import net from "node:net";
import {
  applyAutoFixes,
  lintProject,
  planToCommands,
  ProjectStore,
  type EventEntry,
  type Finding,
} from "@sequences/core";
import {
  buildProject,
  commitProject,
  loadProject,
  readEventSequence,
  withProjectWriteLock,
} from "./projectIo.ts";
import { renderProject, type RenderFormat, type RenderQuality } from "./render.ts";
import { startStudio } from "./server.ts";
import { startMcpServer } from "./mcp.ts";
import { detectProviders, defaultProvider, type ProviderId } from "./agentConfig.ts";
import { requestPlan } from "./agent/planRunner.ts";
import { requestTweak } from "./agent/tweakRunner.ts";
import {
  extractRenderPoster,
  generatePrimitiveThumbnails,
  generateSceneThumbnails,
} from "./thumbs.ts";
import { openAppWindow } from "./desktopApp.ts";
import { initializeProject } from "./projectTemplates.ts";

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
  initializeProject(path.resolve(dir), { name, showcase });
  console.log(`initialized project in ${dir}`);
  console.log(`next: npm run studio -- ${dir}`);
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

function parsePort(value: string | undefined): number {
  const port = Number(value ?? 4400);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`--port must be an integer from 1 to 65535; got "${value}"`);
  }
  return port;
}

function canListen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once("error", () => resolve(false));
    probe.once("listening", () => {
      probe.close(() => resolve(true));
    });
    probe.listen(port, "127.0.0.1");
  });
}

async function choosePort(requested: number): Promise<number> {
  for (let port = requested; port < requested + 20 && port <= 65535; port++) {
    if (await canListen(port)) {
      if (port !== requested) console.log(`port ${requested} is busy; using ${port}`);
      return port;
    }
  }
  throw new Error(`no free port found near ${requested}`);
}

async function cmdStudio(dir: string): Promise<void> {
  startStudio(dir, await choosePort(parsePort(flag("port"))));
}

async function cmdApp(dir: string): Promise<void> {
  const port = await choosePort(parsePort(flag("port")));
  const server = startStudio(dir, port);
  openAppWindow(`http://localhost:${port}/`, path.resolve(dir), server);
}

async function cmdLint(dir: string, fix: boolean): Promise<void> {
  if (!fix) {
    printFindings(lintProject(loadProject(dir)));
    return;
  }
  await withProjectWriteLock(dir, () => {
    const pendingEvents: EventEntry[] = [];
    const store = new ProjectStore(
      loadProject(dir),
      (entry) => pendingEvents.push(entry),
      readEventSequence(dir),
    );
    const result = applyAutoFixes(store);
    if (result.applied.length > 0) {
      commitProject(dir, store.project, pendingEvents);
      buildProject(dir, store.project);
    }
    console.log(`applied ${result.applied.length} auto-fixes`);
    printFindings(result.remaining);
  });
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
  if (rest.includes("--primitives")) {
    const result = await generatePrimitiveThumbnails(dir);
    for (const [primitiveId, rel] of Object.entries(result.files)) {
      console.log(`${primitiveId} -> ${path.join(dir, "build", rel)}`);
    }
    console.log(`${Object.keys(result.files).length} primitive thumbnails in ${result.elapsedMs}ms`);
    return;
  }
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
  const startingProject = loadProject(dir);
  const startingFingerprint = JSON.stringify(startingProject);
  console.log(`planning with ${providerId}…`);
  const result = await requestPlan(providerId, brief, startingProject);
  const project = await withProjectWriteLock(dir, () => {
    const currentProject = loadProject(dir);
    if (JSON.stringify(currentProject) !== startingFingerprint) {
      throw new Error("project changed while the plan was being generated; run the plan again");
    }
    const pendingEvents: EventEntry[] = [];
    const store = new ProjectStore(
      currentProject,
      (entry) => pendingEvents.push(entry),
      readEventSequence(dir),
    );
    const outcome = store.apply(planToCommands(store.project, result.plan), "agent");
    if (!outcome.ok) {
      throw new Error(
        `plan failed project validation — ${outcome.errors
          .map((issue) => `${issue.path}: ${issue.message}`)
          .join("; ")}`,
      );
    }
    commitProject(dir, store.project, pendingEvents);
    buildProject(dir, store.project);
    return store.project;
  });
  console.log(
    `plan applied: ${result.plan.scenes.length} scenes ` +
      `(${result.plan.scenes.map((s) => s.archetype).join(" → ")}), profile ${result.plan.motionProfile}`,
  );
  printFindings(lintProject(project));
  console.log(`next: node apps/studio/src/cli.ts studio ${dir}`);
}

async function cmdTweak(dir: string, text: string | undefined): Promise<void> {
  if (!text?.trim()) {
    throw new Error('usage: cli.ts tweak <projectDir> "<request>" [--scene id] [--layer id] [--provider id]');
  }
  const startingProject = loadProject(dir);
  const providerId = (flag("provider") as ProviderId | undefined) ?? (await defaultProvider());
  const result = await requestTweak(
    providerId,
    text,
    startingProject,
    { sceneId: flag("scene"), layerId: flag("layer") },
  );
  await withProjectWriteLock(dir, () => {
    const pendingEvents: EventEntry[] = [];
    const store = new ProjectStore(
      loadProject(dir),
      (entry) => pendingEvents.push(entry),
      readEventSequence(dir),
    );
    const command =
      result.commands.length === 1
        ? result.commands[0]!
        : { type: "Batch" as const, commands: result.commands };
    const outcome = store.apply(command, result.mode === "zero-token" ? "cli" : "agent");
    if (!outcome.ok) {
      throw new Error(outcome.errors.map((issue) => `${issue.path}: ${issue.message}`).join("; "));
    }
    commitProject(dir, store.project, pendingEvents);
    buildProject(dir, store.project);
  });
  console.log(`${result.mode}: ${result.explanation}`);
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
      await cmdLint(dir, rest.includes("--fix"));
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
    case "tweak":
      await cmdTweak(
        dir,
        rest.find((a, i) => !a.startsWith("--") && !(i > 0 && rest[i - 1]!.startsWith("--"))),
      );
      break;
    case "preview":
      await cmdStudio(dir);
      break;
    case "providers":
      await cmdProviders();
      break;
    case "mcp":
      startMcpServer(path.resolve(dir));
      break;
    case "studio":
      await cmdStudio(dir);
      break;
    case "app":
    case "exe":
      await cmdApp(dir);
      break;
    default:
      console.log(
        "usage: cli.ts <init|compile|lint|render|thumbs|plan|preview|tweak|providers|mcp|studio|app|exe> <projectDir>\n" +
          "  render: [--output FILE] [--format mp4|webm|mov|png-sequence] [--quality draft|standard|high] [--workers N] [--browser PATH]\n" +
          "  thumbs: [--primitives]\n" +
          '  plan:   "<brief>" [--provider codex-cli|claude-code-cli|anthropic-api|openai-api]\n' +
          '  tweak:  "<request>" [--scene ID] [--layer ID] [--provider ID]\n' +
          "  studio: [--port N]    app/exe: [--port N]    init: [--name X] [--showcase]",
      );
      process.exit(command ? 1 : 0);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
