/**
 * Create agent prompt: Forge's motion director.
 *
 * The prompt stays compact by sending component contracts, clipped source
 * snapshots, storyboard/reference paths, and retrieved motion/engine cards
 * instead of dumping every skill and every saved component.
 */
import path from "node:path";
import { PRIMITIVES } from "@sequences/core";
import { foregroundAnalysis } from "./stageContract.ts";
import type { ForgeObject } from "./objects.ts";
import { inlineVisualReference, type StageDocRef, type StageMediaRef } from "./stagePrompt.ts";
import { retrieveCreateKnowledge, type CreateKnowledgeHit, type CreateIntent } from "./createKnowledge.ts";
import type { ForgeExtensionDraft } from "./createDraft.ts";

export interface BuildCreatePromptInput {
  message: string;
  aspect: string;
  components?: ForgeObject[];
  media?: StageMediaRef[];
  docs?: StageDocRef[];
  currentDraft?: ForgeExtensionDraft | null;
  currentErrors?: string[];
  knowledgeDir: string;
  inlineMediaBytes?: boolean;
}

export const CREATE_CACHE_HINT = "forge-create-v1";

const MOTION_BAR = `MOTION BAR:
- Motion explains change: what appeared, changed, became related, or deserves attention.
- Hierarchy beats quantity. Pick one hero beat, then support it with quieter timing.
- Prefer transform and opacity. Use mask/clip/path/counter only when they explain the idea.
- One loud motion per snippet unless the user explicitly asks for spectacle.
- Timing and easing are contextual design choices; avoid random magic-number soup.
- Typography, contrast, composition, and copy clarity count as motion quality.
- Keep behavior deterministic. No unbounded random, Date.now drift, network dependencies, or hidden external assets.
- Reduced-motion is respected in the Forge authoring UI; do not silently rewrite the video content.

A deterministic critic runs on every draft and is not your eyes: it flags >3 concurrent
movers, two loud beats overlapping, layout-thrashing properties, and rejects
non-deterministic/network code outright. Author to clear these without being told.`;

const OUTPUT_CONTRACT = `OUTPUT - return JSON only, no prose outside it.

Normal result:
{
  "reply": "short explanation",
  "extensionDraft": {
    "name": "Metric Cascade Reveal",
    "summary": "20+ char summary for the .seqext manifest",
    "route": "interface-reveal|micro-interaction|data-moment|brand-sting|transition-bridge|media-frame",
    "primitiveKind": "enter|exit|emphasis|continuous",
    "aspect": "16:9",
    "durationSec": 5.5,
    "components": ["obj-id"],
    "media": ["asset-id"],
    "taxonomy": {
      "family": "app-ui",
      "subject": "dashboard",
      "action": "reveal",
      "technique": ["stagger", "mask"],
      "energy": "calm|punchy",
      "style": "organic|mechanical",
      "register": "premium|technical|minimal|playful",
      "context": ["feature-proof"]
    },
    "timeline": [
      {
        "asset": "obj-id",
        "target": "hero-title",
        "op": "fromTo",
        "from": { "opacity": 0, "y": 24 },
        "to": { "opacity": 1, "y": 0 },
        "duration": 0.45,
        "ease": "power3.out",
        "at": 0
      }
    ],
    "actions": [{ "at": 1.2, "asset": "obj-id", "trigger": "open-menu" }],
    "knobs": [{ "at": 0, "asset": "obj-id", "name": "accent", "value": "#5e6ad2" }]
  }
}

The structured "timeline" is the primary authoring format. Author it carefully; the
server compiles it directly into token-pure Hyperframes StepTemplate skeleton data.
Do NOT write "liftSource" unless explicitly asked for legacy GSAP lift debugging.

If a required editable asset is missing, ASK PERMISSION FIRST by returning:
{
  "reply": "I need Stage to make a billing settings panel before choreographing this.",
  "stageRequest": {
    "brief": "Build a billing settings panel with invoice rows and plan card.",
    "aspect": "16:9",
    "requiredParts": ["settings-card", "invoice-row-active", "save-button"],
    "requiredActions": ["focus-search", "show-toast"],
    "requiredKnobs": ["accent"],
    "styleHints": "match the saved analytics dashboard",
    "reason": "No saved component contains billing/settings parts."
  }
}

Small subjective edit to the current draft may return a full updated extensionDraft.
Do not invent component ids, part names, actions, or knobs.`;

const TIMELINE_RULES = `TIMELINE STEP CONTRACT (the motion you author):
- Each step: { asset, target, op, from?, to?, vars?, at, duration?, ease? }.
- "asset" is a component id; "target" is a named part of that component's contract.
- op "fromTo" needs from+to; "to"/"from" use to/from (or vars); "set" snaps vars.
- op "count" animates a NUMBER readout (data-moment KPIs): target the number part
  and set vars { value, prefix?, suffix? } — e.g. vars:{ value:1240000, prefix:"$",
  suffix:"" } races the text from 0 to the value and lands exactly. Use this for
  metrics/counters instead of faking digits with transforms.
- Prefer transform + opacity: x, y, scale, rotation, opacity. Mask/clip only when
  it explains the idea. "at"/"duration" are seconds; "ease" is a GSAP ease name.
- Numbers are promoted into .seqext tokens on export; keep them intentional, not
  random magic-number soup.`;

const NAMING_RULES = `NAMING:
- Name the draft after the actual subject + dominant action/technique. Good:
  "Settings Card Delete Recovery", "Dashboard KPI Cascade", "Search Results Morph".
- Avoid vague art-title names like "The Considered Edit", "Quiet Moment", or
  "Premium Motion". The title should help someone file and find the snippet.`;

const COMPONENT_RULES = `COMPONENT CHOREOGRAPHY:
- A Stage Component is an asset layer. Animate named parts from its contract:
  data-forge-component / data-forge-part. Do not animate anonymous DOM guesses
  when a contract exists, and never invent part/action/knob names.
- Treat root/screen/canvas/backdrop parts as static framing unless the brief is
  specifically about the background. For camera/parallax/3D moves, target the
  actual foreground component part (card, panel, table, modal, button cluster) so
  the stage matte does not rotate with the UI.
- Use actions for state changes: { at, asset, trigger } fires forge.trigger().
- Use knobs for value/state setup: { at, asset, name, value } sets forge.setVar().
- MULTIPLE COMPONENTS: you may choreograph several attached components together.
  Reference each by its own id in steps; order their entrances by hierarchy (hero
  first), keep at most ~3 things moving at once, and let one component own the
  hero beat.
- SCROLLABLE / OFFSCREEN CONTENT: a component flagged "scrollable-likely: yes"
  (a page, long table, feed, search results) has content below the fold. Animate
  what is in view first. To reveal content below the fold, add a step targeting
  the scroll container with op "to" and to.scrollTop = <pixels> (a positive number
  scrolls down); this is deterministic and previewable. Pan only when it explains
  moving to that content.
- ASPECT: compose for the locked delivery aspect. A 9:16 frame favors vertical
  stacking and larger type; 16:9 favors lateral reveals. Do not change aspect on
  iteration — the draft locked it; the user must start a new draft to change it.`;

function routeDigest(intent: CreateIntent): string {
  const routeNotes: Record<CreateIntent["route"], string> = {
    "interface-reveal": "dashboard/card/table/search/list entrances; chrome first, data/content second; hero/support hierarchy matters.",
    "micro-interaction": "hover/press/focus/select/expand/notification beats; tactile but brief; state change must be legible.",
    "data-moment": "metrics, charts, counters, row highlights; quantify the reveal and make the final value/readout clear.",
    "brand-sting": "logo, wordmark, tagline, CTA finish; assemble with restraint and land on a readable lockup.",
    "transition-bridge": "state A to B; preserve identity and spatial continuity; use morph/FLIP/camera only when necessary.",
    "media-frame": "screenshot/photo/video/device reveal; media must remain inspectable, not hidden by atmosphere.",
  };
  return [
    `INTENT ROUTE: ${intent.route}`,
    `PRIMITIVE KIND BIAS: ${intent.primitiveKind}`,
    `SUBJECTS: ${intent.subjects.join(", ") || "(infer from components)"}`,
    `ACTIONS: ${intent.actions.join(", ") || "(infer from brief)"}`,
    `TECHNIQUES: ${intent.techniques.join(", ") || "(choose sparingly)"}`,
    `RISK: ${intent.risk}`,
    `ROUTE NOTE: ${routeNotes[intent.route]}`,
  ].join("\n");
}

function primitiveDigest(): string {
  return Object.values(PRIMITIVES)
    .filter((primitive) => ["enter", "exit", "emphasis", "continuous"].includes(primitive.kind))
    .map((primitive) => `- ${primitive.id} [${primitive.kind}, ${primitive.tags.energy}/${primitive.tags.style}]: ${primitive.summary}`)
    .slice(0, 28)
    .join("\n");
}

function clipped(text: string, max: number): string {
  const clean = text.replace(/\n{3,}/g, "\n\n").trim();
  if (clean.length <= max) return clean;
  const head = clean.slice(0, max);
  const cut = Math.max(head.lastIndexOf("\n\n"), head.lastIndexOf(". "));
  return `${head.slice(0, cut > 300 ? cut + 1 : max).trim()}\n[...]`;
}

/** The contract is authoritative and choreography needs only it; the full source
 *  is only needed the first time the agent meets a component. Once it is in the
 *  draft, send the contract alone and save the budget (FORGE.md §Context Budget). */
const MAX_FULL_SOURCE = 3;
const SOURCE_CLIP = 2200;

function componentSection(components: ForgeObject[], knownIds: ReadonlySet<string> = new Set()): string {
  if (!components.length) return "SELECTED COMPONENTS: none. If the brief requires a SaaS UI surface, propose a stageRequest.";
  const lines = ["SELECTED COMPONENTS (contracts are authoritative; the part/knob/action lists are what you choreograph against):"];
  let sourceBudget = MAX_FULL_SOURCE;
  for (const component of components) {
    const scrollable = /\boverflow-y\s*:\s*(auto|scroll)|\bscroll\b|height\s*:\s*(?:1[2-9]\d{2,}|[2-9]\d{3,})px|table|tbody|feed|results/i.test(
      `${component.html}\n${component.css}\n${component.js}`,
    );
    const fg = foregroundAnalysis(component.components, component.contract.layers);
    const subjectLine = fg.separated
      ? `foreground subjects (safe to move/tilt): ${fg.foregroundParts.join(", ")}`
      : "foreground subject: NONE — only backdrop/root parts. Do NOT apply 3D/translation to the whole frame (it drags the backdrop). Propose a stageRequest to split out the real subject part, or keep motion to opacity/scale of the frame.";
    lines.push(
      `- ${component.id}: ${component.name}`,
      `  parts: ${component.components.join(", ") || "root"}`,
      `  independent objects: ${component.contract.objects.join(", ") || "one subject"}`,
      `  ${subjectLine}`,
      `  knobs: ${component.variables.map((knob) => `${knob.name}:${knob.type}`).join(", ") || "none"}`,
      `  actions: ${component.actions.map((action) => `${action.name}${action.affects ? `->${action.affects}` : ""}`).join(", ") || "none"}`,
      `  capabilities: ${Object.entries(component.capabilities ?? {}).filter(([, enabled]) => enabled).map(([name]) => name).join(", ") || "plain-html"}`,
      `  scrollable-likely: ${scrollable ? "yes" : "no"}`,
    );
    // Established draft components: the agent already chose these; the contract is
    // enough to keep choreographing. Only spend source budget on new arrivals.
    if (knownIds.has(component.id)) {
      lines.push("  source: omitted (already in the draft — choreograph from the contract above).");
      continue;
    }
    if (sourceBudget <= 0) {
      lines.push("  source: omitted to stay in budget; read it on disk via the component library if you need structure.");
      continue;
    }
    sourceBudget--;
    lines.push(
      `  source snapshot:\n${clipped(
        [
          "<html>",
          component.html,
          "</html>",
          "<css>",
          component.css,
          "</css>",
          component.react?.tsx ? `<react-tsx>\n${component.react.tsx}\n</react-tsx>` : "",
          "<js>",
          component.js,
          "</js>",
        ].filter(Boolean).join("\n"),
        SOURCE_CLIP,
      ).replace(/\n/g, "\n    ")}`,
    );
  }
  return lines.join("\n");
}

function mediaSection(media: StageMediaRef[], docs: StageDocRef[], inlineMediaBytes = false): string {
  const lines: string[] = [];
  const viewable = media.filter((item) => item.kind === "image" || item.kind === "svg");
  const other = media.filter((item) => item.kind !== "image" && item.kind !== "svg");
  if (viewable.length) {
    lines.push(
      "VISUAL REFERENCES / STORYBOARD FRAMES:",
      "Treat multiple images in the listed order as frame 1, frame 2, frame 3 of a storyboard unless the user says otherwise.",
      ...viewable.flatMap((item, index) => [
        `  ${index + 1}. ${item.label}: ${item.path}`,
        ...(inlineMediaBytes ? [inlineVisualReference(item)] : []),
      ].filter(Boolean)),
    );
  }
  if (other.length) {
    lines.push("OTHER MEDIA REFERENCES:", ...other.map((item) => `  - ${item.label} (${item.kind}): ${item.path}`));
  }
  for (const doc of docs) {
    lines.push(`REFERENCE DOC ${doc.label}:`, "```md", clipped(doc.text, 5000), "```");
  }
  return lines.join("\n");
}

function knowledgeSection(hits: CreateKnowledgeHit[]): string {
  if (!hits.length) return "";
  const out = ["RETRIEVED MOTION / HYPERFRAMES CONTEXT:"];
  for (const hit of hits) {
    out.push(`- ${hit.title}`, `  source: ${hit.file}`, `  why: ${hit.why}`, "```md", hit.text, "```");
  }
  return out.join("\n");
}

function currentDraftSection(draft: ForgeExtensionDraft | null | undefined): string {
  if (!draft) return "CURRENT DRAFT: none. Compose a new extension draft.";
  return [
    "CURRENT DRAFT (iterate from this; preserve aspect unless user starts a new draft):",
    JSON.stringify(
      {
        id: draft.id,
        name: draft.name,
        summary: draft.summary,
        route: draft.route,
        primitiveKind: draft.primitiveKind,
        aspect: draft.aspect,
        durationSec: draft.durationSec,
        components: draft.components,
        media: draft.media,
        taxonomy: draft.taxonomy,
        timeline: draft.timeline.slice(0, 12),
        actions: draft.actions,
        knobAutomation: draft.knobAutomation,
        validation: draft.validation,
        compiledMotion: draft.compiledMotion,
        ...(draft.liftSource ? { liftSource: draft.liftSource } : {}),
      },
      null,
      2,
    ),
  ].join("\n");
}

function errorSection(errors: string[] | undefined): string {
  if (!errors?.length) return "";
  return ["CURRENT VALIDATION/REPAIR SIGNALS:", ...errors.map((error) => `- ${error}`)].join("\n");
}

export function buildCreatePrompt(input: BuildCreatePromptInput): { prompt: string; intent: CreateIntent; hits: CreateKnowledgeHit[] } {
  const retrieved = retrieveCreateKnowledge({
    message: input.message,
    components: input.components ?? [],
    media: input.media ?? [],
    docs: input.docs ?? [],
    currentErrors: input.currentErrors,
    knowledgeDir: input.knowledgeDir,
  });
  const root = path.resolve(input.knowledgeDir, "..", "..", "..");
  const prompt = [
    "You are Forge Create, a senior SaaS motion-design agent.",
    "Your job is to choreograph saved Stage Components and media into showcase-worthy Sequences Extension drafts.",
    "Stage makes editable UI assets. Create makes motion snippets. Export packages .seqext bundles.",
    "",
    OUTPUT_CONTRACT,
    "",
    `LOCKED DELIVERY ASPECT: ${input.currentDraft?.aspect ?? input.aspect}`,
    input.currentDraft ? "The existing draft already locked the aspect. Keep it." : "This new draft will lock the aspect after your response.",
    "",
    routeDigest(retrieved.intent),
    "",
    MOTION_BAR,
    "",
    COMPONENT_RULES,
    "",
    NAMING_RULES,
    "",
    TIMELINE_RULES,
    "",
    "AVAILABLE BUILT-IN PRIMITIVE VOCABULARY (for taste and compatibility, not a raw catalog UI):",
    primitiveDigest(),
    "",
    knowledgeSection(retrieved.hits),
    "",
    "SOURCE PATHS FOR DEEPER LOCAL READING:",
    `- ${path.join(root, "FORGE.md")}`,
    `- ${path.join(root, "MOTION_CATEGORIES.md")}`,
    `- ${path.join(root, "MOTION_RESEARCH.md")}`,
    `- ${path.join(root, "apps", "forge", "src", "createDraft.ts")}`,
    `- ${path.join(root, "apps", "forge", "src", "export.ts")}`,
    `- ${path.join(root, "packages", "core", "src", "registry", "extensionBundle.ts")}`,
    `- ${path.join(input.knowledgeDir, "source", "gsap")}`,
    "",
    componentSection(input.components ?? [], new Set(input.currentDraft?.components ?? [])),
    "",
    mediaSection(input.media ?? [], input.docs ?? [], input.inlineMediaBytes),
    "",
    currentDraftSection(input.currentDraft),
    "",
    errorSection(input.currentErrors),
    "",
    "USER REQUEST:",
    input.message.trim(),
  ].filter((line) => line !== "").join("\n");
  return { prompt, intent: retrieved.intent, hits: retrieved.hits };
}
