---
name: sequences
description: Plan, edit, lint, preview, and render a Sequences motion-graphics project through its MCP tools.
---

# Sequences

Use this workflow when a project exposes the Sequences MCP server.

1. Call `get_planning_context` before planning. Treat its enabled registry ids, slot budgets, assets, and schema as hard constraints.
2. Build a compact 3–6 beat plan and call `submit_plan`. If validation fails,
   repair exactly the reported fields and resubmit.
3. Call `lint_report`; use `autofix` for deterministic fixes, then resolve any remaining copy or intent warnings.
4. Call `render_preview` and inspect the returned scene previews before requesting a full render.
5. Apply edits through `apply_commands`; never edit `project.json` or generated HTML directly.
6. Use `undo` when an edit moves away from the brief. Use `render` only after previews and lint are acceptable.

Keep one loud motion per scene, prefer product media to abstract claims, and
keep copy within the catalog's slot budgets. Do not invent commands, token
fields, primitives, or registry ids that are absent from planning context.
