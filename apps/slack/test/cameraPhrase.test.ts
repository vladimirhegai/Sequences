import { describe, expect, it } from "vitest";
import { compileCameraPhrasePlan, type CameraPhraseSeedV1 } from "../src/engine/cameraPhrase.ts";
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
});
