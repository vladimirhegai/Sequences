import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  degradeVolunteeredBridgedCuts,
  findingSignature,
  reconcileContractBindings,
  repairStrategyAfterStaticRejection,
  volunteeredCutBoundaries,
} from "../src/engine/compositionRunner.ts";
import { resolveCutPlan, validateCutContract } from "../src/engine/cutContract.ts";
import type { DirectScene } from "../src/engine/directComposition.ts";

const roots: string[] = [];

afterEach(() => {
  while (roots.length) {
    fs.rmSync(roots.pop()!, { recursive: true, force: true });
  }
});

function tempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sequences-author-reliability-"));
  roots.push(dir);
  return dir;
}

function scene(id: string, startSec: number, overrides: Partial<DirectScene> = {}): DirectScene {
  return {
    id,
    title: id,
    purpose: `show ${id}`,
    startSec,
    durationSec: 4,
    ...overrides,
  };
}

/** The 2026-07-04 live-fallback shape: shape-match + camera stations. */
function incidentStoryboard(): DirectScene[] {
  return [
    scene("search-typing", 0, {
      cut: {
        version: 1,
        style: "shape-match",
        focalPartOut: "palette-input",
        focalPartIn: "palette-input",
      },
    }),
    scene("trace-resolve", 4, {
      camera: {
        version: 1,
        path: [
          {
            version: 1,
            move: "push-in",
            toRegion: "trace-card",
            startSec: 4.5,
            durationSec: 1.4,
          },
        ],
      },
    }),
    scene("risk-score", 8),
  ];
}

describe("findingSignature", () => {
  it("collapses the cut contract's and the kit audit's endpoint findings to one signature", () => {
    const staticFinding =
      'cut search-typing->trace-resolve incoming part "palette-input" must exist as a ' +
      'data-part inside scene "trace-resolve"';
    const kitFinding =
      "kit_markup_incomplete: cut search-typing->trace-resolve (shape-match) needs " +
      'data-part="palette-input" in scene "trace-resolve" but the parsed DOM has none — ' +
      "the cut bind would abort the compile";
    expect(findingSignature(staticFinding)).toBe(
      "cut_missing_incoming_part:search-typing->trace-resolve:palette-input",
    );
    expect(findingSignature(kitFinding)).toBe(findingSignature(staticFinding));
  });

  it("distinguishes the outgoing side by the named scene", () => {
    const kitFinding =
      "kit_markup_incomplete: cut search-typing->trace-resolve (shape-match) needs " +
      'data-part="palette-input" in scene "search-typing" but the parsed DOM has none — ' +
      "the cut bind would abort the compile";
    expect(findingSignature(kitFinding)).toBe(
      "cut_missing_outgoing_part:search-typing->trace-resolve:palette-input",
    );
  });

  it("collapses both camera-region finding wordings to one signature", () => {
    const staticFinding =
      'scene "risk-score" camera targets region "risk-ring" but no data-region="risk-ring" ' +
      "exists in that scene";
    const kitFinding =
      'kit_markup_incomplete: camera path in scene "risk-score" frames data-region="risk-ring" ' +
      "but the parsed DOM has no such element in that scene — the camera bind would abort the compile";
    expect(findingSignature(staticFinding)).toBe("camera_region_missing:risk-score:risk-ring");
    expect(findingSignature(kitFinding)).toBe(findingSignature(staticFinding));
  });

  it("names moment and unknown findings stably", () => {
    expect(findingSignature(
      'storyboard/moments: moment "film-settles" (20.00s, "Film settles on CTA") has no ' +
      "executable timeline evidence within 0.45s/0.75s",
    )).toBe("moment_unbound:film-settles");
    expect(findingSignature("something entirely new")).toBe("other:something entirely new");
  });
});

describe("deterministic cut/camera binding reconciliation", () => {
  /** Wrap scene markup with the cut island + runtime so the gate reaches endpoint checks. */
  function withCutPlumbing(storyboard: DirectScene[], scenesHtml: string): string {
    return [
      scenesHtml,
      '<script src="sequences-cuts.v1.js"></script>',
      `<script type="application/json" id="sequences-cuts">${
        JSON.stringify(resolveCutPlan(storyboard))
      }</script>`,
      "<script>SequencesCuts.compile(tl, root);</script>",
    ].join("\n");
  }

  it("annotates a missing incoming shape-match part when one exact-id element exists", () => {
    const storyboard = incidentStoryboard();
    const html = withCutPlumbing(
      storyboard,
      '<section data-scene="search-typing"><div data-part="palette-input"></div></section>' +
      '<section data-scene="trace-resolve"><div id="palette-input" class="cmd"></div>' +
      '<div data-region="trace-card"></div></section>' +
      '<section data-scene="risk-score"></section>',
    );
    const result = reconcileContractBindings(html, storyboard);
    expect(result.repairs).toBe(1);
    expect(result.html).toContain('id="palette-input" class="cmd" data-part="palette-input"');
    const cutErrors = validateCutContract(result.html, storyboard).errors
      .filter((error) => error.includes("incoming part"));
    expect(cutErrors).toEqual([]);
  });

  it("keeps a genuinely absent or ambiguous incoming part blocking", () => {
    const storyboard = incidentStoryboard();
    const html = withCutPlumbing(
      storyboard,
      '<section data-scene="search-typing"><div data-part="palette-input"></div></section>' +
      '<section data-scene="trace-resolve"><div class="a"></div><div class="b"></div>' +
      '<div data-region="trace-card"></div></section>' +
      '<section data-scene="risk-score"></section>',
    );
    const result = reconcileContractBindings(html, storyboard);
    expect(result.repairs).toBe(0);
    expect(result.html).toBe(html);
    expect(
      validateCutContract(html, storyboard).errors.some((error) =>
        error.includes("incoming part")
      ),
    ).toBe(true);
  });

  it("adds a missing data-region station to the one exact-name element", () => {
    const storyboard = incidentStoryboard();
    const html =
      '<section data-scene="search-typing"><div data-part="palette-input"></div></section>' +
      '<section data-scene="trace-resolve"><div id="palette-input" data-part="palette-input"></div>' +
      '<div data-part="trace-card" class="card"></div></section>' +
      '<section data-scene="risk-score"></section>';
    const result = reconcileContractBindings(html, storyboard);
    expect(result.repairs).toBe(1);
    expect(result.html).toContain('data-part="trace-card" class="card" data-region="trace-card"');
  });

  it("leaves an ambiguous station untouched and never borrows across scenes", () => {
    const storyboard = incidentStoryboard();
    const ambiguous =
      '<section data-scene="search-typing"><div data-part="palette-input"></div>' +
      '<div id="trace-card"></div></section>' +
      '<section data-scene="trace-resolve"><div id="palette-input" data-part="palette-input"></div>' +
      '<div data-part="trace-card"></div><div data-part="trace-card"></div></section>' +
      '<section data-scene="risk-score"></section>';
    const result = reconcileContractBindings(ambiguous, storyboard);
    expect(result.repairs).toBe(0);
    expect(result.html).toBe(ambiguous);
  });
});

describe("volunteered bridged-cut degradation", () => {
  const incomingFinding =
    'cut search-typing->trace-resolve incoming part "palette-input" must exist as a ' +
    'data-part inside scene "trace-resolve"';
  const persistent = new Set([findingSignature(incomingFinding)]);

  function draftHtml(): string {
    return [
      '<div data-composition-id="incident" data-width="1920" data-height="1080" data-duration="12">',
      '<section id="search-typing" data-scene="search-typing" data-start="0" data-duration="4">',
      '<div data-part="palette-input"></div></section>',
      '<section id="trace-resolve" data-scene="trace-resolve" data-start="4" data-duration="4">',
      '<div data-camera-world><div data-region="trace-card"></div></div></section>',
      '<section id="risk-score" data-scene="risk-score" data-start="8" data-duration="4"></section>',
      "</div>",
      '<script src="gsap.min.js"></script>',
      "<script>var tl = gsap.timeline({ paused: true });",
      'window.__timelines["incident"] = tl;</script>',
    ].join("\n");
  }

  it("degrades a persistently unbindable volunteered shape-match to zoom-through", () => {
    const storyboard = incidentStoryboard();
    const result = degradeVolunteeredBridgedCuts({
      draft: { storyboard, html: draftHtml() },
      errors: [incomingFinding],
      storyboard,
      requirements: {},
      persistentSignatures: persistent,
      projectDir: tempDir(),
    });
    expect(result).toBeDefined();
    expect(result!.degraded).toEqual(["search-typing->trace-resolve (shape-match)"]);
    expect(result!.storyboard[0]!.cut).toEqual({ version: 1, style: "zoom-through" });
    const island = result!.draft.html.match(
      /<script[^>]*id="sequences-cuts"[^>]*>([\s\S]*?)<\/script>/,
    );
    expect(island).toBeTruthy();
    expect(island![1]).toContain('"zoom-through"');
    expect(island![1]).not.toContain("shape-match");
    expect(
      validateCutContract(result!.draft.html, result!.storyboard).errors,
    ).toEqual([]);
  });

  it("never degrades a brief-required shape-match", () => {
    const storyboard = incidentStoryboard();
    expect(degradeVolunteeredBridgedCuts({
      draft: { storyboard, html: draftHtml() },
      errors: [incomingFinding],
      storyboard,
      requirements: { requireShapeMatch: true },
      persistentSignatures: persistent,
      projectDir: tempDir(),
    })).toBeUndefined();
  });

  it("waits until the finding has survived a repair (persistence window)", () => {
    const storyboard = incidentStoryboard();
    expect(degradeVolunteeredBridgedCuts({
      draft: { storyboard, html: draftHtml() },
      errors: [incomingFinding],
      storyboard,
      requirements: {},
      persistentSignatures: new Set<string>(),
      projectDir: tempDir(),
    })).toBeUndefined();
  });

  it("exposes volunteered boundaries only for unrequested bridged styles", () => {
    const storyboard = incidentStoryboard();
    expect(volunteeredCutBoundaries(storyboard, {})).toEqual(
      new Set(["search-typing->trace-resolve"]),
    );
    expect(volunteeredCutBoundaries(storyboard, { requireShapeMatch: true })).toEqual(new Set());
  });
});

describe("repair strategy after a static rejection", () => {
  const cutSignature = "cut_missing_incoming_part:search-typing->trace-resolve:palette-input";
  const otherSignature = "component_root_missing:search-typing:command-palette";

  it("keeps compact repair while findings strictly improve", () => {
    expect(repairStrategyAfterStaticRejection({
      patchMode: true,
      signatures: new Set([otherSignature]),
      previousSignatures: new Set([cutSignature]),
      degradableBoundaries: new Set(),
    })).toBe("compact-repair");
  });

  it("switches to a full re-author when a non-degradable signature survives the patch", () => {
    expect(repairStrategyAfterStaticRejection({
      patchMode: true,
      signatures: new Set([otherSignature]),
      previousSignatures: new Set([otherSignature]),
      degradableBoundaries: new Set(["search-typing->trace-resolve"]),
    })).toBe("full-reauthor");
  });

  it("stays compact when the only survivor is a degradable volunteered cut", () => {
    expect(repairStrategyAfterStaticRejection({
      patchMode: true,
      signatures: new Set([cutSignature]),
      previousSignatures: new Set([cutSignature]),
      degradableBoundaries: new Set(["search-typing->trace-resolve"]),
    })).toBe("compact-repair");
  });

  it("never escalates a full-author rejection (there is no scratch to abandon)", () => {
    expect(repairStrategyAfterStaticRejection({
      patchMode: false,
      signatures: new Set([otherSignature]),
      previousSignatures: new Set([otherSignature]),
      degradableBoundaries: new Set(),
    })).toBe("compact-repair");
  });
});
