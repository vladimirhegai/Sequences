import { describe, expect, it } from "vitest";
import path from "node:path";
import { retrieveStageKnowledge } from "../src/stageKnowledge.ts";

const KNOWLEDGE = path.resolve(import.meta.dirname, "..", "knowledge");

describe("Stage knowledge retrieval", () => {
  it("retrieves official GSAP React/timeline guidance for React GSAP prompts", () => {
    const hits = retrieveStageKnowledge({
      message: "Build a React SaaS dashboard with GSAP timeline polish and cleanup on unmount",
      knowledgeDir: KNOWLEDGE,
      maxHits: 8,
    });

    const files = hits.map((hit) => hit.file.replace(/\\/g, "/"));
    expect(files.some((file) => file.endsWith("source/gsap/gsap-react.md"))).toBe(true);
    expect(files.some((file) => file.endsWith("source/gsap/gsap-timeline.md"))).toBe(true);
    expect(hits.map((hit) => hit.text).join("\n")).toMatch(/gsap\.context|useGSAP|timeline/i);
  });

  it("routes ScrollTrigger/plugin requests to the narrower official skills", () => {
    const hits = retrieveStageKnowledge({
      message: "Use ScrollTrigger pinning, scrub, and SplitText for a scroll-driven product page",
      knowledgeDir: KNOWLEDGE,
      maxHits: 8,
    });

    const files = hits.map((hit) => hit.file.replace(/\\/g, "/"));
    expect(files.some((file) => file.endsWith("source/gsap/gsap-scrolltrigger.md"))).toBe(true);
    expect(files.some((file) => file.endsWith("source/gsap/gsap-plugins.md"))).toBe(true);
  });

  it("pulls the anti-slop design skills for a plain UI brief", () => {
    const hits = retrieveStageKnowledge({
      message: "design a clean settings dashboard",
      knowledgeDir: KNOWLEDGE,
      maxHits: 6,
    });
    const files = hits.map((hit) => hit.file.replace(/\\/g, "/"));
    expect(files.some((file) => file.endsWith("source/impeccable-SKILL.md"))).toBe(true);
  });

  it("routes explicit shadcn/component asks to the shadcn skill", () => {
    const hits = retrieveStageKnowledge({
      message: "build a shadcn button and card with an input",
      knowledgeDir: KNOWLEDGE,
      maxHits: 6,
    });
    expect(hits[0]!.file.replace(/\\/g, "/")).toContain("source/shadcn-stage.md");
  });

  it("does not surface YAML frontmatter or harness-only Setup/Commands sections", () => {
    const hits = retrieveStageKnowledge({
      message: "design a polished accessible interface with good contrast and hierarchy",
      knowledgeDir: KNOWLEDGE,
      maxHits: 8,
    });
    const titles = hits.map((hit) => hit.title.toLowerCase());
    expect(titles).not.toContain("setup");
    expect(titles).not.toContain("commands");
    // frontmatter `name:`/`description:` lines never leak into a hit body
    expect(hits.every((hit) => !/^---/.test(hit.text.trim()))).toBe(true);
  });
});
