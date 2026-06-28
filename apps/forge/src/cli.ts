#!/usr/bin/env node
/**
 * Forge CLI.
 *   node apps/forge/src/cli.ts serve [extensionsDir] [--port 4500] [--work <dir>]
 *
 * Defaults the library to examples/forge/extensions so `npm run forge` works.
 * `--work` sets where the live Document's imported media/drafts land (defaults
 * to the sibling Forge workspace beside the extensions library).
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startForge } from "./server.ts";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const DEFAULT_EXT_DIR = path.join(REPO_ROOT, "examples", "forge", "extensions");

function parseArgs(argv: string[]): { dir: string; port: number; work?: string } {
  let dir = DEFAULT_EXT_DIR;
  let port = 4500;
  let work: string | undefined;
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--port") {
      port = Number(argv[++i]);
    } else if (a === "--work") {
      const next = argv[++i];
      if (next) work = path.resolve(next);
    } else if (a) {
      positional.push(a);
    }
  }
  if (positional[0]) dir = path.resolve(positional[0]);
  return { dir, port, work };
}

const [, , command, ...rest] = process.argv;

if (command === "serve" || command === undefined) {
  const { dir, port, work } = parseArgs(rest);
  startForge({ extensionsDir: dir, port, docDir: work });
} else {
  console.error(`unknown command: ${command}\nusage: forge serve [extensionsDir] [--port 4500] [--work <dir>]`);
  process.exit(1);
}
