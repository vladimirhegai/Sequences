/**
 * Sequences MCP server — exposes the command API and the two BYO-agent
 * planning tools (master plan Part V §7) over the Model Context Protocol so
 * an external agent (Claude Code, Codex, anything MCP-capable) can drive a
 * project with its own brain, billed to the subscription the user already
 * pays for.
 *
 * Transport: stdio, newline-delimited JSON-RPC 2.0 (the MCP stdio framing).
 * Hand-rolled on purpose — the protocol subset we need (initialize,
 * tools/list, tools/call, ping) is ~100 lines and keeps the no-build,
 * no-extra-deps rule.
 *
 * Quality enforcement is identical to every other mutation path: tools apply
 * COMMANDS through the ProjectStore (validated, journaled as source "agent",
 * undoable), and submitted plans go through PlanSchema + planToCommands.
 *
 * Wire-up (Claude Code):
 *   claude mcp add sequences -- node <repo>/apps/studio/src/cli.ts mcp <projectDir>
 */
import readline from "node:readline";
import {
  CommandSchema,
  lintProject,
  applyAutoFixes,
  parsePlan,
  planToCommands,
  planningContext,
  enabledExtensionIds,
  registryExtensionIds,
  ProjectStore,
  type Command,
  type Project,
} from "@sequences/core";
import { appendEvent, buildProject, loadProject, saveProject } from "./projectIo.ts";
import { renderProject } from "./render.ts";
import { loadStoryboard, storyboardToText } from "./workspace.ts";

const PROTOCOL_VERSION = "2025-06-18";

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: number | string | null;
  method: string;
  params?: Record<string, unknown>;
}

interface ToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler(args: Record<string, unknown>): Promise<string> | string;
}

function outline(project: Project): string {
  const scenes = project.scenes
    .map(
      (s, i) =>
        `${i + 1}. ${s.id} [${s.archetype}${s.layout ? `/${s.layout}` : ""}] ${s.durationFrames}f` +
        `${s.camera ? ` camera:${s.camera.move}` : ""} slots:${JSON.stringify(s.slots)}`,
    )
    .join("\n");
  return [
    `project: ${project.meta.title} (${project.meta.width}x${project.meta.height}@${project.meta.fps}fps)`,
    `brand: ${project.brand.name}; profile: ${project.motionProfile}`,
    `scenes:`,
    scenes,
  ].join("\n");
}

function lintText(project: Project): string {
  const findings = lintProject(project);
  if (findings.length === 0) return "lint: clean";
  return findings
    .map(
      (f) =>
        `${f.severity} [${f.rule}] ${[f.sceneId, f.layerId].filter(Boolean).join("/")}: ${f.message}${f.fix ? " (auto-fixable)" : ""}`,
    )
    .join("\n");
}

function assertExtensionEnabled(kind: string, id: string, enabled: Set<string>, known: Set<string>): void {
  if (!known.has(id)) return;
  if (!enabled.has(id)) throw new Error(`extension disabled: ${kind} "${id}"`);
}

function assertCommandUsesEnabled(command: Command, enabled: Set<string>, known: Set<string>): void {
  switch (command.type) {
    case "Batch":
      command.commands.forEach((sub) => assertCommandUsesEnabled(sub, enabled, known));
      return;
    case "AddScene":
      assertExtensionEnabled("archetype", command.scene.archetype, enabled, known);
      if (command.scene.camera && !enabled.has(command.scene.camera.move)) {
        assertExtensionEnabled("camera move", command.scene.camera.move, enabled, known);
      }
      return;
    case "SetMotionProfile":
      assertExtensionEnabled("profile", command.profile, enabled, known);
      return;
    case "SwapMotion":
      if (command.primitive) assertExtensionEnabled("primitive", command.primitive, enabled, known);
      return;
    case "SetLayerOverride":
      if (command.patch?.enterPrimitive && !enabled.has(command.patch.enterPrimitive)) {
        assertExtensionEnabled("primitive", command.patch.enterPrimitive, enabled, known);
      }
      if (command.patch?.exitPrimitive && !enabled.has(command.patch.exitPrimitive)) {
        assertExtensionEnabled("primitive", command.patch.exitPrimitive, enabled, known);
      }
      return;
    case "SetSceneCamera":
      if (command.camera && !enabled.has(command.camera.move)) {
        assertExtensionEnabled("camera move", command.camera.move, enabled, known);
      }
      return;
    default:
      return;
  }
}

export function startMcpServer(projectDir: string): void {
  const store = new ProjectStore(loadProject(projectDir), (entry) => appendEvent(projectDir, entry));
  const persist = () => {
    saveProject(projectDir, store.project);
    buildProject(projectDir, store.project);
  };

  const tools: ToolDef[] = [
    {
      name: "get_planning_context",
      description:
        "Returns everything needed to plan this video: the motion catalog (archetypes, primitives, profiles, camera moves, tokens), brand, assets, and the required plan JSON shape. Call this FIRST, then submit_plan.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      handler: () =>
        [
          planningContext(store.project, {
            storyboardText: storyboardToText(loadStoryboard(projectDir)).slice(0, 4000),
          }),
          "",
          "## Plan shape for submit_plan",
          '{ "motionProfile": "<id>", "scenes": [ { "archetype": "<id>", "layout"?, "durationFrames"?, "slots": {...}, "camera"? } ] }',
          "Rules: 3-6 scenes, use only enabled extension ids from the catalog, respect slot word budgets.",
        ].join("\n"),
    },
    {
      name: "submit_plan",
      description:
        "Validate a plan (beat sheet) and apply it atomically, replacing the current scenes. Returns the new outline plus lint findings. Invalid plans return structured errors you can self-correct from.",
      inputSchema: {
        type: "object",
        properties: { plan: { type: "object", description: "The plan JSON (see get_planning_context)" } },
        required: ["plan"],
      },
      handler: (args) => {
        const plan = parsePlan(args.plan, { project: store.project });
        const outcome = store.apply(planToCommands(store.project, plan), "agent");
        if (!outcome.ok) {
          throw new Error(
            `plan failed validation: ${outcome.errors.map((e) => `${e.path}: ${e.message}`).join("; ")}`,
          );
        }
        persist();
        return `plan applied.\n${outline(store.project)}\n${lintText(store.project)}`;
      },
    },
    {
      name: "get_project_outline",
      description: "Compact outline of the project: scenes, archetypes, durations, slots, profile.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      handler: () => outline(store.project),
    },
    {
      name: "get_scene",
      description: "Full JSON of one scene (slots, overrides, choreography, camera).",
      inputSchema: {
        type: "object",
        properties: { sceneId: { type: "string" } },
        required: ["sceneId"],
      },
      handler: (args) => {
        const scene = store.project.scenes.find((s) => s.id === args.sceneId);
        if (!scene) throw new Error(`unknown scene "${String(args.sceneId)}"`);
        return JSON.stringify(scene, null, 2);
      },
    },
    {
      name: "apply_commands",
      description:
        "Apply one or more typed commands (the same operations the studio UI emits): AddScene, RemoveScene, ReorderScene, SetSceneDuration, SetSceneLayout, SetSlotContent, SetTransition, SetMotionProfile, SetBrandColor, SetBrandFont, OverrideLayerBox, SwapMotion, SetLayerOverride, SetChoreography, SetSceneCamera, Batch. Multiple commands apply atomically as a Batch. All changes are journaled and undoable.",
      inputSchema: {
        type: "object",
        properties: {
          commands: { type: "array", items: { type: "object" }, minItems: 1, maxItems: 100 },
        },
        required: ["commands"],
      },
      handler: (args) => {
        const raw = args.commands as unknown[];
        const commands: Command[] = raw.map((c, i) => {
          const parsed = CommandSchema.safeParse(c);
          if (!parsed.success) {
            throw new Error(
              `commands[${i}] invalid: ${parsed.error.issues.map((iss) => `${iss.path.join(".")}: ${iss.message}`).join("; ")}`,
            );
          }
          return c as Command;
        });
        const command: Command = commands.length === 1 ? commands[0]! : { type: "Batch", commands };
        assertCommandUsesEnabled(command, enabledExtensionIds(store.project), new Set(registryExtensionIds()));
        const outcome = store.apply(command, "agent");
        if (!outcome.ok) {
          throw new Error(
            `rejected: ${outcome.errors.map((e) => `${e.path}: ${e.message}`).join("; ")}`,
          );
        }
        persist();
        return `applied.\n${outline(store.project)}\n${lintText(store.project)}`;
      },
    },
    {
      name: "lint_report",
      description: "Run the deterministic motion linter. Findings marked auto-fixable can be fixed with autofix.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      handler: () => lintText(store.project),
    },
    {
      name: "autofix",
      description: "Apply every available lint auto-fix (as journaled, undoable commands).",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      handler: () => {
        const result = applyAutoFixes(store);
        persist();
        return `applied ${result.applied.length} fixes.\n${lintText(store.project)}`;
      },
    },
    {
      name: "undo",
      description: "Undo the most recent change (including everything a submitted plan did).",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      handler: () => {
        const moved = store.undo("agent");
        if (moved) persist();
        return moved ? `undone.\n${outline(store.project)}` : "nothing to undo";
      },
    },
    {
      name: "redo",
      description: "Redo the most recently undone change.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      handler: () => {
        const moved = store.redo("agent");
        if (moved) persist();
        return moved ? `redone.\n${outline(store.project)}` : "nothing to redo";
      },
    },
    {
      name: "render",
      description:
        "Render the project to MP4 (draft quality by default). Slow (~0.5-2 min). Returns the output path.",
      inputSchema: {
        type: "object",
        properties: {
          quality: { type: "string", enum: ["draft", "standard", "high"] },
        },
      },
      handler: async (args) => {
        const quality =
          args.quality === "standard" || args.quality === "high" ? args.quality : "draft";
        const result = await renderProject(projectDir, store.project, { quality, quiet: true });
        return `rendered ${result.manifest.durationSec}s → ${result.outputPath}`;
      },
    },
  ];

  const write = (message: unknown) => {
    process.stdout.write(JSON.stringify(message) + "\n");
  };

  const handle = async (req: JsonRpcRequest) => {
    if (req.method === "initialize") {
      return {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: "sequences", version: "0.1.0" },
      };
    }
    if (req.method === "ping") return {};
    if (req.method === "tools/list") {
      return {
        tools: tools.map(({ name, description, inputSchema }) => ({
          name,
          description,
          inputSchema,
        })),
      };
    }
    if (req.method === "tools/call") {
      const name = req.params?.name as string;
      const args = (req.params?.arguments ?? {}) as Record<string, unknown>;
      const tool = tools.find((t) => t.name === name);
      if (!tool) throw Object.assign(new Error(`unknown tool: ${name}`), { code: -32602 });
      try {
        const text = await tool.handler(args);
        return { content: [{ type: "text", text }] };
      } catch (err) {
        return {
          content: [{ type: "text", text: err instanceof Error ? err.message : String(err) }],
          isError: true,
        };
      }
    }
    throw Object.assign(new Error(`method not found: ${req.method}`), { code: -32601 });
  };

  const rl = readline.createInterface({ input: process.stdin, terminal: false });
  rl.on("line", (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let req: JsonRpcRequest;
    try {
      req = JSON.parse(trimmed) as JsonRpcRequest;
    } catch {
      write({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "parse error" } });
      return;
    }
    if (req.id === undefined) return; // notification (e.g. notifications/initialized)
    void handle(req)
      .then((result) => write({ jsonrpc: "2.0", id: req.id, result }))
      .catch((err: Error & { code?: number }) =>
        write({
          jsonrpc: "2.0",
          id: req.id,
          error: { code: err.code ?? -32603, message: err.message },
        }),
      );
  });

  process.stderr.write(`sequences MCP server ready (project: ${projectDir})\n`);
}
