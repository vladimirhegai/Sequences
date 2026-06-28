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

beforeAll(async () => {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "forge-stage-srv-"));
  server = startForge({ extensionsDir: EXT_ROOT, docDir: work, port: 0 });
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

describe("Forge server — Stage AI surface", () => {
  it("adds, serves, lists and deletes markdown reference docs", async () => {
    const added = await postJson("/api/docs/add", { name: "design.md", text: "# Brand\nUse graphite + silver." });
    expect(added.ok).toBe(true);
    const id: string = added.doc.id;

    const list = await getJson("/api/docs");
    expect(list.docs.some((d: { id: string }) => d.id === id)).toBe(true);

    const file = await fetch(`${base}/api/docs/file?id=${encodeURIComponent(id)}`);
    expect(file.status).toBe(200);
    expect(await file.text()).toContain("graphite + silver");

    const removed = await postJson("/api/docs/delete", { id });
    expect(removed.ok).toBe(true);
    expect(removed.docs.some((d: { id: string }) => d.id === id)).toBe(false);
  });

  it("stores a pasted clipboard image in the hidden scratch library", async () => {
    // 1x1 transparent PNG.
    const png =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const res = await postJson("/api/stage/paste", { fileName: "clip.png", base64: png });
    expect(res.ok).toBe(true);
    expect(res.id).toMatch(/^scratch-/);
    expect(res.kind).toBe("image");
  });

  it("rejects an empty Stage chat message with a 400 (no provider call)", async () => {
    const res = await fetch(`${base}/api/stage/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "   " }),
    });
    expect(res.status).toBe(400);
  });

  it("streams Stage chat validation errors as SSE", async () => {
    const res = await fetch(`${base}/api/stage/chat/stream`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "   " }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const text = await res.text();
    expect(text).toContain("event: result");
    expect(text).toContain("message is empty");
  });
});
