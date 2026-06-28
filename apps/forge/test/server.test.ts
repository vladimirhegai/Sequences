import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type http from "node:http";
import type { AddressInfo } from "node:net";
import { startForge } from "../src/server.ts";

const EXT_ROOT = path.resolve(import.meta.dirname, "..", "..", "..", "examples", "forge", "extensions");

let server: http.Server;
let base: string;
let extRoot: string;

beforeAll(async () => {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "forge-srv-"));
  extRoot = fs.mkdtempSync(path.join(os.tmpdir(), "forge-ext-"));
  fs.cpSync(EXT_ROOT, extRoot, { recursive: true });
  server = startForge({ extensionsDir: extRoot, docDir: work, port: 0 });
  await new Promise<void>((r) => (server.listening ? r() : server.once("listening", () => r())));
  base = `http://localhost:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((r) => server.close(() => r()));
});

const getJson = (u: string) => fetch(`${base}${u}`).then((r) => r.json());
const postJson = (u: string, b: unknown) =>
  fetch(`${base}${u}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }).then(
    (r) => r.json(),
  );

describe("Forge server — the stage wiring", () => {
  it("serves a compiled document outline + real token ids", async () => {
    const doc = await getJson("/api/doc");
    expect(doc.sceneId).toBe("stage");
    expect(doc.layers.length).toBeGreaterThan(0);
    const tokens = await getJson("/api/tokens");
    expect(tokens.colorTokens.length).toBeGreaterThan(0);
    expect(tokens.enterPrimitives.length).toBeGreaterThan(0);
  });

  it("serves copilot provider metadata and lift previews", async () => {
    const providers = await getJson("/api/copilot/providers");
    expect(Array.isArray(providers.providers)).toBe(true);
    expect(providers.providers.some((provider: { id: string }) => provider.id === "antigravity-cli")).toBe(true);
    expect(providers.providers.some((provider: { id: string }) => provider.id === "openmodel-api")).toBe(true);

    const lifted = await postJson("/api/lift", {
      id: "enter.serverLift",
      summary: "A server-side lifted motion preview for Forge.",
      source: 'tl.fromTo(inner,{y:40,opacity:0},{y:0,opacity:1,duration:0.4,ease:"power3.out"},0);',
    });
    expect(lifted.ok).toBe(true);
    expect(lifted.lift.skeleton.length).toBe(1);
    expect(lifted.lift.tokens.yFromPx).toBe(40);
  });

  it("persists Create drafts, previews them, and exports the current draft", async () => {
    const saved = await postJson("/api/create/drafts/save", {
      name: "Server Draft Reveal",
      summary: "A server-persisted Forge Create draft for export.",
      route: "interface-reveal",
      primitiveKind: "enter",
      aspect: "16:9",
      taxonomy: {
        family: "app-ui",
        subject: "dashboard",
        action: "reveal",
        technique: ["slide"],
        energy: "calm",
        style: "mechanical",
      },
      liftSource: 'tl.fromTo(inner,{y:20,opacity:0},{y:0,opacity:1,duration:0.4,ease:"power3.out"},0);',
    });
    expect(saved.ok).toBe(true);
    expect(saved.draft.aspectLocked).toBe(true);

    const drafts = await getJson("/api/create/drafts");
    expect(drafts.currentId).toBe(saved.draft.id);

    const preview = await fetch(`${base}/forge-create-preview/${encodeURIComponent(saved.draft.id)}.html`);
    expect(preview.status).toBe(200);
    expect(await preview.text()).toContain("data-composition-id");

    const exported = await postJson("/api/doc/export", { draftId: saved.draft.id });
    expect(exported.ok).toBe(true);
    expect(exported.dir).toContain("enter.serverDraftReveal.seqext");
  });

  it("adds an object and moves it through typed commands", async () => {
    const add = await postJson("/api/doc/add", { kind: "text", text: "Server headline" });
    expect(add.ok).toBe(true);
    const id: string = add.id;

    const moved = await postJson("/api/doc/command", {
      command: { type: "MoveLayer", sceneId: "stage", layerId: id, x: 200, y: 90 },
    });
    expect(moved.ok).toBe(true);
    const layer = moved.outline.layers.find((l: { id: string }) => l.id === id);
    expect(layer.box.x).toBe(200);
    expect(layer.box.y).toBe(90);

    // undo reverts the move; the object remains.
    const undone = await postJson("/api/doc/undo", {});
    expect(undone.layers.find((l: { id: string }) => l.id === id).box.x).not.toBe(200);
  });

  it("rejects a malformed command with a 400, not a crash", async () => {
    const res = await fetch(`${base}/api/doc/command`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ command: { type: "NotARealCommand" } }),
    });
    expect(res.status).toBe(400);
  });

  it("serves the live stage HTML compiled through the engine + vendor scripts", async () => {
    const stage = await fetch(`${base}/forge-doc/stage.html`);
    expect(stage.status).toBe(200);
    expect(await stage.text()).toContain("data-composition-id");
    const gsap = await fetch(`${base}/forge-doc/gsap.min.js`);
    expect(gsap.status).toBe(200);
    const staticGsap = await fetch(`${base}/static/vendor/gsap.min.js`);
    expect(staticGsap.status).toBe(200);
  });

  it("serves the shadcn/Tailwind preview vendors", async () => {
    const tw = await fetch(`${base}/static/vendor/tailwindcss-browser.js`);
    expect(tw.status).toBe(200);
    expect(tw.headers.get("content-type")).toContain("javascript");
    expect(await tw.text()).toContain("text/tailwindcss");

    const theme = await fetch(`${base}/static/vendor/shadcn-theme.css`);
    expect(theme.status).toBe(200);
    expect(theme.headers.get("content-type")).toContain("text/css");
    expect(theme.headers.get("access-control-allow-origin")).toBe("*");
    const themeText = await theme.text();
    expect(themeText).toContain("--primary");
    expect(themeText).toContain('@import "tailwindcss"');

    const cn = await fetch(`${base}/static/vendor/forge-cn.js`);
    expect(cn.status).toBe(200);
    expect(await cn.text()).toContain("window.cn");

    // An unknown vendor name still 404s (no path traversal / silent pass-through).
    const missing = await fetch(`${base}/static/vendor/does-not-exist.js`);
    expect(missing.status).toBe(404);

    const traversal = await fetch(`${base}/static/%2e%2e%5cserver.ts`);
    expect(traversal.status).toBe(403);
  });
});
