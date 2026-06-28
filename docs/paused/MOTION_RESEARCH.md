# Sequences Motion-Design Research

Reviewed: June 21, 2026

Status: internal research, not an implementation contract

This document consolidates the former broad motion-market report and the Kimi
skill-architecture report. It retains claims that are supported by the current
Sequences codebase or by linked primary sources. Product recommendations and
unvalidated design ideas are labeled as hypotheses.

## 1. Research question

Sequences is a local-first editor for short SaaS and app product videos. Its
central technical idea is to let an agent select from a constrained motion
vocabulary while deterministic code controls project state, layout, timing,
validation, compilation, and rendering.

The practical research question is:

> How can Sequences help a small product team create clear, polished product
> videos while keeping the output editable, reproducible, and inexpensive to
> revise?

This is narrower than general video generation, interactive app animation, or
professional compositing. Those fields can supply useful references without
becoming the product's scope.

## 2. Evidence policy

This document distinguishes three kinds of statements:

- **Repository fact:** directly observable in the current source and tests.
- **External fact:** supported by a linked official specification,
  documentation page, or product page, checked on June 21, 2026.
- **Hypothesis:** a product or design direction that needs prototypes, user
  testing, or measured output comparison.

The document intentionally excludes:

- unverified conversion claims;
- claims that one product or technique is universally “best”;
- prices, market sizes, and usage figures that can change quickly;
- statements that professional quality can be reduced to one technique or
  percentage;
- invented Sequences commands, fields, interfaces, or linter rules;
- fixed delivery dates without an estimate based on available capacity.

## 3. Current Sequences foundation

The following are repository facts from the June 21, 2026 working tree:

- The canonical project format is schema v3, with migrations from v1 and v2.
- Canonical edits use a typed command pathway with validation and exact inverse
  generation.
- The registry contains 16 motion primitives, 7 scene archetypes, 3 motion
  profiles, 2 camera moves, and 8 transition identifiers.
- The deterministic linter contains 14 rules.
- The command union contains 33 command types.
- The MCP server exposes 11 tools.
- The Studio has seven workspaces and is implemented in vanilla JavaScript,
  HTML, and CSS. React is used for the Excalidraw storyboard integration.
- The compiler produces HyperFrames-compatible HTML and the render pipeline
  uses a browser capture path plus FFmpeg.
- The June 21 verification run passed 23 test files and 152 tests, the
  performance budget, four-scene golden determinism, 16 primitive probes, and
  three browser smoke suites.

The exact implementation inventory lives in `CURRENT_STATE.md`. If this
research document conflicts with that file or the source, the source wins.

## 4. Motion principles supported by primary guidance

### 4.1 Motion should explain change

Motion is most useful when it helps a viewer understand what appeared, what
changed, what is related, or where attention should move.

Material Design describes transitions as connections between elements or
views, and its transition guidance recommends a unified primary direction
rather than unrelated movement in several directions:

- [Material Design 3: Motion](https://m3.material.io/styles/motion/overview/how-it-works)
- [Material Design 3: Applying transitions](https://m3.material.io/styles/motion/transitions/applying-transitions)

Apple's Human Interface Guidelines likewise treat motion as part of a familiar
and consistent experience rather than decoration in isolation:

- [Apple Human Interface Guidelines: Motion](https://developer.apple.com/design/human-interface-guidelines/motion)

Implication for Sequences:

- scene motion should reinforce narrative and visual hierarchy;
- transitions should preserve or intentionally redirect attention;
- decorative movement should not compete with product information.

“One loud motion per scene” is a useful Sequences house rule, not a universal
law. It should remain testable and overrideable.

### 4.2 Hierarchy matters more than motion quantity

A product-video scene usually contains a message, a product image or
demonstration, and supporting material. The viewer needs a readable order.

Sequences already encodes hierarchy through archetype roles and
`hierarchyRank`. The solver can use those authored roles to schedule entrances.
This is more reliable than asking a model to infer importance from unrestricted
animation code.

Research hypothesis:

- output preference will improve when the hero/support relationship is clearer,
  even if the total number of animated elements decreases.

This should be evaluated through side-by-side renders rather than asserted as a
fixed percentage of perceived quality.

### 4.3 Timing and easing are contextual variables

Material Design exposes motion schemes and easing/duration guidance rather
than one timing curve for every interaction:

- [Material Design 3: Easing and duration](https://m3.material.io/styles/motion/easing-and-duration)

Sequences uses named duration, easing, distance, stagger, and scale tokens.
Profiles choose among those tokens and primitives. The current solver takes
its overlap budget from the selected profile and its simultaneity cap from
`CHOREO_DEFAULTS`.

Important implementation correction:

- `SetChoreography` accepts `stagger`, `settleGap`, and `order`.
- The ordering field is named `order`, not `entranceOrder`.
- `overlapBudget` and `simultaneityCap` are solver/profile defaults, not
  user-command fields.

The existing 65% overlap value is a product default to tune, not an externally
proven optimum.

### 4.4 Performance should influence the motion vocabulary

web.dev identifies `transform` and `opacity` as the browser properties most
likely to animate efficiently and documents tools for diagnosing animation
performance:

- [Why are some animations slow?](https://web.dev/articles/animations-overview)
- [How to create high-performance CSS animations](https://web.dev/articles/animations-guide)

Implication for Sequences:

- prefer transform/opacity-based primitives where they express the intended
  effect;
- treat filters, layout-triggering properties, large media, and complex
  compositing as effects that need measurement;
- verify real compiled scenes instead of assuming a primitive is inexpensive.

This guidance applies to browser preview and capture. Final render cost also
depends on resolution, frame rate, browser behavior, media decoding, and
encoder settings.

### 4.5 Reduced motion is an accessibility requirement for the editor

The `prefers-reduced-motion` media query communicates a user's preference for
less non-essential motion. web.dev recommends honoring it in CSS and
JavaScript-driven animation:

- [prefers-reduced-motion](https://web.dev/articles/prefers-reduced-motion)
- [Animation and motion accessibility](https://web.dev/learn/accessibility/motion)

For Sequences this creates two separate concerns:

1. The **Studio interface** should reduce non-essential panel, modal, hover,
   and transition motion when requested.
2. The **video being authored** is user content. The editor may later offer a
   reduced-motion output profile or warnings, but it should not silently change
   the user's project based on the editor machine's OS preference.

### 4.6 Typography, color, and composition remain content problems

Motion cannot compensate for unreadable copy, weak contrast, crowded framing,
or unclear visual priority. The existing copy budgets, contrast checks,
safe-area checks, grid snapping, and readability checks are therefore part of
motion quality, not unrelated validation.

No universal rule such as “one accent color” applies to every user project.
Sequences currently uses restrained color in its own application chrome and
lets project brand tokens control rendered content.

## 5. Product and workflow references

The following products are references for specific workflows. This section
does not rank them and does not claim feature parity.

### Jitter: browser-based design-to-motion workflow

Jitter documents browser-based motion authoring, Figma import, editable
imported layers, synchronized design changes, export, and batch export:

- [Jitter product overview](https://jitter.video/product/)
- [Jitter Figma import](https://jitter.video/figma-animation/)
- [Jitter batch export](https://jitter.video/changelog/2026-05-06-batch-export/)

Relevant lesson for Sequences:

- asset intake and iteration should feel like one workflow;
- replacing a design asset should not require rebuilding its motion treatment;
- export choices should be understandable without exposing encoder internals.

This does not establish that Sequences must implement a Figma integration
before validating its core editor workflow.

### Rive: interactive runtime animation

Rive's state machines connect animations with transition logic for interactive
use in products, apps, games, and websites:

- [Rive state-machine overview](https://rive.app/docs/editor/state-machine)
- [Rive runtimes](https://rive.app/docs/runtimes/cpp/getting-started)

Relevant lesson:

- authored animation and runtime behavior benefit from a stable intermediate
  representation;
- designer/developer iteration improves when shipped behavior does not need to
  be reimplemented manually.

Scope boundary:

- Sequences currently produces narrative video compositions, not interactive
  application state machines. Rive is an architectural reference, not a
  required export target.

### Lottie and dotLottie: lightweight runtime assets

Lottie is a JSON-based animation format commonly used for interface animation.
dotLottie packages Lottie animations and associated resources into a `.lottie`
file and has official cross-platform players:

- [What is Lottie?](https://lottiefiles.com/what-is-lottie)
- [dotLottie web player](https://developers.lottiefiles.com/docs/dotlottie-player/dotlottie-web/)
- [dotLottie format introduction](https://lottiefiles.com/blog/working-with-lottie-animations/introducing-dotlottie-open-source-file-format)

Relevant lesson:

- delivery formats should match the use case;
- a short interface animation and a complete product video do not need the same
  representation.

Hypothesis:

- selected Sequences scenes or primitives might eventually be eligible for a
  runtime-animation export lane.

That requires a compatibility study. It is not part of the current compiler.

### Creatomate: structured template automation

Creatomate documents template-based video/image automation where API or
spreadsheet modifications replace text, images, footage, colors, and other
template properties:

- [Creatomate documentation](https://creatomate.com/docs)
- [Automating a template](https://creatomate.com/docs/fundamentals/getting-started/automating-a-template)
- [Template modifications](https://creatomate.com/docs/fundamentals/getting-started/template-modifications)

Relevant lesson:

- named, validated replacement points support repeatable production;
- automation benefits from separating template structure from content values.

Sequences approaches this through archetypes, slots, assets, profiles, and
typed commands rather than Creatomate's template API.

### FFmpeg: delivery infrastructure

FFmpeg supports decoding, encoding, transcoding, muxing, demuxing, filtering,
streaming, and playback:

- [About FFmpeg](https://ffmpeg.org/about.html)

Sequences already uses FFmpeg behind its render abstraction. Users should
interact with product-level output presets, while implementation-specific
encoder controls remain available only where they solve a real delivery need.

## 6. What the reports imply for the UI rewrite

The strongest shared conclusion is not that Sequences needs more motion
features immediately. It is that the existing capabilities need a coherent
creative loop.

The current Phase 1.5 rewrite should prioritize:

1. **A dominant, trustworthy preview.**
   Users need to see the result of commands quickly and understand which scene
   or layer they are editing.

2. **Task-based preparation.**
   Brief, brand, media, references, and storyboard should feel like inputs to
   one project rather than unrelated feature pages.

3. **Direction selection before detailed editing.**
   Alternative plans should explain their structure, profile, pacing, and
   asset use. Real previews are preferable to text-only labels when practical.

4. **Progressive control.**
   Narrative and scene choices should precede token-level motion controls.
   Advanced controls should remain available without dominating the first-use
   experience.

5. **Contextual action placement.**
   Project actions, scene actions, selection actions, playback controls, and
   render actions should live near the state they affect.

6. **Inspectable agent changes.**
   Agent output should resolve to commands that can be reviewed, applied,
   rejected, undone, and explained.

7. **Accessible chrome.**
   Keyboard operation, visible focus, non-color state indicators, and
   reduced-motion behavior should be part of the shell design.

These are design requirements or hypotheses to test through prototypes. Exact
panel positions and navigation structure remain open in `UI_REWRITE_PLAN.md`.

## 7. Agent and skill architecture

### Current fact

Sequences currently has one external-agent skill:

- `skills/sequences/SKILL.md`

It describes an MCP workflow: obtain planning context, submit a constrained
plan, lint, preview, edit through commands, and render.

This is appropriate for the current tool surface because the MCP server is the
authoritative capability boundary.

### Recommended near-term approach

Improve the existing skill before splitting it:

- keep registry ids and slot budgets as hard constraints;
- use storyboard text when present;
- explain lint findings in design language without inventing new rules;
- recommend only commands and fields exposed by MCP planning context;
- distinguish deterministic fixes from subjective suggestions;
- keep preview and lint ahead of full rendering.

### When specialist skills would be justified

A separate skill is useful when it has:

- a distinct trigger;
- a real tool or command boundary;
- enough domain logic to avoid duplicating the main workflow;
- tests or evaluations for its recommendations.

Possible future examples include storyboard interpretation, audio retiming, or
visual criticism after those capabilities exist. Creating a folder for every
design concept before the supporting API exists would increase documentation
drift without adding product capability.

## 8. Research hypotheses worth testing

The following are explicitly unproven:

### H1. Constrained selection improves consistency

Compare plans generated from the registry catalog with plans generated through
less constrained motion instructions. Measure invalid outputs, manual motion
changes, lint findings, and blind preference.

### H2. Clearer hierarchy reduces manual correction

Create scene variants with different hero/support timing and motion volume.
Measure which variants users prefer and how often they change layer motion.

### H3. Storyboard semantics improve plan fidelity

Compare:

- brief only;
- brief plus current storyboard text;
- brief plus deterministic semantic encoding;
- brief plus semantic encoding and storyboard images.

Measure scene count, asset placement, direction agreement, and user correction.

### H4. Faster preview changes editing behavior

Measure command-to-preview latency alongside session length, number of
experiments, undo frequency, and completion rate. Do not assume lower latency
alone guarantees better output.

### H5. A workflow-led UI reduces visible complexity

Test the current seven-page shell against rewrite prototypes using first-project,
media replacement, scene retiming, motion replacement, lint repair, and render
tasks.

## 9. Research order

Before Phase 2:

1. Complete the UI task/control inventory.
2. Prototype the main project workflows.
3. Validate navigation, preview hierarchy, and contextual action placement.
4. Integrate the existing command system into the new shell.
5. Preserve and extend end-to-end UI verification.

After the UI gate:

1. Tune tokens, profiles, and archetype geometry using measured comparisons.
2. Add semantic storyboard encoding and continuity descriptions.
3. Improve video/audio editing and portable font handling.
4. Evaluate richer camera scripts and graph-based match transitions.
5. Build true incremental scene rendering from existing content hashes.
6. Evaluate visual criticism, audio retiming, and preference learning only with
   explicit acceptance metrics.

## 10. Claims deliberately not carried forward

The consolidated report does not claim:

- that animated product demos universally increase conversion;
- that a specific aesthetic is the dominant or correct SaaS style;
- that easing accounts for most professional quality;
- that a particular overlap percentage is professionally optimal;
- that one narrative sequence fits every product video;
- that Sequences occupies an uncontested market category;
- that any competitor pricing or plan structure will remain stable;
- that Lottie, dotLottie, Rive, WebGL, cloud rendering, or After Effects
  integration belongs in the near-term roadmap;
- that currently absent linter rules, commands, or runtime interfaces exist.

Those ideas may be researched later, but they are not facts.
