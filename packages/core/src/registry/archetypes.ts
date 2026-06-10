/**
 * The Phase-1 archetype set (all 6) — the niche, encoded.
 *
 * Each archetype is pure layout: scene + canvas → positioned proto-layers
 * with visual-hierarchy ranks (rank 1 = hero; ranks feed the choreography
 * solver and the one-loud-motion rule). Motion assignment happens later via
 * the active profile's selection table — archetypes know nothing about it.
 */
import type { Scene, SlotValue } from "../schema.ts";
import { fullBleed, gridBox } from "../layout.ts";
import type { Archetype, ProtoLayer } from "./types.ts";

export interface MaterializeCtx {
  W: number;
  H: number;
  /** Brand display name (used by logo-sting-cta's text logo). */
  brandName: string;
}

function textOf(value: SlotValue | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}
function listOf(value: SlotValue | undefined): string[] | undefined {
  return Array.isArray(value) ? value : undefined;
}
function numberOf(
  value: SlotValue | undefined,
): { value: number; prefix: string; suffix: string } | undefined {
  return typeof value === "object" && value !== null && "value" in value
    ? { value: value.value, prefix: value.prefix ?? "", suffix: value.suffix ?? "" }
    : undefined;
}
function mediaOf(value: SlotValue | undefined): string | undefined {
  return typeof value === "object" && value !== null && "assetId" in value
    ? value.assetId
    : undefined;
}

export const hookOpener: Archetype = {
  id: "hook-opener",
  summary:
    "Bold claim opener: one big headline, optional subline, soft brand-gradient backdrop. The first beat of nearly every promo.",
  slots: {
    headline: { kind: "text", required: true, maxWords: 7 },
    subline: { kind: "text", required: false, maxWords: 14 },
  },
  layouts: ["center", "left"],
  defaultLayout: "center",
  duration: { min: 60, ideal: 90, max: 150 },
  materialize(scene: Scene, ctx: MaterializeCtx): ProtoLayer[] {
    const { W, H } = ctx;
    const left = (scene.layout ?? this.defaultLayout) === "left";
    const layers: ProtoLayer[] = [];
    layers.push({
      id: "decor-glow",
      role: "decor",
      rank: 3,
      kind: "shape",
      content: { css: "radial-gradient(circle at 30% 25%, var(--c-primary), transparent 62%)" },
      box: fullBleed(W, H),
      opacity: 0.28,
    });
    const headline = textOf(scene.slots["headline"]) ?? "";
    layers.push({
      id: "headline",
      role: "hero",
      rank: 1,
      kind: "text",
      content: { text: headline },
      box: left
        ? gridBox(W, H, { col: 0, span: 9, y: 0.32, h: 0.32 })
        : gridBox(W, H, { col: 1, span: 10, y: 0.33, h: 0.3 }),
      typeToken: "display",
      colorToken: "text",
      align: left ? "left" : "center",
    });
    const subline = textOf(scene.slots["subline"]);
    if (subline) {
      layers.push({
        id: "subline",
        role: "support",
        rank: 2,
        kind: "text",
        content: { text: subline },
        box: left
          ? gridBox(W, H, { col: 0, span: 7, y: 0.66, h: 0.12 })
          : gridBox(W, H, { col: 2, span: 8, y: 0.66, h: 0.12 }),
        typeToken: "title",
        colorToken: "muted",
        align: left ? "left" : "center",
      });
    }
    return layers;
  },
};

export const featureReveal: Archetype = {
  id: "feature-reveal",
  summary:
    "Screenshot hero with headline and up to 3 benefit bullets. Layouts media-left/media-right. The core 'show the product' beat.",
  slots: {
    headline: { kind: "text", required: true, maxWords: 7 },
    media: { kind: "media", required: true },
    bullets: { kind: "textList", required: false, maxItems: 3, maxWords: 8 },
  },
  layouts: ["media-right", "media-left"],
  defaultLayout: "media-right",
  duration: { min: 75, ideal: 120, max: 240 },
  materialize(scene: Scene, ctx: MaterializeCtx): ProtoLayer[] {
    const { W, H } = ctx;
    const mediaLeft = (scene.layout ?? this.defaultLayout) === "media-left";
    const textCol = mediaLeft ? 7 : 0;
    const mediaCol = mediaLeft ? 0 : 6;
    const layers: ProtoLayer[] = [];
    layers.push({
      id: "headline",
      role: "hero",
      rank: 1,
      kind: "text",
      content: { text: textOf(scene.slots["headline"]) ?? "" },
      box: gridBox(W, H, { col: textCol, span: 5, y: 0.18, h: 0.24 }),
      typeToken: "headline",
      colorToken: "text",
      align: "left",
    });
    const assetId = mediaOf(scene.slots["media"]);
    if (assetId) {
      layers.push({
        id: "media",
        role: "media",
        rank: 2,
        kind: "image",
        content: { assetId },
        box: gridBox(W, H, { col: mediaCol, span: 6, y: 0.15, h: 0.7 }),
      });
    }
    const bullets = listOf(scene.slots["bullets"]) ?? [];
    bullets.slice(0, 3).forEach((bullet, i) => {
      layers.push({
        id: `bullet-${i}`,
        role: "list",
        rank: 3 + i,
        kind: "text",
        content: { text: bullet },
        box: gridBox(W, H, { col: textCol, span: 5, y: 0.48 + i * 0.105, h: 0.09 }),
        typeToken: "body",
        colorToken: "muted",
        align: "left",
      });
    });
    return layers;
  },
};

export const statCallout: Archetype = {
  id: "stat-callout",
  summary:
    "One big counted-up number with a caption and accent bar. Use for the single most impressive metric — never two per video back-to-back.",
  slots: {
    stat: { kind: "number", required: true },
    caption: { kind: "text", required: true, maxWords: 10 },
  },
  layouts: ["center"],
  defaultLayout: "center",
  duration: { min: 60, ideal: 90, max: 150 },
  materialize(scene: Scene, ctx: MaterializeCtx): ProtoLayer[] {
    const { W, H } = ctx;
    const stat = numberOf(scene.slots["stat"]) ?? { value: 0, prefix: "", suffix: "" };
    return [
      {
        id: "stat",
        role: "hero",
        rank: 1,
        kind: "number",
        content: { number: stat },
        box: gridBox(W, H, { col: 1, span: 10, y: 0.26, h: 0.32 }),
        typeToken: "mega",
        colorToken: "accent",
        align: "center",
      },
      {
        id: "accent-bar",
        role: "decor",
        rank: 3,
        kind: "shape",
        content: { css: "var(--c-accent)" },
        box: { x: Math.round(W / 2 - 90), y: Math.round(0.625 * H), w: 180, h: 10, origin: "center center" },
        chrome: { background: "var(--c-accent)", radius: 5, paddingX: 0, paddingY: 0 },
      },
      {
        id: "caption",
        role: "support",
        rank: 2,
        kind: "text",
        content: { text: textOf(scene.slots["caption"]) ?? "" },
        box: gridBox(W, H, { col: 3, span: 6, y: 0.68, h: 0.11 }),
        typeToken: "title",
        colorToken: "text",
        align: "center",
      },
    ];
  },
};

export const logoStingCta: Archetype = {
  id: "logo-sting-cta",
  summary:
    "Closing sting: brand wordmark, optional tagline, CTA pill. One decisive motion and a hold — always the last beat.",
  slots: {
    tagline: { kind: "text", required: false, maxWords: 8 },
    cta: { kind: "text", required: true, maxWords: 5 },
  },
  layouts: ["center"],
  defaultLayout: "center",
  duration: { min: 60, ideal: 105, max: 180 },
  materialize(scene: Scene, ctx: MaterializeCtx): ProtoLayer[] {
    const { W, H } = ctx;
    const layers: ProtoLayer[] = [
      {
        id: "logo",
        role: "hero",
        rank: 1,
        kind: "text",
        content: { text: ctx.brandName },
        box: gridBox(W, H, { col: 1, span: 10, y: 0.3, h: 0.22 }),
        typeToken: "display",
        colorToken: "text",
        align: "center",
      },
    ];
    const tagline = textOf(scene.slots["tagline"]);
    if (tagline) {
      layers.push({
        id: "tagline",
        role: "support",
        rank: 2,
        kind: "text",
        content: { text: tagline },
        box: gridBox(W, H, { col: 2, span: 8, y: 0.555, h: 0.09 }),
        typeToken: "title",
        colorToken: "muted",
        align: "center",
      });
    }
    layers.push({
      id: "cta",
      role: "badge",
      rank: 3,
      kind: "text",
      content: { text: textOf(scene.slots["cta"]) ?? "" },
      box: gridBox(W, H, { col: 4, span: 4, y: 0.7, h: 0.085 }),
      typeToken: "body",
      colorToken: "surface",
      align: "center",
      chrome: { background: "var(--c-accent)", radius: 999, paddingX: 0, paddingY: 0 },
    });
    return layers;
  },
};

export const uiWalkthrough: Archetype = {
  id: "ui-walkthrough",
  summary:
    "Guided product walkthrough: screenshot, headline, numbered steps, and accent hotspots. Use when the video must teach a workflow quickly.",
  slots: {
    headline: { kind: "text", required: true, maxWords: 8 },
    media: { kind: "media", required: true },
    steps: { kind: "textList", required: true, maxItems: 4, maxWords: 7 },
  },
  layouts: ["media-right", "media-left", "full"],
  defaultLayout: "media-right",
  duration: { min: 90, ideal: 150, max: 270 },
  materialize(scene: Scene, ctx: MaterializeCtx): ProtoLayer[] {
    const { W, H } = ctx;
    const layout = scene.layout ?? this.defaultLayout;
    const full = layout === "full";
    const mediaLeft = layout === "media-left";
    const textCol = full ? 1 : mediaLeft ? 7 : 0;
    const mediaCol = full ? 2 : mediaLeft ? 0 : 6;
    const mediaSpan = full ? 8 : 6;
    const layers: ProtoLayer[] = [];
    layers.push({
      id: "headline",
      role: "hero",
      rank: 1,
      kind: "text",
      content: { text: textOf(scene.slots["headline"]) ?? "" },
      box: full
        ? gridBox(W, H, { col: 2, span: 8, y: 0.08, h: 0.14 })
        : gridBox(W, H, { col: textCol, span: 5, y: 0.14, h: 0.18 }),
      typeToken: full ? "title" : "headline",
      colorToken: "text",
      align: full ? "center" : "left",
    });
    const assetId = mediaOf(scene.slots["media"]);
    if (assetId) {
      layers.push({
        id: "media",
        role: "media",
        rank: 2,
        kind: "image",
        content: { assetId },
        box: full
          ? gridBox(W, H, { col: mediaCol, span: mediaSpan, y: 0.26, h: 0.56 })
          : gridBox(W, H, { col: mediaCol, span: mediaSpan, y: 0.14, h: 0.72 }),
      });
    }
    const steps = listOf(scene.slots["steps"]) ?? [];
    steps.slice(0, 4).forEach((step, i) => {
      const y = full ? 0.84 : 0.42 + i * 0.105;
      const col = full ? 1 + i * 3 : textCol;
      layers.push({
        id: `step-${i}`,
        role: "list",
        rank: 3 + i,
        kind: "text",
        content: { text: `${i + 1}. ${step}` },
        box: full
          ? gridBox(W, H, { col, span: 2, y, h: 0.08 })
          : gridBox(W, H, { col: textCol, span: 5, y, h: 0.08 }),
        typeToken: "body",
        colorToken: "muted",
        align: full ? "center" : "left",
      });
    });
    steps.slice(0, 3).forEach((_, i) => {
      layers.push({
        id: `hotspot-${i}`,
        role: "badge",
        rank: 7 + i,
        kind: "shape",
        content: { css: "var(--c-accent)" },
        box: full
          ? gridBox(W, H, { col: 3 + i * 2, span: 1, y: 0.38 + i * 0.1, h: 0.055 })
          : gridBox(W, H, { col: mediaCol + 1 + i, span: 1, y: 0.34 + i * 0.12, h: 0.055 }),
        chrome: { background: "var(--c-accent)", radius: 999, paddingX: 0, paddingY: 0 },
        opacity: 0.86,
      });
    });
    return layers;
  },
};

export const socialProof: Archetype = {
  id: "social-proof",
  summary:
    "Credibility beat: testimonial quote, source, and optional customer/logo row. Use after the feature proof, before the CTA.",
  slots: {
    quote: { kind: "text", required: true, maxWords: 18 },
    source: { kind: "text", required: true, maxWords: 6 },
    logos: { kind: "textList", required: false, maxItems: 5, maxWords: 3 },
  },
  layouts: ["center", "left"],
  defaultLayout: "center",
  duration: { min: 75, ideal: 120, max: 210 },
  materialize(scene: Scene, ctx: MaterializeCtx): ProtoLayer[] {
    const { W, H } = ctx;
    const left = (scene.layout ?? this.defaultLayout) === "left";
    const layers: ProtoLayer[] = [
      {
        id: "quote-mark",
        role: "decor",
        rank: 4,
        kind: "text",
        content: { text: "\"" },
        box: left
          ? gridBox(W, H, { col: 0, span: 1, y: 0.14, h: 0.22 })
          : gridBox(W, H, { col: 1, span: 2, y: 0.12, h: 0.22 }),
        typeToken: "display",
        colorToken: "accent",
        align: "center",
        opacity: 0.4,
      },
      {
        id: "quote",
        role: "hero",
        rank: 1,
        kind: "text",
        content: { text: textOf(scene.slots["quote"]) ?? "" },
        box: left
          ? gridBox(W, H, { col: 1, span: 8, y: 0.24, h: 0.28 })
          : gridBox(W, H, { col: 2, span: 8, y: 0.28, h: 0.24 }),
        typeToken: "headline",
        colorToken: "text",
        align: left ? "left" : "center",
      },
      {
        id: "source",
        role: "support",
        rank: 2,
        kind: "text",
        content: { text: textOf(scene.slots["source"]) ?? "" },
        box: left
          ? gridBox(W, H, { col: 1, span: 6, y: 0.57, h: 0.09 })
          : gridBox(W, H, { col: 3, span: 6, y: 0.57, h: 0.09 }),
        typeToken: "title",
        colorToken: "muted",
        align: left ? "left" : "center",
      },
    ];
    const logos = listOf(scene.slots["logos"]) ?? [];
    logos.slice(0, 5).forEach((logo, i) => {
      layers.push({
        id: `logo-${i}`,
        role: "list",
        rank: 3 + i,
        kind: "text",
        content: { text: logo },
        box: gridBox(W, H, { col: 1 + i * 2, span: 2, y: 0.74, h: 0.08 }),
        typeToken: "caption",
        colorToken: "muted",
        align: "center",
      });
    });
    return layers;
  },
};

export const ARCHETYPES: Record<string, Archetype> = Object.fromEntries(
  [
    hookOpener,
    featureReveal,
    statCallout,
    logoStingCta,
    uiWalkthrough,
    socialProof,
  ].map((a) => [a.id, a]),
);
