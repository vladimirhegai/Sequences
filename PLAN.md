# PLAN.md — The Sequences Rewrite

> North star: **an installable, lightweight desktop app that turns a brief into
> an amazing SaaS product animation** — the agent drives, the deterministic
> engine guarantees quality, the human nudges. Fast. Cross-platform. Simple.

This plan goes back to the ground floor **without throwing away the robust
parts.** The engine (`packages/core`) and the IO layer (`apps/studio` minus its
UI) are kept wholesale. What gets rebuilt is the surface: a sprawling 7-page
studio (timeline, Excalidraw storyboard, SVG design page, references) collapses
into **three panes** and a real native shell.

See [CLAUDE.md](CLAUDE.md) for the engine contract (the 9 laws, file tree,
substrate). See [MOTION_RESEARCH.md](MOTION_RESEARCH.md) for the motion-design
evidence base. The complete pre-rewrite state is archived on the **`OLD`**
branch — cherry-pick from it freely; nothing was lost.

## 1. The lesson

The previous build was architecturally strong and bit off too much surface:
extensions UI, storyboard, references, a full timeline editor — all before there
was even **one genuinely good motion-graphics example** to prove the system or
tune taste against. The engine can enforce consistency, but consistency isn't
quality; quality is taste, and taste must be tuned against something real.

So the rewrite inverts the priority:

1. **Prove the output.** Make one award-worthy reference animation; tune the
   taste files against it.
2. **Prioritize the agent's view of the software**, not UI chrome. Design what
   the agent sees and selects before designing panels.
3. **Ship the simplest app that closes the loop**: agent → preview → nudge.

## 2. Principles that survive (non-negotiable)

- The **9 laws** in CLAUDE.md. The canonical typed `Project`, one command
  pathway, one-way compiler, token purity, validation gate, exact inverses,
  registry discipline, GSAP-behind-the-seam, extension scoping. The rewrite may
  replace the entire frontend but **must not** introduce: direct project
  mutation, a second canonical state model in the UI, HTML-as-source editing,
  raw off-lattice values, untracked agent edits, or render behavior that differs
  from the core compiler.
- **Local-first**, no database, project = a directory, trivially git-able.
- **TypeScript everywhere** for all domain logic. Rust appears only as Tauri
  window glue; it holds no project logic.
- **No forced API keys.** Default agent path is the user's local Claude / Codex
  CLI subscription.
- **Extensions are the growth model.** New motion vocabulary is registry
  entries, not core edits.

## 3. Target architecture

A thin native shell over the existing Node engine, with a small reactive UI.

```text
┌──────────────────────────── Tauri 2 app (Rust window glue) ─────────────────┐
│  OS webview  (WebView2 / WKWebView / WebKitGTK)                              │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │  Svelte 5 frontend  (Vite build, embedded as static assets)            │ │
│  │     Agent pane │ Viewer pane │ Inspector pane                          │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│            │  HTTP on 127.0.0.1:<ephemeral>  (existing server.ts API)        │
│            ▼                                                                 │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │  Node engine sidecar  (spawned by Tauri, killed on exit)              │ │
│  │   server.ts · ProjectStore · compiler · render · agent providers ·   │ │
│  │   MCP · projectIo · workspace   →  spawns claude/codex CLI, FFmpeg,   │ │
│  │   headless Chrome/Edge for render capture                            │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Why this is the right shape:**

- **Lightweight & fast.** No bundled Chromium (unlike Electron). The only weight
  is Node — already required for the engine — plus the OS-native webview. Tauri
  binaries are MBs, not hundreds of MBs. Startup is native-instant.
- **Cross-platform** (macOS, Linux, Windows) is Tauri's whole premise; the Node
  engine and its tools (FFmpeg, Chromium discovery) are already cross-platform.
- **Minimal rewrite, maximum reuse.** The Svelte UI is just a **new client of the
  existing `server.ts` HTTP API**. The engine, store, compiler, render, agent,
  and MCP code are reused unchanged. "Architecture stays mostly like current
  Sequences" — only the shell and the UI are new.
- **Clean seams.** Domain logic stays TS in Node; Rust never touches a `Project`.

**Process model & lifecycle:**

1. Tauri launches, spawns the Node engine sidecar, which binds `127.0.0.1` on a
   free port and prints it (handshake via stdout/arg/temp-file).
2. Tauri loads the Svelte bundle; the frontend is told the port and talks to
   `server.ts` exactly as the old studio did.
3. The viewer loads compiled HyperFrames HTML from the local server into the
   webview (GSAP runs fine in all three OS webviews).
4. On window close, Tauri terminates the sidecar (and its child render/agent
   processes).

**Node distribution:** start by requiring a **system Node ≥22.18** (dev + power
users, zero packaging). For end-user installers, bundle Node as a Tauri sidecar
binary via Node SEA (single executable application). Keep the existing `sequences
app` (system-browser) path alive as a zero-install fallback and for CI.

**Still external (document & detect, don't bundle initially):** a Chromium-family
browser (Edge/Chrome) for render capture, and FFmpeg for encoding — both already
auto-discovered by `render.ts`. The OS webview powers the *app UI*; render
capture is a separate headless browser, as today.

## 4. Keep / Rebuild / Drop

Be deliberate — **nothing gets deleted randomly.** Anything dropped from the
working tree still lives on the `OLD` branch.

| Area | Decision | Notes |
|---|---|---|
| `packages/core/**` | **Keep** | The entire deterministic spine. Untouched except taste tuning. |
| `apps/studio/src/server.ts` | **Keep (trim)** | Reused as the engine API. Remove routes for dropped pages (design/storyboard sidecars, fs browser) as their UIs go. |
| `projectIo · render · thumbs · mcp · agent/* · workspace · assetMetadata · cli` | **Keep** | Core IO. `workspace.ts` loses storyboard-serializer + disk-browser bits over time. |
| `projectTemplates.ts` | **Keep** | Project init + demo path. |
| `desktopApp.ts` (system-browser app mode) | **Keep as fallback** | Superseded by Tauri for the shipped app. |
| `apps/studio/src/static/**` (vanilla-JS UI) | **Rebuild** | Replaced by the Svelte 3-pane app. Delete page-by-page only as each is migrated. |
| Excalidraw storyboard (`storyboard*.{js,ts}`, the ~14 MB bundle, `build:storyboard`) | **Drop** | No storyboard in the new app. Removing the bundle also de-bloats the repo. The "drawn intent" idea returns later as agent *reference* input (text/image), not an editor. |
| SVG Design page (`design.js`) + `design.json` sidecar | **Drop** | Asset design is out of scope for the simple app. |
| References page | **Drop now, reimagine** | Returns as agent reference/taste input (§6), not a pinboard. |
| Timeline editor UI | **Drop** | Explicit product decision: no timeline. Scene/transport surfaced minimally in viewer/inspector. |
| React dependency | **Drop** | Only existed for Excalidraw. Svelte replaces it. |
| `evals/`, `scripts/`, `skills/`, golden/perf tests | **Keep** | Quality gates and the external-agent skill stay. |

## 5. The app — three panes

Desktop-first, monochrome graphite + scarce silver (CLAUDE.md Design DNA). The
preview is the largest, most stable region; the agent never shouts over it.

### Left — Agent (a command surface, not a chatbot)
- **Auto-connects** to `claude` / `codex` CLI on launch via `agent/providers.ts`
  detection; shows provider status; no API key, no setup wizard.
- Brief input (freeform) + a structured-brief option (product, audience,
  promise, features, CTA, vibe) that can plan **zero-token** via `brief.ts`.
- Produces a **plan**, optionally **2–3 directions** (deterministic profile/layout
  variants) to choose from before detailed editing.
- Output is **diff cards**, not chat bubbles: every proposed change is named
  ("Scene 2: `slideUpSoft` → `maskRevealUp`") with **Apply / Reject / Inspect /
  Revert**. One plan = one Batch = one undo.
- A tweak box: natural language → zero-token matcher (`tweak.ts`) first, else a
  cheap-model → validated commands.

### Center — Viewer (no timeline)
- The real **HyperFrames player** of the compiled project, centered and
  letterboxed to output aspect, on the graphite vignette well.
- **Simple transport only:** play / pause, restart, scrub, timecode + frame
  count, maybe per-scene step. **No lanes, no clips, no keyframes.**
- Fast command-to-preview (the existing 300 ms budget). Selecting a scene/layer
  here drives the inspector.

### Right — Inspector (generic tweaks)
- Context-sensitive, all mapped to **existing typed commands**:
  - Scene: layout, duration, transition, camera move, choreography.
  - Selection/layer: motion primitive swap, enter duration token, text/copy,
    reset overrides.
  - Brand: 5 semantic colors, fonts, motion profile.
  - Project: format/fps (read-mostly), enabled extensions (scope).
- Token pills preview their motion on hover; numeric values in mono. Every
  control answers mutate/inspect/preview/command; mutations are commands.

A lightweight **status strip** keeps the linter state + fixable count + autofix,
because the deterministic critic is a feature, not plumbing.

## 6. The agentic workflow (the hard part — make it genuinely good)

Award-worthy animation is **not** something we let the model code up. The whole
strategy is to give the agent *judgment* and keep *taste* in authored code.

**Division of labor (the cost discipline, CLAUDE.md):**
- **Agent, expensive, once per project:** the beat sheet only — interpret the
  brief into ordered beats, pick an archetype per beat, pick the one global
  profile, decide where a signature moment belongs narratively.
- **Agent, cheap, occasional:** copywriting to slot budgets, NL-tweak → command,
  plan-repair on a validation failure.
- **Deterministic, zero tokens, everything else:** layout, all timing, motion
  execution, primitive assignment for standard cases, transitions, lint + fixes,
  contrast, render, caching, undo.

**The five levers that actually make output good** (none requires a smarter model):
1. **Load-bearing catalog summaries.** Each primitive/archetype/profile reads
   like a senior briefing a junior ("use when…", "never with…"). `promptCatalog()`
   is the planner's whole world — invest here.
2. **Compatibility as data.** Primitive tags (`energy`, `weight`, `style`) +
   profile whitelists + linter rules make bad *combinations* unrepresentable. The
   agent literally cannot place a spring entrance next to a mechanical wipe.
3. **A deterministic critic on every compile.** Readability, simultaneity cap,
   stagger, contrast, density, easing whitelist — with auto-fix as commands.
4. **Reference as bias, not specification (replaces the old storyboard).** Let the
   user point the agent at a reference (a URL, a screenshot, a few words of vibe).
   Encode it deterministically into the planner's own vocabulary
   (archetype/layout/role hints) — never copy coordinates. Optional image channel
   for API providers; text encoding stays canonical for the CLI path.
5. **Tune taste against the reference animation (§7).** The tokens/profiles/
   archetypes are only as good as what they're tuned against.

**Robustness mechanics:**
- **Auto-connect & status**: detect CLI providers, pick a sensible default,
  surface "connected to Claude Code / Codex" plainly.
- **Streaming** plan/tweak output where the provider supports it; otherwise async
  status + polling (already in `planRunner`).
- **Repair loop:** on plan/command validation failure, feed the validator error
  back **once** to the *cheap* model with only the failing slice — never re-run
  the expensive call. The validator's messages are our only lever over external
  agents, so make them unusually descriptive.
- **Inspectable & reversible:** agent edits are commands; "revert what the agent
  just did" and diffs come free from the event log.
- **Direction-first:** show 2–3 real directions before fine editing so the user
  steers cheaply.

## 7. Milestone 0 — the reference animation (do this first / in parallel)

The single highest-leverage task. Hand-craft **one genuinely excellent ~15–30s
SaaS promo** with the engine (hand-editing the `Project` through commands where
needed to discover gaps). Use it to:

- **Tune the taste files** (`tokens.ts`, `profiles.ts`, `archetypes.ts`) against
  something real instead of in the abstract.
- **Surface missing vocabulary** — every "I wish I had X" becomes a new primitive
  / archetype / transition authored as an **extension** (e.g. a true rolling
  "odometer" number, a morph/FLIP transition).
- Become the **hero demo** (default project, marketing clip) and an **eval +
  golden** anchor.

This de-risks the entire product: you cannot tune taste, or trust the agent, or
sell the app, without a known-good target render to measure against.

## 8. Extensions architecture (keep it)

An extension **is a registry entry** — primitive, archetype, profile, transition,
or token set — each a folder with implementation + params schema + one-line
summary + version + auto thumbnail, routed through `registry/types.ts` (law 7).

- **Vocabulary scoping (law 9):** `project.extensions.enabled` gates what the
  agent may newly select. The inspector exposes a lightweight enable/disable so a
  project can narrow or widen the agent's palette. Disabling never uninstalls or
  invalidates existing scenes.
- **Authoring contract:** token purity (no hardcoded numbers, CI-enforced) +
  must pass the linter against a probe scene + auto-thumbnail. Showcase the
  "HF catalog → Sequences extension" wrapper path with at least one shader/morph
  transition and one device-frame/number primitive.
- **Closed for now:** no dynamic third-party code loading — extension code
  compiles into the render (arbitrary code execution). Stays first-party until a
  reviewed marketplace (later). The on-ramp is a future free marketplace /
  community archetypes from a Scene-Designer authoring flow.

## 9. Phased roadmap

- **Phase 0 — Foundation & reference.** Engine stays green. Build the Milestone-0
  reference animation; tune taste files; author missing vocabulary as extensions;
  lock a real hero render + eval/golden. Trim obviously-dead UI only as it's
  superseded.
- **Phase 1 — Shell.** Stand up Tauri 2; spawn the Node engine sidecar; port
  handshake; load a minimal Svelte frontend against `server.ts`; window
  lifecycle + clean sidecar shutdown; build on all three OSes (system Node).
- **Phase 2 — The three panes.** Viewer (player + simple transport, no timeline);
  Inspector (generic tweaks via existing commands); Agent (auto-connect + brief +
  plan + diff cards + tweak). Reconnect every mutation through the command API —
  **no second state model.**
- **Phase 3 — Agentic depth.** Streaming, repair loop, reference-as-bias input,
  2–3 directions, apply/inspect/revert diffs, broaden NL-tweak coverage, tune
  prompts/catalog. End-to-end UI coverage for the core journeys.
- **Phase 4 — Extensions + packaging.** Lightweight extension scope UI; ship 1–2
  showcase extensions; bundle the Node sidecar (SEA) and produce installable
  binaries for Mac/Linux/Windows; optional auto-update.
- **Deferred (only with a real home + acceptance metric):** semantic reference
  encoding, full camera scripts, audio/beat retiming, incremental render cache,
  contact-sheet visual critic, taste vectors, the Scene Designer, marketplace.

## 10. Risks & open questions

- **Node sidecar packaging** across OSes — mitigate with system-Node-first, SEA
  later; keep system-browser app mode as fallback.
- **OS webview drift** (WebKitGTK on Linux lags WebKit/Blink) — test the
  HyperFrames player in all three webviews early in Phase 1.
- **Render still needs system Chrome/Edge + FFmpeg** — detect, guide, document;
  consider a future bundled render runtime.
- **Agent quality varies by the user's CLI model** — our only lever is unusually
  descriptive validator/repair feedback; lean into it.
- **Don't rebuild a canonical state model in Svelte** — stores mirror server
  state; all writes are commands (law 1). This is the easiest law to break in a
  reactive UI; guard it.

## 11. Definition of done (the rewrite)

- An **installable, lightweight** app on macOS, Linux, Windows that **auto-connects
  to Claude / Codex CLI** with no API key.
- **Three panes, no timeline**, dominant trustworthy preview; agent edits are
  named, inspectable, reversible diffs.
- **One genuinely good reference animation** shipped as the demo, with the taste
  files tuned against it.
- Engine test suite green (typecheck, vitest, perf, golden); the new UI has
  end-to-end coverage for the core journeys.
- **Extension scoping works**, with ≥1 showcase extension beyond core, and the
  authoring contract (token-purity + probe-lint + thumbnail) enforced.

The win condition isn't more features — it's that a non-designer can describe a
product and get back an animation good enough to ship, then nudge it in minutes.
