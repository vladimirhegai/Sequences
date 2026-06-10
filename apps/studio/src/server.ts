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
import { fileURLToPath } from "node:url";
import {
  applyAutoFixes,
  ARCHETYPES,
  CAMERA_MOVES,
  CommandSchema,
  DURATION_TOKEN_IDS,
  lintProject,
  PRIMITIVES,
  PROFILES,
  promptCatalog,
  ProjectStore,
  SCALE_TOKEN_IDS,
  STAGGER_TOKEN_IDS,
  type Command,
  type EventEntry,
  type Finding,
  type Manifest,
} from "@sequences/core";
import { appendEvent, buildProject, loadProject, saveProject, vendorFiles } from "./projectIo.ts";
import { renderProject, type RenderFormat, type RenderQuality } from "./render.ts";
import { detectProviders, defaultProvider, type ProviderId } from "./agentConfig.ts";
import { runPlan } from "./agent/planRunner.ts";
import { extractRenderPoster, generateSceneThumbnails } from "./thumbs.ts";

const STATIC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "static");

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
};

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
  buildVersion: number;
  recentEvents: EventEntry[];
  render: StudioRenderState;
  agent: StudioAgentState;
  thumbs: StudioThumbsState;
}

export function startStudio(projectDir: string, port: number): http.Server {
  const dir = path.resolve(projectDir);
  const project = loadProject(dir);

  const state = {} as StudioState;
  const store = new ProjectStore(project, (entry) => {
    appendEvent(dir, entry);
    state.recentEvents.push(entry);
    if (state.recentEvents.length > 50) state.recentEvents.shift();
  });
  state.store = store;
  state.recentEvents = [];
  state.buildVersion = 0;
  state.render = { status: "idle" };
  state.agent = { status: "idle" };
  state.thumbs = { status: "idle", files: {}, version: 0 };

  const rebuild = () => {
    saveProject(dir, store.project);
    const result = buildProject(dir, store.project);
    state.manifest = result.manifest;
    state.findings = lintProject(store.project);
    state.buildVersion += 1;
  };
  rebuild();

  const stateJson = () =>
    JSON.stringify({
      project: store.project,
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
    });

  const metaJson = async () =>
    JSON.stringify({
      archetypes: Object.values(ARCHETYPES).map((a) => ({
        id: a.id,
        summary: a.summary,
        slots: a.slots,
        layouts: a.layouts,
        defaultLayout: a.defaultLayout,
        duration: a.duration,
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
      transitions: ["cut", "fade"],
      promptCatalog: promptCatalog(),
      agentProviders: await detectProviders(),
      defaultAgentProvider: await defaultProvider(),
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
    res.writeHead(200, {
      "content-type": MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream",
      "cache-control": "no-store",
    });
    res.end(fs.readFileSync(file));
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
      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
        if (body.length > 2_000_000) reject(new Error("body too large"));
      });
      req.on("end", () => resolve(body));
      req.on("error", reject);
    });

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const route = `${req.method} ${url.pathname}`;
    try {
      if (route === "GET /") return sendFile(res, path.join(STATIC_DIR, "index.html"));
      if (route === "GET /app.js") return sendFile(res, path.join(STATIC_DIR, "app.js"));
      if (route === "GET /styles.css") return sendFile(res, path.join(STATIC_DIR, "styles.css"));
      if (route === "GET /vendor/hyperframes-player.global.js") {
        return sendFile(res, vendorFiles()["hyperframes-player.global.js"]!);
      }
      if (route === "GET /api/state") return sendJson(res, 200, stateJson());
      if (route === "GET /api/meta") return sendJson(res, 200, await metaJson());
      if (route === "GET /api/render") return sendJson(res, 200, renderJson());
      if (route === "GET /api/agent") return sendJson(res, 200, JSON.stringify(state.agent));
      if (route === "GET /api/thumbs") return sendJson(res, 200, JSON.stringify(state.thumbs));

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
        const outcome = store.apply(body.command as Command, body.source ?? "user");
        if (!outcome.ok) {
          return sendJson(res, 422, JSON.stringify({ ok: false, errors: outcome.errors }));
        }
        rebuild();
        return sendJson(res, 200, stateJson());
      }

      if (route === "POST /api/undo" || route === "POST /api/redo") {
        const moved = route.endsWith("undo") ? store.undo() : store.redo();
        if (moved) rebuild();
        return sendJson(res, 200, stateJson());
      }

      if (route === "POST /api/autofix") {
        const result = applyAutoFixes(store);
        if (result.applied.length > 0) rebuild();
        return sendJson(res, 200, stateJson());
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
        state.render = {
          status: "rendering",
          startedAt: new Date().toISOString(),
          format,
          quality,
        };
        void renderProject(dir, store.project, { format, quality, workers, quiet: true })
          .then(async (result) => {
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
              startedAt: state.render.startedAt,
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
            state.render = {
              status: "failed",
              startedAt: state.render.startedAt,
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
        };
        const brief = (body.brief ?? "").trim();
        if (!brief) {
          return sendJson(
            res,
            400,
            JSON.stringify({ ok: false, errors: [{ path: "brief", message: "brief is empty" }] }),
          );
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
        state.agent = {
          status: "planning",
          provider: providerId,
          startedAt: new Date().toISOString(),
        };
        // apiKey is used for this request only — never persisted anywhere.
        void runPlan(providerId, brief, store, body.apiKey ? { apiKey: body.apiKey } : {})
          .then((result) => {
            rebuild();
            state.agent = {
              status: "complete",
              provider: providerId,
              startedAt: state.agent.startedAt,
              completedAt: new Date().toISOString(),
              summary: `${result.plan.scenes.length} scenes, profile ${result.plan.motionProfile}`,
            };
          })
          .catch((error) => {
            state.agent = {
              status: "failed",
              provider: providerId,
              startedAt: state.agent.startedAt,
              completedAt: new Date().toISOString(),
              error: error instanceof Error ? error.message : String(error),
            };
          });
        return sendJson(res, 202, JSON.stringify(state.agent));
      }

      if (route === "POST /api/thumbs") {
        if (state.thumbs.status === "generating") {
          return sendJson(res, 202, JSON.stringify(state.thumbs));
        }
        state.thumbs = { ...state.thumbs, status: "generating" };
        void generateSceneThumbnails(dir, store.project)
          .then((result) => {
            state.thumbs = {
              status: "complete",
              files: Object.fromEntries(
                Object.entries(result.files).map(([id, rel]) => [id, `/build/${rel}`]),
              ),
              version: state.thumbs.version + 1,
            };
          })
          .catch((error) => {
            state.thumbs = {
              ...state.thumbs,
              status: "failed",
              error: error instanceof Error ? error.message : String(error),
            };
          });
        return sendJson(res, 202, JSON.stringify(state.thumbs));
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
        return sendFile(res, file);
      }

      res.writeHead(404);
      res.end("not found");
    } catch (err) {
      sendJson(
        res,
        500,
        JSON.stringify({ ok: false, errors: [{ path: "", message: String(err) }] }),
      );
    }
  });

  server.listen(port, "127.0.0.1", () => {
    console.log(`Sequences studio-lite`);
    console.log(`  project:  ${dir}`);
    console.log(`  studio:   http://localhost:${port}/`);
    console.log(`  preview:  http://localhost:${port}/build/index.html`);
  });
  return server;
}
