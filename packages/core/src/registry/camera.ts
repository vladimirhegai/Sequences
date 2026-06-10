/**
 * Camera moves — scene-level stage transforms (the plan's virtual-camera
 * system, with the `pushIn` primitive brought forward to Phase 1 per the
 * review amendment). A camera move transforms the scene's `.seq-camera`
 * stage wrapper, so the WHOLE frame travels — what separates "slides with
 * animation" from "filmed motion graphics".
 *
 * Token-pure: travel distance is a scale token; the easing is the `move.glide`
 * token. Moves span the full scene and are sub-perceptual by design, so they
 * are exempt from the simultaneity cap (like continuous motions).
 */
import type { CameraMove } from "../schema.ts";

export interface CameraMoveDef {
  id: CameraMove;
  summary: string;
}

export const CAMERA_MOVES: Record<CameraMove, CameraMoveDef> = {
  pushIn: {
    id: "pushIn",
    summary:
      "Slow whole-frame push toward the content across the scene. Use on the hero beat (feature reveal, walkthrough) — at most one or two per video.",
  },
  pullBack: {
    id: "pullBack",
    summary:
      "Starts close and settles out to the full frame. Use to open a scene with intimacy (a quote, a stat) before revealing context.",
  },
};

export const CAMERA_MOVE_IDS = Object.keys(CAMERA_MOVES) as CameraMove[];
