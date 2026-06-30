import { describe, expect, it } from "vitest";
import { buildDesignFoundation, contrastRatio, estimateTokens } from "../src/designFoundation.ts";
import { buildForgePlanPrompt, runForgePlan } from "../src/planRunner.ts";

describe("Forge deterministic design foundation", () => {
  it("is stable and supplies measured palette/type recommendations", () => {
    const first = buildDesignFoundation("Dark analytics card with live revenue");
    expect(first).toEqual(buildDesignFoundation("Dark analytics card with live revenue"));
    expect(first.paletteCandidates).toHaveLength(3);
    expect(first.typographyCandidates).toHaveLength(3);
    expect(first.paletteCandidates[0]!.contrast.inkOnCanvas).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#000000", "#FFFFFF")).toBe(21);
  });

  it("estimates prompt size locally", () => {
    expect(estimateTokens("Build a compact billing card.")).toBeGreaterThan(4);
  });
});

describe("Forge plan runner", () => {
  it("keeps recommendations advisory and asks only bounded questions", async () => {
    const result = await runForgePlan({
      surface: "stage",
      message: "Make a pricing card",
      complete: async () => JSON.stringify({
        reply: "One decision first.",
        plan: {
          summary: "Pricing focus",
          direction: "Editorial pricing card",
          palette: { candidateId: "palette-1", colors: ["#F7F8FA", "#2457D6"], rationale: "Clear signal" },
          typography: { candidateId: "type-1", display: "Manrope", body: "Inter", rationale: "Clear hierarchy" },
          composition: ["Price is the focal point"],
          components: ["Independent pricing-card subject"],
          motion: ["Short plan-toggle transition"],
          actions: ["toggle-plan"],
          questions: [
            { id: "tier", question: "Which tier should be featured?" },
            { id: "currency", question: "Which currency?" },
            { id: "billing", question: "Monthly or annual?" },
            { id: "extra", question: "This fourth question must be removed." },
          ],
          ready: true,
        },
      }),
    });
    expect(result.ok).toBe(true);
    expect(result.plan?.questions).toHaveLength(3);
    expect(result.plan?.ready).toBe(false);
    expect(result.promptTokens).toBeGreaterThan(0);
  });

  it("includes separation, invokable actions, and freedom to deviate in the prompt", () => {
    const foundation = buildDesignFoundation("A search component");
    const prompt = buildForgePlanPrompt({
      surface: "stage",
      message: "A search component",
      context: null,
      previousPlan: null,
    }, foundation);
    expect(prompt).toContain("not constraints");
    expect(prompt).toContain("independent from its canvas/backdrop");
    expect(prompt).toContain("invokable");
  });
});
