import { describe, expect, it } from "vitest";
import { applyStageOps } from "../src/stageTweak.ts";

describe("stageTweak — deterministic op-list edits", () => {
  it("rewrites a @forge-var default in place", () => {
    const css = '/* @forge-var radius type=range default=8 min=0 max=24 label="Radius" */\n.card{border-radius:calc(var(--radius)*1px)}';
    const out = applyStageOps({ html: "", css, js: "" }, [{ op: "set-knob", name: "radius", value: 12 }]);
    expect(out.css).toContain("default=12");
    expect(out.css).not.toContain("default=8");
    expect(out.applied[0]).toContain("radius");
    expect(out.errors).toEqual([]);
  });

  it("injects a default when the directive has none", () => {
    const css = '/* @forge-var accent type=color label="Accent" */';
    const out = applyStageOps({ html: "", css, js: "" }, [{ op: "set-knob", name: "accent", value: "#ff0000" }]);
    expect(out.css).toContain("default=#ff0000");
  });

  it("sets the text of a named part (and quotes/escapes safely)", () => {
    const html = '<h1 data-forge-component="hero-title">Old</h1>';
    const out = applyStageOps({ html, css: "", js: "" }, [{ op: "set-text", part: "hero-title", text: "New <b>title" }]);
    expect(out.html).toContain("New &lt;b&gt;title");
    expect(out.html).not.toContain(">Old<");
  });

  it("refuses set-text when the part has child elements", () => {
    const html = '<div data-forge-component="card"><span>x</span></div>';
    const out = applyStageOps({ html, css: "", js: "" }, [{ op: "set-text", part: "card", text: "nope" }]);
    expect(out.applied).toEqual([]);
    expect(out.errors[0]).toMatch(/child elements/);
  });

  it("renames a part across markup, affects, and action declarations", () => {
    const html =
      '<button data-forge-action="open" data-forge-affects="cta">Go</button><a data-forge-component="cta">x</a>';
    const css = '/* @forge-action open label="Open" affects="cta" */';
    const out = applyStageOps({ html, css, js: "" }, [{ op: "rename-part", from: "cta", to: "primary-cta" }]);
    expect(out.html).toContain('data-forge-component="primary-cta"');
    expect(out.html).toContain('data-forge-affects="primary-cta"');
    expect(out.css).toContain('affects="primary-cta"');
    expect(out.html).not.toMatch(/="cta"/);
  });

  it("collects unknown ops as errors while still applying valid ones", () => {
    const css = '/* @forge-var radius type=range default=8 label="Radius" */';
    const out = applyStageOps({ html: "", css, js: "" }, [
      { op: "frobnicate" },
      { op: "set-knob", name: "radius", value: 4 },
    ]);
    expect(out.css).toContain("default=4");
    expect(out.applied.length).toBe(1);
    expect(out.errors.some((e) => /unknown op/.test(e))).toBe(true);
  });

  it("reports a missing knob rather than silently passing", () => {
    const out = applyStageOps({ html: "", css: "", js: "" }, [{ op: "set-knob", name: "ghost", value: 1 }]);
    expect(out.applied).toEqual([]);
    expect(out.errors[0]).toMatch(/no @forge-var/);
  });

  it("renames inside React TSX too", () => {
    const out = applyStageOps(
      { html: "", css: "", js: "", reactTsx: 'const x = <main data-forge-component="cta" />;' },
      [{ op: "rename-part", from: "cta", to: "hero" }],
    );
    expect(out.reactTsx).toContain('data-forge-component="hero"');
  });
});
