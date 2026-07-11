import { describe, expect, it } from "vitest";
import type { DirectScene } from "../src/engine/directComposition.ts";
import type {
  BoundaryPartMeasurement,
  DirectBoundaryInventory,
} from "../src/engine/layoutInspector.ts";
import {
  classifyCutDegradationReason,
  cutDegradationBoundary,
  discoverShapeMatchUpgrade,
  discoverShapeMatchUpgrades,
  scoreShapePair,
  summarizeCutDegradationReasons,
} from "../src/engine/cutDiscovery.ts";

function part(overrides: Partial<BoundaryPartMeasurement> & { part: string }): BoundaryPartMeasurement {
  return {
    left: 400,
    top: 400,
    width: 320,
    height: 96,
    radiusPx: 48,
    nodeCount: 3,
    onFrameRatio: 1,
    ...overrides,
  };
}

function scene(id: string, extras: Partial<DirectScene> = {}): DirectScene {
  return { id, title: id, purpose: "p", startSec: 0, durationSec: 3, ...extras };
}

const rhymingPair = {
  outgoing: part({ part: "query-pill" }),
  incoming: part({ part: "status-bar", width: 480, radiusPx: 48, nodeCount: 5 }),
};

describe("shape pair scoring", () => {
  it("scores a genuine silhouette rhyme above the upgrade floor", () => {
    const score = scoreShapePair(rhymingPair.outgoing, rhymingPair.incoming);
    expect(score).toBeGreaterThan(0.55);
  });

  it("hard-caps aspect distance tighter than the runtime degrade", () => {
    // 12.5:1 banner vs 3.33:1 pill — 3.75× apart, over the 2.0× cap.
    expect(
      scoreShapePair(rhymingPair.outgoing, part({ part: "banner", width: 1200, height: 96 })),
    ).toBeUndefined();
  });

  it("refuses heavy subtrees, off-frame parts, and absurd area ratios", () => {
    expect(
      scoreShapePair(rhymingPair.outgoing, part({ part: "table", nodeCount: 61 })),
    ).toBeUndefined();
    expect(
      scoreShapePair(rhymingPair.outgoing, part({ part: "edge", onFrameRatio: 0.5 })),
    ).toBeUndefined();
    expect(
      scoreShapePair(
        rhymingPair.outgoing,
        part({ part: "hero", width: 1600, height: 640, radiusPx: 96 }),
      ),
    ).toBeUndefined();
  });

  it("punishes a weak radius rhyme (round pill vs square-ish bar)", () => {
    const weak = scoreShapePair(
      rhymingPair.outgoing,
      part({ part: "flat-bar", width: 560, height: 112, radiusPx: 8 }),
    );
    expect(weak).toBeLessThan(0.55);
  });
});

describe("shape-match discovery policy", () => {
  const boundary = (
    fromScene: string,
    toScene: string,
    outgoing: BoundaryPartMeasurement[],
    incoming: BoundaryPartMeasurement[],
  ): DirectBoundaryInventory => ({ fromScene, toScene, atSec: 3, outgoing, incoming });

  it("upgrades a hard boundary whose measured pair provably rhymes", () => {
    const upgrade = discoverShapeMatchUpgrade(
      [scene("one"), scene("two", { startSec: 3 })],
      [boundary("one", "two", [rhymingPair.outgoing], [rhymingPair.incoming])],
    );
    expect(upgrade).toMatchObject({
      fromScene: "one",
      focalPartOut: "query-pill",
      focalPartIn: "status-bar",
    });
  });

  it("never replaces a deliberate premium style", () => {
    for (const style of ["zoom-through", "inverse-zoom", "flash-white", "object-match", "shape-match"] as const) {
      const upgraded = discoverShapeMatchUpgrade(
        [
          scene("one", {
            cut: style === "object-match" || style === "shape-match"
              ? { version: 1, style, focalPartOut: "a", focalPartIn: "b" }
              : { version: 1, style },
          }),
          scene("two", { startSec: 3 }),
        ],
        [boundary("one", "two", [rhymingPair.outgoing], [rhymingPair.incoming])],
      );
      expect(upgraded, style).toBeUndefined();
    }
  });

  it("still upgrades a directional boundary (velocity carry → premium rhyme)", () => {
    const upgrade = discoverShapeMatchUpgrade(
      [
        scene("one", { cut: { version: 1, style: "cut-left" } }),
        scene("two", { startSec: 3 }),
      ],
      [boundary("one", "two", [rhymingPair.outgoing], [rhymingPair.incoming])],
    );
    expect(upgrade?.focalPartOut).toBe("query-pill");
  });

  it("keeps the backward-compatible single decision on the best-scoring boundary", () => {
    const square = part({ part: "tile-a", width: 200, height: 200, radiusPx: 0 });
    const squareIn = part({ part: "tile-b", width: 200, height: 200, radiusPx: 0 });
    const upgrade = discoverShapeMatchUpgrade(
      [scene("one"), scene("two", { startSec: 3 }), scene("three", { startSec: 6 })],
      [
        boundary("one", "two", [rhymingPair.outgoing], [rhymingPair.incoming]),
        boundary("two", "three", [square], [squareIn]),
      ],
    );
    // The perfect square→square rhyme outranks the pill→bar pair.
    expect(upgrade).toMatchObject({ fromScene: "two", focalPartOut: "tile-a" });
  });

  it("permits a second premium seam only when stable entity ids prove continuity", () => {
    const tileOut = part({ part: "tile-a", width: 200, height: 200, radiusPx: 0 });
    const tileIn = part({ part: "tile-b", width: 200, height: 200, radiusPx: 0 });
    const scenes = [
      scene("one", {
        components: [{ version: 1, id: "query-pill", kind: "search", entityId: "query" }],
      }),
      scene("two", {
        startSec: 3,
        components: [
          { version: 1, id: "status-bar", kind: "toast", entityId: "query" },
          { version: 1, id: "tile-a", kind: "stat-card", entityId: "result" },
        ],
      }),
      scene("three", {
        startSec: 6,
        components: [{ version: 1, id: "tile-b", kind: "stat-card", entityId: "result" }],
      }),
    ];
    const upgrades = discoverShapeMatchUpgrades(scenes, [
      boundary("one", "two", [rhymingPair.outgoing], [rhymingPair.incoming]),
      boundary("two", "three", [tileOut], [tileIn]),
    ]);
    expect(upgrades).toHaveLength(2);
    expect(upgrades.map((entry) => entry.sharedEntityId).sort()).toEqual(["query", "result"]);

    const withoutIdentity = discoverShapeMatchUpgrades(
      scenes.map((entry) => ({
        ...entry,
        components: entry.components?.map((component) => ({ ...component, entityId: undefined })),
      })),
      [
        boundary("one", "two", [rhymingPair.outgoing], [rhymingPair.incoming]),
        boundary("two", "three", [tileOut], [tileIn]),
      ],
    );
    expect(withoutIdentity).toHaveLength(1);
  });

  it("prefers parts the storyboard names (component ids beat anonymous parts)", () => {
    const anonymous = part({ part: "decor-chip", width: 480, radiusPx: 48 });
    const component = part({ part: "status-bar", width: 480, radiusPx: 48 });
    const upgrade = discoverShapeMatchUpgrade(
      [
        scene("one"),
        scene("two", {
          startSec: 3,
          components: [{ version: 1, id: "status-bar", kind: "toast" }],
        }),
      ],
      [boundary("one", "two", [rhymingPair.outgoing], [anonymous, component])],
    );
    expect(upgrade?.focalPartIn).toBe("status-bar");
  });

  it("gives a mismatched film no upgrade at all", () => {
    const upgrade = discoverShapeMatchUpgrade(
      [scene("one"), scene("two", { startSec: 3 })],
      [
        boundary(
          "one",
          "two",
          [part({ part: "banner", width: 1200, height: 120, radiusPx: 12 })],
          [part({ part: "tall-card", width: 320, height: 640, radiusPx: 24 })],
        ),
      ],
    );
    expect(upgrade).toBeUndefined();
  });
});

describe("cut degradation reason evidence (WS-D2)", () => {
  it("classifies every current runtime mechanical reason and extracts its boundary", () => {
    const samples = [
      ["outgoing focal part has no visible painted content", "paint-invisible"],
      ["a focal part measured zero size at bind time", "zero-size"],
      ["focal silhouettes differ 7.9x in aspect ratio (cap 2.5x)", "aspect-ratio"],
      ["focal surfaces have mismatched structure (2 vs 4 children, depth 1 vs 3)", "structure-mismatch"],
      ["focal surfaces belong to different semantic families (collection vs metric)", "semantic-family"],
      ["a focal part subtree exceeds 60 nodes", "subtree-complexity"],
      ["incoming focal part is mostly outside the frame at bind time", "off-frame"],
      ['incoming part "hero" is absent', "missing-endpoint"],
    ] as const;
    for (const [detail, reason] of samples) {
      const warning = `cut_degraded: morph opener->proof compiled as swipe-left: ${detail}`;
      expect(classifyCutDegradationReason(warning), detail).toBe(reason);
      expect(cutDegradationBoundary(warning)).toBe("opener->proof");
    }
    expect(classifyCutDegradationReason("cut_degraded")).toBeUndefined();
    expect(classifyCutDegradationReason("cut_degraded:opener->proof")).toBeUndefined();
    expect(classifyCutDegradationReason("camera_framed_sparse: opener->proof")).toBeUndefined();
  });

  it("deduplicates warning/finding/signature encodings per project boundary and reason", () => {
    const summary = summarizeCutDegradationReasons([
      {
        source: "meridian",
        message: "cut_degraded: morph chaos-open->triage-demo compiled as swipe-left: outgoing focal part has no visible painted content",
      },
      {
        source: "meridian",
        message: "cut_degraded [data-part=alert-stack]: morph cut chaos-open->triage-demo degraded it to swipe-left: outgoing focal part has no visible painted content",
      },
      { source: "meridian", message: "cut_degraded:chaos-open->triage-demo" },
      {
        source: "meridian-rerender",
        message: "cut_degraded: morph chaos-open->triage-demo compiled as swipe-left: outgoing focal part has no visible painted content",
      },
      {
        source: "meridian",
        message: "cut_degraded: morph chaos-open->triage-demo compiled as swipe-left: focal silhouettes differ 3.7x in aspect ratio (cap 2.5x)",
      },
      {
        source: "older-probe",
        message: "cut_degraded: morph table->close compiled as swipe-right: focal surfaces have mismatched structure (4 vs 1 children, depth 3 vs 1)",
      },
    ]);
    expect(summary.total).toBe(4);
    expect(summary.counts).toEqual([
      { reason: "paint-invisible", count: 2, boundaries: ["chaos-open->triage-demo"] },
      { reason: "aspect-ratio", count: 1, boundaries: ["chaos-open->triage-demo"] },
      { reason: "structure-mismatch", count: 1, boundaries: ["table->close"] },
    ]);
    expect(summary.unclassifiedSamples).toEqual([]);
  });

  it("retains bounded samples for genuinely new reason text", () => {
    const summary = summarizeCutDegradationReasons([
      {
        source: "future",
        message: "cut_degraded: morph a->b compiled as swipe-left: endpoint colors disagree",
      },
    ]);
    expect(summary.counts[0]).toMatchObject({ reason: "unknown", count: 1 });
    expect(summary.unclassifiedSamples[0]).toContain("endpoint colors disagree");
  });
});
