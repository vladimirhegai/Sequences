import path from "node:path";
import {
  extractJsonObject,
  type SeqextBundle,
} from "@sequences/core";
import type { CompleteOptions } from "@sequences/platform/providers";
import type { ForgeDocument } from "./document.ts";
import { readDocText, findDoc } from "./docs.ts";
import { resolveScratch } from "./scratch.ts";
import { readObjectLibrary, type ForgeObject } from "./objects.ts";
import { buildCreatePrompt, CREATE_CACHE_HINT } from "./createPrompt.ts";
import {
  bundleNameFromDraft,
  normalizeCreateDraft,
  normalizeStageRequest,
  timelineToCompiledMotion,
  timelineToLiftSource,
  writeCreateDraftBundleAudit,
  type CreateStageRequest,
  type CreateValidationIssue,
  type ForgeExtensionDraft,
} from "./createDraft.ts";
import { documentToBundle } from "./export.ts";
import { critiqueCreateDraft } from "./createCritic.ts";
import { liftGsapSource, type LiftedMotion } from "./lift.ts";
import { providerImages, type StageDocRef, type StageMediaRef } from "./stagePrompt.ts";

export interface CreateReference {
  kind: "asset" | "doc" | "scratch" | "component";
  id: string;
  label?: string;
}

export interface RunCreateChatInput {
  message: string;
  references?: CreateReference[];
  aspect: string;
  currentDraft?: ForgeExtensionDraft | null;
  doc: ForgeDocument;
  docDir: string;
  knowledgeDir: string;
  complete: (prompt: string, options?: CompleteOptions) => Promise<string>;
  completeOptions?: CompleteOptions;
  inlineMediaBytes?: boolean;
}

export interface ResolvedCreateReferences {
  media: StageMediaRef[];
  docs: StageDocRef[];
  components: ForgeObject[];
  mediaIds: string[];
}

export interface RunCreateChatResult {
  ok: boolean;
  reply?: string;
  draft?: ForgeExtensionDraft;
  stageRequest?: CreateStageRequest;
  bundle?: SeqextBundle;
  lift?: LiftedMotion;
  raw?: string;
  errors?: string[];
  provider?: string;
}

function mediaKindOf(assetKind: string, assetPath: string): StageMediaRef["kind"] {
  if (/\.svg$/i.test(assetPath)) return "svg";
  if (assetKind === "image") return "image";
  if (assetKind === "video") return "video";
  if (assetKind === "audio") return "audio";
  return "other";
}

export function resolveCreateReferences(
  doc: ForgeDocument,
  docDir: string,
  references: CreateReference[],
): ResolvedCreateReferences {
  const media: StageMediaRef[] = [];
  const docs: StageDocRef[] = [];
  const components: ForgeObject[] = [];
  const mediaIds: string[] = [];
  const objects = readObjectLibrary(docDir);
  for (const ref of references) {
    if (ref.kind === "asset") {
      const asset = doc.project.assets.find((item) => item.id === ref.id);
      if (!asset) continue;
      media.push({
        label: ref.label ?? asset.id,
        path: path.join(doc.dir, asset.path),
        kind: mediaKindOf(asset.kind, asset.path),
      });
      mediaIds.push(asset.id);
    } else if (ref.kind === "scratch") {
      const file = resolveScratch(doc.dir, ref.id);
      if (file) media.push({ label: ref.label ?? "pasted image", path: file, kind: "image" });
    } else if (ref.kind === "doc") {
      const text = readDocText(docDir, ref.id);
      if (text != null) docs.push({ label: ref.label ?? findDoc(docDir, ref.id)?.name ?? ref.id, text });
    } else if (ref.kind === "component") {
      const object = objects.find((item) => item.id === ref.id);
      if (object && !components.some((item) => item.id === object.id)) components.push(object);
    }
  }
  return { media, docs, components, mediaIds: [...new Set(mediaIds)] };
}

function addAssetReference(doc: ForgeDocument, resolved: ResolvedCreateReferences, assetId: string, label?: string): void {
  if (resolved.mediaIds.includes(assetId)) return;
  const asset = doc.project.assets.find((item) => item.id === assetId);
  if (!asset) return;
  resolved.media.push({
    label: label ?? asset.id,
    path: path.join(doc.dir, asset.path),
    kind: mediaKindOf(asset.kind, asset.path),
  });
  resolved.mediaIds.push(asset.id);
}

function mergeCurrentDraftReferences(
  doc: ForgeDocument,
  docDir: string,
  resolved: ResolvedCreateReferences,
  currentDraft: ForgeExtensionDraft | null | undefined,
): ResolvedCreateReferences {
  if (!currentDraft) return resolved;
  const objects = readObjectLibrary(docDir);
  for (const id of currentDraft.components) {
    if (resolved.components.some((item) => item.id === id)) continue;
    const object = objects.find((item) => item.id === id);
    if (object) resolved.components.push(object);
  }
  for (const id of currentDraft.media) addAssetReference(doc, resolved, id);
  resolved.mediaIds = [...new Set(resolved.mediaIds)];
  return resolved;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function jsonObjectFromText(raw: string): Record<string, unknown> | null {
  try {
    const parsed = extractJsonObject(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function defaultLiftSource(kind: ForgeExtensionDraft["primitiveKind"]): string {
  if (kind === "exit") {
    return 'const tl = gsap.timeline(); tl.to(inner,{y:-18,opacity:0,duration:0.22,ease:"power2.in"},0);';
  }
  if (kind === "emphasis") {
    return 'const tl = gsap.timeline(); tl.fromTo(inner,{scale:1},{scale:1.035,duration:0.16,ease:"power2.out"},0).to(inner,{scale:1,duration:0.24,ease:"power3.out"},0.16);';
  }
  if (kind === "continuous") {
    return 'const tl = gsap.timeline(); tl.to(inner,{y:-10,duration:1.2,ease:"sine.inOut",repeat:-1,yoyo:true},0);';
  }
  return 'const tl = gsap.timeline(); tl.fromTo(inner,{y:32,opacity:0},{y:0,opacity:1,duration:0.45,ease:"power3.out"},0);';
}

const WEAK_TITLE_WORDS = new Set([
  "the",
  "a",
  "an",
  "edit",
  "motion",
  "snippet",
  "sequence",
  "moment",
  "story",
  "concept",
  "piece",
  "premium",
  "considered",
  "elegant",
  "cinematic",
]);

function words(input: string): string[] {
  return input
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function titleCase(input: string): string {
  return words(input)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function meaningfulTokens(input: string): Set<string> {
  return new Set(words(input).filter((word) => word.length > 2 && !WEAK_TITLE_WORDS.has(word)));
}

function draftAnchorTokens(draft: ForgeExtensionDraft, components: ForgeObject[]): Set<string> {
  const source = [
    draft.taxonomy.family,
    draft.taxonomy.subject,
    draft.taxonomy.action,
    ...(draft.taxonomy.technique ?? []),
    ...components.map((component) => component.name),
    ...draft.timeline.map((step) => step.target),
  ]
    .filter(Boolean)
    .join(" ");
  return meaningfulTokens(source);
}

function isWeakDraftName(draft: ForgeExtensionDraft, components: ForgeObject[]): boolean {
  const nameTokens = meaningfulTokens(draft.name);
  if (nameTokens.size === 0) return true;
  const anchors = draftAnchorTokens(draft, components);
  const hasAnchor = [...nameTokens].some((token) => anchors.has(token));
  const vagueCount = words(draft.name).filter((token) => WEAK_TITLE_WORDS.has(token)).length;
  return !hasAnchor && (vagueCount > 0 || /^the\s+/i.test(draft.name));
}

function deriveDraftName(draft: ForgeExtensionDraft, components: ForgeObject[]): string {
  const subject =
    draft.taxonomy.subject ||
    components[0]?.name ||
    (draft.route === "data-moment" ? "Data" : draft.route === "brand-sting" ? "Brand" : "Interface");
  const primaryTarget = draft.timeline
    .map((step) => step.target)
    .find((target) => !/^(root|container|inner|stage|viewport|screen|frame)$/i.test(target));
  const action = draft.taxonomy.action || (draft.primitiveKind === "emphasis" ? "emphasis" : draft.primitiveKind);
  const parts = [titleCase(subject)];
  const target = primaryTarget ? titleCase(primaryTarget) : "";
  if (target && !parts[0]!.toLowerCase().includes(target.toLowerCase())) parts.push(target);
  parts.push(titleCase(String(action)));
  return parts.join(" ").replace(/\s+/g, " ").trim() || "Component Motion Draft";
}

function applyConcreteDraftName(draft: ForgeExtensionDraft, components: ForgeObject[]): ForgeExtensionDraft {
  if (!isWeakDraftName(draft, components)) return draft;
  const name = deriveDraftName(draft, components);
  return {
    ...draft,
    name,
    summary: draft.summary.includes(draft.name)
      ? draft.summary.replace(draft.name, name)
      : draft.summary,
  };
}

function issue(level: CreateValidationIssue["level"], code: string, message: string): CreateValidationIssue {
  return { level, code, message };
}

function resolveComponentId(raw: string, components: ForgeObject[]): string | null {
  const exact = components.find((component) => component.id === raw);
  if (exact) return exact.id;
  const byName = components.find((component) => component.name.toLowerCase() === raw.toLowerCase());
  return byName?.id ?? null;
}

function resolvePart(raw: string, component: ForgeObject): string | null {
  const part = raw.includes(".") ? raw.split(".").pop() ?? raw : raw;
  if (component.components.includes(part)) return part;
  if (part === "root" && component.components.length === 0) return part;
  return null;
}

export function validateCreateDraftReferences(
  draft: ForgeExtensionDraft,
  components: ForgeObject[],
  mediaIds: string[] = [],
): { draft: ForgeExtensionDraft; issues: CreateValidationIssue[] } {
  const issues: CreateValidationIssue[] = [];
  const byId = new Map(components.map((component) => [component.id, component]));
  const normalizedComponents = draft.components
    .map((id) => resolveComponentId(id, components))
    .filter((id): id is string => Boolean(id));
  const componentIds = normalizedComponents.length ? [...new Set(normalizedComponents)] : components.map((component) => component.id);
  if (!componentIds.length) {
    issues.push(issue("warning", "no-components", "No saved Stage component is attached; Create may need a Stage asset before this is useful."));
  }

  const timeline = draft.timeline.map((step) => {
    const asset = resolveComponentId(step.asset, components) ?? step.asset;
    const component = byId.get(asset);
    if (!component) {
      issues.push(issue("error", "unknown-component", `Timeline step references unknown component '${step.asset}'.`));
      return step;
    }
    const target = resolvePart(step.target, component);
    if (!target) {
      issues.push(issue("error", "unknown-part", `${component.name} has no named part '${step.target}'.`));
      return { ...step, asset };
    }
    return { ...step, asset, target };
  });

  const actions = draft.actions.map((action) => {
    const asset = resolveComponentId(action.asset, components) ?? action.asset;
    const component = byId.get(asset);
    if (!component) {
      issues.push(issue("error", "unknown-component", `Action beat references unknown component '${action.asset}'.`));
      return action;
    }
    if (!component.actions.some((item) => item.name === action.trigger)) {
      issues.push(issue("error", "unknown-action", `${component.name} has no action '${action.trigger}'.`));
    }
    return { ...action, asset };
  });

  const knobAutomation = draft.knobAutomation.map((knob) => {
    const asset = resolveComponentId(knob.asset, components) ?? knob.asset;
    const component = byId.get(asset);
    if (!component) {
      issues.push(issue("error", "unknown-component", `Knob automation references unknown component '${knob.asset}'.`));
      return knob;
    }
    if (!component.variables.some((item) => item.name === knob.name)) {
      issues.push(issue("error", "unknown-knob", `${component.name} has no knob '${knob.name}'.`));
    }
    return { ...knob, asset };
  });

  const media = draft.media.length ? draft.media : mediaIds;
  return {
    draft: {
      ...draft,
      components: componentIds,
      media,
      timeline,
      actions,
      knobAutomation,
      validation: [...draft.validation, ...issues],
    },
    issues,
  };
}

export function liftAndBundleCreateDraft(doc: ForgeDocument, draft: ForgeExtensionDraft): {
  lift?: LiftedMotion;
  bundle?: SeqextBundle;
  issues: CreateValidationIssue[];
} {
  const issues: CreateValidationIssue[] = [];
  let lift: LiftedMotion;

  const compiled = draft.compiledMotion ?? timelineToCompiledMotion(draft);
  if (compiled) {
    lift = compiled;
  } else {
    const source = draft.liftSource.trim() || timelineToLiftSource(draft) || defaultLiftSource(draft.primitiveKind);
    try {
      lift = liftGsapSource(source, {
        id: bundleNameFromDraft(draft),
        summary: draft.summary,
        primitiveKind: draft.primitiveKind,
      });
    } catch (err) {
      return {
        issues: [issue("error", "lift-failed", String((err as Error).message))],
      };
    }
  }

  try {
    const bundle = documentToBundle(doc, {
      id: bundleNameFromDraft(draft),
      summary: draft.summary,
      primitiveKind: draft.primitiveKind,
      lift,
      tags: {
        energy: draft.taxonomy.energy ?? "calm",
        style: draft.taxonomy.style ?? "mechanical",
      },
      library: {
        ...(draft.taxonomy.family ? { family: draft.taxonomy.family } : {}),
        ...(draft.taxonomy.subject ? { subject: draft.taxonomy.subject } : {}),
        ...(draft.taxonomy.action ? { action: String(draft.taxonomy.action) } : {}),
        technique: draft.taxonomy.technique ?? [],
        ...(draft.taxonomy.register ? { register: draft.taxonomy.register } : {}),
        context: draft.taxonomy.context ?? [],
      },
      guardrails: [
        ...lift.warnings,
        `Forge Create route: ${draft.route}`,
        `Aspect: ${draft.aspect}`,
        ...(draft.taxonomy.subject ? [`Subject: ${draft.taxonomy.subject}`] : []),
        ...(draft.taxonomy.action ? [`Action: ${draft.taxonomy.action}`] : []),
      ],
    });
    writeCreateDraftBundleAudit(doc.dir, draft.id, bundle);
    issues.push(issue("info", "bundle-valid", `Validated ${bundle.manifest.id} as a .seqext draft.`));
    return { lift, bundle, issues };
  } catch (err) {
    return {
      lift,
      issues: [issue("error", "bundle-invalid", String((err as Error).message))],
    };
  }
}

export async function runCreateChat(input: RunCreateChatInput): Promise<RunCreateChatResult> {
  const resolved = mergeCurrentDraftReferences(
    input.doc,
    input.docDir,
    resolveCreateReferences(input.doc, input.docDir, input.references ?? []),
    input.currentDraft,
  );
  const currentErrors = input.currentDraft?.validation.filter((item) => item.level === "error").map((item) => item.message) ?? [];
  const built = buildCreatePrompt({
    message: input.message,
    aspect: input.currentDraft?.aspect ?? input.aspect,
    components: resolved.components,
    media: resolved.media,
    docs: resolved.docs,
    currentDraft: input.currentDraft ?? null,
    currentErrors,
    knowledgeDir: input.knowledgeDir,
    inlineMediaBytes: input.inlineMediaBytes,
  });

  let raw: string;
  try {
    raw = await input.complete(built.prompt, {
      timeoutMs: Number(process.env.FORGE_CREATE_TIMEOUT_MS) || 600_000,
      cacheHint: CREATE_CACHE_HINT,
      ...input.completeOptions,
      ...(input.inlineMediaBytes ? { images: providerImages(resolved.media) } : {}),
    });
  } catch (err) {
    return { ok: false, errors: [String((err as Error).message)] };
  }

  const parsed = jsonObjectFromText(raw);
  if (!parsed) return { ok: false, raw, errors: ["the Create agent did not return parseable JSON"] };

  const stageRequest = normalizeStageRequest(parsed.stageRequest);
  const draftRaw =
    parsed.extensionDraft && typeof parsed.extensionDraft === "object" && !Array.isArray(parsed.extensionDraft)
      ? parsed.extensionDraft as Record<string, unknown>
      : null;

  if (!draftRaw && stageRequest) {
    return { ok: true, raw, reply: asString(parsed.reply) || "I need a Stage asset before choreographing this.", stageRequest };
  }
  if (!draftRaw) {
    return { ok: false, raw, reply: asString(parsed.reply), errors: ["response had no extensionDraft or stageRequest"] };
  }

  const defaultComponents = resolved.components.length
    ? resolved.components.map((component) => component.id)
    : input.currentDraft?.components ?? [];
  const defaultMedia = resolved.mediaIds.length ? resolved.mediaIds : input.currentDraft?.media ?? [];
  const preservedDraft = input.currentDraft
    ? {
        ...input.currentDraft,
        validation: [],
        compiledMotion: undefined,
        liftSource: "",
      }
    : {};
  const draft = normalizeCreateDraft(
    {
      ...preservedDraft,
      route: input.currentDraft?.route ?? built.intent.route,
      primitiveKind: input.currentDraft?.primitiveKind ?? built.intent.primitiveKind,
      components: defaultComponents,
      media: defaultMedia,
      ...draftRaw,
      aspect: input.currentDraft?.aspect ?? input.aspect,
      liftSource: asString(draftRaw.liftSource),
    },
    { fallbackAspect: input.currentDraft?.aspect ?? input.aspect },
  );

  // Prefer the agent's hand-authored lift; otherwise derive the real motion DNA
  // from the structured timeline (deterministic, token-free); only then fall back
  // to a generic per-kind skeleton. Persist it so the draft stays inspectable.
  if (!draft.liftSource.trim()) {
    draft.liftSource = timelineToLiftSource(draft) || defaultLiftSource(draft.primitiveKind);
  }

  const checked = validateCreateDraftReferences(draft, resolved.components, resolved.mediaIds);
  const namedDraft = applyConcreteDraftName(checked.draft, resolved.components);
  // Deterministic motion critic: enforce the MOTION BAR (one loud beat, ≤3
  // concurrent movers, transform/opacity, determinism) as constraints, not just
  // prompt prose. Errors fail the draft and feed the next repair turn.
  const critic = critiqueCreateDraft(namedDraft);
  const criticizedDraft: ForgeExtensionDraft = {
    ...namedDraft,
    validation: [...namedDraft.validation, ...critic],
  };
  const bundled = liftAndBundleCreateDraft(input.doc, criticizedDraft);
  const finalDraft: ForgeExtensionDraft = {
    ...criticizedDraft,
    validation: [...criticizedDraft.validation, ...bundled.issues],
  };
  const errors = finalDraft.validation.filter((item) => item.level === "error").map((item) => item.message);
  return {
    ok: errors.length === 0,
    raw,
    reply: asString(parsed.reply) || "Built the motion draft.",
    draft: finalDraft,
    ...(stageRequest ? { stageRequest } : {}),
    ...(bundled.lift ? { lift: bundled.lift } : {}),
    ...(bundled.bundle ? { bundle: bundled.bundle } : {}),
    ...(errors.length ? { errors } : {}),
  };
}
