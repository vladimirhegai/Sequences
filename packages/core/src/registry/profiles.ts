/**
 * Motion profiles — the "vibe" selection-bias tables (plan §4.4). All 3
 * planned profiles ship; `bold-launch` leans on charCascade/directional
 * slides until shader transitions arrive (backlog #1).
 *
 * The one-loud-motion rule is authored here: the `hero` row is the only loud
 * assignment (longest duration, most distinctive primitive); everything else
 * is quiet. The solver asserts this stays true.
 */
import type { MotionProfile } from "./types.ts";

export const crispSaas: MotionProfile = {
  id: "crisp-saas",
  summary:
    "Quick durations, snap/glide easings, tight staggers, mask reveals, hard cuts. The Linear/Vercel look. Default for dev tools and B2B SaaS.",
  defaults: {
    stagger: "tight",
    settleGap: "quick",
    overlapBudget: 0.65,
    transition: "cut",
    exits: false,
  },
  selection: {
    hero: { enter: { primitive: "enter.maskRevealUp", duration: "relaxed", easing: "enter.snap" } },
    support: {
      enter: {
        primitive: "enter.slideUpSoft",
        duration: "base",
        easing: "enter.glide",
        distance: "step",
      },
    },
    media: {
      enter: { primitive: "enter.scaleIn", duration: "base", easing: "enter.glide", scale: "subtle" },
      continuous: {
        primitive: "continuous.kenBurns",
        duration: "dramatic",
        easing: "linear.mech",
        scale: "subtle",
        distance: "nudge",
      },
    },
    list: {
      enter: {
        primitive: "enter.slideUpSoft",
        duration: "quick",
        easing: "enter.glide",
        distance: "step",
      },
    },
    badge: {
      enter: { primitive: "enter.scaleIn", duration: "base", easing: "enter.settle", scale: "pop" },
    },
    decor: { enter: { primitive: "enter.fadeIn", duration: "slow", easing: "enter.glide" } },
  },
};

export const warmStartup: MotionProfile = {
  id: "warm-startup",
  summary:
    "Relaxed durations, settle easing, fades and soft slides, fade transitions, gentle exits. For consumer and friendly-brand promos.",
  defaults: {
    stagger: "base",
    settleGap: "base",
    overlapBudget: 0.65,
    transition: "fade",
    exits: true,
  },
  selection: {
    hero: {
      enter: {
        primitive: "enter.slideUpSoft",
        duration: "slow",
        easing: "enter.settle",
        distance: "travel",
      },
      exit: {
        primitive: "exit.fadeDown",
        duration: "quick",
        easing: "exit.fade",
        distance: "nudge",
      },
    },
    support: {
      enter: { primitive: "enter.fadeIn", duration: "relaxed", easing: "enter.glide" },
      exit: {
        primitive: "exit.fadeDown",
        duration: "quick",
        easing: "exit.fade",
        distance: "nudge",
      },
    },
    media: {
      enter: {
        primitive: "enter.scaleIn",
        duration: "relaxed",
        easing: "enter.settle",
        scale: "subtle",
      },
      exit: {
        primitive: "exit.fadeDown",
        duration: "quick",
        easing: "exit.fade",
        distance: "nudge",
      },
      continuous: {
        primitive: "continuous.kenBurns",
        duration: "dramatic",
        easing: "linear.mech",
        scale: "subtle",
        distance: "nudge",
      },
    },
    list: {
      enter: {
        primitive: "enter.slideUpSoft",
        duration: "base",
        easing: "enter.settle",
        distance: "step",
      },
      exit: {
        primitive: "exit.fadeDown",
        duration: "quick",
        easing: "exit.fade",
        distance: "nudge",
      },
    },
    badge: {
      enter: {
        primitive: "enter.scaleIn",
        duration: "relaxed",
        easing: "enter.springSoft",
        scale: "pop",
      },
      exit: {
        primitive: "exit.fadeDown",
        duration: "quick",
        easing: "exit.fade",
        distance: "nudge",
      },
    },
    decor: { enter: { primitive: "enter.fadeIn", duration: "dramatic", easing: "enter.glide" } },
  },
};

export const boldLaunch: MotionProfile = {
  id: "bold-launch",
  summary:
    "Punchier launch-film pacing: character hooks, directional UI motion, scale-away exits, and stronger continuous accents. Use for Product Hunt and release-day promos.",
  defaults: {
    stagger: "tight",
    settleGap: "instant",
    overlapBudget: 0.65,
    transition: "cut",
    exits: true,
  },
  selection: {
    hero: {
      enter: { primitive: "enter.charCascade", duration: "relaxed", easing: "enter.snap" },
      exit: { primitive: "exit.scaleAway", duration: "quick", easing: "exit.swift", scale: "subtle" },
    },
    support: {
      enter: {
        primitive: "enter.blurIn",
        duration: "base",
        easing: "enter.glide",
        distance: "step",
      },
      exit: {
        primitive: "exit.fadeDown",
        duration: "quick",
        easing: "exit.fade",
        distance: "nudge",
      },
    },
    media: {
      enter: {
        primitive: "enter.slideInDirectional",
        duration: "relaxed",
        easing: "enter.snap",
        distance: "travel",
      },
      exit: {
        primitive: "exit.scaleAway",
        duration: "quick",
        easing: "exit.swift",
        scale: "subtle",
      },
      continuous: {
        primitive: "continuous.kenBurns",
        duration: "dramatic",
        easing: "linear.mech",
        scale: "hero",
        distance: "nudge",
      },
    },
    list: {
      enter: {
        primitive: "enter.slideInDirectional",
        duration: "quick",
        easing: "enter.snap",
        distance: "step",
      },
      exit: {
        primitive: "exit.slideExit",
        duration: "quick",
        easing: "exit.swift",
        distance: "step",
      },
    },
    badge: {
      enter: { primitive: "enter.scaleIn", duration: "quick", easing: "enter.settle", scale: "pop" },
      exit: {
        primitive: "exit.scaleAway",
        duration: "quick",
        easing: "exit.swift",
        scale: "pop",
      },
      continuous: {
        primitive: "continuous.floatIdle",
        duration: "dramatic",
        easing: "move.glide",
        distance: "nudge",
      },
    },
    decor: { enter: { primitive: "enter.fadeIn", duration: "slow", easing: "enter.glide" } },
  },
};

export const PROFILES: Record<string, MotionProfile> = Object.fromEntries(
  [crispSaas, warmStartup, boldLaunch].map((p) => [p.id, p]),
);
