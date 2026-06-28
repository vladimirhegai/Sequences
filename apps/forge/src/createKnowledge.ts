import fs from "node:fs";
import path from "node:path";
import type { CreateRoute } from "./createDraft.ts";
import type { ForgeObject } from "./objects.ts";
import type { StageDocRef, StageMediaRef } from "./stagePrompt.ts";

export interface CreateIntent {
  route: CreateRoute;
  primitiveKind: "enter" | "exit" | "emphasis" | "continuous";
  subjects: string[];
  actions: string[];
  techniques: string[];
  risk: "low" | "medium" | "high";
}

export interface CreateKnowledgeHit {
  title: string;
  file: string;
  why: string;
  text: string;
  score: number;
}

export interface RetrieveCreateKnowledgeInput {
  message: string;
  components?: ForgeObject[];
  media?: StageMediaRef[];
  docs?: StageDocRef[];
  currentErrors?: string[];
  knowledgeDir: string;
  maxHits?: number;
}

interface CandidateFile {
  rel: string;
  title: string;
  routes: CreateRoute[];
  tags: string[];
  base?: number;
}

const ROUTE_KEYWORDS: Record<CreateRoute, string[]> = {
  "interface-reveal": [
    "dashboard",
    "table",
    "panel",
    "settings",
    "card",
    "list",
    "grid",
    "interface",
    "reveal",
    "cascade",
    "enter",
  ],
  "micro-interaction": [
    "hover",
    "press",
    "click",
    "tap",
    "focus",
    "select",
    "toggle",
    "tooltip",
    "toast",
    "interaction",
    "cursor",
  ],
  "data-moment": [
    "metric",
    "kpi",
    "number",
    "count",
    "chart",
    "graph",
    "bar",
    "line",
    "progress",
    "gauge",
    "data",
  ],
  "brand-sting": ["logo", "wordmark", "brand", "lockup", "cta", "tagline", "icon", "sting", "mark"],
  "transition-bridge": ["transition", "morph", "state", "before", "after", "flip", "bridge", "handoff", "scene"],
  "media-frame": ["screenshot", "photo", "video", "image", "device", "phone", "laptop", "browser", "caption", "media"],
};

const TECHNIQUE_KEYWORDS: Record<string, string[]> = {
  fade: ["fade", "opacity", "crossfade"],
  slide: ["slide", "x", "y", "translate", "move"],
  mask: ["mask", "clip", "wipe", "reveal"],
  scale: ["scale", "zoom", "pop", "lift"],
  blur: ["blur", "focus", "soft"],
  "rotate-3d": ["rotate", "3d", "tilt", "perspective", "arc"],
  stagger: ["stagger", "cascade", "sequence", "rows", "cards", "items"],
  path: ["path", "draw", "line", "stroke", "route"],
  morph: ["morph", "flip", "layout", "transform"],
  parallax: ["parallax", "depth", "camera"],
  spring: ["spring", "bounce", "settle", "elastic"],
  split: ["split", "word", "char", "line", "type"],
  counter: ["counter", "count", "number", "metric", "kpi"],
  scroll: ["scroll", "page", "below", "offscreen"],
};

const ACTION_KEYWORDS: Record<string, string[]> = {
  reveal: ["reveal", "enter", "arrive", "intro", "appear"],
  dismiss: ["dismiss", "exit", "leave", "remove", "outro"],
  emphasize: ["emphasize", "highlight", "focus", "spotlight", "attention"],
  transform: ["transform", "morph", "flip", "become", "state"],
  transition: ["transition", "bridge", "handoff", "scene"],
  demonstrate: ["demonstrate", "tour", "click", "tap", "type", "drag", "cursor"],
  quantify: ["quantify", "count", "number", "metric", "chart", "progress"],
  assemble: ["assemble", "compose", "build", "lockup", "together"],
  sequence: ["sequence", "cascade", "stagger", "populate", "stream"],
  orbit: ["orbit", "carousel", "cycle", "loop", "gallery"],
  sustain: ["sustain", "idle", "ambient", "hold", "alive"],
};

const CANDIDATES: CandidateFile[] = [
  {
    rel: "FORGE.md",
    title: "Forge Create architecture",
    routes: ["interface-reveal", "micro-interaction", "data-moment", "brand-sting", "transition-bridge", "media-frame"],
    tags: ["create", "extension", "draft", "stage", "component", "hyperframes", "export", "validation", "aspect"],
    base: 6,
  },
  {
    rel: "MOTION_CATEGORIES.md",
    title: "Motion taxonomy",
    routes: ["interface-reveal", "micro-interaction", "data-moment", "brand-sting", "transition-bridge", "media-frame"],
    tags: ["taxonomy", "subject", "action", "technique", "style", "dashboard", "phone", "metric", "logo", "search"],
    base: 5,
  },
  {
    rel: "MOTION_RESEARCH.md",
    title: "Motion research principles",
    routes: ["interface-reveal", "micro-interaction", "data-moment", "brand-sting", "transition-bridge", "media-frame"],
    tags: ["hierarchy", "motion", "transform", "opacity", "timing", "easing", "reduced-motion", "typography"],
    base: 4,
  },
  {
    rel: "CLAUDE.md",
    title: "Sequences engine laws",
    routes: ["interface-reveal", "micro-interaction", "data-moment", "brand-sting", "transition-bridge", "media-frame"],
    tags: ["token", "compiler", "validation", "registry", "extension", "primitive", "hyperframes"],
    base: 3,
  },
  {
    rel: "apps/forge/src/lift.ts",
    title: "GSAP lift constraints",
    routes: ["interface-reveal", "micro-interaction", "data-moment", "brand-sting", "media-frame"],
    tags: ["gsap", "lift", "fromto", "timeline", "token", "duration", "ease", "skeleton"],
    base: 5,
  },
  {
    rel: "apps/forge/src/export.ts",
    title: "Forge export bundle path",
    routes: ["interface-reveal", "micro-interaction", "data-moment", "brand-sting", "transition-bridge", "media-frame"],
    tags: ["export", "seqext", "bundle", "slots", "placeholder", "validation", "manifest"],
    base: 4,
  },
  {
    rel: "apps/forge/src/standardize.ts",
    title: "Media slot standardization",
    routes: ["media-frame", "interface-reveal"],
    tags: ["media", "slot", "placeholder", "standardize", "image", "video", "export"],
    base: 3,
  },
  {
    rel: "packages/core/src/registry/extensionBundle.ts",
    title: "Extension bundle schema",
    routes: ["interface-reveal", "micro-interaction", "data-moment", "brand-sting", "transition-bridge", "media-frame"],
    tags: ["seqext", "manifest", "spec", "skeleton", "steptemplate", "primitivekind", "validatebundle"],
    base: 4,
  },
  {
    rel: "packages/core/test/extensionBundle.test.ts",
    title: "Extension validation failure cases",
    routes: ["interface-reveal", "micro-interaction", "data-moment", "brand-sting", "transition-bridge", "media-frame"],
    tags: ["validatebundle", "undefined", "identifier", "preview", "install", "compile"],
  },
  {
    rel: "packages/core/test/stepTemplate.test.ts",
    title: "StepTemplate examples",
    routes: ["interface-reveal", "micro-interaction", "data-moment", "brand-sting", "media-frame"],
    tags: ["steptemplate", "skeleton", "fromto", "custom", "token", "countup", "charcascade"],
  },
  {
    rel: "apps/forge/knowledge/source/animations.md",
    title: "Animation craft notes",
    routes: ["interface-reveal", "micro-interaction", "data-moment", "brand-sting"],
    tags: ["stagger", "hover", "press", "enter", "exit", "interruptible", "icon", "scale"],
    base: 3,
  },
  {
    rel: "apps/forge/knowledge/source/gsap-stage.md",
    title: "Forge GSAP usage",
    routes: ["interface-reveal", "micro-interaction", "data-moment", "brand-sting", "media-frame"],
    tags: ["gsap", "timeline", "transform", "opacity", "actions", "reduced-motion"],
    base: 3,
  },
  {
    rel: "apps/forge/knowledge/source/performance.md",
    title: "Performance guidance",
    routes: ["interface-reveal", "micro-interaction", "data-moment", "brand-sting", "transition-bridge", "media-frame"],
    tags: ["performance", "transform", "opacity", "layout", "fps", "jank"],
  },
  {
    rel: "apps/forge/knowledge/source/gsap/gsap-core.md",
    title: "Official GSAP core",
    routes: ["interface-reveal", "micro-interaction", "data-moment", "brand-sting", "media-frame"],
    tags: ["gsap", "to", "from", "fromto", "ease", "stagger", "transform", "opacity"],
  },
  {
    rel: "apps/forge/knowledge/source/gsap/gsap-timeline.md",
    title: "Official GSAP timeline",
    routes: ["interface-reveal", "micro-interaction", "data-moment", "brand-sting", "media-frame"],
    tags: ["timeline", "position", "sequence", "label", "playback", "stagger"],
    base: 2,
  },
  {
    rel: "apps/forge/knowledge/source/gsap/gsap-performance.md",
    title: "Official GSAP performance",
    routes: ["interface-reveal", "micro-interaction", "data-moment", "brand-sting", "media-frame"],
    tags: ["performance", "transform", "opacity", "will-change", "smooth", "jank"],
  },
  {
    rel: "apps/forge/knowledge/source/gsap/gsap-plugins.md",
    title: "Official GSAP plugins",
    routes: ["transition-bridge", "brand-sting", "data-moment"],
    tags: ["flip", "splittext", "morphsvg", "drawsvg", "motionpath", "plugin", "text"],
  },
  {
    rel: "apps/forge/knowledge/source/gsap/gsap-scrolltrigger.md",
    title: "Official GSAP ScrollTrigger",
    routes: ["transition-bridge", "media-frame", "interface-reveal"],
    tags: ["scroll", "pin", "scrub", "parallax", "scrolltrigger"],
  },
  // HyperFrames substrate snapshot (apps/forge/knowledge/source/hyperframes/,
  // provenance in that dir's NOTICE.md). This is the authoring contract Create's
  // skeletons must honor — the single biggest source of "renders but is wrong"
  // failures, so these rank high for any composition/timeline/determinism query.
  {
    rel: "apps/forge/knowledge/source/hyperframes/hf-authoring-contract.md",
    title: "HyperFrames authoring contract",
    routes: ["interface-reveal", "micro-interaction", "data-moment", "brand-sting", "transition-bridge", "media-frame"],
    tags: ["hyperframes", "composition", "timeline", "paused", "duration", "determinism", "clip", "track", "skeleton", "root"],
    base: 6,
  },
  {
    rel: "apps/forge/knowledge/source/hyperframes/hf-determinism-rules.md",
    title: "HyperFrames determinism rules",
    routes: ["interface-reveal", "micro-interaction", "data-moment", "brand-sting", "transition-bridge", "media-frame"],
    tags: ["determinism", "seek", "repeat", "random", "allowlist", "transform", "opacity", "layout", "reduced-motion"],
    base: 4,
  },
  {
    rel: "apps/forge/knowledge/source/hyperframes/hf-data-attributes.md",
    title: "HyperFrames data attributes",
    routes: ["interface-reveal", "micro-interaction", "data-moment", "brand-sting", "transition-bridge", "media-frame"],
    tags: ["timing", "duration", "track", "z-order", "composition", "clip", "media", "attribute"],
    base: 4,
  },
  {
    rel: "apps/forge/knowledge/source/hyperframes/hf-compositions.md",
    title: "HyperFrames composition structure",
    routes: ["interface-reveal", "transition-bridge", "media-frame", "brand-sting"],
    tags: ["composition", "nested", "sub-composition", "variables", "root", "structure"],
    base: 2,
  },
  {
    rel: "apps/forge/knowledge/source/hyperframes/hf-gsap.md",
    title: "HyperFrames GSAP runtime",
    routes: ["interface-reveal", "micro-interaction", "data-moment", "brand-sting", "media-frame"],
    tags: ["gsap", "timeline", "paused", "fromto", "position", "opacity", "transform"],
    base: 2,
  },
  {
    rel: "apps/forge/knowledge/source/hyperframes/hf-common-mistakes.md",
    title: "HyperFrames common mistakes",
    routes: ["interface-reveal", "micro-interaction", "data-moment", "brand-sting", "transition-bridge", "media-frame"],
    tags: ["mistake", "video", "audio", "duration", "blank", "debug", "linter", "wrapper", "repair"],
    base: 3,
  },
  {
    rel: "apps/forge/knowledge/source/hyperframes/hf-motion-techniques.md",
    title: "HyperFrames visual techniques",
    routes: ["interface-reveal", "data-moment", "brand-sting", "transition-bridge", "media-frame"],
    tags: ["technique", "draw", "path", "kinetic", "typography", "mask", "clip-path", "3d", "motionpath", "counter", "reveal", "split", "typing", "lottie", "shader"],
    base: 4,
  },
];

const STOP = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "into",
  "make",
  "build",
  "create",
  "motion",
  "snippet",
  "component",
  "extension",
  "please",
  "using",
]);

const cache = new Map<string, { intent: CreateIntent; hits: CreateKnowledgeHit[] }>();

function queryHash(value: string): string {
  let hash = 2166136261;
  for (const char of value) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function repoRootFromKnowledgeDir(knowledgeDir: string): string {
  return path.resolve(knowledgeDir, "..", "..", "..");
}

function readMaybe(file: string): string | null {
  try {
    return fs.existsSync(file) && fs.statSync(file).isFile() ? fs.readFileSync(file, "utf8") : null;
  } catch {
    return null;
  }
}

function tokenize(input: string): string[] {
  return [
    ...new Set(
      input
        .toLowerCase()
        .match(/[a-z0-9][a-z0-9-]{2,}/g)
        ?.filter((word) => !STOP.has(word)) ?? [],
    ),
  ];
}

function stripFrontmatter(markdown: string): string {
  const md = markdown.replace(/^\uFEFF/, "");
  if (!/^---\s*\n/.test(md)) return md;
  const end = md.indexOf("\n---", 4);
  if (end === -1) return md;
  const after = md.indexOf("\n", end + 1);
  return after === -1 ? "" : md.slice(after + 1);
}

function splitSections(markdown: string): Array<{ title: string; text: string }> {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const sections: Array<{ title: string; text: string[] }> = [];
  let current: { title: string; text: string[] } = { title: "Overview", text: [] };
  for (const line of lines) {
    const heading = /^(#{1,3})\s+(.+?)\s*$/.exec(line);
    if (heading && current.text.join("\n").trim()) {
      sections.push(current);
      current = { title: heading[2] ?? "Section", text: [line] };
    } else if (heading) {
      current.title = heading[2] ?? "Section";
      current.text.push(line);
    } else {
      current.text.push(line);
    }
  }
  if (current.text.join("\n").trim()) sections.push(current);
  return sections.map((section) => ({ title: section.title, text: section.text.join("\n").trim() }));
}

function trimForPrompt(text: string, max = 1200): string {
  const clean = text.replace(/\n{3,}/g, "\n\n").trim();
  if (clean.length <= max) return clean;
  const clipped = clean.slice(0, max);
  const lastBreak = Math.max(clipped.lastIndexOf("\n\n"), clipped.lastIndexOf(". "));
  return `${clipped.slice(0, lastBreak > 420 ? lastBreak + 1 : max).trim()}\n[...]`;
}

function queryText(input: RetrieveCreateKnowledgeInput): string {
  return [
    input.message,
    ...(input.components ?? []).map((component) =>
      [
        component.name,
        component.components.join(" "),
        component.variables.map((knob) => `${knob.name} ${knob.type}`).join(" "),
        component.actions.map((action) => `${action.name} ${action.affects ?? ""}`).join(" "),
      ].join(" "),
    ),
    ...(input.media ?? []).map((media) => `${media.label} ${media.kind}`),
    ...(input.docs ?? []).map((doc) => `${doc.label} ${doc.text.slice(0, 1000)}`),
    ...(input.currentErrors ?? []),
  ].join("\n");
}

function scoreKeywordGroup(query: string, group: string[]): number {
  let score = 0;
  for (const term of group) if (query.includes(term)) score += 1;
  return score;
}

function topMatches(groups: Record<string, string[]>, query: string, limit: number): string[] {
  return Object.entries(groups)
    .map(([name, terms]) => ({ name, score: scoreKeywordGroup(query, terms) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map((item) => item.name);
}

export function classifyCreateIntent(input: {
  message: string;
  components?: ForgeObject[];
  media?: StageMediaRef[];
  currentErrors?: string[];
}): CreateIntent {
  const query = [
    input.message,
    ...(input.components ?? []).map((component) => `${component.name} ${component.components.join(" ")}`),
    ...(input.media ?? []).map((media) => `${media.label} ${media.kind}`),
    ...(input.currentErrors ?? []),
  ].join("\n").toLowerCase();
  let route: CreateRoute = "interface-reveal";
  let routeScore = -1;
  for (const [candidate, terms] of Object.entries(ROUTE_KEYWORDS) as Array<[CreateRoute, string[]]>) {
    const score = scoreKeywordGroup(query, terms);
    if (score > routeScore) {
      route = candidate;
      routeScore = score;
    }
  }
  const actions = topMatches(ACTION_KEYWORDS, query, 3);
  const techniques = topMatches(TECHNIQUE_KEYWORDS, query, 4);
  const subjects = topMatches(
    {
      dashboard: ["dashboard", "analytics", "admin"],
      "kpi-tile": ["kpi", "metric", "number"],
      chart: ["chart", "graph", "line", "bar"],
      search: ["search", "command", "filter"],
      toast: ["toast", "notification", "alert"],
      card: ["card", "deck", "tile"],
      phone: ["phone", "mobile", "reel"],
      logo: ["logo", "wordmark", "brand"],
      media: ["screenshot", "image", "photo", "video"],
      type: ["headline", "word", "text", "title"],
    },
    query,
    3,
  );
  let primitiveKind: CreateIntent["primitiveKind"] = "enter";
  if (actions.includes("quantify") || techniques.includes("counter") || /\b(kpi|metric|count|chart|graph|progress|gauge)\b/.test(query)) {
    route = "data-moment";
  } else if (actions.some((action) => action === "demonstrate" || action === "emphasize") && /\b(hover|click|tap|focus|toggle|press|cursor)\b/.test(query)) {
    route = "micro-interaction";
  } else if (actions.some((action) => action === "transition" || action === "transform")) {
    route = "transition-bridge";
  }
  if (actions.includes("dismiss")) primitiveKind = "exit";
  else if (actions.some((action) => action === "emphasize" || action === "demonstrate")) primitiveKind = "emphasis";
  else if (actions.some((action) => action === "orbit" || action === "sustain")) primitiveKind = "continuous";
  const highRisk = /\b(scroll|morph|flip|3d|camera|transition|video|multi|several|storyboard|repair|error|validation)\b/.test(query);
  const mediumRisk = /\b(gsap|timeline|stagger|chart|number|action|knob|component|image)\b/.test(query);
  return {
    route,
    primitiveKind,
    subjects,
    actions,
    techniques,
    risk: highRisk ? "high" : mediumRisk ? "medium" : "low",
  };
}

function scoreSection(
  section: { title: string; text: string },
  candidate: CandidateFile,
  query: string,
  terms: string[],
  intent: CreateIntent,
): number {
  const hay = `${section.title}\n${section.text}`.toLowerCase();
  const tagSet = new Set(candidate.tags);
  let score = candidate.base ?? 0;
  if (candidate.routes.includes(intent.route)) score += 8;
  for (const tag of candidate.tags) {
    if (query.includes(tag)) score += 8;
    if (hay.includes(tag)) score += 1;
  }
  for (const routeTerm of ROUTE_KEYWORDS[intent.route]) {
    if (hay.includes(routeTerm)) score += 1;
  }
  for (const term of terms) {
    if (section.title.toLowerCase().includes(term)) score += 4;
    if (hay.includes(term)) score += 1;
  }
  // Technique → deep-skill affinity: route the request's mechanisms to the skill
  // file that actually documents them (scroll → ScrollTrigger, morph/flip → Flip,
  // split → SplitText, draw/path → Draw/MotionPath). A technique whose synonyms
  // appear in a candidate's tags is a strong, specific match — stronger than a
  // loose mention in body text.
  for (const technique of intent.techniques) {
    if (hay.includes(technique)) score += 3;
    for (const synonym of TECHNIQUE_KEYWORDS[technique] ?? []) {
      if (tagSet.has(synonym)) {
        score += 6;
        break;
      }
    }
  }
  for (const action of intent.actions) {
    if (hay.includes(action)) score += 3;
  }
  if (intent.risk === "high" && /validation|schema|bundle|scroll|plugin|performance|stepTemplate/i.test(candidate.rel)) score += 5;
  return score;
}

function whyFor(candidate: CandidateFile, intent: CreateIntent, query: string): string {
  const reasons: string[] = [];
  if (candidate.routes.includes(intent.route)) reasons.push(`route:${intent.route}`);
  for (const tag of candidate.tags) {
    if (query.includes(tag)) reasons.push(tag);
    if (reasons.length >= 3) break;
  }
  if (!reasons.length) reasons.push(candidate.title);
  return reasons.join(", ");
}

export function retrieveCreateKnowledge(input: RetrieveCreateKnowledgeInput): { intent: CreateIntent; hits: CreateKnowledgeHit[] } {
  const query = queryText(input).toLowerCase();
  const intent = classifyCreateIntent({
    message: input.message,
    components: input.components,
    media: input.media,
    currentErrors: input.currentErrors,
  });
  const key = JSON.stringify({
    route: intent.route,
    query: queryHash(query),
    components: (input.components ?? []).map((component) => component.id).sort(),
    errors: input.currentErrors ?? [],
  });
  const cached = cache.get(key);
  if (cached) return cached;

  const root = repoRootFromKnowledgeDir(input.knowledgeDir);
  const terms = tokenize(query);
  const hits: CreateKnowledgeHit[] = [];
  for (const candidate of CANDIDATES) {
    const file = path.join(root, candidate.rel);
    const raw = readMaybe(file);
    if (!raw) continue;
    for (const section of splitSections(stripFrontmatter(raw))) {
      const score = scoreSection(section, candidate, query, terms, intent);
      if (score <= 0) continue;
      hits.push({
        title: section.title === "Overview" ? candidate.title : section.title,
        file,
        why: whyFor(candidate, intent, query),
        text: trimForPrompt(section.text),
        score,
      });
    }
  }

  const picked: CreateKnowledgeHit[] = [];
  const seen = new Set<string>();
  const perFile = new Map<string, number>();
  for (const hit of hits.sort((a, b) => b.score - a.score)) {
    if (picked.length >= (input.maxHits ?? 8)) break;
    const key = `${hit.file}:${hit.title}`;
    if (seen.has(key)) continue;
    if ((perFile.get(hit.file) ?? 0) >= 2) continue;
    picked.push(hit);
    seen.add(key);
    perFile.set(hit.file, (perFile.get(hit.file) ?? 0) + 1);
  }
  const result = { intent, hits: picked };
  cache.set(key, result);
  return result;
}
