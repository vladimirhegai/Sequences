/**
 * The Phase-1 motion primitive set (16 — full planned set; camera moves live
 * in registry/camera.ts as scene-level stage transforms, not primitives).
 *
 * Every primitive is token-pure: it computes exclusively from EmitContext
 * values that the compiler resolved from tokens. `maskRevealUp` is here per
 * the review amendment ("first primitives implemented after fadeIn").
 */
import type { EmitContext, GsapStep, MotionPrimitive } from "./types.ts";

function js(value: string): string {
  return JSON.stringify(value);
}

export const fadeIn: MotionPrimitive = {
  id: "enter.fadeIn",
  kind: "enter",
  summary:
    "Plain opacity entrance. The neutral default — use for supporting copy and decor; never the hero of a scene.",
  tags: { energy: "calm", style: "organic" },
  defaults: { duration: "base", easing: "enter.glide" },
  emit(ctx: EmitContext): GsapStep[] {
    return [
      {
        kind: "fromTo",
        target: ctx.innerSel,
        from: { opacity: 0 },
        to: { opacity: 1 },
        durationSec: ctx.durationSec,
        ease: ctx.ease,
        atSec: ctx.startSec,
      },
    ];
  },
};

export const slideUpSoft: MotionPrimitive = {
  id: "enter.slideUpSoft",
  kind: "enter",
  summary:
    "Rises a short distance while fading in. The workhorse entrance for body copy, bullets, captions.",
  tags: { energy: "calm", style: "organic" },
  defaults: { duration: "base", easing: "enter.glide", distance: "step" },
  emit(ctx: EmitContext): GsapStep[] {
    return [
      {
        kind: "fromTo",
        target: ctx.innerSel,
        from: { y: ctx.distancePx, opacity: 0 },
        to: { y: 0, opacity: 1 },
        durationSec: ctx.durationSec,
        ease: ctx.ease,
        atSec: ctx.startSec,
      },
    ];
  },
};

export const maskRevealUp: MotionPrimitive = {
  id: "enter.maskRevealUp",
  kind: "enter",
  summary:
    "Text rises out of an invisible line (clip-mask wipe). The signature SaaS reveal — best for headlines; pairs with crisp profiles.",
  tags: { energy: "punchy", style: "mechanical" },
  defaults: { duration: "base", easing: "enter.snap" },
  needsMask: true,
  emit(ctx: EmitContext): GsapStep[] {
    return [
      {
        kind: "fromTo",
        target: ctx.innerSel,
        from: { yPercent: 110 },
        to: { yPercent: 0 },
        durationSec: ctx.durationSec,
        ease: ctx.ease,
        atSec: ctx.startSec,
      },
    ];
  },
};

export const slideInDirectional: MotionPrimitive = {
  id: "enter.slideInDirectional",
  kind: "enter",
  summary:
    "Slides in from the nearest horizontal edge based on layer position. Use for UI panels, walkthrough callouts, and interface pieces that should feel spatial.",
  tags: { energy: "punchy", style: "mechanical" },
  defaults: { duration: "base", easing: "enter.snap", distance: "travel" },
  emit(ctx: EmitContext): GsapStep[] {
    const centerX = ctx.layer.box.x + ctx.layer.box.w / 2;
    const fromX = centerX < ctx.stageWidth / 2 ? -ctx.distancePx : ctx.distancePx;
    return [
      {
        kind: "fromTo",
        target: ctx.innerSel,
        from: { x: fromX, opacity: 0 },
        to: { x: 0, opacity: 1 },
        durationSec: ctx.durationSec,
        ease: ctx.ease,
        atSec: ctx.startSec,
      },
    ];
  },
};

export const blurIn: MotionPrimitive = {
  id: "enter.blurIn",
  kind: "enter",
  summary:
    "Fades in through a soft defocus. Use sparingly for screenshots and atmospheric support, never for dense copy.",
  tags: { energy: "calm", style: "organic" },
  defaults: { duration: "relaxed", easing: "enter.glide", distance: "step" },
  emit(ctx: EmitContext): GsapStep[] {
    const blurPx = Math.max(4, Math.round(ctx.distancePx * 0.18));
    return [
      {
        kind: "fromTo",
        target: ctx.innerSel,
        from: { opacity: 0, filter: `blur(${blurPx}px)` },
        to: { opacity: 1, filter: "blur(0px)" },
        durationSec: ctx.durationSec,
        ease: ctx.ease,
        atSec: ctx.startSec,
      },
    ];
  },
};

export const charCascade: MotionPrimitive = {
  id: "enter.charCascade",
  kind: "enter",
  summary:
    "Character-by-character kinetic type. Best for a short hook word or logo sting; avoid on paragraphs and long product copy.",
  tags: { energy: "punchy", style: "mechanical" },
  defaults: { duration: "relaxed", easing: "enter.snap" },
  emit(ctx: EmitContext): GsapStep[] {
    const stagger = Math.round((ctx.durationSec / 18) * 1000) / 1000;
    // Chars are inline-block (yPercent transforms need it), grouped into
    // per-word nowrap spans separated by real spaces. Everything sits in one
    // block wrapper because the layer's .seq-inner is a flex container —
    // bare text-node spaces would be ignored as flex items and long copy
    // would never wrap.
    const code =
      `(function(){var el=document.querySelector(${js(ctx.innerSel)});if(!el)return;` +
      `var text=el.textContent||"";el.textContent="";var spans=[];` +
      `var wrap=document.createElement("span");wrap.style.display="block";wrap.style.width="100%";` +
      `var words=text.split(" ");` +
      `for(var w=0;w<words.length;w++){` +
      `if(w>0)wrap.appendChild(document.createTextNode(" "));` +
      `var ws=document.createElement("span");ws.style.display="inline-block";ws.style.whiteSpace="nowrap";` +
      `for(var i=0;i<words[w].length;i++){var s=document.createElement("span");` +
      `s.textContent=words[w][i];s.style.display="inline-block";` +
      `ws.appendChild(s);spans.push(s);}` +
      `wrap.appendChild(ws);}` +
      `el.appendChild(wrap);` +
      `tl.fromTo(spans,{yPercent:80,opacity:0},{yPercent:0,opacity:1,duration:${ctx.durationSec},ease:${js(ctx.ease)},stagger:${stagger}},${ctx.startSec});})();`;
    return [{ kind: "custom", code, easesUsed: [ctx.ease] }];
  },
};

export const scaleIn: MotionPrimitive = {
  id: "enter.scaleIn",
  kind: "enter",
  summary:
    "Scales up from slightly small while fading in, from the layer's anchor. Use for media, cards, badges — not paragraphs.",
  tags: { energy: "punchy", style: "organic" },
  defaults: { duration: "base", easing: "enter.settle", scale: "pop" },
  emit(ctx: EmitContext): GsapStep[] {
    const fromScale = Math.round((1 / ctx.scale) * 1000) / 1000;
    return [
      {
        kind: "fromTo",
        target: ctx.innerSel,
        from: { scale: fromScale, opacity: 0 },
        to: { scale: 1, opacity: 1 },
        durationSec: ctx.durationSec,
        ease: ctx.ease,
        atSec: ctx.startSec,
      },
    ];
  },
};

export const countUp: MotionPrimitive = {
  id: "enter.countUp",
  kind: "enter",
  summary:
    "Number tween for stat callouts: counts to the final value with a hard ease-out, snapping exactly. Auto-assigned to number slots.",
  tags: { energy: "punchy", style: "mechanical" },
  defaults: { duration: "slow", easing: "enter.snap" },
  emit(ctx: EmitContext): GsapStep[] {
    const num = ctx.layer.content.number ?? { value: 0, prefix: "", suffix: "" };
    // Counters never run linear and must land on the exact value (Part V §5).
    const code =
      `(function(){var el=document.querySelector(${js(ctx.innerSel)});` +
      `var o={v:0};var fmt=function(v){return ${js(num.prefix)}+Math.round(v).toLocaleString("en-US")+${js(num.suffix)};};` +
      `el.textContent=fmt(0);` +
      `tl.fromTo(${js(ctx.innerSel)},{opacity:0},{opacity:1,duration:${Math.min(0.3, ctx.durationSec)},ease:${js(ctx.ease)}},${ctx.startSec});` +
      `tl.to(o,{v:${num.value},duration:${ctx.durationSec},ease:${js(ctx.ease)},onUpdate:function(){el.textContent=fmt(o.v);}},${ctx.startSec});})();`;
    return [{ kind: "custom", code, easesUsed: [ctx.ease] }];
  },
};

export const fadeDown: MotionPrimitive = {
  id: "exit.fadeDown",
  kind: "exit",
  summary: "Quiet exit: fades while drifting down a nudge. Default soft-profile exit.",
  tags: { energy: "calm", style: "organic" },
  defaults: { duration: "quick", easing: "exit.fade", distance: "nudge" },
  emit(ctx: EmitContext): GsapStep[] {
    return [
      {
        kind: "to",
        target: ctx.innerSel,
        vars: { opacity: 0, y: ctx.distancePx },
        durationSec: ctx.durationSec,
        ease: ctx.ease,
        atSec: ctx.startSec,
      },
    ];
  },
};

export const slideExit: MotionPrimitive = {
  id: "exit.slideExit",
  kind: "exit",
  summary: "Departs upward with acceleration (slow-out, fast-in). Use when the next scene continues the motion direction.",
  tags: { energy: "punchy", style: "mechanical" },
  defaults: { duration: "quick", easing: "exit.swift", distance: "step" },
  emit(ctx: EmitContext): GsapStep[] {
    return [
      {
        kind: "to",
        target: ctx.innerSel,
        vars: { opacity: 0, y: -ctx.distancePx },
        durationSec: ctx.durationSec,
        ease: ctx.ease,
        atSec: ctx.startSec,
      },
    ];
  },
};

export const scaleAway: MotionPrimitive = {
  id: "exit.scaleAway",
  kind: "exit",
  summary:
    "Shrinks away from the layer anchor while fading out. Use for cards, badges, and UI pieces that should clear decisively.",
  tags: { energy: "punchy", style: "organic" },
  defaults: { duration: "quick", easing: "exit.swift", scale: "subtle" },
  emit(ctx: EmitContext): GsapStep[] {
    const toScale = Math.round((1 / ctx.scale) * 1000) / 1000;
    return [
      {
        kind: "to",
        target: ctx.innerSel,
        vars: { opacity: 0, scale: toScale },
        durationSec: ctx.durationSec,
        ease: ctx.ease,
        atSec: ctx.startSec,
      },
    ];
  },
};

export const pop: MotionPrimitive = {
  id: "emphasis.pop",
  kind: "emphasis",
  summary:
    "Quick scale punch and settle on the layer's anchor. One per scene max — emphasis is loud by definition.",
  tags: { energy: "punchy", style: "organic" },
  defaults: { duration: "quick", easing: "enter.settle", scale: "pop" },
  emit(ctx: EmitContext): GsapStep[] {
    const half = Math.round((ctx.durationSec / 2) * 1000) / 1000;
    return [
      {
        kind: "to",
        target: ctx.innerSel,
        vars: { scale: ctx.scale },
        durationSec: half,
        ease: ctx.ease,
        atSec: ctx.startSec,
      },
      {
        kind: "to",
        target: ctx.innerSel,
        vars: { scale: 1 },
        durationSec: half,
        ease: ctx.ease,
        atSec: ctx.startSec + half,
      },
    ];
  },
};

export const pulseGlow: MotionPrimitive = {
  id: "emphasis.pulseGlow",
  kind: "emphasis",
  summary:
    "A brief accent-colored glow pulse. Use to call attention to one metric, CTA, or UI hotspot; one per scene maximum.",
  tags: { energy: "punchy", style: "organic" },
  defaults: { duration: "quick", easing: "enter.settle", distance: "nudge" },
  emit(ctx: EmitContext): GsapStep[] {
    const glow = Math.max(12, Math.round(ctx.distancePx * 1.5));
    const half = Math.round((ctx.durationSec / 2) * 1000) / 1000;
    return [
      {
        kind: "to",
        target: ctx.innerSel,
        vars: { boxShadow: `0 0 ${glow}px var(--c-accent)` },
        durationSec: half,
        ease: ctx.ease,
        atSec: ctx.startSec,
      },
      {
        kind: "to",
        target: ctx.innerSel,
        vars: { boxShadow: "0 0 0 rgba(0,0,0,0)" },
        durationSec: half,
        ease: ctx.ease,
        atSec: ctx.startSec + half,
      },
    ];
  },
};

export const underlineSweep: MotionPrimitive = {
  id: "emphasis.underlineSweep",
  kind: "emphasis",
  summary:
    "Draws an accent underline under text. Use for the one keyword that matters; pairs best with clean SaaS copy.",
  tags: { energy: "calm", style: "mechanical" },
  defaults: { duration: "base", easing: "move.glide" },
  emit(ctx: EmitContext): GsapStep[] {
    const code =
      `(function(){var el=document.querySelector(${js(ctx.innerSel)});if(!el)return;` +
      `el.style.backgroundImage="linear-gradient(var(--c-accent),var(--c-accent))";` +
      `el.style.backgroundRepeat="no-repeat";el.style.backgroundPosition="0 95%";` +
      `el.style.backgroundSize="0% 0.08em";` +
      `tl.to(${js(ctx.innerSel)},{backgroundSize:"100% 0.08em",duration:${ctx.durationSec},ease:${js(ctx.ease)}},${ctx.startSec});})();`;
    return [{ kind: "custom", code, easesUsed: [ctx.ease] }];
  },
};

export const kenBurns: MotionPrimitive = {
  id: "continuous.kenBurns",
  kind: "continuous",
  summary:
    "Slow scale-and-drift on screenshots/media for the whole scene. Sub-perceptual; keeps held frames alive.",
  tags: { energy: "calm", style: "organic" },
  defaults: { duration: "dramatic", easing: "linear.mech", scale: "subtle", distance: "nudge" },
  emit(ctx: EmitContext): GsapStep[] {
    return [
      {
        kind: "fromTo",
        target: ctx.innerSel,
        from: { scale: 1, x: 0 },
        to: { scale: ctx.scale, x: -ctx.distancePx },
        durationSec: ctx.sceneDurationSec,
        ease: ctx.ease,
        atSec: ctx.sceneStartSec,
      },
    ];
  },
};

export const floatIdle: MotionPrimitive = {
  id: "continuous.floatIdle",
  kind: "continuous",
  summary:
    "A quiet up-and-back drift for held UI cards or badges. Secondary motion only; keep it much quieter than foreground entrances.",
  tags: { energy: "calm", style: "organic" },
  defaults: { duration: "dramatic", easing: "move.glide", distance: "nudge" },
  emit(ctx: EmitContext): GsapStep[] {
    const half = Math.round((ctx.sceneDurationSec / 2) * 1000) / 1000;
    return [
      {
        kind: "to",
        target: ctx.innerSel,
        vars: { y: -ctx.distancePx },
        durationSec: half,
        ease: ctx.ease,
        atSec: ctx.sceneStartSec,
      },
      {
        kind: "to",
        target: ctx.innerSel,
        vars: { y: 0 },
        durationSec: half,
        ease: ctx.ease,
        atSec: ctx.sceneStartSec + half,
      },
    ];
  },
};

export const PRIMITIVES: Record<string, MotionPrimitive> = Object.fromEntries(
  [
    fadeIn,
    slideUpSoft,
    maskRevealUp,
    slideInDirectional,
    blurIn,
    charCascade,
    scaleIn,
    countUp,
    fadeDown,
    slideExit,
    scaleAway,
    pop,
    pulseGlow,
    underlineSweep,
    kenBurns,
    floatIdle,
  ].map((p) => [p.id, p]),
);
