import fs from "node:fs";
import path from "node:path";
import type { StageAssetSource, StageDocRef, StageMediaRef } from "./stagePrompt.ts";

export interface StageKnowledgeHit {
  title: string;
  file: string;
  text: string;
  score: number;
}

export interface RetrieveStageKnowledgeInput {
  message: string;
  current?: StageAssetSource | null;
  media?: StageMediaRef[];
  docs?: StageDocRef[];
  knowledgeDir: string;
  maxHits?: number;
}

interface CandidateFile {
  rel?: string;
  file?: string;
  name?: string;
  tags: string[];
  base?: number;
  official?: boolean;
}

const CANDIDATES: CandidateFile[] = [
  {
    rel: "stage-ui-design.md",
    base: 4,
    tags: ["stage", "design", "saas", "interface", "dashboard", "search", "component", "hyperframes"],
  },
  // The design-quality skills. These carry the anti-slop judgement that makes
  // even cheap models produce good UI, so they keep a small `base` and surface
  // for almost any build (design-intent route below boosts them further).
  {
    rel: "source/impeccable-SKILL.md",
    base: 3,
    tags: [
      "design",
      "ui",
      "interface",
      "contrast",
      "hierarchy",
      "typography",
      "spacing",
      "color",
      "layout",
      "polish",
      "accessibility",
      "dashboard",
      "form",
      "settings",
      "tokens",
    ],
  },
  {
    rel: "source/make-interfaces-feel-better-SKILL.md",
    base: 2,
    tags: ["polish", "detail", "shadow", "radius", "hover", "micro-interaction", "alignment", "feel", "design"],
  },
  {
    rel: "source/design-taste-frontend-SKILL.md",
    base: 2,
    tags: ["design", "taste", "anti-slop", "landing", "brand", "redesign", "direction", "hero", "marketing"],
  },
  {
    rel: "source/shadcn-stage.md",
    base: 2,
    tags: [
      "shadcn",
      "tailwind",
      "component",
      "button",
      "card",
      "input",
      "dialog",
      "table",
      "badge",
      "tabs",
      "token",
      "ui",
      "radix",
    ],
  },
  { rel: "source/react-stage.md", tags: ["react", "jsx", "tsx", "state", "hook", "component"] },
  { rel: "source/gsap-stage.md", tags: ["gsap", "timeline", "animation", "animate", "interaction", "motion"] },
  { rel: "source/animations.md", tags: ["animation", "motion", "transition", "hover", "action", "interaction"] },
  { rel: "source/typography.md", tags: ["type", "font", "typography", "heading", "copy"] },
  { rel: "source/surfaces.md", tags: ["surface", "card", "depth", "radius", "shadow", "layout"] },
  { rel: "source/performance.md", tags: ["performance", "perf", "fast", "render", "browser"] },
];

/**
 * Section titles dropped from any candidate: Forge has no `.agents/...` skill
 * scripts, so a skill's `## Setup` instructions are noise that would only burn
 * tokens. The design guidance sections are what we want.
 */
const SKIP_SECTION_TITLES = new Set([
  "setup",
  "install",
  "installation",
  // impeccable's own harness scaffolding (sub-commands / pin / hooks) — these
  // reference `reference/*.md` files that don't exist in Forge.
  "commands",
  "routing rules",
  "pin / unpin",
  "hooks",
]);

const OFFICIAL_GSAP_SKILLS: Array<{ dir: string; tags: string[] }> = [
  {
    dir: "gsap-core",
    tags: [
      "gsap",
      "core",
      "tween",
      "to",
      "from",
      "fromto",
      "ease",
      "stagger",
      "transform",
      "autoalpha",
      "matchmedia",
      "reduced-motion",
    ],
  },
  {
    dir: "gsap-timeline",
    tags: ["gsap", "timeline", "sequence", "sequencing", "position", "label", "playback", "choreograph"],
  },
  {
    dir: "gsap-react",
    tags: ["gsap", "react", "jsx", "tsx", "usegsap", "context", "cleanup", "ref", "effect", "next"],
  },
  {
    dir: "gsap-performance",
    tags: ["gsap", "performance", "fps", "jank", "transform", "opacity", "will-change", "quickto", "stagger"],
  },
  {
    dir: "gsap-scrolltrigger",
    tags: ["gsap", "scrolltrigger", "scroll", "pin", "scrub", "parallax", "refresh", "scroll-driven"],
  },
  {
    dir: "gsap-plugins",
    tags: [
      "gsap",
      "plugin",
      "plugins",
      "flip",
      "draggable",
      "splittext",
      "scrambletext",
      "morphsvg",
      "drawsvg",
      "motionpath",
      "customease",
      "scrollto",
    ],
  },
  {
    dir: "gsap-utils",
    tags: ["gsap", "utils", "clamp", "maprange", "normalize", "interpolate", "random", "snap", "toarray", "selector"],
  },
  {
    dir: "gsap-frameworks",
    tags: ["gsap", "vue", "svelte", "nuxt", "sveltekit", "framework", "lifecycle", "cleanup", "context"],
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
  "asset",
  "component",
  "please",
  "using",
  "about",
  "what",
]);

function officialGsapRoot(knowledgeDir: string): string {
  return path.join(knowledgeDir, "source", "gsap");
}

function candidatesFor(knowledgeDir: string): CandidateFile[] {
  const officialRoot = officialGsapRoot(knowledgeDir);
  const official = OFFICIAL_GSAP_SKILLS.map((skill) => ({
    file: path.join(officialRoot, `${skill.dir}.md`),
    name: `official:${skill.dir}`,
    tags: skill.tags,
    base: 1,
    official: true,
  }));
  return [...CANDIDATES, ...official];
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

/** Drop a leading YAML frontmatter block (`--- … ---`) — keyword noise, not guidance. */
function stripFrontmatter(markdown: string): string {
  const md = markdown.replace(/^﻿/, "");
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

function sourceForQuery(input: RetrieveStageKnowledgeInput): string {
  const current = input.current;
  const react = typeof current?.react === "object" ? current.react.tsx : typeof current?.react === "string" ? current.react : "";
  return [
    input.message,
    current?.name ?? "",
    current?.html?.slice(0, 1000) ?? "",
    current?.css?.slice(0, 1000) ?? "",
    current?.js?.slice(0, 1000) ?? "",
    react?.slice(0, 1000) ?? "",
    ...(input.docs ?? []).map((doc) => `${doc.label} ${doc.text.slice(0, 1000)}`),
    ...(input.media ?? []).map((media) => `${media.label} ${media.kind}`),
  ].join("\n");
}

function scoreSection(section: { title: string; text: string }, candidate: CandidateFile, query: string, terms: string[]): number {
  const hay = `${section.title}\n${section.text}`.toLowerCase();
  let score = candidate.base ?? 0;
  for (const tag of candidate.tags) {
    if (query.includes(tag)) score += 8;
    if (hay.includes(tag)) score += 1;
  }
  for (const term of terms) {
    if (section.title.toLowerCase().includes(term)) score += 5;
    if (hay.includes(term)) score += 1;
  }
  const id = `${candidate.rel ?? ""} ${candidate.file ?? ""} ${candidate.name ?? ""}`.toLowerCase();
  if (/\breact|jsx|tsx|hook|state\b/.test(query) && id.includes("react")) score += 18;
  if (/\bgsap|timeline|stagger|scrub|scrolltrigger\b/.test(query) && id.includes("gsap")) score += 18;
  if (/\banimat|motion|hover|press|menu|drawer|open|toggle\b/.test(query) && id.includes("animations")) score += 8;

  // Design-quality route: when the brief is about building/improving an interface,
  // pull the anti-slop design skills (impeccable / make-interfaces / design-taste).
  const isDesignSkill = /impeccable|make-interfaces|design-taste/.test(id);
  if (
    isDesignSkill &&
    /\b(design|ui|interface|dashboard|card|hero|landing|pricing|settings|onboarding|panel|form|polish|contrast|hierarchy|spacing|layout|redesign|beautiful|clean|aesthetic|typography|palette|colou?r)\b/.test(
      query,
    )
  ) {
    score += id.includes("impeccable") ? 12 : 8;
  }

  // Shadcn route: explicit shadcn/tailwind/radix asks route hard to the shadcn
  // skill; generic component nouns route there softly (shadcn is a good default).
  if (id.includes("shadcn")) {
    if (/\b(shadcn|tailwind|radix)\b/.test(query)) score += 24;
    else if (/\b(button|card|input|dialog|sheet|badge|table|tabs|tooltip|dropdown|popover|toast|sidebar|component)\b/.test(query)) {
      score += 10;
    }
  }
  if (candidate.official && /\bgsap|timeline|stagger|scrolltrigger|splittext|flip|draggable|motionpath|morphsvg|drawsvg|scrambletext|customease\b/.test(query)) {
    score += 10;
  }
  if (candidate.official && /\bscroll|pin|scrub|parallax\b/.test(query) && id.includes("scrolltrigger")) score += 24;
  if (candidate.official && /\bplugin|splittext|flip|draggable|svg|morph|draw|scramble|motionpath|customease\b/.test(query) && id.includes("plugins")) score += 24;
  if (candidate.official && /\butils?|clamp|maprange|normalize|snap|toarray|selector\b/.test(query) && id.includes("utils")) score += 24;
  if (candidate.official && /\btimeline|sequence|sequencing|choreograph|stagger\b/.test(query) && id.includes("timeline")) score += 18;
  if (candidate.official && /\bperformance|fps|jank|smooth|60fps\b/.test(query) && id.includes("performance")) score += 18;
  return score;
}

function trimForPrompt(text: string, max = 1100): string {
  const clean = text.replace(/\n{3,}/g, "\n\n").trim();
  if (clean.length <= max) return clean;
  const clipped = clean.slice(0, max);
  const lastBreak = Math.max(clipped.lastIndexOf("\n\n"), clipped.lastIndexOf(". "));
  return `${clipped.slice(0, lastBreak > 400 ? lastBreak + 1 : max).trim()}\n[...]`;
}

export function retrieveStageKnowledge(input: RetrieveStageKnowledgeInput): StageKnowledgeHit[] {
  const query = sourceForQuery(input).toLowerCase();
  const terms = tokenize(query);
  const hits: StageKnowledgeHit[] = [];
  for (const candidate of candidatesFor(input.knowledgeDir)) {
    const file = candidate.file ?? path.join(input.knowledgeDir, candidate.rel ?? "");
    const raw = readMaybe(file);
    if (!raw) continue;
    for (const section of splitSections(stripFrontmatter(raw))) {
      if (SKIP_SECTION_TITLES.has(section.title.trim().toLowerCase())) continue;
      const score = scoreSection(section, candidate, query, terms);
      if (score <= 0) continue;
      hits.push({
        title: section.title,
        file,
        text: trimForPrompt(section.text),
        score,
      });
    }
  }

  const picked: StageKnowledgeHit[] = [];
  const seenFiles = new Set<string>();
  const perFile = new Map<string, number>();
  for (const hit of hits.sort((a, b) => b.score - a.score)) {
    if (picked.length >= (input.maxHits ?? 6)) break;
    const key = `${hit.file}:${hit.title}`;
    if (seenFiles.has(key)) continue;
    if ((perFile.get(hit.file) ?? 0) >= 2) continue;
    picked.push(hit);
    seenFiles.add(key);
    perFile.set(hit.file, (perFile.get(hit.file) ?? 0) + 1);
  }
  return picked;
}
