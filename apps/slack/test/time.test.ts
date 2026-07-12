import { describe, expect, expectTypeOf, it } from "vitest";
import fc from "fast-check";
import {
  addSourceTime,
  duration,
  sceneLocalFromSource,
  sceneLocalTime,
  sourceFromSceneLocal,
  sourceTime,
  timeConversionService,
  viewerTime,
  type SourceTime,
  type ViewerTime,
} from "../src/engine/time.ts";
import type { TimeRampPlanV1 } from "../src/engine/timeRamp.ts";

const plan: TimeRampPlanV1 = {
  version: 1,
  ramps: [{
    version: 1,
    sceneId: "payoff",
    atSec: 4,
    slowTo: 0.4,
    holdSec: 0.6,
    recoverSec: 0.9,
    knots: [[4, 4], [4.5, 4.2], [5, 4.4], [5.5, 5.25], [6, 6]],
  }],
};

const finiteTime = fc.double({ min: -20, max: 30, noNaN: true, noDefaultInfinity: true });

describe("branded time types", () => {
  it("keeps source and viewer domains distinct at compile time", () => {
    expectTypeOf(sourceTime(1)).toEqualTypeOf<SourceTime>();
    expectTypeOf(viewerTime(1)).toEqualTypeOf<ViewerTime>();
    expectTypeOf(sourceTime(1)).not.toEqualTypeOf<ViewerTime>();
  });

  it("rejects invalid durations and scene-local times", () => {
    expect(() => duration(-0.01)).toThrow(/non-negative/);
    expect(() => sceneLocalTime(Number.NaN)).toThrow(/finite/);
  });

  it("converts scene-local time and preserves typed arithmetic", () => {
    const start = sourceTime(8);
    const absolute = sourceFromSceneLocal(start, sceneLocalTime(1.25));
    expect(absolute).toBe(9.25);
    expect(sceneLocalFromSource(start, absolute)).toBe(1.25);
    expect(addSourceTime(start, duration(2))).toBe(10);
  });
});

describe("time conversion service properties", () => {
  const conversion = timeConversionService(plan);

  it("is identity at and outside ramp boundaries", () => {
    for (const seconds of [-2, 4, 6, 12]) {
      expect(conversion.toViewer(sourceTime(seconds))).toBe(seconds);
      expect(conversion.toSource(viewerTime(seconds))).toBe(seconds);
    }
  });

  it("is strictly monotonic in both directions", () => {
    fc.assert(fc.property(finiteTime, finiteTime, (a, b) => {
      fc.pre(a < b);
      expect(conversion.toViewer(sourceTime(a))).toBeLessThan(conversion.toViewer(sourceTime(b)));
      expect(conversion.toSource(viewerTime(a))).toBeLessThan(conversion.toSource(viewerTime(b)));
    }));
  });

  it("round-trips both time domains", () => {
    fc.assert(fc.property(finiteTime, (seconds) => {
      const source = sourceTime(seconds);
      const viewer = viewerTime(seconds);
      expect(conversion.toSource(conversion.toViewer(source))).toBeCloseTo(source, 10);
      expect(conversion.toViewer(conversion.toSource(viewer))).toBeCloseTo(viewer, 10);
    }));
  });

  it("preserves conversion when a cascade translates plan and time equally", () => {
    fc.assert(fc.property(
      fc.double({ min: 0, max: 10, noNaN: true, noDefaultInfinity: true }),
      fc.double({ min: 0, max: 8, noNaN: true, noDefaultInfinity: true }),
      (offset, delta) => {
        const shifted: TimeRampPlanV1 = {
          version: 1,
          ramps: plan.ramps.map((ramp) => ({
            ...ramp,
            atSec: ramp.atSec + delta,
            knots: ramp.knots.map(([viewer, source]) => [viewer + delta, source + delta]),
          })),
        };
        const shiftedConversion = timeConversionService(shifted);
        const original = conversion.toViewer(sourceTime(offset));
        const translated = shiftedConversion.toViewer(sourceTime(offset + delta));
        expect(translated - delta).toBeCloseTo(original, 10);
        const originalSource = conversion.toSource(viewerTime(offset));
        const translatedSource = shiftedConversion.toSource(viewerTime(offset + delta));
        expect(translatedSource - delta).toBeCloseTo(originalSource, 10);
      },
    ));
  });
});
