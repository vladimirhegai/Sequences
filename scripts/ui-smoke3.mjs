/* DOM smoke test for the workspace shell: Main Menu launcher, the top-bar
 * page tabs, and every workspace page (References/Media/Design/Storyboard/
 * Timeline/Render/Extensions). Boot a studio first:
 *   node apps/studio/src/cli.ts studio examples/demo-promo --port 4500
 *   node scripts/ui-smoke3.mjs 4500 */
import puppeteer from "puppeteer-core";

const port = process.argv[2] ?? "4500";
const candidates = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
];
const { existsSync } = await import("node:fs");
const executablePath = process.env.SEQUENCES_BROWSER_PATH ?? candidates.find((p) => existsSync(p));
if (!executablePath) throw new Error("no Edge found");

const browser = await puppeteer.launch({ executablePath, headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: 1680, height: 950 });

const errors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});
page.on("pageerror", (err) => errors.push(String(err)));

await page.goto(`http://localhost:${port}/`, { waitUntil: "domcontentloaded", timeout: 20000 });
await new Promise((r) => setTimeout(r, 3500));

const out = await page.evaluate(async () => {
  const $ = (id) => document.getElementById(id);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const result = {};

  /* ---- launcher ---- */
  result.launcherVisible = !$("launcher").classList.contains("hidden");
  result.launcherTitle = document.querySelector("#launcher .lr-title")?.textContent ?? null;
  result.launcherCards = document.querySelectorAll("#launcher .lr-card").length;
  result.launcherButtons = [...document.querySelectorAll("#launcher .lr-foot .btn")].map((b) => b.textContent.trim());

  // open the demo (first project card) → workspace
  const demoCard = document.querySelector("#launcher .lr-card");
  demoCard.click();
  await sleep(700);
  result.launcherClosedAfterOpen = $("launcher").classList.contains("hidden");

  /* ---- tabs ---- */
  const tabs = [...document.querySelectorAll("#pageTabs .page-tab")];
  result.tabCount = tabs.length;
  result.tabLabels = tabs.map((t) => t.title);

  const go = async (label) => {
    tabs.find((t) => t.title === label).click();
    await sleep(450);
  };

  await go("References");
  result.referencesCards = document.querySelectorAll("#page-references .refs-card").length;

  await go("Media");
  await sleep(800);
  result.mediaPanes = {
    fileItems: document.querySelectorAll("#page-media .fb-item").length,
    roots: document.querySelectorAll("#page-media .fb-root").length,
    bins: document.querySelectorAll("#page-media .bin-item").length,
    poolCards: document.querySelectorAll("#page-media .pool-card").length,
  };
  // preview the first pool asset
  document.querySelector("#page-media .pool-card")?.click();
  await sleep(300);
  result.mediaViewerShowsImage = !!document.querySelector("#page-media .mv-stage img");

  await go("Design");
  result.designTools = document.querySelectorAll("#page-design .tool-btn").length;
  // draw a rect programmatically
  const dsvg = document.querySelector("#page-design .design-canvas-wrap svg");
  const rectTool = [...document.querySelectorAll("#page-design .tool-btn")][1];
  rectTool.click();
  await sleep(150);
  const svg2 = document.querySelector("#page-design .design-canvas-wrap svg");
  const r = svg2.getBoundingClientRect();
  const fire = (node, type, x, y) =>
    node.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 1, clientX: x, clientY: y }));
  fire(svg2, "pointerdown", r.left + 50, r.top + 50);
  fire(svg2, "pointermove", r.left + 220, r.top + 160);
  fire(svg2, "pointerup", r.left + 220, r.top + 160);
  await sleep(250);
  result.designRectDrawn = !!document.querySelector("#page-design .design-canvas-wrap svg rect[data-id]");
  result.designPropsFields = document.querySelectorAll("#page-design .field").length;

  await go("Storyboard");
  await sleep(1200); // Excalidraw mounts async
  result.storyboard = {
    frames: document.querySelectorAll("#page-storyboard .sb-frame").length,
    tools: document.querySelectorAll("#page-storyboard .tool-btn").length,
    excalidrawMounted: !!document.querySelector("#page-storyboard .sb-excal-host .excalidraw canvas"),
    fontCatalog: (window.SequenceStoryboardExcalidraw?.FONT_FAMILIES ?? []).length,
  };
  // add a frame (persists through the sidecar PUT)
  document.querySelector("#page-storyboard .sb-add").click();
  await sleep(900);
  result.storyboard.framesAfterAdd = document.querySelectorAll("#page-storyboard .sb-frame").length;
  result.storyboard.excalidrawRemounted = !!document.querySelector("#page-storyboard .sb-excal-host .excalidraw canvas");
  result.storyboard.sidebarFields = document.querySelectorAll("#page-storyboard .field").length;
  // remove the frame we just added so the demo storyboard stays clean
  const lastFrame = [...document.querySelectorAll("#page-storyboard .sb-frame")].pop();
  lastFrame?.querySelector(".sf-del")?.click();
  await sleep(600);
  result.storyboard.framesAfterCleanup = document.querySelectorAll("#page-storyboard .sb-frame").length;

  await go("Render");
  await sleep(700);
  result.renderPage = {
    fields: document.querySelectorAll("#page-render .field").length,
    stripScenes: document.querySelectorAll("#page-render .rd-strip-scene").length,
    stage: !!document.querySelector("#page-render .rd-stage"),
  };

  await go("Extensions");
  result.extensionsEmpty = !!document.querySelector("#page-extensions .ext-empty");

  await go("Timeline");
  result.timelineBack = document.querySelectorAll("#page-timeline .tl-scene").length;

  return result;
});

console.log(JSON.stringify({ out, errors }, null, 2));
await browser.close();
process.exit(errors.length > 0 ? 1 : 0);
