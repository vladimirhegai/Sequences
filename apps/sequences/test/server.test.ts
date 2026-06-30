import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { once } from "node:events";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDefaultProject } from "@sequences/core";
import { startStudio } from "../src/server.ts";
import {
  contentAssetId,
  extractAssetMetadata,
  sha256File,
} from "@sequences/platform/asset-metadata";

let dir: string;
let server: http.Server;
let baseUrl: string;

beforeAll(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "seq-server-"));
  fs.mkdirSync(path.join(dir, "assets"), { recursive: true });
  fs.writeFileSync(path.join(dir, "assets", "unsafe.svg"), '<svg><script>alert("x")</script></svg>');
  const project = createDefaultProject({ title: "Server Test" });
  const unsafeFile = path.join(dir, "assets", "unsafe.svg");
  const contentHash = sha256File(unsafeFile);
  project.assets.push({
    id: contentAssetId(contentHash),
    path: "assets/unsafe.svg",
    kind: "image",
    contentHash,
    metadata: extractAssetMetadata(unsafeFile, "image"),
  });
  fs.writeFileSync(path.join(dir, "project.json"), JSON.stringify(project, null, 2) + "\n");

  server = startStudio(dir, 0);
  if (!server.listening) await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("studio did not bind a TCP port");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  if (server?.listening) {
    server.close();
    await once(server, "close");
  }
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("studio server boundaries", () => {
  it("serves normal localhost requests", async () => {
    const response = await fetch(`${baseUrl}/api/state`);
    expect(response.status).toBe(200);
    expect((await response.json()).project.meta.title).toBe("Server Test");
  });

  it("rejects cross-origin mutations and hostile Host headers", async () => {
    const hostileOrigin = await fetch(`${baseUrl}/api/command`, {
      method: "POST",
      headers: { "content-type": "text/plain", origin: "https://evil.example" },
      body: JSON.stringify({
        command: { type: "SetSceneDuration", sceneId: "hook", durationFrames: 120 },
      }),
    });
    expect(hostileOrigin.status).toBe(403);

    const address = server.address();
    if (!address || typeof address === "string") throw new Error("studio port unavailable");
    const hostileHost = await new Promise<number | undefined>((resolve, reject) => {
      const request = http.get(
        {
          hostname: "127.0.0.1",
          port: address.port,
          path: "/api/state",
          headers: { host: `evil.example:${address.port}` },
        },
        (response) => {
          response.resume();
          response.on("end", () => resolve(response.statusCode));
        },
      );
      request.on("error", reject);
    });
    expect(hostileHost).toBe(403);
  });

  it("rejects unknown agent providers before exposing them to the UI", async () => {
    const response = await fetch(`${baseUrl}/api/agent/plan`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ brief: "test", provider: "<img src=x onerror=alert(1)>" }),
    });
    expect(response.status).toBe(400);
    expect(await response.text()).toContain("unknown agent provider");
  });

  it("stops oversized request buffering and remains responsive", async () => {
    const response = await fetch(`${baseUrl}/api/command`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: " ".repeat(16_000_100),
    });
    expect(response.status).toBe(413);
    expect((await fetch(`${baseUrl}/api/state`)).status).toBe(200);
  });

  it("sandboxes user-supplied SVG responses", async () => {
    const response = await fetch(`${baseUrl}/assets/unsafe.svg`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-security-policy")).toBe("sandbox");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("serves a live, compiled extension preview with its vendor scripts", async () => {
    const preview = await fetch(`${baseUrl}/ext-preview/enter.fadeIn.html?type=primitive`);
    expect(preview.status).toBe(200);
    expect(preview.headers.get("content-type")).toContain("text/html");
    const html = await preview.text();
    // Real composition, not a pre-rendered image: GSAP timeline + the demo text.
    expect(html).toContain("window.__timelines");
    expect(html).toContain('<script src="gsap.min.js">');
    expect(html).toContain("Fade In");

    // The doc's relative <script src> tags resolve to sibling vendor files.
    const vendor = await fetch(`${baseUrl}/ext-preview/gsap.min.js`);
    expect(vendor.status).toBe(200);
  });

  it("rejects bad or unknown extension previews", async () => {
    expect((await fetch(`${baseUrl}/ext-preview/enter.fadeIn.html?type=bogus`)).status).toBe(400);
    expect((await fetch(`${baseUrl}/ext-preview/enter.nope.html?type=primitive`)).status).toBe(404);
  });

  it("supports zero-token structured directions and tweaks", async () => {
    const directions = await fetch(`${baseUrl}/api/agent/directions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        structured: {
          productName: "Pulse",
          audience: "founders",
          promise: "See the next move",
          features: ["Live answers", "Fast alerts", "Clear reports"],
          cta: "Start free",
          vibe: 75,
        },
      }),
    });
    expect(directions.status).toBe(200);
    const directionJson = await directions.json();
    expect(directionJson.mode).toBe("zero-token");
    expect(directionJson.directions).toHaveLength(3);

    const before = (await (await fetch(`${baseUrl}/api/state`)).json()).project.scenes[0].durationFrames;
    const tweak = await fetch(`${baseUrl}/api/agent/tweak`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "make it slower", sceneId: "hook", layerId: "headline" }),
    });
    expect(tweak.status).toBe(200);
    const tweakJson = await tweak.json();
    expect(tweakJson.tweak.mode).toBe("zero-token");
    expect(tweakJson.project.scenes[0].durationFrames).toBeGreaterThan(before);
  });
});
