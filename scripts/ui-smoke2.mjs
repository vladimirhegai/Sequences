/* Deep interaction smoke test: playback via custom transport, a real
 * command round-trip (ReorderScene via inspector button), undo, add-scene
 * menu. Usage: node scripts/ui-smoke2.mjs [port] */
import puppeteer from "puppeteer-core";
import { existsSync } from "node:fs";

const port = process.argv[2] ?? "4411";
const candidates = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
];
const executablePath = process.env.SEQUENCES_BROWSER_PATH ?? candidates.find((p) => existsSync(p));

const browser = await puppeteer.launch({ executablePath, headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 900 });
const errors = [];
page.on("pageerror", (err) => errors.push(String(err)));

await page.goto(`http://localhost:${port}/`, { waitUntil: "domcontentloaded", timeout: 20000 });
await new Promise((r) => setTimeout(r, 4000)); // let the player become ready

const out = {};

// 1) playback through the custom transport
out.playback = await page.evaluate(async () => {
  const tc0 = document.getElementById("timecode").textContent;
  document.getElementById("playBtn").click();
  await new Promise((r) => setTimeout(r, 900));
  const tcMid = document.getElementById("timecode").textContent;
  document.getElementById("playBtn").click(); // pause
  await new Promise((r) => setTimeout(r, 300));
  const playheadLeft = document.getElementById("tlPlayhead").style.left;
  return { tc0, tcMid, moved: tc0 !== tcMid, playheadLeft };
});

// 2) command round-trip: Scene tab → "Move later" → events.log increments
out.command = await page.evaluate(async () => {
  const before = document.getElementById("eventsChip").textContent;
  const sceneOrderBefore = [...document.querySelectorAll(".tl-scene-name")].map((n) => n.textContent);
  const moveLater = [...document.querySelectorAll("#inspectorBody .btn-sm")].find((b) =>
    b.textContent.includes("Move later"),
  );
  moveLater.click();
  await new Promise((r) => setTimeout(r, 700));
  const after = document.getElementById("eventsChip").textContent;
  const sceneOrderAfter = [...document.querySelectorAll(".tl-scene-name")].map((n) => n.textContent);
  return { before, after, sceneOrderBefore, sceneOrderAfter };
});

// 3) undo reverts it
out.undo = await page.evaluate(async () => {
  document.getElementById("undoBtn").click();
  await new Promise((r) => setTimeout(r, 700));
  return {
    order: [...document.querySelectorAll(".tl-scene-name")].map((n) => n.textContent),
    events: document.getElementById("eventsChip").textContent,
    redoEnabled: !document.getElementById("redoBtn").disabled,
  };
});

// 4) add-scene menu opens with archetypes
out.addMenu = await page.evaluate(async () => {
  document.getElementById("addSceneBtn").click();
  await new Promise((r) => setTimeout(r, 150));
  const opts = [...document.querySelectorAll("#addSceneWrap .menu-opt .mo-name")].map((n) => n.textContent);
  document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
  return opts;
});

// 5) profile menu + arrow-key seek
out.misc = await page.evaluate(async () => {
  document.getElementById("profileChip").click();
  await new Promise((r) => setTimeout(r, 150));
  const profiles = [...document.querySelectorAll("#profileChip .menu-opt .mo-name")].map((n) => n.textContent);
  document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
  const f0 = document.getElementById("frameLabel").textContent;
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", shiftKey: true, bubbles: true }));
  await new Promise((r) => setTimeout(r, 400));
  const f1 = document.getElementById("frameLabel").textContent;
  return { profiles, f0, f1 };
});

console.log(JSON.stringify({ out, errors }, null, 2));
await browser.close();
