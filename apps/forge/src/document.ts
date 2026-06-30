/**
 * The Forge Document — the staging model (FORGE.md §4).
 *
 * A Document is a *single-scene Sequences Project*, held in a real
 * `ProjectStore`. That is the whole trick to "powerful but not heavy": direct
 * manipulation on the stage is nothing but typed commands
 * (`MoveLayer`/`ResizeLayer`/`AddLayer`/`SetText`/…) through the one mutation
 * pathway (law 1), so Forge inherits undo/redo, the journal, validation, and
 * inverse-roundtrip for free, and the stage you see is literally `compile()`
 * output — the same HyperFrames player Sequences ships. No second engine.
 *
 * The staging canvas hosts objects as `customLayers` on an ordinary archetype;
 * the engine already materializes custom layers and applies box overrides to
 * them, so nothing here is Forge-special — it is the product's own model used
 * for authoring instead of consumption.
 */
import fs from "node:fs";
import path from "node:path";
import {
  compile,
  ProjectStore,
  type ApplyOutcome,
  type Asset,
  type Command,
  type CustomLayer,
  type EventEntry,
  type ManifestLayer,
  type Project,
  type Scene,
} from "@sequences/core";

/** The canonical Forge stage size — 16:9, lighter than 1080p, plenty to author. */
export const STAGE_WIDTH = 1280;
export const STAGE_HEIGHT = 720;

export type ObjectKind = "text" | "number" | "image" | "shape";

export interface AddObjectSpec {
  kind: ObjectKind;
  text?: string;
  number?: { value: number; prefix?: string; suffix?: string };
  assetId?: string;
  css?: string;
  box?: { x: number; y: number; w: number; h: number };
}

/** A manifest layer plus whether Forge may delete it (only custom layers). */
export interface DocLayer extends ManifestLayer {
  custom: boolean;
}

export interface DocOutline {
  sceneId: string;
  compositionId: string;
  width: number;
  height: number;
  fps: number;
  durationFrames: number;
  canUndo: boolean;
  canRedo: boolean;
  motionProfile: string;
  camera: { move: string; scale: string } | null;
  layers: DocLayer[];
  assets: Array<{ id: string; kind: string; path: string; reference: boolean; href: string }>;
}

/** A blank-ish starter stage: one headline on a quiet branded backdrop. */
export function blankDocumentProject(title = "Untitled forge"): Project {
  return {
    schemaVersion: 3,
    meta: { title, width: STAGE_WIDTH, height: STAGE_HEIGHT, fps: 30, background: "surface" },
    brand: {
      name: "Forge",
      colors: {
        primary: "#5B5BF0",
        surface: "#0E1016",
        text: "#F4F5F7",
        muted: "#9BA0AC",
        accent: "#27D9A1",
      },
      fonts: { display: "Inter", body: "Inter" },
    },
    motionProfile: "crisp-saas",
    extensions: { enabled: null },
    scenes: [
      {
        id: "stage",
        archetype: "hook-opener",
        durationFrames: 90,
        slots: { headline: "Your headline" },
        choreography: {},
        overrides: {},
        customLayers: [],
      } satisfies Scene as Scene,
    ],
    transitions: {},
    assets: [],
    audio: [],
  };
}

function defaultBox(kind: ObjectKind): { x: number; y: number; w: number; h: number } {
  switch (kind) {
    case "image":
      return { x: 340, y: 170, w: 600, h: 380 };
    case "shape":
      return { x: 490, y: 270, w: 300, h: 180 };
    case "number":
      return { x: 440, y: 290, w: 400, h: 140 };
    case "text":
    default:
      return { x: 440, y: 300, w: 400, h: 120 };
  }
}

function defaultLayer(kind: ObjectKind, spec: AddObjectSpec, id: string, rank: number): CustomLayer {
  const box = { ...(spec.box ?? defaultBox(kind)), origin: "center center" as const };
  switch (kind) {
    case "number":
      return {
        id,
        role: "support",
        rank,
        kind: "number",
        content: {
          number: {
            value: spec.number?.value ?? 100,
            prefix: spec.number?.prefix ?? "",
            suffix: spec.number?.suffix ?? "",
          },
        },
        box,
        typeToken: "display",
        colorToken: "text",
        align: "center",
      };
    case "image":
      return {
        id,
        role: "media",
        rank,
        kind: "image",
        content: { assetId: spec.assetId },
        box,
        align: "center",
      };
    case "shape":
      return {
        id,
        role: "decor",
        rank,
        kind: "shape",
        content: { css: spec.css ?? "#191c20" },
        box,
      };
    case "text":
    default:
      return {
        id,
        role: "support",
        rank,
        kind: "text",
        content: { text: spec.text ?? "Text" },
        box,
        typeToken: "title",
        colorToken: "text",
        align: "center",
      };
  }
}

export class ForgeDocument {
  readonly dir: string;
  /**
   * Assets imported as *reference* (the SaaS clip you're tracing) rather than
   * *example* media. Reference media is an authoring aid only and is excluded
   * from slot extraction on export (FORGE.md §8). Example media is everything
   * else.
   */
  readonly referenceAssetIds = new Set<string>();
  #store: ProjectStore;

  constructor(project: Project, dir: string, onEvent?: (entry: EventEntry) => void) {
    this.dir = path.resolve(dir);
    this.#store = new ProjectStore(project, onEvent);
  }

  markReference(assetId: string, isReference: boolean): void {
    if (isReference) this.referenceAssetIds.add(assetId);
    else this.referenceAssetIds.delete(assetId);
  }

  /** Create a fresh, near-blank document and ensure its assets/ dir exists. */
  static createBlank(dir: string, title?: string): ForgeDocument {
    const doc = new ForgeDocument(blankDocumentProject(title), dir);
    fs.mkdirSync(path.join(doc.dir, "assets"), { recursive: true });
    return doc;
  }

  get project(): Project {
    return this.#store.project;
  }

  get scene(): Scene {
    const scene = this.#store.project.scenes[0];
    if (!scene) throw new Error("forge document has no scene");
    return scene;
  }

  get sceneId(): string {
    return this.scene.id;
  }

  /** The one mutation pathway — every stage edit lands here (law 1). */
  apply(command: Command, source = "user"): ApplyOutcome {
    return this.#store.apply(command, source);
  }

  undo(): boolean {
    return this.#store.undo();
  }

  redo(): boolean {
    return this.#store.redo();
  }

  /** Allocate a stage object id that can't collide with existing layers. */
  nextObjectId(): string {
    const taken = new Set<string>([
      ...(this.scene.customLayers ?? []).map((l) => l.id),
      ...Object.keys(this.scene.slots),
      "decor-glow",
      "headline",
      "subline",
    ]);
    let n = 1;
    while (taken.has(`obj-${n}`)) n += 1;
    return `obj-${n}`;
  }

  /** Add a staged object as a custom layer (AddLayer command). */
  addObject(spec: AddObjectSpec): { ok: true; id: string } | { ok: false; outcome: ApplyOutcome } {
    const id = this.nextObjectId();
    const rank = 4 + (this.scene.customLayers ?? []).length;
    const layer = defaultLayer(spec.kind, spec, id, rank);
    const outcome = this.apply({ type: "AddLayer", sceneId: this.sceneId, layer });
    if (!outcome.ok) return { ok: false, outcome };
    return { ok: true, id };
  }

  /** Register an imported asset through the AddAsset command (one pathway). */
  addAsset(asset: Asset): ApplyOutcome {
    return this.apply({ type: "AddAsset", asset });
  }

  /** Compile the document to the HyperFrames player HTML (the stage). */
  html(): string {
    return compile(this.#store.project).html;
  }

  /** A flat, UI-facing description of the stage: every layer + its live box. */
  outline(): DocOutline {
    const result = compile(this.#store.project);
    const manifest = result.manifest;
    const mscene = manifest.scenes[0];
    const scene = this.scene;
    const customIds = new Set((scene.customLayers ?? []).map((l) => l.id));
    const layers: DocLayer[] = (mscene?.layers ?? []).map((layer) => ({
      ...layer,
      custom: customIds.has(layer.id),
    }));
    return {
      sceneId: scene.id,
      compositionId: manifest.compositionId,
      width: manifest.width,
      height: manifest.height,
      fps: manifest.fps,
      durationFrames: manifest.durationFrames,
      canUndo: this.#store.canUndo,
      canRedo: this.#store.canRedo,
      motionProfile: manifest.motionProfile,
      camera: mscene?.camera ?? null,
      layers,
      assets: this.#store.project.assets.map((a) => ({
        id: a.id,
        kind: a.kind,
        path: a.path,
        reference: this.referenceAssetIds.has(a.id),
        href: `/forge-assets/${encodeURIComponent(a.path)}`,
      })),
    };
  }
}
