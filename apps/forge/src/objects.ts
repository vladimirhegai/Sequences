import fs from "node:fs";
import path from "node:path";
import { contentHash } from "@sequences/core";
import {
  extractContract,
  parseKnobs,
  parseParts,
  type ActionSpec,
  type KnobSpec,
  type KnobType,
  type StageContract,
} from "./stageContract.ts";
import {
  normalizeCapabilities,
  normalizeReactSource,
  sourceUsesGsap,
  sourceUsesTailwind,
  type StageAssetCapabilities,
  type StageReactSource,
} from "./reactCompile.ts";

// Knobs are the Stage contract's exposed Tweaks; the older names alias the new
// types so existing callers keep working.
export type ForgeVariableType = KnobType;
export type ForgeVariable = KnobSpec;
export type ForgeObjectValue = string | number | boolean;

export interface ForgeMediaBinding {
  knob: string;
  assetId?: string;
  href?: string;
  path?: string;
  kind?: string;
  label?: string;
}

export interface ForgeObject {
  id: string;
  name: string;
  /** Optional Library bin. Components share the Library's bin UI with media. */
  folder: string;
  html: string;
  css: string;
  js: string;
  /** Optional original React/TSX source preserved for future Stage edits. */
  react?: StageReactSource;
  capabilities?: StageAssetCapabilities;
  /** Canonical Stage contract for HyperFrames / Motion AI consumption. */
  contract: StageContract;
  /** Named, animatable parts (`data-forge-component` / `data-forge-part`). */
  components: string[];
  /** Exposed Tweak knobs. */
  variables: KnobSpec[];
  /** Interactions the Motion AI can trigger (`@forge-action` / `data-forge-action`). */
  actions: ActionSpec[];
  /** Current saved Tweak values, keyed by knob name. */
  values: Record<string, ForgeObjectValue>;
  /** Image/media selections made through Tweaks. */
  mediaBindings: ForgeMediaBinding[];
  createdAt: string;
  updatedAt: string;
}

const STORE_FILE = "objects.json";

function storePath(root: string): string {
  return path.join(root, STORE_FILE);
}

function slug(input: string): string {
  return (
    input
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "object"
  );
}

export function normalizeObjectFolder(input: unknown): string {
  const folder = typeof input === "string" ? input : "";
  return folder
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "")
    .split("/")
    .filter((part) => part && part !== "." && part !== ".." && !/[<>:"|?*\0]/.test(part))
    .join("/");
}

/** @deprecated use `parseParts` from stageContract — kept for callers/tests. */
export function parseForgeComponents(html: string): string[] {
  return parseParts(html);
}

/** @deprecated use `parseKnobs` from stageContract — kept for callers/tests. */
export function parseForgeVariables(source: string): ForgeVariable[] {
  return parseKnobs(source);
}

export function normalizeForgeObject(input: {
  id?: string;
  name?: string;
  html?: string;
  css?: string;
  js?: string;
  folder?: unknown;
  react?: unknown;
  capabilities?: unknown;
  values?: Record<string, unknown>;
  mediaBindings?: ForgeMediaBinding[];
  createdAt?: string;
}): ForgeObject {
  const now = new Date().toISOString();
  const name = input.name?.trim() || "Untitled object";
  const html = input.html ?? "";
  const css = input.css ?? "";
  const js = input.js ?? "";
  const folder = normalizeObjectFolder(input.folder);
  const react = normalizeReactSource(input.react);
  const capabilities = normalizeCapabilities(input.capabilities);
  if (react) capabilities.react = true;
  if (sourceUsesGsap(`${js}\n${react?.tsx ?? ""}`)) capabilities.gsap = true;
  if (sourceUsesTailwind(`${html}\n${css}\n${js}\n${react?.tsx ?? ""}`)) capabilities.tailwind = true;
  const id = input.id?.trim() || `obj-${slug(name)}-${contentHash({ name, html, css, js, react, capabilities }).slice(0, 8)}`;
  const contract = extractContract({ html, css, js, react: react?.tsx });
  const knownKnobs = new Map(contract.knobs.map((knob) => [knob.name, knob]));
  const values: Record<string, ForgeObjectValue> = {};
  for (const knob of contract.knobs) values[knob.name] = knob.default;
  for (const [name, value] of Object.entries(input.values ?? {})) {
    if (!knownKnobs.has(name)) continue;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      values[name] = value;
    }
  }
  const mediaBindings = (input.mediaBindings ?? [])
    .filter((binding) => binding && typeof binding.knob === "string" && knownKnobs.get(binding.knob)?.type === "image")
    .map((binding) => ({
      knob: binding.knob,
      ...(binding.assetId ? { assetId: binding.assetId } : {}),
      ...(binding.href ? { href: binding.href } : {}),
      ...(binding.path ? { path: binding.path } : {}),
      ...(binding.kind ? { kind: binding.kind } : {}),
      ...(binding.label ? { label: binding.label } : {}),
    }));
  return {
    id,
    name,
    folder,
    html,
    css,
    js,
    ...(react ? { react } : {}),
    ...(capabilities.react || capabilities.gsap || capabilities.tailwind ? { capabilities } : {}),
    contract,
    components: contract.parts,
    variables: contract.knobs,
    actions: contract.actions,
    values,
    mediaBindings,
    createdAt: input.createdAt ?? now,
    updatedAt: now,
  };
}

export function readObjectLibrary(root: string): ForgeObject[] {
  const file = storePath(root);
  if (!fs.existsSync(file)) return [];
  const raw = JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => normalizeForgeObject(item as Partial<ForgeObject>));
}

export function writeObjectLibrary(root: string, objects: ForgeObject[]): void {
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(storePath(root), `${JSON.stringify(objects, null, 2)}\n`);
}

export function deleteForgeObject(root: string, id: string): ForgeObject[] {
  const objects = readObjectLibrary(root).filter((item) => item.id !== id);
  writeObjectLibrary(root, objects);
  return objects;
}

export function upsertForgeObject(root: string, input: Parameters<typeof normalizeForgeObject>[0]): ForgeObject {
  const objects = readObjectLibrary(root);
  const next = normalizeForgeObject(input);
  const index = objects.findIndex((item) => item.id === next.id);
  if (index >= 0) {
    next.createdAt = objects[index]!.createdAt;
    if (input.folder === undefined) next.folder = objects[index]!.folder;
    objects[index] = next;
  } else {
    objects.push(next);
  }
  objects.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  writeObjectLibrary(root, objects);
  return next;
}

export function moveForgeObjectToFolder(root: string, id: string, folderInput: unknown): ForgeObject[] {
  const objects = readObjectLibrary(root);
  const object = objects.find((item) => item.id === id);
  if (!object) return objects;
  object.folder = normalizeObjectFolder(folderInput);
  object.updatedAt = new Date().toISOString();
  objects.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  writeObjectLibrary(root, objects);
  return objects;
}
