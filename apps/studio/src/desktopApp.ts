import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type http from "node:http";

function commandPath(command: string): string | null {
  const locator = process.platform === "win32" ? "where" : "which";
  const result = spawnSync(locator, [command], { encoding: "utf8", shell: false });
  if (result.status !== 0) return null;
  return result.stdout.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? null;
}

function browserCandidates(): string[] {
  if (process.env.SEQUENCES_BROWSER_PATH) return [process.env.SEQUENCES_BROWSER_PATH];
  if (process.platform === "win32") {
    return [
      "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
      "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    ];
  }
  if (process.platform === "darwin") {
    return [
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
    ];
  }
  return [
    commandPath("microsoft-edge") ?? "",
    commandPath("google-chrome") ?? "",
    commandPath("chromium-browser") ?? "",
    commandPath("chromium") ?? "",
  ];
}

export function findAppBrowser(): string | null {
  return browserCandidates().find((candidate) => candidate && fs.existsSync(candidate)) ?? null;
}

export function openAppWindow(url: string, projectDir: string, server: http.Server): void {
  const browser = findAppBrowser();
  if (!browser) {
    console.log("no Chrome/Edge browser found for app mode; opening in a normal browser is still available:");
    console.log(`  ${url}`);
    return;
  }

  const profileDir = path.join(projectDir, ".sequences-app-profile");
  fs.mkdirSync(profileDir, { recursive: true });
  const child = spawn(
    browser,
    [
      `--app=${url}`,
      `--user-data-dir=${profileDir}`,
      "--no-first-run",
      "--disable-translate",
      "--window-size=1600,1000",
    ],
    { stdio: "ignore" },
  );

  console.log(`  app:      ${browser}`);
  child.once("error", (error) => {
    console.log(`app window failed to launch: ${error.message}`);
    console.log(`  studio:   ${url}`);
  });
  child.once("exit", () => {
    server.close(() => process.exit(0));
  });
  child.unref();
}
