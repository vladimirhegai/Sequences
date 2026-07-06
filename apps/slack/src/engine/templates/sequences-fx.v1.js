(function (global) {
  "use strict";

  // sequences-fx.v1 — host-compiled motion-design garnish (MD2): light
  // sweeps, glow pulses, and trim-path draw-ons. Everything here is
  // enhancement-only (a missing target compiles to nothing), every value is
  // a pure function of timeline time (fromTo with immediateRender:false,
  // no clocks, no randomness), and NO element ever gains a CSS filter — the
  // sweep is a masked transform+opacity band, the glow is an opacity pulse
  // on a kit bloom, the draw is strokeDashoffset. Appended artifacts carry
  // data-layout-ignore + data-sequences-fx so QA never reads decoration as
  // content.

  var VERSION = 1;

  function sceneOf(root, id) {
    return root.querySelector('[data-scene="' + CSS.escape(id) + '"]');
  }

  function tween(timeline, target, fromVars, toVars, at) {
    toVars.immediateRender = false;
    timeline.fromTo(target, fromVars, toVars, at);
  }

  function glideEase() {
    try {
      return global.gsap.parseEase("seqGlide") ? "seqGlide" : "power2.inOut";
    } catch (error) {
      return "power2.inOut";
    }
  }

  // ------------------------------------------------------------------ sweep
  // A masked specular band travels across the target — the CC Light Sweep
  // idiom in pure transform/opacity. The mask wrapper honors the target's
  // border-radius; the band color derives from the cinema kit's sheen token.
  function bindSweep(timeline, scene, effect) {
    var target = scene.querySelector('[data-part="' + CSS.escape(effect.target) + '"]');
    if (!target) return null;
    if (getComputedStyle(target).position === "static") {
      target.style.position = "relative";
    }
    var mask = document.createElement("span");
    mask.setAttribute("data-sequences-fx", "sweep");
    mask.setAttribute("data-layout-ignore", "");
    mask.setAttribute("aria-hidden", "true");
    mask.style.cssText =
      "position:absolute;inset:0;overflow:hidden;border-radius:inherit;" +
      "pointer-events:none;z-index:3";
    var band = document.createElement("span");
    band.style.cssText =
      "position:absolute;top:-60%;bottom:-60%;left:0;width:38%;" +
      "transform:rotate(18deg);opacity:0;" +
      "background:linear-gradient(105deg,transparent," +
      "var(--cinema-sheen,rgba(255,255,255,0.30)) 50%,transparent)";
    mask.appendChild(band);
    target.appendChild(mask);
    timeline.set(band, { opacity: 0 }, 0);
    timeline.set(band, { opacity: 1 }, effect.atSec);
    tween(timeline, band, { xPercent: -170 }, {
      xPercent: 430,
      duration: effect.durationSec,
      ease: glideEase(),
    }, effect.atSec);
    timeline.set(band, { opacity: 0 }, effect.atSec + effect.durationSec);
    return { kind: "sweep", target: effect.target, element: band };
  }

  // ------------------------------------------------------------- glow pulse
  // The bloom answers the payoff: its opacity swells ~1.6× and settles back
  // to rest. Reuses the target's own kit bloom when one exists; otherwise a
  // kit bloom is appended behind the target (enhancement-only either way).
  function bindGlowPulse(timeline, scene, effect) {
    var target = scene.querySelector('[data-part="' + CSS.escape(effect.target) + '"]');
    if (!target) return null;
    var bloom = target.querySelector(".bloom") || scene.querySelector(".bloom");
    if (!bloom) {
      if (getComputedStyle(target).position === "static") {
        target.style.position = "relative";
      }
      bloom = document.createElement("span");
      bloom.className = "bloom";
      bloom.setAttribute("data-sequences-fx", "bloom");
      bloom.setAttribute("data-layout-ignore", "");
      bloom.setAttribute("aria-hidden", "true");
      bloom.style.cssText =
        "position:absolute;inset:-35%;z-index:0;pointer-events:none";
      target.insertBefore(bloom, target.firstChild);
    }
    var rest = Number.parseFloat(getComputedStyle(bloom).opacity);
    if (!isFinite(rest) || rest <= 0) rest = 0.6;
    var peak = Math.min(1, rest * 1.6);
    var half = effect.durationSec / 2;
    tween(timeline, bloom, { opacity: rest }, {
      opacity: peak,
      duration: half,
      ease: "sine.in",
    }, effect.atSec);
    tween(timeline, bloom, { opacity: peak }, {
      opacity: rest,
      duration: half,
      ease: "sine.out",
    }, effect.atSec + half);
    return { kind: "glow-pulse", target: effect.target, element: bloom };
  }

  // ------------------------------------------------------------------ draws
  // Generalized trim paths: the strokeDashoffset fromTo the chart/progress
  // compilers already ship, freed from those components. `connector` draws
  // author-opt-in `.fx-connector` strokes so they complete exactly at the
  // camera's arrival at their station; MD3's underline variant reuses
  // drawStrokes on `.fx-underline` markup.
  function strokeLength(stroke) {
    if (typeof stroke.getTotalLength === "function") {
      try {
        return stroke.getTotalLength();
      } catch (error) {
        return 0;
      }
    }
    return 0;
  }

  function drawStrokes(timeline, container, atSec, durationSec) {
    var strokes = container.querySelectorAll("path,line,polyline,circle,rect");
    var drawn = 0;
    for (var i = 0; i < strokes.length; i += 1) {
      var length = strokeLength(strokes[i]);
      if (!length) continue;
      strokes[i].style.strokeDasharray = String(length);
      timeline.set(strokes[i], { strokeDashoffset: length }, 0);
      tween(timeline, strokes[i], { strokeDashoffset: length }, {
        strokeDashoffset: 0,
        duration: durationSec,
        ease: "power2.out",
      }, atSec);
      drawn += 1;
    }
    return drawn;
  }

  function bindConnector(timeline, scene, effect) {
    var connectors = scene.querySelectorAll(
      '.fx-connector[data-fx-toward="' + CSS.escape(effect.region) + '"]',
    );
    if (!connectors.length) return null;
    var drawn = 0;
    for (var i = 0; i < connectors.length; i += 1) {
      drawn += drawStrokes(timeline, connectors[i], effect.atSec, effect.durationSec);
    }
    return drawn ? { kind: "connector", region: effect.region, strokes: drawn } : null;
  }

  function bindDraw(timeline, scene, effect) {
    var target = scene.querySelector('[data-part="' + CSS.escape(effect.target) + '"]');
    if (!target) return null;
    var container = target.querySelector(".fx-underline") || target;
    var drawn = drawStrokes(timeline, container, effect.atSec, effect.durationSec);
    return drawn ? { kind: "draw", target: effect.target, strokes: drawn } : null;
  }

  function compile(timeline, root) {
    if (!timeline || !root) throw new Error("SequencesFx.compile requires timeline + root");
    var island = document.getElementById("sequences-fx");
    if (!island) return [];
    var plan = JSON.parse(island.textContent || "{}");
    if (plan.version !== VERSION || !Array.isArray(plan.effects)) {
      throw new Error("unsupported sequences fx plan");
    }
    var bindings = [];
    plan.effects.forEach(function (effect) {
      var scene = sceneOf(root, effect.sceneId);
      if (!scene) return;
      var binding = null;
      if (effect.kind === "sweep") binding = bindSweep(timeline, scene, effect);
      else if (effect.kind === "glow-pulse") binding = bindGlowPulse(timeline, scene, effect);
      else if (effect.kind === "connector") binding = bindConnector(timeline, scene, effect);
      else if (effect.kind === "draw") binding = bindDraw(timeline, scene, effect);
      if (binding) bindings.push(binding);
    });
    global.__sequencesFxBindings = bindings;
    return bindings;
  }

  global.SequencesFx = Object.freeze({ version: VERSION, compile: compile });
})(window);
