import { describe, expect, it } from "vitest";
import { createDefaultProject, planToCommands, ProjectStore } from "@sequences/core";
import { detectProviders, PROVIDERS, type AgentProvider } from "../src/agent/providers.ts";
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
  it("registers the four providers, CLI (no-key) providers first", () => {
    expect(Object.keys(PROVIDERS)).toEqual([
      "codex-cli",
      "claude-code-cli",
      "anthropic-api",
      "openai-api",
    ]);
    expect(PROVIDERS["codex-cli"].kind).toBe("cli");
    expect(PROVIDERS["claude-code-cli"].kind).toBe("cli");
    // CLI providers must not declare an API key env — keys are optional, period.
    expect(PROVIDERS["codex-cli"].apiKeyEnv).toBeUndefined();
    expect(PROVIDERS["claude-code-cli"].apiKeyEnv).toBeUndefined();
  });

  it("detectProviders reports availability without throwing on a bare machine", async () => {
    const infos = await detectProviders(true);
    expect(infos).toHaveLength(4);
    for (const info of infos) {
      expect(typeof info.available).toBe("boolean");
      expect(info.detail.length).toBeGreaterThan(0);
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
