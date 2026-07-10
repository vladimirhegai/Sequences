import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { afterEach, describe, expect, it } from "vitest";
import { launchHeadlessBrowser } from "../src/engine/browserLifecycle.ts";
import type { DirectScene } from "../src/engine/directComposition.ts";
import { CAMERA_RUNTIME_FILE, cameraRuntimeSource, resolveCameraPlan } from "../src/engine/cameraContract.ts";
import {
  CONTINUITY_RUNTIME_FILE,
  continuityRuntimeSource,
  resolveContinuityGraph,
} from "../src/engine/continuityGraph.ts";
import { resolveCameraBlockingPlan } from "../src/engine/cameraBlocking.ts";
import { findBrowserExecutable } from "../src/engine/render.ts";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

function storyboard(): DirectScene[] {
  return [0, 1, 2].map((index): DirectScene => ({
    id: `scene-${index + 1}`,
    title: `Scene ${index + 1}`,
    purpose: "keep the same product world visible",
    startSec: index * 3,
    durationSec: 3,
    components: [{
      version: 1,
      id: `shell-${index + 1}`,
      kind: "app-window",
      role: "hero",
      entityId: "product-shell",
    }],
    beats: [{
      version: 1,
      id: `state-${index + 1}`,
      sceneId: `scene-${index + 1}`,
      component: `shell-${index + 1}`,
      kind: "set-state",
      atSec: index * 3 + 1,
      durationSec: 0.5,
      toState: "ready",
    }],
    moments: [{
      version: 1,
      id: `moment-${index + 1}`,
      sceneId: `scene-${index + 1}`,
      atSec: index * 3 + 1.5,
      title: "Product state",
      visualState: "The product shell is readable",
      change: "State advances",
      motionIntent: "ui-state",
      importance: "primary",
    }],
    spatialIntent: {
      version: 1,
      focalPart: `shell-${index + 1}`,
      composition: "centered product",
      relationships: [],
    },
    camera: {
      version: 1,
      path: [{
        version: 1,
        move: "hold",
        toPart: `shell-${index + 1}`,
        startSec: index * 3,
        durationSec: 3,
      }],
    },
    ...(index < 2 ? { cut: { version: 1, style: "hard" as const } } : {}),
  }));
}

function film(): string {
  const scenes = storyboard();
  const graph = resolveContinuityGraph(scenes);
  const blocking = resolveCameraBlockingPlan(scenes, graph);
  const firstPrimary = blocking.scenes[0]!.phrases.find((phrase) => phrase.importance === "primary")!;
  blocking.scenes[0]!.phrases.push({
    ...firstPrimary,
    id: "scene-1:late-support:blocking",
    phraseId: "late-support",
    importance: "supporting",
    startSec: 2.1,
    arrivalSec: 2.4,
    endSec: 2.9,
    target: { kind: "part", id: "late-support" },
    framingTarget: undefined,
    framingOccupancy: undefined,
    occupancy: { min: 0.04, preferred: 0.16, max: 0.3 },
    dwell: { startSec: 2.4, endSec: 2.9, readableSec: 0.5 },
    nextHandoff: undefined,
  });
  blocking.scenes[0]!.phrases.push({
    ...firstPrimary,
    id: "scene-1:same-target-read:blocking",
    phraseId: "same-target-read",
    importance: "supporting",
    startSec: 2.05,
    arrivalSec: 2.15,
    endSec: 2.9,
    dwell: { startSec: 2.15, endSec: 2.9, readableSec: 0.75 },
    nextHandoff: undefined,
  });
  const camera = resolveCameraPlan(scenes);
  const section = scenes.map((scene, index) => `
<section id="${scene.id}" class="scene" data-scene="${scene.id}">
  <div class="world" data-camera-world>
    <div class="station" data-region="station-${index + 1}">
      <div class="shell" data-component="app-window" data-part="shell-${index + 1}" data-continuity-entity="product-shell">Product ${index + 1}</div>
      ${index === 0 ? '<div class="late-support" data-part="late-support">Annotation</div>' : ""}
    </div>
  </div>
</section>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8">
<script src="gsap.min.js"></script><script src="${CAMERA_RUNTIME_FILE}"></script><script src="${CONTINUITY_RUNTIME_FILE}"></script>
<style>*{box-sizing:border-box}html,body{margin:0;width:1920px;height:1080px;overflow:hidden;background:#07101d}
#root,.scene{position:absolute;inset:0;overflow:hidden}.scene{opacity:0}.world{position:relative;width:1920px;height:1080px}
.station{position:absolute;inset:0}.shell{position:absolute;left:120px;top:230px;width:500px;height:300px;border-radius:24px;background:#13283d;border:3px solid #55f0c5;color:#fff;display:grid;place-items:center;font:700 48px Arial}.late-support{position:absolute;left:1540px;top:780px;width:120px;height:64px;background:#f6c945}</style></head><body>
<main id="root" data-composition-id="continuity-browser" data-width="1920" data-height="1080" data-duration="9">${section}</main>
<script type="application/json" id="sequences-camera">${JSON.stringify(camera)}</script>
<script type="application/json" id="sequences-continuity">${JSON.stringify(graph)}</script>
<script type="application/json" id="sequences-camera-blocking">${JSON.stringify(blocking)}</script>
<script>window.__timelines={};const tl=gsap.timeline({paused:true});
tl.set("#scene-1",{opacity:1},0).set("#scene-1",{opacity:0},3);
tl.set("#scene-2",{opacity:1},3).set("#scene-2",{opacity:0},6);
tl.set("#scene-3",{opacity:1},6).set("#scene-3",{opacity:0},9);
SequencesCamera.compile(tl,document.getElementById("root"));
SequencesContinuity.compile(tl,document.getElementById("root"));
window.__timelines["continuity-browser"]=tl;tl.seek(0,false);</script></body></html>`;
}

function approachFilm(): string {
  const scenes: DirectScene[] = [{
    id: "approach-scene",
    title: "Approach a contextual metric",
    purpose: "browse a broad station, then land a readable metric",
    startSec: 0,
    durationSec: 4,
    components: [{
      version: 1,
      id: "primary-metric",
      kind: "progress-ring",
      region: "overview-station",
      role: "hero",
      entityId: "metric",
    }],
    beats: [{
      version: 1,
      id: "metric-progress",
      sceneId: "approach-scene",
      component: "primary-metric",
      kind: "progress",
      atSec: 2.5,
      durationSec: 0.7,
      value: 92,
    }],
    moments: [{
      version: 1,
      id: "metric-landing",
      sceneId: "approach-scene",
      atSec: 2.6,
      title: "Metric lands",
      visualState: "The metric is readable inside its overview",
      change: "The camera completes its browse",
      motionIntent: "camera-arrival",
      importance: "primary",
    }],
    spatialIntent: {
      version: 1,
      focalPart: "primary-metric",
      composition: "centered metric inside a broad overview",
      relationships: ["the station remains context while the metric owns the eye"],
    },
    camera: {
      version: 1,
      path: [{
        version: 1,
        move: "pan",
        toRegion: "overview-station",
        startSec: 0,
        durationSec: 2.5,
        ease: "seqDrift",
      }, {
        version: 1,
        move: "track-to-anchor",
        toPart: "primary-metric",
        startSec: 2.5,
        durationSec: 1.1,
        ease: "seqSettle",
      }],
    },
  }];
  const graph = resolveContinuityGraph(scenes);
  const blocking = resolveCameraBlockingPlan(scenes, graph);
  const primary = blocking.scenes[0]!.phrases.find((phrase) => phrase.importance === "primary")!;
  // Keep this fixture about the generic route shape, independent of direction
  // score phrase splitting: an authored opening pan has 2.5s to approach one
  // primary part, then an operated hold returns to the exact landing pose.
  primary.startSec = 0;
  primary.arrivalSec = 2.5;
  primary.dwell = { startSec: 2.5, endSec: 3.8, readableSec: 1.3 };
  blocking.scenes[0]!.phrases = [primary];
  const camera = resolveCameraPlan(scenes);
  return `<!doctype html><html><head><meta charset="utf-8">
<script src="gsap.min.js"></script><script src="${CAMERA_RUNTIME_FILE}"></script><script src="${CONTINUITY_RUNTIME_FILE}"></script>
<style>*{box-sizing:border-box}html,body{margin:0;width:1920px;height:1080px;overflow:hidden;background:#fff}
#root,.scene{position:absolute;inset:0;overflow:hidden}.world{position:relative;width:1920px;height:1080px}
.station{position:absolute;left:80px;top:80px;width:1760px;height:920px;border:2px solid #ddd;background:#faf8f5}
.metric{position:absolute;left:160px;top:290px;width:220px;height:180px;border-radius:30px;background:#ff5a5f;color:#fff;display:grid;place-items:center;font:700 48px Arial}
  .context-title{position:absolute;left:110px;top:72px;width:620px;font:700 48px Arial;color:#171717}
  .companion{position:absolute;left:790px;top:180px;width:760px;height:520px;background:#eee;border-radius:40px}</style></head><body>
<main id="root" data-composition-id="approach-browser" data-width="1920" data-height="1080" data-duration="4">
<section class="scene" data-scene="approach-scene"><div class="world" data-camera-world>
  <div class="station" data-region="overview-station">
    <div class="context-title">Confirmed bookings</div>
    <div class="metric" data-component="progress-ring" data-part="primary-metric" data-continuity-entity="metric">92%</div>
    <div class="companion" data-layout-important>Context panel</div>
  </div>
</div></section></main>
<script type="application/json" id="sequences-camera">${JSON.stringify(camera)}</script>
<script type="application/json" id="sequences-continuity">${JSON.stringify(graph)}</script>
<script type="application/json" id="sequences-camera-blocking">${JSON.stringify(blocking)}</script>
<script>window.__timelines={};const tl=gsap.timeline({paused:true});
SequencesCamera.compile(tl,document.getElementById("root"));
SequencesContinuity.compile(tl,document.getElementById("root"));
window.__timelines["approach-browser"]=tl;tl.seek(0,false);</script></body></html>`;
}

function singleSubjectContextFilm(): string {
  const scenes: DirectScene[] = [{
    id: "recovery-metric",
    title: "Recovery metric",
    purpose: "land one recovery statistic inside its named station",
    startSec: 0,
    durationSec: 4,
    components: [{
      version: 1,
      id: "recovery-stat",
      kind: "stat-card",
      region: "metric-wall",
      role: "hero",
      entityId: "metric",
    }],
    beats: [{
      version: 1,
      id: "stat-count",
      sceneId: "recovery-metric",
      component: "recovery-stat",
      kind: "count",
      atSec: 0.5,
      durationSec: 1.5,
      value: 94,
    }],
    moments: [{
      version: 1,
      id: "recovery-stat-lands",
      sceneId: "recovery-metric",
      atSec: 0.8,
      title: "Recovery statistic lands",
      visualState: "The recovery statistic is readable",
      change: "The count resolves",
      motionIntent: "count",
      importance: "primary",
    }],
    spatialIntent: {
      version: 1,
      focalPart: "recovery-stat",
      frameAnchor: "frame:center",
      composition: "centered recovery statistic",
      relationships: [],
    },
    camera: {
      version: 1,
      path: [{
        version: 1,
        move: "pull-back",
        fromRegion: "metric-wall",
        toRegion: "metric-wall",
        startSec: 0,
        durationSec: 2.6,
      }],
    },
  }];
  const graph = resolveContinuityGraph(scenes);
  const blocking = resolveCameraBlockingPlan(scenes, graph);
  const primary = blocking.scenes[0]!.phrases.find((phrase) =>
    phrase.importance === "primary" && phrase.target.id === "recovery-stat"
  );
  if (!primary) throw new Error("single-subject fixture did not resolve its primary metric");
  primary.startSec = 0;
  primary.arrivalSec = 0;
  primary.endSec = 2;
  primary.dwell = { startSec: 0, endSec: 2.5, readableSec: 2.5 };
  blocking.scenes[0]!.phrases = [primary];
  const camera = resolveCameraPlan(scenes);
  return `<!doctype html><html><head><meta charset="utf-8">
<script src="gsap.min.js"></script><script src="${CAMERA_RUNTIME_FILE}"></script><script src="${CONTINUITY_RUNTIME_FILE}"></script>
<style>*{box-sizing:border-box}html,body{margin:0;width:1920px;height:1080px;overflow:hidden;background:#fff}
#root,.scene{position:absolute;inset:0;overflow:hidden}.world{position:relative;width:3520px;height:1080px}
.station{position:absolute;left:1860px;top:140px;width:1400px;height:800px;display:flex;align-items:center;justify-content:center;background:#fff}
.metric{width:620px;height:340px;border:2px solid #5c4a63;border-radius:20px;background:#fff;color:#171717;display:grid;place-items:center;font:900 120px Arial}</style></head><body>
<main id="root" data-composition-id="single-subject-context" data-width="1920" data-height="1080" data-duration="4">
<section class="scene" data-scene="recovery-metric"><div class="world" data-camera-world>
<div class="station" data-region="metric-wall"><div class="metric" data-layout-important data-component="stat-card" data-part="recovery-stat" data-continuity-entity="metric">94%</div></div>
</div></section></main>
<script type="application/json" id="sequences-camera">${JSON.stringify(camera)}</script>
<script type="application/json" id="sequences-continuity">${JSON.stringify(graph)}</script>
<script type="application/json" id="sequences-camera-blocking">${JSON.stringify(blocking)}</script>
<script>window.__timelines={};const tl=gsap.timeline({paused:true});
SequencesCamera.compile(tl,document.getElementById("root"));
SequencesContinuity.compile(tl,document.getElementById("root"));
window.__timelines["single-subject-context"]=tl;tl.seek(0,false);</script></body></html>`;
}

function longTailFilm(): string {
  const scenes: DirectScene[] = [{
    id: "tail-scene",
    title: "Long readable result",
    purpose: "hold a product result without freezing",
    startSec: 0,
    durationSec: 6,
    components: [{
      version: 1,
      id: "result-card",
      kind: "stat-card",
      role: "hero",
      entityId: "result",
    }],
    beats: [{
      version: 1,
      id: "result-count",
      sceneId: "tail-scene",
      component: "result-card",
      kind: "count",
      atSec: 0.7,
      durationSec: 0.5,
      value: 98,
    }],
    moments: [{
      version: 1,
      id: "result-lands",
      sceneId: "tail-scene",
      atSec: 1,
      title: "Result lands",
      visualState: "The result is readable",
      change: "Count resolves",
      motionIntent: "count",
      importance: "primary",
    }],
    spatialIntent: {
      version: 1,
      focalPart: "result-card",
      composition: "centered result",
      relationships: [],
    },
    camera: {
      version: 1,
      path: [{
        version: 1,
        move: "hold",
        toPart: "result-card",
        startSec: 0,
        durationSec: 6,
      }],
    },
  }];
  const graph = resolveContinuityGraph(scenes);
  const blocking = resolveCameraBlockingPlan(scenes, graph);
  const primary = blocking.scenes[0]!.phrases.find((phrase) => phrase.importance === "primary")!;
  primary.startSec = 0;
  primary.arrivalSec = 0.6;
  primary.endSec = 1.8;
  primary.dwell = { startSec: 0.6, endSec: 1.6, readableSec: 1 };
  blocking.scenes[0]!.phrases = [primary];
  const camera = resolveCameraPlan(scenes);
  return `<!doctype html><html><head><meta charset="utf-8">
<script src="gsap.min.js"></script><script src="${CAMERA_RUNTIME_FILE}"></script><script src="${CONTINUITY_RUNTIME_FILE}"></script>
<style>*{box-sizing:border-box}html,body{margin:0;width:1920px;height:1080px;overflow:hidden;background:#fff}
#root,.scene{position:absolute;inset:0;overflow:hidden}.world{position:relative;width:1920px;height:1080px}
.card{position:absolute;left:660px;top:340px;width:600px;height:360px;border-radius:40px;background:#ff5a5f;color:#fff;display:grid;place-items:center;font:800 84px Arial}</style></head><body>
<main id="root" data-composition-id="tail-browser" data-width="1920" data-height="1080" data-duration="6">
<section class="scene" data-scene="tail-scene"><div class="world" data-camera-world>
<div class="card" data-component="stat-card" data-part="result-card" data-continuity-entity="result">98%</div>
</div></section></main>
<script type="application/json" id="sequences-camera">${JSON.stringify(camera)}</script>
<script type="application/json" id="sequences-continuity">${JSON.stringify(graph)}</script>
<script type="application/json" id="sequences-camera-blocking">${JSON.stringify(blocking)}</script>
<script>window.__timelines={};const tl=gsap.timeline({paused:true});
SequencesCamera.compile(tl,document.getElementById("root"));
SequencesContinuity.compile(tl,document.getElementById("root"));
window.__timelines["tail-browser"]=tl;tl.seek(0,false);</script></body></html>`;
}

function serveDir(dir: string): Promise<{ url: string; close: () => Promise<void> }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((request, response) => {
      const pathname = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
      const file = path.resolve(dir, "." + pathname.replace(/\/$/, "/index.html"));
      if (!file.startsWith(path.resolve(dir)) || !fs.existsSync(file)) {
        response.writeHead(404); response.end(); return;
      }
      response.writeHead(200, {
        "content-type": path.extname(file) === ".js" ? "text/javascript" : "text/html",
      });
      response.end(fs.readFileSync(file));
    });
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") return reject(new Error("could not bind"));
      resolve({
        url: `http://127.0.0.1:${address.port}/index.html`,
        close: () => new Promise<void>((done) => server.close(() => done())),
      });
    });
  });
}

describe("continuity + camera blocking browser runtime", () => {
  it("lands measured product occupancy and carries the entity through hard cuts deterministically", async () => {
    const browserPath = findBrowserExecutable();
    expect(browserPath).toBeTruthy();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sequences-continuity-browser-"));
    roots.push(dir);
    fs.writeFileSync(path.join(dir, "index.html"), film(), "utf8");
    const require = createRequire(import.meta.url);
    fs.copyFileSync(require.resolve("gsap/dist/gsap.min.js"), path.join(dir, "gsap.min.js"));
    fs.writeFileSync(path.join(dir, CAMERA_RUNTIME_FILE), cameraRuntimeSource(), "utf8");
    fs.writeFileSync(path.join(dir, CONTINUITY_RUNTIME_FILE), continuityRuntimeSource(), "utf8");
    const server = await serveDir(dir);
    const browser = await launchHeadlessBrowser({
      executablePath: browserPath!,
      headless: true,
      args: ["--hide-scrollbars", "--mute-audio", "--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage"],
    });
    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(String(error)));
      await page.goto(server.url, { waitUntil: "networkidle0", timeout: 30_000 });
      await page.waitForFunction(() => Boolean((window as unknown as { __timelines?: object }).__timelines));
      const stateAt = (time: number) => page.evaluate((at: number) => {
        const timeline = (window as unknown as {
          __timelines: Record<string, { seek: (time: number, suppress?: boolean) => void }>;
        }).__timelines["continuity-browser"]!;
        timeline.seek(at, false);
        const shell = document.querySelector<HTMLElement>(at < 3 ? '[data-part="shell-1"]' : '[data-part="shell-2"]')!;
        const rect = shell.getBoundingClientRect();
        const bridges = Array.from(document.querySelectorAll<HTMLElement>("[data-sequences-runtime-continuity]"))
          .map((element) => ({ opacity: Number(getComputedStyle(element).opacity), transform: element.style.transform }))
          // Hidden future bridges do not paint; their live-measured geometry is
          // intentionally refreshed only when their own boundary activates.
          .filter((bridge) => bridge.opacity > 0.001);
        return {
          occupancy: rect.width * rect.height / (1920 * 1080),
          centerX: rect.left + rect.width / 2,
          centerY: rect.top + rect.height / 2,
          bridges,
          bindings: (window as unknown as { __sequencesContinuityBindings?: unknown[] }).__sequencesContinuityBindings ?? [],
          world: document.querySelector<HTMLElement>(at < 3 ? "#scene-1 .world" : "#scene-2 .world")!.style.transform,
        };
      }, time);

      const landing = await stateAt(1.5);
      expect(landing.occupancy).toBeGreaterThan(0.35);
      expect(landing.occupancy).toBeLessThan(0.5);
      // A readable landing is operated, not frozen: the camera runtime may
      // float by at most ~0.6% of the short frame edge while remaining inside
      // a tight eight-pixel anchor budget.
      expect(Math.abs(landing.centerX - 960)).toBeLessThanOrEqual(8);
      expect(Math.abs(landing.centerY - 540)).toBeLessThanOrEqual(8);
      expect(landing.bindings).toHaveLength(2);
      // A late supporting annotation remains local motion; after a primary
      // camera block exists it cannot pull the lens into an epilogue reframe.
      const afterLateSupport = await stateAt(2.8);
      expect(afterLateSupport.occupancy).toBeGreaterThan(0.35);
      expect(afterLateSupport.occupancy).toBeLessThan(0.5);
      expect(Math.abs(afterLateSupport.centerX - 960)).toBeLessThanOrEqual(12);
      expect(Math.abs(afterLateSupport.centerY - 540)).toBeLessThanOrEqual(12);
      // A supporting phrase on the SAME owned pose extends the operated hold
      // without reframing to the unrelated annotation.
      const samePoseStart = await stateAt(2.15);
      const samePoseAlive = await stateAt(2.48);
      expect(Math.hypot(
        samePoseAlive.centerX - samePoseStart.centerX,
        samePoseAlive.centerY - samePoseStart.centerY,
      )).toBeGreaterThan(0.25);
      const handoff = await stateAt(3.05);
      expect(handoff.bridges.some((bridge) => bridge.opacity > 0.05)).toBe(true);
      await stateAt(8.5);
      await stateAt(0.2);
      expect(await stateAt(3.05)).toEqual(handoff);
      expect(errors).toEqual([]);
    } finally {
      await browser.close();
      await server.close();
    }
  }, 45_000);

  it("spends an authored opener on a macro approach, then holds a contextual primary readably", async () => {
    const browserPath = findBrowserExecutable();
    expect(browserPath).toBeTruthy();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sequences-camera-approach-"));
    roots.push(dir);
    fs.writeFileSync(path.join(dir, "index.html"), approachFilm(), "utf8");
    const require = createRequire(import.meta.url);
    fs.copyFileSync(require.resolve("gsap/dist/gsap.min.js"), path.join(dir, "gsap.min.js"));
    fs.writeFileSync(path.join(dir, CAMERA_RUNTIME_FILE), cameraRuntimeSource(), "utf8");
    fs.writeFileSync(path.join(dir, CONTINUITY_RUNTIME_FILE), continuityRuntimeSource(), "utf8");
    const server = await serveDir(dir);
    const browser = await launchHeadlessBrowser({
      executablePath: browserPath!,
      headless: true,
      args: ["--hide-scrollbars", "--mute-audio", "--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage"],
    });
    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(String(error)));
      await page.goto(server.url, { waitUntil: "networkidle0", timeout: 30_000 });
      const stateAt = (time: number) => page.evaluate((at: number) => {
        const timeline = (window as unknown as {
          __timelines: Record<string, { seek: (time: number, suppress?: boolean) => void }>;
        }).__timelines["approach-browser"]!;
        timeline.seek(at, false);
        const metric = document.querySelector<HTMLElement>('[data-part="primary-metric"]')!;
        const rect = metric.getBoundingClientRect();
        const companion = document.querySelector<HTMLElement>(".companion")!.getBoundingClientRect();
        const contextTitle = document.querySelector<HTMLElement>(".context-title")!.getBoundingClientRect();
        return {
          centerX: rect.left + rect.width / 2,
          centerY: rect.top + rect.height / 2,
          occupancy: rect.width * rect.height / (1920 * 1080),
          companion: {
            left: companion.left,
            top: companion.top,
            right: companion.right,
            bottom: companion.bottom,
          },
          contextTitle: {
            left: contextTitle.left,
            top: contextTitle.top,
            right: contextTitle.right,
            bottom: contextTitle.bottom,
          },
          world: document.querySelector<HTMLElement>(".world")!.style.transform,
        };
      }, time);

      const opening = await stateAt(0);
      const middle = await stateAt(1.25);
      const landed = await stateAt(2.5);
      const alive = await stateAt(3.05);
      const returned = await stateAt(3.8);
      const openingContextDistance = Math.hypot(
        (opening.companion.left + opening.companion.right) / 2 -
          (landed.companion.left + landed.companion.right) / 2,
        (opening.companion.top + opening.companion.bottom) / 2 -
          (landed.companion.top + landed.companion.bottom) / 2,
      );
      const middleContextDistance = Math.hypot(
        (middle.companion.left + middle.companion.right) / 2 -
          (landed.companion.left + landed.companion.right) / 2,
        (middle.companion.top + middle.companion.bottom) / 2 -
          (landed.companion.top + landed.companion.bottom) / 2,
      );
      // The surrounding ensemble performs the macro approach while the
      // addressed metric stays comparatively stable: visible travel without
      // making the viewer reacquire the subject.
      expect(openingContextDistance).toBeGreaterThan(90);
      expect(middleContextDistance).toBeGreaterThan(15);
      expect(middleContextDistance).toBeLessThan(openingContextDistance);
      // The metric grows materially while its declared contextual companion
      // remains delivery-safe; a coherent ensemble beats cropping the panel
      // merely to satisfy a button/metric area target.
      expect(landed.occupancy).toBeGreaterThanOrEqual(0.015);
      expect(landed.companion.left).toBeGreaterThanOrEqual(60);
      expect(landed.companion.top).toBeGreaterThanOrEqual(60);
      expect(landed.companion.right).toBeLessThanOrEqual(1860);
      expect(landed.companion.bottom).toBeLessThanOrEqual(1020);
      expect(landed.contextTitle.left).toBeGreaterThanOrEqual(60);
      expect(landed.contextTitle.top).toBeGreaterThanOrEqual(60);
      expect(landed.contextTitle.right).toBeLessThanOrEqual(1860);
      expect(landed.contextTitle.bottom).toBeLessThanOrEqual(1020);
      expect(landed.centerX).toBeGreaterThanOrEqual(85);
      expect(landed.centerX).toBeLessThanOrEqual(1835);
      expect(landed.centerY).toBeGreaterThanOrEqual(85);
      expect(landed.centerY).toBeLessThanOrEqual(995);
      // A short dwell is the audience's reading window: the lens now RESTS
      // through it (no float, no scale breathe) so glyphs are not in constant
      // subpixel motion — the measured "shaky text" source on the
      // motion-quality-verify-1 render. Long merged holds keep their
      // translate-only drift (proven by the merged-dwell test above).
      const livingDistance = Math.hypot(
        alive.centerX - landed.centerX,
        alive.centerY - landed.centerY,
      );
      expect(livingDistance).toBeLessThan(0.25);
      expect(Math.abs(returned.centerX - landed.centerX)).toBeLessThan(0.25);
      expect(Math.abs(returned.centerY - landed.centerY)).toBeLessThan(0.25);
      expect(new Set([opening.world, middle.world]).size).toBe(2);
      expect(errors).toEqual([]);
    } finally {
      await browser.close();
      await server.close();
    }
  }, 45_000);

  it("uses subject occupancy when a named context collapses to that same subject", async () => {
    const browserPath = findBrowserExecutable();
    expect(browserPath).toBeTruthy();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sequences-camera-single-context-"));
    roots.push(dir);
    fs.writeFileSync(path.join(dir, "index.html"), singleSubjectContextFilm(), "utf8");
    const require = createRequire(import.meta.url);
    fs.copyFileSync(require.resolve("gsap/dist/gsap.min.js"), path.join(dir, "gsap.min.js"));
    fs.writeFileSync(path.join(dir, CAMERA_RUNTIME_FILE), cameraRuntimeSource(), "utf8");
    fs.writeFileSync(path.join(dir, CONTINUITY_RUNTIME_FILE), continuityRuntimeSource(), "utf8");
    const server = await serveDir(dir);
    const browser = await launchHeadlessBrowser({
      executablePath: browserPath!,
      headless: true,
      args: ["--hide-scrollbars", "--mute-audio", "--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage"],
    });
    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(String(error)));
      await page.goto(server.url, { waitUntil: "networkidle0", timeout: 30_000 });
      const occupancy = await page.evaluate(() => {
        const timeline = (window as unknown as {
          __timelines: Record<string, { seek: (time: number, suppress?: boolean) => void }>;
        }).__timelines["single-subject-context"]!;
        timeline.seek(0.6, false);
        const rect = document.querySelector<HTMLElement>('[data-part="recovery-stat"]')!
          .getBoundingClientRect();
        return rect.width * rect.height / (1920 * 1080);
      });

      // `stat-card` primary contract: 1.5–24%. The enclosing station has no
      // independent painted context, so its 30% ensemble preference must not
      // be applied to the exact same measured rectangle.
      expect(occupancy).toBeGreaterThanOrEqual(0.015 * 0.9);
      expect(occupancy).toBeLessThanOrEqual(0.24 * 1.1);
      expect(Math.abs(occupancy - 0.06)).toBeLessThan(0.005);
      expect(errors).toEqual([]);
    } finally {
      await browser.close();
      await server.close();
    }
  }, 45_000);

  it("keeps a multi-second graph-owned tail measurably alive", async () => {
    const browserPath = findBrowserExecutable();
    expect(browserPath).toBeTruthy();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sequences-camera-tail-"));
    roots.push(dir);
    fs.writeFileSync(path.join(dir, "index.html"), longTailFilm(), "utf8");
    const require = createRequire(import.meta.url);
    fs.copyFileSync(require.resolve("gsap/dist/gsap.min.js"), path.join(dir, "gsap.min.js"));
    fs.writeFileSync(path.join(dir, CAMERA_RUNTIME_FILE), cameraRuntimeSource(), "utf8");
    fs.writeFileSync(path.join(dir, CONTINUITY_RUNTIME_FILE), continuityRuntimeSource(), "utf8");
    const server = await serveDir(dir);
    const browser = await launchHeadlessBrowser({
      executablePath: browserPath!,
      headless: true,
      args: ["--hide-scrollbars", "--mute-audio", "--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage"],
    });
    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(String(error)));
      await page.goto(server.url, { waitUntil: "networkidle0", timeout: 30_000 });
      const stateAt = (time: number) => page.evaluate((at: number) => {
        const timeline = (window as unknown as {
          __timelines: Record<string, { seek: (time: number, suppress?: boolean) => void }>;
        }).__timelines["tail-browser"]!;
        timeline.seek(at, false);
        const rect = document.querySelector<HTMLElement>('[data-part="result-card"]')!
          .getBoundingClientRect();
        return {
          centerX: rect.left + rect.width / 2,
          centerY: rect.top + rect.height / 2,
          width: rect.width,
          height: rect.height,
          visible:
            rect.left >= 0 && rect.top >= 0 &&
            rect.right <= 1920 && rect.bottom <= 1080,
        };
      }, time);
      const a = await stateAt(4);
      const b = await stateAt(4.2);
      const dt = 0.2;
      const diagonal = Math.hypot(1920, 1080);
      const speed = Math.hypot(
        (b.centerX - a.centerX) / diagonal / dt,
        (b.centerY - a.centerY) / diagonal / dt,
        Math.log(
          Math.sqrt(b.width * b.height) /
            Math.sqrt(a.width * a.height),
        ) * 0.25 / dt,
      );
      expect(speed).toBeGreaterThan(0.002);
      expect(speed).toBeLessThan(0.012);
      expect(a.visible).toBe(true);
      expect(b.visible).toBe(true);
      await stateAt(5.8);
      await stateAt(0.2);
      expect(await stateAt(4.2)).toEqual(b);
      expect(errors).toEqual([]);
    } finally {
      await browser.close();
      await server.close();
    }
  }, 45_000);
});
