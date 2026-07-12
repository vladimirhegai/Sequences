import type { TimeRampPlanV1 } from "./timeRamp.ts";
import { warpInverseOf, warpOf } from "./timeRamp.ts";

declare const sourceTimeBrand: unique symbol;
declare const viewerTimeBrand: unique symbol;
declare const durationBrand: unique symbol;
declare const sceneLocalTimeBrand: unique symbol;

/** Absolute seconds on the authored content timeline. */
export type SourceTime = number & { readonly [sourceTimeBrand]: "SourceTime" };
/** Absolute seconds experienced by the viewer after time remapping. */
export type ViewerTime = number & { readonly [viewerTimeBrand]: "ViewerTime" };
/** A non-negative span in seconds, independent of a time domain. */
export type Duration = number & { readonly [durationBrand]: "Duration" };
/** Seconds elapsed from the start of a scene on the source timeline. */
export type SceneLocalTime = number & { readonly [sceneLocalTimeBrand]: "SceneLocalTime" };

function finiteSeconds(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new RangeError(`${label} must be finite`);
  return value;
}

function nonNegativeSeconds(value: number, label: string): number {
  finiteSeconds(value, label);
  if (value < 0) throw new RangeError(`${label} must be non-negative`);
  return value;
}

export const sourceTime = (seconds: number): SourceTime =>
  finiteSeconds(seconds, "SourceTime") as SourceTime;
export const viewerTime = (seconds: number): ViewerTime =>
  finiteSeconds(seconds, "ViewerTime") as ViewerTime;
export const duration = (seconds: number): Duration =>
  nonNegativeSeconds(seconds, "Duration") as Duration;
export const sceneLocalTime = (seconds: number): SceneLocalTime =>
  nonNegativeSeconds(seconds, "SceneLocalTime") as SceneLocalTime;

export function addSourceTime(time: SourceTime, span: Duration): SourceTime {
  return sourceTime(time + span);
}

export function subtractSourceTime(time: SourceTime, span: Duration): SourceTime {
  return sourceTime(time - span);
}

export function addViewerTime(time: ViewerTime, span: Duration): ViewerTime {
  return viewerTime(time + span);
}

export function subtractViewerTime(time: ViewerTime, span: Duration): ViewerTime {
  return viewerTime(time - span);
}

export function addSceneLocalTime(time: SceneLocalTime, span: Duration): SceneLocalTime {
  return sceneLocalTime(time + span);
}

export function subtractSceneLocalTime(time: SceneLocalTime, span: Duration): SceneLocalTime {
  return sceneLocalTime(time - span);
}

export function sourceDuration(from: SourceTime, to: SourceTime): Duration {
  return duration(to - from);
}

export function viewerDuration(from: ViewerTime, to: ViewerTime): Duration {
  return duration(to - from);
}

export function sourceFromSceneLocal(start: SourceTime, local: SceneLocalTime): SourceTime {
  return sourceTime(start + local);
}

export function sceneLocalFromSource(start: SourceTime, time: SourceTime): SceneLocalTime {
  return sceneLocalTime(time - start);
}

export interface TimeConversionService {
  toViewer(time: SourceTime): ViewerTime;
  toSource(time: ViewerTime): SourceTime;
}

/**
 * Build the sole typed boundary between source and viewer time. The existing
 * ramp contract remains the numerical authority so introducing brands cannot
 * alter persisted plans or runtime output.
 */
export function timeConversionService(
  plan?: TimeRampPlanV1,
): TimeConversionService {
  const sourceOfViewer = warpOf(plan);
  const viewerOfSource = warpInverseOf(plan);
  return {
    toViewer: (time) => viewerTime(viewerOfSource(time)),
    toSource: (time) => sourceTime(sourceOfViewer(time)),
  };
}
