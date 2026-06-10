/**
 * Thumbnails — one PNG per scene, captured from the REAL compiled
 * composition (same HTML the renderer consumes) via puppeteer-core and the
 * window.__hf seek protocol, plus a poster JPEG for finished renders
 * (extracted with FFmpeg).
 *
 * Scene thumbs land in build/thumbs/<sceneId>.png (a compile artifact —
 * regenerated, never authored). The studio timeline uses them as block
 * backgrounds; the picker UI and plugin CI can reuse the same pipeline.
 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { execFile } from "node:child_process";
import type { Project } from "@sequences/core";
import { buildProject } from "./projectIo.ts";
import { findBrowserExecutable, findFfmpeg } from "./render.ts";

const THUMB_MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".mp4": "video/mp4",
};

/**
 * Serve a directory on an ephemeral localhost port (for headless capture).
 * index.html is served WITHOUT the HF runtime script: for a static frame the
 * host drives the GSAP timeline + clip visibility itself (below), so the
 * runtime's own playback loop can't fight the seek.
 */
function serveDir(dir: string): Promise<{ url: string; close: () => void }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const rel = decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname);
      const file = path.resolve(dir, "." + rel.replace(/\/$/, "/index.html"));
      if (!file.startsWith(path.resolve(dir)) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
        res.writeHead(404);
        return res.end();
      }
      res.writeHead(200, {
        "content-type": THUMB_MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream",
      });
      if (path.basename(file) === "index.html") {
        const html = fs
          .readFileSync(file, "utf8")
          .replace(/<script src="hyperframe\.runtime\.iife\.js"><\/script>/, "");
        return res.end(html);
      }
      res.end(fs.readFileSync(file));
    });
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        reject(new Error("could not bind thumbnail server"));
        return;
      }
      resolve({ url: `http://127.0.0.1:${address.port}`, close: () => server.close() });
    });
  });
}

export interface ThumbsResult {
  /** sceneId → path relative to build/ (e.g. "thumbs/hook.png"). */
  files: Record<string, string>;
  elapsedMs: number;
}

export async function generateSceneThumbnails(
  projectDir: string,
  project: Project,
  options: { width?: number; browserPath?: string } = {},
): Promise<ThumbsResult> {
  const dir = path.resolve(projectDir);
  const result = buildProject(dir, project);
  const buildDir = path.join(dir, "build");
  const thumbsDir = path.join(buildDir, "thumbs");
  fs.mkdirSync(thumbsDir, { recursive: true });

  const browserPath = options.browserPath ?? findBrowserExecutable();
  if (!browserPath) {
    throw new Error("no Chrome/Edge found for thumbnail capture (set SEQUENCES_BROWSER_PATH)");
  }

  const { width, height, fps } = result.manifest;
  const scale = (options.width ?? 480) / width;
  const started = Date.now();

  const puppeteer = (await import("puppeteer-core")).default;
  const server = await serveDir(buildDir);
  const browser = await puppeteer.launch({
    executablePath: browserPath,
    headless: true,
    args: ["--hide-scrollbars", "--mute-audio", "--disable-gpu"],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: scale });
    await page.goto(`${server.url}/index.html`, { waitUntil: "networkidle0", timeout: 30_000 });
    const compositionId = result.manifest.compositionId;
    // Our compiled HTML registers the paused master timeline (HF contract).
    await page.waitForFunction(
      (id: string) =>
        Boolean(
          (window as unknown as { __timelines?: Record<string, unknown> }).__timelines?.[id],
        ),
      { timeout: 15_000 },
      compositionId,
    );

    const files: Record<string, string> = {};
    for (const scene of result.manifest.scenes) {
      // Mid-scene: entrances have landed, exits haven't started.
      const seconds = (scene.startFrame + scene.durationFrames / 2) / fps;
      // Seek the GSAP timeline and apply HF clip visibility ourselves (the
      // runtime is stripped for capture; data-start/duration is OUR contract).
      await page.evaluate(
        (t: number, id: string) => {
          const w = window as unknown as {
            __timelines: Record<string, { seek(t: number, suppress?: boolean): void }>;
          };
          w.__timelines[id]!.seek(t, false);
          document.querySelectorAll<HTMLElement>(".clip").forEach((el) => {
            const start = parseFloat(el.dataset.start ?? "0");
            const duration = parseFloat(el.dataset.duration ?? "0");
            el.style.visibility = t >= start && t < start + duration ? "visible" : "hidden";
          });
        },
        seconds,
        compositionId,
      );
      const file = path.join(thumbsDir, `${scene.id}.png`);
      await page.screenshot({ path: file as `${string}.png` });
      files[scene.id] = `thumbs/${scene.id}.png`;
    }
    return { files, elapsedMs: Date.now() - started };
  } finally {
    await browser.close().catch(() => {});
    server.close();
  }
}

/** Extract a poster JPEG next to a finished render (renders/<name>.jpg). */
export function extractRenderPoster(
  videoPath: string,
  options: { atSec?: number } = {},
): Promise<string> {
  const ffmpeg = findFfmpeg();
  if (!ffmpeg) return Promise.reject(new Error("FFmpeg not found"));
  const posterPath = videoPath.replace(/\.[a-z0-9]+$/i, "") + ".jpg";
  const at = options.atSec ?? 1;
  return new Promise((resolve, reject) => {
    execFile(
      ffmpeg,
      ["-y", "-ss", String(at), "-i", videoPath, "-frames:v", "1", "-q:v", "4", posterPath],
      { timeout: 30_000, windowsHide: true },
      (error) => {
        if (error) reject(new Error(`poster extraction failed: ${error.message}`));
        else resolve(posterPath);
      },
    );
  });
}
