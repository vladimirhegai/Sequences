import React, { useCallback, useEffect, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  Excalidraw,
  convertToExcalidrawElements,
  mutateElement,
  viewportCoordsToSceneCoords,
} from "@excalidraw/excalidraw";

type SeqAsset = {
  id: string;
  kind: "image" | "video" | "audio";
  path: string;
  href: string;
};

type StoryboardFrame = {
  id: string;
  name: string;
  comment?: string;
  items: unknown[];
  excalidraw?: {
    elements?: Record<string, unknown>[];
    appState?: Record<string, unknown>;
    files?: Record<string, unknown>;
  };
};

type Palette = {
  background: string;
  stroke: string;
  text: string;
  accent: string;
};

type SelectionSummary = {
  ids: string[];
  count: number;
  id: string | null;
  type: string | null;
  text: string;
  comment: string;
  assetId: string | null;
  fontFamily: number | null;
  fontSize: number | null;
  motionPathFor: string | null;
};

type BridgeOptions = {
  frame: StoryboardFrame;
  palette: Palette;
  onChange: (frame: StoryboardFrame) => void;
  onSelectionChange: (summary: SelectionSummary) => void;
  onToast?: (message: string, kind?: "err") => void;
};

type BridgeHandle = {
  update: (options: BridgeOptions) => void;
  unmount: () => void;
  setTool: (tool: string) => void;
  setComment: (comment: string) => void;
  setFontFamily: (family: number) => void;
  setFontSize: (size: number) => void;
  armMotionPath: () => boolean;
  insertMedia: (asset: SeqAsset) => Promise<void>;
  clear: () => void;
};

type ExcalidrawApi = {
  updateScene: (sceneData: Record<string, unknown>) => void;
  getSceneElements: () => Record<string, unknown>[];
  getSceneElementsIncludingDeleted: () => Record<string, unknown>[];
  getAppState: () => Record<string, any>;
  getFiles: () => Record<string, unknown>;
  addFiles: (files: Record<string, unknown>[]) => void;
  setActiveTool: (tool: { type: string; customType?: string | null }) => void;
  history?: { clear?: () => void };
};

const COMMENT_KEY = "sequenceAiComment";
const ASSET_KEY = "sequenceAssetId";
const MOTION_PATH_KEY = "sequenceMotionPathFor";
const STORYBOARD_CANVAS_BG = "#e7e8eb";
const STORYBOARD_INK = "#111827";
const MOTION_PATH_COLOR = "#c2255c";

/** The storyboard draws on a FIXED virtual 1280x720 stage; the viewport is
 * always fitted to it (zoom = host width / 1280, scroll locked at origin).
 * Scene coordinates are therefore stable across window sizes and machines —
 * the serializer can speak in "stage units" the agent can trust. */
const STAGE_W = 1280;
const STAGE_H = 720;

/** Excalidraw FONT_FAMILY ids (0.18) → CSS family names for measuring. */
const FONT_FAMILIES: Array<{ id: number; label: string; css: string }> = [
  { id: 5, label: "Excalifont (sketch)", css: "Excalifont" },
  { id: 1, label: "Virgil (sketch)", css: "Virgil" },
  { id: 6, label: "Nunito (clean)", css: "Nunito" },
  { id: 2, label: "Helvetica (clean)", css: "Helvetica" },
  { id: 9, label: "Liberation Sans", css: "Liberation Sans" },
  { id: 7, label: "Lilita One (display)", css: "Lilita One" },
  { id: 8, label: "Comic Shanns", css: "Comic Shanns" },
  { id: 3, label: "Cascadia (code)", css: "Cascadia" },
];

const h = React.createElement;

const mounted = new WeakMap<Element, { root: Root; handle: BridgeHandle }>();

function cleanComment(value: string): string | undefined {
  const clean = value.trim();
  return clean ? clean : undefined;
}

function commentOf(element: Record<string, any> | null | undefined): string {
  return String(element?.customData?.[COMMENT_KEY] ?? element?.customData?.commentForAI ?? "").trim();
}

function assetIdOf(element: Record<string, any> | null | undefined): string | null {
  const value = element?.customData?.[ASSET_KEY];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function motionPathTargetOf(element: Record<string, any> | null | undefined): string | null {
  const value = element?.customData?.[MOTION_PATH_KEY];
  return typeof value === "string" && value ? value : null;
}

function defaultAppState(palette: Palette) {
  return {
    viewBackgroundColor: STORYBOARD_CANVAS_BG,
    scrollX: 0,
    scrollY: 0,
    zoom: { value: 1 },
    currentItemStrokeColor: STORYBOARD_INK,
    currentItemBackgroundColor: "transparent",
    currentItemFillStyle: "hachure",
    currentItemStrokeWidth: 2,
    currentItemStrokeStyle: "solid",
    currentItemRoughness: 1,
    currentItemOpacity: 100,
    currentItemFontSize: 36,
  };
}

function initialData(frame: StoryboardFrame, palette: Palette) {
  return {
    elements: frame.excalidraw?.elements ?? [],
    appState: {
      ...defaultAppState(palette),
      ...(frame.excalidraw?.appState ?? {}),
      viewBackgroundColor: STORYBOARD_CANVAS_BG,
      scrollX: 0,
      scrollY: 0,
      zoom: { value: 1 },
      gridSize: null,
      gridModeEnabled: false,
      selectedElementIds: {},
    },
    files: frame.excalidraw?.files ?? {},
  };
}

function compactAppState(appState: Record<string, any>) {
  const keys = [
    "viewBackgroundColor",
    "currentItemStrokeColor",
    "currentItemBackgroundColor",
    "currentItemFillStyle",
    "currentItemStrokeWidth",
    "currentItemStrokeStyle",
    "currentItemRoughness",
    "currentItemOpacity",
    "currentItemFontFamily",
    "currentItemFontSize",
  ];
  return Object.fromEntries(keys.filter((key) => appState[key] !== undefined).map((key) => [key, appState[key]]));
}

function selectionSummary(elements: Record<string, any>[], appState: Record<string, any>): SelectionSummary {
  const selectedElementIds = appState.selectedElementIds ?? {};
  const ids = Object.keys(selectedElementIds).filter((id) => selectedElementIds[id]);
  const first = elements.find((element) => ids.includes(String(element.id)) && element.isDeleted !== true) ?? null;
  const isText = first?.type === "text";
  return {
    ids,
    count: ids.length,
    id: first ? String(first.id) : null,
    type: first ? String(first.type ?? "element") : null,
    text: typeof first?.text === "string" ? first.text : "",
    comment: commentOf(first),
    assetId: assetIdOf(first),
    fontFamily: isText ? Number(first?.fontFamily ?? 5) : null,
    fontSize: isText ? Number(first?.fontSize ?? 36) : null,
    motionPathFor: motionPathTargetOf(first),
  };
}

function mimeFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  if (ext === "svg") return "image/svg+xml";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  return "image/png";
}

function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("failed to read media"));
    reader.readAsDataURL(blob);
  });
}

function imageSize(dataURL: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth || 1280, height: img.naturalHeight || 720 });
    img.onerror = () => resolve({ width: 1280, height: 720 });
    img.src = dataURL;
  });
}

function sceneCenter(api: ExcalidrawApi): { x: number; y: number } {
  const appState = api.getAppState();
  return viewportCoordsToSceneCoords(
    {
      clientX: Number(appState.offsetLeft ?? 0) + Number(appState.width ?? 900) / 2,
      clientY: Number(appState.offsetTop ?? 0) + Number(appState.height ?? 500) / 2,
    },
    appState as any,
  );
}

/** Approximate text box re-measure after a font change (no public helper). */
const measureCanvas = typeof document !== "undefined" ? document.createElement("canvas") : null;
function measureTextBox(text: string, fontSize: number, fontFamilyId: number): { width: number; height: number } {
  const lines = String(text || " ").split("\n");
  const css = FONT_FAMILIES.find((f) => f.id === fontFamilyId)?.css ?? "Excalifont";
  const ctx = measureCanvas?.getContext("2d");
  let width = 0;
  if (ctx) {
    ctx.font = `${fontSize}px ${css}, Segoe UI, sans-serif`;
    for (const line of lines) width = Math.max(width, ctx.measureText(line).width);
  } else {
    width = Math.max(...lines.map((l) => l.length)) * fontSize * 0.6;
  }
  return { width: Math.max(10, Math.ceil(width)), height: Math.ceil(lines.length * fontSize * 1.25) };
}

function StoryboardExcalidraw({
  options,
  bridge,
}: {
  options: BridgeOptions;
  bridge: Partial<BridgeHandle>;
}) {
  const apiRef = useRef<ExcalidrawApi | null>(null);
  const optionsRef = useRef(options);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const restoringViewportRef = useRef(false);
  const lastClickRef = useRef<{ id: string | null; time: number }>({ id: null, time: 0 });
  const lastSelectionRef = useRef("");
  const motionPathArmRef = useRef<{ targetId: string; before: Set<string> } | null>(null);
  const [seed] = useState(() => `${options.frame.id}-${Date.now()}`);

  optionsRef.current = options;

  const notifySelection = useCallback((elements?: Record<string, any>[], appState?: Record<string, any>) => {
    const api = apiRef.current;
    if (!api) return;
    const summary = selectionSummary(elements ?? api.getSceneElements(), appState ?? api.getAppState());
    const signature = `${summary.ids.join(",")}|${summary.comment}|${summary.type}|${summary.assetId}|${summary.fontFamily}|${summary.fontSize}`;
    if (signature !== lastSelectionRef.current) {
      lastSelectionRef.current = signature;
      optionsRef.current.onSelectionChange(summary);
    }
  }, []);

  const persist = useCallback(
    (elements: readonly Record<string, any>[], appState: Record<string, any>, files: Record<string, unknown>) => {
      const frame = optionsRef.current.frame;
      optionsRef.current.onChange({
        ...frame,
        items: [],
        excalidraw: {
          elements: elements.map((element) => ({ ...element })),
          appState: compactAppState(appState),
          files: { ...files },
        },
      });
      notifySelection(elements as Record<string, any>[], appState);
    },
    [notifySelection],
  );

  const persistNow = useCallback(() => {
    const api = apiRef.current;
    if (!api) return;
    persist(api.getSceneElementsIncludingDeleted() as Record<string, any>[], api.getAppState(), api.getFiles());
  }, [persist]);

  const applyCommentToIds = useCallback(
    (ids: string[], comment: string) => {
      const api = apiRef.current;
      if (!api || ids.length === 0) return;
      const nextComment = cleanComment(comment);
      const elements = api.getSceneElementsIncludingDeleted();
      for (const element of elements) {
        if (!ids.includes(String(element.id))) continue;
        const customData = { ...((element.customData as Record<string, unknown> | undefined) ?? {}) };
        if (nextComment) customData[COMMENT_KEY] = nextComment;
        else delete customData[COMMENT_KEY];
        mutateElement(element as any, { customData });
      }
      api.updateScene({ elements, appState: api.getAppState() });
      persistNow();
      notifySelection();
    },
    [notifySelection, persistNow],
  );

  const promptForElement = useCallback(
    (element: Record<string, any>) => {
      const next = window.prompt("Comment for AI - what should happen with this element?", commentOf(element));
      if (next === null) return;
      applyCommentToIds([String(element.id)], next);
    },
    [applyCommentToIds],
  );

  /** Fit the locked viewport to the virtual 1280x720 stage. */
  const fitViewport = useCallback(() => {
    const api = apiRef.current;
    if (!api) return;
    const appState = api.getAppState();
    const width = Number(appState.width ?? 0) || rootRef.current?.clientWidth || 0;
    if (!width) return;
    const zoom = Math.max(0.1, Math.min(4, width / STAGE_W));
    restoringViewportRef.current = true;
    api.updateScene({
      appState: {
        viewBackgroundColor: STORYBOARD_CANVAS_BG,
        scrollX: 0,
        scrollY: 0,
        zoom: { value: zoom },
        gridSize: null,
        gridModeEnabled: false,
      },
    });
    setTimeout(() => {
      restoringViewportRef.current = false;
    }, 0);
  }, []);

  useEffect(() => {
    const node = rootRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => fitViewport());
    observer.observe(node);
    return () => observer.disconnect();
  }, [fitViewport]);

  useEffect(() => {
    bridge.setTool = (tool: string) => {
      const api = apiRef.current;
      if (motionPathArmRef.current) {
        // cancel an armed motion path — restore the borrowed stroke style
        motionPathArmRef.current = null;
        api?.updateScene({
          appState: { currentItemStrokeColor: STORYBOARD_INK, currentItemStrokeStyle: "solid" },
        });
      }
      api?.setActiveTool({ type: tool });
    };
    bridge.setComment = (comment: string) => {
      const api = apiRef.current;
      if (!api) return;
      const selectedIds = Object.keys(api.getAppState().selectedElementIds ?? {}).filter(
        (id) => api.getAppState().selectedElementIds[id],
      );
      applyCommentToIds(selectedIds, comment);
    };
    bridge.setFontFamily = (family: number) => {
      const api = apiRef.current;
      if (!api) return;
      const selected = api.getAppState().selectedElementIds ?? {};
      const elements = api.getSceneElementsIncludingDeleted();
      for (const element of elements) {
        if (!selected[String(element.id)] || element.type !== "text" || element.isDeleted) continue;
        const box = measureTextBox(String(element.text ?? ""), Number(element.fontSize ?? 36), family);
        mutateElement(element as any, { fontFamily: family, width: box.width, height: box.height });
      }
      api.updateScene({ elements, appState: { currentItemFontFamily: family } });
      persistNow();
    };
    bridge.setFontSize = (size: number) => {
      const api = apiRef.current;
      if (!api) return;
      const clamped = Math.max(8, Math.min(220, Math.round(size)));
      const selected = api.getAppState().selectedElementIds ?? {};
      const elements = api.getSceneElementsIncludingDeleted();
      for (const element of elements) {
        if (!selected[String(element.id)] || element.type !== "text" || element.isDeleted) continue;
        const family = Number(element.fontFamily ?? 5);
        const box = measureTextBox(String(element.text ?? ""), clamped, family);
        mutateElement(element as any, { fontSize: clamped, width: box.width, height: box.height });
      }
      api.updateScene({ elements, appState: { currentItemFontSize: clamped } });
      persistNow();
    };
    bridge.armMotionPath = () => {
      const api = apiRef.current;
      if (!api) return false;
      const appState = api.getAppState();
      const selectedIds = Object.keys(appState.selectedElementIds ?? {}).filter(
        (id) => appState.selectedElementIds[id],
      );
      const target = api
        .getSceneElements()
        .find((element) => selectedIds.includes(String(element.id)));
      if (!target) {
        optionsRef.current.onToast?.("select the object that should move first, then draw its path", "err");
        return false;
      }
      motionPathArmRef.current = {
        targetId: String(target.id),
        before: new Set(api.getSceneElementsIncludingDeleted().map((element) => String(element.id))),
      };
      api.setActiveTool({ type: "arrow" });
      api.updateScene({
        appState: {
          currentItemStrokeColor: MOTION_PATH_COLOR,
          currentItemStrokeStyle: "dashed",
        },
      });
      return true;
    };
    bridge.clear = () => {
      const api = apiRef.current;
      if (!api) return;
      motionPathArmRef.current = null;
      api.updateScene({
        elements: [],
        appState: { ...defaultAppState(optionsRef.current.palette), selectedElementIds: {} },
      });
      api.history?.clear?.();
      fitViewport();
      optionsRef.current.onToast?.("storyboard frame cleared");
    };
    bridge.insertMedia = async (asset: SeqAsset) => {
      const api = apiRef.current;
      if (!api) return;
      if (asset.kind !== "image") {
        optionsRef.current.onToast?.("storyboard can place image assets in Phase 1", "err");
        return;
      }
      const response = await fetch(asset.href);
      if (!response.ok) throw new Error(`could not load ${asset.id}`);
      const blob = await response.blob();
      const dataURL = await blobToDataURL(blob);
      const intrinsic = await imageSize(dataURL);
      const scale = Math.min(1, 520 / intrinsic.width, 320 / intrinsic.height);
      const width = Math.max(80, Math.round(intrinsic.width * scale));
      const height = Math.max(60, Math.round(intrinsic.height * scale));
      const center = sceneCenter(api);
      const fileId = `seq-${asset.id}-${Date.now().toString(36)}`;
      api.addFiles([
        {
          id: fileId,
          mimeType: blob.type || mimeFromPath(asset.path),
          dataURL,
          created: Date.now(),
        },
      ]);
      const [element] = convertToExcalidrawElements(
        [
          {
            type: "image",
            x: Math.round(center.x - width / 2),
            y: Math.round(center.y - height / 2),
            width,
            height,
            fileId,
            status: "saved",
            scale: [1, 1],
            customData: { [ASSET_KEY]: asset.id },
          } as any,
        ],
        { regenerateIds: true },
      );
      api.updateScene({
        elements: [...api.getSceneElementsIncludingDeleted(), element],
        appState: { selectedElementIds: { [element.id]: true } },
      });
      optionsRef.current.onToast?.(`placed "${asset.id}"`);
    };
  }, [applyCommentToIds, fitViewport, persistNow]);

  /** A motion-path arrow was just drawn while armed → stamp + restore. */
  const finalizeMotionPath = useCallback(() => {
    const api = apiRef.current;
    const armed = motionPathArmRef.current;
    if (!api || !armed) return;
    const appState = api.getAppState();
    if (appState.multiElement || appState.newElement) return; // still drawing
    const fresh = api
      .getSceneElements()
      .find(
        (element) =>
          !armed.before.has(String(element.id)) &&
          (element.type === "arrow" || element.type === "line"),
      );
    if (!fresh) return;
    motionPathArmRef.current = null;
    mutateElement(fresh as any, {
      customData: {
        ...((fresh.customData as Record<string, unknown> | undefined) ?? {}),
        [MOTION_PATH_KEY]: armed.targetId,
      },
      strokeColor: MOTION_PATH_COLOR,
      strokeStyle: "dashed",
    });
    api.setActiveTool({ type: "selection" });
    api.updateScene({
      elements: api.getSceneElementsIncludingDeleted(),
      appState: {
        currentItemStrokeColor: STORYBOARD_INK,
        currentItemStrokeStyle: "solid",
        selectedElementIds: { [String(fresh.id)]: true },
      },
    });
    persistNow();
    optionsRef.current.onToast?.("motion path attached — the agent reads it as movement during this beat");
  }, [persistNow]);

  return h(
    "div",
    { className: "sb-excal-root", ref: rootRef },
    h(Excalidraw, {
      key: seed,
      initialData: initialData(options.frame, options.palette),
      excalidrawAPI: (api: ExcalidrawApi | null) => {
        apiRef.current = api;
        if (api) {
          setTimeout(() => {
            fitViewport();
            notifySelection();
          }, 0);
        }
      },
      onChange: persist,
      onScrollChange: () => {
        if (restoringViewportRef.current) return;
        fitViewport();
      },
      onPointerUp: (_activeTool: unknown, pointerDownState: any) => {
        setTimeout(() => {
          finalizeMotionPath();
          notifySelection();
        }, 0);
        const hit = pointerDownState?.hit?.element;
        if (!hit || pointerDownState?.drag?.hasOccurred) return;
        if (hit.type === "text") return; // double-click on text = edit the text
        const now = Date.now();
        if (lastClickRef.current.id === hit.id && now - lastClickRef.current.time < 360) {
          lastClickRef.current = { id: null, time: 0 };
          promptForElement(hit);
        } else {
          lastClickRef.current = { id: hit.id, time: now };
        }
      },
      theme: "light",
      name: `${options.frame.name} - Sequences storyboard`,
      gridModeEnabled: false,
      detectScroll: false,
      handleKeyboardGlobally: false,
      aiEnabled: false,
      UIOptions: {
        canvasActions: {
          changeViewBackgroundColor: false,
          clearCanvas: false,
          export: false,
          loadScene: false,
          saveAsImage: false,
          saveToActiveFile: false,
          toggleTheme: false,
        },
        tools: { image: false },
      },
    } as any),
  );
}

function mount(host: Element, options: BridgeOptions): BridgeHandle {
  mounted.get(host)?.root.unmount();
  const root = createRoot(host);
  const handle: BridgeHandle = {
    update(nextOptions: BridgeOptions) {
      root.render(h(StoryboardExcalidraw, { options: nextOptions, bridge: handle }));
    },
    unmount() {
      root.unmount();
      mounted.delete(host);
    },
    setTool() {},
    setComment() {},
    setFontFamily() {},
    setFontSize() {},
    armMotionPath() {
      return false;
    },
    async insertMedia() {},
    clear() {},
  };
  mounted.set(host, { root, handle });
  handle.update(options);
  return handle;
}

(window as any).SequenceStoryboardExcalidraw = {
  mount,
  FONT_FAMILIES: FONT_FAMILIES.map(({ id, label }) => ({ id, label })),
  STAGE: { width: STAGE_W, height: STAGE_H },
};
