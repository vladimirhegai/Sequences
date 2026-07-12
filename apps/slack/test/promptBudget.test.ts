import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  adaptDirectorPromptForSlots,
  creationPrompt,
} from "../src/engine/compositionRunner.ts";
import {
  AUTHOR_PROMPT_BUDGET_CHARS,
  assertAuthorPromptBudget,
  compactLockedDirectorPrompt,
  compactRepairSource,
} from "../src/engine/runner/prompts.ts";
import { buildFallbackComposition } from "../src/engine/fallbackComposition.ts";
import { retrieveHyperframesSkillContext } from "../src/agent/skillContext.ts";

const APP_DIR = path.resolve(fileURLToPath(import.meta.url), "../..");

/**
 * SENTINEL.md budget contract. Two ceilings, one purpose: growing the
 * prompt must require consciously raising a tested number a reviewer sees.
 *
 * 1. `planning-director.md` — the editable base prompt — stays within its
 *    post-Phase-1 byte count + 10%. This one is ENFORCED and passing.
 * 2. The ASSEMBLED slot-author prompt for a fixture job stays at ≤45,000 chars.
 *    Slot mode removes host-owned director chapters and uses a compact,
 *    deterministic skills projection while preserving creative/motion guidance.
 */
const PLANNING_DIRECTOR_BASELINE_BYTES = 37_010; // post-Phase-1 (SENTINEL_REPORT)
const PLANNING_DIRECTOR_BUDGET_BYTES = Math.round(PLANNING_DIRECTOR_BASELINE_BYTES * 1.1); // 40,711
const AUTHOR_PROMPT_TARGET_CHARS = AUTHOR_PROMPT_BUDGET_CHARS;
const AUTHOR_PROMPT_REGRESSION_CEILING = AUTHOR_PROMPT_TARGET_CHARS;

function assembledFixturePrompt(): { prompt: string; directorChars: number; skillsChars: number } {
  const brief = [
    "Product: Cursorflow — a command-palette-first deploy console.",
    "What shipped: a command palette runs a deploy, streams build logs in a terminal,",
    "confirms in a modal, updates a stat-card with p95 latency, and a button ships it.",
    "Audience: platform engineers. Tone: crisp-saas. Length: 24s.",
  ].join("\n");
  const draft = buildFallbackComposition({
    product: "Cursorflow",
    whatShipped: "command palette runs a deploy; terminal stream; modal confirm; stat-card; button",
    audience: "platform engineers",
    lengthSec: 24,
  });
  const skills = retrieveHyperframesSkillContext("create", brief);
  const director = fs.readFileSync(path.join(APP_DIR, "prompts", "planning-director.md"), "utf8");
  // An empty project dir keeps `availableAssets` deterministic (no local assets).
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), "sentinel-promptbudget-"));
  try {
    const prompt = creationPrompt({
      brief,
      projectDir,
      skills,
      frameMd: "# Frame token reference line for measurement.\n".repeat(80),
      lockedStoryboard: draft.storyboard,
      slots: true, // the Phase-5 default authoring shape
    });
    return { prompt, directorChars: director.length, skillsChars: skills.text.length };
  } finally {
    fs.rmSync(projectDir, { recursive: true, force: true });
  }
}

describe("Prompt budget — planning-director.md", () => {
  it("stays within the post-Phase-1 byte budget + 10%", () => {
    const bytes = fs.statSync(path.join(APP_DIR, "prompts", "planning-director.md")).size;
    expect(
      bytes,
      `planning-director.md is ${bytes} bytes, over the ${PLANNING_DIRECTOR_BUDGET_BYTES} ` +
        `budget. Deleting a rule made redundant at L0–L2 is fine; ADDING prose means ` +
        `raising this budget in a diff a reviewer sees (SENTINEL.md).`,
    ).toBeLessThanOrEqual(PLANNING_DIRECTOR_BUDGET_BYTES);
  });
});

describe("Slot-mode director-prompt surgery — no contradictory whole-doc contract", () => {
  it("every rewrite anchor still matches planning-director.md (zero misses)", () => {
    const director = fs.readFileSync(path.join(APP_DIR, "prompts", "planning-director.md"), "utf8");
    const misses: string[] = [];
    adaptDirectorPromptForSlots(director, misses);
    expect(
      misses,
      "A planning-director.md edit broke a SLOT_MODE_DIRECTOR_REWRITES anchor — " +
        "update the anchor with the edit so slot mode keeps its surgical rewrite " +
        "(the appended-override fallback is weaker).",
    ).toEqual([]);
  });

  it("the assembled slot prompt carries no whole-document instructions", () => {
    const { prompt } = assembledFixturePrompt();
    // The p7-denseui no-slots attempt + documented slot-envelope drift trace to
    // the base prompt instructing exactly these; slot mode must never see them.
    expect(prompt).not.toContain("Return a complete HTML document");
    expect(prompt).not.toContain("requests only `<index_html>`");
    expect(prompt).not.toContain("initialized synchronously and registered as");
    expect(prompt).not.toContain("The paused timeline must own scene-window opacity");
    expect(prompt).not.toContain("Mark each storyboard scene with");
    // And it does carry the slot response contract.
    expect(prompt).toContain("Response contract (scene slots)");
    // Host-owned reference chapters are removed, while creative/motion craft remains.
    expect(prompt).not.toContain("## Architecture laws");
    expect(prompt).not.toContain("## Hard runtime contract");
    expect(prompt).toContain("## Motion doctrine");
    expect(prompt).toContain("## Continuous spatial world");
    expect(prompt).toContain("## Motion-native components");
  });
});

describe("Prompt budget — assembled author prompt", () => {
  it("assembled slot author prompt for a fixture job is ≤ 45,000 chars", () => {
    const { prompt } = assembledFixturePrompt();
    expect(prompt.length).toBeLessThanOrEqual(AUTHOR_PROMPT_TARGET_CHARS);
  });

  it("holds the assembled prompt at its measured regression ceiling", () => {
    const { prompt } = assembledFixturePrompt();
    // eslint-disable-next-line no-console
    console.log(`[promptBudget] assembled fixture author prompt: ${prompt.length} chars`);
    expect(
      prompt.length,
      `Assembled author prompt grew to ${prompt.length} chars (ceiling ` +
      `${AUTHOR_PROMPT_REGRESSION_CEILING}). If growth is intentional, update the ` +
        `mission target and its rationale in Sentinel docs; otherwise cut it.`,
    ).toBeLessThanOrEqual(AUTHOR_PROMPT_REGRESSION_CEILING);
  });

  it("keeps full, multi-scene, and large repair payloads under the same ceiling", () => {
    const brief = "Product: Cursorflow. What shipped: deploy console, terminal stream, modal confirm, stat-card, and button. Audience: platform engineers. Length: 24s.";
    const draft = buildFallbackComposition({
      product: "Cursorflow",
      whatShipped: "deploy console; terminal stream; modal confirm; stat-card; button",
      audience: "platform engineers",
      lengthSec: 24,
    });
    const skills = retrieveHyperframesSkillContext("create", brief);
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), "sentinel-promptdiagnostic-"));
    try {
      const full = creationPrompt({
        brief,
        projectDir,
        skills,
        frameMd: "# Frame\n".repeat(80),
        lockedStoryboard: draft.storyboard,
        compact: true,
      });
      const multiSceneStoryboard = Array.from({ length: 10 }, (_, index) => ({
        ...draft.storyboard[index % draft.storyboard.length]!,
        id: `scene-${index + 1}`,
        startSec: index * 2.4,
      }));
      const multiScene = creationPrompt({
        brief,
        projectDir,
        skills,
        frameMd: "# Frame\n".repeat(80),
        lockedStoryboard: multiSceneStoryboard,
        slots: true,
      });
      const repair = creationPrompt({
        brief,
        projectDir,
        skills,
        lockedStoryboard: draft.storyboard,
        scratch: {
          storyboard: draft.storyboard,
          html: `${"x".repeat(80_000)}<div data-part="repair-target">${"y".repeat(40_000)}</div>`,
        },
        validationFeedback: ['dead_gsap_target: data-part="repair-target"'],
        compact: true,
        structuredPatches: true,
      });
      expect(full.length).toBeLessThanOrEqual(AUTHOR_PROMPT_TARGET_CHARS);
      expect(multiScene.length).toBeLessThanOrEqual(AUTHOR_PROMPT_TARGET_CHARS);
      expect(repair.length).toBeLessThanOrEqual(AUTHOR_PROMPT_TARGET_CHARS);
      assertAuthorPromptBudget(full, "author source");
      assertAuthorPromptBudget(multiScene, "author source");
      assertAuthorPromptBudget(repair, "author patch");
    } finally {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  });

  it("keeps repair excerpts exact and includes the reported late source", () => {
    const source = `${"x".repeat(70_000)}<div data-part="repair-target">${"y".repeat(40_000)}</div>`;
    const compact = compactRepairSource(source, ['data-part="repair-target"']);
    expect(compact.length).toBeLessThanOrEqual(30_000);
    expect(compact).toContain('<div data-part="repair-target">');
    expect(compact).toContain("omitted exact source context");
  });

  it("compacts the locked whole-document director without dropping creative guidance", () => {
    const director = fs.readFileSync(path.join(APP_DIR, "prompts", "planning-director.md"), "utf8");
    const compact = compactLockedDirectorPrompt(director);
    expect(compact.length).toBeLessThan(director.length / 2);
    expect(compact).not.toContain("## Architecture laws");
    expect(compact).not.toContain("## Hard runtime contract");
    expect(compact).toContain("## Motion doctrine");
    expect(compact).toContain("Full-document response contract");
  });

  it("rejects an oversized author request before a provider call", () => {
    expect(() => assertAuthorPromptBudget("x".repeat(AUTHOR_PROMPT_TARGET_CHARS + 1), "author patch"))
      .toThrow(/hard author prompt budget/);
    expect(() => assertAuthorPromptBudget("x".repeat(AUTHOR_PROMPT_TARGET_CHARS + 1), "storyboard"))
      .not.toThrow();
  });
});
