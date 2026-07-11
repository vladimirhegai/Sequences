import { describe, expect, it } from "vitest";
import type { DirectScene } from "../src/engine/directComposition.ts";
import type { ContinuousMotionEvidenceV1 } from "../src/engine/continuousMotion.ts";
import {
  buildCameraBlockingEvidence,
  minimumJerkProgress,
  parseCameraBlockingPlan,
  resolveCameraBlockingPlan,
} from "../src/engine/cameraBlocking.ts";
import { resolveContinuityGraph } from "../src/engine/continuityGraph.ts";
import { resolveFilmDirectionScore } from "../src/engine/directionScore.ts";

function scenes(): DirectScene[] {
  return [0, 1, 2].map((index): DirectScene => ({
    id: `shot-${index + 1}`,
    title: `Shot ${index + 1}`,
    purpose: "develop the same product surface",
    startSec: index * 3,
    durationSec: 3,
    components: [{
      version: 1,
      id: `shell-${index + 1}`,
      kind: "app-window",
      role: "hero",
      entityId: "product-shell",
    }],
    beats: [{
      version: 1,
      id: `state-${index + 1}`,
      sceneId: `shot-${index + 1}`,
      component: `shell-${index + 1}`,
      kind: "set-state",
      atSec: index * 3 + 1,
      durationSec: 0.6,
      toState: "ready",
    }],
    moments: [{
      version: 1,
      id: `moment-${index + 1}`,
      sceneId: `shot-${index + 1}`,
      atSec: index * 3 + 1.6,
      title: "Product state lands",
      visualState: "Product shell is readable",
      change: "State advances",
      motionIntent: "ui-state",
      importance: "primary",
    }],
    spatialIntent: {
      version: 1,
      focalPart: `shell-${index + 1}`,
      composition: "centered product",
      relationships: [],
    },
    ...(index < 2 ? { cut: { version: 1, style: "hard" as const } } : {}),
  }));
}

describe("camera blocking director", () => {
  it("gives every phrase a target, occupancy, arrival, corridor, dwell, and next handoff", () => {
    const storyboard = scenes();
    const graph = resolveContinuityGraph(storyboard);
    const plan = resolveCameraBlockingPlan(storyboard, graph);
    const phrases = plan.scenes.flatMap((scene) => scene.phrases);
    expect(phrases.length).toBeGreaterThanOrEqual(3);
    expect(plan.summary.explicitTargetCount).toBe(plan.summary.phraseCount);
    expect(plan.summary.primaryWithReadableLandingCount).toBe(plan.summary.primaryPhraseCount);
    expect(phrases.every((phrase) => phrase.occupancy.min > 0 && phrase.occupancy.max < 1)).toBe(true);
    expect(phrases.every((phrase) => phrase.dwell.endSec >= phrase.dwell.startSec)).toBe(true);
    expect(phrases.some((phrase) => phrase.nextHandoff?.entityId === "product-shell")).toBe(true);

    const island = `<script id="sequences-camera-blocking" type="application/json">${JSON.stringify(plan)}</script>`;
    expect(parseCameraBlockingPlan(island)?.solver.curve).toBe("minimum-jerk-quintic");
  });

  it("lands by action onset and holds through the dominant action plus settle", () => {
    const storyboard = scenes();
    const scorePhrase = resolveFilmDirectionScore(storyboard).scenes[0]!.phrases[0]!;
    const block = resolveCameraBlockingPlan(
      storyboard,
      resolveContinuityGraph(storyboard),
    ).scenes[0]!.phrases[0]!;

    expect(block.arrivalSec).toBe(Math.max(
      scorePhrase.startSec,
      Math.min(scorePhrase.cueSec, scorePhrase.dominant.startSec),
    ));
    expect(block.arrivalSec).toBe(scorePhrase.dominant.startSec);
    expect(block.arrivalSec).toBeLessThan(scorePhrase.dominant.endSec);
    expect(block.dwell.endSec).toBeGreaterThanOrEqual(scorePhrase.dominant.endSec);
    expect(block.dwell.endSec).toBeGreaterThanOrEqual(scorePhrase.settleUntilSec);
  });

  it("arrives before cursor travel when a later payoff beat shares the interaction target", () => {
    const storyboard: DirectScene[] = [{
      id: "cta-shot",
      title: "CTA resolve",
      purpose: "let the viewer see the CTA before the cursor starts moving",
      startSec: 0,
      durationSec: 5,
      components: [{ version: 1, id: "cta", kind: "button", role: "hero", entityId: "cta" }],
      beats: [{
        version: 1, id: "cta-state", sceneId: "cta-shot", component: "cta",
        kind: "set-state", atSec: 3.6, durationSec: 0.5, toState: "open",
      }],
      interactions: [{
        version: 1, id: "cta-click", sceneId: "cta-shot", cursorId: "default",
        targetPart: "cta", action: "click", startSec: 3.1, arriveSec: 3.6,
        pressSec: 3.7, releaseSec: 3.82,
        from: "frame:bottom-right", path: "arc", aimX: 0.5, aimY: 0.5,
        feedback: "press-ripple",
      }],
      moments: [{
        version: 1, id: "cta-payoff", sceneId: "cta-shot", atSec: 3.6,
        title: "CTA resolves", visualState: "The CTA receives its click",
        change: "The action resolves", motionIntent: "resolve", importance: "primary",
      }],
      spatialIntent: {
        version: 1, focalPart: "cta", composition: "centered CTA", relationships: [],
      },
    }];
    const score = resolveFilmDirectionScore(storyboard).scenes[0]!.phrases[0]!;
    expect(score.competing.some((action) => action.system === "interaction")).toBe(true);
    const block = resolveCameraBlockingPlan(storyboard, resolveContinuityGraph(storyboard))
      .scenes[0]!.phrases[0]!;
    expect(block.arrivalSec).toBe(3.1);
    expect(block.arrivalSec).toBeLessThan(storyboard[0]!.interactions![0]!.arriveSec);
  });

  it("treats an authored camera phrase as target intent and lands before its travel", () => {
    const storyboard: DirectScene[] = [{
      id: "camera-owned",
      title: "Camera-owned phrase",
      purpose: "The graph owns travel while the authored move supplies intent",
      startSec: 0,
      durationSec: 4,
      components: [{
        version: 1,
        id: "detail",
        kind: "stat-card",
        role: "hero",
      }],
      camera: {
        version: 1,
        path: [{
          version: 1,
          move: "track-to-anchor",
          toPart: "detail",
          startSec: 0.8,
          durationSec: 1.4,
          zoom: 1.2,
        }],
      },
      moments: [{
        version: 1,
        id: "camera-arrival",
        sceneId: "camera-owned",
        atSec: 2.2,
        title: "Camera reaches detail",
        visualState: "Detail is framed",
        change: "Camera arrives",
        motionIntent: "camera-arrival",
        importance: "primary",
      }],
      spatialIntent: {
        version: 1,
        focalPart: "detail",
        composition: "detail framing",
        relationships: [],
      },
    }];
    const scorePhrase = resolveFilmDirectionScore(storyboard).scenes[0]!.phrases[0]!;
    expect(scorePhrase.dominant.system).toBe("camera");
    const block = resolveCameraBlockingPlan(
      storyboard,
      resolveContinuityGraph(storyboard),
    ).scenes[0]!.phrases[0]!;

    // With the continuity graph enabled, the authored camera move contributes
    // its target/lens intent; it does not get to delay the readable landing
    // until the end of its own travel window.
    expect(block.arrivalSec).toBe(0.8);
    expect(block.arrivalSec).toBe(scorePhrase.dominant.startSec);
    expect(block.arrivalSec).toBeLessThan(scorePhrase.cueSec);
    expect(block.dwell.endSec).toBeGreaterThanOrEqual(scorePhrase.settleUntilSec);
  });

  it("uses UI-form-aware ranges for a full trace list and a metric", () => {
    const visualScenes: DirectScene[] = [
      {
        id: "trace-shot",
        title: "Trace",
        purpose: "read the dependency trace",
        startSec: 0,
        durationSec: 3,
        components: [{
          version: 1, id: "trace-list", kind: "list", role: "hero", entityId: "trace",
        }],
        moments: [{
          version: 1, id: "trace-read", sceneId: "trace-shot", atSec: 1,
          title: "Trace reads", visualState: "Dependency trace is readable",
          change: "Trace appears", motionIntent: "ui-state", importance: "primary",
        }],
        spatialIntent: {
          version: 1, focalPart: "trace-list", composition: "trace list", relationships: [],
        },
      },
      {
        id: "metric-shot",
        title: "Metric",
        purpose: "read the verification metric",
        startSec: 3,
        durationSec: 3,
        components: [{
          version: 1, id: "metric-card", kind: "stat-card", role: "hero", entityId: "metric",
        }],
        moments: [{
          version: 1, id: "metric-read", sceneId: "metric-shot", atSec: 4,
          title: "Metric reads", visualState: "Verification metric is readable",
          change: "Metric appears", motionIntent: "ui-state", importance: "primary",
        }],
        spatialIntent: {
          version: 1, focalPart: "metric-card", composition: "metric card", relationships: [],
        },
      },
    ];
    const plan = resolveCameraBlockingPlan(visualScenes, resolveContinuityGraph(visualScenes));
    const phrases = plan.scenes.flatMap((scene) => scene.phrases);
    const trace = phrases.find((phrase) =>
      phrase.target.entityKind === "trace" && phrase.importance === "primary"
    );
    const metric = phrases.find((phrase) =>
      phrase.target.entityKind === "metric" && phrase.importance === "primary"
    );
    expect(trace?.occupancy).toEqual({ min: 0.08, preferred: 0.16, max: 0.34 });
    expect(metric?.occupancy).toMatchObject({ min: 0.015, max: 0.24 });
  });

  it("uses visual form and centered composition when a headline carries CTA continuity", () => {
    const brand: DirectScene[] = [{
      id: "brand-resolve",
      title: "Brand resolve",
      purpose: "resolve a centered brand lockup",
      startSec: 0,
      durationSec: 4,
      components: [{
        version: 1,
        id: "brand-lockup-sub",
        kind: "headline",
        role: "hero",
        entityId: "cta",
        pluginUid: "brand-resolve-brand-lockup",
      }],
      moments: [{
        version: 1,
        id: "brand-lands",
        sceneId: "brand-resolve",
        atSec: 1.2,
        title: "Brand lands",
        visualState: "The complete lockup is readable",
        change: "The brand resolves",
        motionIntent: "reveal",
        importance: "primary",
      }],
      spatialIntent: {
        version: 1,
        focalPart: "brand-lockup-sub",
        composition: "layout-center-stack",
        relationships: ["wordmark and supporting line read as one lockup"],
      },
    }];
    const phrase = resolveCameraBlockingPlan(brand, resolveContinuityGraph(brand))
      .scenes[0]!.phrases.find((candidate) => candidate.importance === "primary")!;

    expect(phrase.target.entityKind).toBe("cta");
    expect(phrase.occupancy).toMatchObject({ min: 0.025, preferred: 0.08 });
    expect(phrase.framingTarget).toEqual({ kind: "part", id: "brand-lockup" });
    expect(phrase.arrivalPose.anchor).toMatchObject({ x: 0.5, y: 0.5, name: "center" });
  });

  it("keeps a primary plugin toast inside a compact status occupancy range", () => {
    const storyboard: DirectScene[] = [{
      id: "alert-open",
      title: "Alert open",
      purpose: "land one notification without turning it into a hero panel",
      startSec: 0,
      durationSec: 3,
      components: [{
        version: 1,
        id: "notices-toast-1",
        kind: "toast",
        pluginUid: "alert-open-notices",
      }],
      beats: [{
        version: 1,
        id: "notice-open",
        sceneId: "alert-open",
        component: "notices-toast-1",
        kind: "open",
        atSec: 0.3,
      }],
      moments: [{
        version: 1,
        id: "notice-lands",
        sceneId: "alert-open",
        atSec: 0.3,
        title: "Notice lands",
        visualState: "One compact product toast is readable",
        change: "The toast opens",
        motionIntent: "reveal",
        importance: "primary",
      }],
      spatialIntent: {
        version: 1,
        focalPart: "notices-toast-1",
        composition: "compact notification",
        relationships: [],
      },
    }];
    const phrase = resolveCameraBlockingPlan(storyboard, resolveContinuityGraph(storyboard))
      .scenes[0]!.phrases.find((candidate) => candidate.importance === "primary")!;

    expect(phrase.occupancy).toEqual({ min: 0.0025, preferred: 0.012, max: 0.065 });
  });

  it("uses a true minimum-jerk quintic with clean endpoint derivatives", () => {
    expect(minimumJerkProgress(0)).toBe(0);
    expect(minimumJerkProgress(1)).toBe(1);
    const epsilon = 0.0001;
    const startVelocity = (minimumJerkProgress(epsilon) - minimumJerkProgress(0)) / epsilon;
    const endVelocity = (minimumJerkProgress(1) - minimumJerkProgress(1 - epsilon)) / epsilon;
    expect(startVelocity).toBeLessThan(0.001);
    expect(endVelocity).toBeLessThan(0.001);
    expect(minimumJerkProgress(0.5)).toBeCloseTo(0.5, 8);
  });

  it("joins browser geometry to landings and exposes the acceptance metrics", () => {
    const storyboard = scenes();
    const graph = resolveContinuityGraph(storyboard);
    const plan = resolveCameraBlockingPlan(storyboard, graph);
    const blocks = plan.scenes.flatMap((scene) => scene.phrases);
    const samples = blocks.map((block) => ({
      time: block.arrivalSec,
      sceneId: block.sceneId,
      phraseId: block.phraseId,
      attention: { kind: "part" as const, id: block.target.id },
      focal: {
        found: true,
        visibleFraction: 1,
        occupancyFraction: block.occupancy.preferred,
        centerX: block.arrivalPose.anchor.x * 1920,
        centerY: block.arrivalPose.anchor.y * 1080,
        width: 900,
        height: 600,
        speed: 0.01,
        acceleration: 0.02,
        jerk: 0.03,
      },
      independentMotionCount: 1,
    }));
    const motion = {
      version: 1,
      advisory: true,
      sampleHz: 8,
      frame: { width: 1920, height: 1080 },
      samples,
      reversals: [],
      jerkMarkers: [],
      quietWindows: [],
      settleWindows: [],
      scenes: [],
      summary: {
        sampleCount: samples.length,
        focalFoundSamples: samples.length,
        minimumVisibleFraction: 1,
        meanVisibleFraction: 1,
        minimumOccupancyFraction: 0.2,
        meanOccupancyFraction: 0.42,
        offframeSamples: 0,
        tinyFocalSamples: 0,
        peakSpeed: 0.01,
        peakAcceleration: 0.02,
        peakJerk: 0.03,
        reversalCount: 0,
        jerkMarkerCount: 0,
        maxIndependentMotionCount: 1,
        meanIndependentMotionCount: 1,
        settleWindowCount: 0,
        measuredSettleWindowCount: 0,
        settledByWindowEndCount: 0,
        quietWindowCount: 0,
        maxQuietWindowSec: 0,
      },
      advisories: [],
    } satisfies ContinuousMotionEvidenceV1;
    const evidence = buildCameraBlockingEvidence(plan, graph, motion);
    expect(evidence.summary.threeShotEntityCount).toBe(1);
    expect(evidence.summary.primaryReadableCount).toBe(evidence.summary.primaryLandingCount);
    expect(evidence.summary.occupancyInRangeCount).toBe(evidence.summary.landingCount);
    expect(evidence.advisories).toEqual([]);

    const primaryBlock = blocks.find((block) => block.importance === "primary")!;
    const offAnchorMotion: ContinuousMotionEvidenceV1 = {
      ...motion,
      samples: motion.samples.map((sample) =>
        sample.sceneId === primaryBlock.sceneId && sample.phraseId === primaryBlock.phraseId
          ? {
              ...sample,
              focal: {
                ...sample.focal,
                centerX: sample.focal.centerX + motion.frame.width * 0.141,
              },
            }
          : sample
      ),
    };
    const offAnchor = buildCameraBlockingEvidence(plan, graph, offAnchorMotion);
    expect(offAnchor.summary.primaryReadableCount).toBe(
      offAnchor.summary.primaryLandingCount - 1,
    );
    expect(offAnchor.advisories.some((entry) => entry.includes("missed their screen anchor"))).toBe(true);

    const movingMotion: ContinuousMotionEvidenceV1 = {
      ...motion,
      samples: motion.samples.map((sample) =>
        sample.sceneId === primaryBlock.sceneId && sample.phraseId === primaryBlock.phraseId
          ? { ...sample, focal: { ...sample.focal, speed: 0.0181 } }
          : sample
      ),
    };
    const moving = buildCameraBlockingEvidence(plan, graph, movingMotion);
    expect(moving.summary.primaryReadableCount).toBe(
      moving.summary.primaryLandingCount - 1,
    );
    expect(moving.advisories.some((entry) =>
      entry.includes("above 0.018 normalized frame-diagonals/s")
    )).toBe(true);
  });

  it("records the settled in-dwell sample instead of an entrance frame", () => {
    const storyboard = scenes();
    const graph = resolveContinuityGraph(storyboard);
    const plan = resolveCameraBlockingPlan(storyboard, graph);
    const block = plan.scenes.flatMap((scene) => scene.phrases)
      .find((phrase) => phrase.importance === "primary")!;
    const sample = (time: number, found: boolean, speed: number) => ({
      time,
      sceneId: block.sceneId,
      phraseId: block.phraseId,
      attention: { kind: "part" as const, id: block.target.id },
      focal: {
        found,
        visibleFraction: found ? 1 : 0,
        occupancyFraction: found ? block.occupancy.preferred : 0,
        centerX: block.arrivalPose.anchor.x * 1920,
        centerY: block.arrivalPose.anchor.y * 1080,
        width: found ? 600 : 0,
        height: found ? 360 : 0,
        speed,
        acceleration: 0,
        jerk: 0,
      },
      independentMotionCount: found ? 1 : 0,
    });
    const lateTime = Math.max(block.arrivalSec, block.dwell.endSec - 0.08);
    const motion = {
      version: 1,
      advisory: true,
      sampleHz: 8,
      frame: { width: 1920, height: 1080 },
      samples: [sample(block.arrivalSec, false, 0.08), sample(lateTime, true, 0)],
      reversals: [],
      jerkMarkers: [],
      quietWindows: [],
      settleWindows: [],
      scenes: [],
      summary: {
        sampleCount: 2, focalFoundSamples: 1, minimumVisibleFraction: 0,
        meanVisibleFraction: 0.5, minimumOccupancyFraction: 0,
        meanOccupancyFraction: block.occupancy.preferred / 2, offframeSamples: 1,
        tinyFocalSamples: 1, peakSpeed: 0.08, peakAcceleration: 0, peakJerk: 0,
        reversalCount: 0, jerkMarkerCount: 0, maxIndependentMotionCount: 1,
        meanIndependentMotionCount: 0.5, settleWindowCount: 0,
        measuredSettleWindowCount: 0, settledByWindowEndCount: 0,
        quietWindowCount: 0, maxQuietWindowSec: 0,
      },
      advisories: [],
    } satisfies ContinuousMotionEvidenceV1;

    const landing = buildCameraBlockingEvidence(plan, graph, motion).landings
      .find((candidate) => candidate.blockId === block.id)!;
    expect(landing.time).toBe(lateTime);
    expect(landing.measured).toBe(true);
    expect(landing.visibleFraction).toBe(1);
    expect(landing.speed).toBe(0);
  });

  it("waives the subject's solo occupancy floor for ensemble phrases with a framingTarget", () => {
    const storyboard = scenes();
    const graph = resolveContinuityGraph(storyboard);
    const plan = resolveCameraBlockingPlan(storyboard, graph);
    const template = plan.scenes[0]!.phrases[0]!;
    const framed = {
      ...template,
      id: "shot-1:ensemble-test:blocking",
      phraseId: "ensemble-test",
      framingTarget: { kind: "region" as const, id: "product-ui" },
      framingOccupancy: { min: 0.1, preferred: 0.22, max: 0.42 },
      occupancy: { min: 0.018, preferred: 0.055, max: 0.14 },
      nextHandoff: undefined,
    };
    plan.scenes[0]!.phrases.push(framed);
    const unframed = plan.scenes[1]!.phrases.find((block) => !block.framingTarget)!;
    expect(unframed).toBeDefined();
    const sampleFor = (block: typeof template) => ({
      time: block.arrivalSec,
      sceneId: block.sceneId,
      phraseId: block.phraseId,
      attention: { kind: "part" as const, id: block.target.id },
      focal: {
        found: true,
        visibleFraction: 1,
        // The runtime capped zoom for the ensemble context, so the subject
        // sits well below its solo floor (the verify-1 recovery-cta class).
        occupancyFraction: block.occupancy.min * 0.4,
        centerX: block.arrivalPose.anchor.x * 1920,
        centerY: block.arrivalPose.anchor.y * 1080,
        width: 300,
        height: 120,
        speed: 0.01,
        acceleration: 0.02,
        jerk: 0.03,
      },
      independentMotionCount: 1,
    });
    const motion = {
      version: 1,
      advisory: true,
      sampleHz: 8,
      frame: { width: 1920, height: 1080 },
      samples: [sampleFor(framed), sampleFor(unframed)],
      reversals: [],
      jerkMarkers: [],
      quietWindows: [],
      settleWindows: [],
      scenes: [],
      summary: {
        sampleCount: 2,
        focalFoundSamples: 2,
        minimumVisibleFraction: 1,
        meanVisibleFraction: 1,
        minimumOccupancyFraction: 0.01,
        meanOccupancyFraction: 0.02,
        offframeSamples: 0,
        tinyFocalSamples: 0,
        peakSpeed: 0.01,
        peakAcceleration: 0.02,
        peakJerk: 0.03,
        reversalCount: 0,
        jerkMarkerCount: 0,
        maxIndependentMotionCount: 1,
        meanIndependentMotionCount: 1,
        settleWindowCount: 0,
        measuredSettleWindowCount: 0,
        settledByWindowEndCount: 0,
        quietWindowCount: 0,
        maxQuietWindowSec: 0,
      },
      advisories: [],
    } satisfies ContinuousMotionEvidenceV1;
    const evidence = buildCameraBlockingEvidence(plan, graph, motion);
    const framedLanding = evidence.landings.find((landing) => landing.blockId === framed.id)!;
    const unframedLanding = evidence.landings.find((landing) => landing.blockId === unframed.id)!;
    expect(framedLanding.occupancyInRange).toBe(true);
    expect(unframedLanding.occupancyInRange).toBe(false);
  });
});
