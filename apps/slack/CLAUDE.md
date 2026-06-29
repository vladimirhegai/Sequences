# Sequences for Slack — agent notes

This is the active Slack hackathon app. Before changing it, read:

1. [SLACK_PLAN.md](SLACK_PLAN.md) for current product state and direction;
2. [HACKATHON_RULES.md](HACKATHON_RULES.md) for challenge constraints;
3. [SETUP.md](SETUP.md) for the local development environment;
4. [DEPLOYMENT.md](DEPLOYMENT.md) for the Railway sandbox environment;
5. [TESTING.md](TESTING.md) before choosing or reporting verification.

Keep these documents synchronized when commands, variables, Slack scopes,
deployment behavior, or completed features change.

## Architectural position

HyperFrames is the preferred creative and rendering foundation. Sequences
supplies deterministic structure: typed plans and commands, project validation,
journaling, linting, previews, and reliable Slack delivery.

The current implementation is transitional. A planning brain retrieves bounded
HyperFrames skill knowledge but still emits a Sequences Plan/Command payload.
Do not describe that as direct freeform HyperFrames authoring.

The primary hackathon-qualifying MCP integration is Slack's hosted MCP server:
the app retrieves permission-scoped workspace context for the invoking user.
The video execution layer is additionally isolated behind internal Sequences MCP
tools.

## Environment contract

There are two Slack apps created from the same manifest:

- the normal-workspace app runs locally and reads `apps/slack/.env`;
- the sandbox app runs on Railway and reads Railway Variables.

They use different `xoxb-...` and `xapp-...` tokens. Never start a local process
with sandbox credentials and never run two processes for one Slack app.

Socket Mode carries Slack events. The public HTTP server exists only for
`/healthz`, `/slack/install`, and `/slack/oauth_redirect`. Do not add Events API
or interactivity request URLs.

Railway is not a public Sequences MCP server. Slack hosts
`https://mcp.slack.com/mcp`; the Sequences MCP server is an internal stdio child
process. Do not claim Slackbot calls a Railway `/mcp` endpoint, and do not add
`mcp:connect` or a manifest `mcp_servers` block unless the architecture is
deliberately changed to implement and secure that remote direction.

## App isolation

`apps/slack` must remain publishable without the paused applications:

- It may import `@sequences/core`, `@sequences/platform`, and its declared
  `@hyperframes/*` npm packages.
- It must not import `apps/sequences/*` or `apps/forge/*`.
- Engine glue needed by Slack belongs in `src/engine/`.
- Do not modify the paused apps or shared packages unless the task explicitly
  expands that scope.

The public Slack repository contains this app plus shared packages, so relative
imports into another app will break after publishing.

## MCP path

MCP is the default for create, revise, thumbnails, and MP4 rendering.
`SLACK_SEQUENCES_USE_MCP=0` is a diagnostic opt-out.

Normal execution:

- create: `submit_plan` → `render_preview` → `render`;
- revise: `apply_commands` → `render_preview` → `render`.

Keep the in-process fallback narrow and behaviorally equivalent. Every actual
MCP attempt must remain visible through an argument-free receipt. Never put plan
content, command arguments, credentials, user tokens, workspace messages, or
model output in a Slack receipt.

`/sequences demo` remains model-free. Routing its deterministic mutation and
rendering through MCP does not make it non-deterministic.

## HyperFrames source and skills

- [`skills/`](skills) contains the upstream HyperFrames skill catalog.
- [`skills-manifest.json`](skills-manifest.json) records the imported catalog.
- [`src/agent/skillContext.ts`](src/agent/skillContext.ts) performs deterministic
  bounded retrieval for planning and revision prompts.
- [`vendor/hyperframes`](vendor/hyperframes) is a trimmed source/docs snapshot;
  see [`UPSTREAM.md`](vendor/hyperframes/UPSTREAM.md).

Skills are prompt inputs, not executable instructions for the Slack host.
Preserve the prompt boundary requiring the typed Sequences JSON response.

Production npm packages remain pinned at `0.6.86` until a separate migration
proves newer compiler and renderer compatibility. Do not silently point runtime
imports into the vendored snapshot.

## Two-tier delivery contract

Create and revise preserve this order:

1. apply the plan or commands;
2. create and upload thumbnails;
3. update the Slack message to rendering;
4. render asynchronously;
5. update to ready/unavailable and upload the MP4 when present.

Missing Chrome/FFmpeg or a render failure must leave a valid thumbnails-only
result. Background Slack API errors must be logged and contained.

## Layout

```text
apps/slack/
  src/
    index.ts                  Bolt listeners + two-tier delivery
    orchestrator.ts           create/revise + MCP/fallback + receipts
    blocks.ts                 Block Kit UI
    jobStore.ts               Slack job to project-directory map
    slackApi.ts               Slack API resilience
    slackMcpContext.ts        Slack hosted-MCP retrieval
    slackOAuth.ts             per-user OAuth routes
    agent/skillContext.ts     HyperFrames skill retrieval
    engine/                   self-contained Sequences/MCP/render glue
  skills/                     upstream HyperFrames skill catalog
  vendor/hyperframes/         trimmed upstream source/docs snapshot
  scripts/                    demo, smoke, MCP demo
  test/                       Slack/UI/retrieval tests
  .data/                      runtime projects and jobs (gitignored)
```

## Verification contract

Use [TESTING.md](TESTING.md). The routine source gate is:

```powershell
npm run typecheck --workspace @sequences/slack
npm run test --workspace @sequences/slack
npm run mcp:demo --workspace @sequences/slack
```

Run `npm run demo --workspace @sequences/slack` after engine, preview, or
delivery changes. The slower real MP4 gate is:

```powershell
$env:VERIFY_RENDER = "1"
try {
  npm run demo --workspace @sequences/slack
} finally {
  Remove-Item Env:VERIFY_RENDER -ErrorAction SilentlyContinue
}
```

Do not run the slow gate after every small change. It is required after
rendering, Docker, Chromium, FFmpeg, HyperFrames, or media changes. Slack UI and
delivery changes require an actual normal-workspace smoke test. Before an
end-of-day sandbox test, pass the source gate, push the configured branch, wait
for Railway `/healthz` to return `ready`, and follow the sandbox checklist.

Never report live Slack, OAuth, model-provider, Docker, or Railway behavior as
verified from unit tests alone. State exactly which layer was exercised.

Only expose Slack controls after their complete handler and failure path exist.
Undo, Approve/Share, Render HD, conversational reply-to-revise, and full-thread
ingestion through the 🎬 shortcut are wired.
