/**
 * Project validation: zod schema parse + referential invariants. A project
 * that fails validation cannot reach the compiler — the store rejects any
 * command whose resulting state is invalid.
 */
import { ProjectSchema, type Project } from "./schema.ts";
import { ARCHETYPES, PROFILES, PRIMITIVES, registryExtensionIds } from "./registry/index.ts";

export interface ValidationIssue {
  path: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
  /** The parsed (defaults-applied) project when schema-valid. */
  project?: Project;
}

export function validateProject(input: unknown): ValidationResult {
  const parsed = ProjectSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
    };
  }
  const project = parsed.data;
  const issues: ValidationIssue[] = [];
  const assetIds = new Set(project.assets.map((a) => a.id));
  const sceneIds = new Set<string>();
  const knownExtensions = new Set(registryExtensionIds());

  if (project.extensions.enabled) {
    project.extensions.enabled.forEach((id, i) => {
      if (!knownExtensions.has(id)) {
        issues.push({
          path: `extensions.enabled.${i}`,
          message: `unknown extension "${id}"`,
        });
      }
    });
  }

  if (!PROFILES[project.motionProfile]) {
    issues.push({
      path: "motionProfile",
      message: `unknown profile "${project.motionProfile}" (known: ${Object.keys(PROFILES).join(", ")})`,
    });
  }

  project.scenes.forEach((scene, si) => {
    const base = `scenes.${si}(${scene.id})`;
    if (sceneIds.has(scene.id)) issues.push({ path: base, message: "duplicate scene id" });
    sceneIds.add(scene.id);

    const archetype = ARCHETYPES[scene.archetype];
    if (!archetype) {
      issues.push({
        path: `${base}.archetype`,
        message: `unknown archetype "${scene.archetype}" (known: ${Object.keys(ARCHETYPES).join(", ")})`,
      });
      return;
    }
    if (scene.layout && !archetype.layouts.includes(scene.layout)) {
      issues.push({
        path: `${base}.layout`,
        message: `archetype ${archetype.id} has layouts ${archetype.layouts.join("/")}, not "${scene.layout}"`,
      });
    }

    // Slots must match the archetype's slot schema.
    for (const [name, spec] of Object.entries(archetype.slots)) {
      const value = scene.slots[name];
      if (spec.required && value === undefined) {
        issues.push({ path: `${base}.slots.${name}`, message: "required slot missing" });
        continue;
      }
      if (value === undefined) continue;
      const kindOk =
        (spec.kind === "text" && typeof value === "string") ||
        (spec.kind === "textList" && Array.isArray(value)) ||
        (spec.kind === "number" && typeof value === "object" && "value" in value) ||
        (spec.kind === "media" && typeof value === "object" && "assetId" in value);
      if (!kindOk) {
        issues.push({ path: `${base}.slots.${name}`, message: `expected a ${spec.kind} value` });
        continue;
      }
      if (spec.kind === "textList" && Array.isArray(value) && spec.maxItems !== undefined) {
        if (value.length > spec.maxItems) {
          issues.push({
            path: `${base}.slots.${name}`,
            message: `at most ${spec.maxItems} items (got ${value.length})`,
          });
        }
      }
      if (spec.kind === "media" && typeof value === "object" && "assetId" in value) {
        if (!assetIds.has(value.assetId)) {
          issues.push({
            path: `${base}.slots.${name}`,
            message: `unknown asset "${value.assetId}"`,
          });
        }
      }
    }
    for (const name of Object.keys(scene.slots)) {
      if (!archetype.slots[name]) {
        issues.push({
          path: `${base}.slots.${name}`,
          message: `archetype ${archetype.id} has no slot "${name}"`,
        });
      }
    }

    // Overrides must reference real layers and role-correct primitives.
    const layerIds = new Set(
      archetype
        .materialize(scene, {
          W: project.meta.width,
          H: project.meta.height,
          brandName: project.brand.name,
        })
        .map((l) => l.id),
    );
    for (const [layerId, override] of Object.entries(scene.overrides)) {
      if (!layerIds.has(layerId)) {
        issues.push({
          path: `${base}.overrides.${layerId}`,
          message: `no layer "${layerId}" in this scene (have: ${[...layerIds].join(", ")})`,
        });
        continue;
      }
      for (const [field, expectedKind] of [
        ["enterPrimitive", "enter"],
        ["exitPrimitive", "exit"],
      ] as const) {
        const primitiveId = override[field];
        if (primitiveId === undefined) continue;
        const primitive = PRIMITIVES[primitiveId];
        if (!primitive) {
          issues.push({
            path: `${base}.overrides.${layerId}.${field}`,
            message: `unknown primitive "${primitiveId}"`,
          });
        } else if (primitive.kind !== expectedKind) {
          issues.push({
            path: `${base}.overrides.${layerId}.${field}`,
            message: `${primitiveId} is a ${primitive.kind} primitive, not ${expectedKind}`,
          });
        }
      }
    }
  });

  for (const afterSceneId of Object.keys(project.transitions)) {
    if (!sceneIds.has(afterSceneId)) {
      issues.push({
        path: `transitions.${afterSceneId}`,
        message: "transition references unknown scene",
      });
    }
  }

  return issues.length === 0 ? { ok: true, issues: [], project } : { ok: false, issues, project };
}
