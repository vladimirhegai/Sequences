# Testing — Sequences for Slack

This is the shared test playbook for humans and coding agents.

## Environments

- **Normal workspace:** run the bot locally with `apps/slack/.env`.
- **Developer sandbox:** run the separate sandbox app on Railway.
- Never start a local process with the sandbox's Railway `xoxb-...` and
  `xapp-...` tokens.
- Never run two bot processes for the same Slack app.

## Test ladder

Run the cheapest checks first. Stop when one fails.

### 1. Required source checks

From the repository root:

```powershell
npm run typecheck --workspace @sequences/slack
npm run test --workspace @sequences/slack
npm run mcp:demo --workspace @sequences/slack
```

Expected:

- TypeScript exits successfully.
- All Slack tests pass.
- The MCP demo lists tools, applies a plan, reports `lint: clean`, and writes
  scene thumbnails.

### 2. Local deterministic pipeline

```powershell
npm run demo --workspace @sequences/slack
```

This is model-free and does not require Slack tokens.

For the slower Chrome + FFmpeg MP4 gate:

```powershell
$env:VERIFY_RENDER = "1"
try {
  npm run demo --workspace @sequences/slack
} finally {
  Remove-Item Env:VERIFY_RENDER -ErrorAction SilentlyContinue
}
```

Run the MP4 gate before the first Railway deployment and after changes to
rendering, Chromium, FFmpeg, Docker, HyperFrames, or media handling. It does not
need to run after documentation-only changes.

### 3. Normal-workspace smoke test

Start the local bot:

```powershell
npm run dev --workspace @sequences/slack
```

In a normal-workspace test channel:

1. `/invite @Sequences`
2. `/sequences mcp-test`
3. `/sequences demo`
4. Confirm Thinking Steps update instead of posting a pile of messages.
5. Confirm storyboard thumbnails arrive before the MP4.
6. Confirm the MP4 plays inline.
7. Click **Render HD** and confirm an HD replacement uploads.
8. Click **Approve & share** and share into a disposable test channel.
9. Reply in the reel thread with `make it shorter`.
10. Click **Undo** and confirm the previous revision returns.

If full local OAuth is configured as described in [SETUP.md](SETUP.md), also:

1. Open `https://YOUR-CURRENT-TUNNEL/slack/install` in a browser and approve.
2. Run `/sequences` and submit a small real brief.
3. Confirm the result contains both a **Slack context (hosted MCP)** receipt and
   a Sequences MCP build trace.
4. Try **🎬 Make a launch video** from a short release thread.

### 4. Pre-push gate

At minimum:

```powershell
git status --short
npm run typecheck --workspace @sequences/slack
npm run test --workspace @sequences/slack
npm run mcp:demo --workspace @sequences/slack
```

Inspect `git status` before committing so generated `.data` files, credentials,
or unrelated work are not included.

### 5. End-of-day sandbox gate

After committing and pushing to Railway's configured GitHub branch:

```powershell
$baseUrl = "https://YOUR-SERVICE.up.railway.app"
Invoke-WebRequest "$baseUrl/healthz" | Select-Object StatusCode, Content
```

Optional Railway CLI checks:

```powershell
railway status
railway deployment list --limit 5
railway logs
```

In the sandbox:

1. Confirm `/sequences mcp-test` has no unexpected failures.
2. Run `/sequences demo`.
3. Open `$baseUrl/slack/install` if this user has not authorized hosted MCP.
4. Run one real `/sequences` request using a short, synthetic brief.
5. Confirm hosted-MCP and Sequences-MCP receipts.
6. Run one deterministic thread revision.
7. Test **Render HD** only when render-related code changed.
8. Test **Approve & share** into a sandbox test channel.
9. Test the message shortcut when thread-ingestion code changed.
10. Check Railway logs and usage after the run.

Do not use confidential workplace content for sandbox tests. Slack context is
retrieved through OpenAI and the selected evidence is then supplied to the
planning provider.

## Change-specific checks

- Slack scopes, events, commands, or shortcuts changed:
  update the Slack App Manifest, reinstall, copy the bot token, and restart or
  redeploy.
- Environment variables or OAuth changed:
  test `/slack/install`, then `/sequences mcp-test`, then a real create.
- MCP client/server or project mutation changed:
  run `mcp:demo`, tests, a create, a revision, and Undo.
- Rendering or Docker changed:
  run the MP4 gate, build the Docker image, then test draft and HD on Railway.
- Block Kit or delivery changed:
  test create, progress updates, thumbnails-first delivery, failure display, and
  final controls in Slack.
- Documentation-only change:
  typecheck/tests are optional unless commands, manifests, or variable names
  changed; verify every documented command and cross-link.

## Fast troubleshooting

- `not_in_channel`: `/invite @Sequences`; public channels may auto-join, private
  channels cannot.
- `missing_scope`: update the manifest in Slack, reinstall, copy the current bot
  token, and restart/redeploy.
- Asked to connect Sequences: open `/slack/install` on the currently running
  local tunnel or Railway domain.
- `/healthz` says `starting`: inspect the `xapp-...` and `xoxb-...` pair and
  Railway logs.
- Planning brain fails on Railway: verify either `openai-api` plus
  `OPENAI_API_KEY`/`SEQUENCES_OPENAI_MODEL`, or `anthropic-api` plus
  `ANTHROPIC_API_KEY`.
- Hosted MCP fails: verify MCP is enabled in **Agents & AI Apps**, user scopes,
  `OPENAI_API_KEY`, the redirect URL, and per-user authorization.
- Thumbnails work but MP4 does not: inspect Chrome/Chromium and FFmpeg checks in
  `/sequences mcp-test` and the Railway memory limit.
- Changes appear twice or behave inconsistently: stop the duplicate process
  using the same Slack app tokens.
