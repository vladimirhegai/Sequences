(function () {
  "use strict";
  const C = window.AD_CONFIG;
  const q = (s) => document.querySelector(s);
  q("#too-tools").textContent = C.copy.overload[0];
  q("#too-handoffs").textContent = C.copy.overload[1];
  q("#no-momentum").innerHTML = 'No <span class="slack-gradient">momentum.</span>';
  q("#message-one p").textContent = C.copy.question;
  q("#message-two p").textContent = C.copy.answer;

  const tl = gsap.timeline({ paused: true, defaults: { ease: "power3.out" } });
  const scenes = ["#overload", "#unify", "#channel-scene", "#workspace-scene", "#proof", "#promise", "#end"];
  tl.set(scenes, { autoAlpha: 0 }, 0).set("#overload", { autoAlpha: 1 }, 0);
  tl.set(".tool-card,.notification", { opacity: 0 }, 0);
  tl.set("#too-tools,#too-handoffs,#no-momentum", { opacity: 0 }, 0);

  // 0.0–3.25 — information arrives faster than it can be resolved.
  const toolStarts = [0.12, 0.38, 0.68, 0.94, 1.18, 1.42];
  gsap.utils.toArray(".tool-card").forEach((el, i) => {
    tl.fromTo(el, { opacity: 0, scale: .72, y: 70, rotation: i % 2 ? 9 : -9 },
      { opacity: 1, scale: 1, y: 0, rotation: gsap.getProperty(el, "rotation"), duration: .58, ease: "back.out(1.55)" }, toolStarts[i]);
  });
  [".n1", ".n2", ".n3"].forEach((s, i) => tl.fromTo(s, { opacity: 0, x: i % 2 ? -55 : 55, scale: .9 }, { opacity: 1, x: 0, scale: 1, duration: .42 }, 1.22 + i * .32));
  tl.fromTo("#too-tools", { opacity: 0, y: 34, scale: .94 }, { opacity: 1, y: 0, scale: 1, duration: .48 }, 1.08)
    .to("#too-tools", { opacity: 0, y: -26, duration: .32, ease: "power2.in" }, 1.92)
    .fromTo("#too-handoffs", { opacity: 0, y: 34 }, { opacity: 1, y: 0, duration: .46 }, 2.03)
    .to("#too-handoffs", { opacity: 0, y: -26, duration: .32, ease: "power2.in" }, 2.88);

  // 3.25–5.45 — a decisive operated push, then a readable hold.
  tl.fromTo("#no-momentum", { opacity: 0, scale: .82 }, { opacity: 1, scale: 1, duration: .55, ease: "back.out(1.35)" }, 3.12)
    .to(".tool-cloud", { scale: 1.12, filter: "blur(4px)", opacity: .36, duration: .8, ease: "power3.inOut" }, 3.18)
    .to("#no-momentum", { scale: 1.035, duration: .32, ease: "power2.out" }, 3.78)
    .to("#no-momentum", { scale: 1, duration: .5, ease: "power2.inOut" }, 4.1);

  // 5.45–7.35 — visible geometric consolidation into the Slack mark.
  const converge = [[620,360],[250,410],[-260,360],[-650,-170],[-250,-310],[350,-280]];
  gsap.utils.toArray(".tool-card").forEach((el, i) => tl.to(el, { x: converge[i][0], y: converge[i][1], scale: .12, rotation: i * 38, opacity: .15, duration: .7, ease: "power4.in" }, 5.12 + i * .035));
  tl.to(".notification", { x: 0, y: 0, scale: .05, opacity: 0, duration: .48, ease: "power3.in" }, 5.18)
    .to("#no-momentum", { opacity: 0, scale: 1.16, duration: .35, ease: "power2.in" }, 5.18)
    .set("#unify", { autoAlpha: 1, background: "radial-gradient(circle at 50% 48%, #652a6b 0%, #4a154b 48%, #2b0f30 100%)" }, 5.52)
    .to("#unify", { background: "radial-gradient(circle at 50% 48%, #ffffff 0%, #f8f7f5 58%, #eee9ef 100%)", duration: .9, ease: "power2.inOut" }, 5.86)
    .set("#overload", { autoAlpha: 0 }, 5.96)
    .fromTo("#hero-mark .m", { opacity: .82, scale: .7, x: (i) => i % 2 ? 290 : -290, y: (i) => i < 4 ? -180 : 180, rotation: (i) => i % 2 ? 75 : -75 },
      { opacity: 1, scale: 1, x: 0, y: 0, rotation: 0, duration: .72, stagger: .035, ease: "back.out(1.18)" }, 5.47)
    .fromTo("#hero-mark", { scale: .68, rotation: -8 }, { scale: 1, rotation: 0, duration: .9, ease: "back.out(1.5)" }, 5.55);

  // 7.35–9.70 — statement, pointer approach, click commit.
  q("#messy .typed").textContent = C.copy.messy;
  tl.to("#hero-mark", { y: -170, scale: .72, duration: .65, ease: "power3.inOut" }, 7.18)
    .fromTo("#messy .typed", { clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)", duration: 1.05, ease: "steps(36)" }, 7.52)
    .fromTo("#messy", { opacity: 0 }, { opacity: 1, duration: .12 }, 7.52)
    .fromTo("#messy .caret", { opacity: 0 }, { opacity: 1, duration: .1 }, 7.52)
    .to("#messy .caret", { opacity: 0, duration: .08 }, 8.64)
    .fromTo("#cursor", { opacity: 0, left: 1500, top: 890 }, { opacity: 1, left: 1090, top: 350, duration: .68, ease: "power3.inOut" }, 8.62)
    .to("#hero-mark", { scale: .66, duration: .1, ease: "power2.in" }, 9.30)
    .to("#hero-mark", { scale: .74, duration: .22, ease: "back.out(2.2)" }, 9.40)
    .to("#unify", { backgroundColor: "#27112a", duration: .28, ease: "power2.in" }, 9.42);

  // 9.70–12.0 — modal retains the exact Slack workflow but all copy remains DOM.
  tl.set("#channel-scene", { autoAlpha: 1 }, 9.62).set("#unify", { autoAlpha: 0 }, 9.82)
    .fromTo("#channel-modal", { opacity: 0, y: 60, scale: .9 }, { opacity: 1, y: 0, scale: 1, duration: .52, ease: "back.out(1.28)" }, 9.66);
  q("#channel-type").textContent = C.copy.channel;
  tl.fromTo("#channel-type", { clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)", duration: .56, ease: "steps(6)" }, 10.36)
    .to("#char-count", { innerText: 74, duration: .56, snap: { innerText: 1 }, ease: "none" }, 10.36)
    .to("#next-button", { backgroundColor: "#007a5a", duration: .2 }, 10.83)
    .to("#next-button", { scale: .91, duration: .1, ease: "power2.in" }, 11.24)
    .to("#next-button", { scale: 1, duration: .2, ease: "back.out(2)" }, 11.34)
    .to("#channel-modal", { y: -30, opacity: 0, scale: .96, duration: .42, ease: "power2.in" }, 11.52);

  // 12.0–16.25 — open the workspace, then make two short camera commitments.
  tl.set("#workspace-scene", { autoAlpha: 1 }, 11.82).set("#channel-scene", { autoAlpha: 0 }, 12.02)
    .fromTo("#slack-window", { opacity: 0, y: 80, scale: .92 }, { opacity: 1, y: 0, scale: 1, duration: .65, ease: "back.out(1.2)" }, 11.82)
    .fromTo("#message-one", { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: .42 }, 12.58)
    .fromTo("#message-one p", { clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)", duration: .68, ease: "steps(40)" }, 12.68)
    .to("#workspace-camera", { x: 0, y: -24, scale: 1.07, duration: .6, ease: "power3.inOut" }, 13.34)
    .fromTo("#message-two", { opacity: 0, y: 25 }, { opacity: 1, y: 0, duration: .42 }, 13.87)
    .fromTo("#message-two p", { clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)", duration: .44, ease: "steps(20)" }, 14.02)
    .fromTo("#message-two .reaction", { opacity: 0, scale: .55 }, { opacity: 1, scale: 1, duration: .32, ease: "back.out(1.9)" }, 14.56)
    .to("#workspace-camera", { x: 0, y: 0, scale: 1, duration: .62, ease: "power3.inOut" }, 15.05);

  // 16.25–19.40 — parallel proof resolves into a single line.
  tl.set("#proof", { autoAlpha: 1 }, 16.12).to("#workspace-scene", { autoAlpha: 0, duration: .26 }, 16.18)
    .fromTo(".decision", { opacity: 0, x: -130, y: 70, rotation: -3, scale: 1.12 }, { opacity: 1, x: 0, y: 0, rotation: 0, scale: 1, duration: .68 }, 16.25)
    .fromTo(".conversation", { opacity: 0, x: 135, y: 100, rotation: 3, scale: 1.12 }, { opacity: 1, x: 0, y: 0, rotation: 0, scale: 1, duration: .68 }, 16.94)
    .fromTo(".mini-msg", { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: .45 }, 17.15)
    .fromTo(".channel-stack>*", { opacity: 0, x: 30 }, { opacity: 1, x: 0, duration: .35, stagger: .12 }, 17.62)
    .fromTo(".join-line", { scaleX: 0 }, { scaleX: 1, duration: .48, ease: "power3.inOut" }, 18.28)
    .to(".proof-card", { scale: .97, duration: .4, ease: "power2.inOut" }, 18.68);

  // 19.40–23.15 — the two promises occupy the same focal point, so the phrase evolves instead of cutting.
  tl.fromTo("#promise", { autoAlpha: 0 }, { autoAlpha: 1, duration: .36, ease: "power2.inOut" }, 19.16)
    .to("#proof", { autoAlpha: 0, duration: .38, ease: "power2.inOut" }, 19.18)
    .fromTo("#all-place", { opacity: .42, y: 34 }, { opacity: 1, y: 0, duration: .46 }, 19.16)
    .fromTo(".orbit-mark", { opacity: 0, scale: .2, rotation: -70 }, { opacity: 1, scale: .38, rotation: 0, duration: .75, ease: "back.out(1.5)" }, 20.03)
    .to("#all-place", { opacity: 0, y: -34, duration: .36, ease: "power2.in" }, 20.82)
    .fromTo("#all-slack", { opacity: 0, y: 38, scale: .96 }, { opacity: 1, y: 0, scale: 1, duration: .52, ease: "back.out(1.3)" }, 21.03)
    .to(".orbit-mark", { x: -455, y: -205, scale: .25, duration: .65, ease: "power3.inOut" }, 21.06)
    .to("#all-slack", { scale: 1.025, duration: .27, ease: "power2.out" }, 21.56)
    .to("#all-slack", { scale: 1, duration: .48 }, 21.83)
    // Redundant focal pin across the final promise hold. It is pixel-aligned
    // with the authored claim and prevents a seek/capture opacity hole.
    .set("#all-slack-guard", { opacity: 1 }, 22.2)
    .set("#all-slack-guard", { opacity: 0 }, 22.98);

  // 23.15–27.0 — Slack lockup lands quickly; final 2.5s are intentionally still.
  tl.fromTo("#end", { autoAlpha: 0 }, { autoAlpha: 1, duration: .34, ease: "power2.inOut" }, 22.98)
    .to("#promise", { autoAlpha: 0, duration: .34, ease: "power2.inOut" }, 22.98)
    .fromTo(".lockup-mark .m", { opacity: .48, scale: .72, x: (i) => i % 2 ? 58 : -58 }, { opacity: 1, scale: 1, x: 0, duration: .5, stagger: .025, ease: "back.out(1.5)" }, 22.98)
    .fromTo(".wordmark", { opacity: 0, x: 70 }, { opacity: 1, x: 0, duration: .6 }, 23.34)
    .fromTo("#end p", { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: .45 }, 23.88)
    .to({}, { duration: 2.6 }, 24.4);

  window.__timeline = tl;
  window.__seek = (seconds) => {
    const time = Math.max(0, Math.min(C.durationSec, seconds));
    tl.seek(time, false);
    // GSAP's zero-duration set can be crossed differently after arbitrary
    // forward seeks. Pin this overlap from absolute time so offline capture,
    // reverse seeking, and a fresh browser all produce the same visible seam.
    gsap.set("#all-slack-guard", { opacity: time >= 22.2 && time < 22.98 ? 1 : 0 });
    return tl.time();
  };
  tl.seek(0);
})();
