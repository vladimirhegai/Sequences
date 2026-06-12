/**
 * The command API (T5) — the ONE mutation pathway for everything. UI drags,
 * CLI calls, and (in Phase 1) agent MCP tools are all these same operations.
 *
 * `applyCommand(project, cmd)` is pure: it returns the next project plus the
 * exact inverse command, which is what makes undo/redo and "revert everything
 * the agent just did" free. Commands are zod-validated because agents emit
 * them as JSON.
 */
import { z } from "zod";
import {
  AssetSchema,
  BoxSchema,
  CameraSchema,
  ChoreographySchema,
  LayerOverrideSchema,
  SceneSchema,
  SlotValueSchema,
  TransitionKindSchema,
  type Project,
} from "./schema.ts";
import { COLOR_TOKEN_IDS } from "./tokens.ts";

const HexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const CommandSchema: z.ZodType<unknown> = z.lazy(() =>
  z.discriminatedUnion("type", [
    z.object({ type: z.literal("AddScene"), scene: SceneSchema, index: z.number().int().min(0).optional() }),
    z.object({ type: z.literal("RemoveScene"), sceneId: z.string() }),
    z.object({ type: z.literal("ReorderScene"), sceneId: z.string(), toIndex: z.number().int().min(0) }),
    z.object({ type: z.literal("SetSceneDuration"), sceneId: z.string(), durationFrames: z.number().int().min(15).max(1800) }),
    z.object({ type: z.literal("SetSceneLayout"), sceneId: z.string(), layout: z.string() }),
    z.object({ type: z.literal("SetSlotContent"), sceneId: z.string(), slot: z.string(), value: SlotValueSchema.nullable() }),
    z.object({ type: z.literal("SetTransition"), afterSceneId: z.string(), kind: TransitionKindSchema.nullable() }),
    z.object({ type: z.literal("SetMotionProfile"), profile: z.string() }),
    z.object({ type: z.literal("SetBrandColor"), key: z.enum(COLOR_TOKEN_IDS), value: HexColor }),
    z.object({ type: z.literal("SetBrandFont"), key: z.enum(["display", "body"]), value: z.string().min(1) }),
    z.object({ type: z.literal("OverrideLayerBox"), sceneId: z.string(), layerId: z.string(), box: BoxSchema.partial().nullable() }),
    z.object({ type: z.literal("SwapMotion"), sceneId: z.string(), layerId: z.string(), phase: z.enum(["enter", "exit"]), primitive: z.string().nullable() }),
    z.object({ type: z.literal("SetLayerOverride"), sceneId: z.string(), layerId: z.string(), patch: LayerOverrideSchema.nullable() }),
    z.object({ type: z.literal("SetChoreography"), sceneId: z.string(), choreography: ChoreographySchema }),
    z.object({ type: z.literal("SetSceneCamera"), sceneId: z.string(), camera: CameraSchema.nullable() }),
    z.object({ type: z.literal("AddAsset"), asset: AssetSchema, index: z.number().int().min(0).optional() }),
    z.object({ type: z.literal("RemoveAsset"), assetId: z.string() }),
    z.object({ type: z.literal("Batch"), commands: z.array(CommandSchema).min(1).max(100) }),
  ]),
);

// The discriminated union above is self-referential (Batch), so we write the
// TS type by hand; a test asserts the schema accepts every command we apply.
export type Command =
  | { type: "AddScene"; scene: z.infer<typeof SceneSchema>; index?: number }
  | { type: "RemoveScene"; sceneId: string }
  | { type: "ReorderScene"; sceneId: string; toIndex: number }
  | { type: "SetSceneDuration"; sceneId: string; durationFrames: number }
  | { type: "SetSceneLayout"; sceneId: string; layout: string }
  | { type: "SetSlotContent"; sceneId: string; slot: string; value: z.infer<typeof SlotValueSchema> | null }
  | { type: "SetTransition"; afterSceneId: string; kind: z.infer<typeof TransitionKindSchema> | null }
  | { type: "SetMotionProfile"; profile: string }
  | { type: "SetBrandColor"; key: (typeof COLOR_TOKEN_IDS)[number]; value: string }
  | { type: "SetBrandFont"; key: "display" | "body"; value: string }
  | { type: "OverrideLayerBox"; sceneId: string; layerId: string; box: Partial<z.infer<typeof BoxSchema>> | null }
  | { type: "SwapMotion"; sceneId: string; layerId: string; phase: "enter" | "exit"; primitive: string | null }
  | { type: "SetLayerOverride"; sceneId: string; layerId: string; patch: z.infer<typeof LayerOverrideSchema> | null }
  | { type: "SetChoreography"; sceneId: string; choreography: z.infer<typeof ChoreographySchema> }
  | { type: "SetSceneCamera"; sceneId: string; camera: z.infer<typeof CameraSchema> | null }
  | { type: "AddAsset"; asset: z.infer<typeof AssetSchema>; index?: number }
  | { type: "RemoveAsset"; assetId: string }
  | { type: "Batch"; commands: Command[] };

export class CommandError extends Error {}

function findScene(project: Project, sceneId: string) {
  const index = project.scenes.findIndex((s) => s.id === sceneId);
  if (index === -1) throw new CommandError(`unknown scene: ${sceneId}`);
  return { scene: project.scenes[index]!, index };
}

/** Drop override entries that became empty so inverses roundtrip exactly. */
function pruneOverride(scene: Project["scenes"][number], layerId: string): void {
  const override = scene.overrides[layerId];
  if (override && Object.keys(override).length === 0) delete scene.overrides[layerId];
}

export interface ApplyResult {
  project: Project;
  inverse: Command;
}

export function applyCommand(input: Project, cmd: Command): ApplyResult {
  const project = structuredClone(input);

  switch (cmd.type) {
    case "AddScene": {
      if (project.scenes.some((s) => s.id === cmd.scene.id)) {
        throw new CommandError(`scene id already exists: ${cmd.scene.id}`);
      }
      const index = Math.min(cmd.index ?? project.scenes.length, project.scenes.length);
      project.scenes.splice(index, 0, cmd.scene);
      return { project, inverse: { type: "RemoveScene", sceneId: cmd.scene.id } };
    }
    case "RemoveScene": {
      const { scene, index } = findScene(project, cmd.sceneId);
      project.scenes.splice(index, 1);
      delete project.transitions[cmd.sceneId];
      return { project, inverse: { type: "AddScene", scene, index } };
    }
    case "ReorderScene": {
      const { scene, index } = findScene(project, cmd.sceneId);
      const toIndex = Math.min(cmd.toIndex, project.scenes.length - 1);
      project.scenes.splice(index, 1);
      project.scenes.splice(toIndex, 0, scene);
      return { project, inverse: { type: "ReorderScene", sceneId: cmd.sceneId, toIndex: index } };
    }
    case "SetSceneDuration": {
      const { scene } = findScene(project, cmd.sceneId);
      const prev = scene.durationFrames;
      scene.durationFrames = cmd.durationFrames;
      return {
        project,
        inverse: { type: "SetSceneDuration", sceneId: cmd.sceneId, durationFrames: prev },
      };
    }
    case "SetSceneLayout": {
      const { scene } = findScene(project, cmd.sceneId);
      const prev = scene.layout ?? "";
      // "" is the canonical "use archetype default" — clears the field so
      // inverses of first-time layout sets roundtrip exactly.
      if (cmd.layout === "") delete scene.layout;
      else scene.layout = cmd.layout;
      return { project, inverse: { type: "SetSceneLayout", sceneId: cmd.sceneId, layout: prev } };
    }
    case "SetSlotContent": {
      const { scene } = findScene(project, cmd.sceneId);
      const prev = scene.slots[cmd.slot] ?? null;
      if (cmd.value === null) delete scene.slots[cmd.slot];
      else scene.slots[cmd.slot] = cmd.value;
      return {
        project,
        inverse: { type: "SetSlotContent", sceneId: cmd.sceneId, slot: cmd.slot, value: prev },
      };
    }
    case "SetTransition": {
      findScene(project, cmd.afterSceneId);
      const prev = project.transitions[cmd.afterSceneId] ?? null;
      if (cmd.kind === null) delete project.transitions[cmd.afterSceneId];
      else project.transitions[cmd.afterSceneId] = cmd.kind;
      return {
        project,
        inverse: { type: "SetTransition", afterSceneId: cmd.afterSceneId, kind: prev },
      };
    }
    case "SetMotionProfile": {
      const prev = project.motionProfile;
      project.motionProfile = cmd.profile;
      return { project, inverse: { type: "SetMotionProfile", profile: prev } };
    }
    case "SetBrandColor": {
      const prev = project.brand.colors[cmd.key];
      project.brand.colors[cmd.key] = cmd.value;
      return { project, inverse: { type: "SetBrandColor", key: cmd.key, value: prev } };
    }
    case "SetBrandFont": {
      const prev = project.brand.fonts[cmd.key];
      project.brand.fonts[cmd.key] = cmd.value;
      return { project, inverse: { type: "SetBrandFont", key: cmd.key, value: prev } };
    }
    case "OverrideLayerBox": {
      const { scene } = findScene(project, cmd.sceneId);
      const existing = scene.overrides[cmd.layerId];
      const prevBox = existing?.box ?? null;
      if (cmd.box === null) {
        if (existing) delete existing.box;
      } else {
        scene.overrides[cmd.layerId] = { ...existing, box: { ...existing?.box, ...cmd.box } };
      }
      pruneOverride(scene, cmd.layerId);
      return {
        project,
        inverse: { type: "OverrideLayerBox", sceneId: cmd.sceneId, layerId: cmd.layerId, box: prevBox },
      };
    }
    case "SwapMotion": {
      const { scene } = findScene(project, cmd.sceneId);
      const existing = scene.overrides[cmd.layerId] ?? {};
      const field = cmd.phase === "enter" ? "enterPrimitive" : "exitPrimitive";
      const prev = existing[field] ?? null;
      if (cmd.primitive === null) delete existing[field];
      else existing[field] = cmd.primitive;
      scene.overrides[cmd.layerId] = existing;
      pruneOverride(scene, cmd.layerId);
      return {
        project,
        inverse: {
          type: "SwapMotion",
          sceneId: cmd.sceneId,
          layerId: cmd.layerId,
          phase: cmd.phase,
          primitive: prev,
        },
      };
    }
    case "SetLayerOverride": {
      const { scene } = findScene(project, cmd.sceneId);
      const prev = scene.overrides[cmd.layerId] ?? null;
      if (cmd.patch === null) delete scene.overrides[cmd.layerId];
      else scene.overrides[cmd.layerId] = { ...prev, ...cmd.patch };
      return {
        project,
        inverse: { type: "SetLayerOverride", sceneId: cmd.sceneId, layerId: cmd.layerId, patch: prev },
      };
    }
    case "SetChoreography": {
      const { scene } = findScene(project, cmd.sceneId);
      const prev = scene.choreography;
      scene.choreography = cmd.choreography;
      return {
        project,
        inverse: { type: "SetChoreography", sceneId: cmd.sceneId, choreography: prev },
      };
    }
    case "SetSceneCamera": {
      const { scene } = findScene(project, cmd.sceneId);
      const prev = scene.camera ?? null;
      if (cmd.camera === null) delete scene.camera;
      else scene.camera = cmd.camera;
      return {
        project,
        inverse: { type: "SetSceneCamera", sceneId: cmd.sceneId, camera: prev },
      };
    }
    case "AddAsset": {
      if (project.assets.some((a) => a.id === cmd.asset.id)) {
        throw new CommandError(`asset id already exists: ${cmd.asset.id}`);
      }
      const index = Math.min(cmd.index ?? project.assets.length, project.assets.length);
      project.assets.splice(index, 0, cmd.asset);
      return { project, inverse: { type: "RemoveAsset", assetId: cmd.asset.id } };
    }
    case "RemoveAsset": {
      // Removing an asset a slot still references is rejected downstream by
      // validateProject (the store gates on it) — no special case here.
      const index = project.assets.findIndex((a) => a.id === cmd.assetId);
      if (index === -1) throw new CommandError(`unknown asset: ${cmd.assetId}`);
      const [asset] = project.assets.splice(index, 1);
      return { project, inverse: { type: "AddAsset", asset: asset!, index } };
    }
    case "Batch": {
      let current = project;
      const inverses: Command[] = [];
      for (const sub of cmd.commands) {
        const result = applyCommand(current, sub);
        current = result.project;
        inverses.unshift(result.inverse);
      }
      return { project: current, inverse: { type: "Batch", commands: inverses } };
    }
    default: {
      throw new CommandError(`unknown command type: ${(cmd as { type: string }).type}`);
    }
  }
}
