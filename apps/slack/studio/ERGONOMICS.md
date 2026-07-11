# Studio agent ergonomics — the library must stay easy to author

**Owner mandate (2026-07-10).** The Studio catalogs — Components, Assets,
Recipes, Looks, Camera patterns, Plugins — are the product's **library**: the
place where capable coding agents make proven, parameterized craft that the
cheaper runtime models (GLM planner, DeepSeek author) can consume without
taste of their own. Two requirements, both product requirements, not
nice-to-haves:

1. **Agent-authorable, always.** Every catalog must stay trivially editable by
   a coding agent — and specifically by a **clean-context subagent**: the
   owner asks the main agent for (say) "more recipes", the main agent spawns a
   subagent whose head isn't messied by the whole codebase, and that subagent
   must be able to succeed from a skill file + a narrow brief alone.
2. **Seamlessly integrated.** A new catalog entry must flow end-to-end with no
   extra wiring: planner vocabulary (retrieval/prompts) → storyboard schema →
   host injection → QA gates → Studio tab. If adding an entry requires
   touching N scattered seams by hand, the ergonomics are broken.

The recipes pipeline is the reference shape: one committed source file
(`recipes/<id>.recipe.html`), one authoring guide (`recipes/README.md`), one
CLI gate (`npm run recipes -- gate/export <id>`) that runs the EXACT
production machinery, thumbnails to eyeball, no hidden state. Every other
catalog should converge on that shape.

## Backlog (audit + build; possibly beyond Codex's MOTION_QUALITY_PLAN scope —
whoever picks this up, keep increments small)

- **E1. A skill/authoring file per Studio tab.** `recipes/README.md` exists;
  write the equivalent for components (add a kind: catalog entry + kit
  CSS/runtime beats + tests), assets (`defineAsset` file + springs + Asset Lab
  proof), looks/dialects, camera patterns, and plugins (params → lowering →
  budget rules). Each file must be sufficient for a clean-context subagent:
  exact files to touch, contracts to register (sentinel.ts!), gate commands to
  run, and what "proven" means for that catalog.
- **E2. Scaffolding commands.** `npm run recipes -- new <id>`-style generators
  for each catalog so a subagent starts from a valid skeleton instead of
  reverse-engineering a sibling.
- **E3. Integration audit.** For each catalog, prove the chain
  entry → retrieval/prompt vocabulary → schema → injection → QA → Studio tab
  with one test or checklist per catalog; file gaps as defects. (This is the
  "integrated seamlessly, and amazingly" bar: G1's recipe-consumption gap —
  planner declines offered recipes — is the known first defect.)
- **E4. Keep `studio/INTEGRATION.md`'s seam table authoritative** — any new
  seam a catalog entry must cross gets a row, so the audit stays mechanical.

Related: MOTION_QUALITY_PLAN.md WS-G (grow the proven library) grows CONTENT;
this charter keeps the AUTHORING PATH cheap. Both matter — the library is only
as good as how easily the next agent can extend it.
