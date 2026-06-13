/**
 * The registry — the single source of truth from code to prompt (plan §4.5).
 * `promptCatalog()` auto-generates the one-line summaries the agent planner
 * will see in Phase 1; it exists now so catalog text and implementations can
 * never drift apart.
 */
import { PRIMITIVES } from "./primitives.ts";
import { ARCHETYPES } from "./archetypes.ts";
import { PROFILES } from "./profiles.ts";
import { CAMERA_MOVES } from "./camera.ts";
import type { Project } from "../schema.ts";
import {
  DURATION_TOKENS,
  EASING_TOKEN_IDS,
  DISTANCE_TOKENS,
  STAGGER_TOKENS,
  SCALE_TOKENS,
} from "../tokens.ts";

export { PRIMITIVES } from "./primitives.ts";
export { ARCHETYPES } from "./archetypes.ts";
export { PROFILES } from "./profiles.ts";
export { CAMERA_MOVES, CAMERA_MOVE_IDS, type CameraMoveDef } from "./camera.ts";
export * from "./types.ts";

export type ExtensionKind = "primitive" | "archetype" | "profile" | "camera";

export interface RegistryExtension {
  id: string;
  type: ExtensionKind;
}

export interface PromptCatalogOptions {
  enabledIds?: Iterable<string> | null;
}

export function registryExtensions(): RegistryExtension[] {
  return [
    ...Object.values(PRIMITIVES).map((p) => ({ id: p.id, type: "primitive" as const })),
    ...Object.values(ARCHETYPES).map((a) => ({ id: a.id, type: "archetype" as const })),
    ...Object.values(PROFILES).map((p) => ({ id: p.id, type: "profile" as const })),
    ...Object.values(CAMERA_MOVES).map((m) => ({ id: m.id, type: "camera" as const })),
  ];
}

export function registryExtensionIds(): string[] {
  return registryExtensions().map((entry) => entry.id);
}

export function enabledExtensionIds(project: Pick<Project, "extensions">): Set<string> {
  const all = registryExtensionIds();
  const configured = project.extensions?.enabled;
  if (configured === null || configured === undefined) return new Set(all);
  const known = new Set(all);
  return new Set(configured.filter((id) => known.has(id)));
}

function isCatalogEnabled(enabled: Set<string> | null, id: string): boolean {
  return enabled === null || enabled.has(id);
}

function enabledSetFrom(options: PromptCatalogOptions): Set<string> | null {
  return options.enabledIds === undefined || options.enabledIds === null
    ? null
    : new Set(options.enabledIds);
}

function pushEmptyIfNone(lines: string[], count: number): void {
  if (count === 0) lines.push("- (none enabled)");
}

export function promptCatalog(options: PromptCatalogOptions = {}): string {
  const enabled = enabledSetFrom(options);
  const lines: string[] = [];
  lines.push("## Motion primitives");
  let count = 0;
  for (const p of Object.values(PRIMITIVES).filter((p) => isCatalogEnabled(enabled, p.id))) {
    lines.push(`- ${p.id} [${p.kind}, ${p.tags.energy}/${p.tags.style}]: ${p.summary}`);
    count++;
  }
  pushEmptyIfNone(lines, count);
  lines.push("", "## Scene archetypes");
  count = 0;
  for (const a of Object.values(ARCHETYPES).filter((a) => isCatalogEnabled(enabled, a.id))) {
    const slots = Object.entries(a.slots)
      .map(([name, s]) => `${name}${s.required ? "*" : ""}:${s.kind}`)
      .join(", ");
    lines.push(
      `- ${a.id} (slots: ${slots}; layouts: ${a.layouts.join("/")}; ${a.duration.min}-${a.duration.max}f): ${a.summary}`,
    );
    count++;
  }
  pushEmptyIfNone(lines, count);
  lines.push("", "## Motion profiles");
  count = 0;
  for (const p of Object.values(PROFILES).filter((p) => isCatalogEnabled(enabled, p.id))) {
    lines.push(`- ${p.id}: ${p.summary}`);
    count++;
  }
  pushEmptyIfNone(lines, count);
  lines.push("", "## Camera moves (scene-level, optional)");
  count = 0;
  for (const move of Object.values(CAMERA_MOVES).filter((move) => isCatalogEnabled(enabled, move.id))) {
    lines.push(`- ${move.id}: ${move.summary}`);
    count++;
  }
  pushEmptyIfNone(lines, count);
  lines.push(
    "",
    "## Tokens",
    `- durations (frames@30): ${Object.entries(DURATION_TOKENS)
      .map(([k, v]) => `${k}=${v}`)
      .join(", ")}`,
    `- easings (role-typed, cross-role use is invalid): ${EASING_TOKEN_IDS.join(", ")}`,
    `- distances (frac of height): ${Object.entries(DISTANCE_TOKENS)
      .map(([k, v]) => `${k}=${v}`)
      .join(", ")}`,
    `- staggers (frames): ${Object.entries(STAGGER_TOKENS)
      .map(([k, v]) => `${k}=${v}`)
      .join(", ")}`,
    `- scales: ${Object.entries(SCALE_TOKENS)
      .map(([k, v]) => `${k}=${v}`)
      .join(", ")}`,
  );
  return lines.join("\n");
}
