/**
 * The compiler — a pure one-way function `Project → HyperFrames HTML`.
 * Generated HTML is NEVER parsed back (the one architectural law).
 *
 * Emits against the verified HF 0.6.86 contract (see README_dev.md §"HF
 * contract"): seconds-based data-start/data-duration/data-track-index,
 * class="clip" with framework-owned visibility, viewport + composition-id
 * meta tags, and a paused GSAP timeline registered in window.__timelines
 * under the composition id, extended to the full duration via tl.set.
 *
 * Script files are referenced relative to the HTML (gsap.min.js,
 * CustomEase.min.js, hyperframe.runtime.iife.js); the host (studio/CLI)
 * copies them next to the compiled file — `vendorScripts` lists them.
 */
import type { Project } from "./schema.ts";
import { projectDurationFrames } from "./schema.ts";
import {
  BLUR_TOKENS,
  DISTANCE_TOKENS,
  EASING_TOKENS,
  framesToSeconds,
  SCALE_TOKENS,
  TYPE_TOKENS,
  type EasingToken,
} from "./tokens.ts";
import { PRIMITIVES, PROFILES } from "./registry/index.ts";
import type { EmitContext, GsapStep, MaterializedLayer } from "./registry/types.ts";
import { resolveProject, type ResolvedScene } from "./materialize.ts";
import type { ScheduledMotion } from "./solver.ts";

export const COMPILER_VERSION = "0.5.0";

export const VENDOR_SCRIPTS = ["gsap.min.js", "CustomEase.min.js", "hyperframe.runtime.iife.js"];

export interface ManifestMotion {
  primitive: string;
  startFrame: number; // absolute, project frames
  durationFrames: number;
  easing: string;
}

export interface ManifestLayer {
  id: string;
  role: string;
  rank: number;
  kind: string;
  label: string;
  box: { x: number; y: number; w: number; h: number };
  enter?: ManifestMotion;
  exit?: ManifestMotion;
  continuous?: ManifestMotion;
}

export interface Manifest {
  compositionId: string;
  compilerVersion: string;
  title: string;
  width: number;
  height: number;
  fps: number;
  durationFrames: number;
  durationSec: number;
  motionProfile: string;
  scenes: Array<{
    id: string;
    archetype: string;
    layout: string;
    startFrame: number;
    durationFrames: number;
    transitionAfter: string;
    camera?: { move: string; scale: string };
    diagnostics: ResolvedScene["schedule"]["diagnostics"];
    layers: ManifestLayer[];
  }>;
}

export interface CompileResult {
  html: string;
  manifest: Manifest;
  /** assetId → { sourcePath (project-relative), href (build-relative) } */
  assets: Array<{ assetId: string; sourcePath: string; href: string }>;
  vendorScripts: string[];
  /** Every step emitted, kept for the linter's easing-whitelist rule. */
  steps: Array<GsapStep & { sceneId: string; layerId: string | null }>;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function slug(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "untitled"
  );
}

export function runtimeEase(token: EasingToken): string {
  const easing = EASING_TOKENS[token];
  return easing.kind === "bezier" ? easing.runtimeName : easing.value;
}

/** All runtime ease strings the compiler may legally emit (linter whitelist). */
export function allowedRuntimeEases(): Set<string> {
  return new Set(
    Object.values(EASING_TOKENS).map((e) => (e.kind === "bezier" ? e.runtimeName : e.value)),
  );
}

function fmtNumber(num: { value: number; prefix: string; suffix: string }): string {
  return `${num.prefix}${Math.round(num.value).toLocaleString("en-US")}${num.suffix}`;
}

function layerLabel(layer: MaterializedLayer): string {
  if (layer.content.text !== undefined) return layer.content.text.slice(0, 40);
  if (layer.content.number) return fmtNumber(layer.content.number);
  if (layer.content.assetId) return `[${layer.content.assetId}]`;
  return `(${layer.kind})`;
}

function fontStack(name: string): string {
  return `'${name}', Inter, system-ui, -apple-system, 'Segoe UI', sans-serif`;
}

function emitLayerHtml(
  project: Project,
  layer: MaterializedLayer,
  containerId: string,
  assetHrefs: Map<string, string>,
): string {
  const typeScale = project.meta.height / 1080;
  const { box } = layer;
  const needsMask =
    (layer.motions.enter && PRIMITIVES[layer.motions.enter.primitive]?.needsMask) ?? false;
  const isImage = layer.kind === "image";

  const containerStyles: string[] = [
    `left:${box.x}px`,
    `top:${box.y}px`,
    `width:${box.w}px`,
    `height:${box.h}px`,
  ];
  if (layer.opacity !== undefined) containerStyles.push(`opacity:${layer.opacity}`);
  if (isImage) {
    containerStyles.push(
      `border-radius:${Math.round(16 * typeScale)}px`,
      `box-shadow:0 ${Math.round(24 * typeScale)}px ${Math.round(BLUR_TOKENS.heavy * 2 * typeScale)}px rgba(0,0,0,0.35)`,
    );
  }

  const innerStyles: string[] = [`transform-origin:${box.origin}`];
  const align = layer.align ?? "left";
  if (layer.kind === "text" || layer.kind === "number") {
    const type = TYPE_TOKENS[(layer.typeToken ?? "body") as keyof typeof TYPE_TOKENS];
    innerStyles.push(
      `font-family:${fontStack(project.brand.fonts.display)}`,
      `font-size:${Math.round(type.size * typeScale)}px`,
      `font-weight:${type.weight}`,
      `line-height:${type.lineHeight}`,
      `letter-spacing:${type.tracking}`,
      `color:var(--c-${layer.colorToken ?? "text"})`,
      `justify-content:${align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start"}`,
      `text-align:${align}`,
    );
  }
  if (layer.kind === "shape" && layer.content.css) {
    innerStyles.push(`background:${layer.content.css}`);
    if (layer.chrome) innerStyles.push(`border-radius:${layer.chrome.radius}px`);
  }

  let innerContent: string;
  if (layer.kind === "image") {
    const href = layer.content.assetId ? (assetHrefs.get(layer.content.assetId) ?? "") : "";
    innerContent = `<img class="seq-img" src="${escapeHtml(href)}" alt="" />`;
  } else if (layer.kind === "number") {
    innerContent = layer.content.number ? escapeHtml(fmtNumber(layer.content.number)) : "";
  } else if (layer.kind === "text" && layer.chrome) {
    const pad = `${Math.round(0.45 * 38 * typeScale)}px ${Math.round(1.4 * 38 * typeScale)}px`;
    innerContent = `<span class="seq-pill" style="background:${layer.chrome.background};border-radius:${layer.chrome.radius}px;padding:${pad}">${escapeHtml(layer.content.text ?? "")}</span>`;
  } else {
    innerContent = escapeHtml(layer.content.text ?? "");
  }

  const containerClass = `seq-layer${needsMask || isImage ? " seq-mask" : ""}`;
  return [
    `      <div id="${containerId}" class="${containerClass}" style="${containerStyles.join(";")}">`,
    `        <div class="seq-inner" style="${innerStyles.join(";")}">${innerContent}</div>`,
    `      </div>`,
  ].join("\n");
}

function buildEmitContext(
  project: Project,
  resolvedScene: ResolvedScene,
  layer: MaterializedLayer,
  scheduled: ScheduledMotion,
  containerId: string,
): EmitContext {
  const fps = project.meta.fps;
  const H = project.meta.height;
  const motion = scheduled.motion;
  return {
    containerSel: `#${containerId}`,
    innerSel: `#${containerId} > .seq-inner`,
    startSec: framesToSeconds(resolvedScene.startFrame + scheduled.startFrame, fps),
    durationSec: framesToSeconds(scheduled.durationFrames, fps),
    ease: runtimeEase(motion.easing),
    easingToken: motion.easing,
    distancePx: motion.distance ? Math.round(DISTANCE_TOKENS[motion.distance] * H) : 0,
    scale: motion.scale ? SCALE_TOKENS[motion.scale] : 1,
    sceneStartSec: framesToSeconds(resolvedScene.startFrame, fps),
    sceneDurationSec: framesToSeconds(resolvedScene.scene.durationFrames, fps),
    layer,
    fps,
    stageWidth: project.meta.width,
    stageHeight: project.meta.height,
  };
}

function stepToJs(step: GsapStep): string {
  switch (step.kind) {
    case "fromTo": {
      const to = { ...step.to, duration: step.durationSec, ease: step.ease };
      return `tl.fromTo(${JSON.stringify(step.target)},${JSON.stringify(step.from)},${JSON.stringify(to)},${step.atSec});`;
    }
    case "to": {
      const vars = { ...step.vars, duration: step.durationSec, ease: step.ease };
      return `tl.to(${JSON.stringify(step.target)},${JSON.stringify(vars)},${step.atSec});`;
    }
    case "set":
      return `tl.set(${JSON.stringify(step.target)},${JSON.stringify(step.vars)},${step.atSec});`;
    case "custom":
      return step.code;
  }
}

export function transitionAfter(project: Project, sceneId: string): "cut" | "fade" {
  return (
    project.transitions[sceneId] ?? PROFILES[project.motionProfile]?.defaults.transition ?? "cut"
  );
}

export function compile(project: Project): CompileResult {
  const { width: W, height: H, fps } = project.meta;
  const resolved = resolveProject(project);
  const totalFrames = projectDurationFrames(project);
  const totalSec = framesToSeconds(totalFrames, fps);
  const compositionId = `seq-${slug(project.meta.title)}`;

  const assetHrefs = new Map<string, string>();
  const assets: CompileResult["assets"] = [];
  for (const asset of project.assets) {
    const base = asset.path.split(/[\\/]/).pop() ?? asset.path;
    const href = `assets/${base}`;
    assetHrefs.set(asset.id, href);
    assets.push({ assetId: asset.id, sourcePath: asset.path, href });
  }

  const sceneHtml: string[] = [];
  const steps: CompileResult["steps"] = [];
  const manifestScenes: Manifest["scenes"] = [];

  resolved.forEach((rs, sceneIndex) => {
    const { scene, layers, schedule, startFrame } = rs;
    const sceneElId = `sc-${scene.id}`;
    const startSec = framesToSeconds(startFrame, fps);
    const durSec = framesToSeconds(scene.durationFrames, fps);

    const layerHtml = layers
      .map((layer) => emitLayerHtml(project, layer, `${sceneElId}__${layer.id}`, assetHrefs))
      .join("\n");
    // Every scene gets a stage wrapper; camera moves transform the WHOLE
    // frame (the "filmed motion graphics" look), never individual layers.
    sceneHtml.push(
      `    <div id="${sceneElId}" class="clip seq-scene" data-start="${startSec}" data-duration="${durSec}" data-track-index="0">\n` +
        `      <div class="seq-camera">\n${layerHtml}\n      </div>\n` +
        `    </div>`,
    );

    if (scene.camera) {
      const travel = SCALE_TOKENS[scene.camera.scale];
      const [fromScale, toScale] = scene.camera.move === "pushIn" ? [1, travel] : [travel, 1];
      steps.push({
        kind: "fromTo",
        target: `#${sceneElId} > .seq-camera`,
        from: { scale: fromScale },
        to: { scale: toScale },
        durationSec: durSec,
        ease: runtimeEase("move.glide"),
        atSec: startSec,
        sceneId: scene.id,
        layerId: null,
      });
    }

    const manifestLayers: ManifestLayer[] = layers.map((layer) => ({
      id: layer.id,
      role: layer.role,
      rank: layer.rank,
      kind: layer.kind,
      label: layerLabel(layer),
      box: { x: layer.box.x, y: layer.box.y, w: layer.box.w, h: layer.box.h },
    }));

    for (const scheduled of schedule.motions) {
      const layer = layers.find((l) => l.id === scheduled.layerId);
      if (!layer) continue;
      const primitive = PRIMITIVES[scheduled.motion.primitive];
      if (!primitive) throw new Error(`compile: unknown primitive ${scheduled.motion.primitive}`);
      const containerId = `${sceneElId}__${layer.id}`;
      const ctx = buildEmitContext(project, rs, layer, scheduled, containerId);
      for (const step of primitive.emit(ctx)) {
        steps.push({ ...step, sceneId: scene.id, layerId: layer.id });
      }
      const manifestLayer = manifestLayers.find((ml) => ml.id === layer.id)!;
      manifestLayer[scheduled.phase] = {
        primitive: scheduled.motion.primitive,
        startFrame: startFrame + scheduled.startFrame,
        durationFrames: scheduled.durationFrames,
        easing: scheduled.motion.easing,
      };
    }

    // Cross-scene transition: 'fade' = fade-through-background (out then in,
    // no track overlap needed). 'cut' = nothing; HF visibility does the cut.
    const isLast = sceneIndex === resolved.length - 1;
    const kind = isLast ? "cut" : transitionAfter(project, scene.id);
    const fadeSec = framesToSeconds(10, fps); // duration token "quick"
    if (kind === "fade") {
      steps.push({
        kind: "to",
        target: `#${sceneElId}`,
        vars: { opacity: 0 },
        durationSec: fadeSec,
        ease: runtimeEase("exit.fade"),
        atSec: Math.max(startSec, startSec + durSec - fadeSec),
        sceneId: scene.id,
        layerId: null,
      });
      const nextScene = resolved[sceneIndex + 1]!;
      steps.push({
        kind: "fromTo",
        target: `#sc-${nextScene.scene.id}`,
        from: { opacity: 0 },
        to: { opacity: 1 },
        durationSec: fadeSec,
        ease: runtimeEase("enter.glide"),
        atSec: framesToSeconds(nextScene.startFrame, fps),
        sceneId: nextScene.scene.id,
        layerId: null,
      });
    }

    manifestScenes.push({
      id: scene.id,
      archetype: scene.archetype,
      layout: scene.layout ?? "",
      startFrame,
      durationFrames: scene.durationFrames,
      transitionAfter: isLast ? "" : kind,
      ...(scene.camera ? { camera: { move: scene.camera.move, scale: scene.camera.scale } } : {}),
      diagnostics: schedule.diagnostics,
      layers: manifestLayers,
    });
  });

  // CustomEase registrations for every bezier token (the whole whitelist).
  const easeRegistrations = Object.values(EASING_TOKENS)
    .filter((e): e is Extract<typeof e, { kind: "bezier" }> => e.kind === "bezier")
    .map((e) => `CustomEase.create(${JSON.stringify(e.runtimeName)},${JSON.stringify(e.curve)});`)
    .join("\n      ");

  const stepJs = steps.map((s) => `      ${stepToJs(s)}`).join("\n");

  const colors = project.brand.colors;
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=${W}, height=${H}" />
  <title>${escapeHtml(project.meta.title)}</title>
  <link rel="icon" href="data:," />
  <script src="gsap.min.js"></script>
  <script src="CustomEase.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: ${W}px; height: ${H}px; overflow: hidden; background: #000; }
    :root {
      --c-primary: ${colors.primary};
      --c-surface: ${colors.surface};
      --c-text: ${colors.text};
      --c-muted: ${colors.muted};
      --c-accent: ${colors.accent};
    }
    #stage { position: relative; width: ${W}px; height: ${H}px; overflow: hidden; font-family: ${fontStack(project.brand.fonts.body)}; }
    .clip { position: absolute; top: 0; left: 0; width: 100%; height: 100%; visibility: hidden; }
    .seq-scene { background: var(--c-${project.meta.background}); }
    .seq-camera { position: absolute; top: 0; left: 0; width: 100%; height: 100%; transform-origin: center center; }
    .seq-layer { position: absolute; }
    .seq-mask { overflow: hidden; }
    .seq-inner { width: 100%; height: 100%; display: flex; align-items: center; }
    .seq-img { width: 100%; height: 100%; object-fit: cover; display: block; }
  </style>
</head>
<body>
  <div id="stage" data-composition-id="${compositionId}" data-width="${W}" data-height="${H}">
${sceneHtml.join("\n")}
  </div>
  <script>
    window.__timelines = window.__timelines || {};
    (function () {
      gsap.registerPlugin(CustomEase);
      ${easeRegistrations}
      var tl = gsap.timeline({ paused: true });
${stepJs}
      tl.set({}, {}, ${totalSec}); /* extend timeline to full composition duration */
      window.__timelines[${JSON.stringify(compositionId)}] = tl;
    })();
  </script>
  <script src="hyperframe.runtime.iife.js"></script>
</body>
</html>
`;

  const manifest: Manifest = {
    compositionId,
    compilerVersion: COMPILER_VERSION,
    title: project.meta.title,
    width: W,
    height: H,
    fps,
    durationFrames: totalFrames,
    durationSec: totalSec,
    motionProfile: project.motionProfile,
    scenes: manifestScenes,
  };

  return { html, manifest, assets, vendorScripts: VENDOR_SCRIPTS, steps };
}
