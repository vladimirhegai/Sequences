/**
 * The Stage agent prompt - the "expensive call" of the Stage AI architecture.
 *
 * Design goals:
 *   - GENUINELY GOOD UI. The prompt carries a tight anti-slop design digest,
 *     retrieves a few relevant local knowledge sections, and points the agent at
 *     deeper on-disk playbooks it can read on demand.
 *   - TOKEN-LIGHT. Referenced images are passed as absolute file paths the agent
 *     opens itself; markdown references are inlined because they are cheap and
 *     high-signal.
 *   - CREATE/HYPERFRAMES READY. The asset is annotated with the Forge contract
 *     so the later Create agent can animate, tweak, and drive it with Hyperframes.
 *
 * Output is strict JSON: { "reply": string, "asset": { name, html, css, js } }.
 * Optional asset fields: react:{rootId,tsx}, capabilities:{react:true,gsap:true,tailwind:true}.
 */
import fs from "node:fs";
import path from "node:path";
import type { StageAssetCapabilities, StageReactSource } from "./reactCompile.ts";
import { retrieveStageKnowledge, type StageKnowledgeHit } from "./stageKnowledge.ts";

export interface StageMediaRef {
  /** The chat chip, e.g. `@Pictures/hero` or `pasted image`. */
  label: string;
  /** Absolute path the agent can open. */
  path: string;
  kind: "image" | "svg" | "video" | "audio" | "doc" | "other";
}

export interface StageDocRef {
  label: string;
  /** Inlined text content (markdown reference docs). */
  text: string;
}

export interface StageAssetSource {
  name?: string;
  html?: string;
  css?: string;
  js?: string;
  /** Optional original React/TSX source. The runner compiles this into `js`. */
  react?: StageReactSource | string;
  capabilities?: StageAssetCapabilities;
}

export interface BuildStagePromptInput {
  message: string;
  /** The asset currently on the stage, when iterating (null for a fresh build). */
  current?: StageAssetSource | null;
  /** Visual references (images/SVG) - passed as file paths, not bytes. */
  media?: StageMediaRef[];
  /** Markdown reference docs - inlined as text. */
  docs?: StageDocRef[];
  /** Delivery aspect of the viewport. Stage assets may scroll vertically. */
  aspect?: string;
  /** Absolute path to Forge's app-owned prompt knowledge. */
  knowledgeDir: string;
  /** API providers cannot read local file paths, so inline small visual refs. */
  inlineMediaBytes?: boolean;
}

/** A short identifier for the provider response cache. Bump on prompt changes. */
export const STAGE_CACHE_HINT = "forge-stage-v6";

/* The non-negotiables, kept terse. The full playbook lives on disk. */
const DESIGN_DIGEST = `DESIGN BAR (make it impossible to mistake for AI slop):
- BANNED: uppercase tracked eyebrows on every section; gradient text; left/right accent
  border stripes; decorative glassmorphism/blur/mesh/"AI sparkle"; sketchy or
  feTurbulence SVG; identical repeated card grids; the big-number hero-metric cliche;
  numbered 01/02/03 section markers; card radius >16px; 1px border + wide soft shadow
  on the same element; "transition: all".
- Contrast is law: body text >=4.5:1, large/bold >=3:1, placeholders too. Never muted
  gray text on a tinted near-white.
- One scarce accent. Real, specific content (no Lorem, no "Card title"). One clear
  focal point, then secondary/tertiary tiers via size + brightness.
- Concentric radius (outer = inner + padding). Shadows over borders. Optical alignment.
  tabular-nums on changing numbers. text-wrap: balance on headings.`;

const CANVAS_RULES = `THE CANVAS (a fixed viewport, not a browser page):
- It renders inside a fixed-width motion viewport. It MAY be taller than the viewport
  when the brief needs a scrollable product/search/page view. Root element should use:
  width:100%; min-height:100%; box-sizing:border-box; overflow-x:hidden. Use vertical
  scrolling only when the content genuinely needs it.
- Self-contained: no external network assets except Google Fonts (@import) and any
  media files explicitly provided below. Local Forge capabilities are allowed:
  React/JSX (compiled by Forge) and GSAP core (served locally).
- This is a source asset for the later Create agent, which uses Hyperframes. Do not
  author the final cinematic entrance/camera move here. Your motion is interaction
  feedback + stateful interactions ONLY (hover, focus, scale(0.96) on press, menu
  opening, selected states). Always add prefers-reduced-motion fallbacks.`;

const HYPERFRAMES_HANDOFF = `CREATE/HYPERFRAMES HANDOFF:
- Stage creates the animatable product/interface asset. Create later choreographs it
  with Hyperframes, so the asset must have clean static states, stable layout, and
  many meaningful named parts.
- Mark granular targets: root, navigation, hero-title, hero-copy, primary-cta,
  metric-card-1, chart-line, table-row-active, drawer, modal, toast. Do not mark
  only one giant wrapper.
- Give the static matte data-forge-layer="backdrop" and every independently
  movable visual subject data-forge-layer="subject". When one asset contains
  multiple cards/panels/widgets, wrap each with a unique data-forge-object name.
- Keep the viewport/canvas background separable from the actual componentry. The
  root may set layout and a static backdrop, but the thing Create should move
  (card, panel, table, modal, button cluster) needs its own named part. Do not bake
  a full black screenshot-like background into the same part as the component.
- Actions are how Create can drive non-static states (open drawer, select tab,
  focus search, reveal filter). Declare every useful state transition as
  @forge-action + data-forge-action.
- Keep random/time-based behavior deterministic. If a value should vary later,
  expose it as a knob instead of computing it randomly.`;

function contractSpec(): string {
  return `THE FORGE CONTRACT - annotate the asset so the Motion AI can use it. Three
declarations, all parsed statically (no runtime needed to read them):

1) PARTS - mark every element the Motion AI might animate (titles, cards, the logo,
   list items, a CTA) with data-forge-component="kebab-name". These are the entrance/
   emphasis/exit targets. Name them by meaning (data-forge-component="pricing-card").
   Add data-forge-layer="backdrop|subject|overlay" to top-level motion layers.
   Add data-forge-object="unique-name" to each independently movable component
   when the asset contains more than one.

2) KNOBS - expose the few values worth tweaking with a CSS comment:
     /* @forge-var accent type=color default=#5e6ad2 label="Accent" */
   then USE it as a CSS variable: color: var(--accent).
   Also support image knobs for replaceable media slots:
     /* @forge-var restaurantPhoto type=image default="" label="Restaurant photo" */
   Types: text, number, range, color, boolean, select, choice, image.
   - number/range add min/max/step:  type=range default=16 min=0 max=40 step=2
     number/range values are UNITLESS - consume with calc(var(--name) * 1px) where a
     unit is needed.
   - select/choice add options:       type=select default=dark options="dark,light,auto"
   - boolean toggles a root attribute [data-<name>] AND --<name>: true/false. Style
     the on-state with :root[data-<name>] selectors.
   - select/choice values also set :root[data-<name>="<value>"] so variants can be
     styled without JS.
   - text/number/select/choice can drive visible copy: put data-forge-var="<name>" on
     the text-bearing element. The runtime updates its textContent live. Use
     data-forge-attr="placeholder" or another attribute when the value belongs in an
     attribute.
   - image exposes an upload/select media slot. Put data-forge-var="<name>" on an
     <img> or placeholder element. For CSS backgrounds, use
     background-image: var(--name); the runtime writes --name as url("...") or none.
     Style empty placeholders with [data-forge-empty].
   Expose only what a user would actually want to change (brand color, a label, a
   radius, a theme). 2-6 knobs is healthy; do not over-expose.

3) ACTIONS - declare each interaction the Motion AI can fire:
     /* @forge-action open-menu label="Open menu" affects="nav-drawer" */
   Put data-forge-action="open-menu" on the trigger element. For the simplest reveal,
   also add data-forge-affects="nav-drawer" to the trigger and style the part's
   [data-forge-open] state - the injected runtime toggles it for you, so a press
   reveals the menu with zero JS. For richer behavior, write your own JS that calls
   the global API: forge.on("open-menu", () => { ... }).
   Ship 1-3 useful invokable actions for state/interaction preview. Keep these
   modest; Create/HyperFrames owns the cinematic entrance and camera motion.

RUNTIME: a tiny "forge" runtime is injected automatically - do NOT include it. It
provides forge.setVar(name, value), forge.trigger(name), forge.on(name, fn), and
forge.vars. The same forge.trigger/forge.setVar the Inspector uses to test is what the
Motion AI calls later. Initial knob values are pre-applied as CSS vars; just consume
var(--name).`;
}

function reactRule(): string {
  return `REACT/JSX OPTION (use when React helps component structure or state):
- You MAY return a React asset. Use this exact shape:
  "asset": {
    "name": "...",
    "html": "<div id=\\"forge-react-root\\"></div>",
    "css": "...",
    "react": { "rootId": "forge-react-root", "tsx": "function App(){ return <main data-forge-component=\\"root\\" /> }" },
    "js": "",
    "capabilities": { "react": true }
  }
- No imports, no exports required, no ReactDOM render call. Forge supplies local
  React-compatible globals: React, ReactDOM, ForgeReact. Supported hooks:
  React.useState/useEffect/useMemo/useRef and ForgeReact.useForgeVar(name, fallback).
- JSX contract attributes must use string literals: data-forge-component="nav",
  data-forge-action="open-menu", data-forge-affects="drawer".
- If React is not useful, return normal HTML/CSS/JS.`;
}

function shadcnRule(): string {
  return `SHADCN / TAILWIND OPTION (the default for clean SaaS components):
- Set "capabilities": { "tailwind": true } to get Tailwind v4 (in-browser) PLUS
  shadcn's design tokens, pre-injected by Forge. Then author shadcn-style markup
  with utility classes against semantic tokens: bg-background, bg-card, text-
  foreground, text-muted-foreground, bg-primary/text-primary-foreground, border,
  border-input, ring-ring, rounded-md/-lg, h-9. Light is default; put class="dark"
  on the root wrapper for a dark asset.
- Do NOT import anything (no @/components/ui, no lucide-react), do NOT add a CDN or
  @import "tailwindcss" - it is all injected. Icons are inline <svg> with
  stroke="currentColor". A global cn(...) is available for JSX className composition.
- Keep utilities non-conflicting (no px-3 px-4 on one element). Expose brand color
  and radius as Forge knobs. See the retrieved "shadcn in Stage" section for Button/
  Card/Input/Dialog/Tabs/Table anatomy + the contract annotations.`;
}

function gsapRule(): string {
  return `GSAP OPTION (local, no CDN):
- GSAP core is available when you set "capabilities": { "gsap": true } or use
  gsap in JS/TSX. Use it for polished interaction/state motion only, not the final
  Hyperframes entrance/camera choreography.
- Prefer timelines over chained delays. Prefer transform/opacity/autoAlpha over
  layout properties. Use explicit eases/durations and scoped selectors.
- React + GSAP: create timelines in React.useEffect and clean them up:
  const root = React.useRef(null);
  React.useEffect(() => { const ctx = gsap.context(() => { ... }, root.current); return () => ctx.revert(); }, []);
- Always guard reduced motion with matchMedia("(prefers-reduced-motion: reduce)")
  or the :root[data-forge-reduced-motion] attribute.`;
}

function opsRule(): string {
  return `SMALL-EDIT OPS (save tokens - use when the user asks for a SMALL change to the
current asset): instead of re-emitting the whole asset, return
  {"reply":"...","ops":[ ... ]}
Forge applies these deterministically to the current asset (and re-derives the
contract). Supported ops:
  - {"op":"set-knob","name":"radius","value":12}        change a @forge-var default
  - {"op":"set-text","part":"hero-title","text":"New"}  set a named part's text
  - {"op":"rename-part","from":"cta","to":"primary-cta"} rename a part everywhere
  - {"op":"ensure-reduced-motion"}                       add the a11y motion guard
Only use ops for changes they cover exactly. For anything structural/visual, return
the full asset instead.`;
}

function fontsRule(): string {
  return `FONTS: Google Fonts are available. Put a single @import at the very TOP of the
CSS (before any rule), e.g.
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
Choose type that fits the brief and pair on a contrast axis (serif+sans / geometric+
humanist), never two near-identical sans. Set a sensible system fallback stack.`;
}

function knowledgeSection(hits: StageKnowledgeHit[]): string {
  if (!hits.length) return "";
  const out = ["RETRIEVED CONTEXT (short, selected for this request):"];
  for (const hit of hits) {
    out.push(`- ${hit.title} (${hit.file})`, "```md", hit.text, "```");
  }
  return out.join("\n");
}

const INLINE_MEDIA_MAX_BYTES = 5 * 1024 * 1024;
const INLINE_SVG_MAX_BYTES = 96 * 1024;

function mimeForPath(file: string): string {
  const ext = path.extname(file).toLowerCase();
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".webp") return "image/webp";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".gif") return "image/gif";
  return "image/png";
}

export function inlineVisualReference(ref: StageMediaRef, maxBytes = INLINE_MEDIA_MAX_BYTES): string {
  if (ref.kind !== "image" && ref.kind !== "svg") return "";
  try {
    const stat = fs.statSync(ref.path);
    const effectiveMax = ref.kind === "svg" ? Math.min(maxBytes, INLINE_SVG_MAX_BYTES) : maxBytes;
    if (stat.size > effectiveMax) {
      return `  inline-bytes: skipped (${stat.size} bytes exceeds ${effectiveMax} byte cap)`;
    }
    if (ref.kind === "svg") {
      return ["  inline-svg:", "```svg", fs.readFileSync(ref.path, "utf8"), "```"].join("\n");
    }
    return `  native-image-attachment: ${mimeForPath(ref.path)} (${stat.size} bytes)`;
  } catch (err) {
    return `  inline-bytes: unavailable (${String((err as Error).message)})`;
  }
}

/** Read a bounded set of raster references for native API image content blocks. */
export function providerImages(
  refs: StageMediaRef[],
  maxImages = 4,
  maxBytes = INLINE_MEDIA_MAX_BYTES,
): Array<{ mimeType: string; base64: string }> {
  const images: Array<{ mimeType: string; base64: string }> = [];
  for (const ref of refs) {
    if (images.length >= maxImages) break;
    if (ref.kind !== "image") continue;
    try {
      const stat = fs.statSync(ref.path);
      if (!stat.isFile() || stat.size > maxBytes) continue;
      images.push({ mimeType: mimeForPath(ref.path), base64: fs.readFileSync(ref.path).toString("base64") });
    } catch {
      // The prompt already reports an unavailable reference; keep the turn usable.
    }
  }
  return images;
}

function mediaSection(media: StageMediaRef[], docs: StageDocRef[], inlineMediaBytes = false): string {
  const lines: string[] = [];
  const viewable = media.filter((m) => m.kind === "image" || m.kind === "svg");
  const embeddable = media.filter((m) => m.kind === "video" || m.kind === "audio" || m.kind === "other");
  if (viewable.length) {
    lines.push(
      "VISUAL REFERENCES - open and look at these image files (use your file-reading",
      "ability). If the user asked to recreate a reference, match its layout, hierarchy,",
      "palette, type, and spacing closely; otherwise treat them as taste/brand cues:",
      ...viewable.flatMap((m) => [
        `  - ${m.label}: ${m.path}`,
        ...(inlineMediaBytes ? [inlineVisualReference(m)] : []),
      ].filter(Boolean)),
    );
  }
  if (embeddable.length) {
    lines.push(
      "EMBEDDABLE MEDIA - you cannot view these, but you may reference them in the asset",
      "by their path/filename if the user wants them shown:",
      ...embeddable.map((m) => `  - ${m.label} (${m.kind}): ${m.path}`),
    );
  }
  for (const d of docs) {
    lines.push(`REFERENCE DOC ${d.label}:`, "```", d.text.trim().slice(0, 6000), "```");
  }
  return lines.join("\n");
}

function reactText(current: StageAssetSource | null | undefined): string {
  if (!current?.react) return "";
  return typeof current.react === "object" ? current.react.tsx : current.react;
}

function currentSection(current: StageAssetSource | null | undefined): string {
  const react = reactText(current);
  if (!current || (!current.html && !current.css && !current.js && !react)) {
    return "CURRENT ASSET: (none - this is a fresh build).";
  }
  return [
    "CURRENT ASSET (you are EDITING this - return the full updated asset, preserving",
    "the contract annotations and parts unless the user asks to change them):",
    `name: ${current.name ?? "Untitled"}`,
    `capabilities: ${JSON.stringify(current.capabilities ?? {})}`,
    "<html>", (current.html ?? "").slice(0, 12000), "</html>",
    "<css>", (current.css ?? "").slice(0, 12000), "</css>",
    react ? ["<react-tsx>", react.slice(0, 12000), "</react-tsx>"].join("\n") : "",
    "<js>", (current.js ?? "").slice(0, 8000), "</js>",
  ].filter(Boolean).join("\n");
}

export function buildStagePrompt(input: BuildStagePromptInput): string {
  const playbook = path.join(input.knowledgeDir, "stage-ui-design.md");
  const sources = path.join(input.knowledgeDir, "source");
  const officialGsapSkills = path.join(sources, "gsap");
  const editing = !!(input.current && (input.current.html || input.current.css || input.current.js || reactText(input.current)));
  const retrieved = retrieveStageKnowledge({
    message: input.message,
    current: input.current ?? null,
    media: input.media ?? [],
    docs: input.docs ?? [],
    knowledgeDir: input.knowledgeDir,
  });

  return [
    "You are the Forge Stage designer. You build ONE self-contained UI",
    "canvas (a SaaS interface, component, search bar, dashboard, card, or mini-hero)",
    "for a motion-graphics shot. The output is an asset for Create, where a later",
    "AI uses Hyperframes to animate it. You annotate the asset so that Motion AI can",
    "animate, tweak, and drive it.",
    "",
    "OUTPUT - return JSON ONLY, no prose outside it, exactly this shape:",
    '{"reply":"one or two sentences on what you built/changed","asset":{"name":"Short Name","html":"...","css":"...","js":"..."}}',
    "html is markup INSIDE <body>. css is plain CSS (@import first). js is plain JS.",
    "Optional fields: react:{rootId,tsx}, capabilities:{react:true,gsap:true,tailwind:true}.",
    editing
      ? "For a SMALL edit you MAY instead return {\"reply\":..., \"ops\":[...]} (see SMALL-EDIT OPS)."
      : "",
    "",
    `VIEWPORT ASPECT: ${input.aspect ?? "16:9"} (fixed viewport; vertical scroll is allowed when useful).`,
    "",
    "SCOPE AND OUTPUT BUDGET:",
    "- Match the requested scope exactly. A search bar is a search bar, not a full",
    "  Spotlight app, dashboard, file browser, settings panel, or product shell unless",
    "  the user explicitly asks for those surrounding experiences.",
    "- Prefer the smallest polished implementation that fully satisfies the brief.",
    "- Keep the complete JSON response under 12,000 characters for a single component.",
    "  Use concise HTML/CSS/JS and a small realistic data set. Never cut JSON or code off.",
    "",
    CANVAS_RULES,
    "",
    HYPERFRAMES_HANDOFF,
    "",
    contractSpec(),
    "",
    reactRule(),
    "",
    shadcnRule(),
    "",
    gsapRule(),
    "",
    fontsRule(),
    "",
    editing ? opsRule() : "",
    "",
    DESIGN_DIGEST,
    "",
    knowledgeSection(retrieved),
    "",
    "DEEPER GUIDANCE (read on demand; do not dump it into the answer):",
    `  - Full playbook: ${playbook}`,
    `  - Source skills: ${sources} (impeccable, make-interfaces, design-taste, shadcn, typography, surfaces, animation, React, GSAP, performance)`,
    `  - Official GSAP AI skills: ${officialGsapSkills} (core, timeline, React, performance, plugins, utils, ScrollTrigger)`,
    "Use the retrieved context first; consult a source file only when the brief needs depth.",
    "",
    mediaSection(input.media ?? [], input.docs ?? [], input.inlineMediaBytes),
    "",
    currentSection(input.current),
    "",
    editing
      ? "USER REQUEST (an edit to the current asset):"
      : "USER REQUEST (build the asset):",
    input.message.trim(),
    "",
    "FINAL OUTPUT CHECK: return JSON only. For a full build, the top-level object",
    'MUST be {"reply":"...","asset":{"name":"...","html":"...","css":"...","js":"..."}}.',
    'Do not flatten name/html/css/js at the top level and do not rename "asset".',
  ]
    .filter((line) => line !== undefined && line !== null && line !== "")
    .join("\n");
}
