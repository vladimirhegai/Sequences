/**
 * Asset Lab — the operator webview over the pre-built asset library
 * (ASSETS.md). `npm run assets --workspace @sequences/slack` →
 * http://127.0.0.1:4322 — browse every registered asset, tweak its typed
 * params live, fire its spring-driven animations, retheme the brand tokens,
 * and preview FLIP morph transitions between assets.
 *
 * Same posture as the Recipe Studio server: localhost-only, no auth, no
 * build step, no deps beyond node:http, refuses RAILWAY_ENVIRONMENT, absent
 * from the Docker CMD. It is a viewer over the real contract — rendering and
 * animation compilation happen in `assetContract.ts`, never re-implemented
 * here, so what the lab shows is byte-what a film would inject.
 *
 * Endpoints:
 *   GET  /              lab UI (studio/ui/asset-lab.html)
 *   GET  /api/assets    library summaries (params, animations, morph easing)
 *   POST /api/render    { id, params?, partId? } → rendered instance
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import {
  renderAssetInstance,
  compileAssetAnimation,
  type AssetDefinitionV1,
} from "../src/engine/assetContract.ts";
import { ASSET_LIBRARY, getAsset } from "../src/engine/assets/index.ts";

if (process.env.RAILWAY_ENVIRONMENT) {
  process.stderr.write("Asset Lab is an operator-local tool and refuses to start on Railway.\n");
  process.exit(1);
}

const UI_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), "ui", "asset-lab.html");
const PORT = Number(process.env.STUDIO_ASSETS_PORT ?? argValue("--port") ?? 4322);
const HOST = "127.0.0.1";

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body, null, 2));
}

async function readBody(req: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw.trim() ? JSON.parse(raw) : {};
}

function assetSummary(definition: AssetDefinitionV1): unknown {
  return {
    id: definition.id,
    title: definition.title,
    purpose: definition.purpose,
    family: definition.family,
    params: definition.params,
    animations: definition.animations.map((animation) => ({
      name: animation.name,
      purpose: animation.purpose,
      spring: animation.spring,
    })),
  };
}

/** The morph preview's shared gesture: one settle spring for every pair. */
const MORPH_GESTURE = compileAssetAnimation(
  {
    name: "morph",
    purpose: "FLIP morph between two assets",
    spring: "settle",
    tracks: [{ property: "opacity", from: 0, to: 1 }],
  },
  {},
);

const server = http.createServer((req, res) => {
  void handle(req, res).catch((error) => {
    sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
  });
});

async function handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const url = new URL(req.url ?? "/", `http://${HOST}:${PORT}`);
  if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    fs.createReadStream(UI_FILE).pipe(res);
    return;
  }
  if (req.method === "GET" && url.pathname === "/favicon.ico") {
    res.writeHead(204);
    res.end();
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/assets") {
    return sendJson(res, 200, {
      assets: ASSET_LIBRARY.map(assetSummary),
      morph: { durationMs: MORPH_GESTURE.durationMs, easing: MORPH_GESTURE.easing },
    });
  }
  if (req.method === "POST" && url.pathname === "/api/render") {
    const body = (await readBody(req)) as {
      id?: string;
      params?: Record<string, string | number>;
      partId?: string;
    };
    const definition = getAsset(body.id ?? "");
    if (!definition) return sendJson(res, 404, { error: `unknown asset "${body.id}"` });
    const instance = renderAssetInstance(definition, body.params ?? {}, {
      ...(body.partId ? { partId: body.partId } : {}),
    });
    return sendJson(res, 200, instance);
  }
  sendJson(res, 404, { error: "unknown route" });
}

server.listen(PORT, HOST, () => {
  const url = `http://${HOST}:${PORT}`;
  process.stdout.write(`Asset Lab → ${url}  (${ASSET_LIBRARY.length} asset(s) registered)\n`);
  if (!process.argv.includes("--no-open")) {
    const opener = process.platform === "win32"
      ? spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore" })
      : spawn(process.platform === "darwin" ? "open" : "xdg-open", [url], {
          detached: true,
          stdio: "ignore",
        });
    opener.on("error", () => undefined);
    opener.unref();
  }
});
