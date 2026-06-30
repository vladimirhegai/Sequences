import { describe, expect, it } from "vitest";
import { hoistImports, polishStageAsset, stripCodeFence } from "../src/stagePolish.ts";

describe("stagePolish — mechanical, design-preserving cleanup", () => {
  it("strips a code fence wrapping a whole field", () => {
    expect(stripCodeFence("```css\n.a{color:red}\n```")).toBe(".a{color:red}");
    expect(stripCodeFence("```\n<div></div>\n```")).toBe("<div></div>");
    // a non-fenced field is untouched
    expect(stripCodeFence(".a{color:red}")).toBe(".a{color:red}");
  });

  it("unwraps <style>/<script> wrappers the model leaked into css/js", () => {
    const out = polishStageAsset({ html: "<p>hi</p>", css: "<style>.a{color:red}</style>", js: "<script>x()</script>" });
    expect(out.css).toBe(".a{color:red}");
    expect(out.js).toBe("x()");
    expect(out.changed).toContain("unwrapped <style>/<script>");
  });

  it("hoists @import to the top of the CSS (browsers ignore late @imports)", () => {
    const css = ".a{color:red}\n@import url('https://fonts.googleapis.com/css2?family=Inter');\n.b{color:blue}";
    const out = hoistImports(css);
    expect(out.moved).toBe(true);
    expect(out.css.startsWith("@import")).toBe(true);
    expect(out.css.indexOf("@import")).toBeLessThan(out.css.indexOf(".a"));
  });

  it("leaves an already-leading @import alone", () => {
    const css = "@import url('x');\n.a{color:red}";
    const out = hoistImports(css);
    expect(out.moved).toBe(false);
    expect(out.css.startsWith("@import")).toBe(true);
  });

  it("adds a reduced-motion guard only when the asset animates and lacks one", () => {
    const animated = polishStageAsset({ html: "", css: ".a{transition:opacity .2s}", js: "" });
    expect(animated.changed).toContain("added reduced-motion fallback");
    expect(animated.css).toContain("prefers-reduced-motion");

    const already = polishStageAsset({
      html: "",
      css: ".a{transition:opacity .2s}\n@media (prefers-reduced-motion: reduce){.a{transition:none}}",
      js: "",
    });
    expect(already.changed).not.toContain("added reduced-motion fallback");

    const static_ = polishStageAsset({ html: "<p>hi</p>", css: ".a{color:red}", js: "" });
    expect(static_.changed).not.toContain("added reduced-motion fallback");
    expect(static_.css).not.toContain("prefers-reduced-motion");
  });

  it("treats GSAP usage as animation for the guard", () => {
    const out = polishStageAsset({ html: "", css: ".a{color:red}", js: "gsap.to('.a',{x:10})" });
    expect(out.css).toContain("prefers-reduced-motion");
  });
});
