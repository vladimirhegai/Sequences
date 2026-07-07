# Recipe Studio — handoff prompt for the follow-up agent

Copy everything below the line into the next agent's prompt.

---

Your job is to COMPLETE the Recipe Studio on top of a foundation another agent
already built, then write a full report of what you did. Read, in this order:

1. `docs/RECIPE_STUDIO_PLAN.md` — the product plan (v2). The vision: an
   operator runs one terminal command, a browser opens, they build a recipe
   animation on a canvas (direct manipulation first, chat second), click
   Export, and the live Slack Sequences agents can and WILL use it.
2. `apps/slack/RECIPE_STUDIO_REPORT.md` — what is already built (session 1's
   report). Its §3 "What is NOT built" is your scope; do not rebuild §1.
3. `apps/slack/studio/INTEGRATION.md` — the seam table you MUST keep true.
4. `apps/slack/CLAUDE.md` — the app's rules (isolation, Sentinel, publish ≠
   deploy, prep-mode flag). `apps/slack/SENTINEL.md` before touching any gate.

Already built and proven (do not re-implement; extend): the RecipeV2 format +
Level-1 host instantiation (`src/engine/recipeContract.ts`, the sixth
host-owned contract — strip-and-reinject, typed param slots, version fences);
retrieval + storyboard schema + Sentinel L2 reconciliation + cache-key wiring
in `compositionRunner.ts`/`skillContext.ts`; the studio server, workspace
store, production-parity gate, and RecipeV2 export with retrieval sanity
checks (`apps/slack/studio/`); the golden `last-word-roulette` recipe exported
through the real gate (`npm run studio:golden`); `test/recipeContract.test.ts`.

Your milestones, in order (each independently shippable; commit + run the
slack verification gate after each):

1. **Paid live-create proof (do this FIRST).** Run ONE paid
   `npm run sequence:check --workspace @sequences/slack -- "<brief>"` with a
   brief that names the roulette pattern (e.g. "hook where the headline
   cycles through words and lands on 'shipped'"). Verify with your own eyes:
   the planner declared `recipes:[{id:"last-word-roulette",…}]` in
   `planning/`, the host injected the fragment (search the shipped
   `composition/index.html` for `data-sequences-recipe`), the gate passed,
   and the thumbnails show the wheel. If the planner does NOT declare it,
   tune the retrieval section / response-contract teaching (never loosen a
   gate) and re-run. Record the exact outcome honestly in your report.
2. **Canvas editor (plan §2, §4 — M1/M2).** World view over the existing
   `data-camera-world`/`data-region` model in `studio/ui/`: place catalog
   components (render live from `COMPONENT_CATALOG` — never fork markup),
   drag/retime on a timeline strip, typed camera transitions with the ease
   picker, holds/timeRamp placement. Extend `studio/scaffold.ts` so
   `workspace.json` canvas state compiles deterministically into the demo
   composition (keep reusing `applyDeterministicSourceRepairs` — never
   re-implement injection). Add per-kind `clickAnchor` metadata to
   `COMPONENT_CATALOG` (additive) + cursor-path editing with anchor snapping.
3. **Agents (plan §6 — M3).** Provider abstraction in `studio/agents/`:
   OpenRouter (GLM plan/critique, DeepSeek author/patch via the existing
   `compositionRunner` primitives and `modelPolicy.ts` — never fork prompts)
   AND Claude Code as a headless CLI agent (`claude -p … --output-format
   stream-json --permission-mode acceptEdits`, cwd = the workspace,
   `--resume` per workspace) with a generated `AGENT.md`, file-watch →
   debounce → re-gate → findings pushed to the chat feed. Image + ordered
   storyboard-frame attachments per §6.4 (files under `refs/`, never copied
   into exports).
4. **Export describe pass (plan §7.5 step 2).** A light-model call drafts
   recipe.md / triggerPatterns / tags / title / param descriptions from the
   workspace + chat history; operator reviews in the export wizard (the
   mechanics + sanity check already exist).
5. **Library curation (plan §5.6 — as time allows).** Build and export 3–5
   more recipes from the backlog (iris-fill CTA close, cursor demo
   click-through, KPI counter flythrough, notification stack cascade),
   each gated green and eyeballed.

Hard rules: every studio output passes the existing deterministic gate (no
laxer referee); reuse engine injection helpers (time-wrap stays LAST);
`.data/studio/` stays the mutable root (job dirs immutable); no new heavy
deps; secrets stay in gitignored `.env`; the studio never runs on Railway;
gates are never loosened — new obligations go to the lowest Sentinel layer
that can own them and every new finding class must be registered in
`src/engine/sentinel.ts` (the closed-world test enforces this); update
`studio/INTEGRATION.md` for every seam you touch; nothing may destabilize the
live bot before the Jul 13 hackathon deadline — the recipe path must stay
degrade-never-veto with `SLACK_SEQUENCES_RECIPES=0` as the kill switch.

Verification: `npm run typecheck/test --workspace @sequences/slack`, `npm run
film:demo`, `npm run studio:golden`, and `npm run sequence:check -- --demo
--no-mcp` must all stay green; inspect every recipe's thumbnails with your
own eyes (reports have said "pass" on films the operator called a mess).

When done: commit locally, publish with `bash scripts/publish-public.sh
"<message>"` (that pushes the standalone `vladimirhegai/Slack_Sequences` repo;
it archives HEAD, so commit first; publishing does NOT deploy — do not run
`railway up`). Then write `apps/slack/RECIPE_STUDIO_REPORT_2.md`: everything
you did, every file you touched, every decision you made and why, every
verification layer you actually ran, and everything you left undone — the
operator will audit both reports against the code.
