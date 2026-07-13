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

## Slack app manifest

`apps/slack/manifest.json` is the version-controlled source of truth for the
Slack app configuration. Slack slash-command names cannot contain spaces, so
the app registers one `/sequences` command; `assets`, `assets clear`, `demo`,
and the other documented operations are arguments handled by the Bolt app.

A Railway deploy does not update Slack's copy of the manifest. Apply manifest
changes in **Slack app settings → App Manifest**, or use
`apps.manifest.update` with a short-lived Slack app configuration token. Do not
store that user-scoped configuration token as a Railway runtime variable.

This app uses Socket Mode, so slash commands, events, and interactivity do not
need public request URLs in the manifest. The OAuth redirect URL is still
required and must exactly match:

```text
https://sequences-slack-production.up.railway.app/slack/oauth_redirect
```

After a scope change, reinstall the Slack app and replace the affected runtime
token in Railway before deploying. Copy/help/redirect-only manifest changes do
not rotate the existing bot token.

## Local verification and probes

Install dependencies from the monorepo root. Do not run the Slack Socket Mode
app locally with sandbox tokens; Railway already owns that connection.

Deterministic checks:

```powershell
npm run typecheck
npm run typecheck --workspace @sequences/slack
npm run test:unit --workspace @sequences/slack
npm run test:browser --workspace @sequences/slack
npm run replay:all --workspace @sequences/slack
npm run mcp:demo --workspace @sequences/slack
npm run sequence:check --workspace @sequences/slack -- --demo --no-mcp --format both
```

For a persisted job with a completed Sentinel ledger:

```powershell
npm run probe:triage --workspace @sequences/slack -- <job-id-or-project-dir>
```

`probe:triage` intentionally requires `planning/sentinel-run.json`. An
early-stopped job without that file must be documented directly from its
persisted storyboard/source/QA artifacts; do not invent call counts.

### Current hackathon probe contract (2026-07-12)

The active work order is S6.9-S6.13 in `REFACTOR_PLAN.md`. It supersedes the
older goal of proving zero residue across an open-ended probe chain:

- use one ordinary 14-18 second launch brief containing facts, audience, tone,
  before/after story, and CTA; do not specify five scenes, exact components, or
  camera moves just to stress the gates;
- the goal is one runtime-valid, human-acceptable MP4 with no surviving hard
  failure. A truthful `warn` is acceptable when only advisory taste findings
  remain;
- target no more than two logical storyboard attempts, two logical source
  attempts, six logical calls, and eight physical requests for the job. These
  code-level caps are implementation work in S6.11; until it lands, the
  operator must stop an obviously runaway run when practical and must not hide
  the excess in reporting;
- stop after the first acceptable MP4. Do not rerun for advisory washout,
  occupancy preference on an already-visible focal, camera-settle taste,
  supporting static moments, or parent/child surface overlap;
- a second paid probe is allowed only after probe A has a hard failure or an
  obvious judge-visible break, that exact artifact has been replayed, and the
  lowest deterministic owner has been fixed and fully verified. There is no
  third probe in this sprint; and
- after success, keep the authored MP4 and a model-free known-good backup, then
  freeze product code except for a P0 launch failure.

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

Use a cache-distinct job id without changing the semantic brief. Live probes
can take 6–20+ minutes; poll no more often than once per 60 seconds. Preserve
`planning/attempts/*`, `planning/author-run.json`, `planning/sentinel-run.json`,
`build/qa/sequence-check.json`, temporal strips, blocking overlays, and MP4s.

Replay rejected storyboards without a model call:

```powershell
npm run storyboard:replay --workspace @sequences/slack -- `
  .data/projects/<job>/planning/attempts/storyboard-1-rejected.raw.txt --strict
```

### Frozen hackathon presentation runbook (S6.13)

Product code is frozen at S6.12 commit `9aa6aa6`. Do not reopen it for an
advisory preference. The primary demo is the exact OpenRouter-authored Probe B
source after bounded model-free normalization and render:

```text
apps/slack/.data/projects/s6-12-sequences-slack-b-20260712-2113/renders/sequences-for-slack-recovered-probe-b-20260713-015938.mp4
```

It is the first accepted artifact: 16.0s H.264, 1920x1080, 30fps, runtime
valid, no hard finding, human disposition `accept with warn`. Keep the MP4,
project ledger/source/revisions, `build/qa/temporal`, and `build/thumbs`
together. The live Probe B command failed before render; do not describe the
local exact-source recovery as a terminal live `sequence:check` success.

Judge-facing Slack rehearsal:

1. Run `/sequences debug on` so the result carries stage attempts/durations
   without exposing prompts or model output.
2. Run `/sequences assets` (`asset` and `assets` are aliases), upload 1-5 UI
   screenshots, and add optional brand notes. The intake extracts/stores the
   palette deterministically; GLM uses that committed brand brief during the
   subsequent frame/story decision. Wait for the `Captured your brand...`
   receipt and optional asset-kit preview.
3. Run `/sequences`, submit the ordinary launch brief in the modal, and do not
   prescribe scenes/components/camera moves. The one building message should
   advance through frame design, storyboard, source authoring, composition
   submission, storyboard preview, and render.
4. Confirm the channel/thread receives storyboard thumbnails plus `frame.md`,
   then a rendering receipt, then `"<title>" is ready - draft below` and the
   uploaded MP4. The build trace must show the actual submit/preview/render
   receipts; `warn` is acceptable when the ledger is runtime-valid with only
   advisory residue.
5. If a model stage is unavailable and production fallback is enabled, the
   result must visibly say `Safe fallback` and name the failed stage. It must
   never be presented as a model-authored cut. If the live path cannot be used,
   run `/sequences demo` or play the model-free backup below.

The production fallback flag is opt-out: leave
`SLACK_SEQUENCES_ALLOW_DETERMINISTIC_FALLBACK` unset/on for judging; only probe
evidence sets it to `0`. A publish or deploy still requires explicit owner
authorization; the S6.13 owner-authorized deploy uses the committed tree only.

Timed model-free backup rehearsal (2026-07-13):

```powershell
Remove-Item Env:SLACK_SEQUENCES_ALLOW_DETERMINISTIC_FALLBACK -ErrorAction SilentlyContinue
npm run sequence:check --workspace @sequences/slack -- `
  --demo --no-mcp --render --temporal `
  --job-id s6-13-hackathon-rehearsal-20260713 `
  --format both
```

This completed in 30.6s with status `pass`, clean lint, five thumbnails, and a
real 17.5s H.264 MP4 (1920x1080, 30fps, 525 frames). Artifacts:

```text
apps/slack/.data/projects/s6-13-hackathon-rehearsal-20260713/build/qa/sequence-check.json
apps/slack/.data/projects/s6-13-hackathon-rehearsal-20260713/build/qa/sequence-check.md
apps/slack/.data/projects/s6-13-hackathon-rehearsal-20260713/renders/relay-20260713-021028.mp4
```

The backup is the curated `/sequences demo` preset and makes no model/MCP
request. On 2026-07-13 the production `/healthz` endpoint returned `200 ready`
in 296ms. Before the owner-authorized S6.13 deploy, the production fallback
variable was restored from evidence-only `0` to explicit-on `1` using
`railway variable set ... --skip-deploys`, so it could be applied once with the
verified commit. The health check confirms process readiness only; it does not
prove Slack OAuth/provider access.

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
