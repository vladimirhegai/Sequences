# Local development setup — Sequences for Slack

Use this guide for day-to-day development against your normal Slack workspace.
Use [DEPLOYMENT.md](DEPLOYMENT.md) once to install the separate sandbox app on
Railway, then use [TESTING.md](TESTING.md) for the repeatable test commands.

## The two-environment rule

Use two Slack apps created from the same [`manifest.json`](manifest.json):

| Environment | Slack app lives in | Process runs on | Credentials live in |
| --- | --- | --- | --- |
| Local development | normal development workspace | your computer | `apps/slack/.env` |
| Hackathon sandbox | Slack developer sandbox | Railway | Railway Variables |

Never run the local and Railway processes with the same `xoxb-...` and
`xapp-...` values. Two Socket Mode clients using one app make debugging
unnecessarily confusing.

## Prerequisites

- Node.js 22.18 or newer.
- Chrome or Edge for thumbnails.
- FFmpeg for MP4 output. Without it, the app intentionally degrades to
  thumbnails-only.
- A normal Slack workspace where you can create and install an internal app.
- Optional: Claude Code signed in locally for model-planned create/revise.
- Optional: ngrok or another HTTPS tunnel for testing per-user Slack MCP OAuth
  locally.

From the repository root:

```powershell
npm install
Copy-Item apps/slack/.env.example apps/slack/.env
```

`apps/slack/.env` is gitignored. Never put real credentials in an example file,
commit, issue, screenshot, or Slack message.

## Create the local development Slack app

1. Open <https://api.slack.com/apps>.
2. Select **Create New App → From a manifest**.
3. Select your normal development workspace.
4. Paste [`manifest.json`](manifest.json), review it, and create the app.
5. Under **Agents & AI Apps**, enable **Slack Model Context Protocol (MCP)
   Server**. This allows this app to consume Slack's hosted MCP server.
6. Under **Basic Information → App-Level Tokens**, create a token with
   `connections:write`. Copy its `xapp-...` value.
7. Under **OAuth & Permissions**, select **Install to Workspace**. Copy the
   **Bot User OAuth Token** (`xoxb-...`).
8. Put those two values in `apps/slack/.env` as `SLACK_APP_TOKEN` and
   `SLACK_BOT_TOKEN`.

The manifest enables Socket Mode, so do not configure an Events API request URL
or an interactivity request URL.

Whenever [`manifest.json`](manifest.json) changes, paste it into **App
Manifest**, save, reinstall the app, copy the current `xoxb-...` token back into
`.env`, and restart the local process.

## Fast local loop: no tunnel and no model bill

Only `SLACK_BOT_TOKEN` and `SLACK_APP_TOKEN` are required for the deterministic
demo:

```powershell
npm run dev --workspace @sequences/slack
```

In Slack:

1. Invite the bot to a test channel with `/invite @Sequences`.
2. Run `/sequences mcp-test`. Hosted MCP and the planning provider may show
   warnings when only the two Slack tokens are configured; the local engine and
   render-host checks should pass.
3. Run `/sequences demo`.

This is the recommended inner loop. It exercises Socket Mode, Block Kit,
Sequences MCP tools, thumbnails, MP4 rendering, uploads, and result controls
without calling OpenAI or Anthropic.

## Full local flow: hosted Slack MCP and model planning

The real `/sequences` modal uses a per-user Slack OAuth token. OAuth requires a
public HTTPS callback even though Slack events still arrive through Socket Mode.
If you do not need this during the day, test it on Railway in the sandbox
instead.

To test it locally:

1. Start a tunnel to the app's local HTTP port:

   ```powershell
   ngrok http 3000
   ```

2. Copy the HTTPS forwarding URL, for example
   `https://example.ngrok-free.app`.
3. In the local Slack app, open **OAuth & Permissions → Redirect URLs** and add:

   ```text
   https://example.ngrok-free.app/slack/oauth_redirect
   ```

4. Complete these values in `apps/slack/.env`:

   ```dotenv
   SLACK_CLIENT_ID=...
   SLACK_CLIENT_SECRET=...
   PUBLIC_BASE_URL=https://example.ngrok-free.app
   SLACK_REDIRECT_URI=https://example.ngrok-free.app/slack/oauth_redirect
   SLACK_STATE_SECRET=...
   SLACK_TOKEN_ENCRYPTION_KEY=...
   OPENAI_API_KEY=...
   ```

   Generate the two independent secrets in PowerShell:

   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```

5. For planning, use one of these local options:

   - Leave `SLACK_SEQUENCES_PROVIDER` unset and sign in to Claude Code locally.
     Launch `claude` once if authentication is not already established.
   - Or set `SLACK_SEQUENCES_PROVIDER=anthropic-api` and
     `ANTHROPIC_API_KEY=...`.

6. Restart `npm run dev --workspace @sequences/slack`.
7. Open `https://example.ngrok-free.app/slack/install` in your browser and
   approve access for your Slack user.
8. Run `/sequences` and submit the modal.

Free ngrok domains normally change when restarted. If the URL changes, update
`PUBLIC_BASE_URL`, `SLACK_REDIRECT_URI`, and the Slack Redirect URL before
retrying OAuth.

## What to try in Slack

- `/sequences demo` — curated, model-free end-to-end reel.
- `/sequences` — hosted-MCP context retrieval plus model-planned reel.
- `/sequences mcp-test` — configuration and dependency diagnostics.
- Message menu **🎬 Make a launch video** — build from a release thread.
- Reply in a reel thread — conversational revision.
- **Undo**, **Render HD**, and **Approve & share** — completed result flows.

The bot auto-joins public channels when possible. Private channels always need
`/invite @Sequences`.

## Next

- Exact test commands and expected results: [TESTING.md](TESTING.md)
- One-time sandbox and Railway installation: [DEPLOYMENT.md](DEPLOYMENT.md)
