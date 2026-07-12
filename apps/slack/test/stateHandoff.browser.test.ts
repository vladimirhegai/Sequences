import { createRequire } from "node:module";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { launchHeadlessBrowser } from "../src/engine/browserLifecycle.ts";
import {
  COMPONENT_RUNTIME_FILE,
  componentRuntimeSource,
  resolveComponentPlan,
} from "../src/engine/componentContract.ts";
import { resolveContinuityGraph } from "../src/engine/continuityGraph.ts";
import { CUT_RUNTIME_FILE, cutRuntimeSource, resolveCutPlan } from "../src/engine/cutContract.ts";
import type { DirectScene } from "../src/engine/directComposition.ts";
import { findBrowserExecutable } from "../src/engine/render.ts";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

function metricScene(
  id: string,
  startSec: number,
  part: string,
  value: number,
  kind: "stat-card" | "app-window" = "stat-card",
): DirectScene {
  return {
    id,
    title: id,
    purpose: "advance one persistent release score",
    startSec,
    durationSec: 3,
    components: [{ version: 1, id: part, kind, role: "hero", entityId: "release-score" }],
    beats: [{
      version: 1,
      id: `${part}-count`,
      sceneId: id,
      component: part,
      kind: "count",
      atSec: startSec + 0.5,
      durationSec: 0.8,
      value,
    }],
  };
}

function stateFilm(): string {
  const scenes: DirectScene[] = [
    { ...metricScene("signal", 0, "score-38", 38), cut: { version: 1, style: "swipe", axis: "left" } },
    { ...metricScene("proof", 3, "score-71", 71), cut: { version: 1, style: "swipe", axis: "left" } },
    metricScene("resolve", 6, "score-94", 94),
  ];
  const components = resolveComponentPlan(scenes);
  const cuts = resolveCutPlan(scenes);
  const continuity = resolveContinuityGraph(scenes);
  const sections = scenes.map((scene, index) => {
    const part = scene.components![0]!.id;
    const kind = scene.components![0]!.kind;
    return `<section class="scene" data-scene="${scene.id}" data-start="${scene.startSec}" data-duration="3">` +
      `<div class="cmp ${kind === "app-window" ? "cmp-window" : "cmp-stat"}" data-component="${kind}" ` +
      `data-part="${part}" data-continuity-entity="release-score">` +
      `<div class="chrome">${kind === "app-window" ? "GatePilot" : "Score"}</div>` +
      `<div class="cmp-value" data-cmp-value>${[38, 71, 94][index]}%</div>` +
      `${kind === "app-window" ? "<div class=body><div>Policy</div><div>Owner</div><div>Status</div></div>" : ""}` +
      `</div></section>`;
  }).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><script src="gsap.min.js"></script>` +
    `<script src="${CUT_RUNTIME_FILE}"></script><script src="${COMPONENT_RUNTIME_FILE}"></script>` +
    `<style>*{box-sizing:border-box}html,body,#root,.scene{margin:0;width:1920px;height:1080px;overflow:hidden}` +
    `#root,.scene{position:absolute;inset:0}.scene{opacity:0;display:grid;place-items:center;background:#fff}` +
    `.cmp{background:#172033;color:#fff;border-radius:28px;padding:36px;font:700 48px Arial}` +
    `.cmp-stat{width:520px;height:300px}.cmp-window{width:1200px;height:700px}` +
    `.cmp-value{font-size:112px}.body{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-top:120px}</style>` +
    `</head><body><main id="root" data-composition-id="state-handoff" data-duration="9">${sections}</main>` +
    `<script type="application/json" id="sequences-cuts">${JSON.stringify(cuts)}</script>` +
    `<script type="application/json" id="sequences-components">${JSON.stringify(components)}</script>` +
    `<script type="application/json" id="sequences-continuity">${JSON.stringify(continuity)}</script>` +
    `<script>window.__timelines={};const tl=gsap.timeline({paused:true});` +
    scenes.map((scene) =>
      `tl.set('[data-scene="${scene.id}"]',{opacity:1},${scene.startSec})` +
      `.set('[data-scene="${scene.id}"]',{opacity:0},${scene.startSec + scene.durationSec - 0.001});`
    ).join("") +
    `SequencesCuts.compile(tl,document.getElementById('root'));` +
    `SequencesComponents.compile(tl,document.getElementById('root'));` +
    `window.__timelines['state-handoff']=tl;tl.seek(0,false);</script></body></html>`;
}

function serve(dir: string): Promise<{ url: string; close: () => Promise<void> }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((request, response) => {
      const pathname = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
      const file = path.resolve(dir, "." + pathname.replace(/\/$/, "/index.html"));
      if (!file.startsWith(path.resolve(dir)) || !fs.existsSync(file)) {
        response.writeHead(404); response.end(); return;
      }
      response.writeHead(200, { "content-type": path.extname(file) === ".js" ? "text/javascript" : "text/html" });
      response.end(fs.readFileSync(file));
    });
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") return reject(new Error("could not bind browser fixture"));
      resolve({
        url: `http://127.0.0.1:${address.port}/index.html`,
        close: () => new Promise<void>((done) => server.close(() => done())),
      });
    });
  });
}

describe("typed continuity state handoff browser contract", () => {
  it("never resets 38→71→94 across swipe cuts and reverse seeks", async () => {
    const executablePath = findBrowserExecutable();
    expect(executablePath).toBeTruthy();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sequences-state-handoff-"));
    roots.push(dir);
    fs.writeFileSync(path.join(dir, "index.html"), stateFilm(), "utf8");
    const require = createRequire(import.meta.url);
    fs.copyFileSync(require.resolve("gsap/dist/gsap.min.js"), path.join(dir, "gsap.min.js"));
    fs.writeFileSync(path.join(dir, CUT_RUNTIME_FILE), cutRuntimeSource(), "utf8");
    fs.writeFileSync(path.join(dir, COMPONENT_RUNTIME_FILE), componentRuntimeSource(), "utf8");
    const server = await serve(dir);
    const browser = await launchHeadlessBrowser({
      executablePath: executablePath!,
      headless: true,
      args: ["--hide-scrollbars", "--mute-audio", "--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage"],
    });
    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(String(error)));
      await page.goto(server.url, { waitUntil: "networkidle0", timeout: 30_000 });
      const at = (time: number, part: string) => page.evaluate(({ time, part }) => {
        const win = window as unknown as {
          __timelines: Record<string, { seek: (at: number, suppress?: boolean) => void }>;
        };
        win.__timelines["state-handoff"]!.seek(time, false);
        const el = document.querySelector<HTMLElement>(`[data-part="${part}"]`)!;
        return Number(el.querySelector<HTMLElement>("[data-cmp-value]")!.textContent!.replace(/[^0-9.-]/g, ""));
      }, { time, part });

      expect(await at(3.05, "score-71")).toBe(38);
      expect(await at(6.05, "score-94")).toBe(71);
      expect(await at(4.4, "score-71")).toBe(71);
      expect(await at(7.4, "score-94")).toBe(94);
      expect(await at(3.05, "score-71")).toBe(38);
      expect(errors).toEqual([]);
    } finally {
      await browser.close();
      await server.close();
    }
  }, 30_000);
});
