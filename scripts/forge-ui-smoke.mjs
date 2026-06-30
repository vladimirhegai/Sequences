import puppeteer from "puppeteer-core";
import { existsSync } from "node:fs";

const port = process.argv[2] ?? "4500";
const executablePath = process.env.SEQUENCES_BROWSER_PATH ?? [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
].find((candidate) => existsSync(candidate));
if (!executablePath) throw new Error("no Edge found");

const browser = await puppeteer.launch({ executablePath, headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 900 });
const errors = [];
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});
page.on("pageerror", (error) => errors.push(String(error)));
page.on("response", (response) => {
  if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
});

await page.goto(`http://localhost:${port}/`, { waitUntil: "networkidle0", timeout: 20_000 });
const result = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const clickTab = async (name) => {
    document.querySelector(`.tab[data-tab="${name}"]`)?.click();
    await sleep(80);
  };
  const checkPane = async (name) => {
    await clickTab(name);
    const host = document.getElementById(`${name}Agent`);
    const segBtns = () => [...(host?.querySelectorAll(".mode-seg-btn") ?? [])];
    const activeLabel = () => segBtns().find((b) => b.classList.contains("active"))?.textContent?.trim();
    const before = activeLabel();
    // the second segment is "Plan" — clicking it switches into plan mode
    segBtns()[1]?.click();
    await sleep(50);
    const after = activeLabel();
    const selects = [...(host?.querySelectorAll(".cbar-select") ?? [])].map((select) => select.value);
    return {
      before,
      after,
      planActive: segBtns()[1]?.classList.contains("active") ?? false,
      selectCount: selects.length,
      provider: selects[0],
      model: selects[1],
      sendPresent: !!host?.querySelector(".send-btn"),
    };
  };
  return {
    stage: await checkPane("stage"),
    create: await checkPane("create"),
    tabs: [...document.querySelectorAll(".tab[data-tab]")].map((tab) => tab.dataset.tab),
  };
});

await browser.close();
console.log(JSON.stringify({ result, errors }, null, 2));
if (
  errors.length ||
  !result.stage.planActive ||
  !result.create.planActive ||
  result.stage.selectCount < 3 ||
  result.create.selectCount < 3
) {
  process.exitCode = 1;
}
