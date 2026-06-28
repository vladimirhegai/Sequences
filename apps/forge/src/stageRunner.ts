/**
 * The Stage runner — orchestrates the Stage AI turn (FORGE.md AI architecture).
 *
 * Pipeline:
 *   references → resolve to file paths (images) + inlined text (markdown docs)
 *   → buildStagePrompt → provider.complete → extract strict JSON
 *   → validate the asset → extract the Forge contract (parts/knobs/actions).
 *
 * The model only ever selects/writes the asset; the CONTRACT is re-derived
 * deterministically from the returned source by `extractContract`, so the
 * Inspector and the downstream Motion AI see a trustworthy contract regardless
 * of what the model claimed.
 */
import path from "node:path";
import { extractJsonObject } from "@sequences/core";
import type { CompleteOptions } from "@sequences/platform/providers";
import { extractContract, type StageContract } from "./stageContract.ts";
import {
  buildStagePrompt,
  providerImages,
  STAGE_CACHE_HINT,
  type StageAssetSource,
  type StageDocRef,
  type StageMediaRef,
} from "./stagePrompt.ts";
import {
  compileReactStageSource,
  normalizeCapabilities,
  normalizeReactSource,
  sourceUsesGsap,
  sourceUsesTailwind,
  type StageAssetCapabilities,
} from "./reactCompile.ts";
import { polishStageAsset } from "./stagePolish.ts";
import { applyStageOps, type StageOp } from "./stageTweak.ts";
import { readDocText, findDoc } from "./docs.ts";
import { resolveScratch } from "./scratch.ts";
import type { ForgeDocument } from "./document.ts";
import { readObjectLibrary } from "./objects.ts";

export interface StageReference {
  kind: "asset" | "doc" | "scratch" | "component";
  id: string;
  label?: string;
}

export interface RunStageChatInput {
  message: string;
  references?: StageReference[];
  current?: StageAssetSource | null;
  aspect?: string;
  doc: ForgeDocument;
  docDir: string;
  knowledgeDir: string;
  complete: (prompt: string, options?: CompleteOptions) => Promise<string>;
  completeOptions?: CompleteOptions;
  inlineMediaBytes?: boolean;
}

export interface StageAssetResult extends StageAssetSource {
  name: string;
  contract: StageContract;
}

export interface RunStageChatResult {
  ok: boolean;
  reply?: string;
  asset?: StageAssetResult;
  raw?: string;
  errors?: string[];
}

function mediaKindOf(assetKind: string, assetPath: string): StageMediaRef["kind"] {
  if (/\.svg$/i.test(assetPath)) return "svg";
  if (assetKind === "image") return "image";
  if (assetKind === "video") return "video";
  if (assetKind === "audio") return "audio";
  return "other";
}

/** Resolve chat references to viewable file paths + inlined doc text. */
export function resolveStageReferences(
  doc: ForgeDocument,
  docDir: string,
  references: StageReference[],
): { media: StageMediaRef[]; docs: StageDocRef[] } {
  const media: StageMediaRef[] = [];
  const docs: StageDocRef[] = [];
  for (const ref of references) {
    if (ref.kind === "asset") {
      const asset = doc.project.assets.find((a) => a.id === ref.id);
      if (!asset) continue;
      media.push({
        label: ref.label ?? asset.id,
        path: path.join(doc.dir, asset.path),
        kind: mediaKindOf(asset.kind, asset.path),
      });
    } else if (ref.kind === "scratch") {
      const file = resolveScratch(doc.dir, ref.id);
      if (file) media.push({ label: ref.label ?? "pasted image", path: file, kind: "image" });
    } else if (ref.kind === "doc") {
      const text = readDocText(docDir, ref.id);
      if (text != null) docs.push({ label: ref.label ?? findDoc(docDir, ref.id)?.name ?? ref.id, text });
    } else if (ref.kind === "component") {
      const object = readObjectLibrary(docDir).find((item) => item.id === ref.id);
      if (!object) continue;
      const react = object.react?.tsx ? [`<react-tsx>`, object.react.tsx, `</react-tsx>`] : [];
      docs.push({
        label: ref.label ?? object.name,
        text: [
          `Forge component: ${object.name}`,
          `Named parts: ${object.components.join(", ") || "root"}`,
          `Tweaks: ${object.variables.map((knob) => `${knob.name}:${knob.type}`).join(", ") || "none"}`,
          `Actions: ${object.actions.map((action) => action.name).join(", ") || "none"}`,
          `<html>`,
          object.html,
          `</html>`,
          `<css>`,
          object.css,
          `</css>`,
          `<js>`,
          object.js,
          `</js>`,
          ...react,
        ].join("\n"),
      });
    }
  }
  return { media, docs };
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function looksLikeStageAsset(value: Record<string, unknown>): boolean {
  if (["html", "css", "js"].some((key) => typeof value[key] === "string")) return true;
  if (typeof value.react === "string") return true;
  const react = asRecord(value.react);
  return !!react && typeof react.tsx === "string";
}

function repairJsonCodeStrings(value: string): string {
  let out = "";
  let inString = false;
  let escaped = false;
  for (let index = 0; index < value.length; index++) {
    const char = value[index]!;
    if (!inString) {
      out += char;
      if (char === '"') inString = true;
      continue;
    }
    if (escaped) {
      out += char;
      escaped = false;
    } else if (char === "\\") {
      out += char;
      escaped = true;
    } else if (char === '"') {
      let lookahead = index + 1;
      while (lookahead < value.length && /\s/.test(value[lookahead]!)) lookahead++;
      const next = value[lookahead];
      // JSON strings close before a delimiter (or EOF). Quotes inside emitted
      // HTML/JSX frequently arrive unescaped and instead precede attribute text.
      if (next == null || next === "," || next === ":" || next === "}" || next === "]") {
        out += char;
        inString = false;
      } else {
        out += '\\"';
      }
    } else if (char === "\n") {
      out += "\\n";
    } else if (char === "\r") {
      out += "\\r";
    } else if (char === "\t") {
      out += "\\t";
    } else {
      out += char;
    }
  }
  return out;
}

function isStageResponseCandidate(value: Record<string, unknown>): boolean {
  return (
    looksLikeStageAsset(value) ||
    ["reply", "asset", "ops", "result", "output", "response", "data", "artifact", "component"].some(
      (key) => Object.hasOwn(value, key),
    )
  );
}

/** Parse strict JSON plus common literal-newline/unescaped-quote defects in code strings. */
export function parseStageResponseJson(raw: string): Record<string, unknown> | null {
  const unfenced = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  const start = unfenced.indexOf("{");
  const end = unfenced.lastIndexOf("}");
  const outer = start >= 0 && end > start ? unfenced.slice(start, end + 1) : unfenced;

  for (const candidate of [outer, repairJsonCodeStrings(outer)]) {
    try {
      const parsed = asRecord(JSON.parse(candidate));
      if (parsed && isStageResponseCandidate(parsed)) return parsed;
    } catch {
      // Try the repaired candidate, then the core extractor fallback below.
    }
  }

  try {
    const parsed = asRecord(extractJsonObject(raw));
    return parsed && isStageResponseCandidate(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function looksLikeTruncatedStageResponse(raw: string): boolean {
  const text = raw.trim().replace(/^```(?:json)?\s*/i, "");
  if (!text.startsWith("{")) return false;
  if (!text.endsWith("}")) return true;

  // A response can end on an inner object while its outer asset envelope or a
  // code string is still open. Track JSON string/bracket state without trying
  // to repair it so recovery only runs for genuinely incomplete output.
  let inString = false;
  let escaped = false;
  const stack: string[] = [];
  for (const char of text) {
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "{" || char === "[") stack.push(char);
    else if (char === "}" && stack.at(-1) === "{") stack.pop();
    else if (char === "]" && stack.at(-1) === "[") stack.pop();
  }
  return inString || stack.length > 0;
}

function compactRecoveryPrompt(prompt: string): string {
  return [
    prompt,
    "",
    "RECOVERY: Your previous response was cut off before the JSON completed.",
    "Regenerate the asset from scratch as compact, valid JSON under 12,000 characters.",
    "Reduce decorative markup, sample data, and code—not required Forge annotations.",
    "Do not continue the old response and do not include markdown fences or prose.",
  ].join("\n");
}

/**
 * Normalize harmless envelope drift from smaller/API models while leaving the
 * actual asset validation unchanged. Forge's canonical response remains
 * {reply, asset}; accepted alternates only relocate the same asset fields.
 */
export function normalizeStageEnvelope(parsed: Record<string, unknown>): {
  reply: string;
  asset: Record<string, unknown> | null;
} {
  const direct = asRecord(parsed.asset);
  if (direct) return { reply: asString(parsed.reply), asset: direct };

  for (const key of ["result", "output", "response", "data"]) {
    const wrapper = asRecord(parsed[key]);
    if (!wrapper) continue;
    const nestedAsset = asRecord(wrapper.asset);
    if (nestedAsset) {
      return {
        reply: asString(parsed.reply) || asString(wrapper.reply),
        asset: nestedAsset,
      };
    }
    if (looksLikeStageAsset(wrapper)) {
      return {
        reply: asString(parsed.reply) || asString(wrapper.reply),
        asset: wrapper,
      };
    }
  }

  for (const key of ["artifact", "component"]) {
    const alternate = asRecord(parsed[key]);
    if (alternate && looksLikeStageAsset(alternate)) {
      return { reply: asString(parsed.reply), asset: alternate };
    }
  }

  return {
    reply: asString(parsed.reply),
    asset: looksLikeStageAsset(parsed) ? parsed : null,
  };
}

function hasMountId(html: string, rootId: string): boolean {
  const escaped = rootId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\bid\\s*=\\s*["']${escaped}["']`, "i").test(html);
}

function ensureReactMount(html: string, rootId: string): string {
  const clean = html.trim();
  if (clean && hasMountId(clean, rootId)) return html;
  return [clean, `<div id="${rootId}"></div>`].filter(Boolean).join("\n");
}

function compactCapabilities(capabilities: StageAssetCapabilities): StageAssetCapabilities | undefined {
  const out: StageAssetCapabilities = {};
  if (capabilities.react) out.react = true;
  if (capabilities.gsap) out.gsap = true;
  if (capabilities.tailwind) out.tailwind = true;
  return out.react || out.gsap || out.tailwind ? out : undefined;
}

/**
 * The token-saving edit path: the model returned a small `ops` list instead of a
 * full asset. Apply it deterministically to the asset already on the stage and
 * re-derive the contract. React assets recompile from the tweaked TSX.
 */
function runOps(
  current: StageAssetSource,
  ops: StageOp[],
  reply: string,
  raw: string,
): RunStageChatResult {
  const curReact = normalizeReactSource(current.react);
  const tweak = applyStageOps(
    {
      html: current.html ?? "",
      css: current.css ?? "",
      // React assets keep the TSX as the source of truth; js is recompiled below.
      js: curReact ? "" : current.js ?? "",
      reactTsx: curReact?.tsx,
    },
    ops,
  );
  if (tweak.applied.length === 0) {
    return { ok: false, raw, reply, errors: tweak.errors.length ? tweak.errors : ["no ops applied"] };
  }

  let html = tweak.html;
  let js = tweak.js;
  const capabilities = normalizeCapabilities(current.capabilities);
  let react: ReturnType<typeof normalizeReactSource> = undefined;
  if (curReact && tweak.reactTsx != null) {
    react = { tsx: tweak.reactTsx, rootId: curReact.rootId };
    const compiled = compileReactStageSource(react);
    if (!compiled.ok || !compiled.js) {
      return { ok: false, raw, reply, errors: compiled.errors?.length ? compiled.errors : ["tweaked React did not compile"] };
    }
    html = ensureReactMount(html, compiled.rootId);
    js = compiled.js;
    capabilities.react = true;
  }
  if (sourceUsesGsap(`${js}\n${react?.tsx ?? ""}`)) capabilities.gsap = true;
  if (sourceUsesTailwind(`${html}\n${tweak.css}\n${js}\n${react?.tsx ?? ""}`)) capabilities.tailwind = true;

  const contract = extractContract({ html, css: tweak.css, js, react: react?.tsx });
  const compact = compactCapabilities(capabilities);
  const note = ` (${tweak.applied.join("; ")})`;
  return {
    ok: true,
    raw,
    reply: (reply || "Applied edit.") + note,
    asset: {
      name: current.name?.trim() || "Untitled asset",
      html,
      css: tweak.css,
      js,
      ...(react ? { react } : {}),
      ...(compact ? { capabilities: compact } : {}),
      contract,
    },
    ...(tweak.errors.length ? { errors: tweak.errors } : {}),
  };
}

export async function runStageChat(input: RunStageChatInput): Promise<RunStageChatResult> {
  const { media, docs } = resolveStageReferences(input.doc, input.docDir, input.references ?? []);
  const prompt = buildStagePrompt({
    message: input.message,
    current: input.current ?? null,
    media,
    docs,
    aspect: input.aspect,
    knowledgeDir: input.knowledgeDir,
    inlineMediaBytes: input.inlineMediaBytes,
  });

  const completeOptions: CompleteOptions = {
    // The Stage turn is the heavy creative call (large prompt + high effort +
    // a full asset). Give it generous headroom; override with FORGE_STAGE_TIMEOUT_MS.
    timeoutMs: Number(process.env.FORGE_STAGE_TIMEOUT_MS) || 600_000,
    cacheHint: STAGE_CACHE_HINT,
    ...input.completeOptions,
    ...(input.inlineMediaBytes ? { images: providerImages(media) } : {}),
  };
  let raw: string;
  try {
    raw = await input.complete(prompt, completeOptions);
  } catch (err) {
    return { ok: false, errors: [String((err as Error).message)] };
  }

  let parsed = parseStageResponseJson(raw);
  if (!parsed && looksLikeTruncatedStageResponse(raw)) {
    try {
      raw = await input.complete(compactRecoveryPrompt(prompt), completeOptions);
      parsed = parseStageResponseJson(raw);
    } catch (err) {
      return {
        ok: false,
        raw,
        errors: [`the agent response was truncated and compact recovery failed: ${String((err as Error).message)}`],
      };
    }
  }
  if (!parsed) {
    return { ok: false, raw, errors: ["the agent did not return parseable JSON ({reply, asset})"] };
  }

  // Token-saving path: a small-edit op-list against the asset already on stage.
  const ops = Array.isArray(parsed.ops) ? (parsed.ops as StageOp[]) : null;
  if (ops && ops.length && input.current) {
    return runOps(input.current, ops, asString(parsed.reply), raw);
  }

  const envelope = normalizeStageEnvelope(parsed);
  const assetRaw = envelope.asset;
  if (!assetRaw) {
    const keys = Object.keys(parsed).slice(0, 8).join(", ");
    return {
      ok: false,
      raw,
      reply: envelope.reply,
      errors: [`response had no \`asset\` object${keys ? ` (received: ${keys})` : ""}`],
    };
  }

  let html = asString(assetRaw.html);
  let css = asString(assetRaw.css);
  const rawJs = asString(assetRaw.js);
  let js = rawJs;
  const react = normalizeReactSource(assetRaw.react);
  const capabilities = normalizeCapabilities(assetRaw.capabilities);

  if (react) {
    const compiled = compileReactStageSource(react);
    if (!compiled.ok || !compiled.js) {
      return {
        ok: false,
        raw,
        reply: envelope.reply,
        errors: compiled.errors?.length ? compiled.errors : ["React source could not be compiled"],
      };
    }
    html = ensureReactMount(html, compiled.rootId);
    js = [compiled.js, rawJs].filter(Boolean).join("\n");
    capabilities.react = true;
  }
  if (sourceUsesGsap(`${js}\n${react?.tsx ?? ""}`)) capabilities.gsap = true;
  if (sourceUsesTailwind(`${html}\n${css}\n${js}\n${react?.tsx ?? ""}`)) capabilities.tailwind = true;

  if (!html && !css) {
    return { ok: false, raw, reply: envelope.reply, errors: ["the asset had no html/css to render"] };
  }

  // Deterministic, zero-token cleanup (fences, @import hoist, reduced-motion guard).
  const polished = polishStageAsset({ html, css, js }, { react: react?.tsx });
  html = polished.html;
  css = polished.css;
  js = polished.js;

  const name = asString(assetRaw.name).trim() || "Untitled asset";
  const contract = extractContract({ html, css, js, react: react?.tsx });
  const compact = compactCapabilities(capabilities);
  return {
    ok: true,
    raw,
    reply: envelope.reply || "Built the asset.",
    asset: {
      name,
      html,
      css,
      js,
      ...(react ? { react } : {}),
      ...(compact ? { capabilities: compact } : {}),
      contract,
    },
  };
}
