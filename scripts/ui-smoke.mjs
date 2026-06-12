/* One-shot DOM smoke test for the revamped studio UI.
 * Usage: node scripts/ui-smoke.mjs [port]
 * Checks the page boots without console errors and that every major
 * region rendered with real data. Avoids screenshots (GSAP rAF stalls). */
import puppeteer from "puppeteer-core";

const port = process.argv[2] ?? "4411";
const candidates = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
];
const { existsSync } = await import("node:fs");
const executablePath = process.env.SEQUENCES_BROWSER_PATH ?? candidates.find((p) => existsSync(p));
if (!executablePath) throw new Error("no Edge found");

const browser = await puppeteer.launch({ executablePath, headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 900 });

const errors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});
page.on("pageerror", (err) => errors.push(String(err)));

await page.goto(`http://localhost:${port}/`, { waitUntil: "domcontentloaded", timeout: 20000 });
await new Promise((r) => setTimeout(r, 3500));

const checks = await page.evaluate(() => {
  const $ = (id) => document.getElementById(id);
  const text = (id) => ($(id) ? $(id).textContent.trim() : null);
  return {
    title: text("projectTitle"),
    projectPath: text("projectPath"),
    scenes: document.querySelectorAll(".tl-scene").length,
    laneRows: document.querySelectorAll(".tl-lane-row").length,
    ticks: document.querySelectorAll(".tl-tick").length,
    playhead: !!$("tlPlayhead"),
    player: !!document.querySelector("hyperframes-player"),
    timecode: text("timecode"),
    duration: text("durationLabel"),
    tabs: [...document.querySelectorAll("#inspectorTabs .tab")].map((t) => t.textContent),
    inspectorFields: document.querySelectorAll("#inspectorBody .field").length,
    lintChip: text("lintChip"),
    eventsChip: text("eventsChip"),
    buildInfo: text("buildInfo"),
    profileChip: text("profileChip"),
    agentMsgs: document.querySelectorAll("#agentBody .msg").length,
    providerChip: text("providerChip"),
    planBtnDisabled: $("planBtn") ? $("planBtn").disabled : null,
  };
});

// exercise: select scene 2, switch tabs, open lint popover, open agent setup modal
const interact = await page.evaluate(async () => {
  const out = {};
  const scenes = document.querySelectorAll(".tl-scene");
  scenes[1].dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 1 }));
  scenes[1].dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 1 }));
  await new Promise((r) => setTimeout(r, 200));
  out.selectedAfterClick = document.querySelector(".tl-scene.sel .tl-scene-name")?.textContent ?? null;

  const tabs = [...document.querySelectorAll("#inspectorTabs .tab")];
  for (const t of tabs) {
    t.click();
    await new Promise((r) => setTimeout(r, 120));
    out["tab_" + t.textContent] = document.getElementById("inspectorBody").children.length > 0;
  }
  tabs[0].click();

  document.getElementById("lintChip").click();
  await new Promise((r) => setTimeout(r, 120));
  out.lintPopItems = document.querySelectorAll("#lintPop .lint-item").length;
  document.getElementById("lintChip").click();

  document.getElementById("eventsChip").click();
  await new Promise((r) => setTimeout(r, 120));
  out.eventsPopOpen = !document.getElementById("eventsPop").classList.contains("hidden");
  document.getElementById("eventsChip").click();

  document.getElementById("projectMenuBtn").click();
  await new Promise((r) => setTimeout(r, 120));
  out.projectMenu = [...document.querySelectorAll("#projectMenuBtn .menu-opt .mo-name")].map((n) => n.textContent);
  document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));

  const setupBtn = [...document.querySelectorAll("#agentBody .btn-sm")].find((b) => b.textContent.includes("Agent setup"));
  setupBtn.click();
  await new Promise((r) => setTimeout(r, 150));
  out.modalProviderCards = document.querySelectorAll("#modalBackdrop .prov-card").length;
  out.modalCmdLines = document.querySelectorAll("#modalBackdrop .cmd-line").length;
  document.querySelector("#modalBackdrop .btn-ghost")?.click();
  return out;
});

console.log(JSON.stringify({ checks, interact, errors }, null, 2));
await browser.close();
