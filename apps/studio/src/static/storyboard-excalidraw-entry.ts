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
const STORYBOARD_CANVAS_BG = "#e7e8eb";
const STORYBOARD_INK = "#111827";

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
      currentItemStrokeColor: STORYBOARD_INK,
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
  return {
    ids,
    count: ids.length,
    id: first ? String(first.id) : null,
    type: first ? String(first.type ?? "element") : null,
    text: typeof first?.text === "string" ? first.text : "",
    comment: commentOf(first),
    assetId: assetIdOf(first),
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

function StoryboardExcalidraw({
  options,
  bridge,
}: {
  options: BridgeOptions;
  bridge: Partial<BridgeHandle>;
}) {
  const apiRef = useRef<ExcalidrawApi | null>(null);
  const optionsRef = useRef(options);
  const fixedViewportRef = useRef<{ scrollX: number; scrollY: number; zoom: Record<string, unknown> } | null>(null);
  const restoringViewportRef = useRef(false);
  const lastClickRef = useRef<{ id: string | null; time: number }>({ id: null, time: 0 });
  const lastSelectionRef = useRef("");
  const [seed] = useState(() => `${options.frame.id}-${Date.now()}`);

  optionsRef.current = options;

  const notifySelection = useCallback((elements?: Record<string, any>[], appState?: Record<string, any>) => {
    const api = apiRef.current;
    if (!api) return;
    const summary = selectionSummary(elements ?? api.getSceneElements(), appState ?? api.getAppState());
    const signature = `${summary.ids.join(",")}|${summary.comment}|${summary.type}|${summary.assetId}`;
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
      persist(api.getSceneElementsIncludingDeleted() as Record<string, any>[], api.getAppState(), api.getFiles());
      notifySelection();
    },
    [notifySelection, persist],
  );

  const promptForElement = useCallback(
    (element: Record<string, any>) => {
      const next = window.prompt("Comment for AI - what should happen with this element?", commentOf(element));
      if (next === null) return;
      applyCommentToIds([String(element.id)], next);
    },
    [applyCommentToIds],
  );

  const lockViewport = useCallback(() => {
    const api = apiRef.current;
    if (!api) return;
    const fixed = {
      viewBackgroundColor: STORYBOARD_CANVAS_BG,
      currentItemStrokeColor: STORYBOARD_INK,
      scrollX: 0,
      scrollY: 0,
      zoom: { value: 1 },
      gridSize: null,
      gridModeEnabled: false,
    };
    fixedViewportRef.current = fixed;
    restoringViewportRef.current = true;
    api.updateScene({ appState: fixed });
    setTimeout(() => {
      restoringViewportRef.current = false;
    }, 0);
  }, []);

  useEffect(() => {
    bridge.setTool = (tool: string) => apiRef.current?.setActiveTool({ type: tool });
    bridge.setComment = (comment: string) => {
      const api = apiRef.current;
      if (!api) return;
      const selectedIds = Object.keys(api.getAppState().selectedElementIds ?? {}).filter(
        (id) => api.getAppState().selectedElementIds[id],
      );
      applyCommentToIds(selectedIds, comment);
    };
    bridge.clear = () => {
      const api = apiRef.current;
      if (!api) return;
      api.updateScene({
        elements: [],
        appState: { ...defaultAppState(optionsRef.current.palette), selectedElementIds: {} },
      });
      api.history?.clear?.();
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
  }, [applyCommentToIds]);

  return h(
    "div",
    { className: "sb-excal-root" },
    h(Excalidraw, {
      key: seed,
      initialData: initialData(options.frame, options.palette),
      excalidrawAPI: (api: ExcalidrawApi | null) => {
        apiRef.current = api;
        if (api) {
          setTimeout(() => {
            lockViewport();
            notifySelection();
          }, 0);
        }
      },
      onChange: persist,
      onScrollChange: (scrollX: number, scrollY: number, zoom: Record<string, unknown>) => {
        const api = apiRef.current;
        const fixed = fixedViewportRef.current;
        if (!api || !fixed || restoringViewportRef.current) return;
        if (scrollX === fixed.scrollX && scrollY === fixed.scrollY && (zoom as any)?.value === (fixed.zoom as any).value) {
          return;
        }
        restoringViewportRef.current = true;
        api.updateScene({ appState: fixed });
        setTimeout(() => {
          restoringViewportRef.current = false;
        }, 0);
      },
      onPointerUp: (_activeTool: unknown, pointerDownState: any) => {
        setTimeout(() => notifySelection(), 0);
        const hit = pointerDownState?.hit?.element;
        if (!hit || pointerDownState?.drag?.hasOccurred) return;
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
    async insertMedia() {},
    clear() {},
  };
  mounted.set(host, { root, handle });
  handle.update(options);
  return handle;
}

(window as any).SequenceStoryboardExcalidraw = { mount };
