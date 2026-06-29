import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createDefaultProject, planToCommands, ProjectStore } from "@sequences/core";
import {
  detectProviders,
  PROVIDERS,
  recoverAntigravityResponse,
  type AgentProvider,
} from "@sequences/platform/providers";
import { requestPlanWith } from "../src/agent/planRunner.ts";

function stubProvider(reply: string): AgentProvider {
  return {
    id: "codex-cli",
    label: "stub",
    kind: "cli",
    detect: async () => ({ available: true, detail: "stub" }),
    complete: async () => reply,
  };
}

describe("agent provider layer", () => {
  it("registers the providers, CLI (no-key) providers first", () => {
    expect(Object.keys(PROVIDERS)).toEqual([
      "codex-cli",
      "claude-code-cli",
      "antigravity-cli",
      "deepseek-api",
      "openmodel-api",
      "openrouter-api",
      "anthropic-api",
      "openai-api",
    ]);
    expect(PROVIDERS["codex-cli"].kind).toBe("cli");
    expect(PROVIDERS["claude-code-cli"].kind).toBe("cli");
    expect(PROVIDERS["antigravity-cli"].kind).toBe("cli");
    // CLI providers must not declare an API key env — keys are optional, period.
    expect(PROVIDERS["codex-cli"].apiKeyEnv).toBeUndefined();
    expect(PROVIDERS["claude-code-cli"].apiKeyEnv).toBeUndefined();
    expect(PROVIDERS["antigravity-cli"].apiKeyEnv).toBeUndefined();
  });

  it("detectProviders reports availability without throwing on a bare machine", async () => {
    const infos = await detectProviders(true);
    expect(infos).toHaveLength(8);
    for (const info of infos) {
      expect(typeof info.available).toBe("boolean");
      expect(info.detail.length).toBeGreaterThan(0);
    }
  });

  it("recovers agy's final response from the exact invocation transcript", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "agy-provider-test-"));
    const conversationId = "11111111-2222-3333-4444-555555555555";
    const transcriptDir = path.join(
      root,
      "brain",
      conversationId,
      ".system_generated",
      "logs",
    );
    fs.mkdirSync(transcriptDir, { recursive: true });
    const logFile = path.join(root, "invocation.log");
    fs.writeFileSync(
      logFile,
      `I0000 printmode.go:153] Print mode: conversation=${conversationId}, sending message\n`,
    );
    fs.writeFileSync(
      path.join(transcriptDir, "transcript.jsonl"),
      [
        JSON.stringify({ source: "MODEL", type: "PLANNER_RESPONSE", content: "truncated fallback" }),
      ].join("\n"),
    );
    fs.writeFileSync(
      path.join(transcriptDir, "transcript_full.jsonl"),
      [
        JSON.stringify({ source: "MODEL", type: "PLANNER_RESPONSE", content: "draft" }),
        "{partially-written",
        JSON.stringify({ source: "MODEL", type: "PLANNER_RESPONSE", content: "final answer" }),
      ].join("\n"),
    );
    try {
      expect(recoverAntigravityResponse(logFile, root)).toBe("final answer");
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("DeepSeek uses the OpenAI-compatible API shape with optional thinking", async () => {
    const originalFetch = globalThis.fetch;
    const calls: Array<{ url: string; body: Record<string, unknown>; authorization?: string }> = [];
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({
        url: String(url),
        body: JSON.parse(String(init?.body || "{}")),
        authorization: init?.headers && !Array.isArray(init.headers) ? (init.headers as Record<string, string>).authorization : undefined,
      });
      return new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;
    try {
      const text = await PROVIDERS["deepseek-api"].complete("hello", {
        apiKey: "sk-test",
        model: "deepseek-v4-pro",
        thinkingMode: "high",
      });
      expect(text).toBe("ok");
      expect(calls[0]!.url).toBe("https://api.deepseek.com/chat/completions");
      expect(calls[0]!.authorization).toBe("Bearer sk-test");
      expect(calls[0]!.body).toMatchObject({
        model: "deepseek-v4-pro",
        thinking: { type: "enabled" },
        reasoning_effort: "high",
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("OpenModel uses its Messages endpoint, preferred key header, and free Flash default", async () => {
    const originalFetch = globalThis.fetch;
    const calls: Array<{ url: string; body: Record<string, unknown>; apiKey?: string; version?: string }> = [];
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      const headers = (init?.headers || {}) as Record<string, string>;
      calls.push({
        url: String(url),
        body: JSON.parse(String(init?.body || "{}")),
        apiKey: headers["x-api-key"],
        version: headers["anthropic-version"],
      });
      return new Response(
        JSON.stringify({ content: [{ type: "text", text: "openmodel ok" }] }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as typeof fetch;
    try {
      const text = await PROVIDERS["openmodel-api"].complete("hello", {
        apiKey: "om-test",
        thinkingMode: "enabled",
      });
      expect(text).toBe("openmodel ok");
      expect(calls[0]).toMatchObject({
        url: "https://api.openmodel.ai/v1/messages",
        apiKey: "om-test",
        version: "2023-06-01",
        body: {
          model: "deepseek-v4-flash",
          max_tokens: 16_384,
          thinking: { type: "enabled" },
          messages: [{ role: "user", content: "hello" }],
        },
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("streams OpenModel Messages API text deltas", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      const events = [
        'event: message_start\ndata: {"type":"message_start"}\n\n',
        'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"hello "}}\n\n',
        'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Forge"}}\n\n',
        'event: message_stop\ndata: {"type":"message_stop"}\n\n',
      ].join("");
      return new Response(events, {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      });
    }) as typeof fetch;
    const deltas: string[] = [];
    try {
      const text = await PROVIDERS["openmodel-api"].streamComplete!(
        "hello",
        { apiKey: "om-test" },
        (delta) => deltas.push(delta),
      );
      expect(text).toBe("hello Forge");
      expect(deltas).toEqual(["hello ", "Forge"]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("requestPlanWith: provider text → validated plan → applicable batch", async () => {
    const reply = [
      "Here's my plan:",
      JSON.stringify({
        motionProfile: "crisp-saas",
        scenes: [
          { archetype: "hook-opener", slots: { headline: "Meet Pulse" } },
          { archetype: "logo-sting-cta", slots: { cta: "Start free" } },
        ],
      }),
      "Hope that works!",
    ].join("\n");
    const project = createDefaultProject();
    const result = await requestPlanWith(stubProvider(reply), "a promo", project);
    expect(result.plan.scenes).toHaveLength(2);

    const store = new ProjectStore(project);
    const outcome = store.apply(planToCommands(project, result.plan), "agent");
    expect(outcome.ok).toBe(true);
    expect(store.project.scenes.map((s) => s.archetype)).toEqual([
      "hook-opener",
      "logo-sting-cta",
    ]);
  });

  it("malformed provider output surfaces as a PlanError, not a crash", async () => {
    const project = createDefaultProject();
    await expect(
      requestPlanWith(stubProvider("I could not produce JSON, sorry."), "a promo", project),
    ).rejects.toThrow(/no JSON object/);
    await expect(
      requestPlanWith(
        stubProvider('{"motionProfile":"crisp-saas","scenes":[]}'),
        "a promo",
        project,
      ),
    ).rejects.toThrow(/plan does not match/);
  });
});
