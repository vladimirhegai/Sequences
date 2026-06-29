# Sandbox-first setup — Sequences for Slack

The project uses one Slack developer sandbox and one Railway deployment for all
live Slack development. There is no separate normal-workspace app.

- Edit and run source tests locally.
- Commit and push the sandbox branch.
- Upload that clean committed tree to Railway.
- Exercise Slack commands only in the developer sandbox.

This avoids two Socket Mode processes, duplicate Slack apps, drifting manifests,
and testing against workplace data.

## Local prerequisites

- Node.js 22.18 or newer.
- npm and the committed `package-lock.json`.
- Docker Desktop for production-image checks.
- Railway CLI 5.x, logged into the account that owns the project.
- Chrome/Edge and FFmpeg only if running local render checks.

From the repository root:

```powershell
npm ci
npm install --global @railway/cli
railway login
railway link
railway status
```

Select the existing **Sequences Slack Hackathon** project, `production`
environment, and `sequences-slack` service when linking.

Do not copy sandbox Slack or model credentials into `apps/slack/.env`. The live
credentials belong only in Railway Variables. Do not run
`npm run dev --workspace @sequences/slack` with the sandbox `xoxb-...` and
`xapp-...` tokens: Railway already owns that Socket Mode connection.

## Local source loop

Use this gate while editing:

```powershell
npm run typecheck --workspace @sequences/slack
npm run test --workspace @sequences/slack
npm run mcp:demo --workspace @sequences/slack
```

For engine, rendering, Docker, Chromium, FFmpeg, or media changes:

```powershell
$env:VERIFY_RENDER = "1"
try {
  npm run demo --workspace @sequences/slack
} finally {
  Remove-Item Env:VERIFY_RENDER -ErrorAction SilentlyContinue
}

docker build -t sequences-slack .
```

The deterministic demo and MCP smoke do not call a paid model. See
[TESTING.md](TESTING.md) for the full pre-push and sandbox gates.

## Live sandbox loop

After the local gate:

1. Review `git status --short`; do not commit credentials or generated `.data`.
2. Commit the intended files and push the configured Railway branch.
3. Follow [RAILWAY_RUNBOOK.md](RAILWAY_RUNBOOK.md) to confirm or trigger the
   deployment.
4. Wait for `/healthz` to return HTTP `200` with `ready`.
5. In the sandbox, run `/sequences mcp-test`.
6. Exercise the change-specific Slack flow.
7. Inspect Railway logs and usage.

The current domain is:

```text
https://sequences-slack-production.up.railway.app
```

## When Slack configuration changes

Editing [`manifest.json`](manifest.json) does not update the installed app.
When scopes, events, shortcuts, commands, or app features change:

1. Open the sandbox app at <https://api.slack.com/apps>.
2. Paste the current manifest into **App Manifest** and save.
3. Reinstall the app to the sandbox.
4. If Slack issued a new bot token, update `SLACK_BOT_TOKEN` in Railway.
5. Redeploy the current code.
6. Run `/sequences mcp-test`, `/sequences demo`, and the affected flow.

The OAuth redirect must remain:

```text
https://sequences-slack-production.up.railway.app/slack/oauth_redirect
```

Each human testing hosted Slack MCP authorizes once at:

```text
https://sequences-slack-production.up.railway.app/slack/install
```

## Never do these

- Never put live secrets in source, example env files, logs, screenshots, issues,
  or agent prompts.
- Never start a second process with the Railway Slack tokens.
- Never use workplace-confidential data in sandbox tests.
- Never assume a successful Railway build means GitHub Actions passed, or vice
  versa; they are separate systems.
- Never use `railway redeploy` to publish new source. Plain redeploy restarts
  old source, and `--from-source` currently selects the wrong default branch.
  Use the clean-tree `railway up` sequence in the Railway runbook.

## Related guides

- One-time infrastructure and Slack installation: [DEPLOYMENT.md](DEPLOYMENT.md)
- Daily Railway operations: [RAILWAY_RUNBOOK.md](RAILWAY_RUNBOOK.md)
- Verification ladder: [TESTING.md](TESTING.md)
