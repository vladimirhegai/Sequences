#!/usr/bin/env bash
#
# Publish the leanest public subset of this monorepo to the public
# Slack_Sequences repo: apps/slack + packages/core + packages/platform.
#
# apps/sequences and apps/forge are NEVER published (private dev source we copy
# glue out of). Secrets (.env) are stripped and gitignored. The mirror lives in
# a gitignored .publish/ checkout so this monorepo's own git stays untouched.
#
# Usage:  bash scripts/publish-public.sh ["commit message"]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STAGE="$ROOT/.publish"
REMOTE="https://github.com/vladimirhegai/Slack_Sequences.git"
MSG="${1:-publish: snapshot slack bot + core + platform}"

echo "→ staging public subset in $STAGE"
mkdir -p "$STAGE"

# Initialize the mirror checkout once; keep .git + node_modules across runs.
if [ ! -d "$STAGE/.git" ]; then
  git -C "$STAGE" init -q -b main
  git -C "$STAGE" remote add origin "$REMOTE"
fi
git -C "$STAGE" remote set-url origin "$REMOTE"

# Always work on `main` so the commit we make is the ref we push. (A previous
# run could leave the staging checkout on a stray branch; committing there and
# blindly `push origin main` would push a STALE main ref and roll the public
# repo — and the Railway deploy — backwards.)
git -C "$STAGE" checkout -B main >/dev/null 2>&1 || true

# Wipe tracked content (preserve .git and any cached node_modules).
find "$STAGE" -mindepth 1 -maxdepth 1 ! -name .git ! -name node_modules -exec rm -rf {} +

# --- copy the subset ------------------------------------------------------
mkdir -p "$STAGE/packages" "$STAGE/apps"
cp -r "$ROOT/packages/core"     "$STAGE/packages/core"
cp -r "$ROOT/packages/platform" "$STAGE/packages/platform"
cp -r "$ROOT/apps/slack"        "$STAGE/apps/slack"

# Strip secrets / heavy / generated dirs from the copies.
rm -f  "$STAGE/apps/slack/.env"
rm -rf "$STAGE/apps/slack/node_modules" \
       "$STAGE/packages/core/node_modules" \
       "$STAGE/packages/platform/node_modules" \
       "$STAGE"/apps/slack/build "$STAGE"/apps/slack/renders

# Shared root config copied verbatim.
cp "$ROOT/tsconfig.base.json" "$STAGE/tsconfig.base.json"
cp "$ROOT/.gitignore"         "$STAGE/.gitignore"

# Deployment files (Railway builds the public repo from these).
cp "$ROOT/Dockerfile"     "$STAGE/Dockerfile"
cp "$ROOT/railway.json"   "$STAGE/railway.json"
cp "$ROOT/.dockerignore"  "$STAGE/.dockerignore"

# --- tailored root files (this monorepo is the single source of truth) ----
cat > "$STAGE/package.json" <<'EOF'
{
  "name": "slack-sequences",
  "private": true,
  "version": "0.0.1",
  "description": "Sequences for Slack — an agentic Slack bot that turns launch context into editable product demo videos. Slack Agent Builder Challenge.",
  "type": "module",
  "engines": { "node": ">=22.18" },
  "workspaces": ["packages/*", "apps/*"],
  "scripts": {
    "dev": "npm run dev --workspace @sequences/slack",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run"
  },
  "devDependencies": {
    "@types/node": "^25.9.2",
    "fast-check": "^4.8.0",
    "typescript": "^5.9.0",
    "vitest": "^3.2.0"
  }
}
EOF

cat > "$STAGE/tsconfig.json" <<'EOF'
{
  "extends": "./tsconfig.base.json",
  "include": [
    "packages/*/src/**/*.ts",
    "packages/*/test/**/*.ts",
    "apps/slack/src/**/*.ts"
  ],
  "exclude": ["node_modules"]
}
EOF

cat > "$STAGE/README.md" <<'EOF'
# Sequences for Slack

An agentic Slack bot for the **Slack Agent Builder Challenge** that turns a
product-launch brief — or a whole release thread — into a **revisable product
demo video**, without leaving Slack. The agent plans from a constrained motion
catalog, renders a draft, and posts the storyboard and video back to Slack.

> Track: **New Slack Agent** · Tech: **MCP / agentic video pipeline** on a real
> deterministic engine — not a prompt-and-pray wrapper.

## What's here

This repo is the **published subset** of a larger workspace:

- `apps/slack/` — the Slack bot (Bolt for JavaScript, Socket Mode).
- `packages/core/` — `@sequences/core`: the deterministic motion engine
  (scene graph, tokens, registry, solver, compiler, linter). Pure, zero-IO.
- `packages/platform/` — `@sequences/platform`: shared host services
  (agent providers, asset metadata, media, HyperFrames vendor resolution).
- `evals/` and `examples/forge/extensions/` — small, data-only fixtures required
  by the shared engine tests; the Forge application itself is not published.

Read [apps/slack/CLAUDE.md](apps/slack/CLAUDE.md),
[apps/slack/SLACK_PLAN.md](apps/slack/SLACK_PLAN.md), and
[apps/slack/HACKATHON_RULES.md](apps/slack/HACKATHON_RULES.md).

## What works today

- `/sequences demo` builds a deterministic five-scene Relay v2 reel with no
  model or API key.
- `/sequences` and the **🎬 Make a launch video** message shortcut collect a
  launch brief; the shortcut reads the whole release **thread** for context.
- **Two-tier delivery**: storyboard thumbnails post in seconds (`files.uploadV2`),
  then the rendered MP4 replaces them inline when it's ready.
- **Revise**, **Undo**, and **Approve & share** (repost the finished reel to
  another channel) run in-channel.
- Plan / preview / render / undo are driven over the included **MCP server**
  (with an in-process fallback); each result shows a tool receipt.

## Setup and run

```bash
npm install
cp apps/slack/.env.example apps/slack/.env   # fill in SLACK_BOT_TOKEN + SLACK_APP_TOKEN
npm run dev
```

Create or update the Slack app from
[apps/slack/manifest.json](apps/slack/manifest.json), then reinstall it whenever
OAuth scopes change. The complete setup + deploy walkthrough is in
[apps/slack/OPERATIONS.md](apps/slack/OPERATIONS.md).

Node ≥ 22.18. Rendering previews additionally needs Chrome/Edge (and FFmpeg for
MP4).

## Verify

```bash
npm run typecheck
npm test
npm run demo --workspace @sequences/slack
npm run mcp:demo --workspace @sequences/slack
```
EOF

cat > "$STAGE/CLAUDE.md" <<'EOF'
# CLAUDE.md — Sequences for Slack (published repo)

This is the **public subset** of a larger private monorepo. It contains only the
Slack bot and the shared engine it depends on:

- `apps/slack/` — the bot. **Start here:** [apps/slack/CLAUDE.md](apps/slack/CLAUDE.md).
- `packages/core/`, `packages/platform/` — the shared Sequences engine. Ours to
  modify/harden for the hackathon.

`apps/sequences` and `apps/forge` are **not** in this repo — they live in the
private dev monorepo. When the bot needs host glue (render, project IO, plan
runner), we **copy it into `apps/slack/src/engine/`** and adapt it. The bot must
never depend on code outside this repo.

Hackathon plan: [apps/slack/SLACK_PLAN.md](apps/slack/SLACK_PLAN.md).
Hackathon rules: [apps/slack/HACKATHON_RULES.md](apps/slack/HACKATHON_RULES.md).

## Commands

```bash
npm run dev          # run the Slack bot (Socket Mode)
npm run typecheck    # tsc --noEmit over packages + apps/slack
npm test             # vitest (engine suite)
```
EOF

# --- lockfile (best-effort; cloners can regenerate) -----------------------
echo "→ generating package-lock.json"
( cd "$STAGE" && npm install --package-lock-only --no-audit --no-fund ) \
  || echo "  (lockfile generation skipped — npm install on clone will create it)"

# --- commit + push --------------------------------------------------------
gh auth setup-git >/dev/null 2>&1 || true
git -C "$STAGE" add -A
if git -C "$STAGE" diff --cached --quiet; then
  echo "→ no changes to publish"
  exit 0
fi
git -C "$STAGE" commit -q -m "$MSG"
echo "→ pushing to $REMOTE (main)"
# --force-with-lease refuses to clobber remote commits the mirror hasn't seen
# (e.g. a PR merged on GitHub) — safer than a blind --force. Run a fetch first so
# the lease has a ref to compare against; ignore failure on the very first push.
git -C "$STAGE" fetch origin main -q || true
git -C "$STAGE" push -u origin main --force-with-lease
echo "✓ published"
