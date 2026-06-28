import { describe, expect, it } from "vitest";
import { compile, extensionPreviewProject, installBundle, uninstallBundlePrimitive, validateBundle } from "@sequences/core";
import { liftGsapSource, liftGsapToBundle } from "../src/lift.ts";

const SUMMARY = "A lifted card entrance with a small upward settle.";

describe("Forge lift pipeline", () => {
  it("promotes authored GSAP constants into a token-pure skeleton", () => {
    const lift = liftGsapSource(
      'tl.fromTo(inner,{y:64,opacity:0},{y:0,opacity:1,duration:0.45,ease:"power3.out"},0);',
      { id: "enter.cardLift", summary: SUMMARY },
    );

    expect(lift.skeleton).toHaveLength(1);
    expect(lift.defaults.duration).toBe("base");
    expect(lift.defaults.easing).toBe("enter.snap");
    expect(lift.tokens.yFromPx).toBe(64);
    expect(JSON.stringify(lift.skeleton)).toContain("$yFromPx");
    expect(JSON.stringify(lift.skeleton)).toContain("$durationSec");
    expect(JSON.stringify(lift.skeleton)).toContain("$ease");
  });

  it("builds a valid bundle that installs and compiles through the unchanged engine", () => {
    const bundle = liftGsapToBundle(
      [
        'tl.set(inner,{transformOrigin:"50% 50%"},0);',
        'tl.from(inner,{scale:0.84,opacity:0,duration:0.5,ease:"back.out(1.4)"},0);',
        'tl.to(inner,{y:-16,duration:0.18,ease:"power2.out"},"+=0.08");',
      ].join("\n"),
      { id: "enter.liftProbe", summary: SUMMARY },
    );

    expect(validateBundle(bundle).ok).toBe(true);
    expect(bundle.spec.skeleton.map((s) => s.kind)).toEqual(["set", "fromTo", "to"]);
    expect(bundle.spec.tokens.scaleFromScale).toBe(0.84);
    expect(bundle.spec.tokens.relativeOffsetSec).toBe(0.08);

    try {
      installBundle(bundle);
      const html = compile(extensionPreviewProject("primitive", "enter.liftProbe")).html;
      expect(html).toContain("data-composition-id");
    } finally {
      uninstallBundlePrimitive("enter.liftProbe");
    }
  });

  it("fails loudly when no supported timeline calls exist", () => {
    expect(() => liftGsapSource("console.log('no motion')", { id: "enter.empty", summary: SUMMARY })).toThrow(
      /no supported GSAP/,
    );
  });
});
