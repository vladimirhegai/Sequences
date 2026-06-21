# Sequences UI Rewrite Plan

Status: **current product priority**

The deterministic Phase 1 foundation is complete enough to support a serious
editor. Before moving into Phase 2 features, Sequences will replace the current
Studio interface with a workflow-led design. The purpose is not cosmetic
polish. It is to discover the right information architecture, interaction
model, and button placement while the product surface is still tractable.

## Why the rewrite comes first

The current Studio proves that the engine can be operated through a visual
application, but it accumulated page shells and controls while the underlying
capabilities were still changing. That makes it a useful functional prototype,
not a settled product interface.

Phase 2 would add decomposition, richer camera systems, visual criticism,
audio retiming, taste learning, and more advanced rendering behavior. Adding
those before establishing the UI hierarchy would multiply controls without
answering the basic questions:

- What is the user's primary task at each moment?
- Which actions deserve persistent placement?
- Which controls belong near the preview, timeline, selection, or agent?
- What should be visible by default, and what should be progressively exposed?
- How does a first-time founder work differently from an experienced motion
  designer?

## Product loop to design around

The new UI should make this loop legible:

1. **Start** — create or open a project and define the output goal.
2. **Prepare** — collect brand, media, references, and storyboard intent.
3. **Plan** — produce and compare a small number of agent-generated directions.
4. **Build** — materialize scenes and arrange the narrative.
5. **Refine** — edit copy, layout, motion, timing, camera, and brand choices.
6. **Check** — lint, preview, compare, and inspect proposed changes.
7. **Deliver** — render, review, and export.

This loop matters more than preserving the existing seven-page navigation.
Pages may merge, split, or become modes if testing shows a clearer structure.

## Durable constraints

The rewrite may replace the entire frontend, but it must preserve:

- `Project` as the canonical render state;
- typed commands for every canonical mutation;
- validation before state acceptance;
- exact undo/redo semantics;
- inspectable agent changes;
- one-way compilation;
- token and registry constraints;
- local-first operation;
- deterministic preview and render behavior.

`storyboard.json` and `design.json` remain intent/scratch sidecars unless their
contracts are deliberately redesigned.

## Layout hypothesis

The current four-region editor remains a strong starting hypothesis:

```text
agent / project context | preview and canvas | selection inspector
---------------------------------------------------------------
story / scenes / timeline
```

It is no longer treated as an untouchable final answer. The rewrite should test
whether the agent is best as a permanent left rail, a contextual panel, or a
command surface that expands only when needed. The preview should remain the
largest and most visually stable region.

## Button-placement rules

Button placement should be derived from behavior, not visual symmetry.

- Put the current task's primary action in a stable, predictable location.
- Keep selection-specific actions beside the selected object or its inspector.
- Keep playback and frame navigation attached to the preview/timeline.
- Keep scene-level actions in the story/timeline region.
- Keep project-wide actions in project navigation or the top application bar.
- Keep destructive actions visually quiet until the user enters their context.
- Avoid duplicate controls unless one is a deliberate shortcut.
- Expose advanced controls only after the basic choice is made.
- Make agent proposals explicit records with apply, inspect, reject, and revert.

No viewport should contain multiple competing primary actions.

## Proposed screen model

The rewrite should prototype these surfaces before implementation:

1. **Home and project setup**
   - Recent projects
   - New project goal, format, duration, and brand intake
   - Clear route into the demo

2. **Creative brief and preparation**
   - Brief, assets, references, brand, and storyboard in one preparation flow
   - Readiness indicators rather than disconnected page shells

3. **Direction selection**
   - Two or three meaningful alternatives
   - Real scene previews, rationale, profile, pacing, and asset usage
   - One decisive selection action

4. **Editor**
   - Dominant preview
   - Story/scene strip and detailed timeline as progressive levels
   - Contextual inspector
   - Agent command history and proposal review

5. **Render and review**
   - Quality/preset choices
   - Lint and readiness summary
   - Render history and output comparison

Extensions should appear where vocabulary is chosen or managed, not
necessarily as a full-time creative workspace.

## Rewrite sequence

### 1. Inventory and task map

Catalog every current control, command, endpoint, state, empty state, and
failure state. Map each to the product loop and identify duplication.

### 2. Low-fidelity workflows

Create wireframes for:

- first project;
- agent-generated first cut;
- manual scene edit;
- media replacement;
- timing adjustment;
- lint repair;
- render and export.

Resolve navigation and button placement here, before styling.

### 3. Interactive shell prototype

Build the new shell against mocked data or read-only project state. Test panel
behavior, selection, keyboard flow, resizing, and responsive collapse without
yet rebuilding every editor control.

### 4. Command integration

Reconnect mutations through the existing command API. Do not create a second
state model in the UI. Add adapters/selectors if the frontend framework needs
them.

### 5. Feature migration

Move capabilities by workflow importance:

1. project open/create;
2. preview and transport;
3. scenes and timeline;
4. inspector edits;
5. agent planning and proposals;
6. media and storyboard;
7. lint and render;
8. design and extension management.

### 6. Validation

Retain the existing engine tests and add UI coverage for complete user journeys.
Measure:

- time to first usable preview;
- command-to-preview latency;
- number of controls visible at first load;
- time to replace media, retime a scene, and change a motion;
- manual override rate after agent planning;
- render completion and recovery behavior.

## Phase 2 gate

Phase 2 resumes when the rewritten interface can comfortably absorb new
capabilities. At minimum:

- the primary workflow is understandable without documentation;
- every current capability has an intentional home;
- button placement follows task context;
- preview and editing latency feel immediate;
- agent changes are easy to inspect and reverse;
- the editor works for both guided and manual use;
- automated user-journey coverage protects the new shell.

The UI rewrite should clarify the product, not merely reskin it.
