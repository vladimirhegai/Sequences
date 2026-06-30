# MOTION_CATEGORIES.md — the SaaS motion taxonomy

> Planning / taxonomy doc, **not an engine contract**. Like [FORGE.md](FORGE.md),
> these are working notes. Canonical engine rules live in
> [CLAUDE.md](CLAUDE.md); motion principles in
> [MOTION_RESEARCH.md](MOTION_RESEARCH.md). When this doc proposes a new engine
> field, it is labelled **(proposed)** — nothing here silently invents schema.

This is the single organizing system behind three things at once:

1. **The library website** — a public SaaS-motion inspiration library designers
   browse for ideas (think Mobbin / Refero / Godly, but for *motion*).
2. **My build backlog** — the ordered list of snippets to actually build in Forge
   over the summer. Each cell of the taxonomy is a build brief I can paste into
   an AI for ideas.
3. **The Sequences Extensions tab** — every snippet ships as a `.seqext`
   Extension; the tab groups/filters them by this same taxonomy. ⚠ The current
   Extensions system is **outdated and weakly organized** — treat this taxonomy
   as the *target* it should be rebuilt onto, not a description of what exists.

One taxonomy, three jobs. If it can't do all three, it's the wrong taxonomy.

---

## 0. TL;DR — the decision

**Don't categorize. Coordinate.**

A motion snippet is **not a node in a folder tree** — it's a **point in a small
coordinate space** (a "motion grammar"). We store the coordinates (facets/tags);
we *render* trees as views on top.

The grammar — four axes:

```
  [SUBJECT]  the noun on screen      (what is moving)
  [ACTION]   the verb / function     (what change it explains)   ← the core
  [TECHNIQUE]the mechanism           (how the pixels move)        ← the core
  [STYLE]    the feel                (calm/punchy · organic/mechanical)
```

> A **dashboard** (subject) is **demonstrated** (action) via **cursor + staggered
> mask reveal** (technique), feeling **crisp/mechanical** (style).

- **SUBJECT is fashion** — open-ended, trend-driven, infinite (phones today,
  spatial UI tomorrow). It's the *molecule*.
- **ACTION + TECHNIQUE are physics** — finite and stable. ~11 actions, ~14
  techniques. These are the **periodic table** of motion design — the "cores"
  every animation decomposes into.

**Default view (the spine): `SUBJECT → ACTION`** — a shallow 2-level tree.
Everything else (technique, style, engine kind, aspect, assets, context) are
**filters**. Because storage is facets, not folders, I can re-spine the whole
site by Action or Technique any time without re-filing a single snippet.

The rest of this doc derives that, evaluates the alternatives I rejected, lists
the full vocabularies, maps it onto Sequences, and seeds the first ~80 snippets.

---

## 1. The core insight: motion has primitives, find them

Motion design *looks* infinite. It isn't. The infinity lives entirely in the
**Subject** (you can point a camera at anything) and in surface styling. The
*motion* itself — what actually changes frame to frame and why — collapses to a
small, stable set.

Two questions separate the infinite from the finite:

- **"What change is this motion explaining?"** → a short verb list (ACTION). This
  is straight from [MOTION_RESEARCH.md](MOTION_RESEARCH.md) §4.1: *motion exists
  to explain what appeared, changed, became related, or deserves attention.* If
  motion isn't explaining a change, it's decoration — and decoration is a Style
  attribute, not a category.
- **"By what mechanism do the pixels move?"** → a short mechanism list
  (TECHNIQUE). Transform, opacity, mask, path, morph, counter… These are bounded
  by what a renderer can cheaply do (MOTION_RESEARCH §4.4).

So the taxonomy is built **bottom-up from ACTION + TECHNIQUE** (the cores) and
**indexed top-down by SUBJECT** (how humans search). That's the whole trick.

This also matches what already exists in the codebase, which is reassuring — the
engine's primitive kinds (`enter / exit / emphasis / continuous`) and tags
(`energy: calm|punchy`, `style: organic|mechanical`) are a *coarse* version of
Action + Style. We're refining the same instinct, not inventing a rival one
(see §6 for the exact mapping).

---

## 2. Schemes I considered (and why facets win)

I evaluated five ways to organize this. Summary first, detail below.

| Scheme | Scales to 100s? | Multi-membership? | Good website nav? | Good build backlog? | Sequences-native? |
|---|---|---|---|---|---|
| A. Flat categories | ❌ | ❌ | ⚠ at first | ❌ | ⚠ |
| B. Strict tree (single-parent) | ⚠ | ❌ | ✅ | ✅ | ⚠ |
| C. Pure facets / tags | ✅ | ✅ | ⚠ (no landing) | ⚠ | ✅ |
| D. **Facet storage + tree views (hybrid)** | ✅ | ✅ | ✅ | ✅ | ✅ |
| E. Motion grammar (sentence) | — | — | — | — | — |

(E isn't a rival — it's the *mental model* that defines the facets in D.)

### A. Flat category list — rejected
"Dashboards, Phones, Text, Numbers, Search, Carousels…" — pick a bucket.
- **Pro:** instantly understandable; matches first-instinct search.
- **Con:** the junk-drawer death. Where does *a phone showing a dashboard with
  rolling numbers* go? Everything is multi-membership. Doesn't survive past ~30
  items. The user already vetoed this ("can't just have 5 categories").

### B. Strict tree (single-parent hierarchy) — rejected as *storage*
`Interface > Dashboard > Metric cascade`.
- **Pro:** familiar; renders as a clean sidebar; the "tree idea" the brief floated.
- **Con:** single-parent is the classic taxonomy trap. A snippet has a subject
  *and* an action *and* a technique *and* a feel — a tree forces you to pick one
  as the parent and bury the rest. Cross-cutting queries ("all morphs",
  "everything punchy") become impossible. Re-org = re-file everything. Trees are
  a great **view**, a terrible **database**.

### C. Pure facets / tags — rejected as *the whole answer*
Every snippet = a bag of tags; browse by filtering.
- **Pro:** scales infinitely; native multi-membership; maps 1:1 onto the existing
  `.seqext` tag model; filtering is how real inspiration libraries work.
- **Con:** a pure facet system has **no front door**. You land on… a filter
  panel? Designers need a browseable spine and a sense of "the collection." Pure
  tags also rot into synonym soup without a controlled vocabulary.

### D. Facet storage + tree views — **chosen** ✅
Store each snippet as a point in the grammar (controlled facets). Render the
site, the Extensions tab, and the backlog as **tree views** over that data, with
a chosen default spine and filters for everything else.
- **Pro:** every advantage of C, plus B's browseability, minus B's rigidity.
  Multi-membership is free (a snippet just has more than one tag). One data
  model, many navigations: Subject→Action by default, but flip to Action→Subject
  or Technique→Subject with zero re-filing. Controlled vocab per facet keeps it
  clean. Directly compatible with Sequences (facets are manifest metadata).
- **Con:** must commit to controlled vocabularies (done — §3–5) and pick a
  default spine (done — Subject→Action, §3.1). Slightly more upfront design than
  a flat list. Worth it.

### E. Motion grammar (the lens, not a scheme)
Treat each snippet as a sentence: *Subject — Action — Technique — Style.* This is
how I **derived** D's facets (the parts of speech *are* the axes) and how I
decompose a reference video (§7). It's the thinking tool; D is the filing system.

---

## 3. The axes (controlled vocabularies)

Four axes describe any snippet. Two more (engine + delivery) come for free from
the `.seqext` bundle. Keep each vocabulary **closed and curated** — new values
are deliberate additions, not free text.

### 3.1 SUBJECT — the noun (the spine, level 1→2)

What's literally on screen. This is what designers type into search, so it's the
default top-level. Organized as **Family → Subject** (shallow, 2 levels).

| Family | Subjects (level 2) |
|---|---|
| **App & Dashboard UI** | dashboard, table/grid view, settings/form panel, sidebar/nav, kanban/board, modal/sheet, empty state |
| **Devices & Frames** | phone, laptop, browser window, tablet, watch, multi-device handoff |
| **Data & Metrics** | line/area chart, bar chart, gauge/radial, KPI tile, progress/meter, sparkline, map heat |
| **Cards, Lists & Grids** | card, list row, feed, tile grid, stacked deck, masonry, carousel |
| **Search, Input & Command** | search bar, command palette, filter/facet, text input, dropdown/select, date picker |
| **Notifications & Status** | toast, badge/counter, alert banner, presence/avatar dot, activity item, status change |
| **Type & Words** | headline, tagline/subhead, kinetic phrase, code/terminal, label/eyebrow, quote |
| **Brand & Logo** | logo mark, wordmark, lockup, app icon, CTA button finish |
| **Pointer & Interaction** | cursor, click/tap ripple, drag, hover state, toggle/switch, scroll proxy, selection |
| **Connectors & Flows** | node graph, pipeline, integration web, flowchart, timeline, path/route |
| **Media & Imagery** | screenshot, photo, video frame, captioned media, before/after |
| **Atmosphere & Background** | gradient field, grid/dots, particles/mesh, glow/spotlight, depth/parallax bg |

~12 families, ~70 subjects. Grows by adding leaves, never by restructuring.

### 3.2 ACTION — the verb / narrative function (a core; spine level 2 grouping)

**The most important axis.** What change is the motion explaining? Finite —
this is the periodic table. Every snippet has exactly **one dominant action**
(it may contain others as supporting beats).

| Action | It explains… | Engine kind (≈) |
|---|---|---|
| **Reveal** | "this now exists / arrived" | `enter` |
| **Dismiss** | "this is leaving / done" | `exit` |
| **Emphasize** | "look *here*, this matters" | `emphasis` |
| **Transform** | "A *became* B (same identity)" — morph | scene / multi-step |
| **Transition** | "we moved from state/scene A to B" | transition + camera |
| **Demonstrate** | "here's how it's *used*" — click/type/drag/toggle | `emphasis` beats |
| **Quantify** | "the number/data resolves to *this*" — count/fill/plot | `enter` (countUp) |
| **Assemble** | "parts compose into a whole" | `enter` (staged) |
| **Sequence** | "a group arrives in order" — cascade/stagger | `enter` + solver |
| **Orbit** | "a set cycles / loops through" — carousel/gallery | `continuous` |
| **Sustain** | "this stays alive while held" — idle/ambient | `continuous` |

11 actions. Note the last column: Action is **richer than** the engine's 4
primitive kinds — several actions map to one kind, and Transform/Transition live
at the *scene* level (transitions + camera registries), not the layer-primitive
level. §6 handles the mapping precisely.

### 3.3 TECHNIQUE — the mechanism (a core; a multi-select filter)

*How* the pixels actually move. A snippet usually combines 1–3. This is the
craft layer and the one closest to the engine primitives. **Multi-select.**

| Technique | What moves |
|---|---|
| **Fade** | opacity |
| **Slide** | x/y translate, directional |
| **Mask / Clip** | reveal through an overflow boundary |
| **Scale / Zoom** | grow/shrink from an anchor |
| **Blur / Focus** | filter sharpness |
| **Rotate / 3D** | rotation, tilt, perspective |
| **Stagger** | timing pattern across a group |
| **Draw / Path** | SVG stroke draw, motion along a path |
| **Morph / FLIP** | shape or layout interpolation (size/position) |
| **Parallax / Depth** | layered differential movement |
| **Spring / Physics** | inertia, overshoot, settle |
| **Camera** | stage-level push/pull/pan (not per-layer) |
| **Split** | per-char / per-word / per-line decomposition |
| **Counter** | tween a numeric/graphic value to a target |

14 techniques. Prefer transform/opacity-cheap ones unless a measured effect
justifies more (MOTION_RESEARCH §4.4).

### 3.4 STYLE — the feel (filter; **engine-native today**)

Already in the `.seqext` manifest — reuse verbatim, don't reinvent.

- **Energy:** `calm` ↔ `punchy`
- **Style:** `organic` ↔ `mechanical`
- **Register (proposed, website-only):** `minimal · premium · playful · technical`
  — a coarse mood for inspiration filtering; never enters the engine.

### 3.5 Engine & delivery facets (free from the bundle)

Carried by every Extension; surfaced as filters:

- **primitiveKind:** `enter | exit | emphasis | continuous` (the bundle's hard kind)
- **aspect:** `16:9 | 9:16 | 1:1`
- **assets needed:** `none | screenshot | device | logo | data | photo`
- **context (proposed, website-only):** where in a video it earns its place —
  `hero/opener · feature-proof · social-proof · cta/closer · bridge · loop/ambient`

---

## 4. The spine (the default tree view)

The website nav, the Extensions tab groups, and the backlog chapters all default
to the **same** 2-level spine, with filters down the side:

```
SUBJECT FAMILY                 ← top-level section (12)
  └─ SUBJECT                   ← sub-section (~70)
       └─ grouped by ACTION    ← the snippet groups within a subject
            • snippet, snippet, snippet …

   ── filters (apply across everything) ──
   Action · Technique · Energy · Style · Register
   primitiveKind · aspect · assets · context
```

Example slice:

```
Devices & Frames ▸ Phone
   Reveal     · phone slides up into frame, screen fades on
   Orbit      · 3 phones arc through a circular gallery        ← your example
   Demonstrate· thumb taps through 3 screens
   Sustain    · idle float + subtle screen shimmer
App & Dashboard UI ▸ Dashboard
   Reveal     · panels cascade in, chrome then data
   Demonstrate· cursor tours 3 hotspots, each lights up        ← your example
   Quantify   · KPI tiles count up in sequence
```

Because the data is faceted, the **same snippets** re-render under an
Action-first spine ("Orbit ▸ Phone / Carousel / Logo set") or a Technique-first
spine ("Morph ▸ Search→results / Card→detail / Icon→icon") for free. The website
can offer all three as toggle "lenses."

---

## 5. Naming & IDs

Three identifiers, each for its job:

| Where | Form | Example |
|---|---|---|
| **Engine extension id** (exists; `validateBundle` enforces `primitiveKind.` prefix) | `<primitiveKind>.<camelName>` | `emphasis.cursorTour` |
| **Library slug** (website URL) | `<family>/<subject>/<action>-<name>` | `app-ui/dashboard/demonstrate-cursor-tour` |
| **Human title** (cards) | Title Case phrase | "Dashboard Cursor Tour" |

The engine id stays minimal and law-abiding. The *rich* taxonomy (subject,
action, technique[], register, context) rides as **metadata**, not in the id.

**Proposed additive manifest block** (optional, non-breaking — current
`SeqextManifestSchema` only requires `id/type/version/summary/tags/source`, so
this is a deliberate future extension, not an existing field):

```jsonc
// in a .seqext manifest.json  (PROPOSED — see SeqextManifestSchema)
"library": {
  "subject": "dashboard",
  "family": "app-ui",
  "action": "demonstrate",
  "technique": ["stagger", "scale", "mask"],
  "register": "technical",
  "context": ["feature-proof"]
}
```

`tags.energy` / `tags.style` already exist and are **not** duplicated here.

---

## 6. How this binds to Sequences

**Split what's fixed from what's fair game.** The engine *invariants* hold — this
taxonomy never touches them. But the Extensions *organization* (the tab, the
manifest's tagging, the grouping) is currently outdated and weakly thought-out,
so it's explicitly **up for redesign onto this taxonomy** rather than something to
preserve.

| Fixed (don't touch) | Fair game (redesign onto this taxonomy) |
|---|---|
| `applyCommand` mutation pathway (law 1) | how Extensions are grouped/filtered/displayed |
| token purity (law 3), one-way compiler (law 2) | the manifest's library metadata (subject/action/…) |
| `validateBundle` structural gate | whether a bundle is `primitive` vs `composition` (§9) |
| `project.extensions.enabled` scoping (law 9) | the Extensions tab UI/IA wholesale |

So the `library` block (§5) and the tab grouping below are the **intended new
model**, not a timid add-on. This taxonomy is metadata *about* Extensions; it
rides alongside the registry and never reaches into the mutation pathway,
compiler, or tokens.

**Action → primitiveKind** (Action is the library concept; primitiveKind is the
engine concept the bundle must declare):

| Library Action | Bundle `primitiveKind` | Notes |
|---|---|---|
| Reveal, Assemble, Sequence | `enter` | entrance flavors; solver orders them |
| Quantify | `enter` | `enter.countUp` is the canonical case |
| Dismiss | `exit` | |
| Emphasize, Demonstrate | `emphasis` | demonstrate = choreographed emphasis beats |
| Orbit, Sustain | `continuous` | looped / held |
| Transform, Transition | *scene-level* | realized via the **transitions** (8) + **camera** (2) registries, or a multi-step bundle, not a single layer primitive |

A composition snippet (e.g. "dashboard demonstrate") exports as **one bundle**
whose `skeleton` has many `StepTemplate` steps over many `data-forge-component`
parts, with a **dominant** `primitiveKind`. The Forge draft model already carries
both `route` and `primitiveKind`, so this is consistent with FORGE.md.

**Forge's 6 Create routes are just frequent cells of Subject × Action** — keep
them as *saved filters*, not a parallel taxonomy:

| Forge route | = Subject × Action filter |
|---|---|
| `interface-reveal` | {App UI, Cards/Lists} × {Reveal, Sequence} |
| `micro-interaction` | {Pointer, App UI} × {Demonstrate, Emphasize} |
| `data-moment` | {Data & Metrics} × {Quantify, Emphasize} |
| `brand-sting` | {Brand/Logo, Type} × {Assemble, Reveal} |
| `transition-bridge` | (any) × {Transition, Transform} |
| `media-frame` | {Media, Devices} × {Reveal} |

So Forge's retrieval routing (`createKnowledge.ts`) can be driven by the same
`action`/`subject` tags — no second system to maintain.

**Extensions tab** (still incomplete — per the brief, we have room): group by
Subject Family by default; offer the Action/Technique/Energy/Style filters from
§3. `project.extensions.enabled` (law 9) gates *which* are selectable; the
taxonomy gates *how they're displayed*. The two are orthogonal.

**What this does NOT change:** tokens, primitives' token-purity (law 3), the
one-way compiler (law 2), `applyCommand` (law 1), or `validateBundle`. New
manifest fields are additive and optional.

---

## 7. The workflow: reference video → filed + buildable

This is the loop the brief describes — see a cool animation on YouTube/an ad,
file it, build it. The grammar makes both steps mechanical.

**Decompose** (fill the sentence):

1. **Subject** — what's on screen? → pick family + subject.
2. **Action** — what change is it explaining? → pick the *one dominant* verb.
3. **Technique** — how do the pixels move? → pick 1–3 mechanisms.
4. **Style** — energy (calm/punchy), style (organic/mechanical), register.
5. File it at `<family>/<subject>` under its Action group. Done — it's also now a
   build brief.

**The five examples from the brief, decomposed:**

| Reference | Subject | Action | Technique | Style | Slug |
|---|---|---|---|---|---|
| Dashboard + clicking UI | app-ui / dashboard | **Demonstrate** | cursor + stagger + scale | punchy · mechanical | `app-ui/dashboard/demonstrate-cursor-tour` |
| Phones in a circular gallery | devices / phone | **Orbit** | rotate/3D + parallax + scale | calm · organic | `devices/phone/orbit-arc-gallery` |
| Search bar → results morph | search / search-bar | **Transform** | morph/FLIP + mask | punchy · mechanical | `search/search-bar/transform-to-results` |
| Text animations | type / kinetic-phrase | **Reveal** | split + mask + slide | punchy · mechanical | `type/kinetic-phrase/reveal-line-mask` |
| Numbers rolling up | data / kpi-tile | **Quantify** | counter + fade | punchy · mechanical | `data/kpi-tile/quantify-count-up` |

Notice each lands in a clean cell, carries multi-technique tags, and the slug
*is* the build ticket.

**Generate ideas for a cell** (paste into AI):

```
You are a senior SaaS motion designer. Give me 8 distinct snippet ideas for:
  SUBJECT: {subject}        (e.g. dashboard)
  ACTION:  {action}         (e.g. demonstrate)
  STYLE:   {energy/style}   (e.g. punchy, mechanical, technical register)
Constraints: explains a real change (not decoration); one loud moment;
transform/opacity-first; readable at 1080p; 3–8s; works as a standalone loop.
For each: one-line concept, the 1–3 techniques used, and the single hero beat.
```

That prompt + a taxonomy cell = an endless, *organized* idea faucet. Build the
best, file it back under the same cell, ship it as a `.seqext`.

---

## 8. Starter backlog (seed for the summer)

First snippets per family, each tagged `Action · technique`. Build order is
roughly top-to-bottom (highest-leverage / most-reused first). This is a seed —
add leaves freely; the structure doesn't move.

### App & Dashboard UI
- Dashboard panel cascade — *Reveal · stagger+mask* (chrome first, then data)
- Dashboard cursor tour — *Demonstrate · cursor+scale+stagger* ⭐ your example
- KPI tiles count-in — *Quantify · counter+stagger*
- Table rows populate — *Sequence · stagger+fade*
- Row highlight on action — *Emphasize · scale+glow*
- Settings toggle flip — *Demonstrate · spring+slide*
- Sidebar expand/collapse — *Transform · morph/FLIP*
- Kanban card drag across columns — *Demonstrate · drag+spring*
- Empty state → first item — *Transform · morph+fade*

### Devices & Frames
- Phone slide-up reveal — *Reveal · slide+mask*
- Phone arc / circular gallery — *Orbit · rotate3D+parallax* ⭐ your example
- Thumb taps through screens — *Demonstrate · cursor+slide*
- Laptop lid open → screen on — *Reveal · rotate3D+fade*
- Browser URL type → page load — *Demonstrate · counter/type+mask*
- Multi-device handoff (phone→laptop) — *Transition · slide+morph*
- Device idle float — *Sustain · spring*

### Data & Metrics
- Number roll-up — *Quantify · counter+fade* ⭐ your example
- Line chart draw-on — *Quantify · draw/path*
- Bars grow in sequence — *Quantify · scale+stagger*
- Radial gauge fill — *Quantify · draw/path+counter*
- Progress bar to milestone — *Quantify · mask+counter*
- Sparkline + delta pop — *Emphasize · draw+scale*
- Live metric tick update — *Sustain · counter*

### Cards, Lists & Grids
- Card deck fan-in — *Assemble · stagger+rotate*
- Card hover lift — *Emphasize · scale+shadow*
- Card → detail expand — *Transform · morph/FLIP*
- Feed items stream in — *Sequence · stagger+slide*
- Tile grid build — *Assemble · scale+stagger*
- Carousel auto-advance — *Orbit · slide+parallax*

### Search, Input & Command
- Search bar → results morph — *Transform · morph+mask* ⭐ your example
- Command palette open + filter — *Reveal · mask+stagger*
- Type → live filtering list — *Demonstrate · counter/type+stagger*
- Dropdown spring open — *Reveal · spring+mask*
- Filter chips apply → grid reflow — *Transform · morph/FLIP*
- Form field focus + validate — *Emphasize · glow+spring*

### Notifications & Status
- Toast stack cascade — *Sequence · slide+stagger* (the FORGE.md example)
- Badge count increment pop — *Quantify · counter+scale*
- Alert banner drop-in — *Reveal · slide+spring*
- Presence dot online — *Emphasize · scale+glow*
- Status pill change (pending→done) — *Transform · crossfade+scale*
- Activity item live add — *Sustain · slide*

### Type & Words
- Headline line-mask reveal — *Reveal · split+mask* ⭐ your example
- Word-by-word build — *Sequence · split+slide*
- Char cascade hook — *Reveal · split+slide* (≈ `enter.charCascade`)
- Underline sweep on keyword — *Emphasize · draw*
- Text swap / cycle words — *Transform · mask+slide*
- Code typing in terminal — *Demonstrate · counter/type*

### Brand & Logo
- Logo mark assemble — *Assemble · draw+scale*
- Wordmark mask reveal — *Reveal · mask+slide*
- Lockup settle (mark+word) — *Assemble · spring+stagger*
- App icon pop — *Reveal · scale+spring*
- CTA button finish (fill + glow) — *Emphasize · mask+glow*

### Pointer & Interaction
- Cursor move + click ripple — *Demonstrate · slide+scale* (reusable primitive!)
- Drag handle move — *Demonstrate · drag+spring*
- Toggle switch flip — *Demonstrate · spring+slide*
- Hover reveal tooltip — *Reveal · fade+scale*
- Selection marquee — *Demonstrate · scale+mask*

### Connectors & Flows
- Pipeline nodes light in sequence — *Sequence · draw+stagger*
- Integration web connect — *Assemble · draw/path*
- Flow path animate (A→B) — *Transition · draw/path*
- Timeline progress — *Quantify · draw+mask*
- Node graph settle — *Sustain · spring*

### Media & Imagery
- Screenshot scale-in w/ device chrome — *Reveal · scale+mask*
- Before/after wipe — *Transform · mask/clip*
- Captioned media reveal — *Reveal · slide+fade*
- Ken Burns hold — *Sustain · scale+slide* (≈ `continuous.kenBurns`)
- Video frame → play state — *Transform · scale+fade*

### Atmosphere & Background
- Gradient field drift — *Sustain · slide* (use sparingly; chrome stays quiet)
- Grid/dots parallax — *Sustain · parallax*
- Spotlight follow — *Emphasize · slide+blur*
- Depth layers on scroll — *Sustain · parallax*

~80 seeds. The big families (App UI, Data, Search, Type) carry the most because
SaaS motion lives there; Atmosphere stays thin on purpose (Design DNA: chrome
quiet, the product is the color).

---

## 9. Open questions / how it evolves

- **Register & context** are website-only mood facets — validate they actually
  help filtering before promoting them to engine metadata. (MOTION_RESEARCH
  warns against inventing engine fields ahead of need.)
- **Compositions vs. primitives:** today every `.seqext` is `type: "primitive"`.
  If multi-part snippets strain that (a "demonstrate" with 6 parts), consider a
  `type: "composition"` bundle later — but only when a real snippet can't be
  expressed as one skeleton. Don't pre-build it.
- **Subject vocabulary** is the only axis expected to grow; keep it a curated
  closed list (PRs add leaves) so it never becomes free-text tag soup.
- **Lenses:** ship Subject→Action first; add Action-first and Technique-first
  toggle views once there's enough content to justify them (~50+ snippets).
- **Cross-linking:** snippets that `pairsWith` / `conflictsWith` (already in
  `SeqextSpec.relationships`) can power "goes well with" on the website for free.

When this doc and the source disagree about an engine fact, **the source wins**
and this doc gets fixed (same rule as MOTION_RESEARCH §3).
