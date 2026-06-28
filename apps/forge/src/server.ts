/**
 * Forge server. Plain node:http, same-origin localhost — mirrors the Sequences
 * server's proven pattern (no bundler; Tauri-wrap is a later concern, FORGE.md
 * §13).
 *
 * Two surfaces:
 *   - Library: every `.seqext` bundle installed into the live registry on boot,
 *     so the UNCHANGED compiler/solver/preview path drives a real HyperFrames
 *     player preview of an authored extension. Validate / install / export.
 *   - Stage (P2): a live Forge Document — a single-scene Project in a real
 *     ProjectStore. Direct manipulation is typed commands through the one
 *     mutation pathway (law 1); the stage is `compile()` output. Add objects,
 *     drag (MoveLayer), restyle, import media, undo/redo, and export the staged
 *     example media as standardized Media Slots.
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import {
  compile,
  extensionPreviewProject,
  installBundle,
  uninstallBundlePrimitive,
  validateBundle,
  CommandSchema,
  COLOR_TOKEN_IDS,
  PRIMITIVES,
  extractJsonObject,
  type Command,
} from "@sequences/core";
import {
  detectProviders,
  defaultProvider,
  PROVIDERS,
  type ProviderId,
  type CompleteOptions,
} from "@sequences/platform/providers";
import { vendorFiles } from "@sequences/platform/vendors";
import {
  fsRoots,
  listDisk,
  mediaKind,
  placeAsset,
} from "@sequences/platform/media";
import { listBundles, readBundle, writeBundle, type BundleEntry } from "./bundleIo.ts";
import { ForgeDocument } from "./document.ts";
import { importMediaFromBytes, importMediaFromPath } from "./media.ts";
import { exportDocument, type ExportOptions } from "./export.ts";
import { liftGsapSource } from "./lift.ts";
import { deleteForgeObject, moveForgeObjectToFolder, readObjectLibrary, upsertForgeObject, writeObjectLibrary } from "./objects.ts";
import { addDoc, deleteDoc, readDocIndex, readDocText } from "./docs.ts";
import { saveScratchImage } from "./scratch.ts";
import { runStageChat, type StageReference } from "./stageRunner.ts";
import type { StageAssetSource } from "./stagePrompt.ts";
import {
  bundleNameFromDraft,
  currentCreateDraft,
  deleteCreateDraft,
  listCreateDrafts,
  normalizeStageRequest,
  setCurrentCreateDraft,
  upsertCreateDraft,
  type CreateStageRequest,
  type ForgeExtensionDraft,
} from "./createDraft.ts";
import { liftAndBundleCreateDraft, runCreateChat, type CreateReference } from "./createRunner.ts";
import { runForgePlan, type ForgeDesignPlan } from "./planRunner.ts";

const STATIC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "static");
const KNOWLEDGE_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "knowledge");
const require = createRequire(import.meta.url);

/**
 * Forge-local preview vendors resolved from node_modules (served beside the
 * studio vendors). The shadcn theme + cn helper live as physical files under
 * static/vendor/ and are served by the generic static handler.
 */
function forgeVendorFiles(): Record<string, string> {
  try {
    return { "tailwindcss-browser.js": require.resolve("@tailwindcss/browser") };
  } catch {
    return {};
  }
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
};

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(text);
}

function sendHtml(res: http.ServerResponse, html: string): void {
  res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
  res.end(html);
}

function sendFile(res: http.ServerResponse, file: string): void {
  if (!fs.existsSync(file)) {
    res.writeHead(404);
    res.end("not found");
    return;
  }
  // no-store: this is a local dev tool whose static files change between runs;
  // never let the browser serve a stale app.js/styles.css against a new server.
  // access-control: sandboxed srcdoc previews have origin "null"; Tailwind/shadcn
  // bootstrapping needs to fetch local vendor CSS from that sandbox.
  res.writeHead(200, {
    "content-type": MIME[path.extname(file)] ?? "application/octet-stream",
    "cache-control": "no-store",
    "access-control-allow-origin": "*",
  });
  fs.createReadStream(file).pipe(res);
}

function sendMedia(req: http.IncomingMessage, res: http.ServerResponse, file: string): void {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404);
    res.end("not found");
    return;
  }
  const size = fs.statSync(file).size;
  const type = MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream";
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? "");
  if (range && (range[1] || range[2])) {
    const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start >= size || start > end) {
      res.writeHead(416, { "content-range": `bytes */${size}` });
      res.end();
      return;
    }
    res.writeHead(206, {
      "content-type": type,
      "content-range": `bytes ${start}-${end}/${size}`,
      "content-length": end - start + 1,
      "accept-ranges": "bytes",
      "cache-control": "no-store",
    });
    fs.createReadStream(file, { start, end }).pipe(res);
    return;
  }
  res.writeHead(200, {
    "content-type": type,
    "content-length": size,
    "accept-ranges": "bytes",
    "cache-control": "no-store",
  });
  fs.createReadStream(file).pipe(res);
}

async function readBody(req: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function readBinaryBody(req: http.IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

function safeChildPath(root: string, rel: string): string | null {
  const rootPath = path.resolve(root);
  const file = path.resolve(rootPath, path.normalize(rel));
  if (file !== rootPath && !file.startsWith(rootPath + path.sep)) return null;
  return file;
}

function slug(input: string): string {
  return (
    input
      .trim()
      .replace(/([a-z])([A-Z])/g, "$1-$2")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "component"
  );
}

function forgeCopilotPrompt(input: {
  message: string;
  source?: string;
  outline: ReturnType<ForgeDocument["outline"]>;
  bundles: BundleEntry[];
  mode?: "motion" | "object";
  objects?: ReturnType<typeof readObjectLibrary>;
}): string {
  if (input.mode === "object") {
    return [
      "You are the Forge Component copilot. Create editable HTML/CSS/JS Components for Sequences Forge.",
      "Return JSON only with this shape: {\"reply\":\"short explanation\",\"object\":{\"name\":\"Component name\",\"html\":\"...\",\"css\":\"...\",\"js\":\"...\"}}.",
      "The object must be self-contained. Do not use external network assets.",
      "Name editable sub-parts with data-forge-component=\"componentName\".",
      "Expose inspector knobs only with comments like @forge-var accent type=color default=#27d9a1 label=\"Accent\".",
      "Supported variable types: string, number, color, boolean.",
      "For number knobs used as pixel units, write CSS like calc(var(--radius) * 1px).",
      "If media context is present, you may reference the provided href/path values in the HTML or CSS.",
      "Prefer clean semantic HTML, CSS custom properties, and small JS for interactions. Keep it understandable.",
      `User request: ${input.message}`,
      `Current object source:\n${input.source?.trim() || "(none)"}`,
      `Library objects:\n${JSON.stringify(
        (input.objects ?? []).map((object) => ({
          id: object.id,
          name: object.name,
          components: object.components,
          variables: object.variables.map((v) => v.name),
        })),
        null,
        2,
      )}`,
    ].join("\n\n");
  }
  const layers = input.outline.layers.map((layer) => ({
    id: layer.id,
    kind: layer.kind,
    role: layer.role,
    box: layer.box,
    enter: layer.enter?.primitive,
  }));
  const library = input.bundles.map((entry) => ({
    id: entry.bundle.manifest.id,
    summary: entry.bundle.manifest.summary,
    knobs: entry.bundle.spec.knobs.map((k) => k.name),
  }));
  return [
    "You are the Forge copilot for Sequences motion-extension authoring.",
    "Stay inside the Forge pipeline. Write GSAP for a single timeline named tl, then make it liftable.",
    "Use only tl.fromTo(target, fromVars, toVars, position?), tl.to(target, vars, position?), tl.from(target, vars, position?), or tl.set(target, vars, position?).",
    "Use target variable inner for layer transforms, or container for container-level transforms. Vars must be object literals with literal numbers, booleans, or strings.",
    "Return JSON only with this shape: {\"reply\":\"short explanation\",\"gsap\":\"liftable GSAP code\",\"summary\":\"20+ char extension brief\",\"id\":\"enter.camelCaseName\"}.",
    `User request: ${input.message}`,
    `Current authored source:\n${input.source?.trim() || "(none)"}`,
    `Stage layers:\n${JSON.stringify(layers, null, 2)}`,
    `Installed motion library:\n${JSON.stringify(library, null, 2)}`,
  ].join("\n\n");
}

function jsonObjectFromText(raw: string): Record<string, unknown> | null {
  try {
    const parsed = extractJsonObject(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

type StageThinkingMode = "auto" | "enabled" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";

interface StageChatBody {
  message?: string;
  references?: StageReference[];
  current?: StageAssetSource | null;
  aspect?: string;
  provider?: string;
  apiKey?: string;
  model?: string;
  thinkingMode?: StageThinkingMode;
  plan?: ForgeDesignPlan;
}

interface CreateChatBody {
  message?: string;
  references?: CreateReference[];
  aspect?: string;
  currentDraftId?: string | null;
  provider?: string;
  apiKey?: string;
  model?: string;
  thinkingMode?: StageThinkingMode;
  plan?: ForgeDesignPlan;
}

interface PlanChatBody extends StreamTurnBody {
  surface?: "stage" | "create";
  message?: string;
  context?: unknown;
  previousPlan?: ForgeDesignPlan | null;
}

interface CreateStageCallBody {
  request?: unknown;
  references?: StageReference[];
  provider?: string;
  apiKey?: string;
  model?: string;
  thinkingMode?: StageThinkingMode;
}

function sendSseHeaders(res: http.ServerResponse): void {
  res.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-store, no-transform",
    connection: "keep-alive",
    "x-accel-buffering": "no",
  });
}

function writeSse(res: http.ServerResponse, event: string, data: unknown): void {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function partialJsonString(raw: string, key: string): string {
  const m = new RegExp(`"${key}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)`).exec(raw);
  if (!m) return "";
  try {
    return JSON.parse(`"${m[1]}"`);
  } catch {
    return m[1] ?? "";
  }
}

interface StreamTurnBody {
  provider?: string;
  apiKey?: string;
  model?: string;
  thinkingMode?: StageThinkingMode;
}

function withApprovedPlan(message: string, plan: ForgeDesignPlan | undefined): string {
  if (!plan) return message;
  const compact = {
    summary: plan.summary,
    direction: plan.direction,
    palette: plan.palette,
    typography: plan.typography,
    composition: plan.composition,
    components: plan.components,
    motion: plan.motion,
    actions: plan.actions,
  };
  return [
    message,
    "",
    "APPROVED FORGE PLAN (use as design intent; preserve user changes in the message above):",
    JSON.stringify(compact),
  ].join("\n");
}

/**
 * Shared SSE plumbing for a streaming agent turn (Stage + Create). It surfaces
 * the provider's live reasoning as `thinking` progress events and partial output
 * as `output` progress, then writes the final validated `result`. The runner is
 * the same validated path as the non-streaming route — only transport differs.
 */
async function streamProviderTurn(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  body: StreamTurnBody,
  run: (ctx: {
    providerId: ProviderId;
    inlineMediaBytes: boolean;
    complete: (prompt: string, options?: CompleteOptions) => Promise<string>;
    completeOptions: CompleteOptions;
  }) => Promise<unknown>,
): Promise<void> {
  sendSseHeaders(res);
  let closed = false;
  const turnAbort = new AbortController();
  const abortTurn = (): void => {
    closed = true;
    if (!turnAbort.signal.aborted) turnAbort.abort(new Error("execution stopped"));
  };
  req.on("aborted", () => {
    abortTurn();
  });
  res.on("close", () => {
    if (!res.writableEnded) abortTurn();
  });
  const safeWrite = (event: string, data: unknown): void => {
    if (!closed && !res.writableEnded) writeSse(res, event, data);
  };

  if (body.provider && !(body.provider in PROVIDERS)) {
    safeWrite("result", { ok: false, errors: [`unknown provider: ${body.provider}`] });
    return void res.end();
  }
  const providerId = (body.provider as ProviderId | undefined) ?? (await defaultProvider());
  if (!providerId) {
    safeWrite("result", {
      ok: false,
      errors: ["no agent provider available - sign into a local CLI or configure DeepSeek/OpenModel"],
    });
    return void res.end();
  }
  const provider = PROVIDERS[providerId]!;
  const inlineMediaBytes = provider.kind === "api";

  let bytes = 0;
  let streamed = "";
  let lastOutputAt = 0;
  const onOutput = (chunk: string): void => {
    bytes += chunk.length;
    streamed = (streamed + chunk).slice(-12000);
    const now = Date.now();
    if (now - lastOutputAt < 180) return;
    lastOutputAt = now;
    safeWrite("progress", {
      provider: providerId,
      phase: "output",
      bytes,
      reply: partialJsonString(streamed, "reply").slice(0, 240),
    });
  };
  let thinking = "";
  let lastThinkingAt = 0;
  const onThinking = (chunk: string): void => {
    thinking = (thinking + chunk).slice(-6000);
    const now = Date.now();
    if (now - lastThinkingAt < 150) return;
    lastThinkingAt = now;
    safeWrite("progress", { provider: providerId, phase: "thinking", bytes, thinking: thinking.slice(-700) });
  };

  safeWrite("progress", {
    provider: providerId,
    bytes: 0,
    message: provider.streamComplete
      ? "connected"
      : providerId === "antigravity-cli"
        ? "Antigravity is starting"
        : "provider is working",
    streaming: Boolean(provider.streamComplete),
  });

  const startedAt = Date.now();
  const heartbeat =
    providerId === "antigravity-cli"
      ? setInterval(() => {
          safeWrite("progress", {
            provider: providerId,
            bytes: 0,
            message: `Antigravity is working (${Math.round((Date.now() - startedAt) / 1000)}s)`,
            streaming: false,
          });
        }, 5_000)
      : undefined;

  try {
    const completeOptions: CompleteOptions = {
      signal: turnAbort.signal,
      ...(body.apiKey ? { apiKey: body.apiKey } : {}),
      ...(body.model?.trim() ? { model: body.model.trim() } : {}),
      ...(body.thinkingMode && body.thinkingMode !== "auto" ? { thinkingMode: body.thinkingMode } : {}),
    };
    const complete = (prompt: string, options?: CompleteOptions): Promise<string> =>
      provider.streamComplete
        ? provider.streamComplete(prompt, options, onOutput, onThinking)
        : provider.complete(prompt, options);
    const result = await run({ providerId, inlineMediaBytes, complete, completeOptions });
    safeWrite("result", { ...(result as Record<string, unknown>), provider: providerId });
  } catch (err) {
    if (!turnAbort.signal.aborted) {
      safeWrite("result", { ok: false, errors: [String((err as Error).message)] });
    }
  } finally {
    if (heartbeat) clearInterval(heartbeat);
  }
  res.end();
}

function stageToolMessage(request: CreateStageRequest): string {
  return [
    "Forge Create requested a bounded Stage asset. Build only the editable visual material; do not author final cinematic timing.",
    "",
    `Asset brief: ${request.brief}`,
    `Required aspect: ${request.aspect ?? "use the Create draft aspect"}`,
    request.reason ? `Why Create needs it: ${request.reason}` : "",
    request.styleHints ? `Style hints: ${request.styleHints}` : "",
    request.requiredParts?.length ? `Required named parts: ${request.requiredParts.join(", ")}` : "",
    request.requiredActions?.length ? `Required actions: ${request.requiredActions.join(", ")}` : "",
    request.requiredKnobs?.length ? `Required knobs: ${request.requiredKnobs.join(", ")}` : "",
    "",
    "The returned asset must be self-contained, polished SaaS UI, and annotated with the Forge contract.",
    "Mark every required part with data-forge-component. Declare required actions with @forge-action + data-forge-action.",
    "Expose required knobs with @forge-var comments. Keep layout stable and Create/Hyperframes-ready.",
  ].filter(Boolean).join("\n");
}

function draftBundleSummary(draft: ForgeExtensionDraft): Record<string, unknown> {
  return {
    id: draft.id,
    bundleId: bundleNameFromDraft(draft),
    name: draft.name,
    summary: draft.summary,
    route: draft.route,
    primitiveKind: draft.primitiveKind,
    aspect: draft.aspect,
    aspectLocked: draft.aspectLocked,
    durationSec: draft.durationSec,
    components: draft.components,
    media: draft.media,
    taxonomy: draft.taxonomy,
    validation: draft.validation,
    updatedAt: draft.updatedAt,
  };
}

/** A compact, planner-facing view of a bundle for the gallery + inspector. */
function bundleSummary(entry: BundleEntry): Record<string, unknown> {
  const { manifest, spec } = entry.bundle;
  return {
    id: manifest.id,
    version: manifest.version,
    summary: manifest.summary,
    tags: manifest.tags,
    source: manifest.source,
    primitiveKind: spec.primitiveKind,
    defaults: spec.defaults,
    knobs: spec.knobs,
    slots: spec.slots,
    relationships: spec.relationships,
    guardrails: spec.guardrails,
    tokens: spec.tokens,
    steps: spec.skeleton.length,
    dir: entry.dir,
  };
}

export interface ForgeOptions {
  /** Root folder of `*.seqext` bundles (the local library). */
  extensionsDir: string;
  /** Working dir for the live Document's imported media (assets/). */
  docDir?: string;
  port?: number;
}

export function startForge(options: ForgeOptions): http.Server {
  const extensionsDir = path.resolve(options.extensionsDir);
  const docDir = path.resolve(options.docDir ?? path.join(extensionsDir, "..", "workspace"));

  // Install every bundle on boot so previews render through the real engine.
  const installed = new Map<string, BundleEntry>();
  function refreshInstalls(): { id: string; ok: boolean; errors: string[] }[] {
    const report: { id: string; ok: boolean; errors: string[] }[] = [];
    for (const entry of listBundles(extensionsDir)) {
      const v = validateBundle(entry.bundle);
      if (v.ok) {
        installBundle(entry.bundle);
        installed.set(entry.bundle.manifest.id, entry);
      }
      report.push({ id: entry.bundle.manifest.id, ok: v.ok, errors: v.errors });
    }
    return report;
  }
  const bootReport = refreshInstalls();

  // The live Forge Document (the staging canvas).
  let doc = ForgeDocument.createBlank(docDir);

  const previewCache = new Map<string, string>();
  function previewHtml(id: string): string {
    const cached = previewCache.get(id);
    if (cached) return cached;
    const html = compile(extensionPreviewProject("primitive", id)).html;
    previewCache.set(id, html);
    return html;
  }

  /** Serve a HyperFrames vendor script if `rest` names one; else false. */
  function serveVendor(res: http.ServerResponse, rest: string): boolean {
    const vendors = vendorFiles();
    if (Object.prototype.hasOwnProperty.call(vendors, rest)) {
      sendFile(res, vendors[rest]!);
      return true;
    }
    return false;
  }

  const server = http.createServer((req, res) => {
    void (async () => {
      try {
        const url = new URL(req.url ?? "/", "http://localhost");
        const route = `${req.method} ${url.pathname}`;

        if (route === "GET /") return sendFile(res, path.join(STATIC_DIR, "index.html"));
        if (route === "GET /favicon.ico") {
          res.writeHead(204, { "cache-control": "no-store" });
          return res.end();
        }

        if (req.method === "GET" && url.pathname.startsWith("/static/")) {
          let rel: string;
          try {
            rel = decodeURIComponent(url.pathname.slice("/static/".length));
          } catch {
            res.writeHead(400);
            return res.end("bad path");
          }
          if (rel.startsWith("vendor/")) {
            const vendorName = rel.slice("vendor/".length);
            if (serveVendor(res, vendorName)) return;
            const forgeVendor = forgeVendorFiles()[vendorName];
            if (forgeVendor) return sendFile(res, forgeVendor);
            // else fall through: physical static vendors (shadcn-theme.css, forge-cn.js)
          }
          const file = safeChildPath(STATIC_DIR, rel);
          if (!file) {
            res.writeHead(403);
            return res.end("forbidden");
          }
          return sendFile(res, file);
        }

        /* ---------------- library (installed bundles) ---------------- */

        if (route === "GET /api/bundles") {
          const list = listBundles(extensionsDir).map(bundleSummary);
          return sendJson(res, 200, { bundles: list, boot: bootReport });
        }

        if (route === "POST /api/validate") {
          const body = await readBody(req);
          return sendJson(res, 200, validateBundle(body));
        }

        if (route === "POST /api/install") {
          const body = (await readBody(req)) as { dir?: string };
          if (!body.dir) return sendJson(res, 400, { ok: false, errors: ["missing dir"] });
          try {
            const bundle = readBundle(path.resolve(body.dir));
            const v = validateBundle(bundle);
            if (!v.ok) return sendJson(res, 200, v);
            installBundle(bundle);
            installed.set(bundle.manifest.id, { id: bundle.manifest.id, dir: body.dir, bundle });
            previewCache.delete(bundle.manifest.id);
            return sendJson(res, 200, { ok: true, errors: [], id: bundle.manifest.id });
          } catch (err) {
            return sendJson(res, 200, { ok: false, errors: [String((err as Error).message)] });
          }
        }

        // Live bundle preview (compiled on demand through the real engine).
        if (req.method === "GET" && url.pathname.startsWith("/forge-preview/")) {
          const rest = url.pathname.slice("/forge-preview/".length);
          if (serveVendor(res, rest)) return;
          if (!rest.endsWith(".html")) {
            res.writeHead(404);
            return res.end("not found");
          }
          const id = decodeURIComponent(rest.slice(0, -".html".length));
          try {
            return sendHtml(res, previewHtml(id));
          } catch {
            res.writeHead(404);
            return res.end("unknown extension");
          }
        }

        /* ---------------- stage (the live Document) ---------------- */

        if (route === "GET /api/doc") {
          return sendJson(res, 200, doc.outline());
        }

        // Real token / primitive ids for the inspector selects (never guessed).
        if (route === "GET /api/tokens") {
          return sendJson(res, 200, {
            colorTokens: COLOR_TOKEN_IDS,
            typeTokens: ["mega", "display", "headline", "title", "body", "caption"],
            enterPrimitives: Object.values(PRIMITIVES)
              .filter((p) => p.kind === "enter")
              .map((p) => p.id)
              .sort(),
            cameraMoves: ["pushIn", "pullBack"],
            cameraScales: ["subtle", "pop", "hero"],
          });
        }

        // The stage itself: compiled Document HTML + sibling vendor scripts.
        if (req.method === "GET" && url.pathname.startsWith("/forge-doc/")) {
          const rest = url.pathname.slice("/forge-doc/".length);
          if (serveVendor(res, rest)) return;
          if (rest === "stage.html") return sendHtml(res, doc.html());
          res.writeHead(404);
          return res.end("not found");
        }

        if (req.method === "GET" && url.pathname.startsWith("/forge-assets/")) {
          const rel = decodeURIComponent(url.pathname.slice("/forge-assets/".length));
          const file = safeChildPath(doc.dir, rel);
          if (!file) {
            res.writeHead(403);
            return res.end("forbidden");
          }
          return sendMedia(req, res, file);
        }

        if (route === "POST /api/doc/reset") {
          doc = ForgeDocument.createBlank(docDir);
          return sendJson(res, 200, doc.outline());
        }

        if (route === "POST /api/doc/command") {
          const body = (await readBody(req)) as { command?: unknown };
          const parsed = CommandSchema.safeParse(body.command);
          if (!parsed.success) {
            return sendJson(res, 400, { ok: false, errors: parsed.error.issues.map((i) => i.message) });
          }
          const outcome = doc.apply(parsed.data as Command);
          if (!outcome.ok) {
            return sendJson(res, 200, {
              ok: false,
              errors: outcome.errors.map((e) => `${e.path}: ${e.message}`),
              outline: doc.outline(),
            });
          }
          return sendJson(res, 200, { ok: true, outline: doc.outline() });
        }

        if (route === "POST /api/doc/add") {
          const body = (await readBody(req)) as Parameters<ForgeDocument["addObject"]>[0];
          const result = doc.addObject(body);
          if (!result.ok) {
            return sendJson(res, 200, {
              ok: false,
              errors: result.outcome.ok ? [] : result.outcome.errors.map((e) => `${e.path}: ${e.message}`),
              outline: doc.outline(),
            });
          }
          return sendJson(res, 200, { ok: true, id: result.id, outline: doc.outline() });
        }

        if (route === "POST /api/doc/undo") {
          doc.undo();
          return sendJson(res, 200, doc.outline());
        }
        if (route === "POST /api/doc/redo") {
          doc.redo();
          return sendJson(res, 200, doc.outline());
        }

        if (route === "POST /api/doc/import") {
          const body = (await readBody(req)) as { path?: string; reference?: boolean };
          if (!body.path) return sendJson(res, 400, { ok: false, errors: ["missing path"] });
          const result = importMediaFromPath(doc, path.resolve(body.path), { reference: body.reference });
          return sendJson(res, 200, { ...result, outline: doc.outline() });
        }

        if (route === "POST /api/doc/import-bytes") {
          const body = (await readBody(req)) as {
            fileName?: string;
            base64?: string;
            reference?: boolean;
          };
          if (!body.fileName || !body.base64) {
            return sendJson(res, 400, { ok: false, errors: ["missing fileName or base64"] });
          }
          const bytes = Buffer.from(body.base64, "base64");
          const result = importMediaFromBytes(doc, body.fileName, bytes, { reference: body.reference });
          return sendJson(res, 200, { ...result, outline: doc.outline() });
        }

        /* ---------------- Stage AI (the asset-building agent) ---------------- */

        // Planning is deliberately a separate, cheap turn. The UI may use a
        // different provider/model here, then pass the approved plan to Stage or
        // Create's implementation turn.
        if (route === "POST /api/plan/chat/stream") {
          const body = (await readBody(req)) as PlanChatBody;
          const message = body.message?.trim();
          if (!message) {
            sendSseHeaders(res);
            writeSse(res, "result", { ok: false, errors: ["message is empty"] });
            return res.end();
          }
          if (body.surface !== "stage" && body.surface !== "create") {
            sendSseHeaders(res);
            writeSse(res, "result", { ok: false, errors: ["surface must be stage or create"] });
            return res.end();
          }
          await streamProviderTurn(req, res, body, ({ complete, completeOptions }) =>
            runForgePlan({
              surface: body.surface!,
              message,
              context: body.context,
              previousPlan: body.previousPlan ?? null,
              complete,
              completeOptions,
            }),
          );
          return;
        }

        // Streaming Stage turn: same validated runner, but the provider's live
        // reasoning + partial output are surfaced as SSE progress so the UI is
        // not a silent spinner.
        if (route === "POST /api/stage/chat/stream") {
          const body = (await readBody(req)) as StageChatBody;
          const message = body.message?.trim();
          if (!message) {
            sendSseHeaders(res);
            writeSse(res, "result", { ok: false, errors: ["message is empty"] });
            return res.end();
          }
          await streamProviderTurn(req, res, body, ({ inlineMediaBytes, complete, completeOptions }) =>
            runStageChat({
              message: withApprovedPlan(message, body.plan),
              references: Array.isArray(body.references) ? body.references : [],
              current: body.current ?? null,
              aspect: body.aspect,
              doc,
              docDir,
              knowledgeDir: KNOWLEDGE_DIR,
              complete,
              inlineMediaBytes,
              completeOptions,
            }),
          );
          return;
        }

        // The expensive Stage turn: build/iterate a UI asset + its Forge contract.
        if (route === "POST /api/stage/chat") {
          const body = (await readBody(req)) as StageChatBody;
          const message = body.message?.trim();
          if (!message) return sendJson(res, 400, { ok: false, errors: ["message is empty"] });
          if (body.provider && !(body.provider in PROVIDERS)) {
            return sendJson(res, 400, { ok: false, errors: [`unknown provider: ${body.provider}`] });
          }
          const providerId = (body.provider as ProviderId | undefined) ?? (await defaultProvider());
          if (!providerId) {
            return sendJson(res, 400, {
              ok: false,
              errors: ["no agent provider available - sign into a local CLI or configure DeepSeek/OpenModel"],
            });
          }
          const provider = PROVIDERS[providerId]!;
          const inlineMediaBytes = provider.kind === "api";
          const result = await runStageChat({
            message: withApprovedPlan(message, body.plan),
            references: Array.isArray(body.references) ? body.references : [],
            current: body.current ?? null,
            aspect: body.aspect,
            doc,
            docDir,
            knowledgeDir: KNOWLEDGE_DIR,
            complete: (prompt, opts) => provider.complete(prompt, opts),
            inlineMediaBytes,
            completeOptions: {
              ...(body.apiKey ? { apiKey: body.apiKey } : {}),
              ...(body.model?.trim() ? { model: body.model.trim() } : {}),
              ...(body.thinkingMode && body.thinkingMode !== "auto" ? { thinkingMode: body.thinkingMode } : {}),
            },
          });
          return sendJson(res, 200, { ...result, provider: providerId });
        }

        // Clipboard paste → the hidden scratch library (never a pool asset).
        if (route === "POST /api/stage/paste") {
          const body = (await readBody(req)) as { fileName?: string; base64?: string };
          if (!body.base64) return sendJson(res, 400, { ok: false, errors: ["missing base64"] });
          try {
            const item = saveScratchImage(doc.dir, body.fileName ?? "pasted.png", Buffer.from(body.base64, "base64"));
            return sendJson(res, 200, { ok: true, id: item.id, fileName: item.fileName, kind: item.kind });
          } catch (err) {
            return sendJson(res, 200, { ok: false, errors: [String((err as Error).message)] });
          }
        }

        /* ---------------- Create AI (motion draft authoring) ---------------- */

        if (route === "GET /api/create/drafts") {
          const drafts = listCreateDrafts(docDir);
          const current = currentCreateDraft(docDir);
          return sendJson(res, 200, {
            currentId: current?.id ?? null,
            current,
            drafts,
            summaries: drafts.map(draftBundleSummary),
          });
        }

        if (route === "POST /api/create/drafts/save") {
          const body = await readBody(req);
          const { draft, store } = upsertCreateDraft(docDir, body);
          return sendJson(res, 200, {
            ok: true,
            draft,
            currentId: store.currentId,
            drafts: store.drafts,
            summaries: store.drafts.map(draftBundleSummary),
          });
        }

        if (route === "POST /api/create/drafts/current") {
          const body = (await readBody(req)) as { id?: string };
          if (!body.id) return sendJson(res, 400, { ok: false, errors: ["missing id"] });
          const store = setCurrentCreateDraft(docDir, body.id);
          return sendJson(res, 200, {
            ok: true,
            currentId: store.currentId,
            current: store.drafts.find((draft) => draft.id === store.currentId) ?? null,
            drafts: store.drafts,
            summaries: store.drafts.map(draftBundleSummary),
          });
        }

        if (route === "POST /api/create/drafts/delete") {
          const body = (await readBody(req)) as { id?: string };
          if (!body.id) return sendJson(res, 400, { ok: false, errors: ["missing id"] });
          const store = deleteCreateDraft(docDir, body.id);
          return sendJson(res, 200, {
            ok: true,
            currentId: store.currentId,
            current: store.drafts.find((draft) => draft.id === store.currentId) ?? null,
            drafts: store.drafts,
            summaries: store.drafts.map(draftBundleSummary),
          });
        }

        if (req.method === "GET" && url.pathname.startsWith("/forge-create-preview/")) {
          const rest = url.pathname.slice("/forge-create-preview/".length);
          if (serveVendor(res, rest)) return;
          if (!rest.endsWith(".html")) {
            res.writeHead(404);
            return res.end("not found");
          }
          const id = decodeURIComponent(rest.slice(0, -".html".length));
          const draft = listCreateDrafts(docDir).find((item) => item.id === id);
          if (!draft) {
            res.writeHead(404);
            return res.end("unknown draft");
          }
          const result = liftAndBundleCreateDraft(doc, draft);
          if (!result.bundle) {
            return sendHtml(
              res,
              `<!doctype html><html><body style="margin:0;background:#0b0c0e;color:#a6abb4;font:14px system-ui;display:grid;place-items:center;height:100vh"><pre>${String(
                result.issues.map((issue) => issue.message).join("\n") || "draft could not preview",
              ).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]!)}</pre></body></html>`,
            );
          }
          installBundle(result.bundle);
          installed.set(result.bundle.manifest.id, { id: result.bundle.manifest.id, dir: "(draft)", bundle: result.bundle });
          previewCache.delete(result.bundle.manifest.id);
          return sendHtml(res, previewHtml(result.bundle.manifest.id));
        }

        if (route === "POST /api/create/chat") {
          const body = (await readBody(req)) as CreateChatBody;
          const message = body.message?.trim();
          if (!message) return sendJson(res, 400, { ok: false, errors: ["message is empty"] });
          if (body.provider && !(body.provider in PROVIDERS)) {
            return sendJson(res, 400, { ok: false, errors: [`unknown provider: ${body.provider}`] });
          }
          const providerId = (body.provider as ProviderId | undefined) ?? (await defaultProvider());
          if (!providerId) {
            return sendJson(res, 400, {
              ok: false,
              errors: ["no agent provider available - sign into a local CLI or configure DeepSeek/OpenModel"],
            });
          }
          const current =
            body.currentDraftId === null
              ? null
              : (body.currentDraftId ? listCreateDrafts(docDir).find((draft) => draft.id === body.currentDraftId) : null) ??
                currentCreateDraft(docDir);
          const provider = PROVIDERS[providerId]!;
          const inlineMediaBytes = provider.kind === "api";
          const result = await runCreateChat({
            message: withApprovedPlan(message, body.plan),
            references: Array.isArray(body.references) ? body.references : [],
            aspect: current?.aspect ?? body.aspect ?? "16:9",
            currentDraft: current,
            doc,
            docDir,
            knowledgeDir: KNOWLEDGE_DIR,
            complete: (prompt, opts) => provider.complete(prompt, opts),
            inlineMediaBytes,
            completeOptions: {
              ...(body.apiKey ? { apiKey: body.apiKey } : {}),
              ...(body.model?.trim() ? { model: body.model.trim() } : {}),
              ...(body.thinkingMode && body.thinkingMode !== "auto" ? { thinkingMode: body.thinkingMode } : {}),
            },
          });
          let storePayload: { currentId: string | null; drafts: ForgeExtensionDraft[] } | undefined;
          if (result.draft) {
            const saved = upsertCreateDraft(docDir, result.draft);
            result.draft = saved.draft;
            storePayload = { currentId: saved.store.currentId, drafts: saved.store.drafts };
          }
          return sendJson(res, 200, {
            ...result,
            provider: providerId,
            ...(storePayload ? { currentId: storePayload.currentId, drafts: storePayload.drafts, summaries: storePayload.drafts.map(draftBundleSummary) } : {}),
          });
        }

        // Streaming Create turn: same validated runner + draft store, with the
        // provider's live reasoning surfaced as SSE progress.
        if (route === "POST /api/create/chat/stream") {
          const body = (await readBody(req)) as CreateChatBody;
          const message = body.message?.trim();
          if (!message) {
            sendSseHeaders(res);
            writeSse(res, "result", { ok: false, errors: ["message is empty"] });
            return res.end();
          }
          await streamProviderTurn(req, res, body, async ({ inlineMediaBytes, complete, completeOptions }) => {
            const current =
              body.currentDraftId === null
                ? null
                : (body.currentDraftId ? listCreateDrafts(docDir).find((draft) => draft.id === body.currentDraftId) : null) ??
                  currentCreateDraft(docDir);
            const result = await runCreateChat({
              message: withApprovedPlan(message, body.plan),
              references: Array.isArray(body.references) ? body.references : [],
              aspect: current?.aspect ?? body.aspect ?? "16:9",
              currentDraft: current,
              doc,
              docDir,
              knowledgeDir: KNOWLEDGE_DIR,
              complete,
              inlineMediaBytes,
              completeOptions,
            });
            let storePayload: { currentId: string | null; drafts: ForgeExtensionDraft[] } | undefined;
            if (result.draft) {
              const saved = upsertCreateDraft(docDir, result.draft);
              result.draft = saved.draft;
              storePayload = { currentId: saved.store.currentId, drafts: saved.store.drafts };
            }
            return {
              ...result,
              ...(storePayload
                ? {
                    currentId: storePayload.currentId,
                    drafts: storePayload.drafts,
                    summaries: storePayload.drafts.map(draftBundleSummary),
                  }
                : {}),
            };
          });
          return;
        }

        if (route === "POST /api/create/stage-call") {
          const body = (await readBody(req)) as CreateStageCallBody;
          const request = normalizeStageRequest(body.request);
          if (!request) return sendJson(res, 400, { ok: false, errors: ["missing stage request"] });
          if (body.provider && !(body.provider in PROVIDERS)) {
            return sendJson(res, 400, { ok: false, errors: [`unknown provider: ${body.provider}`] });
          }
          const providerId = (body.provider as ProviderId | undefined) ?? (await defaultProvider());
          if (!providerId) {
            return sendJson(res, 400, {
              ok: false,
              errors: ["no agent provider available - sign into a local CLI or configure DeepSeek/OpenModel"],
            });
          }
          const provider = PROVIDERS[providerId]!;
          const inlineMediaBytes = provider.kind === "api";
          const result = await runStageChat({
            message: stageToolMessage(request),
            references: Array.isArray(body.references) ? body.references : [],
            current: null,
            aspect: request.aspect,
            doc,
            docDir,
            knowledgeDir: KNOWLEDGE_DIR,
            complete: (prompt, opts) => provider.complete(prompt, opts),
            inlineMediaBytes,
            completeOptions: {
              ...(body.apiKey ? { apiKey: body.apiKey } : {}),
              ...(body.model?.trim() ? { model: body.model.trim() } : {}),
              ...(body.thinkingMode && body.thinkingMode !== "auto" ? { thinkingMode: body.thinkingMode } : {}),
            },
          });
          if (!result.ok || !result.asset) {
            return sendJson(res, 200, { ...result, provider: providerId });
          }
          const object = upsertForgeObject(docDir, result.asset);
          return sendJson(res, 200, {
            ok: true,
            provider: providerId,
            reply: result.reply,
            asset: result.asset,
            object,
            objects: readObjectLibrary(docDir),
            raw: result.raw,
          });
        }

        /* ---------------- markdown reference docs (Library) ---------------- */

        if (route === "GET /api/docs") {
          return sendJson(res, 200, { docs: readDocIndex(docDir) });
        }

        if (route === "POST /api/docs/add") {
          const body = (await readBody(req)) as { name?: string; text?: string };
          if (!body.name || body.text == null) {
            return sendJson(res, 400, { ok: false, errors: ["missing name or text"] });
          }
          const docEntry = addDoc(docDir, body.name, body.text);
          return sendJson(res, 200, { ok: true, doc: docEntry, docs: readDocIndex(docDir) });
        }

        if (route === "POST /api/docs/delete") {
          const body = (await readBody(req)) as { id?: string };
          if (!body.id) return sendJson(res, 400, { ok: false, errors: ["missing id"] });
          return sendJson(res, 200, { ok: true, docs: deleteDoc(docDir, body.id) });
        }

        if (route === "GET /api/docs/file") {
          const id = url.searchParams.get("id") ?? "";
          const text = readDocText(docDir, id);
          if (text == null) {
            res.writeHead(404);
            return res.end("not found");
          }
          res.writeHead(200, { "content-type": "text/markdown; charset=utf-8", "cache-control": "no-store" });
          return res.end(text);
        }

        /* ---------------- library (disk browser + media pool, mirrors Studio) ---------------- */

        // Read-only disk browsing for the Library file view (localhost only).
        if (route === "GET /api/fs") {
          const target = url.searchParams.get("path");
          if (!target) return sendJson(res, 200, { roots: fsRoots(doc.dir) });
          try {
            return sendJson(res, 200, listDisk(target));
          } catch (err) {
            return sendJson(res, 400, { error: String((err as Error).message) });
          }
        }

        if (route === "GET /api/fs/file") {
          const target = path.resolve(url.searchParams.get("path") ?? "");
          if (!mediaKind(target)) {
            res.writeHead(403);
            return res.end("not a media file");
          }
          return sendMedia(req, res, target);
        }

        // Import a disk file into the document's media pool (one pathway, AddAsset).
        if (route === "POST /api/assets/import") {
          const body = (await readBody(req)) as { path?: string; folder?: string };
          const source = (body.path ?? "").trim();
          if (!source || !fs.existsSync(source) || !fs.statSync(source).isFile()) {
            return sendJson(res, 400, { ok: false, errors: [`no such file: ${source}`] });
          }
          const result = importMediaFromPath(doc, path.resolve(source), { folder: body.folder ?? "" });
          return sendJson(res, result.ok ? 200 : 422, { ...result, outline: doc.outline() });
        }

        // Upload raw bytes (OS drag/drop or file picker) into the media pool.
        if (route === "POST /api/assets/upload") {
          const name = (url.searchParams.get("name") ?? "").trim();
          if (!name) return sendJson(res, 400, { ok: false, errors: ["file name is required (?name=)"] });
          const buffer = await readBinaryBody(req);
          if (buffer.length === 0) return sendJson(res, 400, { ok: false, errors: ["empty upload"] });
          const result = importMediaFromBytes(doc, name, buffer, { folder: url.searchParams.get("folder") ?? "" });
          return sendJson(res, result.ok ? 200 : 422, { ...result, outline: doc.outline() });
        }

        // Move an asset between bins: copy + re-register as one undoable Batch.
        if (route === "POST /api/assets/move") {
          const body = (await readBody(req)) as { assetId?: string; folder?: string };
          const assetId = (body.assetId ?? "").trim();
          const index = doc.project.assets.findIndex((a) => a.id === assetId);
          if (index === -1) return sendJson(res, 400, { ok: false, errors: [`unknown asset: ${assetId}`] });
          const asset = doc.project.assets[index]!;
          const folder = (body.folder ?? "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
          const currentBin = asset.path.replace(/\\/g, "/").split("/").slice(1, -1).join("/");
          if (folder === currentBin) return sendJson(res, 200, { ok: true, outline: doc.outline() });
          const sourceFile = path.join(doc.dir, asset.path);
          if (!fs.existsSync(sourceFile)) {
            return sendJson(res, 400, { ok: false, errors: [`asset file missing on disk: ${asset.path}`] });
          }
          const others = new Set(doc.project.assets.filter((a) => a.id !== assetId).map((a) => a.id));
          const placed = placeAsset(doc.dir, path.basename(sourceFile), folder, others, (destination) =>
            fs.copyFileSync(sourceFile, destination),
          );
          const outcome = doc.apply({
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
          });
          if (!outcome.ok) {
            fs.rmSync(path.join(doc.dir, placed.relPath), { force: true });
            return sendJson(res, 422, { ok: false, errors: outcome.errors.map((e) => `${e.path}: ${e.message}`) });
          }
          return sendJson(res, 200, { ok: true, outline: doc.outline() });
        }

        // Create a bin (a folder under assets/).
        if (route === "POST /api/assets/folder") {
          const body = (await readBody(req)) as { name?: string };
          const name = (body.name ?? "").trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
          const assetRoot = path.join(doc.dir, "assets");
          const target = safeChildPath(assetRoot, name);
          if (
            !name ||
            !target ||
            target === path.resolve(assetRoot) ||
            name.split("/").some((part) => part === "." || part === ".." || /[<>:"|?*\0]/.test(part))
          ) {
            return sendJson(res, 400, { ok: false, errors: ["invalid folder name"] });
          }
          fs.mkdirSync(target, { recursive: true });
          return sendJson(res, 200, { ok: true });
        }

        // Delete a bin: remove its assets (undoable Batch) then drop the folder.
        if (route === "POST /api/assets/folder/delete") {
          const body = (await readBody(req)) as { name?: string };
          const folder = (body.name ?? "").trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
          const assetRoot = path.join(doc.dir, "assets");
          const target = folder ? safeChildPath(assetRoot, folder) : null;
          if (!folder || !target || target === path.resolve(assetRoot)) {
            return sendJson(res, 400, { ok: false, errors: ["invalid folder name"] });
          }
          const inBin = doc.project.assets.filter((a) => a.path.replace(/\\/g, "/").split("/").slice(1, -1).join("/") === folder);
          if (inBin.length > 0) {
            const outcome = doc.apply({ type: "Batch", commands: inBin.map((a) => ({ type: "RemoveAsset", assetId: a.id })) });
            if (!outcome.ok) {
              return sendJson(res, 422, { ok: false, errors: outcome.errors.map((e) => `${e.path}: ${e.message}`) });
            }
          }
          const objects = readObjectLibrary(docDir);
          let unbinned = 0;
          for (const object of objects) {
            if (object.folder === folder) {
              object.folder = "";
              object.updatedAt = new Date().toISOString();
              unbinned += 1;
            }
          }
          if (unbinned > 0) writeObjectLibrary(docDir, objects);
          fs.rmSync(target, { recursive: true, force: true });
          return sendJson(res, 200, { ok: true, removed: inBin.length, unbinned, objects, outline: doc.outline() });
        }

        if (route === "GET /api/assets/folders") {
          const root = path.join(doc.dir, "assets");
          const folders: string[] = [];
          const walk = (sub: string, depth: number): void => {
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
          return sendJson(res, 200, { folders });
        }

        if (route === "GET /api/objects") {
          return sendJson(res, 200, { objects: readObjectLibrary(docDir) });
        }

        if (route === "POST /api/objects/save") {
          const body = (await readBody(req)) as {
            id?: string;
            name?: string;
            html?: string;
            css?: string;
            js?: string;
            folder?: string;
            values?: Record<string, unknown>;
            mediaBindings?: Array<{
              knob: string;
              assetId?: string;
              href?: string;
              path?: string;
              kind?: string;
              label?: string;
            }>;
          };
          const object = upsertForgeObject(docDir, body);
          return sendJson(res, 200, { ok: true, object, objects: readObjectLibrary(docDir) });
        }

        if (route === "POST /api/objects/move") {
          const body = (await readBody(req)) as { id?: string; folder?: string };
          const id = (body.id ?? "").trim();
          if (!id) return sendJson(res, 400, { ok: false, errors: ["missing id"] });
          const objects = readObjectLibrary(docDir);
          if (!objects.some((item) => item.id === id)) return sendJson(res, 404, { ok: false, errors: ["component not found"] });
          return sendJson(res, 200, { ok: true, objects: moveForgeObjectToFolder(docDir, id, body.folder ?? "") });
        }

        if (route === "POST /api/objects/delete") {
          const body = (await readBody(req)) as { id?: string };
          if (!body.id) return sendJson(res, 400, { ok: false, errors: ["missing id"] });
          const objects = deleteForgeObject(docDir, body.id);
          return sendJson(res, 200, { ok: true, objects });
        }

        if (route === "POST /api/objects/export") {
          return sendJson(res, 410, {
            ok: false,
            errors: ["components are Create inputs; export an Extension with /api/doc/export instead"],
          });
        }

        if (route === "POST /api/lift") {
          const body = (await readBody(req)) as {
            source?: string;
            id?: string;
            summary?: string;
            primitiveKind?: ExportOptions["primitiveKind"];
          };
          if (!body.source?.trim()) return sendJson(res, 400, { ok: false, errors: ["missing source"] });
          try {
            const lift = liftGsapSource(body.source, {
              id: body.id ?? "enter.liftedDraft",
              summary: body.summary ?? "A lifted Forge motion draft ready for export.",
              primitiveKind: body.primitiveKind,
            });
            return sendJson(res, 200, { ok: true, lift });
          } catch (err) {
            return sendJson(res, 200, { ok: false, errors: [String((err as Error).message)] });
          }
        }

        if (route === "GET /api/copilot/providers") {
          const force = url.searchParams.get("force") === "1";
          return sendJson(res, 200, {
            providers: await detectProviders(force),
            defaultProvider: await defaultProvider(),
          });
        }

        if (route === "POST /api/copilot") {
          const body = (await readBody(req)) as {
            message?: string;
            source?: string;
            provider?: string;
            apiKey?: string;
            model?: string;
            thinkingMode?: "auto" | "low" | "medium" | "high" | "xhigh" | "max";
            mode?: "motion" | "object";
          };
          const message = body.message?.trim();
          if (!message) return sendJson(res, 400, { ok: false, errors: ["message is empty"] });
          if (body.provider && !(body.provider in PROVIDERS)) {
            return sendJson(res, 400, { ok: false, errors: [`unknown provider: ${body.provider}`] });
          }
          const providerId = (body.provider as ProviderId | undefined) ?? (await defaultProvider());
          if (!providerId) {
            return sendJson(res, 400, {
              ok: false,
              errors: [
                "no copilot provider available - install/sign into Codex, Claude Code, or Antigravity CLI, or configure an API key",
              ],
            });
          }
          try {
            const prompt = forgeCopilotPrompt({
              message,
              source: body.source,
              outline: doc.outline(),
              bundles: listBundles(extensionsDir),
              mode: body.mode ?? "motion",
              objects: readObjectLibrary(docDir),
            });
            const raw = await PROVIDERS[providerId]!.complete(prompt, {
              ...(body.apiKey ? { apiKey: body.apiKey } : {}),
              ...(body.model?.trim() ? { model: body.model.trim() } : {}),
              ...(body.thinkingMode && body.thinkingMode !== "auto" ? { thinkingMode: body.thinkingMode } : {}),
              timeoutMs: 240_000,
              cacheHint: "forge-copilot-v1",
            });
            const parsed = jsonObjectFromText(raw);
            if (body.mode === "object") {
              const objectInput =
                parsed?.object && typeof parsed.object === "object" && !Array.isArray(parsed.object)
                  ? (parsed.object as { name?: string; html?: string; css?: string; js?: string })
                  : undefined;
              const object =
                objectInput && (objectInput.html || objectInput.css || objectInput.js)
                  ? upsertForgeObject(docDir, objectInput)
                  : undefined;
              return sendJson(res, 200, {
                ok: true,
                provider: providerId,
                raw,
                parsed,
                object,
                objects: readObjectLibrary(docDir),
              });
            }
            const gsap = typeof parsed?.gsap === "string" ? parsed.gsap : undefined;
            let lift: unknown;
            let liftErrors: string[] | undefined;
            if (gsap?.trim()) {
              try {
                lift = liftGsapSource(gsap, {
                  id: typeof parsed?.id === "string" ? parsed.id : "enter.copilotDraft",
                  summary:
                    typeof parsed?.summary === "string"
                      ? parsed.summary
                      : "A lifted Forge copilot draft ready for export.",
                });
              } catch (err) {
                liftErrors = [String((err as Error).message)];
              }
            }
            return sendJson(res, 200, { ok: true, provider: providerId, raw, parsed, lift, liftErrors });
          } catch (err) {
            return sendJson(res, 200, { ok: false, provider: providerId, errors: [String((err as Error).message)] });
          }
        }

        if (route === "POST /api/doc/export") {
          const body = (await readBody(req)) as ExportOptions & { sourceId?: string; liftSource?: string; draftId?: string };
          const draft =
            body.draftId ? listCreateDrafts(docDir).find((item) => item.id === body.draftId) : currentCreateDraft(docDir);
          if (draft && !body.liftSource?.trim() && !body.sourceId) {
            const bundled = liftAndBundleCreateDraft(doc, draft);
            const errors = bundled.issues.filter((issue) => issue.level === "error").map((issue) => issue.message);
            if (!bundled.lift || errors.length) return sendJson(res, 200, { ok: false, errors });
            body.id = body.id || bundleNameFromDraft(draft);
            body.primitiveKind = body.primitiveKind || draft.primitiveKind;
            body.summary = body.summary || draft.summary;
            body.tags = body.tags || {
              energy: draft.taxonomy.energy ?? "calm",
              style: draft.taxonomy.style ?? "mechanical",
            };
            body.library = body.library || {
              ...(draft.taxonomy.family ? { family: draft.taxonomy.family } : {}),
              ...(draft.taxonomy.subject ? { subject: draft.taxonomy.subject } : {}),
              ...(draft.taxonomy.action ? { action: String(draft.taxonomy.action) } : {}),
              technique: draft.taxonomy.technique ?? [],
              ...(draft.taxonomy.register ? { register: draft.taxonomy.register } : {}),
              context: draft.taxonomy.context ?? [],
            };
            body.guardrails = body.guardrails || [
              ...bundled.lift.warnings,
              `Forge Create route: ${draft.route}`,
              `Aspect: ${draft.aspect}`,
            ];
            body.lift = bundled.lift;
          }
          const source = body.sourceId ? installed.get(body.sourceId)?.bundle : undefined;
          let lift: ReturnType<typeof liftGsapSource> | undefined;
          if (body.lift) {
            lift = body.lift;
          } else if (body.liftSource?.trim()) {
            try {
              lift = liftGsapSource(body.liftSource, {
                id: body.id,
                summary: body.summary,
                primitiveKind: body.primitiveKind,
              });
            } catch (err) {
              return sendJson(res, 200, { ok: false, errors: [String((err as Error).message)] });
            }
          }
          const result = exportDocument(doc, extensionsDir, { ...body, source, lift });
          if (result.ok) {
            // Re-install the freshly written bundle so it's live in the library.
            try {
              const bundle = readBundle(result.dir!);
              installBundle(bundle);
              installed.set(bundle.manifest.id, { id: bundle.manifest.id, dir: result.dir!, bundle });
              previewCache.delete(bundle.manifest.id);
            } catch {
              /* export wrote, install retry is best-effort */
            }
          }
          return sendJson(res, 200, result);
        }

        res.writeHead(404);
        res.end("not found");
      } catch (err) {
        sendJson(res, 500, { error: String((err as Error).message) });
      }
    })();
  });

  // Clean shutdown uninstalls so repeated dev runs don't leak registry entries.
  server.on("close", () => {
    for (const id of installed.keys()) uninstallBundlePrimitive(id);
  });

  const port = options.port ?? 4500;
  server.listen(port, () => {
    const addr = server.address();
    const boundPort = typeof addr === "object" && addr ? addr.port : port;
    console.log(`Forge → http://localhost:${boundPort}`);
    console.log(`  extensions library: ${extensionsDir}`);
    console.log(`  document workspace: ${docDir}`);
    const ok = bootReport.filter((r) => r.ok).length;
    console.log(`  installed ${ok}/${bootReport.length} bundles`);
    for (const r of bootReport.filter((r) => !r.ok)) {
      console.log(`  ! ${r.id}: ${r.errors.join("; ")}`);
    }
  });
  return server;
}
