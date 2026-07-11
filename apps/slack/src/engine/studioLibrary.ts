/**
 * Compact, generated inventory of the operator-curated Studio library.
 *
 * Both OpenRouter planning and source-authoring calls receive skillContext.text,
 * so this capsule gives both agents discovery without duplicating a catalog or
 * growing the editable system prompts. Detailed declaration grammar remains in
 * the typed planner vocabulary and locked storyboard.
 */
import { COMPONENT_CATALOG } from "./componentContract.ts";
import { ASSET_LIBRARY } from "./assets/index.ts";
import { DESIGN_DIALECTS } from "./designDialects.ts";
import { CAMERA_PATTERNS } from "./cameraPatterns.ts";
import { PLUGIN_CATALOG } from "./pluginContract.ts";

function line(label: string, entries: string[]): string {
  return `- ${label}: ${entries.join(" · ")}`;
}

export function studioLibraryVocabulary(): string {
  return [
    "## Sequences Studio library (host-curated; prefer over model-made substitutes)",
    "These catalogs are real production capabilities, not inspiration. The planner declares typed entries; the source author leaves host-owned units alone and builds only their surrounding scene.",
    line("components", COMPONENT_CATALOG.filter((entry) => !entry.internal).map((entry) => entry.kind)),
    line("assets", ASSET_LIBRARY.map((entry) => entry.id)),
    line("looks", DESIGN_DIALECTS.map((entry) => entry.id)),
    line("camera patterns", CAMERA_PATTERNS.map((entry) => entry.id)),
    line("plugins", PLUGIN_CATALOG.filter((entry) => !entry.kind.startsWith("asset-")).map((entry) => entry.kind)),
    "Proven recipes are selected separately below from the exported recipe library. Reuse a matching catalog entry; do not redraw its mechanism or invent a near-duplicate.",
  ].join("\n");
}
