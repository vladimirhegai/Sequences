import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { validateBundle, type Asset } from "@sequences/core";
import { ForgeDocument } from "../src/document.ts";
import {
  bundleNameFromDraft,
  currentCreateDraft,
  listCreateDrafts,
  timelineToCompiledMotion,
  timelineToLiftSource,
  upsertCreateDraft,
} from "../src/createDraft.ts";
import { classifyCreateIntent, retrieveCreateKnowledge } from "../src/createKnowledge.ts";
import { critiqueCreateDraft } from "../src/createCritic.ts";
import { liftAndBundleCreateDraft, runCreateChat } from "../src/createRunner.ts";
import { liftGsapSource } from "../src/lift.ts";
import { upsertForgeObject } from "../src/objects.ts";

const KNOWLEDGE = path.resolve(import.meta.dirname, "..", "knowledge");

function tmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "forge-create-"));
}

function mockAsset(hashChar: string, relPath: string, w: number, h: number, kind: Asset["kind"] = "image"): Asset {
  const contentHash = hashChar.repeat(64);
  return {
    id: `asset-${contentHash.slice(0, 16)}`,
    path: relPath,
    kind,
    contentHash,
    metadata: { width: w, height: h, dominantColors: [] },
  };
}

describe("Create drafts", () => {
  it("persists the current draft with a locked aspect and bundle id", () => {
    const dir = tmp();
    const { draft } = upsertCreateDraft(dir, {
      name: "Dashboard Panel Cascade",
      summary: "A polished dashboard panel cascade for SaaS product video.",
      route: "interface-reveal",
      primitiveKind: "enter",
      aspect: "4:5",
      components: ["obj-dashboard"],
      liftSource: 'tl.fromTo(inner,{y:30,opacity:0},{y:0,opacity:1,duration:0.45,ease:"power3.out"},0);',
    });

    expect(draft.aspectLocked).toBe(true);
    expect(bundleNameFromDraft(draft)).toBe("enter.dashboardPanelCascade");
    expect(currentCreateDraft(dir)?.id).toBe(draft.id);
    expect(listCreateDrafts(dir)).toHaveLength(1);
    expect(fs.existsSync(path.join(dir, "create-drafts", draft.id, "draft.json"))).toBe(true);
  });
});

describe("Create knowledge retrieval", () => {
  it("classifies data/dashboard requests and returns clipped context cards", () => {
    const intent = classifyCreateIntent({ message: "Make KPI tiles count up in a dashboard cascade" });
    expect(intent.route).toBe("data-moment");
    expect(intent.primitiveKind).toBe("enter");
    expect(intent.techniques).toContain("counter");

    const retrieved = retrieveCreateKnowledge({
      message: "Make KPI tiles count up in a dashboard cascade",
      knowledgeDir: KNOWLEDGE,
      maxHits: 5,
    });
    expect(retrieved.hits.length).toBeGreaterThan(0);
    expect(retrieved.hits.some((hit) => hit.file.endsWith("MOTION_CATEGORIES.md"))).toBe(true);
  });

  it("surfaces the vendored HyperFrames authoring contract for composition/timeline asks", () => {
    const retrieved = retrieveCreateKnowledge({
      message: "Build a dashboard reveal as a HyperFrames composition with a paused gsap timeline",
      knowledgeDir: KNOWLEDGE,
      maxHits: 8,
    });
    const fromHfSnapshot = retrieved.hits.filter((hit) =>
      hit.file.replace(/\\/g, "/").includes("knowledge/source/hyperframes/"),
    );
    expect(fromHfSnapshot.length).toBeGreaterThan(0);
    expect(
      fromHfSnapshot.some((hit) => hit.file.endsWith("hf-authoring-contract.md")),
    ).toBe(true);
  });
});

describe("Create runner", () => {
  it("builds, validates, lifts, and bundles a component-aware draft", async () => {
    const dir = tmp();
    const doc = ForgeDocument.createBlank(dir);
    const object = upsertForgeObject(dir, {
      name: "Dashboard shell",
      html: '<main data-forge-component="root"><h1 data-forge-component="hero-title">Revenue</h1><button data-forge-action="focus-search">Search</button></main>',
      css: `
        /* @forge-var accent type=color default=#5e6ad2 label="Accent" */
        /* @forge-action focus-search label="Focus search" affects="hero-title" */
      `,
      js: "",
    });

    let sawPrompt = "";
    const result = await runCreateChat({
      message: "Make a dashboard reveal with the title first, then trigger search focus",
      references: [{ kind: "component", id: object.id, label: "@Dashboard shell" }],
      aspect: "16:9",
      doc,
      docDir: dir,
      knowledgeDir: KNOWLEDGE,
      complete: async (prompt) => {
        sawPrompt = prompt;
        return JSON.stringify({
          reply: "Built the reveal.",
          extensionDraft: {
            name: "Dashboard Title Reveal",
            summary: "A crisp dashboard title reveal with a search focus beat.",
            route: "interface-reveal",
            primitiveKind: "enter",
            aspect: "16:9",
            durationSec: 4,
            components: [object.id],
            taxonomy: {
              family: "app-ui",
              subject: "dashboard",
              action: "reveal",
              technique: ["stagger", "slide"],
              energy: "calm",
              style: "mechanical",
            },
            timeline: [
              {
                asset: object.id,
                target: "hero-title",
                op: "fromTo",
                from: { opacity: 0, y: 24 },
                to: { opacity: 1, y: 0 },
                duration: 0.45,
                ease: "power3.out",
                at: 0,
              },
            ],
            actions: [{ asset: object.id, trigger: "focus-search", at: 1.1 }],
            knobs: [{ asset: object.id, name: "accent", value: "#5e6ad2", at: 0 }],
            liftSource: 'tl.fromTo(inner,{y:24,opacity:0},{y:0,opacity:1,duration:0.45,ease:"power3.out"},0);',
          },
        });
      },
    });

    expect(sawPrompt).toContain("LOCKED DELIVERY ASPECT: 16:9");
    expect(sawPrompt).toContain("SELECTED COMPONENTS");
    expect(sawPrompt).toContain("RETRIEVED MOTION / HYPERFRAMES CONTEXT");
    expect(result.ok).toBe(true);
    expect(result.draft?.components).toEqual([object.id]);
    expect(result.draft?.timeline[0]?.target).toBe("hero-title");
    expect(result.bundle && validateBundle(result.bundle).ok).toBe(true);
    expect(result.bundle?.manifest.library?.subject).toBe("dashboard");
  });

  it("returns a permissioned Stage request instead of executing it", async () => {
    const dir = tmp();
    const doc = ForgeDocument.createBlank(dir);
    const result = await runCreateChat({
      message: "Animate a billing settings panel",
      references: [],
      aspect: "9:16",
      doc,
      docDir: dir,
      knowledgeDir: KNOWLEDGE,
      complete: async () =>
        JSON.stringify({
          reply: "I need Stage first.",
          stageRequest: {
            brief: "Build a billing settings panel with invoice rows.",
            aspect: "9:16",
            requiredParts: ["settings-card", "invoice-row-active"],
            requiredActions: ["show-toast"],
          },
        }),
    });

    expect(result.ok).toBe(true);
    expect(result.stageRequest?.brief).toContain("billing");
    expect(result.draft).toBeUndefined();
  });

  it("derives a liftable, valid skeleton from the structured timeline", () => {
    const compiled = timelineToCompiledMotion({
      primitiveKind: "enter",
      timeline: [
        { asset: "o", target: "hero-title", op: "fromTo", from: { opacity: 0, y: 24 }, to: { opacity: 1, y: 0 }, at: 0, duration: 0.45, ease: "power3.out" },
        { asset: "o", target: "results-scroller", op: "to", to: { scrollTop: 240 }, at: 0.6, duration: 0.8 },
      ],
    });
    expect(compiled?.skeleton.length).toBe(2);
    expect(JSON.stringify(compiled?.skeleton)).toContain("$yFromPx");
    expect(JSON.stringify(compiled?.skeleton)).not.toContain("24");
    expect(compiled?.tokens.yFromPx).toBe(24);
    expect(compiled?.tokens.scrollTopToPx).toBe(240);

    const source = timelineToLiftSource({
      primitiveKind: "enter",
      timeline: [
        { asset: "o", target: "hero-title", op: "fromTo", from: { opacity: 0, y: 24 }, to: { opacity: 1, y: 0 }, at: 0, duration: 0.45, ease: "power3.out" },
        { asset: "o", target: "results-scroller", op: "to", to: { scrollTop: 240 }, at: 0.6, duration: 0.8 },
      ],
    });
    expect(source).toContain("tl.fromTo(inner");
    // The y:24 transform comes from the timeline, not a generic default.
    expect(source).toContain('"y":24');
    // A below-the-fold reveal scrolls the container, mapped to $container.
    expect(source).toContain("scrollTop");
    expect(source).toContain("tl.to(container");

    const lift = liftGsapSource(source, { id: "enter.derived", summary: "x", primitiveKind: "enter" });
    expect(lift.skeleton.length).toBe(2);
  });

  it("derives the export motion DNA from the timeline when the agent omits liftSource", async () => {
    const dir = tmp();
    const doc = ForgeDocument.createBlank(dir);
    const object = upsertForgeObject(dir, {
      name: "Metric board",
      html: '<main data-forge-component="root"><h1 data-forge-component="hero-title">Revenue</h1><section data-forge-component="results-scroller" style="overflow-y:auto;height:1400px">rows</section></main>',
      css: "",
      js: "",
    });
    const result = await runCreateChat({
      message: "Reveal the dashboard title then scroll to the results below the fold",
      references: [{ kind: "component", id: object.id }],
      aspect: "16:9",
      doc,
      docDir: dir,
      knowledgeDir: KNOWLEDGE,
      complete: async () =>
        JSON.stringify({
          reply: "Built it.",
          extensionDraft: {
            name: "Dashboard Scroll Reveal",
            summary: "A dashboard title reveal that scrolls to the results section.",
            route: "interface-reveal",
            primitiveKind: "enter",
            durationSec: 4,
            components: [object.id],
            timeline: [
              { asset: object.id, target: "hero-title", op: "fromTo", from: { opacity: 0, y: 24 }, to: { opacity: 1, y: 0 }, at: 0, duration: 0.45, ease: "power3.out" },
              { asset: object.id, target: "results-scroller", op: "to", to: { scrollTop: 320 }, at: 0.7, duration: 0.8 },
            ],
            // no liftSource — the server derives it from the timeline
          },
        }),
    });
    expect(result.ok).toBe(true);
    expect(result.draft?.liftSource).toContain('"y":24');
    expect(result.draft?.liftSource).toContain("scrollTop");
    expect(result.draft?.compiledMotion?.tokens.yFromPx).toBe(24);
    expect(JSON.stringify(result.bundle?.spec.skeleton)).toContain("$yFromPx");
    expect(result.bundle && validateBundle(result.bundle).ok).toBe(true);
  });

  it("compiles a number counter into a token-pure custom skeleton", async () => {
    const dir = tmp();
    const doc = ForgeDocument.createBlank(dir);
    const object = upsertForgeObject(dir, {
      name: "Revenue tile",
      html: '<main data-forge-component="root"><span data-forge-component="metric-value">$0</span></main>',
      css: "",
      js: "",
    });
    const result = await runCreateChat({
      message: "Count the revenue metric up to 1.24M",
      references: [{ kind: "component", id: object.id }],
      aspect: "16:9",
      doc,
      docDir: dir,
      knowledgeDir: KNOWLEDGE,
      complete: async () =>
        JSON.stringify({
          reply: "Built the count-up.",
          extensionDraft: {
            name: "Revenue Metric Count Up",
            summary: "A hero revenue metric that races up to its final value and lands clean.",
            route: "data-moment",
            primitiveKind: "enter",
            durationSec: 3,
            components: [object.id],
            timeline: [
              { asset: object.id, target: "metric-value", op: "count", vars: { value: 1240000, prefix: "$", suffix: "" }, at: 0, duration: 1.4, ease: "power3.out" },
            ],
          },
        }),
    });
    expect(result.ok).toBe(true);
    const custom = result.draft?.compiledMotion?.skeleton.find((s) => s.kind === "custom");
    expect(custom).toBeTruthy();
    expect(JSON.stringify(custom)).toContain("toLocaleString");
    // The literal target value is promoted to a token, not baked into the code.
    expect(Object.values(result.draft?.compiledMotion?.tokens ?? {})).toContain(1240000);
    expect(JSON.stringify(custom)).not.toContain("1240000");
    expect(result.bundle && validateBundle(result.bundle).ok).toBe(true);
  });

  it("keeps current draft component context on iteration and replaces vague art-title names", async () => {
    const dir = tmp();
    const doc = ForgeDocument.createBlank(dir);
    const object = upsertForgeObject(dir, {
      name: "Settings card",
      html: '<main data-forge-component="root"><section data-forge-component="settings-card"><button data-forge-component="delete-button">Delete</button></section></main>',
      css: "",
      js: "",
    });
    const current = upsertCreateDraft(dir, {
      name: "Settings Card Delete Demonstration",
      summary: "A settings card delete demonstration for product motion.",
      route: "micro-interaction",
      primitiveKind: "emphasis",
      aspect: "16:9",
      components: [object.id],
      timeline: [
        { asset: object.id, target: "settings-card", op: "fromTo", from: { opacity: 0, y: 16 }, to: { opacity: 1, y: 0 }, at: 0, duration: 0.4 },
      ],
    }).draft;

    const result = await runCreateChat({
      message: "Make it more premium",
      references: [],
      currentDraft: current,
      aspect: "16:9",
      doc,
      docDir: dir,
      knowledgeDir: KNOWLEDGE,
      complete: async () =>
        JSON.stringify({
          reply: "Refined it.",
          extensionDraft: {
            name: "The Considered Edit",
            summary: "A refined settings card interaction with a delete-account emphasis.",
            durationSec: 4,
            timeline: [
              { asset: object.id, target: "delete-button", op: "fromTo", from: { scale: 0.92, opacity: 0 }, to: { scale: 1, opacity: 1 }, at: 0, duration: 0.35 },
            ],
          },
        }),
    });

    expect(result.ok).toBe(true);
    expect(result.draft?.components).toEqual([object.id]);
    expect(result.draft?.name).toBe("Settings Card Delete Button Emphasis");
    expect(result.draft?.validation.some((issue) => issue.code === "unknown-component" || issue.code === "unknown-part")).toBe(false);
  });

  it("passes storyboard images as native API content instead of prompt-token-heavy base64", async () => {
    const dir = tmp();
    const doc = ForgeDocument.createBlank(dir);
    const asset = mockAsset("e", "assets/frame.png", 1, 1);
    fs.mkdirSync(path.join(doc.dir, "assets"), { recursive: true });
    fs.writeFileSync(path.join(doc.dir, asset.path), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    doc.addAsset(asset);
    let sawPrompt = "";
    let imageCount = 0;

    const result = await runCreateChat({
      message: "Use this as storyboard frame one",
      references: [{ kind: "asset", id: asset.id, label: "@frame" }],
      aspect: "16:9",
      doc,
      docDir: dir,
      knowledgeDir: KNOWLEDGE,
      inlineMediaBytes: true,
      complete: async (prompt, options) => {
        sawPrompt = prompt;
        imageCount = options?.images?.length ?? 0;
        return JSON.stringify({
          reply: "Need a component first.",
          stageRequest: {
            brief: "Build a simple settings card matching the storyboard.",
            aspect: "16:9",
            requiredParts: ["settings-card"],
          },
        });
      },
    });

    expect(result.ok).toBe(true);
    expect(sawPrompt).toContain("native-image-attachment: image/png");
    expect(sawPrompt).not.toContain("base64,");
    expect(imageCount).toBe(1);
  });

  it("choreographs and validates parts across multiple components", async () => {
    const dir = tmp();
    const doc = ForgeDocument.createBlank(dir);
    const card = upsertForgeObject(dir, {
      name: "Plan card",
      html: '<div data-forge-component="card"><h2 data-forge-component="plan-title">Pro</h2></div>',
      css: "",
      js: "",
    });
    const toast = upsertForgeObject(dir, {
      name: "Toast",
      html: '<div data-forge-component="toast">Saved</div>',
      css: "",
      js: "",
    });
    const result = await runCreateChat({
      message: "Reveal the plan card, then pop the toast",
      references: [
        { kind: "component", id: card.id },
        { kind: "component", id: toast.id },
      ],
      aspect: "1:1",
      doc,
      docDir: dir,
      knowledgeDir: KNOWLEDGE,
      complete: async () =>
        JSON.stringify({
          reply: "Built a two-component reveal.",
          extensionDraft: {
            name: "Plan And Toast",
            summary: "A plan card reveal with a confirming toast pop afterwards.",
            route: "interface-reveal",
            primitiveKind: "enter",
            durationSec: 3,
            components: [card.id, toast.id],
            timeline: [
              { asset: card.id, target: "plan-title", op: "fromTo", from: { opacity: 0, y: 16 }, to: { opacity: 1, y: 0 }, at: 0, duration: 0.4 },
              { asset: toast.id, target: "toast", op: "fromTo", from: { opacity: 0, scale: 0.9 }, to: { opacity: 1, scale: 1 }, at: 0.8, duration: 0.3 },
            ],
          },
        }),
    });
    expect(result.ok).toBe(true);
    expect(result.draft?.components).toEqual([card.id, toast.id]);
    expect(result.draft?.validation.some((issue) => issue.code === "unknown-part")).toBe(false);
    expect(result.bundle && validateBundle(result.bundle).ok).toBe(true);
  });

  it("flags a non-deterministic lift source as an error through the runner", async () => {
    const dir = tmp();
    const doc = ForgeDocument.createBlank(dir);
    const object = upsertForgeObject(dir, {
      name: "Hero",
      html: '<main data-forge-component="root"><h1 data-forge-component="hero-title">Hi</h1></main>',
      css: "",
      js: "",
    });
    const result = await runCreateChat({
      message: "Reveal the hero title",
      references: [{ kind: "component", id: object.id }],
      aspect: "16:9",
      doc,
      docDir: dir,
      knowledgeDir: KNOWLEDGE,
      complete: async () =>
        JSON.stringify({
          reply: "Built it.",
          extensionDraft: {
            name: "Hero Title Reveal",
            summary: "A hero title reveal that unfortunately jitters randomly.",
            route: "interface-reveal",
            primitiveKind: "enter",
            durationSec: 3,
            components: [object.id],
            timeline: [
              { asset: object.id, target: "hero-title", op: "fromTo", from: { opacity: 0, y: 16 }, to: { opacity: 1, y: 0 }, at: 0, duration: 0.4 },
            ],
            liftSource: 'tl.fromTo(inner,{y:Math.random()*20,opacity:0},{y:0,opacity:1,duration:0.4,ease:"power3.out"},0);',
          },
        }),
    });
    expect(result.ok).toBe(false);
    expect(result.draft?.validation.some((issue) => issue.code === "nondeterministic")).toBe(true);
    expect(result.errors?.some((error) => /non-deterministic/i.test(error))).toBe(true);
  });
});

describe("Create motion critic", () => {
  const step = (over: Partial<import("../src/createDraft.ts").CreateTimelineStep>): import("../src/createDraft.ts").CreateTimelineStep => ({
    asset: "o",
    target: "part",
    op: "fromTo",
    at: 0,
    ...over,
  });

  it("passes a clean, staggered, transform-only draft", () => {
    const issues = critiqueCreateDraft({
      primitiveKind: "enter",
      liftSource: 'tl.fromTo(inner,{y:24,opacity:0},{y:0,opacity:1,duration:0.45,ease:"power3.out"},0);',
      timeline: [step({ from: { opacity: 0, y: 24 }, to: { opacity: 1, y: 0 }, duration: 0.45, at: 0 })],
    });
    expect(issues).toHaveLength(0);
  });

  it("flags non-determinism from a timeline string var", () => {
    const issues = critiqueCreateDraft({
      primitiveKind: "enter",
      liftSource: "",
      timeline: [step({ op: "set", vars: { backgroundImage: "url(https://example.com/x.png)" } })],
    });
    expect(issues.find((issue) => issue.code === "nondeterministic")?.level).toBe("error");
  });

  it("does not punish a coherent stagger (the signature metric cascade)", () => {
    const issues = critiqueCreateDraft({
      primitiveKind: "enter",
      liftSource: "",
      // six same-shape cards at an even cadence read as ONE stream
      timeline: [0, 0.08, 0.16, 0.24, 0.32, 0.4].map((at) =>
        step({ from: { opacity: 0, y: 16 }, to: { opacity: 1, y: 0 }, duration: 0.45, at }),
      ),
    });
    expect(issues.some((issue) => issue.code === "simultaneity")).toBe(false);
    expect(issues.some((issue) => issue.code === "competing-emphasis")).toBe(false);
  });

  it("warns when independent motions genuinely overlap", () => {
    // four different-shape motions firing at the same instant = real chaos
    const issues = critiqueCreateDraft({
      primitiveKind: "enter",
      liftSource: "",
      timeline: [
        step({ from: { x: -40 }, to: { x: 0 }, duration: 0.5, at: 0 }),
        step({ from: { rotation: -8 }, to: { rotation: 0 }, duration: 0.5, at: 0 }),
        step({ from: { opacity: 0 }, to: { opacity: 1 }, duration: 0.5, at: 0 }),
        step({ from: { scaleX: 0.8 }, to: { scaleX: 1 }, duration: 0.5, at: 0 }),
      ],
    });
    expect(issues.find((issue) => issue.code === "simultaneity")?.level).toBe("warning");
  });

  it("warns when two loud motions overlap", () => {
    const issues = critiqueCreateDraft({
      primitiveKind: "enter",
      liftSource: "",
      timeline: [
        step({ from: { y: 120, opacity: 0 }, to: { y: 0, opacity: 1 }, duration: 0.5, at: 0 }),
        step({ from: { y: -120, opacity: 0 }, to: { y: 0, opacity: 1 }, duration: 0.5, at: 0.2 }),
      ],
    });
    expect(issues.some((issue) => issue.code === "competing-emphasis")).toBe(true);
  });

  it("warns on layout-thrashing properties", () => {
    const issues = critiqueCreateDraft({
      primitiveKind: "enter",
      liftSource: "",
      timeline: [step({ from: { width: 100 }, to: { width: 320 }, duration: 0.4, at: 0 })],
    });
    expect(issues.some((issue) => issue.code === "expensive-prop")).toBe(true);
  });

  it("flags a flat hierarchy when everything enters at once", () => {
    const issues = critiqueCreateDraft({
      primitiveKind: "enter",
      liftSource: "",
      timeline: [0, 0, 0, 0].map(() => step({ from: { opacity: 0 }, to: { opacity: 1 }, duration: 0.45, at: 0 })),
    });
    expect(issues.find((issue) => issue.code === "flat-hierarchy")?.level).toBe("info");
  });

  it("collapses a peer stagger to one reusable primitive and explains it", () => {
    const timeline = [0, 0.1, 0.2, 0.3, 0.4, 0.5].map((at, i) =>
      step({ target: `card-${i}`, from: { opacity: 0, y: 16 }, to: { opacity: 1, y: 0 }, duration: 0.45, at }),
    );
    const compiled = timelineToCompiledMotion({ primitiveKind: "enter", timeline });
    // six cascading cards export as ONE per-subject primitive, not six stacked
    expect(compiled?.skeleton.length).toBe(1);
    const issues = critiqueCreateDraft({ primitiveKind: "enter", liftSource: "", timeline });
    expect(issues.some((issue) => issue.code === "peer-stagger-collapsed")).toBe(true);
  });

  it("does NOT collapse one subject's multi-beat storyline", () => {
    const timeline = [
      step({ target: "panel", from: { opacity: 0, y: 16 }, to: { opacity: 1, y: 0 }, duration: 0.4, at: 0 }),
      step({ target: "panel", op: "to", to: { scale: 1.02 }, duration: 0.3, at: 0.5 }),
      step({ target: "panel", op: "to", to: { scale: 1 }, duration: 0.3, at: 0.8 }),
    ];
    const compiled = timelineToCompiledMotion({ primitiveKind: "enter", timeline });
    expect(compiled?.skeleton.length).toBe(3);
  });

  it("relaxes emphasis and hierarchy rules for continuous loops", () => {
    const loop = [0, 0, 0, 0].map(() =>
      step({ from: { y: 0 }, to: { y: -12 }, duration: 1.2, ease: "sine.inOut", at: 0 }),
    );
    const issues = critiqueCreateDraft({ primitiveKind: "continuous", liftSource: "", timeline: loop });
    expect(issues.some((issue) => issue.code === "competing-emphasis")).toBe(false);
    expect(issues.some((issue) => issue.code === "flat-hierarchy")).toBe(false);
    // the concurrency cap still applies to ambient motion
    expect(issues.some((issue) => issue.code === "simultaneity")).toBe(true);
  });

  it("exports draft taxonomy into the bundle manifest", () => {
    const dir = tmp();
    const doc = ForgeDocument.createBlank(dir);
    const { draft } = upsertCreateDraft(dir, {
      name: "Logo Settle",
      summary: "A restrained wordmark settle for a SaaS brand closer.",
      route: "brand-sting",
      primitiveKind: "enter",
      taxonomy: {
        family: "brand-logo",
        subject: "wordmark",
        action: "assemble",
        technique: ["scale", "stagger"],
        energy: "calm",
        style: "mechanical",
      },
      liftSource: 'tl.fromTo(inner,{scale:0.9,opacity:0},{scale:1,opacity:1,duration:0.4,ease:"power3.out"},0);',
    });
    const result = liftAndBundleCreateDraft(doc, draft);
    expect(result.bundle && validateBundle(result.bundle).ok).toBe(true);
    expect(result.bundle?.manifest.library).toMatchObject({
      family: "brand-logo",
      subject: "wordmark",
      action: "assemble",
      technique: ["scale", "stagger"],
    });
  });
});
