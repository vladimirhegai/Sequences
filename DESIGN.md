# Sequences — DESIGN.md

> One source of truth for how Sequences looks and feels. Tokens below map 1:1 to
> the shipped studio CSS variables in `apps/studio/src/static/styles.css` — change
> them in both places together.

## Overview

Sequences is a local-first, agent-first motion graphics studio for SaaS product video.
The interface is **After Effects × Cursor**: the docked, neutral-graphite, timeline-at-the-bottom
shell a motion designer already knows — fused with an agent rail, inspectable diffs, and a
command model a developer already trusts.

The whole system is built on one idea: **the chrome is monochrome so the video is the only
color in the room.** There is no brand hue. Hierarchy comes from a graphite surface ladder,
hairline borders, and a single neutral **silver** that carries selection, focus, and primary
action through *brightness*, not saturation. Color appears only where it means something —
the user's preview, a timeline clip lane, a linter state.

The signature surface is the **Timeline workspace**, and its layout is mandatory:
**agent left · viewer center · inspector right · timeline along the bottom.** The agent is not
a chat toy; it is a command layer that proposes beat sheets and reversible, inspectable diffs.
Every mutation — agent edit, drag, inspector change, MCP call — is the same typed command underneath.

**Key characteristics:**
- Dark graphite shell, six-step surface ladder from `{color.canvas}` `#0a0b0d` up to `{color.surface-high}` `#2a2e35`.
- No chromatic brand accent. One neutral **silver** (`{color.silver}` `#c9cfd9`) for selection, focus, and the single primary action per viewport.
- Hairline borders + surface stepping create depth. Drop shadows only on floating layers (menus, modals, toasts).
- Desaturated semantic colors (`good / warn / bad / info`) used *functionally* — clip lanes, lint, render state — never decoratively.
- Mono type for everything precise: timecode, frame numbers, layer IDs, tokens, event log, CLI/MCP names.
- AE-grade density in the app; editorial calm in the (light) marketing surface.
- The product is the drama: real previews, scene thumbnails, and command diffs replace illustration.

---

## Colors

All hex below are the live studio values. Token name → CSS var is noted once per group.

### Surfaces — the graphite ladder (`--bg-*`)
| Token | Hex | Use |
|---|---|---|
| `{color.canvas}` (`--bg-app`) | `#0a0b0d` | App background, the base everything floats on. Never `#000000`. |
| `{color.surface}` (`--bg-0`) | `#0f1012` | Default panel base: agent, inspector column, viewer well, timeline. |
| `{color.surface-raised}` (`--bg-1`) | `#131518` | Panel/toolbar headers, gutters, composer foot, ruler. |
| `{color.surface-card}` (`--bg-2`) | `#191c20` | Inputs, chips, token pills, cards, popover bodies. |
| `{color.surface-active}` (`--bg-3`) | `#21242a` | Hover, pressed, active rows, selected menu option. |
| `{color.surface-high}` (`--bg-4`) | `#2a2e35` | Highest lift: scrub track, scrollbar, deepest control well. |

### Lines (`--line-*`)
| Token | Hex / value | Use |
|---|---|---|
| `{color.hairline}` (`--line`) | `#1f2226` | Universal 1px border: panel edges, row separators, dividers. |
| `{color.hairline-2}` (`--line-2`) | `#282c32` | Control borders (inputs, chips, ghost buttons). |
| `{color.hairline-hi}` (`--line-hi`) | `#373c44` | Hover borders, menu/modal edges, scene-block outline. |

### Silver — the only accent (`--silver-*`)
| Token | Value | Use |
|---|---|---|
| `{color.silver}` | `#c9cfd9` | Selection edge, brand mark, active glyphs, slider fill, scrub fill. |
| `{color.silver-hi}` | `#eef1f5` | Focus brightness, playhead, primary-button face, agent label. |
| `{color.silver-soft}` | `rgba(201,207,217,0.08)` | Selected-row fill, active token pill, agent-diff background. |
| `{color.silver-mid}` | `rgba(201,207,217,0.22)` | `::selection` highlight, drag-active fill. |
| `{color.silver-line}` | `rgba(201,207,217,0.45)` | Selected clip/scene border, focus ring edge, split-handle. |

There is no `silver` *button color* — the primary action is a **silver gradient** (see Components).

### Text (`--text-*`)
| Token | Hex | Use |
|---|---|---|
| `{color.ink}` (`--text-hi`) | `#e9ebee` | Primary labels, selected text, values, headings. |
| `{color.body}` (`--text-mid`) | `#a6abb4` | Default body, control labels, descriptions. |
| `{color.mute}` (`--text-lo`) | `#70757e` | Captions, metadata, inactive tabs, helper text, ruler ticks. |
| `{color.faint}` (`--text-dim`) | `#4b4f56` | Placeholders, disabled, separators in timecode, sequence numbers. |

### Semantic — desaturated, functional only
| Token | Hex | Soft fill | Use |
|---|---|---|---|
| `{color.good}` | `#79b88a` | `rgba(121,184,138,0.13)` | Passed lint, render OK, accepted diff, audio lane. |
| `{color.warn}` | `#d3b061` | `rgba(211,176,97,0.13)` | Lint warning, missing font, low contrast, caution. |
| `{color.bad}` | `#d2796a` | `rgba(210,121,106,0.13)` | Error, failed render, invalid graph, destructive. |
| `{color.info}` | `#7c9fc4` | `rgba(124,159,196,0.13)` | Hints, new/beta tags, autofix events, optional suggestions. |

Semantic colors carry **state**, never brand. They must always pair color with text or an icon — never color alone.

### Timeline clip lanes
Clips are tinted gradients keyed by layer type, kept dark enough to read white labels:
`text` `#2c3640→#232c34` · `image` `#393a2e→#2b2c23` · `device` `#352e3c→#28232e` ·
`shape` `#2b372e→#212a24` · `camera` `#3a3a45→#2b2b34`. Selected clip → `{color.silver-line}` border.

**No** neon gradients, rainbow AI glows, or mesh backgrounds anywhere in chrome.

---

## Typography

**UI face:** a neutral grotesque. Inter is the brand preference; the studio currently ships the
system stack (`-apple-system, "Segoe UI", system-ui`) for zero-dependency rendering. Either is valid —
preserve the scale and weights. **Mono:** `ui-monospace, "Cascadia Mono", "Geist Mono", "JetBrains Mono", Consolas`,
always with `font-feature-settings: "tnum" 1` for tabular figures.

The app is **dense by design** — base size is `13px`, and most chrome lives between 9.5–13px.
Marketing gets the only large type.

| Token | Size / weight | Tracking | Use |
|---|---|---|---|
| `{type.display}` | 56px / 600 | -1.8px | Marketing hero only. |
| `{type.title}` | 28px / 600 | -0.6px | Page titles, modal/dialog titles, direction-picker. |
| `{type.heading}` | 14px / 650 | 0.07em ↑ | Panel headers (`PROJECT`, `INSPECTOR`) — uppercase, the AE panel label. |
| `{type.label}` | 12.5px / 600 | 0 | Menu option names, selected property labels, scene names. |
| `{type.body}` | 13px / 400 | 0 | Default app prose, descriptions, agent text. |
| `{type.control}` | 11.5–12px / 550 | 0 | Buttons, tabs, chips, field labels, row text. |
| `{type.caption}` | 11px / 500 | 0 | Captions, metadata, lint messages, status bar. |
| `{type.micro}` | 9.5px / 700 | 0.08em ↑ | Uppercase eyebrows: menu group labels, badges, section tags. |
| `{type.mono}` | 9.5–12.5px / 400 | 0 | Timecode, frames, layer IDs, tokens, event log, hex, keycaps. |

**Principles**
- **Brightness is hierarchy.** Step `{color.ink}` → `{color.body}` → `{color.mute}` → `{color.faint}` before reaching for weight or size.
- **Negative tracking is display-only.** App chrome stays at 0; never track-tighten 13px panel text.
- **Uppercase is reserved** for two roles: `{type.heading}` panel labels and `{type.micro}` eyebrows/badges. Body is never uppercased.
- **Mono means precise.** It makes time, frames, IDs, and tokens feel exact — never use it decoratively.
- **No 700+ weight walls.** 650 is the ceiling in chrome.

---

## Spacing & Layout

**Base unit 8px**, with 2px / 4px micro-steps for timeline ticks, keycaps, and dense inline gaps.

`{space.xxs}` 2 · `{space.xs}` 4 · `{space.sm}` 8 · `{space.md}` 12 · `{space.lg}` 16 · `{space.xl}` 24 · `{space.xxl}` 32 · `{space.section}` 96 (marketing).

- **Panel padding:** headers/toolbars `0 12px`; body content `12–13px`; agent body `13px 12px`.
- **Row rhythm:** inspector rows ~29–36px; timeline lane rows 28px; scene track 56px; ruler 22px.
- **Controls:** buttons 30px tall (`0 12px`); mini-buttons 24px; inputs 29px; chips 30px.
- **Marketing:** `{space.section}` 96px desktop / 64 tablet / 48 mobile; max-width 1280px, 24px gutters.

**The app shell** is full-viewport, no centered container — fixed regions + resizable split panes
(drag any panel edge; sizes persist; double-click resets). Top bar `46px`, status bar `26px`.

**Timeline workspace grid (mandatory):**
```
┌─ top bar (46) ───────────────────────────────────────────────┐
├──────────────┬───────────────────────────┬──────────────────┤
│ AGENT  380px │  VIEWER  (fluid)          │ INSPECTOR  380px │
│  (left)      │   + transport bar (42)    │  (right)         │
│              ├───────────────────────────┤                  │
│              │  TIMELINE  (252, drag 180–420)  spans L+C     │
├──────────────┴───────────────────────────┴──────────────────┤
└─ status bar (26) ────────────────────────────────────────────┘
```
Agent and inspector are 380px default, resizable. Viewer always wins remaining space.
Workspace pages switch via a centered top-bar tab strip:
**References · Media · Design · Storyboard · Timeline · Render · Extensions.**

---

## Elevation & Depth

Depth is the surface ladder + hairlines. Shadows exist **only** for things that float above the plane.

| Level | Treatment | Use |
|---|---|---|
| 0 — flat | `{color.canvas}` / `{color.surface}`, optional `{color.hairline}` | App background, viewer well, panels |
| 1 — panel | `{color.surface}` + 1px `{color.hairline}` | Agent, inspector, timeline, media pool |
| 2 — card | `{color.surface-card}` + 1px `{color.hairline-2}` | Inputs, layer cards, scene/template cards |
| 3 — active | `{color.surface-active}` + `{color.hairline-hi}` | Hover/selected rows, focused control |
| 4 — selected | `{color.silver-soft}` fill + `{color.silver-line}` edge | Selected clip/scene/layer, applied agent diff |
| 5 — floating | `{color.surface-card}` + `{color.hairline-hi}` + shadow | Menus, command palette, modals, toasts |

Floating shadows: menus `0 18px 44px -10px rgba(0,0,0,.75)`; modals `0 30px 80px -20px rgba(0,0,0,.9)`.
The **viewer well** gets its own depth from a radial vignette `radial-gradient(120% 95% at 50% 0%, #121418, #0a0b0d 78%)` —
the only gradient atmosphere allowed in chrome.

The **only deliberately 3D surface** is the keycap: `linear-gradient(180deg,#15181e,#0d0f13)` + `{color.hairline-hi}`.

---

## Shapes

| Token | Value | Use |
|---|---|---|
| `{radius.xs}` (`--r-sm`) | 4px | Keycaps, micro badges, keyframes, mono chips, lane motion pills |
| `{radius.sm}` (`--r`) | 6px | Buttons, chips, inputs, timeline clips, menu options |
| `{radius.md}` (`--r-lg`) | 9px | Cards, layer cards, popover/menu containers, profile rows |
| `{radius.lg}` (`--r-xl`) | 12px | Lint/events popovers, modals (14px), viewer frame, composer (11px) |
| `{radius.full}` | 9999px | Status dots, the lint chip pill, avatars, segmented toggles |

App chrome lives at **4–12px**. Do not pill-round the editor — pills are for dots, status chips, and toggles only.
The **viewer frame** preserves output aspect (16:9 / 9:16 / 1:1 / custom), letterboxed, never distorted.

---

## Components

> **Law: no component bypasses the command model.** Anything that mutates a project maps to a typed
> command. Agent edits, UI drags, inspector changes, CLI/MCP calls are one operation underneath.

### Buttons
- **`button-primary`** — the single highest-emphasis action per viewport (`Render`, `New Project`, agent send).
  Face = silver gradient `linear-gradient(180deg, {color.silver-hi}, {color.silver} 80%)`, text `#15171a`, 650 weight,
  30px, `{radius.sm}`, inset-top highlight. Hover brightens; active dims. **One per viewport, maximum.**
- **`button-ghost`** — default surface action. Transparent, `{color.body}` text, 1px `{color.hairline-2}`; hover → `{color.surface-active}` + `{color.ink}` + `{color.hairline-hi}`.
- **`button-sm`** — dense inspector action (26px). Same as ghost, smaller. Danger variant: hover → `{color.bad}` text + `{color.bad}` soft fill + border.
- **`icon-btn` / `mini-btn` / `tp-btn`** — square 24–30px icon controls; hover `{color.surface-active}`; active (`.on`) → `{color.silver-soft}` fill + `{color.silver-hi}`.

### Chips, tabs, badges
- **`chip`** — popup trigger (profile / quality / add-scene). `{color.surface-card}`, 1px `{color.hairline-2}`, `{radius.sm}`, 30px; bold value in `{color.ink}`, chevron in `{color.faint}`.
- **`tab`** (inspector) — `{color.mute}` → hover `{color.surface-active}`; active gets `{color.ink}` + 2px `{color.silver}` underline.
- **`workspace-tab`** (top bar) — the AE/Resolve page strip; active → `{color.surface-active}` + `{color.ink}`.
- **`token-pill`** — mono token chooser in the inspector. `{color.surface-card}`, 25px, `{radius.sm}`; selected → `{color.silver-soft}` + `{color.silver-line}` + `{color.silver-hi}`.
- **`badge`** — `{type.micro}`, `{radius.xs}`, semantic-soft bg + semantic text for state (`Local`, `Rendered`, `Beta`); agent badge uses `{color.silver-soft}` + `{color.silver-hi}`.

### Inputs
- **`input` / `select` / `textarea`** — `{color.surface-card}`, 1px `{color.hairline-2}`, `{color.ink}` text, 29px, `{radius.sm}`.
  Focus → `{color.silver-line}` border + `0 0 0 3px {color.silver-soft}` ring (no glow, no hue). Placeholder `{color.faint}`.
- **`numeric-input`** — mono, 32px, ~72px wide; for transform/timing/scale/opacity/frame fields.
- **`slider`** — 2–4px `{color.surface-high}` track, `{color.silver}` fill, white 11–12px thumb with `{color.hairline-hi}` ring.

### The signature panels
- **`agent-panel`** *(left, 380px, required)* — base `{color.surface}`, right hairline. Header label in `{color.silver-hi}`.
  Content is **command records and diff cards, not chat bubbles** — brief input, plan checklist, proposed diffs, history, linter suggestions.
  User messages are small right-aligned bubbles (`{color.surface-active}`, asymmetric `{radius}`); agent replies are flat text under a small labeled avatar.
  The **composer** is a bordered well (`{radius.lg}` 11px) that focus-rings silver, with a silver-gradient send button and a `{type.mono}` provider chip below.
  Every proposed change carries `Apply / Reject / Inspect / Revert`. Less is more — short questions, clickable choices.
- **`agent-diff-chip`** — `{color.silver-soft}` bg, `{color.silver-line}` border, `{type.caption}`, `{radius.sm}`. Format: `Scene 2: slideUpSoft → maskRevealUp` with a revert glyph when applied.
- **`viewer-stage`** *(center, required)* — `{color.surface}` well with the radial vignette; the HyperFrames player or rendered preview centered and letterboxed. Transport bar attaches **below**, never floats over output. Empty state = subtle safe-area grid + one primary action.
- **`transport-bar`** — `{color.surface-raised}`, 42px: play (filled `{color.surface-active}`), frame-step, mono `{color.ink}` timecode with `{color.faint}` separators, frame label, scrub track (`{color.surface-high}` → silver fill, white knob), resolution chip.
- **`inspector-panel`** *(right, 380px, required)* — `{color.surface}`, left hairline. Uppercase `{type.heading}` section heads; rows ~29–36px, label left / control right; numeric values in mono; token pills preview their motion on hover. Hairline dividers, no row shadows.
- **`timeline-editor`** *(bottom, spans agent+viewer, required)* — `{color.surface}`, top hairline, 252px (drag 180–420).
  - **Ruler** 22px, sticky, mono `{color.mute}` ticks (major in `{color.hairline-hi}`).
  - **Gutter** 118px fixed, `{color.surface-raised}`, layer/scene labels + glyph.
  - **Scene track** 56px: rounded blocks `linear-gradient(180deg,{color.surface-active},{color.surface-card})`, thumbnail fill with a dark scrim, silver top-accent, drag-right-edge = retime, drag-block = reorder; selected → `{color.silver-line}` ring. Drop indicator = `{color.silver-hi}` 2px bar with glow.
  - **Lane rows** 28px (alt rows +1.3% white); **clips** 24px, type-tinted, mono motion pills inside; selected → `{color.silver-line}`.
  - **Playhead** 1px `{color.silver-hi}` with a small top triangle handle. Magnetic snap: scene edges, beats, grid, markers, keyframes.
- **`keyframe-diamond`** — 6px rotated square, `{color.silver}` fill, `{color.silver-hi}` border when selected; inactive `{color.mute}`; disabled `{color.faint}`.

### Top bar & status bar
- **`top-bar`** — `{color.surface}`, 46px: silver brand mark (rounded square, sheen + scanline texture) + wordmark left; project menu and workspace tab strip center; profile/quality chips, undo/redo icons, and one `button-primary` (`Render`) right.
- **`status-bar`** — `{color.surface}`, 26px, `{type.caption}`: status dots (semantic + soft halo), a pill **lint chip**, an events button, project path in mono, build info. Both lint and events open upward as floating popovers (`{radius.lg}`, `{color.hairline-hi}` border, big upward shadow) listing findings/commands with autofix and per-row semantic icons.

### Menus, palette, modals
- **`menu`** *(popup)* — `{color.surface-card}`, `{color.hairline-hi}`, `{radius.md}`, menu shadow; options 7px-padded with `{type.label}` name + `{color.mute}` description; selected → `{color.silver-soft}` + check in `{color.silver-hi}`; uppercase `{type.micro}` group labels.
- **`command-palette`** — same shell at `{radius.lg}`, ~720px: 48px borderless search row, 40px rows (active → `{color.surface-active}`), keycap hints right. Exposes every command + NL fallback.
- **`modal`** — `{color.surface-raised}`, `{color.hairline-hi}`, 14px radius, deep shadow, `modalIn` 0.18s ease; header with soft-silver icon tile + title/sub, scrollable body, footer on `{color.surface}`.
- **`toast`** — `{color.surface-active}` + `{color.hairline-hi}`, `{radius.lg}`, bottom-center, `toastIn` 0.22s; error variant borders `{color.bad}`.
- **`keycap`** — the one 3D surface: dark vertical gradient + `{color.hairline-hi}`, mono `{color.body}`, 20px, `{radius.xs}`. For `⌘K`, `Space`, `Esc`, frame-step keys, etc.

### Launcher & cards
- **`main-menu-project-card`** — `{color.surface}`, 1px `{color.hairline}`, `{radius.lg}`, 16px pad; 16:9 poster on `{color.canvas}`; name in `{type.label}`, modified in `{type.caption}`; hover → `{color.surface-card}` + `{color.hairline-hi}`. Demo card is pinned (small `{color.silver-soft}` badge).
- **`scene-card` / `template-card` / `motion-preset-card`** — `{color.surface}`, `{color.hairline}`, `{radius.md/lg}`; thumbnail shows **real motion output**, not stock; selected → `{color.silver-line}`. Motion presets hover-preview the primitive live.

---

## Marketing surface (light)

The app is the product; the marketing site is a short, cinematic on-ramp built from the same tokens.
Dark-first, same `{color.canvas}` base, editorial spacing (`{space.section}`).

- **Hero** — full-width **real editor screenshot or product-motion clip** (viewer + timeline + an agent diff visible), `{type.display}` headline, one `button-primary`. The product, not an abstraction, is the hero image.
- **Pricing** — dark cards, `{color.hairline}` borders; featured tier = `{color.surface-card}` + `{color.silver-line}`, no ribbon, no glow. 3-up → 2-up → 1-up.
- **Footer** — `{color.canvas}`, `{color.hairline}` top, `{color.mute}` links → `{color.ink}` on focus; wordmark left; legal/license/local-first note + GitHub + version in `{type.caption}`.
- A **light reading mode** (`#f5f5f2` paper, `#151515` ink) is permitted for docs/legal only — never the editor.

---

## Do / Don't

**Do**
- Keep the chrome monochrome; let the user's video be the only color on screen.
- Use `{color.silver}` only for selection, focus, primary action, and the brand mark — keep it scarce.
- Build hierarchy from the surface ladder, hairlines, and text brightness before weight/size.
- Hold the mandatory Timeline layout: agent left · viewer center · inspector right · timeline bottom.
- Make every AI change an inspectable, reversible diff; route every mutation through a typed command.
- Use mono for time, frames, IDs, tokens, logs; pair semantic color with text or icon.
- Dogfood the motion system for chrome transitions; respect `prefers-reduced-motion`.

**Don't**
- Don't introduce a chromatic brand hue, neon gradient, AI sparkle, bot mascot, or mesh background.
- Don't make the agent panel louder than the viewer; don't use big rounded chat bubbles.
- Don't put the inspector on the left or the agent on the right in the Timeline workspace.
- Don't ship a generic Tailwind dashboard or a black-box clip with no editable scene graph.
- Don't drop-shadow normal panels/cards; don't pill-round every control.
- Don't use color as the only signal for clip type, lint, or render state.
- Don't hide AI edits behind vague copy ("improved animation") — name the change.

---

## Responsive (desktop-first)

The full editor is desktop-first; mobile is review/light-edit-first.

| Width | Behavior |
|---|---|
| ≥1440 | Default: fixed 380px agent/inspector, fluid viewer, timeline spans. |
| 1280 | Agent/inspector compress toward 320px; viewer stays primary. |
| 1024 | Agent can collapse to an icon rail; timeline height reduces. |
| 768 (tablet) | Agent → left drawer, inspector → right drawer; viewer + timeline stay. **Desktop must keep agent-left / inspector-right.** |
| ≤640 | Timeline becomes a simple scene strip; full editor is read-first; project mgmt single-column. |

Touch: primary buttons ≥44px; timeline rows ≥32px interactive; keyframes ≥18px hit area even at 6px visual; workspace tabs ≥44px; split handles ≥8px. Viewer output letterboxes, never distorts.

---

## Iteration Guide

1. This is the **single** design source. Keep section order: Overview · Colors · Typography · Spacing & Layout · Elevation · Shapes · Components · Marketing · Do/Don't · Responsive · Iteration.
2. Tokens here mirror `styles.css` CSS vars — edit both together; the mapping note at each color group is the contract.
3. Reference tokens directly (`{color.silver-line}`, `{radius.md}`, `{type.mono}`) — don't paraphrase hexes into prose.
4. Start any new screen from the Timeline workspace vocabulary; it anchors the system.
5. Add new component states as their own bullet, not buried in prose.
6. Keep `{color.silver}` scarce — if two silver-accented actions share a viewport, neutralize the lesser one to `button-ghost`.
7. Every editor component must answer: does it **mutate**, **inspect**, **preview**, or **command** the project? If it mutates, it maps to a typed command.
8. When a screen drifts toward generic SaaS: remove color, remove shadows, show real product output, tighten copy.
9. When it feels too dense for non-designers: add a plain-language action, not another explanation card. When too basic for designers: progressively expose layers, timing, easing, keyframes.

## Known gaps
- Final logo/wordmark/icon language not locked. Marketing imagery needs real renders once the demo exists.
- Light mode is docs/legal only — never the editor.
- Alpha-over-dark tokens (silver/semantic softs) need contrast verification in implementation.
- Timeline clip palette may need retuning once real clips, waveforms, and beat markers coexist.
- References/Design/Extensions ship as honest Phase-1/3 shells; empty states must state that scope, not fake features.
