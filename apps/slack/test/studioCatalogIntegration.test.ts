import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { retrieveHyperframesSkillContext } from "../src/agent/skillContext.ts";
import { ASSET_LIBRARY } from "../src/engine/assets/index.ts";
import { CAMERA_PATTERNS } from "../src/engine/cameraPatterns.ts";
import { COMPONENT_CATALOG } from "../src/engine/componentContract.ts";
import { DESIGN_DIALECTS } from "../src/engine/designDialects.ts";
import { PLUGIN_CATALOG } from "../src/engine/pluginContract.ts";
import { studioLibraryVocabulary } from "../src/engine/studioLibrary.ts";

describe("Studio catalog end-to-end discovery", () => {
  it("generates OpenRouter inventory from every production catalog", () => {
    const vocabulary = studioLibraryVocabulary();
    for (const entry of COMPONENT_CATALOG.filter((item) => !item.internal)) {
      expect(vocabulary, `component ${entry.kind}`).toContain(entry.kind);
    }
    for (const entry of ASSET_LIBRARY) expect(vocabulary, `asset ${entry.id}`).toContain(entry.id);
    for (const entry of DESIGN_DIALECTS) expect(vocabulary, `look ${entry.id}`).toContain(entry.id);
    for (const entry of CAMERA_PATTERNS) expect(vocabulary, `camera ${entry.id}`).toContain(entry.id);
    for (const entry of PLUGIN_CATALOG.filter((item) => !item.kind.startsWith("asset-"))) {
      expect(vocabulary, `plugin ${entry.kind}`).toContain(entry.kind);
    }
  });

  it("places the inventory in the shared skill context used by planner and author", () => {
    const context = retrieveHyperframesSkillContext("create", "A fast SaaS launch commercial");
    expect(context.text).toContain("## Sequences Studio library");
    expect(context.text).toContain("dashboard-grid");
    expect(context.text).toContain("push-and-hold");
  });

  it("keeps Studio UI state derived from the same catalogs", () => {
    const server = fs.readFileSync(path.resolve("studio/server.ts"), "utf8");
    for (const symbol of [
      "COMPONENT_CATALOG",
      "ASSET_LIBRARY",
      "DESIGN_DIALECTS",
      "CAMERA_PATTERNS",
      "PLUGIN_CATALOG",
    ]) {
      expect(server, symbol).toContain(symbol);
    }
  });
});
