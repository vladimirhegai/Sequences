import { describe, expect, it } from "vitest";
import {
  buildPlanPrompt,
  extractJsonObject,
  parsePlan,
  PlanError,
  planToCommands,
} from "../src/plan.ts";
import { ProjectStore } from "../src/store.ts";
import { createDefaultProject } from "../src/defaults.ts";

const GOOD_PLAN = {
  motionProfile: "bold-launch",
  scenes: [
    { archetype: "hook-opener", slots: { headline: "Launch day" } },
    {
      archetype: "stat-callout",
      durationFrames: 90,
      slots: { stat: { value: 4200, prefix: "", suffix: "+" }, caption: "happy teams" },
      camera: { move: "pullBack", scale: "subtle" },
    },
    { archetype: "logo-sting-cta", slots: { cta: "Try it free" } },
  ],
};

describe("plan layer (T4)", () => {
  it("parsePlan rejects unknown archetypes/profiles with self-correctable messages", () => {
    expect(() => parsePlan({ ...GOOD_PLAN, motionProfile: "vaporwave" })).toThrow(
      /unknown motionProfile "vaporwave" \(valid: /,
    );
    expect(() =>
      parsePlan({ ...GOOD_PLAN, scenes: [{ archetype: "explosion", slots: {} }] }),
    ).toThrow(/unknown archetype "explosion"/);
    expect(() =>
      parsePlan({
        ...GOOD_PLAN,
        scenes: [{ archetype: "hook-opener", layout: "diagonal", slots: {} }],
      }),
    ).toThrow(/has layouts center\/left, not "diagonal"/);
  });

  it("planToCommands replaces scenes atomically through the store, and is undoable", () => {
    const store = new ProjectStore(createDefaultProject());
    const before = structuredClone(store.project);
    const plan = parsePlan(GOOD_PLAN);
    const outcome = store.apply(planToCommands(store.project, plan), "agent");
    expect(outcome.ok, JSON.stringify(outcome)).toBe(true);
    expect(store.project.motionProfile).toBe("bold-launch");
    expect(store.project.scenes.map((s) => s.archetype)).toEqual([
      "hook-opener",
      "stat-callout",
      "logo-sting-cta",
    ]);
    expect(store.project.scenes[1]!.camera).toEqual({ move: "pullBack", scale: "subtle" });
    // Brand identity untouched — planning restyles the story, not the brand.
    expect(store.project.brand).toEqual(before.brand);
    store.undo();
    expect(store.project).toEqual(before);
  });

  it("a plan referencing a missing required slot is rejected by the validation gate", () => {
    const store = new ProjectStore(createDefaultProject());
    const plan = parsePlan({
      motionProfile: "crisp-saas",
      scenes: [{ archetype: "logo-sting-cta", slots: {} }], // cta is required
    });
    const outcome = store.apply(planToCommands(store.project, plan), "agent");
    expect(outcome.ok).toBe(false);
  });

  it("generates unique scene ids when the plan omits them", () => {
    const plan = parsePlan({
      motionProfile: "crisp-saas",
      scenes: [
        { archetype: "hook-opener", slots: { headline: "One" } },
        { archetype: "hook-opener", slots: { headline: "Two" } },
      ],
    });
    const batch = planToCommands(createDefaultProject(), plan);
    if (batch.type !== "Batch") throw new Error("expected Batch");
    const adds = batch.commands.filter((c) => c.type === "AddScene");
    const ids = adds.map((c) => (c.type === "AddScene" ? c.scene.id : ""));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("extractJsonObject finds the JSON in noisy CLI/model output", () => {
    const noisy =
      'Sure! Here is the plan you asked for:\n```json\n{"motionProfile":"crisp-saas","scenes":[{"archetype":"hook-opener","slots":{"headline":"Hi {there}"}}]}\n```\nLet me know!';
    const parsed = extractJsonObject(noisy) as { motionProfile: string };
    expect(parsed.motionProfile).toBe("crisp-saas");
    expect(() => extractJsonObject("no json here")).toThrow(PlanError);
    expect(() => extractJsonObject("{ broken")).toThrow(PlanError);
  });

  it("the plan prompt carries the catalog, assets, and output contract", () => {
    const project = createDefaultProject();
    project.assets.push({ id: "dash", path: "assets/dash.png", kind: "image" });
    const prompt = buildPlanPrompt("a punchy 20s promo", project);
    expect(prompt).toContain("## Motion primitives");
    expect(prompt).toContain("## Camera moves");
    expect(prompt).toContain("- dash (image): assets/dash.png");
    expect(prompt).toContain("a punchy 20s promo");
    expect(prompt).toContain('"motionProfile"');
  });
});
