# GSAP in Stage

GSAP is available locally in Stage assets when the agent sets
`capabilities.gsap=true` or uses `gsap` in returned JS/TSX. Use it for interaction
and state polish inside the asset. Create and Hyperframes add the cinematic
entrance, emphasis, exit, and camera choreography later.

## Canonical Usage

```js
const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
if (!reduce) {
  const tl = gsap.timeline({ defaults: { duration: 0.32, ease: "power3.out" } });
  tl.to(".drawer", { x: 0, autoAlpha: 1 });
}
```

Prefer:

- `gsap.timeline()` for coordinated sequences.
- `x`, `y`, `scale`, `rotate`, `opacity`, and `autoAlpha`.
- Scoped selectors through a root element or `gsap.context`.
- Short interaction durations, usually `0.14` to `0.45`.
- `power2.out`, `power3.out`, or `expo.out` for product UI polish.

Avoid:

- Long page-load intro sequences. Hyperframes owns that later.
- Animating layout properties like width, height, top, left, margin, or padding.
- `ScrollTrigger` unless the user explicitly asks for a scroll-driven asset.
- Infinite decorative motion unless it is directly part of the product state.

## React Pattern

```tsx
function App() {
  const root = React.useRef(null);
  React.useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      gsap.fromTo("[data-forge-component='status-pill']", { autoAlpha: 0, y: 6 }, { autoAlpha: 1, y: 0 });
    }, root.current);
    return () => ctx.revert();
  }, []);
  return <main ref={root} data-forge-component="root">...</main>;
}
```

## Forge Actions

Actions should be triggerable by the host through `forge.trigger(name)`. For simple
open/close states, declare `data-forge-affects` and let the Forge runtime toggle
`data-forge-open`. For custom GSAP behavior, register an action:

```js
forge.on("focus-search", () => {
  gsap.to("[data-forge-component='search-shell']", { scale: 1.02, duration: 0.18, ease: "power2.out" });
});
```

Always include a reduced-motion fallback and leave the final shot-level motion to
Create/Hyperframes.
