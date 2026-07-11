# Operations

## Production identity

| Item | Value |
| --- | --- |
| Public repository | `vladimirhegai/Slack_Sequences` |
| Railway project/service | `Sequences Slack Hackathon` / `sequences-slack` |
| Live URL | `https://sequences-slack-production.up.railway.app` |
| Health check | `/healthz` → `200 ready` |
| Deploy | `railway up` from the monorepo root |
| Publish | `bash scripts/publish-public.sh "message"` |

GitHub autodeploy is off. Publishing the standalone repository does not deploy
the live bot. `railway up` uploads the local tree, so commit and confirm the
working tree before an authorized deploy.

Railway hosts the Bolt app, outbound Socket Mode connection, Chromium/FFmpeg,
`/healthz`, `/slack/install`, and `/slack/oauth_redirect`. It is not a public
MCP endpoint.

## Local verification and probes

Install dependencies from the monorepo root. Do not run the Slack Socket Mode
app locally with sandbox tokens; Railway already owns that connection.

Deterministic checks:

```powershell
npm run typecheck --workspace @sequences/slack
npm run test:unit --workspace @sequences/slack
npm run test:browser --workspace @sequences/slack
npm run mcp:demo --workspace @sequences/slack
npm run sequence:check --workspace @sequences/slack -- --demo --no-mcp --format both
```

An explicitly authorized paid probe must name OpenRouter and disable the proof
film so failures remain inspectable:

```powershell
$env:SLACK_SEQUENCES_ALLOW_DETERMINISTIC_FALLBACK = "0"
$env:SLACK_SEQUENCES_CONTINUITY_GRAPH = "1"
$env:SLACK_SEQUENCES_COMPOSITION = "audit"
npm run sequence:check --workspace @sequences/slack -- `
  --input .tmp/probe.json `
  --provider openrouter-api `
  --mcp --render --temporal `
  --job-id probe-unique-id `
  --format both
```

Use a cache-distinct brief and job id. Live probes can take 6–20+ minutes; let
them run for a meaningful interval instead of polling continuously. Preserve
`planning/attempts/*`, `planning/author-run.json`, `planning/sentinel-run.json`,
`build/qa/sequence-check.json`, temporal strips, blocking overlays, and MP4s.

Replay rejected storyboards without a model call:

```powershell
npm run storyboard:replay --workspace @sequences/slack -- `
  .data/projects/<job>/planning/attempts/storyboard-1-rejected.raw.txt --strict
```

## Required Railway variables

Use `.env.railway.example` as the operational template. The essential groups
are:

- Slack app/socket/OAuth credentials and redirect URLs;
- `OPENAI_API_KEY` for the context bot and Slack hosted MCP;
- `SLACK_SEQUENCES_PROVIDER=openrouter-api` plus `OPENROUTER_API_KEY` for
  planning and source authoring;
- `PUBLIC_BASE_URL`, `SLACK_REDIRECT_URI`, and the mounted data directory.

Current model defaults are GLM for frame/storyboard taste and DeepSeek Pro for
source authoring. Overrides are optional. Register every new
`SLACK_SEQUENCES_*` read in `src/engine/featureFlags.ts`.

`SLACK_SEQUENCES_ALLOW_DETERMINISTIC_FALLBACK=0` is prep/probe mode: exhausted
authoring fails loud and writes `FAILURE.md`. Production judging should use the
approved fallback policy (normally unset/on) so an outage returns the clearly
labeled proof film instead of a raw diagnostic. Confirm this value before an
authorized deploy.

Do not set Railway's injected `PORT`, or add a signing secret for the Socket
Mode-only path.

## Publish and deploy

Only when explicitly authorized:

```powershell
git status --short
git rev-parse HEAD
bash scripts/publish-public.sh "type(scope): concise change"
railway status
railway up --detach --service sequences-slack --environment production
```

Verify the resulting deployment:

```powershell
railway deployment list --limit 5
railway logs --lines 100
$baseUrl = "https://sequences-slack-production.up.railway.app"
Invoke-WebRequest "$baseUrl/healthz" | Select-Object StatusCode, Content
```

Then exercise the affected Slack flow. A health check proves process/socket
readiness, not OAuth, hosted MCP, model access, upload, or film quality.

## Recovery

- `503 starting`: check the matching `xapp`/`xoxb` pair and Railway logs.
- `200 ready` but commands fail: run `/sequences mcp-test`, inspect logs, and
  verify per-user OAuth plus `OPENAI_API_KEY`.
- Planning fails: verify provider selection and its API key.
- Wrong code: confirm repository root, commit, Railway link, then deploy again.
- Variables-only change: `railway redeploy` restarts the same source.
- Exposed credential: rotate at the provider, update Railway, redeploy, and
  retest OAuth and Socket Mode.

Never solve a runtime incident by starting a second Socket Mode process.
