# React in Stage

Use React/JSX when the asset needs reusable structure, local state, tab/menu
logic, or a clearer component tree. Stage is still a single self-contained asset
for Create and Hyperframes, not a shipped web app.

## Output Shape

Return normal `html`, `css`, and `js` fields. Add `react` only when needed:

```json
{
  "asset": {
    "name": "Product Command Center",
    "html": "<div id=\"forge-react-root\"></div>",
    "css": "/* @forge-var accent type=color default=#5e6ad2 label=\"Accent\" */",
    "react": {
      "rootId": "forge-react-root",
      "tsx": "function App(){ return <main data-forge-component=\"root\" /> }"
    },
    "js": "",
    "capabilities": { "react": true }
  }
}
```

No imports, exports, or render calls. Forge compiles the TSX and renders it with
local `React`, `ReactDOM`, and `ForgeReact` globals.

## Supported Pattern

- Use function components.
- Use `React.useState`, `React.useEffect`, `React.useMemo`, and `React.useRef`.
- Use `ForgeReact.useForgeVar(name, fallback)` when React logic needs a public
  Forge knob value.
- Put Forge contract attributes directly in JSX with string literal values.
- Keep all data local and deterministic.

## Motion-Ready Markup

Create can animate only what Stage names. Mark meaningful pieces, not just the
outer wrapper:

```tsx
function App() {
  const accent = ForgeReact.useForgeVar("accent", "#5e6ad2");
  const [open, setOpen] = React.useState(false);
  return (
    <main data-forge-component="root" style={{ "--liveAccent": accent }}>
      <nav data-forge-component="nav">...</nav>
      <h1 data-forge-component="hero-title">Pipeline health</h1>
      <button
        data-forge-action="toggle-drawer"
        data-forge-affects="drawer"
        onClick={() => setOpen(!open)}
      >
        Filters
      </button>
      <aside data-forge-component="drawer" data-forge-open={open ? "" : undefined}>...</aside>
    </main>
  );
}
```

Use CSS variables and `data-forge-var` bindings for knob-driven copy/media when
possible. Use React state for UI states that Create may trigger through actions.
