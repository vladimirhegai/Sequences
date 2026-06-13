/**
 * The plan layer (T4) — the contract between any planning brain (Anthropic
 * API, OpenAI API, a local Codex/Claude Code CLI session, or a human typing
 * JSON) and the deterministic core.
 *
 * A Plan is a beat sheet: profile + ordered scenes with archetype/slots. It
 * deliberately contains NO motion decisions — deterministic fill (the profile
 * selection table + solver) makes those. Quality enforcement is identical no
 * matter which brain plans, because the schema + validator + fill do the work.
 *
 * `planToCommands` converts a validated plan into one atomic Batch through
 * the ONE mutation pathway, so an agent plan is logged, undoable, and
 * revertible exactly like a UI edit.
 */
import { z } from "zod";
import { CameraSchema, SlotValueSchema, type Project } from "./schema.ts";
import { ARCHETYPES, PROFILES, promptCatalog } from "./registry/index.ts";
import type { Command } from "./commands.ts";

export interface PlanningContextOptions {
  /** Optional deterministic storyboard serialization supplied by the host app/MCP server. */
  storyboardText?: string;
}

/**
 * Versioned Phase-1 system instruction for every planning brain. Keep this
 * close to PlanSchema: the model should choose from Sequences' lattice, not
 * invent motion syntax the current compiler cannot express.
 */
export const SEQUENCES_AGENT_SYSTEM_PROMPT = [
  "## Sequences agent system prompt (Phase 1)",
  "",
  "You are the Sequences SaaS product motion planner.",
  "Your job is to translate human intent into a compact JSON beat sheet that Sequences can compile.",
  "Sequences handles motion quality deterministically through motion profiles, archetypes, tokens, primitives, a choreography solver, and a linter.",
  "",
  "### Hard contract",
  "- Output only the requested JSON plan. Do not output prose, markdown, HTML, CSS, GSAP, JavaScript, keyframes, timeline code, or raw cubic-bezier values.",
  "- Select catalog ids exactly as listed: motionProfile, archetype, layout, assetId, and optional camera.move.",
  "- Fill archetype slots with concise content. Respect required slots, slot value types, max word budgets, and listed asset ids.",
  "- Do not invent off-lattice motion values, manual easing formulas, layer coordinates, 3D parallax, cursor/ripple systems, dynamic blur, match cuts, or custom micro-interactions.",
  "- If the brief asks for unsupported motion, approximate it with the nearest Phase-1 controls: profile choice, archetype order, layout choice, short copy, scene duration, and optional scene camera.",
  "",
  "### Phase-1 motion controls you may use",
  "- motionProfile chooses the overall feel: crisp-saas for Linear/Vercel-style precision, warm-startup for softer product stories, bold-launch for punchy launch films.",
  "- archetype and layout choose the scene structure. Prefer feature-reveal or ui-walkthrough when the user wants to show the product.",
  "- durationFrames may tune pacing inside each archetype's range; omit it when the ideal duration is fine.",
  "- camera is optional and scene-level only: use pushIn or pullBack with scale subtle on at most two important scenes, never as constant decoration.",
  "- The solver already enforces rank order, deterministic staggers, about 65% entrance overlap, settle gaps, and the one-loud-motion rule. Do not try to schedule these yourself.",
  "",
  "### SaaS motion design judgment",
  "- Build a 3-6 beat arc: hook, product proof, workflow or metric, trust if useful, CTA.",
  "- Keep one idea per scene. Give the rank-1 idea the loudest treatment by choosing the right archetype/profile; let support copy stay quiet.",
  "- Prefer real product media over abstract claims when assets exist. Use listed asset ids directly in media slots.",
  "- Write short, scannable copy. Product videos read at a glance; avoid paragraphs and generic filler.",
  "- Use bold-launch sparingly for release-day energy, crisp-saas for most developer/B2B demos, and warm-startup when the brand should feel human or calm.",
  "- Open with hook-opener and close with logo-sting-cta unless the user explicitly asks for a different structure.",
  "",
  "### Storyboard contract",
  "- If storyboard text is provided, treat frames as sequential beats and comments/motion paths as the highest-priority intent.",
  "- Treat sketch geometry as composition guidance, not pixel truth. Map it to the closest catalog archetype, layout, asset, and slot content.",
  "- Do not copy raw storyboard coordinates into the plan.",
].join("\n");

export const PlanSceneSchema = z.object({
  /** Optional stable id; generated from the archetype when omitted. */
  id: z
    .string()
    .regex(/^[a-zA-Z][a-zA-Z0-9_-]*$/)
    .max(64)
    .optional(),
  archetype: z.string(),
  layout: z.string().optional(),
  /** Defaults to the archetype's ideal duration. */
  durationFrames: z.number().int().min(15).max(1800).optional(),
  slots: z.record(z.string(), SlotValueSchema).default({}),
  camera: CameraSchema.optional(),
});
export type PlanScene = z.infer<typeof PlanSceneSchema>;

export const PlanSchema = z.object({
  motionProfile: z.string(),
  scenes: z.array(PlanSceneSchema).min(1).max(12),
});
export type Plan = z.infer<typeof PlanSchema>;

export class PlanError extends Error {}

/**
 * Parse + referentially pre-check a plan (clear errors an external agent can
 * self-correct from; the store's validator is the final gate either way).
 */
export function parsePlan(input: unknown): Plan {
  const parsed = PlanSchema.safeParse(input);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new PlanError(`plan does not match the plan schema — ${issues}`);
  }
  const plan = parsed.data;
  if (!PROFILES[plan.motionProfile]) {
    throw new PlanError(
      `unknown motionProfile "${plan.motionProfile}" (valid: ${Object.keys(PROFILES).join(", ")})`,
    );
  }
  for (const [i, scene] of plan.scenes.entries()) {
    const archetype = ARCHETYPES[scene.archetype];
    if (!archetype) {
      throw new PlanError(
        `scenes[${i}]: unknown archetype "${scene.archetype}" (valid: ${Object.keys(ARCHETYPES).join(", ")})`,
      );
    }
    if (scene.layout && !archetype.layouts.includes(scene.layout)) {
      throw new PlanError(
        `scenes[${i}]: archetype ${archetype.id} has layouts ${archetype.layouts.join("/")}, not "${scene.layout}"`,
      );
    }
  }
  return plan;
}

/**
 * One atomic Batch that replaces the project's scenes with the plan's beats.
 * Brand, assets, and meta are untouched — planning restyles the story, not
 * the identity. Apply through a ProjectStore so validation gates it.
 */
export function planToCommands(project: Project, plan: Plan): Command {
  const used = new Set<string>();
  const sceneIds = plan.scenes.map((scene) => {
    const base = scene.id ?? scene.archetype.split("-")[0] ?? "scene";
    let id = base;
    let n = 1;
    while (used.has(id)) id = `${base}${++n}`;
    used.add(id);
    return id;
  });

  const commands: Command[] = [{ type: "SetMotionProfile", profile: plan.motionProfile }];
  for (const scene of project.scenes) {
    commands.push({ type: "RemoveScene", sceneId: scene.id });
  }
  plan.scenes.forEach((scene, i) => {
    const archetype = ARCHETYPES[scene.archetype]!;
    commands.push({
      type: "AddScene",
      scene: {
        id: sceneIds[i]!,
        archetype: scene.archetype,
        ...(scene.layout ? { layout: scene.layout } : {}),
        durationFrames: scene.durationFrames ?? archetype.duration.ideal,
        slots: scene.slots,
        choreography: {},
        overrides: {},
        ...(scene.camera ? { camera: scene.camera } : {}),
      },
    });
  });
  return { type: "Batch", commands };
}

/** The context a planning brain needs — same content for every provider. */
export function planningContext(project: Project, options: PlanningContextOptions = {}): string {
  const assets =
    project.assets.length === 0
      ? "(none — archetypes needing media are unavailable)"
      : project.assets.map((a) => `- ${a.id} (${a.kind}): ${a.path}`).join("\n");
  const storyboardText = options.storyboardText?.trim();
  const lines = [
    "# Sequences planning context",
    "",
    SEQUENCES_AGENT_SYSTEM_PROMPT,
    "",
    promptCatalog(),
    "",
    "## Project",
    `- title: ${project.meta.title}`,
    `- brand: ${project.brand.name}`,
    `- canvas: ${project.meta.width}x${project.meta.height} @ ${project.meta.fps}fps`,
    "## Available assets (the ONLY valid assetId values)",
    assets,
  ];
  if (storyboardText) {
    lines.push("", "## Storyboard context", storyboardText);
  }
  return lines.join("\n");
}

/** The full prompt for a one-shot plan call against any text-completion brain. */
export function buildPlanPrompt(brief: string, project: Project): string {
  return [
    planningContext(project),
    "",
    "## Brief",
    brief.trim(),
    "",
    "## Output format",
    "Respond with ONE JSON object and nothing else (no prose, no markdown fences):",
    "{",
    '  "motionProfile": "<profile id>",',
    '  "scenes": [',
    '    { "archetype": "<archetype id>", "layout": "<optional layout id>",',
    '      "durationFrames": <optional int, omit to use the archetype ideal>,',
    '      "slots": { "<slot name>": <string | string[] | {"value":N,"prefix":"","suffix":""} | {"assetId":"<id>"}> },',
    '      "camera": { "move": "pushIn"|"pullBack", "scale": "subtle" } (optional, max 2 scenes) }',
    "  ]",
    "}",
    "Rules: 3-6 scenes; open with hook-opener and close with logo-sting-cta;",
    "respect every slot's word budget; required slots must be filled;",
    "media slots may only reference the asset ids listed above.",
  ].join("\n");
}

/** Extract the first balanced top-level JSON object from model/CLI output. */
export function extractJsonObject(text: string): unknown {
  const start = text.indexOf("{");
  if (start === -1) throw new PlanError("no JSON object found in the response");
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i]!;
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        const candidate = text.slice(start, i + 1);
        try {
          return JSON.parse(candidate);
        } catch (err) {
          throw new PlanError(`response contained malformed JSON: ${String(err)}`);
        }
      }
    }
  }
  throw new PlanError("no complete JSON object found in the response");
}
