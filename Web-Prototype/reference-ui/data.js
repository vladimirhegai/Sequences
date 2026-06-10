/* ============================================================
   SEQUENCES — data model (scene graph, motion system, agent)
   Plain JS, attached to window.SEQ
   ============================================================ */
(function () {
  const FPS = 30;

  // ---- motion tokens (the lattice, T1) ----
  const TOKENS = {
    duration: [
      { id: "instant", val: "6f" }, { id: "quick", val: "10f" },
      { id: "base", val: "16f" }, { id: "relaxed", val: "24f" },
      { id: "slow", val: "36f" }, { id: "dramatic", val: "54f" },
    ],
    easeEnter: [
      { id: "snap", val: ".2,.9,.3,1" }, { id: "glide", val: ".35,0,.15,1" },
      { id: "settle", val: "+3%" }, { id: "springSoft", val: "elastic" },
    ],
    distance: [
      { id: "nudge", val: "2%" }, { id: "step", val: "6%" },
      { id: "travel", val: "14%" }, { id: "sweep", val: "40%" },
    ],
    scale: [
      { id: "subtle", val: "1.03" }, { id: "pop", val: "1.12" }, { id: "hero", val: "1.35" },
    ],
    stagger: [
      { id: "tight", val: "2f" }, { id: "base", val: "4f" }, { id: "loose", val: "7f" },
    ],
  };

  // ---- primitives (~14, T1) ----
  const PRIMITIVES = {
    enter: [
      { id: "fadeIn", label: "enter.fadeIn", desc: "Opacity 0→1" },
      { id: "slideUpSoft", label: "enter.slideUpSoft", desc: "Rise + fade" },
      { id: "slideInDirectional", label: "enter.slideInDirectional", desc: "Travel from edge" },
      { id: "scaleIn", label: "enter.scaleIn", desc: "Scale from anchor" },
      { id: "maskRevealUp", label: "enter.maskRevealUp", desc: "Clip-path wipe up" },
      { id: "blurIn", label: "enter.blurIn", desc: "Defocus → sharp" },
      { id: "charCascade", label: "enter.charCascade", desc: "Per-char rise (SplitText)" },
    ],
    exit: [
      { id: "fadeDown", label: "exit.fadeDown", desc: "Fade + sink" },
      { id: "slideExit", label: "exit.slideExit", desc: "Travel off-edge" },
      { id: "scaleAway", label: "exit.scaleAway", desc: "Scale + fade out" },
    ],
    emphasis: [
      { id: "pop", label: "emphasis.pop", desc: "Quick scale accent" },
      { id: "pulseGlow", label: "emphasis.pulseGlow", desc: "Soft glow pulse" },
      { id: "countUp", label: "emphasis.countUp", desc: "Number tween" },
      { id: "underlineSweep", label: "emphasis.underlineSweep", desc: "Wipe underline" },
    ],
    continuous: [
      { id: "kenBurns", label: "cont.kenBurns", desc: "Slow scale + drift" },
      { id: "floatIdle", label: "cont.floatIdle", desc: "Sub-perceptual hover" },
    ],
  };
  const ALL_ENTER = PRIMITIVES.enter;

  // ---- archetypes (6) ----
  const ARCHETYPES = {
    "hook-opener":   { id: "hook-opener",   name: "Hook Opener",   icon: "bolt" },
    "feature-reveal":{ id: "feature-reveal",name: "Feature Reveal",icon: "device" },
    "stat-callout":  { id: "stat-callout",  name: "Stat Callout",  icon: "stat" },
    "ui-walkthrough":{ id: "ui-walkthrough",name: "UI Walkthrough",icon: "cursorArrow" },
    "social-proof":  { id: "social-proof",  name: "Social Proof",  icon: "quote" },
    "logo-sting-cta":{ id: "logo-sting-cta",name: "Logo Sting · CTA",icon: "sparkle" },
  };

  // ---- profiles (3) ----
  const PROFILES = {
    "crisp-saas":  { id: "crisp-saas",  name: "Crisp SaaS",  desc: "Quick · snap/glide · hard cuts · mask reveals",
                     swatches: ["#c0843f", "#d79e5b", "#8a5d2b"] },
    "warm-startup":{ id: "warm-startup",name: "Warm Startup",desc: "Relaxed · settle · fades + soft slides",
                     swatches: ["#b07a4a", "#caa06b", "#7d5a36"] },
    "bold-launch": { id: "bold-launch", name: "Bold Launch", desc: "Dramatic · springs · scale-heavy · shaders",
                     swatches: ["#c8703f", "#e0935a", "#93502b"] },
  };

  // ---- brand kit ----
  const BRAND = {
    name: "Northwind",
    colors: [
      { id: "primary", name: "Primary", hex: "#c0843f" },
      { id: "surface", name: "Surface", hex: "#15120e" },
      { id: "text",    name: "Text",    hex: "#ece6db" },
      { id: "accent",  name: "Accent",  hex: "#5a8a86" },
    ],
    fonts: [
      { role: "Display", name: "Geist", weight: "Semibold" },
      { role: "Body",    name: "Geist", weight: "Regular" },
    ],
  };

  // ---- directions (the picker, 3 alt plans) ----
  const DIRECTIONS = [
    {
      id: "A", name: "Clean & Confident", profile: "crisp-saas", opener: "hook-opener",
      accent: "#c0843f",
      scene: { kind: "hook", eyebrow: "Northwind Analytics", head: "Stop guessing.\nStart seeing.",
               bg: "#15120e", fg: "#f4efe6" },
    },
    {
      id: "B", name: "Numbers First", profile: "bold-launch", opener: "stat-callout",
      accent: "#c8703f",
      scene: { kind: "stat", eyebrow: "Teams ship faster", head: "3.2×", sub: "faster insights",
               bg: "#191210", fg: "#f4efe6" },
    },
    {
      id: "C", name: "Product Hero", profile: "warm-startup", opener: "feature-reveal",
      accent: "#b07a4a",
      scene: { kind: "feature", eyebrow: "Meet Northwind", head: "Dashboards\nthat explain.",
               bg: "#14130f", fg: "#f4efe6" },
    },
  ];

  // ---- the assembled scene graph (direction A committed) ----
  // x positions in frames; total = 600f = 20s @30fps
  const SCENES = [
    {
      id: "s1", archetype: "hook-opener", name: "Hook", layout: "center",
      start: 0, dur: 75,
      slots: { eyebrow: "Northwind Analytics", headline: "Stop guessing.\nStart seeing." },
      layers: [
        { id: "l1", type: "text", name: "Eyebrow", track: 0, content: "Northwind Analytics",
          box: { x: 0, y: 38, w: 60, h: 8, anchor: "center" },
          style: { font: "Display", size: "label", color: "primary" },
          motions: [{ primitive: "fadeIn", group: "enter", at: "scene-in", duration: "quick", ease: "glide", distance: "nudge" }] },
        { id: "l2", type: "text", name: "Headline", track: 1, content: "Stop guessing.\nStart seeing.",
          box: { x: 0, y: 44, w: 84, h: 22, anchor: "center" },
          style: { font: "Display", size: "h1", color: "text" },
          motions: [{ primitive: "maskRevealUp", group: "enter", at: "scene-in", duration: "base", ease: "snap", distance: "step" }] },
      ],
    },
    {
      id: "s2", archetype: "feature-reveal", name: "Feature · Live Boards", layout: "media-right",
      start: 75, dur: 165,
      slots: {}, layers: [
        { id: "l3", type: "text", name: "Headline", track: 0, content: "Dashboards that explain themselves",
          box: { x: 7, y: 24, w: 42, h: 20, anchor: "left" },
          style: { font: "Display", size: "h2", color: "text" },
          motions: [{ primitive: "slideUpSoft", group: "enter", at: "scene-in", duration: "base", ease: "snap", distance: "step" }] },
        { id: "l4", type: "group", name: "Benefit bullets", track: 1, content: "3 bullets",
          box: { x: 7, y: 50, w: 40, h: 26, anchor: "left" },
          style: { font: "Body", size: "body", color: "text" },
          motions: [{ primitive: "slideUpSoft", group: "enter", at: "scene-in", duration: "quick", ease: "glide", distance: "nudge" }] },
        { id: "l5", type: "device", name: "Product shot", track: 2, content: "dashboard.png",
          box: { x: 52, y: 14, w: 42, h: 72, anchor: "center" },
          style: { font: "Body", size: "body", color: "surface" },
          motions: [
            { primitive: "maskRevealUp", group: "enter", at: "scene-in", duration: "relaxed", ease: "snap", distance: "step" },
            { primitive: "kenBurns", group: "continuous", at: "emphasis", duration: "dramatic", ease: "glide", distance: "nudge" },
          ] },
      ],
    },
    {
      id: "s3", archetype: "stat-callout", name: "Stat · 3.2×", layout: "center",
      start: 240, dur: 90, slots: {}, layers: [
        { id: "l6", type: "text", name: "Big number", track: 0, content: "3.2×",
          box: { x: 0, y: 32, w: 60, h: 30, anchor: "center" },
          style: { font: "Display", size: "display", color: "primary" },
          motions: [{ primitive: "countUp", group: "emphasis", at: "scene-in", duration: "slow", ease: "snap", distance: "nudge" }] },
        { id: "l7", type: "text", name: "Caption", track: 1, content: "faster time to insight",
          box: { x: 0, y: 62, w: 60, h: 8, anchor: "center" },
          style: { font: "Body", size: "body", color: "text" },
          motions: [{ primitive: "fadeIn", group: "enter", at: "scene-in", duration: "quick", ease: "glide", distance: "nudge" }] },
      ],
    },
    {
      id: "s4", archetype: "ui-walkthrough", name: "Walkthrough", layout: "full-bleed",
      start: 330, dur: 150, slots: {}, layers: [
        { id: "l8", type: "device", name: "App screen", track: 0, content: "app-full.png",
          box: { x: 8, y: 10, w: 84, h: 80, anchor: "center" },
          style: { font: "Body", size: "body", color: "surface" },
          motions: [{ primitive: "scaleIn", group: "enter", at: "scene-in", duration: "relaxed", ease: "snap", distance: "nudge" }] },
        { id: "l9", type: "shape", name: "Callout · Filters", track: 1, content: "tooltip",
          box: { x: 20, y: 30, w: 22, h: 10, anchor: "left" },
          style: { font: "Body", size: "label", color: "primary" },
          motions: [{ primitive: "pop", group: "emphasis", at: "scene-in", duration: "quick", ease: "snap", distance: "nudge" }] },
      ],
    },
    {
      id: "s5", archetype: "social-proof", name: "Social Proof", layout: "logos",
      start: 480, dur: 60, slots: {}, layers: [
        { id: "l10", type: "text", name: "Lead-in", track: 0, content: "Trusted by fast-moving teams",
          box: { x: 0, y: 30, w: 70, h: 8, anchor: "center" },
          style: { font: "Body", size: "body", color: "text" },
          motions: [{ primitive: "fadeIn", group: "enter", at: "scene-in", duration: "quick", ease: "glide", distance: "nudge" }] },
        { id: "l11", type: "group", name: "Logo row", track: 1, content: "5 logos",
          box: { x: 8, y: 50, w: 84, h: 12, anchor: "center" },
          style: { font: "Body", size: "body", color: "text" },
          motions: [{ primitive: "slideUpSoft", group: "enter", at: "scene-in", duration: "base", ease: "glide", distance: "nudge" }] },
      ],
    },
    {
      id: "s6", archetype: "logo-sting-cta", name: "Logo · CTA", layout: "center",
      start: 540, dur: 60, slots: {}, layers: [
        { id: "l12", type: "shape", name: "Logo mark", track: 0, content: "northwind.svg",
          box: { x: 0, y: 34, w: 30, h: 18, anchor: "center" },
          style: { font: "Display", size: "h2", color: "primary" },
          motions: [{ primitive: "scaleIn", group: "enter", at: "scene-in", duration: "base", ease: "snap", distance: "nudge" }] },
        { id: "l13", type: "text", name: "CTA url", track: 1, content: "northwind.app",
          box: { x: 0, y: 58, w: 60, h: 8, anchor: "center" },
          style: { font: "Body", size: "body", color: "text" },
          motions: [{ primitive: "underlineSweep", group: "emphasis", at: "scene-in", duration: "base", ease: "glide", distance: "step" }] },
      ],
    },
  ];

  // transitions between scenes
  const TRANSITIONS = [
    { from: "s1", to: "s2", kind: "cutHold" },
    { from: "s2", to: "s3", kind: "slidePush" },
    { from: "s3", to: "s4", kind: "crossFade" },
    { from: "s4", to: "s5", kind: "wipeDirectional" },
    { from: "s5", to: "s6", kind: "flash-through-white" },
  ];

  // camera track (pushIn brought forward)
  const CAMERA = [
    { id: "c1", sceneId: "s2", move: "pushIn", start: 75, dur: 165 },
    { id: "c2", sceneId: "s4", move: "panAcross", start: 330, dur: 150 },
  ];

  // audio stub
  const AUDIO = [{ id: "a1", name: "uplift-tech.mp3", start: 0, dur: 600, kind: "music" }];

  // ---- linter (T3) ----
  const LINT = [
    { rule: "text-readability", status: "pass", msg: "All on-screen text meets read budget" },
    { rule: "simultaneity-cap", status: "pass", msg: "≤3 overlapping animation windows" },
    { rule: "stagger-required", status: "fixed", msg: "Applied profile stagger to S2 bullets", tag: "auto-fixed" },
    { rule: "settle-gap", status: "pass", msg: "Holds before each cut satisfied" },
    { rule: "safe-area", status: "pass", msg: "Text inside 5% title-safe margins" },
    { rule: "contrast", status: "fixed", msg: "Swapped S3 caption to text-on-surface", tag: "auto-fixed" },
    { rule: "grid-snap", status: "pass", msg: "Boxes snapped to 12-col grid" },
    { rule: "duration-tiling", status: "pass", msg: "Scenes tile 0–600f exactly" },
    { rule: "motion-density", status: "warn", msg: "S4 near density ceiling — consider trimming a callout", tag: "review" },
    { rule: "exit-coverage", status: "pass", msg: "Every layer exits or persists" },
  ];

  // ---- agent chat history (default = mid-generation, picker showing) ----
  const CHAT = {
    brief: "A punchy 20-second promo for our analytics dashboard. Confident, clean. Brand color #c0843f.",
    attachments: [
      { type: "img", label: "dashboard.png" },
      { type: "img", label: "filters.png" },
      { type: "chip", label: "#c0843f" },
    ],
    planSteps: [
      { label: "Parsed brief + asset manifest", state: "done" },
      { label: "Selected motion profile candidates", state: "done" },
      { label: "Drafted 6-beat sheet", state: "done" },
      { label: "Rendering 3 direction previews", state: "active" },
    ],
  };

  // quick tweaks (zero-token fast path)
  const QUICK_TWEAKS = [
    { label: "Bigger headline", zero: true },
    { label: "Slower intro", zero: true },
    { label: "More punch", zero: true },
    { label: "Calmer", zero: true },
  ];

  window.SEQ = {
    FPS, TOKENS, PRIMITIVES, ALL_ENTER, ARCHETYPES, PROFILES, BRAND,
    DIRECTIONS, SCENES, TRANSITIONS, CAMERA, AUDIO, LINT, CHAT, QUICK_TWEAKS,
    TOTAL: 600,
    sizeToPx: { label: 13, body: 17, h2: 38, h1: 64, display: 120, caption: 16 },
  };
})();
