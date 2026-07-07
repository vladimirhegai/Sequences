/**
 * Animated grade shift (MD4) — the background color morph, narrowed to a
 * motivated turn of the film's temperature.
 *
 * A scene starts on its authored grade class; at `atSec` an oversized
 * kit-owned panel expands from `fromPart`'s center (default: frame center) to
 * cover the frame, and at full cover the fx runtime swaps the scene's grade
 * class to `toGrade` under the panel, then fades the panel into the incoming
 * wash's steady state — transform + opacity only, no filter on the world.
 *
 * This module owns the typed declaration, its deterministic normalization, and
 * the always-drop-invalid governor (a volunteered garnish that fails the
 * discipline is dropped, never a veto — the `dropUnusableVolunteeredTimeRamps`
 * precedent). The compile lives in `fxContract.ts` + `sequences-fx.v1.js`; the
 * per-grade panel wash colors live in the cinema kit CSS.
 */
import type { DirectScene } from "./directComposition.ts";

export type GradeTone = "cold" | "neutral" | "warm" | "noir";

export const GRADE_TONES: readonly GradeTone[] = ["cold", "neutral", "warm", "noir"];

/** The panel scales to full cover over this window (seqSwoosh). */
export const GRADE_SHIFT_DURATION_SEC = 0.9;
/** After cover the new wash needs room to read before the scene ends. */
export const GRADE_SHIFT_MIN_AFTERMATH_SEC = 1.2;
/** How far a declared moment may sit from the shift and still motivate it. */
export const GRADE_SHIFT_MOMENT_TOLERANCE_SEC = 0.5;
export const MAX_GRADE_SHIFTS_PER_FILM = 2;

/** One typed mid-scene grade transition (times are absolute composition sec). */
export interface SceneGradeShiftV1 {
  version: 1;
  atSec: number;
  toGrade: GradeTone;
  /** Optional data-part the wash expands from (default: frame center). */
  fromPart?: string;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function stableName(value: unknown): string {
  const raw = typeof value === "string" ? value.trim() : "";
  return /^[a-z][a-z0-9-]{0,63}$/.test(raw) ? raw : "";
}

/**
 * Shape-normalize a declared grade shift in the model's OWN scene frame (like
 * `normalizeStoryboardTimeRamp`): a finite atSec and a known toGrade are
 * required; a scene-relative atSec (authored from zero) is lifted into
 * composition time; fromPart is kept only when it is a stable id. The absolute
 * atSec is shifted by the re-basing delta by the caller.
 */
export function normalizeStoryboardGradeShift(
  value: unknown,
  scene: { startSec: number; durationSec: number },
): SceneGradeShiftV1 | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const item = value as Record<string, unknown>;
  const toGrade = typeof item.toGrade === "string" ? item.toGrade.trim().toLowerCase() : "";
  if (!GRADE_TONES.includes(toGrade as GradeTone)) return undefined;
  const rawAtSec = Number(item.atSec);
  if (!Number.isFinite(rawAtSec)) return undefined;
  const sceneEnd = scene.startSec + scene.durationSec;
  const atSec =
    scene.startSec > 0 && rawAtSec >= 0 && rawAtSec < scene.startSec && rawAtSec <= scene.durationSec
      ? scene.startSec + rawAtSec
      : rawAtSec;
  const fromPart = stableName(item.fromPart);
  return {
    version: 1,
    atSec: round(Math.min(Math.max(atSec, scene.startSec), sceneEnd)),
    toGrade: toGrade as GradeTone,
    ...(fromPart ? { fromPart } : {}),
  };
}

/**
 * Deterministic discipline governor (SENTINEL L2, degrade-never-veto): a grade
 * shift is a volunteered garnish, so an undisciplined one is dropped with a
 * note rather than vetoing a paid attempt. Rules (plan §MD4): atSec inside the
 * scene with >= GRADE_SHIFT_MIN_AFTERMATH_SEC of aftermath, at most one per
 * scene, at most MAX_GRADE_SHIFTS_PER_FILM per film, and it must coincide
 * (+/-GRADE_SHIFT_MOMENT_TOLERANCE_SEC) with a declared moment — a shift IS a
 * story state change, so an unmotivated one has no reason to fire.
 */
export function dropUnusableGradeShifts(
  storyboard: DirectScene[],
): { storyboard: DirectScene[]; dropped: string[] } {
  const dropped: string[] = [];
  let filmShifts = 0;
  const scenes = storyboard.map((scene) => {
    if (!scene.gradeShift) return scene;
    const shift = scene.gradeShift;
    const sceneEnd = scene.startSec + scene.durationSec;
    let reason = "";
    if (shift.atSec < scene.startSec - 0.01 || shift.atSec > sceneEnd + 0.01) {
      reason = "atSec is outside the scene window";
    } else if (sceneEnd - shift.atSec < GRADE_SHIFT_MIN_AFTERMATH_SEC) {
      reason =
        `only ${(sceneEnd - shift.atSec).toFixed(1)}s of aftermath (needs ` +
        `>=${GRADE_SHIFT_MIN_AFTERMATH_SEC}s for the new wash to read)`;
    } else if (
      !(scene.moments ?? []).some((moment) =>
        Math.abs(moment.atSec - shift.atSec) <= GRADE_SHIFT_MOMENT_TOLERANCE_SEC
      )
    ) {
      reason = "no declared moment within +/-0.5s to motivate the temperature turn";
    } else if (filmShifts >= MAX_GRADE_SHIFTS_PER_FILM) {
      reason = `over the ${MAX_GRADE_SHIFTS_PER_FILM}-per-film cap`;
    }
    if (reason) {
      dropped.push(`scene "${scene.id}": dropped gradeShift → ${shift.toGrade} (${reason})`);
      const { gradeShift: _dropped, ...rest } = scene;
      return rest;
    }
    filmShifts += 1;
    return scene;
  });
  return { storyboard: scenes, dropped };
}
