# Sandbox deployment — Sequences for Slack

Use this guide once to install the hackathon sandbox app on Railway. The project
uses the developer sandbox for all live Slack development and judging; there is
no separate normal-workspace app. Source checks still run locally.

For routine updates, use [RAILWAY_RUNBOOK.md](RAILWAY_RUNBOOK.md). For the
verification ladder, use [TESTING.md](TESTING.md).

## What Railway is hosting

Railway hosts:

- the Bolt app and its outbound Socket Mode connection;
- `/healthz`, `/slack/install`, and `/slack/oauth_redirect`;
- the internal stdio Sequences MCP process;
- Chromium and FFmpeg rendering;
- the persistent `/data` volume.

Slack—not Railway—hosts `https://mcp.slack.com/mcp`. The app calls that hosted
server through the OpenAI Responses API using the invoking user's Slack OAuth
token.

This deployment does **not** publish a `/mcp` HTTP endpoint for Slackbot. Do not
configure **Features → MCP Servers** or add `mcp:connect`; that is the opposite
integration direction.

## Before starting

Prepare:

- A Slack developer sandbox and a new Slack app for this hackathon project.
- A Railway **Hobby or higher** account. Free and Trial do not provide enough
  memory for Chromium rendering.
- A dedicated OpenAI project key for Slack hosted-MCP retrieval.
- A planning provider: either reuse the dedicated OpenAI project temporarily,
  or provide a dedicated Anthropic workspace key.
- The repository pushed to GitHub.

Use dedicated hackathon API projects/workspaces, low spend/rate limits, and
usage alerts. The keys stay on the server, but every request made by a Slack user
is billed to your accounts.

## 1. Create the sandbox Slack app

1. Open <https://api.slack.com/apps>.
2. Select **Create New App → From a manifest**.
3. Select the Slack developer sandbox.
4. Paste [`manifest.json`](manifest.json) and create the app.
5. Under **Agents & AI Apps**, enable **Slack Model Context Protocol (MCP)
   Server**.
6. Under **Basic Information → App-Level Tokens**, create a token with
   `connections:write`. Save the `xapp-...` value as `SLACK_APP_TOKEN`.
7. Under **OAuth & Permissions**, select **Install to Workspace**. Save the
   `xoxb-...` bot token as `SLACK_BOT_TOKEN`.
8. On **Basic Information**, save the app's Client ID and Client Secret as
   `SLACK_CLIENT_ID` and `SLACK_CLIENT_SECRET`.

Do not reuse the local development app's tokens.

## 2. Create the Railway service

1. In Railway, select **New Project → Deploy from GitHub repo** and choose this
   repository.
2. Keep the service root directory `/`.
3. Do not add build or start commands. Root [`railway.json`](../../railway.json)
   selects the Dockerfile, `/healthz`, one replica, and the restart policy.
4. Generate a public domain under **Settings → Networking**. Save the full HTTPS
   URL without a trailing slash as `PUBLIC_BASE_URL`.

The first deployment may fail before credentials are present. Finish the
configuration and deploy again. Failed attempts remain in Railway history; judge
the service by the newest intended deployment, not the historical failure count.

## 3. Add the persistent volume and resource limits

1. Add a Railway volume mounted exactly at `/data`.
2. Keep exactly one replica. Jobs, tokens, and the job map are file-backed.
3. Under **Deploy → Replica Limits**, start with a 4 GB memory cap. A 2 GB cap
   can work for draft rendering, but 4 GB is safer for 1080p Chromium.
4. Set a Railway compute usage alert and a hard limit you are comfortable with.
5. Leave Serverless/App Sleeping disabled for predictable judging and Socket
   Mode availability.

The volume stores encrypted Slack user tokens, projects, thumbnails, and MP4s.
It is not self-cleaning; monitor its usage during the hackathon.
The Dockerfile only creates the `/data` mount point; do not add a Docker
`VOLUME` instruction because Railway volumes are configured on the service.

## 4. Add Railway variables

Generate two different 32-byte values:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

The first can be `SLACK_STATE_SECRET`; the second must be
`SLACK_TOKEN_ENCRYPTION_KEY`.

Open **Variables → Raw Editor**, paste
[`.env.railway.example`](.env.railway.example), and fill every uncommented
value:

```dotenv
SLACK_BOT_TOKEN=xoxb-...
SLACK_APP_TOKEN=xapp-...
SLACK_CLIENT_ID=...
SLACK_CLIENT_SECRET=...
PUBLIC_BASE_URL=https://YOUR-SERVICE.up.railway.app
SLACK_REDIRECT_URI=https://YOUR-SERVICE.up.railway.app/slack/oauth_redirect
SLACK_STATE_SECRET=...
SLACK_TOKEN_ENCRYPTION_KEY=...
OPENAI_API_KEY=sk-...
```

Choose one planning-provider configuration:

```dotenv
# OpenAI planning — works immediately with the same project key
SLACK_SEQUENCES_PROVIDER=openai-api
SEQUENCES_OPENAI_MODEL=gpt-5-mini
```

or:

```dotenv
# Anthropic planning
SLACK_SEQUENCES_PROVIDER=anthropic-api
ANTHROPIC_API_KEY=sk-ant-...
```

The current Railway deployment can start with OpenAI planning and switch to
Anthropic later by replacing those provider variables.

Do not add:

- `PORT` — Railway injects it.
- `SLACK_SIGNING_SECRET` — current Slack traffic uses Socket Mode.
- `NODE_ENV`, `HOST`, `SLACK_SEQUENCES_DATA_DIR`,
  `PUPPETEER_EXECUTABLE_PATH`, or `PRODUCER_LOW_MEMORY_MODE` — the Dockerfile
  supplies them.

`RAILWAY_DOCKERFILE_PATH=Dockerfile` may be set explicitly as a harmless
fallback if Railway does not pick up the checked-in `railway.json`.

After the deployment works, seal the Slack tokens, client secret, state secret,
token-encryption key, and model API keys in Railway. Sealed variables cannot be
read back, so keep recovery copies in your password manager.

## 5. Finish Slack OAuth configuration

1. In the sandbox Slack app, open **OAuth & Permissions → Redirect URLs**.
2. Add the exact `SLACK_REDIRECT_URI` from Railway and select **Save URLs**.
3. Open **App Manifest**, paste the current [`manifest.json`](manifest.json),
   and save.
4. Select **Reinstall to Workspace** and approve the requested bot and user
   scopes.
5. Copy the current `xoxb-...` token into Railway again.
6. Redeploy the Railway service.

Editing a local manifest file never changes the Slack app automatically. Repeat
the manifest-save, reinstall, token-copy, and redeploy sequence whenever scopes
or Slack features change.

## 6. Connect each sandbox user to Slack hosted MCP

Every person who runs the real `/sequences` flow must authorize their own Slack
user token:

```text
https://YOUR-SERVICE.up.railway.app/slack/install
```

Open that URL while signed into the sandbox and approve it once. The callback
stores the user token encrypted on `/data`; do not copy user tokens manually.

`/sequences demo` does not need this authorization. `/sequences` and the real
message-shortcut flow do.

When judges are invited later, give them the same install link in a clear
testing-instructions channel. Invite `slackhack@salesforce.com` and
`testing@devpost.com` as sandbox **Members**, not restricted guests.

## 7. Deploy and verify

Railway services connected to GitHub normally deploy whenever you push to the
configured branch. Confirm the service watches
`slack/workflow-undo-approve-thread`; do not infer the branch merely from the
repository name. Watch for:

```text
HTTP server listening
⚡ Sequences for Slack is running (Socket Mode)
```

Check readiness from PowerShell:

```powershell
$baseUrl = "https://YOUR-SERVICE.up.railway.app"
Invoke-WebRequest "$baseUrl/healthz" | Select-Object StatusCode, Content
```

Expected result: HTTP `200` and `ready`. HTTP `503` with `starting` means the
HTTP process is alive but the Slack socket has not connected—usually an invalid
or mismatched sandbox token.

Then follow the sandbox checklist in [TESTING.md](TESTING.md).

## Railway CLI

The dashboard is sufficient. If you prefer the CLI:

```powershell
npm install --global @railway/cli
railway login
railway link
railway status
railway deployment list --limit 5
railway logs
```

Pushing the configured branch is preferred when GitHub autodeploy works. If a
push does not create a deployment, use the
`railway redeploy --from-source` fallback in
[RAILWAY_RUNBOOK.md](RAILWAY_RUNBOOK.md). Plain `railway redeploy` only reruns
previously deployed source.

## Docker check before the first deployment

With Docker Desktop running:

```powershell
docker build -t sequences-slack .
docker run --rm sequences-slack `
  npm run mcp:demo -w @sequences/slack
```

This checks the production image without copying sandbox secrets locally. The
image uses `/usr/local/bin/chromium-no-sandbox`, which wraps system Chromium
with the flags required inside this root-run container.

## Official references

- [Slack hosted MCP overview](https://docs.slack.dev/ai/slack-mcp-server/)
- [Slack hosted MCP sample-app setup](https://docs.slack.dev/ai/slack-mcp-server/developing/)
- [Slack Bolt Socket Mode](https://docs.slack.dev/tools/bolt-js/concepts/socket-mode/)
- [Railway Dockerfiles](https://docs.railway.com/builds/dockerfiles)
- [Railway volumes](https://docs.railway.com/volumes)
- [Railway health checks](https://docs.railway.com/deployments/healthchecks)
- [Railway variables and sealed secrets](https://docs.railway.com/variables)
- [Railway plans and resource limits](https://docs.railway.com/pricing/plans)
- [Railway cost controls](https://docs.railway.com/pricing/cost-control)
