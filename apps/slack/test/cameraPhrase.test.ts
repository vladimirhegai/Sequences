import { describe, expect, it } from "vitest";
import {
  collapseCameraPhrases,
  compileCameraPhrasePlan,
  type CameraPhraseSeedV1,
  type CameraPhraseV1,
} from "../src/engine/cameraPhrase.ts";
import type { CameraPlanV1 } from "../src/engine/cameraContract.ts";

const anchor = { x: 0.5, y: 0.5, name: "center" as const };

function seed(overrides: Partial<CameraPhraseSeedV1> = {}): CameraPhraseSeedV1 {
  return {
    id: "proof:proof-01:blocking",
    sceneId: "proof",
    phraseId: "proof-01",
    role: "payoff",
    importance: "primary",
    startSec: 1,
    arrivalSec: 2,
    endSec: 4,
    target: { kind: "part", id: "metric", entityId: "shared-metric", entityKind: "metric" },
    occupancy: { min: 0.04, preferred: 0.22, max: 0.36 },
    arrivalPose: { anchor, lens: "detail", zoom: 1.4 },
    corridor: { from: anchor, to: anchor, padding: 0.08 },
    dwell: { startSec: 2, endSec: 3.4, readableSec: 1.4 },
    settleUntilSec: 2.3,
    nextHandoff: { entityId: "shared-metric", toScene: "resolve", toPart: "metric", atSec: 4 },
    ...overrides,
  };
}

const solver = {
  curve: "minimum-jerk-quintic" as const,
  measuredDom: true as const,
  maxNormalizedVelocity: 1.9,
  maxNormalizedAcceleration: 5.8,
  maxNormalizedJerk: 60,
};

describe("CameraPhrase compiler", () => {
  it("joins an authored route with blocking intervals and evidence ownership", () => {
    const cameraPlan: CameraPlanV1 = {
      version: 1,
      scenes: [{
        sceneId: "proof",
        segments: [{
          move: "push-in",
          startSec: 1.1,
          endSec: 2,
          blend: 1,
          zoom: 1.4,
          ease: "seqSettle",
          fromPart: "shell",
          toPart: "metric",
        }],
      }],
    };
    const plan = compileCameraPhrasePlan({
      cameraPlan,
      solver,
      scenes: [{ sceneId: "proof", phrases: [seed()] }],
    });
    const phrase = plan.scenes[0]!.phrases[0]!;
    expect(phrase.routeOwnership).toBe("authored");
    expect(phrase.evidenceOwner).toEqual({
      kind: "camera-segment",
      id: "proof:push-in@1.1",
    });
    expect(phrase.sourcePose).toMatchObject({ target: { kind: "part", id: "shell" } });
    expect(phrase.arrivalPose).toMatchObject({ target: { kind: "part", id: "metric" }, zoom: 1.4 });
    expect(phrase.travel).toEqual({ startSec: 1.1, endSec: 2 });
    expect(phrase.settle).toEqual({ startSec: 2, endSec: 2.3 });
    expect(phrase.dwell).toEqual({ startSec: 2, endSec: 3.4, readableSec: 1.4 });
    expect(phrase.departure).toEqual({ startSec: 3.4, endSec: 4 });
    expect(plan.summary.authoredRouteCount).toBe(1);
  });

  it("marks graph requests as continuity-owned and plain direction as host-derived", () => {
    const plan = compileCameraPhrasePlan({
      cameraPlan: { version: 1, scenes: [] },
      solver,
      scenes: [{
        sceneId: "proof",
        phrases: [
          seed(),
          seed({
            id: "proof:proof-02:blocking",
            phraseId: "proof-02",
            target: { kind: "part", id: "caption" },
            nextHandoff: undefined,
          }),
        ],
      }],
    });
    expect(plan.scenes[0]!.phrases.map((phrase) => phrase.routeOwnership)).toEqual([
      "continuity",
      "host-derived",
    ]);
    expect(plan.summary).toMatchObject({ continuityRouteCount: 1, hostDerivedRouteCount: 1 });
  });

  it("collapses SignalDock-shaped direction paperwork from 14 phrases to 7 routes", () => {
    const phrase = (
      sceneId: string,
      id: string,
      importance: "primary" | "supporting",
      routeOwnership: CameraPhraseV1["routeOwnership"],
      target: string,
      framing?: string,
    ): CameraPhraseV1 => ({
      id: `${sceneId}:${id}:blocking`,
      sceneId,
      phraseId: `${sceneId}:${id}`,
      role: "develop",
      importance,
      routeOwnership,
      evidenceOwner: { kind: "direction-phrase", id },
      startSec: 0,
      arrivalSec: 0.5,
      endSec: 2,
      target: { kind: "part", id: target },
      ...(framing ? { framingTarget: { kind: "region" as const, id: framing } } : {}),
      occupancy: { min: 0.04, preferred: 0.2, max: 0.4 },
      sourcePose: { anchor, lens: "detail", zoom: 1 },
      arrivalPose: { target: { kind: "part", id: target }, anchor, lens: "detail", zoom: 1 },
      corridor: { from: anchor, to: anchor, padding: 0.08 },
      travel: { startSec: 0, endSec: 0.5 },
      settle: { startSec: 0.5, endSec: 0.7 },
      dwell: { startSec: 0.5, endSec: 1.5, readableSec: 1 },
      departure: { startSec: 1.5, endSec: 2 },
    });
    const scenes = [
      [
        phrase("scattered", "01", "primary", "continuity", "metric-38", "metric-anchor"),
        phrase("scattered", "02", "supporting", "host-derived", "trace"),
      ],
      [
        phrase("gather", "01", "supporting", "continuity", "metric-52", "metric"),
        phrase("gather", "02", "primary", "continuity", "workspace"),
        phrase("gather", "03", "primary", "authored", "metric-52", "metric"),
        phrase("gather", "04", "supporting", "host-derived", "owners"),
      ],
      [
        phrase("approval", "01", "supporting", "continuity", "table", "table"),
        phrase("approval", "02", "primary", "continuity", "metric-71", "confidence"),
        phrase("approval", "03", "supporting", "authored", "approve", "table"),
        phrase("approval", "04", "primary", "host-derived", "approve", "table"),
        phrase("approval", "05", "primary", "host-derived", "approve", "table"),
      ],
      [
        phrase("resolve", "01", "primary", "continuity", "metric-94", "confidence"),
        phrase("resolve", "02", "primary", "continuity", "restore", "cta"),
        phrase("resolve", "03", "supporting", "continuity", "restore", "cta"),
      ],
    ];
    const results = scenes.map((scene) => collapseCameraPhrases(scene));
    expect(results.reduce((count, result) => count + result.phrases.length, 0)).toBe(7);
    expect(results.reduce((count, result) => count + result.collapsed, 0)).toBe(7);
    expect(results[2]!.phrases[1]!.collapsedPhraseIds).toEqual(["approval:05"]);
  });
});
