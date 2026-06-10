import { describe, expect, it } from "vitest";
import { validateProject } from "../src/validate.ts";
import { createDefaultProject } from "../src/defaults.ts";

describe("project validation", () => {
  it("accepts the default project", () => {
    const result = validateProject(createDefaultProject());
    expect(result.issues).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("rejects a missing required slot", () => {
    const project = createDefaultProject();
    delete project.scenes[0]!.slots["headline"];
    const result = validateProject(project);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.message.includes("required slot"))).toBe(true);
  });

  it("rejects unknown asset references in media slots", () => {
    const project = createDefaultProject();
    project.scenes[0]!.slots["headline"] = "ok";
    project.scenes.splice(1, 0, {
      id: "feat",
      archetype: "feature-reveal",
      durationFrames: 120,
      slots: { headline: "X", media: { assetId: "ghost" } },
      choreography: {},
      overrides: {},
    });
    const result = validateProject(project);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.message.includes('unknown asset "ghost"'))).toBe(true);
  });

  it("rejects an unknown layout for the archetype", () => {
    const project = createDefaultProject();
    project.scenes[0]!.layout = "diagonal";
    const result = validateProject(project);
    expect(result.ok).toBe(false);
  });

  it("rejects overrides addressing nonexistent layers", () => {
    const project = createDefaultProject();
    project.scenes[0]!.overrides["ghost-layer"] = { colorToken: "accent" };
    const result = validateProject(project);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.path.includes("ghost-layer"))).toBe(true);
  });

  it("rejects role-incorrect primitive swaps (enter slot, exit primitive)", () => {
    const project = createDefaultProject();
    project.scenes[0]!.overrides["headline"] = { enterPrimitive: "exit.slideExit" };
    const result = validateProject(project);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.message.includes("not enter"))).toBe(true);
  });

  it("rejects unknown slot names", () => {
    const project = createDefaultProject();
    project.scenes[0]!.slots["sparkles"] = "nope";
    const result = validateProject(project);
    expect(result.ok).toBe(false);
  });

  it("rejects raw off-schema motion numerics (T1 by construction)", () => {
    const project = createDefaultProject();
    // @ts-expect-error — exactly the kind of thing an unconstrained agent emits
    project.scenes[0]!.overrides["headline"] = { enterDuration: 0.4 };
    const result = validateProject(project);
    expect(result.ok).toBe(false);
  });
});
