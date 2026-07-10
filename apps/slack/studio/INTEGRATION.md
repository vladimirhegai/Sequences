# Recipe Studio ↔ engine — the coupling map

The studio (`apps/slack/studio/`) and the recipe pipeline
(`src/engine/recipeContract.ts` + `skills/sequences-recipes/`) are a **cockpit
over the engine, never a second engine**. Every seam below is a place where an
engine change can silently break the studio or the shipped recipe library.
**Rule: touching a seam in the left column requires updating the right column
— or recording a TODO here in this file.**

## The recipe pipeline at a glance

```
operator/agent edits fragment.html in a studio workspace
  → gateWorkspace(): stage into SLACK_SEQUENCES_RECIPES_DIR, scaffold demo,
    applyDeterministicSourceRepairs (REAL injection), validate + browser QA
  → export: skills/sequences-recipes/<id>/ (recipe.json + recipe.md +
    fragment.html + demo.html + preview/) with engine version fences + hash
  → live create: skillContext retrieval offers ≤2 matching recipes (Level 0)
  → GLM storyboard declares recipes:[{id,params}] per scene (schema field)
  → parseStoryboard normalizes + reconcileRecipeDeclarations (Sentinel L2:
    drop/default/clamp, degrade-never-veto)
  → applyDeterministicSourceRepairs strips + re-injects the fragment VERBATIM
    every pass (mechanism unreachable to the author model)
  → validateDirectComposition runs validateRecipeContract (self-check) and
    every existing gate over the instantiated result
```

## Seam table

| engine seam | recipe/studio consumer | when you change it |
|---|---|---|
| `*_RUNTIME_VERSION` / `*_KIT_VERSION` constants (cut/camera/component/interaction/time/fx/cinema) | `recipeContract.currentEngineFences()`; every exported `recipe.json` `engine.kitVersions` | bumping ANY version makes every exported recipe **stale** (skipped at retrieval + instantiation, "re-prove" badge in the studio). Re-prove: `npm run studio:golden` per recipe (or gate+export in the UI). |
| runtime template **content** at the same island version (`templates/sequences-*.v1.js`/`.css`) | exported recipe fragments replay against the CURRENT runtimes | a behavior-changing edit that keeps the island contract (e.g. 2026-07-08 probe-audit: `compileSwap` settle sets + no-op-swap early return, `bindGradeShift` full-frame fade + cross-cut carry, the `compileType`/`compileSplitType` slot-identity pin, `compileSelect`/`activateExclusiveItem` sibling-active clearing, the `dive` leg eases, the shape-match structure-mismatch audit) does NOT fence-stale recipes — re-run `npm run studio:golden` to re-prove the golden recipe against the new behavior; a CONTRACT change (island shape) must bump the VERSION instead. |
| storyboard schema (`storyboardResponseFormat`, `parseStoryboard`, cache `contract:` in `compositionRunner.ts`) | the `recipes` scene field; `recipesVersion`/`recipeIds` in the storyboard cache key | keep the `recipes` property + required entry in the JSON schema; bump `contract:` on shape changes; parse must keep calling `normalizeStoryboardRecipeDeclarations` + `reconcileRecipeDeclarations`. |
| `applyDeterministicSourceRepairs` injection order (islands → … → fx → assets → **recipes** → kits → time-wrap LAST) | `injectRecipeContract` call site | recipe injection must stay BEFORE the time-wrap rewrite and be strip-and-reinject idempotent. `test/recipeContract.test.ts` proves tamper-reversion. |
| `validateDirectComposition` | `validateRecipeContract` (recipe_unknown / recipe_island_missing / recipe_motion_missing / recipe_slot_unfilled) | these are host-plumbing self-checks (fx disposition); keep them in the error aggregation. |
| `skillContext.ts` retrieval | `selectedLibraryRecipes` (cap `MAX_RECIPES_PER_FILM`), the "Proven recipes" declare-by-default section, `recipeIds`/`recipesVersion` on `RetrievedSkillContext` | recipes lead the selected section by design (operator priority). Budget changes → update `recipePlanningVocabulary` text. |
| `sentinel.ts` registry | rows `normalize.recipe-reconcile` + `recipes.contract`; `recipeContract.ts` in `FINDING_SOURCE_FILES` | any new `recipe_*` finding code must be registered or `test/sentinel.test.ts` fails. |
| `sentinelFlags.recipesEnabled()` (`SLACK_SEQUENCES_RECIPES=0`) | parse, cache key, retrieval, injection | the whole Level-1 path behind one switch; default ON. |
| `componentContract.COMPONENT_CATALOG` | `recipe.json` `componentKinds` (retrieval overlap), future clickAnchor metadata (M2) | removing/renaming a kind invalidates manifests naming it (`validateRecipeManifest` warns at load). |
| `directComposition.commitDirectComposition` / `generateDirectThumbnails` | `studio/gate.ts` | the studio gate is exactly these functions; signature changes break `npm run studio` + `studio:golden`. |
| `projectTemplates.initializeProject` | `studio/workspaces.ts` (a workspace IS a project dir) | keep workspaces initializable without a screenshot seed. |
| `prompts/planning-director.md` byte budget (`test/promptBudget.test.ts`) | recipe teaching text lives in runtime-composed retrieval + the response-contract lines in `requestStoryboardPlan` — **not** in the prompt file | keep it that way; recipe additions must not grow the budgeted prompt. |

### 2026-07-09 motion-polish re-proof

The material-shell component morph bridge, content-aware camera framing,
same-station load-bearing companion framing, and revised `seqSwoosh` changed
runtime behavior without changing an island shape/version. The golden recipe
was re-gated and exported against those current runtimes as
`last-word-roulette` revision 10 (`npm run studio:golden`).

## Plugin pipeline seams (2026-07-08 — `src/engine/pluginContract.ts`, the seventh contract)

Plugins are the recipe seam's sibling: parameterized host GENERATORS (not
frozen fragments) that LOWER into typed components/beats at parse and inject
one verbatim markup unit per declaration. Anything that changes a recipe seam
above probably changes the matching plugin seam too.

v1 catalog (all in `PLUGIN_CATALOG`): `dashboard-grid`, `notification-stack`,
`lockup`, `activity-feed` (list/table seeded rows), `terminal-log` (typed
command + streamed result lines), `team-strip` (seeded avatar stack). A new
kind is a **catalog entry only** — no seam below changes; the planning
vocabulary + schema enum derive from the catalog, and the module-load probe at
the foot of `pluginContract.ts` proves every kind lowers to real component
kinds. `seedContent.ts` domains: `devtools`/`analytics`/`comms`/`commerce`/
`design`/`ai`/`generic` (ordered signal match, `generic` fallback last).

2026-07-09 amendments (probe fixes; storyboard cache `contract: 17`): the
lowering also reads the scene's **camera path** — `cameraArrivalSec` delays
the unit's entrance anchor until the camera's first full-move landing on its
region/part (markup stays timing-independent, so byte-convergence is
unaffected even when a later normalize mutates the path); the injected wrapper
carries placement self-defense (`grid-column:1/-1;min-width:0;max-width:100%`)
against author station CSS; and scenes carry `pluginAbsorbedParts` — parts
whose duplicate free components the absorber dropped — which the injector
hides via the `sequences-plugin-absorbed` host style block. The component kit
also changed within v1 (no fence bump — pre-beat rendering only): progress
ring/bar and chart strokes render EMPTY before their beat (flash-of-full fix),
`html,body` default to the `--canvas` tint, and the default highlight ring is
a hairline + bloom instead of the 3px accent border. A recipe re-prove
(`npm run studio:golden`) is still recommended after kit visual changes
(done this session — `last-word-roulette` revision 7). Round 2 (post
fix-probe-1, cache contract 18): `resolvePluginPlan` instances carry
`copyTexts` (verbatim-rendered text params ≥8 chars) and the injector stamps +
hides same-scene exact text-node duplicates outside the wrapper
(`data-sequences-plugin-duplicate`, rules live in the same
`sequences-plugin-absorbed` style block); parseStoryboard synthesizes a
default worldLayout (one viewport cell per camera-path region) when the plan
omits it, which is what guarantees plugin stations arrive viewport-sized.

| engine seam | plugin consumer | when you change it |
|---|---|---|
| storyboard schema (`storyboardResponseFormat`, `parseStoryboard`, cache `contract:`) | the `plugins` scene field (enum over `PLUGIN_KINDS`, array-form params) | keep the `plugins` property + required entry in the JSON schema; bump `contract:` on shape changes; parse must keep calling `normalizeStoryboardPluginDeclarations` + `reconcileAndLowerPlugins` (BEFORE dive/pop/moment derivations — lowered beats feed them). |
| `applyDeterministicSourceRepairs` injection order (islands → **plugins** → component-binding reconcile → … → fx → **assets** → recipes → kits → time-wrap LAST) | `injectPluginContract` call site; `injectAssetContract` (the sequences-assets island + `sequences-assets.v1.js` + `SequencesAssets.compile` call, telemetry tag `asset-inject`) sits after fx and before recipes | plugin injection must stay BEFORE `reconcileComponentBindings` (injected roots satisfy lowered components; reconcilers must never claim author elements for host-provided parts) and be strip-and-reinject byte-convergent (`test/pluginContract.test.ts`); asset injection must stay before the time-wrap (`test/assetRuntime.test.ts`). |
| `componentContract.SceneComponentSpecV1.pluginUid` | `componentUnitCount` (complexity audits), `trimOverBudgetComponents` (never trims plugin children), `pacingAudit.sceneIntroductionTimes` (one introduction per unit) | host-only stamp — `normalizeStoryboardComponents` must never accept it from the model. |
| author-facing projections (`authorStoryboardProjection`, `buildSceneSkeletonInterior`, `slotScaffoldViolations`, `componentReferenceFor`) | plugin children hidden from the author (locked-storyboard JSON, skeletons show a do-not-author comment, no scaffold violation for host-injected roots) | if the author ever sees lowered plugin components it WILL author duplicate roots. |
| `validateDirectComposition` | `validatePluginContract` (plugin_unknown / plugin_island_missing) | host-plumbing self-checks (recipe disposition); keep in the error aggregation. |
| `sentinel.ts` registry | rows `normalize.plugin-lower` + `plugins.contract`; `pluginContract.ts` in `FINDING_SOURCE_FILES` | any new `plugin_*` finding code must be registered or `test/sentinel.test.ts` fails. |
| foundations `pluginKernel.ts` / `seedContent.ts` | every plugin's geometry + content; lowering must stay a PURE function of (scene identity, declaration) | any nondeterminism (Date.now, Math.random, unordered iteration) breaks byte-convergent re-injection and the shared planning cache. |
| `sentinelFlags.pluginsEnabled()` (`SLACK_SEQUENCES_PLUGINS=0`) | parse + injection | the whole path behind one switch; default ON. |
| pre-built asset library (`assetContract.ts` + `src/engine/assets/` + `motionSpring.ts` + `assetRuntime.ts`, ASSETS.md) | `assetPluginSpecs(ASSET_LIBRARY)` appended to `PLUGIN_CATALOG` behind `sentinelFlags.assetsEnabled()` — each asset lowering EMITS one internal `asset`-kind component (root `data-part` `<unit>-core`, stamped `pluginUid`) + host-derived typed `animate` beats (the `enter` spring at the shared camera-arrival-aware entrance anchor, payoffs +0.15s apart), all pure functions of params; `resolveAssetPlan` reads timing back FROM the resolved component plan so paperwork == execution; the kit CSS carries a minimal `.asset` unit-root baseline; the Asset Lab (`npm run assets` → `http://127.0.0.1:4747`, refuses Railway) renders through `renderAssetInstance`/`compileAssetAnimation`, never a forked copy. | renaming `PluginSpec`/`PluginLowerContext`/`PluginLowering`, changing `coerceParam`, or moving the `CATALOG_BY_KIND` construction above the asset append breaks the bridge (`test/assetContract.test.ts`); touching `ResolvedComponentBeatV1` must keep `animation` round-tripping in `parseComponentPlan` or every asset film fails byte-exact island equality (`test/assetRuntime.test.ts`). |
| kit CSS class vocabulary (`templates/sequences-components.v1.css`) | generated markup uses kit classes verbatim (`cmp-stat`, `cmp-toast`, `cmp-ring`, `cmp-headline`, `cmp-item`/`cmp-row`/`cmp-chip`, `cmp-line`/`cmp-dim`, `cmp-avatars`/`cmp-more`, …) | renaming a kit class breaks generated interiors — `test/pluginRuntime.browser.test.ts` catches it in real browser QA. |
| human-facing paperwork (`storyboardMarkdown`, `directOutline`) | one `- plugin: <kind> "<id>" (name=value…) — host-generated` line per declaration in STORYBOARD.md; a `· plugins: <kind>` suffix on the Slack outline scene row | derive the parenthetical generically from `declaration.params` (+ `station=<region>`), never special-case a kind; keep receipts argument-free (paperwork only). |

## Canvas builder seams (M1/M2 — `studio/canvasModel.ts` + `compileCanvas.ts`)

The canvas editor is a WYSIWYG surface over the SAME host-owned contracts the
agents emit. `compileCanvas.ts` is a cockpit over the engine, never a second
engine — it reuses `applyDeterministicSourceRepairs` for ALL island injection.

| engine seam | canvas consumer | when you change it |
|---|---|---|
| `componentContract.COMPONENT_CATALOG` markup | `compileCanvas.renderCatalogComponent` (substitutes only `data-part` + copy) + the UI component browser (served via `GET /api/catalog`) | never fork the markup; a kind's markup change flows through automatically. If a kind's primary text slot changes selector, update `fillPrimaryCopy`. |
| `cameraContract` — camera times are **ABSOLUTE** composition seconds | `compileCanvas` shifts each canvas move by `scene.startSec` (the canvas model stores scene-relative, operator-facing). `CAMERA_MOVES` / `SEQUENCES_EASES` feed the editor dropdowns via `/api/catalog` | if the resolver's time base changes, fix the shift in `compileScene`. `test/studioCanvas.test.ts` guards absolute-time camera resolution. |
| `applyDeterministicSourceRepairs` (islands, runtimes, time-wrap LAST) | `compileCanvas.compileCanvasFilm` hands it `{html, storyboard}` | the compiler emits DOM + entrance tweens + declared moments only; the pass owns every island. Never inject islands in the compiler. |
| `motionDensity` liveness (front-load / quiet-gap / back-half beat) | the compiler spreads entrances across each station's window + declares moments at settled times | a sparse operator scene draws a real gate finding (by design — advice, not a silent pass). |
| `directComposition.commitDirectComposition` / `generateDirectThumbnails` | `gate.ts` `gateCanvasWorkspace` (validate → commit + browser QA → thumbnails) | same gate as recipes and live creates — no laxer referee. |

## Agent seams (M3 — `studio/agents/`)

| engine seam | agent consumer | when you change it |
|---|---|---|
| `@sequences/platform` `PROVIDERS["openrouter-api"].complete` + `CompleteOptions.images` | `agents/openrouter.ts` (in-process critic; passes ref images to vision-capable models, degrades honestly otherwise) | prompt FILES are never forked — the studio composes a chat prompt from `agents/context.ts`. |
| `PROVIDERS["claude-code-cli"]` / the `claude` binary on PATH | `agents/cli.ts` spawns `claude -p --output-format stream-json --permission-mode acceptEdits` (cwd = workspace, `--resume` per workspace) | the CLI agent's cwd is the (gitignored) workspace dir but claude can still see the parent repo — treat diff-scoping as a TODO before this is trusted unattended. |
| `modelPolicy` model ids (`OPENROUTER_CREATIVE_MODEL` / `_LIGHT_MODEL`) | `agents/openrouter.ts` provider switcher | keep the studio's model choices reading from `modelPolicy`, never hard-coded. |
| `validateDirectComposition` + commit + thumbnails | `agents/context.ts` `regateComposition` — re-gates an agent-edited CANVAS composition after every CLI turn; RECIPE workspaces re-gate through `gate.ts` `gateWorkspace` instead (2026-07-07 fix: edited `fragment.html` must be re-staged + re-proven, not re-committed as a composition), which also persists the workspace gate record itself | the agent is refereed by the production gate; changing either signature breaks the re-gate. |

## Environment variables

| var | meaning |
|---|---|
| `SLACK_SEQUENCES_RECIPES=0` | disable the whole recipe path (retrieval, parse, injection) |
| `SLACK_SEQUENCES_RECIPES_DIR` | library root override — **studio gate staging only**, never production |
| `STUDIO_PORT` | studio server port (default 4321) |

## Studio invariants (do not relax)

1. Never on Railway: `server.ts` exits under `RAILWAY_ENVIRONMENT`; nothing in
   the Docker CMD references the studio.
2. Workspaces live in `apps/slack/.data/studio/` (gitignored via `.data/`);
   job dirs under `.data/projects/` stay immutable — studio imports are copies.
3. Export only from a green gate whose `fragmentHash` still matches the
   workspace fragment.
4. Every studio preview/gate runs the production validators — no laxer
   studio-only referee.
5. The exported `fragment.html` is content-addressed (`recipe.json.fragmentHash`);
   hand-editing a library fragment marks the recipe stale until re-proven.
