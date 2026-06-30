import { describe, expect, it } from "vitest";
import { PRIMITIVES, validateProject } from "@sequences/core";
import { createPrimitiveProbeProject } from "../src/thumbs.ts";

describe("primitive probe project", () => {
  it("contains one valid, schedulable scene per primitive", () => {
    const project = createPrimitiveProbeProject();
    expect(project.scenes).toHaveLength(Object.keys(PRIMITIVES).length);
    expect(validateProject(project).ok).toBe(true);
    for (const primitive of Object.values(PRIMITIVES)) {
      expect(
        project.scenes.some((scene) => scene.id.includes(primitive.id.replaceAll(".", "-"))),
      ).toBe(true);
    }
  });
});
