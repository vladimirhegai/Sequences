import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { createDefaultProject } from "@sequences/core";

const CLI = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "cli.ts");

let dir: string;
let child: ChildProcessWithoutNullStreams;
let rl: readline.Interface;
let nextId = 1;
const pending = new Map<number, (msg: Record<string, unknown>) => void>();

function request(method: string, params?: Record<string, unknown>): Promise<Record<string, unknown>> {
  const id = nextId++;
  const promise = new Promise<Record<string, unknown>>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting for ${method}`)), 15_000);
    pending.set(id, (msg) => {
      clearTimeout(timer);
      resolve(msg);
    });
  });
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  return promise;
}

async function callTool(name: string, args: Record<string, unknown> = {}): Promise<{ text: string; isError: boolean }> {
  const msg = await request("tools/call", { name, arguments: args });
  const result = msg.result as {
    content: Array<{ type: string; text: string }>;
    isError?: boolean;
  };
  return { text: result.content.map((c) => c.text).join("\n"), isError: result.isError === true };
}

beforeAll(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "seq-mcp-"));
  fs.writeFileSync(
    path.join(dir, "project.json"),
    JSON.stringify(createDefaultProject({ title: "MCP Test", brandName: "Acme" }), null, 2),
  );
  fs.writeFileSync(path.join(dir, "events.log"), "");
  fs.writeFileSync(
    path.join(dir, "storyboard.json"),
    JSON.stringify(
      {
        version: 1,
        frames: [
          {
            id: "frame-1",
            name: "Sketch",
            comment: "open on the dashboard and push toward the analytics card",
            items: [{ id: "note", type: "text", x: 18, y: 22, text: "Show dashboard" }],
          },
        ],
      },
      null,
      2,
    ),
  );

  child = spawn(process.execPath, [CLI, "mcp", dir], { stdio: ["pipe", "pipe", "pipe"] });
  rl = readline.createInterface({ input: child.stdout });
  rl.on("line", (line) => {
    try {
      const msg = JSON.parse(line) as { id?: number };
      if (typeof msg.id === "number" && pending.has(msg.id)) {
        pending.get(msg.id)!(msg as Record<string, unknown>);
        pending.delete(msg.id);
      }
    } catch {
      /* non-JSON noise is ignored */
    }
  });
  // Wait for the ready banner on stderr so requests don't race startup.
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("mcp server did not start")), 15_000);
    child.stderr.on("data", (chunk: Buffer) => {
      if (chunk.toString().includes("MCP server ready")) {
        clearTimeout(timer);
        resolve();
      }
    });
    child.on("exit", (code) => reject(new Error(`mcp exited early (${code})`)));
  });
}, 30_000);

afterAll(() => {
  child?.kill();
  rl?.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("MCP server (stdio JSON-RPC)", () => {
  it("initialize handshake", async () => {
    const msg = await request("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "test", version: "0" },
    });
    const result = msg.result as { serverInfo: { name: string }; capabilities: { tools: object } };
    expect(result.serverInfo.name).toBe("sequences");
    expect(result.capabilities.tools).toBeDefined();
    // notifications get no response — must not crash the server.
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
  });

  it("tools/list exposes the planning + command surface", async () => {
    const msg = await request("tools/list");
    const names = (msg.result as { tools: Array<{ name: string }> }).tools.map((t) => t.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "get_planning_context",
        "submit_plan",
        "get_project_outline",
        "get_scene",
        "apply_commands",
        "lint_report",
        "autofix",
        "undo",
        "redo",
        "render",
      ]),
    );
  });

  it("get_planning_context carries the catalog and plan shape", async () => {
    const { text, isError } = await callTool("get_planning_context");
    expect(isError).toBe(false);
    expect(text).toContain("## Sequences agent system prompt (Phase 1)");
    expect(text).toContain("## Motion primitives");
    expect(text).toContain("## Storyboard context");
    expect(text).toContain("push toward the analytics card");
    expect(text).toContain("submit_plan");
  });

  it("apply_commands mutates the project through the validated store", async () => {
    const { text, isError } = await callTool("apply_commands", {
      commands: [{ type: "SetSceneDuration", sceneId: "hook", durationFrames: 120 }],
    });
    expect(isError, text).toBe(false);
    expect(text).toContain("applied");
    const onDisk = JSON.parse(fs.readFileSync(path.join(dir, "project.json"), "utf8")) as {
      scenes: Array<{ id: string; durationFrames: number }>;
    };
    expect(onDisk.scenes.find((s) => s.id === "hook")!.durationFrames).toBe(120);
  });

  it("invalid commands come back as structured tool errors, not crashes", async () => {
    const { text, isError } = await callTool("apply_commands", {
      commands: [{ type: "SetMotionProfile", profile: "nope" }],
    });
    expect(isError).toBe(true);
    expect(text).toContain("rejected");
  });

  it("submit_plan validates and replaces scenes; undo reverts it", async () => {
    const bad = await callTool("submit_plan", {
      plan: { motionProfile: "vaporwave", scenes: [{ archetype: "hook-opener", slots: {} }] },
    });
    expect(bad.isError).toBe(true);
    expect(bad.text).toContain("unknown motionProfile");

    const good = await callTool("submit_plan", {
      plan: {
        motionProfile: "warm-startup",
        scenes: [
          { archetype: "hook-opener", slots: { headline: "Fresh start" } },
          { archetype: "logo-sting-cta", slots: { cta: "Go" } },
        ],
      },
    });
    expect(good.isError, good.text).toBe(false);
    expect(good.text).toContain("plan applied");
    expect(good.text).toContain("warm-startup");

    const undone = await callTool("undo");
    expect(undone.text).toContain("undone");
    expect(undone.text).toContain("MCP Test");
  });
});
