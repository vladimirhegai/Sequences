import { describe, expect, it } from "vitest";
import { lintHyperframeHtml } from "@hyperframes/core/lint";
import { compile } from "../src/compiler.ts";
import { createDefaultProject } from "../src/defaults.ts";
import { projectDurationFrames, type Project } from "../src/schema.ts";

function exampleProject(): Project {
  const project = createDefaultProject({
    title: "Compiler Test Promo",
    brandName: "Acme",
    screenshotAssetId: "dashboard",
  });
  project.assets.push({ id: "dashboard", path: "assets/dashboard.svg", kind: "image" });
  return project;
}

describe("compiler", () => {
  it("emits the HF contract: meta tags, timed clips, timeline registration", () => {
    const { html, manifest } = compile(exampleProject());
    expect(html).toContain(`data-composition-id="${manifest.compositionId}"`);
    expect(html).toContain('content="width=1920, height=1080"');
    expect(html).toContain('class="clip seq-scene"');
    expect(html).toContain("data-track-index=\"0\"");
    expect(html).toContain(`window.__timelines[${JSON.stringify(manifest.compositionId)}]`);
    expect(html).toContain("gsap.timeline({ paused: true })");
    // Timeline extended to full duration so composition length is exact.
    expect(html).toContain(`tl.set({}, {}, ${manifest.durationSec})`);
  });

  it("scene clips tile the project duration exactly (in seconds)", () => {
    const project = exampleProject();
    const { html, manifest } = compile(project);
    const clips = [...html.matchAll(/data-start="([\d.]+)" data-duration="([\d.]+)"/g)].map(
      (m) => ({ start: Number(m[1]), duration: Number(m[2]) }),
    );
    expect(clips.length).toBe(project.scenes.length);
    let cursor = 0;
    for (const clip of clips) {
      expect(clip.start).toBeCloseTo(cursor, 2);
      cursor = Math.round((cursor + clip.duration) * 1000) / 1000;
    }
    expect(cursor).toBeCloseTo(manifest.durationSec, 2);
    expect(manifest.durationFrames).toBe(projectDurationFrames(project));
  });

  it("PASSES HYPERFRAMES' OWN LINTER (substrate conformance)", async () => {
    const { html } = compile(exampleProject());
    const result = await lintHyperframeHtml(html);
    const errors = result.findings.filter((f: { severity: string }) => f.severity === "error");
    expect(errors, JSON.stringify(errors, null, 2)).toEqual([]);
  });

  it("is a pure function: identical input → identical output", () => {
    const a = compile(exampleProject());
    const b = compile(exampleProject());
    expect(a.html).toBe(b.html);
    expect(a.manifest).toEqual(b.manifest);
  });

  it("brand recolor changes only CSS variables, not structure", () => {
    const base = exampleProject();
    const recolored = structuredClone(base);
    recolored.brand.colors.accent = "#FF0099";
    const htmlA = compile(base).html;
    const htmlB = compile(recolored).html;
    const strip = (html: string) => html.replace(/--c-[a-z]+: #[0-9a-fA-F]{6};/g, "");
    expect(strip(htmlA)).toBe(strip(htmlB));
  });

  it("number slots count up via the custom step (exact final value present)", () => {
    const { html } = compile(exampleProject());
    expect(html).toContain("12,480+"); // static fallback content
    expect(html).toContain("toLocaleString"); // countUp runtime code
  });

  it("warm-startup fade transitions emit scene-level opacity steps", () => {
    const project = exampleProject();
    project.motionProfile = "warm-startup";
    const { steps } = compile(project);
    const sceneFades = steps.filter(
      (s) => s.layerId === null && (s.kind === "custom" || !s.target.includes(".seq-camera")),
    );
    // out + in per boundary; 4 scenes → 3 boundaries → 6 steps.
    expect(sceneFades.length).toBe((project.scenes.length - 1) * 2);
  });

  it("camera pushIn emits one whole-frame scale step on the stage wrapper", () => {
    const { steps, html, manifest } = compile(exampleProject());
    const cameraSteps = steps.filter(
      (s): s is Extract<(typeof steps)[number], { kind: "fromTo" }> =>
        s.kind === "fromTo" && s.target.includes(".seq-camera"),
    );
    expect(cameraSteps).toHaveLength(1); // the feature scene's default pushIn
    const step = cameraSteps[0]!;
    expect(step.target).toBe("#sc-feature > .seq-camera");
    expect(step.from.scale).toBe(1);
    expect(step.to.scale).toBe(1.03); // scale token "subtle", never a raw choice
    expect(step.ease).toBe("seqMoveGlide"); // move-role easing token
    expect(html).toContain('class="seq-camera"');
    expect(manifest.scenes.find((s) => s.id === "feature")?.camera).toEqual({
      move: "pushIn",
      scale: "subtle",
    });
  });

  it("golden snapshot of the example compile (retune tokens consciously!)", () => {
    const { html } = compile(exampleProject());
    expect(html).toMatchSnapshot();
  });
});
