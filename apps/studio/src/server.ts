/**
 * Studio-lite server. Plain node:http — no framework, same-origin only.
 *
 * Every mutation flows through the ONE pathway: POST /api/command →
 * ProjectStore.apply → validate → save project.json → append events.log →
 * recompile build/. The UI and (future) agents are the same client.
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import {
  applyAutoFixes,
  ARCHETYPES,
  CAMERA_MOVES,
  CommandSchema,
  compile,
  DURATION_TOKEN_IDS,
  enabledExtensionIds,
  extensionPreviewProject,
  deriveDirections,
  type ExtensionPreviewType,
  lintProject,
  parsePlan,
  planToCommands,
  PRIMITIVES,
  PROFILES,
  TRANSITION_PLUGINS,
  promptCatalog,
  ProjectStore,
  SCALE_TOKEN_IDS,
  scaleFrames30,
  StructuredBriefSchema,
  structuredBriefToPlan,
  STAGGER_TOKEN_IDS,
  type Command,
  type EventEntry,
  type Finding,
  type Manifest,
} from "@sequences/core";
import {
  buildProject,
  commitProject,
  loadProject,
  readEventSequence,
  vendorFiles,
  withProjectWriteLock,
} from "./projectIo.ts";
import { renderProject, type RenderFormat, type RenderQuality } from "./render.ts";
import { detectProviders, defaultProvider, PROVIDERS, type ProviderId } from "./agentConfig.ts";
import { requestDirections, requestPlan } from "./agent/planRunner.ts";
import { requestTweak } from "./agent/tweakRunner.ts";
import { extractRenderPoster, generateSceneThumbnails } from "./thumbs.ts";
import { demoProjectDir, initializeProject, resolveProjectPath } from "./projectTemplates.ts";
import {
  createLibraryFolder,
  findProjectPoster,
  fsRoots,
  libraryDir,
  listDisk,
  listLibrary,
  loadDesignScratch,
  loadStoryboard,
  mediaKind,
  placeAsset,
  saveDesignScratch,
  saveStoryboard,
  storyboardToText,
  type DesignScratch,
  type Storyboard,
} from "./workspace.ts";

const STATIC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "static");
const require = createRequire(import.meta.url);
const EXCALIDRAW_VENDOR_DIR = path.dirname(require.resolve("@excalidraw/excalidraw"));

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const EXT_PREVIEW_TYPES = new Set<ExtensionPreviewType>([
  "primitive",
  "archetype",
  "profile",
  "camera",
]);

/**
 * Compiled extension-preview HTML, cached by `type:id`. The previews are built
 * from the static registry (no project state), so the cache is safe to share
 * across requests and projects — compile once, replay live in the card.
 */
const extPreviewCache = new Map<string, string>();

function extensionPreviewHtml(type: ExtensionPreviewType, id: string): string {
  const key = `${type}:${id}`;
  const cached = extPreviewCache.get(key);
  if (cached) return cached;
  const html = compile(extensionPreviewProject(type, id)).html;
  extPreviewCache.set(key, html);
  return html;
}

interface StudioRenderState {
  status: "idle" | "rendering" | "complete" | "failed";
  startedAt?: string;
  completedAt?: string;
  outputPath?: string;
  outputName?: string;
  href?: string;
  posterHref?: string;
  format?: RenderFormat;
  quality?: RenderQuality;
  error?: string;
}

interface StudioAgentState {
  status: "idle" | "planning" | "complete" | "failed";
  provider?: ProviderId;
  startedAt?: string;
  completedAt?: string;
  summary?: string;
  error?: string;
}

interface StudioThumbsState {
  status: "idle" | "generating" | "complete" | "failed";
  /** sceneId → href under /build/. Stale entries are fine (best effort). */
  files: Record<string, string>;
  version: number;
  error?: string;
}

interface StudioState {
  store: ProjectStore;
  manifest: Manifest;
  findings: Finding[];
  projectDir: string;
  projectFile: string;
  buildVersion: number;
  recentEvents: EventEntry[];
  render: StudioRenderState;
  agent: StudioAgentState;
  thumbs: StudioThumbsState;
  lastBuildMs: number;
  changedSceneIds: string[];
}

export function startStudio(projectDir: string, port: number): http.Server {
  let dir = path.resolve(projectDir);
  let store: ProjectStore;
  let projectFingerprint = "";
  let pendingEvents: EventEntry[] = [];
  const state = {} as StudioState;

  const flushEvents = () => {
    const entries = pendingEvents.splice(0);
    commitProject(dir, store.project, entries);
    for (const entry of entries) {
      state.recentEvents.push(entry);
      if (state.recentEvents.length > 50) state.recentEvents.shift();
    }
  };

  const rebuild = () => {
    const started = performance.now();
    flushEvents();
    projectFingerprint = JSON.stringify(store.project);
    const result = buildProject(dir, store.project, { allowMissingAssets: true });
    state.manifest = result.manifest;
    state.findings = [
      ...lintProject(store.project),
      ...result.missingAssetPaths.map((assetPath) => ({
        rule: "asset-file-missing",
        severity: "warn" as const,
        message: `registered asset is missing on disk: ${assetPath}`,
      })),
    ];
    state.lastBuildMs = Math.round((performance.now() - started) * 100) / 100;
    state.changedSceneIds = result.changedSceneIds;
    state.buildVersion += 1;
  };

  const loadActiveProject = (nextDir: string) => {
    const activeDir = path.resolve(nextDir);
    dir = activeDir;
    pendingEvents = [];
    const project = loadProject(activeDir);
    let nextStore!: ProjectStore;
    nextStore = new ProjectStore(project, (entry) => {
      if (store !== nextStore) return;
      pendingEvents.push(entry);
    }, readEventSequence(activeDir));
    store = nextStore;
    state.store = store;
    state.projectDir = dir;
    state.projectFile = path.join(dir, "project.json");
    state.recentEvents = [];
    state.buildVersion = 0;
    state.render = { status: "idle" };
    state.agent = { status: "idle" };
    state.thumbs = { status: "idle", files: {}, version: 0 };
    state.lastBuildMs = 0;
    state.changedSceneIds = [];
    rebuild();
  };

  loadActiveProject(dir);

  const syncFromDisk = () => {
    if (pendingEvents.length > 0 && JSON.stringify(store.project) === projectFingerprint) {
      flushEvents();
    }
    const diskProject = loadProject(dir);
    const diskFingerprint = JSON.stringify(diskProject);
    const diskSequence = readEventSequence(dir);
    if (diskFingerprint !== projectFingerprint || diskSequence !== store.eventCount) {
      loadActiveProject(dir);
    }
  };

  const withCurrentProject = <T>(action: () => T | Promise<T>) => {
    const activeDir = dir;
    return withProjectWriteLock(activeDir, async () => {
      if (dir !== activeDir) throw new Error("active project changed while waiting for its write lock");
      syncFromDisk();
      return action();
    });
  };

  const stateJson = () =>
    JSON.stringify({
      project: store.project,
      projectDir: dir,
      projectFile: path.join(dir, "project.json"),
      manifest: state.manifest,
      findings: state.findings,
      canUndo: store.canUndo,
      canRedo: store.canRedo,
      eventCount: store.eventCount,
      buildVersion: state.buildVersion,
      recentEvents: state.recentEvents.slice(-12).reverse(),
      render: state.render,
      agent: state.agent,
      thumbs: state.thumbs,
      performance: {
        commandToPreviewMs: state.lastBuildMs,
        changedSceneIds: state.changedSceneIds,
        budgetMs: 300,
      },
    });

  const metaJson = async () =>
    JSON.stringify({
      archetypes: Object.values(ARCHETYPES).map((a) => ({
        id: a.id,
        summary: a.summary,
        slots: a.slots,
        layouts: a.layouts,
        defaultLayout: a.defaultLayout,
        duration: {
          min: scaleFrames30(a.duration.min, store.project.meta.fps),
          ideal: scaleFrames30(a.duration.ideal, store.project.meta.fps),
          max: scaleFrames30(a.duration.max, store.project.meta.fps),
        },
      })),
      profiles: Object.values(PROFILES).map((p) => ({ id: p.id, summary: p.summary })),
      primitives: Object.values(PRIMITIVES).map((p) => ({
        id: p.id,
        kind: p.kind,
        summary: p.summary,
      })),
      durationTokens: DURATION_TOKEN_IDS,
      staggerTokens: STAGGER_TOKEN_IDS,
      scaleTokens: SCALE_TOKEN_IDS,
      cameraMoves: Object.values(CAMERA_MOVES).map((m) => ({ id: m.id, summary: m.summary })),
      transitions: Object.values(TRANSITION_PLUGINS)
        .filter((transition) => enabledExtensionIds(store.project).has(transition.id))
        .map((transition) => transition.id),
      promptCatalog: promptCatalog({
        enabledIds: enabledExtensionIds(store.project),
        fps: store.project.meta.fps,
      }),
      agentProviders: await detectProviders(),
      defaultAgentProvider: await defaultProvider(),
      demoProjectDir: fs.existsSync(path.join(demoProjectDir(), "project.json"))
        ? demoProjectDir()
        : null,
    });

  const sendJson = (res: http.ServerResponse, status: number, body: string) => {
    res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
    res.end(body);
  };

  const sendFile = (res: http.ServerResponse, file: string) => {
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404);
      res.end("not found");
      return;
    }
    const extension = path.extname(file).toLowerCase();
    res.writeHead(200, {
      "content-type": MIME[extension] ?? "application/octet-stream",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      ...(extension === ".svg" ? { "content-security-policy": "sandbox" } : {}),
    });
    res.end(fs.readFileSync(file));
  };

  /** Streamed media with Range support (video/audio scrubbing needs it). */
  const sendMedia = (req: http.IncomingMessage, res: http.ServerResponse, file: string) => {
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404);
      return res.end("not found");
    }
    const size = fs.statSync(file).size;
    const extension = path.extname(file).toLowerCase();
    const type = MIME[extension] ?? "application/octet-stream";
    const safetyHeaders = {
      "x-content-type-options": "nosniff",
      ...(extension === ".svg" ? { "content-security-policy": "sandbox" } : {}),
    };
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? "");
    if (range && (range[1] || range[2])) {
      const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
      const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
      if (start >= size || start > end) {
        res.writeHead(416, { "content-range": `bytes */${size}` });
        return res.end();
      }
      res.writeHead(206, {
        "content-type": type,
        "content-range": `bytes ${start}-${end}/${size}`,
        "content-length": end - start + 1,
        "accept-ranges": "bytes",
        ...safetyHeaders,
      });
      fs.createReadStream(file, { start, end }).pipe(res);
    } else {
      res.writeHead(200, {
        "content-type": type,
        "content-length": size,
        "accept-ranges": "bytes",
        "cache-control": "no-store",
        ...safetyHeaders,
      });
      fs.createReadStream(file).pipe(res);
    }
  };

  const renderJson = () => JSON.stringify(state.render);

  const safeChildPath = (root: string, rel: string): string | null => {
    const rootPath = path.resolve(root);
    const file = path.resolve(rootPath, path.normalize(rel));
    if (file !== rootPath && !file.startsWith(rootPath + path.sep)) return null;
    return file;
  };

  const readBody = (req: http.IncomingMessage): Promise<string> =>
    new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let total = 0;
      let failed = false;
      const onData = (chunk: Buffer) => {
        total += chunk.length;
        // 16MB: storyboards with heavy freehand sketching are still JSON.
        if (total > 16_000_000) {
          failed = true;
          chunks.length = 0;
          req.off("data", onData);
          req.resume();
          reject(Object.assign(new Error("body too large"), { statusCode: 413 }));
          return;
        }
        chunks.push(chunk);
      };
      req.on("data", onData);
      req.on("end", () => {
        if (!failed) resolve(Buffer.concat(chunks).toString("utf8"));
      });
      req.on("error", reject);
    });

  /** Raw binary body (media upload). In-memory; fine for Phase-1 file sizes. */
  const readBinaryBody = (req: http.IncomingMessage): Promise<Buffer> =>
    new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let total = 0;
      let failed = false;
      const onData = (chunk: Buffer) => {
        total += chunk.length;
        if (total > 512_000_000) {
          failed = true;
          chunks.length = 0;
          req.off("data", onData);
          req.resume();
          reject(Object.assign(new Error("file too large (512MB cap)"), { statusCode: 413 }));
          return;
        }
        chunks.push(chunk);
      };
      req.on("data", onData);
      req.on("end", () => {
        if (!failed) resolve(Buffer.concat(chunks));
      });
      req.on("error", reject);
    });

  const badRequest = (res: http.ServerResponse, where: string, message: string, status = 400) =>
    sendJson(res, status, JSON.stringify({ ok: false, errors: [{ path: where, message }] }));

  /** Copy/write a file into assets/ and register it via AddAsset (one pathway). */
  const importAsset = async (
    res: http.ServerResponse,
    fileName: string,
    folder: string,
    write: (destination: string) => void,
  ) => {
    return withCurrentProject(() => {
      const existing = new Set(store.project.assets.map((a) => a.id));
      const placed = placeAsset(dir, fileName, folder, existing, write);
      const duplicate = store.project.assets.find((asset) => asset.contentHash === placed.contentHash);
      if (duplicate) {
        fs.rmSync(path.join(dir, placed.relPath), { force: true });
        return sendJson(res, 200, stateJson());
      }
      const outcome = store.apply(
        {
          type: "AddAsset",
          asset: {
            id: placed.id,
            path: placed.relPath,
            kind: placed.kind,
            contentHash: placed.contentHash,
            metadata: placed.metadata,
          },
        },
        "user",
      );
      if (!outcome.ok) {
        fs.rmSync(path.join(dir, placed.relPath), { force: true });
        return sendJson(res, 422, JSON.stringify({ ok: false, errors: outcome.errors }));
      }
      rebuild();
      return sendJson(res, 200, stateJson());
    });
  };

  const server = http.createServer(async (req, res) => {
    const address = server.address();
    const boundPort = typeof address === "object" && address ? address.port : port;
    const allowedHosts = new Set([`localhost:${boundPort}`, `127.0.0.1:${boundPort}`]);
    const allowedOrigins = new Set([...allowedHosts].map((allowed) => `http://${allowed}`));
    const host = typeof req.headers.host === "string" ? req.headers.host.toLowerCase() : "";
    const origin = typeof req.headers.origin === "string" ? req.headers.origin.toLowerCase() : "";
    if (
      !allowedHosts.has(host) ||
      (origin && !allowedOrigins.has(origin)) ||
      req.headers["sec-fetch-site"] === "cross-site"
    ) {
      res.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
      return res.end("forbidden");
    }
    const url = new URL(req.url ?? "/", "http://localhost");
    const route = `${req.method} ${url.pathname}`;
    try {
      if (route === "GET /") return sendFile(res, path.join(STATIC_DIR, "index.html"));
      if (req.method === "GET" && /^\/[\w-]+\.(js|css|svg|png)$/.test(url.pathname)) {
        return sendFile(res, path.join(STATIC_DIR, url.pathname.slice(1)));
      }
      if (route === "GET /vendor/hyperframes-player.global.js") {
        return sendFile(res, vendorFiles()["hyperframes-player.global.js"]!);
      }
      if (req.method === "GET" && url.pathname.startsWith("/vendor/excalidraw/")) {
        const rel = decodeURIComponent(url.pathname.slice("/vendor/excalidraw/".length));
        const file = safeChildPath(EXCALIDRAW_VENDOR_DIR, rel);
        if (!file) {
          res.writeHead(403);
          return res.end("forbidden");
        }
        return sendFile(res, file);
      }
      if (route === "GET /api/state") {
        return sendJson(res, 200, await withCurrentProject(() => stateJson()));
      }
      if (route === "GET /api/meta") {
        return sendJson(res, 200, await withCurrentProject(() => metaJson()));
      }
      if (route === "GET /api/render") return sendJson(res, 200, renderJson());
      if (route === "GET /api/agent") return sendJson(res, 200, JSON.stringify(state.agent));
      if (route === "GET /api/thumbs") return sendJson(res, 200, JSON.stringify(state.thumbs));

      if (route === "POST /api/project/open") {
        const body = JSON.parse(await readBody(req)) as { dir?: string };
        if (!body.dir?.trim()) {
          return sendJson(
            res,
            400,
            JSON.stringify({ ok: false, errors: [{ path: "dir", message: "project path is empty" }] }),
          );
        }
        const target = resolveProjectPath(body.dir, process.cwd());
        if (!fs.existsSync(path.join(target, "project.json"))) {
          return sendJson(
            res,
            400,
            JSON.stringify({
              ok: false,
              errors: [{ path: "dir", message: `no project.json in ${target}` }],
            }),
          );
        }
        loadActiveProject(target);
        return sendJson(res, 200, stateJson());
      }

      if (route === "POST /api/project/new") {
        const body = JSON.parse(await readBody(req)) as {
          dir?: string;
          name?: string;
          showcase?: boolean;
        };
        if (!body.dir?.trim()) {
          return sendJson(
            res,
            400,
            JSON.stringify({ ok: false, errors: [{ path: "dir", message: "project path is empty" }] }),
          );
        }
        const target = resolveProjectPath(body.dir, process.cwd());
        if (fs.existsSync(path.join(target, "project.json"))) {
          return sendJson(
            res,
            409,
            JSON.stringify({
              ok: false,
              errors: [{ path: "dir", message: `project already exists in ${target}` }],
            }),
          );
        }
        const name = body.name?.trim() || path.basename(target);
        initializeProject(target, { name, showcase: body.showcase === true });
        loadActiveProject(target);
        return sendJson(res, 200, stateJson());
      }

      if (route === "POST /api/project/demo") {
        const target = demoProjectDir();
        if (!fs.existsSync(path.join(target, "project.json"))) {
          return sendJson(
            res,
            404,
            JSON.stringify({
              ok: false,
              errors: [{ path: "demo", message: "bundled demo project was not found" }],
            }),
          );
        }
        loadActiveProject(target);
        return sendJson(res, 200, stateJson());
      }

      /* ---- project library (Main Menu launcher) ---- */

      if (route === "GET /api/projects") {
        const rel = url.searchParams.get("path") ?? "";
        const listing = listLibrary(rel);
        const demoDir = demoProjectDir();
        const demo = fs.existsSync(path.join(demoDir, "project.json"))
          ? { kind: "project", name: "Pulse — Demo", dir: demoDir, modifiedAt: new Date().toISOString(), title: "Pulse" }
          : null;
        return sendJson(
          res,
          200,
          JSON.stringify({
            libraryDir: libraryDir(),
            currentProjectDir: dir,
            path: listing.path,
            entries: listing.entries,
            demo,
          }),
        );
      }

      if (route === "POST /api/projects/folder") {
        const body = JSON.parse(await readBody(req)) as { path?: string; name?: string };
        if (!body.name?.trim()) return badRequest(res, "name", "folder name is empty");
        const created = createLibraryFolder(body.path ?? "", body.name);
        return sendJson(res, 200, JSON.stringify({ ok: true, dir: created }));
      }

      if (route === "GET /api/projects/poster") {
        const target = path.resolve(url.searchParams.get("dir") ?? "");
        const inLibrary = target.startsWith(path.resolve(libraryDir()) + path.sep);
        if (!inLibrary && target !== path.resolve(demoProjectDir()) && target !== dir) {
          res.writeHead(403);
          return res.end("forbidden");
        }
        const poster = findProjectPoster(target);
        if (!poster) {
          // Missing artwork is a normal project state. 204 lets the launcher's
          // image fallback run without polluting the browser console with a
          // failed-resource error.
          res.writeHead(204, { "Cache-Control": "no-store" });
          return res.end();
        }
        return sendMedia(req, res, poster);
      }

      /* ---- disk browsing (Media page file view; read-only, localhost) ---- */

      if (route === "GET /api/fs") {
        const target = url.searchParams.get("path");
        if (!target) return sendJson(res, 200, JSON.stringify({ roots: fsRoots(dir) }));
        return sendJson(res, 200, JSON.stringify(listDisk(target)));
      }

      if (route === "GET /api/fs/file") {
        const target = path.resolve(url.searchParams.get("path") ?? "");
        if (!mediaKind(target)) {
          res.writeHead(403);
          return res.end("not a media file");
        }
        return sendMedia(req, res, target);
      }

      /* ---- media pool imports (copy into assets/ + AddAsset command) ---- */

      if (route === "POST /api/assets/import") {
        const body = JSON.parse(await readBody(req)) as { path?: string; folder?: string };
        const source = (body.path ?? "").trim();
        if (!source || !fs.existsSync(source) || !fs.statSync(source).isFile()) {
          return badRequest(res, "path", `no such file: ${source}`);
        }
        return await importAsset(res, path.basename(source), body.folder ?? "", (destination) =>
          fs.copyFileSync(source, destination),
        );
      }

      if (route === "POST /api/assets/upload") {
        const name = (url.searchParams.get("name") ?? "").trim();
        if (!name) return badRequest(res, "name", "file name is required (?name=)");
        const buffer = await readBinaryBody(req);
        if (buffer.length === 0) return badRequest(res, "body", "empty upload");
        return await importAsset(res, name, url.searchParams.get("folder") ?? "", (destination) =>
          fs.writeFileSync(destination, buffer),
        );
      }

      if (route === "POST /api/assets/svg") {
        const body = JSON.parse(await readBody(req)) as { name?: string; svg?: string; folder?: string };
        const name = (body.name ?? "").trim().replace(/\.svg$/i, "");
        if (!name) return badRequest(res, "name", "asset name is empty");
        if (!body.svg?.trim().startsWith("<svg")) return badRequest(res, "svg", "not an <svg> document");
        return await importAsset(res, `${name}.svg`, body.folder ?? "design", (destination) =>
          fs.writeFileSync(destination, body.svg!),
        );
      }

      if (route === "POST /api/assets/move") {
        const body = JSON.parse(await readBody(req)) as { assetId?: string; folder?: string };
        return await withCurrentProject(() => {
        const assetId = (body.assetId ?? "").trim();
        const index = store.project.assets.findIndex((a) => a.id === assetId);
        if (index === -1) return badRequest(res, "assetId", `unknown asset: ${assetId}`);
        const asset = store.project.assets[index]!;
        const folder = (body.folder ?? "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
        const currentBin = asset.path.replace(/\\/g, "/").split("/").slice(1, -1).join("/");
        if (folder === currentBin) return sendJson(res, 200, stateJson());
        const source = path.join(dir, asset.path);
        if (!fs.existsSync(source)) return badRequest(res, "assetId", `asset file missing on disk: ${asset.path}`);
        // COPY into the target bin (the old file stays — undo must keep working),
        // then re-register at the new path as one atomic, undoable batch.
        const others = new Set(store.project.assets.filter((a) => a.id !== assetId).map((a) => a.id));
        const placed = placeAsset(dir, path.basename(source), folder, others, (destination) =>
          fs.copyFileSync(source, destination),
        );
        const outcome = store.apply(
          {
            type: "Batch",
            commands: [
              { type: "RemoveAsset", assetId },
              {
                type: "AddAsset",
                asset: {
                  id: assetId,
                  path: placed.relPath,
                  kind: asset.kind,
                  contentHash: asset.contentHash,
                  metadata: asset.metadata,
                },
                index,
              },
            ],
          },
          "user",
        );
        if (!outcome.ok) {
          fs.rmSync(path.join(dir, placed.relPath), { force: true });
          return sendJson(res, 422, JSON.stringify({ ok: false, errors: outcome.errors }));
        }
        rebuild();
        return sendJson(res, 200, stateJson());
        });
      }

      if (route === "POST /api/assets/folder") {
        const body = JSON.parse(await readBody(req)) as { name?: string };
        const name = (body.name ?? "").trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
        const assetRoot = path.join(dir, "assets");
        const target = safeChildPath(assetRoot, name);
        if (
          !name ||
          !target ||
          target === path.resolve(assetRoot) ||
          name.split("/").some((part) => part === "." || part === ".." || /[<>:"|?*\0]/.test(part))
        ) {
          return badRequest(res, "name", "invalid folder name");
        }
        fs.mkdirSync(target, { recursive: true });
        return sendJson(res, 200, JSON.stringify({ ok: true }));
      }

      if (route === "GET /api/assets/folders") {
        const root = path.join(dir, "assets");
        const folders: string[] = [];
        const walk = (sub: string, depth: number) => {
          if (depth > 3 || !fs.existsSync(sub)) return;
          for (const name of fs.readdirSync(sub)) {
            const p = path.join(sub, name);
            if (fs.statSync(p).isDirectory()) {
              folders.push(path.relative(root, p).replace(/\\/g, "/"));
              walk(p, depth + 1);
            }
          }
        };
        walk(root, 1);
        return sendJson(res, 200, JSON.stringify({ folders }));
      }

      /* ---- portable design/storyboard sidecars ---- */

      if (route === "GET /api/design") {
        return sendJson(res, 200, JSON.stringify(loadDesignScratch(dir)));
      }
      if (route === "PUT /api/design") {
        const scratch = JSON.parse(await readBody(req)) as DesignScratch;
        saveDesignScratch(dir, scratch);
        return sendJson(res, 200, JSON.stringify({ ok: true }));
      }

      if (route === "GET /api/storyboard") {
        return sendJson(res, 200, JSON.stringify(loadStoryboard(dir)));
      }
      if (route === "PUT /api/storyboard") {
        const board = JSON.parse(await readBody(req)) as Storyboard;
        saveStoryboard(dir, board);
        return sendJson(res, 200, JSON.stringify({ ok: true }));
      }
      if (route === "GET /api/storyboard/text") {
        return sendJson(res, 200, JSON.stringify({ text: storyboardToText(loadStoryboard(dir)) }));
      }

      /* ---- render history (Render page) ---- */

      if (route === "GET /api/renders/list") {
        const rendersDir = path.join(dir, "renders");
        const items: Array<{ name: string; href: string; size: number; mtime: string }> = [];
        if (fs.existsSync(rendersDir)) {
          for (const name of fs.readdirSync(rendersDir)) {
            if (![".mp4", ".webm", ".mov"].includes(path.extname(name).toLowerCase())) continue;
            const stat = fs.statSync(path.join(rendersDir, name));
            items.push({
              name,
              href: `/renders/${encodeURIComponent(name)}`,
              size: stat.size,
              mtime: stat.mtime.toISOString(),
            });
          }
        }
        items.sort((a, b) => b.mtime.localeCompare(a.mtime));
        return sendJson(res, 200, JSON.stringify({ renders: items }));
      }

      if (route === "POST /api/command") {
        const body = JSON.parse(await readBody(req)) as { command: unknown; source?: string };
        const parsed = CommandSchema.safeParse(body.command);
        if (!parsed.success) {
          return sendJson(
            res,
            400,
            JSON.stringify({
              ok: false,
              errors: parsed.error.issues.map((i) => ({
                path: i.path.join("."),
                message: i.message,
              })),
            }),
          );
        }
        return await withCurrentProject(() => {
          const outcome = store.apply(body.command as Command, "user");
          if (!outcome.ok) {
            return sendJson(res, 422, JSON.stringify({ ok: false, errors: outcome.errors }));
          }
          rebuild();
          return sendJson(res, 200, stateJson());
        });
      }

      if (route === "POST /api/undo" || route === "POST /api/redo") {
        return await withCurrentProject(() => {
          const moved = route.endsWith("undo") ? store.undo() : store.redo();
          if (moved) rebuild();
          return sendJson(res, 200, stateJson());
        });
      }

      if (route === "POST /api/autofix") {
        return await withCurrentProject(() => {
          const result = applyAutoFixes(store);
          if (result.applied.length > 0) rebuild();
          return sendJson(res, 200, stateJson());
        });
      }

      if (route === "POST /api/render") {
        if (state.render.status === "rendering") {
          return sendJson(
            res,
            409,
            JSON.stringify({
              ok: false,
              errors: [{ path: "render", message: "a render is already running" }],
            }),
          );
        }
        const raw = (await readBody(req)).trim();
        const body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
        const format: RenderFormat =
          body.format === "webm" || body.format === "mov" || body.format === "png-sequence"
            ? body.format
            : "mp4";
        const quality: RenderQuality =
          body.quality === "draft" || body.quality === "high" ? body.quality : "standard";
        const workers =
          typeof body.workers === "number" && Number.isInteger(body.workers) && body.workers > 0
            ? body.workers
            : undefined;
        const renderContext = await withCurrentProject(() => ({
          projectDir: dir,
          projectStore: store,
          project: store.project,
        }));
        state.render = {
          status: "rendering",
          startedAt: new Date().toISOString(),
          format,
          quality,
        };
        const renderDir = renderContext.projectDir;
        const renderStore = renderContext.projectStore;
        const renderStartedAt = state.render.startedAt;
        void renderProject(renderDir, renderContext.project, { format, quality, workers, quiet: true })
          .then(async (result) => {
            if (renderDir !== dir || renderStore !== store) return;
            const outputName = path.basename(result.outputPath);
            let posterHref: string | undefined;
            if (format !== "png-sequence") {
              // Best-effort poster frame next to the render.
              posterHref = await extractRenderPoster(result.outputPath)
                .then((p) => `/renders/${encodeURIComponent(path.basename(p))}`)
                .catch(() => undefined);
            }
            state.render = {
              status: "complete",
              startedAt: renderStartedAt,
              completedAt: new Date().toISOString(),
              outputPath: result.outputPath,
              outputName,
              href: `/renders/${encodeURIComponent(outputName)}`,
              ...(posterHref ? { posterHref } : {}),
              format,
              quality,
            };
          })
          .catch((error) => {
            if (renderDir !== dir || renderStore !== store) return;
            state.render = {
              status: "failed",
              startedAt: renderStartedAt,
              completedAt: new Date().toISOString(),
              format,
              quality,
              error: error instanceof Error ? error.message : String(error),
            };
          });
        return sendJson(res, 202, renderJson());
      }

      if (route === "POST /api/agent/plan") {
        if (state.agent.status === "planning") {
          return sendJson(
            res,
            409,
            JSON.stringify({
              ok: false,
              errors: [{ path: "agent", message: "a plan is already running" }],
            }),
          );
        }
        const body = JSON.parse(await readBody(req)) as {
          brief?: string;
          provider?: string;
          apiKey?: string;
          model?: string;
          thinkingMode?: "auto" | "low" | "medium" | "high" | "xhigh" | "max";
        };
        const brief = (body.brief ?? "").trim();
        if (!brief) {
          return sendJson(
            res,
            400,
            JSON.stringify({ ok: false, errors: [{ path: "brief", message: "brief is empty" }] }),
          );
        }
        if (body.provider && !(body.provider in PROVIDERS)) {
          return badRequest(res, "provider", `unknown agent provider: ${body.provider}`);
        }
        const providerId = (body.provider as ProviderId | undefined) ?? (await defaultProvider());
        if (!providerId) {
          return sendJson(
            res,
            400,
            JSON.stringify({
              ok: false,
              errors: [
                {
                  path: "provider",
                  message:
                    "no agent provider available — install the Codex or Claude Code CLI (no API key needed) or set an API key",
                },
              ],
            }),
          );
        }
        const agentContext = await withCurrentProject(() => ({
          projectDir: dir,
          projectStore: store,
        }));
        state.agent = {
          status: "planning",
          provider: providerId,
          startedAt: new Date().toISOString(),
        };
        const agentDir = agentContext.projectDir;
        const agentStore = agentContext.projectStore;
        const agentStartedAt = state.agent.startedAt;
        // The storyboard is the user's drawn intent — hand it to the planner
        // as brief context (capped; Phase 2 brings the token-optimized form).
        const storyboardText = storyboardToText(loadStoryboard(dir)).slice(0, 4000);
        const fullBrief = storyboardText ? `${brief}\n\n${storyboardText}` : brief;
        // Agent options are request-only browser preferences, never project data.
        const runOptions = {
          ...(body.apiKey ? { apiKey: body.apiKey } : {}),
          ...(body.model?.trim() ? { model: body.model.trim() } : {}),
          ...(body.thinkingMode && body.thinkingMode !== "auto" ? { thinkingMode: body.thinkingMode } : {}),
        };
        void requestPlan(providerId, fullBrief, agentStore.project, runOptions)
          .then(async (result) => {
            if (agentDir !== dir) return;
            await withProjectWriteLock(agentDir, () => {
              syncFromDisk();
              if (agentDir !== dir || agentStore !== store) {
                state.agent = {
                  status: "failed",
                  provider: providerId,
                  startedAt: agentStartedAt,
                  completedAt: new Date().toISOString(),
                  error: "project changed while the plan was being generated; run the plan again",
                };
                return;
              }
              const outcome = store.apply(planToCommands(store.project, result.plan), "agent");
              if (!outcome.ok) {
                throw new Error(
                  `plan failed project validation — ${outcome.errors
                    .map((issue) => `${issue.path}: ${issue.message}`)
                    .join("; ")}`,
                );
              }
              rebuild();
              state.agent = {
                status: "complete",
                provider: providerId,
                startedAt: agentStartedAt,
                completedAt: new Date().toISOString(),
                summary: `${result.plan.scenes.length} scenes, profile ${result.plan.motionProfile}`,
              };
            });
          })
          .catch((error) => {
            if (agentDir !== dir || agentStore !== store) return;
            state.agent = {
              status: "failed",
              provider: providerId,
              startedAt: agentStartedAt,
              completedAt: new Date().toISOString(),
              error: error instanceof Error ? error.message : String(error),
            };
          });
        return sendJson(res, 202, JSON.stringify(state.agent));
      }

      if (route === "POST /api/agent/directions") {
        const body = JSON.parse(await readBody(req)) as {
          brief?: string;
          structured?: unknown;
          provider?: string;
          apiKey?: string;
          model?: string;
        };
        if (body.provider && !(body.provider in PROVIDERS)) {
          return badRequest(res, "provider", `unknown agent provider: ${body.provider}`);
        }
        const project = await withCurrentProject(() => store.project);
        if (body.structured !== undefined) {
          const parsed = StructuredBriefSchema.safeParse(body.structured);
          if (!parsed.success) {
            return badRequest(
              res,
              "structured",
              parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; "),
            );
          }
          const base = structuredBriefToPlan(project, parsed.data);
          return sendJson(
            res,
            200,
            JSON.stringify({ ok: true, mode: "zero-token", directions: deriveDirections(base, project) }),
          );
        }
        const brief = body.brief?.trim();
        if (!brief) return badRequest(res, "brief", "brief is empty");
        const providerId = (body.provider as ProviderId | undefined) ?? (await defaultProvider());
        if (!providerId) return badRequest(res, "provider", "no provider available");
        const result = await requestDirections(providerId, brief, project, {
          ...(body.apiKey ? { apiKey: body.apiKey } : {}),
          ...(body.model?.trim() ? { model: body.model.trim() } : {}),
        });
        return sendJson(res, 200, JSON.stringify({ ok: true, mode: "model", ...result }));
      }

      if (route === "POST /api/agent/apply-direction") {
        const body = JSON.parse(await readBody(req)) as { plan?: unknown };
        return await withCurrentProject(() => {
          const plan = parsePlan(body.plan, { project: store.project });
          const outcome = store.apply(planToCommands(store.project, plan), "agent");
          if (!outcome.ok) {
            return sendJson(res, 422, JSON.stringify({ ok: false, errors: outcome.errors }));
          }
          rebuild();
          return sendJson(res, 200, stateJson());
        });
      }

      if (route === "POST /api/agent/tweak") {
        const body = JSON.parse(await readBody(req)) as {
          text?: string;
          sceneId?: string;
          layerId?: string;
          provider?: string;
          apiKey?: string;
          model?: string;
        };
        const text = body.text?.trim();
        if (!text) return badRequest(res, "text", "tweak is empty");
        if (body.provider && !(body.provider in PROVIDERS)) {
          return badRequest(res, "provider", `unknown agent provider: ${body.provider}`);
        }
        const snapshot = await withCurrentProject(() => store.project);
        const providerId = (body.provider as ProviderId | undefined) ?? (await defaultProvider());
        const result = await requestTweak(
          providerId,
          text,
          snapshot,
          { sceneId: body.sceneId, layerId: body.layerId },
          {
            ...(body.apiKey ? { apiKey: body.apiKey } : {}),
            ...(body.model?.trim() ? { model: body.model.trim() } : {}),
          },
        );
        return await withCurrentProject(() => {
          const command: Command =
            result.commands.length === 1
              ? result.commands[0]!
              : { type: "Batch", commands: result.commands };
          const outcome = store.apply(command, result.mode === "zero-token" ? "user" : "agent");
          if (!outcome.ok) {
            return sendJson(res, 422, JSON.stringify({ ok: false, errors: outcome.errors }));
          }
          rebuild();
          return sendJson(
            res,
            200,
            JSON.stringify({ ...JSON.parse(stateJson()), tweak: result }),
          );
        });
      }

      if (route === "POST /api/thumbs") {
        if (state.thumbs.status === "generating") {
          return sendJson(res, 202, JSON.stringify(state.thumbs));
        }
        const thumbsContext = await withCurrentProject(() => ({
          projectDir: dir,
          projectStore: store,
          project: store.project,
        }));
        state.thumbs = { ...state.thumbs, status: "generating" };
        const thumbsDir = thumbsContext.projectDir;
        const thumbsStore = thumbsContext.projectStore;
        void generateSceneThumbnails(thumbsDir, thumbsContext.project)
          .then((result) => {
            if (thumbsDir !== dir || thumbsStore !== store) return;
            state.thumbs = {
              status: "complete",
              files: Object.fromEntries(
                Object.entries(result.files).map(([id, rel]) => [id, `/build/${rel}`]),
              ),
              version: state.thumbs.version + 1,
            };
          })
          .catch((error) => {
            if (thumbsDir !== dir || thumbsStore !== store) return;
            state.thumbs = {
              ...state.thumbs,
              status: "failed",
              error: error instanceof Error ? error.message : String(error),
            };
          });
        return sendJson(res, 202, JSON.stringify(state.thumbs));
      }

      // Live extension previews: a compiled-on-demand HF composition per
      // registry entry, served sibling to the vendor scripts so the doc's
      // relative <script src> tags resolve. NOT pre-rendered — real GSAP.
      if (req.method === "GET" && url.pathname.startsWith("/ext-preview/")) {
        const rest = url.pathname.slice("/ext-preview/".length);
        const vendors = vendorFiles();
        if (Object.prototype.hasOwnProperty.call(vendors, rest)) {
          return sendFile(res, vendors[rest]!);
        }
        if (!rest.endsWith(".html")) {
          res.writeHead(404);
          return res.end("not found");
        }
        const id = decodeURIComponent(rest.slice(0, -".html".length));
        const type = url.searchParams.get("type") as ExtensionPreviewType | null;
        if (!type || !EXT_PREVIEW_TYPES.has(type)) {
          res.writeHead(400);
          return res.end("bad extension preview type");
        }
        let html: string;
        try {
          html = extensionPreviewHtml(type, id);
        } catch {
          res.writeHead(404);
          return res.end("unknown extension");
        }
        res.writeHead(200, {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store",
          "x-content-type-options": "nosniff",
        });
        return res.end(html);
      }

      if (req.method === "GET" && url.pathname.startsWith("/build/")) {
        const rel = url.pathname.slice("/build/".length);
        const file = safeChildPath(path.join(dir, "build"), rel);
        if (!file) {
          res.writeHead(403);
          return res.end("forbidden");
        }
        return sendFile(res, file);
      }

      if (req.method === "GET" && url.pathname.startsWith("/renders/")) {
        const rel = decodeURIComponent(url.pathname.slice("/renders/".length));
        const file = safeChildPath(path.join(dir, "renders"), rel);
        if (!file) {
          res.writeHead(403);
          return res.end("forbidden");
        }
        return sendMedia(req, res, file);
      }

      // Project media pool files (pool thumbnails/previews, any subfolder).
      if (req.method === "GET" && url.pathname.startsWith("/assets/")) {
        const rel = decodeURIComponent(url.pathname.slice("/assets/".length));
        const file = safeChildPath(path.join(dir, "assets"), rel);
        if (!file) {
          res.writeHead(403);
          return res.end("forbidden");
        }
        return sendMedia(req, res, file);
      }

      res.writeHead(404);
      res.end("not found");
    } catch (err) {
      const status =
        typeof (err as { statusCode?: unknown })?.statusCode === "number"
          ? (err as { statusCode: number }).statusCode
          : 500;
      sendJson(
        res,
        status,
        JSON.stringify({ ok: false, errors: [{ path: "", message: String(err) }] }),
      );
    }
  });

  server.listen(port, "127.0.0.1", () => {
    const address = server.address();
    const listeningPort = typeof address === "object" && address ? address.port : port;
    console.log(`Sequences studio-lite`);
    console.log(`  project:  ${dir}`);
    console.log(`  studio:   http://localhost:${listeningPort}/`);
    console.log(`  preview:  http://localhost:${listeningPort}/build/index.html`);
  });
  return server;
}
