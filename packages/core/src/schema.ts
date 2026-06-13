/**
 * The scene graph — the canonical artifact. zod schemas are the single source
 * of truth: TS types are inferred from them and the same schemas validate
 * agent output at runtime.
 *
 * Design notes / deliberate deviations from the master plan (documented in
 * README_dev.md):
 *  - Scene `startFrame` is DERIVED from scene order (scenes always tile the
 *    project exactly, by construction — the tiling invariant cannot be
 *    violated, instead of being merely validated).
 *  - Layers are MATERIALIZED at compile time from archetype + slots + profile
 *    (deterministic). User/agent layer edits live in `scene.overrides` as
 *    sparse patches keyed by layer id. This keeps "change the layout variant"
 *    non-destructive.
 *  - Motion/style numerics are token references (enforced by these enums —
 *    T1). Boxes are raw design-unit px (spatial layout, grid-snap is a linter
 *    rule, not a schema rule).
 */
import { z } from "zod";
import { COLOR_TOKEN_IDS } from "./tokens.ts";

// Literal enums (not derived) so zod output types carry the token literal
// types end-to-end. A sync test asserts these always match tokens.ts.
export const DurationTokenSchema = z.enum([
  "instant",
  "quick",
  "base",
  "relaxed",
  "slow",
  "dramatic",
]);
export const StaggerTokenSchema = z.enum(["tight", "base", "loose"]);
export const TypeTokenSchema = z.enum(["mega", "display", "headline", "title", "body", "caption"]);
export const ScaleTokenSchema = z.enum(["subtle", "pop", "hero"]);
export const ColorTokenSchema = z.enum(COLOR_TOKEN_IDS);

const Id = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-zA-Z][a-zA-Z0-9_-]*$/, "ids must be alphanumeric/dash/underscore");

const HexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "expected #rrggbb hex color");

export const BoxSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number().positive(),
  h: z.number().positive(),
  /** CSS transform-origin; elements scale from their visual anchor. */
  origin: z.string().default("center center"),
});
export type Box = z.infer<typeof BoxSchema>;

export const SlotValueSchema = z.union([
  z.string(), // text slot
  z.array(z.string()).max(6), // text-list slot (bullets, logos row)
  z.object({
    // number slot (stat callouts). The numeric is CONTENT, not motion.
    value: z.number(),
    prefix: z.string().default(""),
    suffix: z.string().default(""),
  }),
  z.object({ assetId: Id }), // media slot
]);
export type SlotValue = z.infer<typeof SlotValueSchema>;

export const LayerOverrideSchema = z.object({
  box: BoxSchema.partial().optional(),
  typeToken: TypeTokenSchema.optional(),
  colorToken: ColorTokenSchema.optional(),
  /** Swap the profile-assigned motion primitive for this layer. */
  enterPrimitive: z.string().optional(),
  exitPrimitive: z.string().optional(),
  enterDuration: DurationTokenSchema.optional(),
  hidden: z.boolean().optional(),
});
export type LayerOverride = z.infer<typeof LayerOverrideSchema>;

export const ChoreographySchema = z.object({
  stagger: StaggerTokenSchema.optional(),
  settleGap: DurationTokenSchema.optional(),
  /** Explicit entrance order (layer ids). Default: visual-hierarchy rank. */
  order: z.array(z.string()).optional(),
});
export type Choreography = z.infer<typeof ChoreographySchema>;

/**
 * Scene-level camera move, applied as a transform on the scene's stage
 * wrapper (`.seq-camera`) — the whole frame travels, not one layer. Spans the
 * full scene; sub-perceptual by token design, so it is exempt from the
 * simultaneity cap (like continuous motions).
 */
export const CameraMoveSchema = z.enum(["pushIn", "pullBack"]);
export type CameraMove = z.infer<typeof CameraMoveSchema>;
export const CameraSchema = z.object({
  move: CameraMoveSchema,
  /** Travel amount — a scale token, never a raw number (T1). */
  scale: ScaleTokenSchema.default("subtle"),
});
export type Camera = z.infer<typeof CameraSchema>;

export const SceneSchema = z.object({
  id: Id,
  archetype: z.string(),
  /** Layout variant id; must exist on the archetype (referential check). */
  layout: z.string().optional(),
  durationFrames: z.number().int().min(15).max(1800),
  slots: z.record(z.string(), SlotValueSchema).default({}),
  choreography: ChoreographySchema.default({}),
  overrides: z.record(z.string(), LayerOverrideSchema).default({}),
  camera: CameraSchema.optional(),
});
export type Scene = z.infer<typeof SceneSchema>;

export const TransitionKindSchema = z.enum(["cut", "fade"]);
export type TransitionKind = z.infer<typeof TransitionKindSchema>;

export const BrandKitSchema = z.object({
  name: z.string().min(1).max(60),
  colors: z.object({
    primary: HexColor,
    surface: HexColor,
    text: HexColor,
    muted: HexColor,
    accent: HexColor,
  }),
  fonts: z.object({
    display: z.string().default("Inter"),
    body: z.string().default("Inter"),
  }),
});
export type BrandKit = z.infer<typeof BrandKitSchema>;

export const AssetSchema = z.object({
  id: Id,
  /** Path relative to the project directory. */
  path: z.string().min(1),
  kind: z.enum(["image", "video", "audio"]),
});
export type Asset = z.infer<typeof AssetSchema>;

export const EnabledExtensionsSchema = z.array(z.string()).nullable();
export const ExtensionSettingsSchema = z.object({
  /** null means "all installed registry entries"; [] is a deliberate empty skill list. */
  enabled: EnabledExtensionsSchema.default(null),
});
export type ExtensionSettings = z.infer<typeof ExtensionSettingsSchema>;

export const ProjectSchema = z.object({
  schemaVersion: z.literal(1),
  meta: z.object({
    title: z.string().min(1).max(120),
    width: z.number().int().positive().default(1920),
    height: z.number().int().positive().default(1080),
    fps: z.union([z.literal(30), z.literal(60)]).default(30),
    background: ColorTokenSchema.default("surface"),
  }),
  brand: BrandKitSchema,
  motionProfile: z.string(),
  scenes: z.array(SceneSchema).min(1),
  /** Transition AFTER the keyed scene (no entry → profile default). */
  transitions: z.record(z.string(), TransitionKindSchema).default({}),
  assets: z.array(AssetSchema).default([]),
  extensions: ExtensionSettingsSchema.default({ enabled: null }),
});
export type Project = z.infer<typeof ProjectSchema>;

/** Derived, by construction: scenes tile the project exactly. */
export function sceneStartFrame(project: Project, sceneId: string): number {
  let start = 0;
  for (const scene of project.scenes) {
    if (scene.id === sceneId) return start;
    start += scene.durationFrames;
  }
  throw new Error(`unknown scene: ${sceneId}`);
}

export function projectDurationFrames(project: Project): number {
  return project.scenes.reduce((sum, s) => sum + s.durationFrames, 0);
}
