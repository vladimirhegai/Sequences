# Railway runbook — Sequences Slack sandbox

This is the operational guide for humans and coding agents updating the live
hackathon sandbox. Read [DEPLOYMENT.md](DEPLOYMENT.md) for first-time creation;
use this file for every later deployment.

## Current production identity

| Setting | Value |
| --- | --- |
| Railway project | `Sequences Slack Hackathon` |
| Project ID | `89e9d2b7-5b63-4b09-8799-ccae5b2c707e` |
| Environment | `production` |
| Environment ID | `48c3d11b-1807-42d0-85a3-1e6c67ab9c3c` |
| Service | `sequences-slack` |
| Service ID | `ce64ff82-0f2a-4193-b138-c62cc8784d8a` |
| GitHub repository | `vladimirhegai/Sequences` |
| Deployment branch | `slack/workflow-undo-approve-thread` |
| Public domain | `https://sequences-slack-production.up.railway.app` |
| Persistent mount | `/data`, one volume, one replica |

IDs are not credentials, but confirm them with `railway status` before changing
infrastructure. Never print Railway variables or authentication tokens.

## Deployment contract

The service root is the repository root. Root [`Dockerfile`](../../Dockerfile)
installs Node, Chromium, and FFmpeg. Root
[`railway.json`](../../railway.json) selects:

- the Dockerfile builder;
- `/healthz` with a 300-second timeout;
- one replica;
- restart-on-failure.

Railway Variables supply Slack and model credentials. The Dockerfile supplies
runtime paths and `/data` defaults. The Railway volume, not a Docker `VOLUME`
instruction, supplies persistence.

A correct deployment must show:

```text
commit: the commit intended for the sandbox
builder: DOCKERFILE
dockerfile: Dockerfile
health check: /healthz
replicas: 1
volume mount: /data
```

## Link the CLI once

From the repository root:

```powershell
railway login
railway link
railway status
```

Choose the project, `production`, and `sequences-slack`. If the GitHub source
points at the wrong branch:

```powershell
railway service source connect `
  --repo vladimirhegai/Sequences `
  --branch slack/workflow-undo-approve-thread `
  --service sequences-slack `
  --json
```

If this cannot see or watch the repository, authorize the Railway GitHub App for
`vladimirhegai/Sequences` in GitHub, then reconnect the source.

## Safe deployment sequence

Run the source gate first:

```powershell
git status --short
npm run typecheck --workspace @sequences/slack
npm run test --workspace @sequences/slack
npm run mcp:demo --workspace @sequences/slack
```

Because GitHub Actions tests the entire monorepo, also run before an important
push:

```powershell
npm run typecheck
npm test
npm run test:perf
```

Then commit and push:

```powershell
git add <intentional-files>
git commit -m "type(scope): concise change"
git push origin HEAD
```

### Path A: GitHub autodeploy

After pushing, look for a new deployment with the expected commit:

```powershell
railway deployment list --limit 5
```

If the expected deployment appears, let it finish. Do not start a second
deployment.

### Path B: explicit deploy from the configured GitHub source

If no GitHub deployment appears, deploy the newest pushed commit from the
configured branch:

```powershell
railway redeploy --from-source --yes --json `
  --service sequences-slack `
  --environment production
```

Confirm the resulting deployment's commit matches `git rev-parse HEAD`.
`--from-source` matters: plain `railway redeploy` reruns the previously deployed
source and does not fetch the new commit.

### Path C: last-resort local upload

Use this only when the GitHub source integration is unavailable:

```powershell
railway up --detach --json `
  --service sequences-slack `
  --environment production `
  --message "Deploy committed local tree"
```

`railway up` uploads the local tree rather than pulling a GitHub commit.
Therefore:

- run it only from the repository root;
- commit first;
- ensure `git status --short` contains no unintended files;
- never use `--path-as-root` for this monorepo service.

Plain `railway redeploy` is appropriate after a variable change or for
restarting the same source.

## Verify every deployment

```powershell
railway deployment list --limit 5
railway logs --lines 100

$baseUrl = "https://sequences-slack-production.up.railway.app"
Invoke-WebRequest "$baseUrl/healthz" |
  Select-Object StatusCode, Content
```

Expected:

```text
HTTP server listening on 0.0.0.0:8080
Sequences for Slack is running (Socket Mode)
StatusCode: 200
Content: ready
```

Then run in Slack:

1. `/sequences mcp-test`
2. `/sequences demo`
3. the flow affected by the change

For OAuth or hosted-MCP changes, open
`https://sequences-slack-production.up.railway.app/slack/install` and complete a
fresh authorization before the real `/sequences` test.

## Failure taxonomy

Do not call every red mark a “Railway failure.”

| Where it appears | What it means | First action |
| --- | --- | --- |
| GitHub **Checks / Annotations**, job `phase1` | GitHub Actions test/typecheck failure | Reproduce the named command/test locally |
| Railway deployment status `FAILED` during build | Docker/Railway build failed | Open build logs; confirm Dockerfile and commit |
| Railway status `CRASHED` or restart loop | Image built but the process exited | Inspect deployment logs and variables |
| `/healthz` returns `503 starting` | HTTP is alive; Slack Socket Mode is not ready | Check the matching `xapp`/`xoxb` pair |
| `/healthz` returns `200 ready` but Slack flow fails | Runtime feature/configuration problem | Run `/sequences mcp-test`, then inspect logs |

GitHub Actions and Railway are independent. A commit may deploy successfully
while GitHub Actions fails because Railway builds the Docker image but CI also
runs paused Forge/Sequences tests. Conversely, green CI does not prove Railway
credentials, OAuth, Socket Mode, Chromium, or Slack behavior.

Old failed deployments remain in Railway's history. During initial setup this
project accumulated failures from the wrong GitHub branch, missing variables,
trial resource limits, and temporary Railpack attempts. Those historical rows
do not mean the current deployment is unhealthy; identify the newest deployment
by ID, source/commit, builder, and status.

## Common recovery

Wrong branch or old code:

```powershell
railway status
railway service source connect `
  --repo vladimirhegai/Sequences `
  --branch slack/workflow-undo-approve-thread `
  --service sequences-slack
```

Wrong builder:

1. Keep service root `/`.
2. Set the config file path to `/railway.json` in Railway settings if needed.
3. Set the Dockerfile path to `Dockerfile`.
4. Trigger a fresh deployment; do not trust a Railpack success for rendering,
   because it may omit Chromium and FFmpeg.

Variable-only change:

```powershell
railway redeploy --service sequences-slack --environment production
```

Never paste variable output into chat or logs. If a credential is exposed,
rotate it in the provider, update Railway, redeploy, and retest OAuth/Socket
Mode as applicable.

## Resource and persistence guardrails

- Keep one replica while token/job state is file-backed.
- Keep the `/data` volume attached.
- Keep app sleeping/serverless disabled for stable Socket Mode judging.
- Current Hobby resources are ample; rendering needs substantially more memory
  than the HTTP/Slack process.
- Watch volume usage: encrypted user tokens, projects, thumbnails, and MP4s are
  persistent and not automatically cleaned up.
- Maintain Railway and model-provider usage alerts.

## References

- [Railway CLI deployment](https://docs.railway.com/cli/deploying)
- [Railway deployment commands](https://docs.railway.com/cli/deployment)
- [Railway config as code](https://docs.railway.com/config-as-code)
- [Railway deployment lifecycle](https://docs.railway.com/deployments/reference)
