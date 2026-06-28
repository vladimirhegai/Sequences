# HyperFrames Authoring Contract

The composition contract Forge Create must honor when it emits HyperFrames
HTML/skeletons. Distilled from the upstream `hyperframes-core` skill (see
`NOTICE.md`). These are the silent-failure rules `lint`/`validate`/`inspect`
do **not** catch — the ones Create's motion critic and repair route care about.

## Composition root

Every composition is an HTML document with a sized root element:

```html
<div id="root" data-composition-id="root" data-width="1920" data-height="1080">
  <!-- timed elements -->
</div>
```

- Root must be a **sized box** (px width/height). Every ancestor down to a
  `height:100%` child must have a resolved height, or a flex/`100%` child
  collapses to ~0 and content piles into the top-left corner. (Silent.)
- `data-composition-id` is the unique id of the composition wrapper (required)
  and must equal the `window.__timelines["<id>"]` key exactly — no
  `-mount`/`-slot`/`-host` suffix.

## Two root forms (not interchangeable)

- **Standalone** (top-level `index.html`): root `<div>` sits directly in
  `<body>` — **no `<template>` wrapper** (wrapping hides all content).
- **Sub-composition** (loaded via `data-composition-src`): root **must** be
  wrapped in `<template>`. The runtime only clones `<template>` contents;
  everything outside (incl. `<head>` styles/scripts) is discarded — put
  `<style>`/`<script>` **inside** the template.

## One paused timeline

Each composition registers **exactly one** `gsap.timeline({ paused: true })`
at `window.__timelines["<id>"]`, built **synchronously** at page load. Render
duration = root `data-duration`, **not** the timeline length. Position param
(3rd arg) is absolute time: `tl.to(el, vars, 1.5)`. Supported: `set`, `to`,
`from`, `fromTo`.

## Non-negotiable rules (silent bugs)

- No render-time clocks (`Date.now`, `performance.now`), no unseeded
  `Math.random`, no render-time network, no input state (hover/scroll/focus).
- No `repeat: -1`. Use a finite count:
  `repeat: Math.max(0, Math.floor(duration / cycle) - 1)` (floor, not ceil).
- Animate only the visual allowlist: `opacity`, `x`, `y`, `scale`, `rotation`,
  `color`, `backgroundColor`, `borderRadius`, transforms. **Never** `display`
  or `visibility`; never `width`/`height`/`top`/`left` for layout changes
  (animate a wrapper instead).
- No `gsap.set()` on clip elements from later scenes (they aren't in the DOM at
  page load). Use `tl.set(selector, vars, time)` inside the timeline at/after
  the clip's `data-start`.
- Build timelines synchronously — never inside `async`/`Promise`/`setTimeout`/
  event handlers; the renderer can sample before they finish.
- Every `id` is unique across the **assembled** page. Inside a sub-comp, prefix
  ids with the composition id (`#<id>-hero`). Duplicate `<video>`/`<img>` ids
  render **blank**.
- A full-screen scene fill goes on a full-bleed **child**
  (`position:absolute; inset:0`), never on the composition root itself — the
  producer's frame compositing can drop the root's own `background` (frame
  renders **black**) even though preview looks correct.
- Transformed elements must be block-level + sized: `transform`/`scaleX/Y` is a
  no-op on an inline `<span>`, and scaling an auto-width element shows nothing.
- No `<br>` in body text — let text wrap via `max-width`.

## Media

`<video>`/`<audio>` must be a **direct child of the host root** (never inside a
sub-comp `<template>`/wrapper). The framework owns playback — never call
`video.play()`/`pause()` or set `currentTime`. Use GSAP for visual props only.
Videos must be `muted` + `playsinline`. Animate a wrapper div for PiP-style
size/position moves, not the `<video>` element itself.
