/**
 * Canonical camera semantic model.
 *
 * Authored camera segments describe choreography while direction/continuity
 * blocking describes what must be readable. This module joins those inputs
 * once into the phrases executed by the browser runtime and inspected by QA.
 * It deliberately contains no DOM geometry: poses are semantic constraints
 * whose concrete x/y/scale values are measured at runtime.
 */
import type { CameraPlanV1, CameraSegmentV1 } from "./cameraContract.ts";
import type { ContinuityEntityKind } from "./continuityGraph.ts";
import type { DirectionPhraseV1 } from "./directionScore.ts";

export interface CameraPhraseTargetV1 {
  kind: "part" | "region" | "selector";
  id: string;
  entityId?: string;
  entityKind?: ContinuityEntityKind;
}

export interface CameraPhraseAnchorV1 {
  x: number;
  y: number;
  name: "center" | "left-third" | "right-third" | "top-third" | "bottom-third" |
    "top-right" | "bottom-right";
}

export interface CameraPhrasePoseV1 {
  target?: { kind: "part" | "region"; id: string };
  anchor: CameraPhraseAnchorV1;
  lens: "fit" | "detail" | "wide";
  zoom: number;
}

export type CameraPhraseRouteOwnershipV1 = "authored" | "continuity" | "host-derived";

export interface CameraPhraseEvidenceOwnerV1 {
  kind: "camera-segment" | "continuity-edge" | "direction-phrase";
  id: string;
}

export interface CameraPhraseV1 {
  id: string;
  sceneId: string;
  phraseId: string;
  role: DirectionPhraseV1["role"];
  importance: "primary" | "supporting";
  routeOwnership: CameraPhraseRouteOwnershipV1;
  evidenceOwner: CameraPhraseEvidenceOwnerV1;
  startSec: number;
  arrivalSec: number;
  endSec: number;
  target: CameraPhraseTargetV1;
  /** Camera frames this contextual station while evidence follows `target`. */
  framingTarget?: { kind: "part" | "region"; id: string };
  occupancy: { min: number; preferred: number; max: number };
  framingOccupancy?: { min: number; preferred: number; max: number };
  sourcePose: CameraPhrasePoseV1;
  arrivalPose: CameraPhrasePoseV1;
  corridor: { from: CameraPhraseAnchorV1; to: CameraPhraseAnchorV1; padding: number };
  travel: { startSec: number; endSec: number };
  settle: { startSec: number; endSec: number };
  dwell: { startSec: number; endSec: number; readableSec: number };
  departure: { startSec: number; endSec: number };
  nextHandoff?: { entityId: string; toScene: string; toPart: string; atSec: number };
}

export interface CameraPhrasePlanV1 {
  version: 1;
  enabled: true;
  solver: {
    curve: "minimum-jerk-quintic";
    measuredDom: true;
    maxNormalizedVelocity: number;
    maxNormalizedAcceleration: number;
    maxNormalizedJerk: number;
  };
  scenes: Array<{ sceneId: string; phrases: CameraPhraseV1[] }>;
  summary: {
    phraseCount: number;
    explicitTargetCount: number;
    primaryPhraseCount: number;
    primaryWithReadableLandingCount: number;
    authoredRouteCount: number;
    continuityRouteCount: number;
    hostDerivedRouteCount: number;
  };
}

/** Blocking resolver output before authored-route ownership is joined. */
export type CameraPhraseSeedV1 = Omit<
  CameraPhraseV1,
  "routeOwnership" | "evidenceOwner" | "sourcePose" | "travel" | "settle" | "departure"
> & {
  settleUntilSec: number;
};

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function segmentTarget(segment: CameraSegmentV1, from = false): CameraPhrasePoseV1["target"] {
  const part = from ? segment.fromPart : segment.toPart;
  const region = from ? segment.fromRegion : segment.toRegion;
  if (part) return { kind: "part", id: part };
  if (region) return { kind: "region", id: region };
  return undefined;
}

function targetMatches(
  segment: CameraSegmentV1,
  phrase: CameraPhraseSeedV1,
): boolean {
  if (segment.toPart === phrase.target.id) return true;
  if (segment.toRegion === phrase.target.id) return true;
  return Boolean(
    phrase.framingTarget?.kind === "part" && segment.toPart === phrase.framingTarget.id ||
    phrase.framingTarget?.kind === "region" && segment.toRegion === phrase.framingTarget.id
  );
}

function authoredSegmentFor(
  plan: CameraPlanV1,
  phrase: CameraPhraseSeedV1,
): CameraSegmentV1 | undefined {
  const segments = plan.scenes.find((scene) => scene.sceneId === phrase.sceneId)?.segments ?? [];
  return segments
    .filter((segment) =>
      targetMatches(segment, phrase) &&
      segment.startSec <= phrase.arrivalSec + 0.02 &&
      segment.endSec >= phrase.startSec - 0.02
    )
    .sort((a, b) =>
      Math.abs(a.endSec - phrase.arrivalSec) - Math.abs(b.endSec - phrase.arrivalSec)
    )[0];
}

function routeOwnership(
  segment: CameraSegmentV1 | undefined,
  phrase: CameraPhraseSeedV1,
): CameraPhraseRouteOwnershipV1 {
  if (segment && segment.move !== "hold" && segment.move !== "drift") return "authored";
  if (phrase.nextHandoff || phrase.target.entityId) return "continuity";
  return "host-derived";
}

function evidenceOwner(
  segment: CameraSegmentV1 | undefined,
  phrase: CameraPhraseSeedV1,
): CameraPhraseEvidenceOwnerV1 {
  if (segment && segment.move !== "hold" && segment.move !== "drift") {
    return {
      kind: "camera-segment",
      id: `${phrase.sceneId}:${segment.move}@${round(segment.startSec)}`,
    };
  }
  if (phrase.nextHandoff) {
    return {
      kind: "continuity-edge",
      id: `${phrase.nextHandoff.entityId}:${phrase.sceneId}->${phrase.nextHandoff.toScene}`,
    };
  }
  return { kind: "direction-phrase", id: phrase.phraseId };
}

/**
 * Join authored camera routes and direction/continuity blocking seeds into the
 * single semantic artifact injected for runtime and QA.
 */
export function compileCameraPhrasePlan(args: {
  cameraPlan: CameraPlanV1;
  solver: CameraPhrasePlanV1["solver"];
  scenes: Array<{ sceneId: string; phrases: CameraPhraseSeedV1[] }>;
}): CameraPhrasePlanV1 {
  let previousPose: CameraPhrasePoseV1 | undefined;
  const scenes = args.scenes.map((scene) => ({
    sceneId: scene.sceneId,
    phrases: scene.phrases.map((seed): CameraPhraseV1 => {
      const segment = authoredSegmentFor(args.cameraPlan, seed);
      const arrivalPose: CameraPhrasePoseV1 = {
        target: seed.framingTarget ??
          (seed.target.kind === "selector"
            ? undefined
            : { kind: seed.target.kind, id: seed.target.id }),
        anchor: seed.arrivalPose.anchor,
        lens: seed.arrivalPose.lens,
        zoom: seed.arrivalPose.zoom,
      };
      const sourceTarget = (segment ? segmentTarget(segment, true) : undefined) ??
        previousPose?.target;
      const sourcePose: CameraPhrasePoseV1 = {
        ...(sourceTarget ? { target: sourceTarget } : {}),
        anchor: seed.corridor.from,
        lens: previousPose?.lens ?? "fit",
        zoom: previousPose?.zoom ?? 1,
      };
      const travelStart = round(Math.min(seed.arrivalSec, segment?.startSec ?? seed.startSec));
      const settleEnd = round(Math.min(
        seed.dwell.endSec,
        Math.max(seed.arrivalSec, seed.settleUntilSec),
      ));
      const phrase: CameraPhraseV1 = {
        ...seed,
        routeOwnership: routeOwnership(segment, seed),
        evidenceOwner: evidenceOwner(segment, seed),
        sourcePose,
        arrivalPose,
        travel: { startSec: travelStart, endSec: seed.arrivalSec },
        settle: { startSec: seed.arrivalSec, endSec: settleEnd },
        departure: {
          startSec: seed.dwell.endSec,
          endSec: Math.max(seed.dwell.endSec, seed.endSec),
        },
      };
      delete (phrase as CameraPhraseV1 & { settleUntilSec?: number }).settleUntilSec;
      previousPose = arrivalPose;
      return phrase;
    }),
  }));
  const phrases = scenes.flatMap((scene) => scene.phrases);
  const primary = phrases.filter((phrase) => phrase.importance === "primary");
  return {
    version: 1,
    enabled: true,
    solver: args.solver,
    scenes,
    summary: {
      phraseCount: phrases.length,
      explicitTargetCount: phrases.filter((phrase) => Boolean(phrase.target.id)).length,
      primaryPhraseCount: primary.length,
      primaryWithReadableLandingCount: primary.filter((phrase) => phrase.dwell.readableSec >= 0.35).length,
      authoredRouteCount: phrases.filter((phrase) => phrase.routeOwnership === "authored").length,
      continuityRouteCount: phrases.filter((phrase) => phrase.routeOwnership === "continuity").length,
      hostDerivedRouteCount: phrases.filter((phrase) => phrase.routeOwnership === "host-derived").length,
    },
  };
}
