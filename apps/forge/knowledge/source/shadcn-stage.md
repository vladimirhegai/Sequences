# shadcn in Stage

shadcn/ui is the default component vocabulary for clean SaaS surfaces. In Stage you
do NOT install or import shadcn — there is no bundler. Instead you author
shadcn-style markup with Tailwind utility classes against shadcn's design tokens,
which Forge pre-injects. This gives the shadcn look (and light/dark theming) in a
self-contained, HyperFrames-friendly asset.

## Enabling Tailwind + shadcn

Set `"capabilities": { "tailwind": true }` on the asset. Forge then injects, into
the preview only:

- Tailwind v4 (in-browser build) — every utility class works (`bg-primary`,
  `text-muted-foreground`, `rounded-lg`, `border`, `grid`, `gap-4`, …).
- The shadcn token layer — `--background`, `--foreground`, `--card`, `--primary`,
  `--secondary`, `--muted`, `--accent`, `--destructive`, `--border`, `--input`,
  `--ring`, `--radius`, and the `--color-*` / `--radius-*` mappings, in light and
  dark.
- A global `cn(...)` (clsx-style) so JSX can do `className={cn("base", open && "ring-2")}`.

Rules:

- Do NOT add a Tailwind CDN, `@import "tailwindcss"`, or any `import` — it is all
  pre-injected. Just write classes.
- Do NOT import `lucide-react` or any icon package. Use inline `<svg>` (see Icons).
- You may still add a small `css` block for anything Tailwind can't express, and a
  `js` block (or React) for interactions.
- Keep Tailwind classes non-conflicting (the bundled `cn` does not run
  tailwind-merge): don't put `px-3 px-4` on one element.

## Tokens and theming

Style with semantic tokens, never hardcoded colors, so the asset themes cleanly:

- Surfaces: `bg-background`, `bg-card`, `bg-popover`, `bg-muted`, `bg-secondary`,
  `bg-accent`.
- Text: `text-foreground`, `text-muted-foreground`, `text-primary`,
  `text-secondary-foreground`, `text-destructive`.
- Lines/inputs: `border` (defaults to `border-border`), `border-input`,
  `ring-ring`, `outline-ring`.
- Radius: `rounded-sm/-md/-lg/-xl` map to `--radius` (expose `--radius` as a knob
  for a tweakable corner). Default control height is `h-9`, inputs `h-9`, large
  buttons `h-10`.

Dark mode: add `class="dark"` to the root wrapper for a dark asset; everything
inside flips to dark tokens automatically. Expose the brand color as a Forge knob
and feed it into `--primary` if the user should be able to recolor.

## Buttons

```html
<button data-forge-component="primary-cta"
  class="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-md
         bg-primary text-primary-foreground text-sm font-medium
         shadow-sm transition-colors hover:bg-primary/90
         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
         active:scale-[0.98] disabled:opacity-50">
  Get started
</button>
```

Variants (swap the color utilities): secondary `bg-secondary text-secondary-foreground
hover:bg-secondary/80`; outline `border bg-background hover:bg-accent
hover:text-accent-foreground`; ghost `hover:bg-accent hover:text-accent-foreground`;
destructive `bg-destructive text-destructive-foreground hover:bg-destructive/90`.
Sizes: sm `h-8 px-3`, default `h-9 px-4`, lg `h-10 px-6`, icon `h-9 w-9 p-0`.

## Cards

```html
<div data-forge-component="settings-card"
  class="rounded-xl border bg-card text-card-foreground shadow-sm">
  <div class="flex flex-col gap-1.5 p-6">
    <h3 data-forge-component="card-title" class="text-lg font-semibold leading-none tracking-tight">Profile</h3>
    <p class="text-sm text-muted-foreground">Update how your workspace appears.</p>
  </div>
  <div class="p-6 pt-0 grid gap-4"><!-- fields --></div>
  <div class="flex items-center justify-end gap-2 p-6 pt-0"><!-- actions --></div>
</div>
```

## Inputs and forms

```html
<div class="grid gap-2">
  <label class="text-sm font-medium leading-none" for="email">Work email</label>
  <input id="email" data-forge-component="email-input"
    class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm
           shadow-sm placeholder:text-muted-foreground
           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
           disabled:opacity-50"
    placeholder="you@company.com" />
</div>
```

Keep labels real, placeholders ≥4.5:1, and group related fields with `grid gap-4`.

## Badges and status

```html
<span data-forge-component="status-badge"
  class="inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium
         bg-secondary text-secondary-foreground">Active</span>
```

Use `bg-primary text-primary-foreground` for solid, `text-destructive border-destructive/40`
for error pills. Pair color with text — never status by color alone.

## Dialogs, sheets, and menus

Author the open state statically and let a Forge action reveal it (no Radix portal,
no focus trap — Create needs clean static states it can choreograph):

```html
<button data-forge-action="open-menu" data-forge-affects="account-menu"
  class="...button classes...">Account</button>

<!-- @forge-action open-menu label="Open account menu" affects="account-menu" -->
<div data-forge-component="account-menu"
  class="hidden data-[forge-open]:block min-w-48 rounded-md border bg-popover p-1
         text-popover-foreground shadow-md">
  <a class="flex items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground">Settings</a>
  <a class="flex items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground">Sign out</a>
</div>
```

The runtime toggles `data-forge-open` on the affected part, so `data-[forge-open]:block`
reveals it with zero JS. Same pattern for sheets/drawers (swap to a translated panel)
and dialogs (add a `bg-black/50` scrim part).

## Tabs and tables

Tabs: a `role="tablist"` row of buttons on `bg-muted p-1 rounded-lg`, the active tab
`bg-background shadow-sm`, marked `data-forge-component="tab-active"` so Create can
animate selection. Tables: `w-full text-sm`, header row `text-muted-foreground
border-b`, body rows `border-b hover:bg-muted/50`, the highlighted row
`data-forge-component="table-row-active"`.

## Icons

No icon imports. Paste inline SVG (lucide paths are fine), sized with classes and
`stroke-current` so they inherit color:

```html
<svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
  stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M5 12h14M12 5l7 7-7 7" />
</svg>
```

## HyperFrames handoff

- Mark granular parts (`data-forge-component`) on every animatable element — cards,
  rows, the CTA, the badge, the menu — not one wrapper.
- Ship clean static states. Reveal richer states through Forge actions, not Radix
  behavior, so Create owns the entrance/emphasis/exit/camera motion later.
- Stage motion is interaction polish only: `transition-colors`, `active:scale-[0.98]`,
  the `data-[forge-open]` reveal, optional GSAP. Always keep a reduced-motion fallback.
