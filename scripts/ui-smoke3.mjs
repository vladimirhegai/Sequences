/* DOM smoke test for the workspace shell: Main Menu launcher, the top-bar
 * page tabs, and every workspace page (Media/Timeline/Render/Extensions).
 * Boot a studio first:
 *   node apps/sequences/src/cli.ts studio examples/sequences/demo-promo --port 4500
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
page.on("response", (response) => {
  if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
});

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
  const projectCard =
    document.querySelector("#launcher .lr-card.current") ??
    document.querySelector("#launcher .lr-card");
  projectCard.click();
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

  await go("Render");
  await sleep(700);
  result.renderPage = {
    fields: document.querySelectorAll("#page-render .field").length,
    stripScenes: document.querySelectorAll("#page-render .rd-strip-scene").length,
    stage: !!document.querySelector("#page-render .rd-stage"),
  };

  await go("Extensions");
  await sleep(450);
  const firstExtCard = document.querySelector("#page-extensions .ext-card");
  result.extensions = {
    cards: document.querySelectorAll("#page-extensions .ext-card").length,
    firstName: firstExtCard?.querySelector(".ext-card-name")?.textContent ?? null,
    firstKind: firstExtCard?.querySelector(".ext-card-kind")?.textContent ?? null,
    enabled: document.querySelectorAll("#page-extensions .ext-card.on").length,
  };
  const extCardOn = () => document.querySelector("#page-extensions .ext-card")?.classList.contains("on") ?? false;
  const beforeToggle = extCardOn();
  firstExtCard?.click();
  await sleep(450);
  result.extensions.toggled = beforeToggle !== extCardOn();
  document.getElementById("undoBtn").click();
  await sleep(450);
  result.extensions.undoRestored = beforeToggle === extCardOn();
  document.querySelector("#page-extensions .ext-card .ext-view-btn")?.click();
  await sleep(250);
  result.extensions.viewModal = !!document.querySelector("#modalBackdrop .ext-view-modal");
  // The preview is a live compiled composition, not a static image.
  const previewPlayer = document.querySelector("#modalBackdrop .ext-preview-stage hyperframes-player");
  result.extensions.previewPlayer = !!previewPlayer;
  result.extensions.previewSrc = previewPlayer?.getAttribute("src") ?? null;
  document.querySelector("#modalBackdrop .modal-foot .btn-ghost:last-child")?.click();

  await go("Timeline");
  result.timelineBack = document.querySelectorAll("#page-timeline .tl-scene").length;

  return result;
});

console.log(JSON.stringify({ out, errors }, null, 2));
await browser.close();
process.exit(errors.length > 0 ? 1 : 0);
