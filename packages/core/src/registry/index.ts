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

export function promptCatalog(): string {
  const lines: string[] = [];
  lines.push("## Motion primitives");
  for (const p of Object.values(PRIMITIVES)) {
    lines.push(`- ${p.id} [${p.kind}, ${p.tags.energy}/${p.tags.style}]: ${p.summary}`);
  }
  lines.push("", "## Scene archetypes");
  for (const a of Object.values(ARCHETYPES)) {
    const slots = Object.entries(a.slots)
      .map(([name, s]) => `${name}${s.required ? "*" : ""}:${s.kind}`)
      .join(", ");
    lines.push(
      `- ${a.id} (slots: ${slots}; layouts: ${a.layouts.join("/")}; ${a.duration.min}-${a.duration.max}f): ${a.summary}`,
    );
  }
  lines.push("", "## Motion profiles");
  for (const p of Object.values(PROFILES)) {
    lines.push(`- ${p.id}: ${p.summary}`);
  }
  lines.push("", "## Camera moves (scene-level, optional)");
  for (const move of Object.values(CAMERA_MOVES)) {
    lines.push(`- ${move.id}: ${move.summary}`);
  }
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
