/** Replay every locally available refactor fixture without model calls. */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseStoryboardResponse } from "../src/engine/compositionRunner.ts";
import { replaySourceArtifact } from "./sourceReplay.ts";

interface Fixture {
  id: string;
  jobId: string;
  expectedRaw: Record<string, { artifactSha256: string; replaySha256?: string; outcome: "parsed" | "rejected" }>;
  expectedSource: Record<string, { artifactSha256: string; replaySha256: string }>;
}

// These hashes are deliberately of the persisted local artifacts, not copies
// of the artifacts. A missing .data fixture is a warning; a changed fixture or
// changed deterministic replay is a failure.
const FIXTURES: Fixture[] = [
  {
    id: "LaunchRelay",
    jobId: "architecture-audit-live-1-20260711",
    expectedRaw: {
      "storyboard-1-rejected.raw.txt": { artifactSha256: "407697f1d40217126d1ecd26bcb48187a19db19fec9dafddb684235b21f4db26", replaySha256: "84ab29fa3b87527b3dd2c7ffa499f95e113beb91b733eb8c9848d385acd804e7", outcome: "parsed" },
      "storyboard-2-rejected.raw.txt": { artifactSha256: "4f3beae48ac8344686959464ce2aa18c980965a03bb75140803d00d6c275da24", replaySha256: "eeb67ad53cf6937380641d507f9273c3f332bb6eed935581f145c55616c14a10", outcome: "parsed" },
    },
    expectedSource: {
      "author-1-browser-rejected.html": { artifactSha256: "338d796da8e298d77f385d651de0ff9e111f76228813ffd7cf75afd3bba8f8be", replaySha256: "f2cba805ec7b6a9285856e948f9d71361ab6f61de648afd31e550e92246c8d4c" },
      "author-2-browser-rejected.html": { artifactSha256: "b25236859cfe1258141963b46e9fff5b9b8ca23bb0caf1f3e4a2bbf7e193f15d", replaySha256: "b28d0903d994423b4963769520f78daa0429630800f02c74824e948886641fbd" },
    },
  },
  {
    id: "PulseForge",
    jobId: "architecture-stress-2-20260711",
    expectedRaw: {
      "storyboard-1-rejected.raw.txt": { artifactSha256: "7f7633ca5c786dc18088681428f50cefbef46f6f2aa68e72ca314a181c3b0e26", replaySha256: "4d2b920fe4d557ce9e4e0c0909b0858884d79f22c7adbda5e129222204826222", outcome: "rejected" },
    },
    expectedSource: {},
  },
  {
    id: "GatePilot",
    jobId: "architecture-stress-3-20260711",
    expectedRaw: {},
    expectedSource: {
      "author-1-browser-rejected.html": { artifactSha256: "9c3ee94688d10e812159649b20ddffef6255e9e8c99ef431b66bce26ef122876", replaySha256: "b340ff5b6f744f1bd27f49816756d8728f7603d5910aa52918c53f84ec043e8e" },
    },
  },
  {
    id: "RelayGuard",
    jobId: "architecture-stress-4-20260711",
    expectedRaw: {
      "storyboard-1-truncated.raw.txt": { artifactSha256: "c114787284cd9e941069cfdd1c5060e25cd3721ff07959509adb4a1d79e5e018", replaySha256: "3dbc3fefa9378943d31c5491cc0fbd1032be30fda24fbf2de11d22441f9418e2", outcome: "rejected" },
      "storyboard-2-rejected.raw.txt": { artifactSha256: "087c4cbcea154fe5badfb5081981bb1d1f8b21f8d143d459e87a8b036c86a465", replaySha256: "9612d8a6781540acdcbac0e8ab11ada8bfb1a7f24b02167c75c6e17e8c865ff4", outcome: "parsed" },
    },
    expectedSource: {},
  },
  {
    id: "SignalDock",
    jobId: "architecture-stress-5-20260711",
    expectedRaw: {
      "storyboard-1-rejected.raw.txt": { artifactSha256: "7dfa968896f689e8a485f5daef62b40607c7d3fc4123b496980d5017ac4fa364", replaySha256: "bccef7656d570436edb3c28520f4685a03920a55bf940bc7ae60d01b9c6ff290", outcome: "rejected" },
    },
    expectedSource: {
      "author-1-browser-rejected.html": { artifactSha256: "a4c3f044f738b03e628d10a57f69976b9228b43fd04dd41a2650c2112dc6f597", replaySha256: "8adcbe78f77ad6d45a6a08e85e64fea737e53dade29c4967d46e4900cfdb8a90" },
      "author-2-browser-rejected.html": { artifactSha256: "ba82df19b8447ae7372bc58300b99a253acd4652677ed52f8726f9907c89f2fb", replaySha256: "102fa22bb8bb3b2fa2ec1a2d5952587ab241fb0a4a4f8bf8062788bf90674718" },
    },
  },
  {
    id: "Briefly",
    jobId: "refactor-review-normal-1-20260711",
    expectedRaw: {},
    expectedSource: {
      "author-1-browser-rejected.html": { artifactSha256: "615a5d6217a9a9a952502aa33dcbeee7220c0b30ca8a19f8c1c22369bc76aace", replaySha256: "14f76a290a5185325ac07829c082516c610e4e4a3d5b30ebb26730a99018f565" },
      "author-2-browser-rejected.html": { artifactSha256: "67c3fc17b64348c49a38da5aee1798306f4d1aa63377139843c2e2809b48e64d", replaySha256: "1f1b009cdc93f493234450f73d5b1356af649be3a42435367dd636cae7db4575" },
    },
  },
];

const appDir = path.resolve(import.meta.dirname, "..");
const projectsDir = path.join(appDir, ".data", "projects");

function sha256(value: string | Buffer): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function stableReplay(raw: string): string {
  const scenes = parseStoryboardResponse(raw, {}, { degradePacingFindings: true });
  return JSON.stringify(scenes.map((scene) => ({
    id: scene.id,
    startSec: scene.startSec,
    durationSec: scene.durationSec,
    beats: scene.beats?.map((beat) => `${beat.id}@${beat.atSec}`) ?? [],
    moments: scene.moments?.map((moment) => `${moment.id}@${moment.atSec}`) ?? [],
    normalizations: scene.sentinelNormalizations ?? [],
  })));
}

function rawFiles(projectDir: string): string[] {
  const attemptsDir = path.join(projectDir, "planning", "attempts");
  if (!fs.existsSync(attemptsDir)) return [];
  return fs.readdirSync(attemptsDir)
    .filter((name) => name.startsWith("storyboard-") && name.endsWith(".raw.txt"))
    .sort()
    .map((name) => path.join(attemptsDir, name));
}

function sourceFiles(projectDir: string): string[] {
  const attemptsDir = path.join(projectDir, "planning", "attempts");
  if (!fs.existsSync(attemptsDir)) return [];
  return fs.readdirSync(attemptsDir)
    .filter((name) => name.endsWith(".html"))
    .sort()
    .map((name) => path.join(attemptsDir, name));
}

function expectedFor<T>(map: Record<string, T>, file: string): T | undefined {
  return map[path.basename(file)];
}

async function main(): Promise<number> {
  let failures = 0;
  let replayed = 0;
  let skipped = 0;
  for (const fixture of FIXTURES) {
    const projectDir = path.join(projectsDir, fixture.jobId);
    if (!fs.existsSync(projectDir)) {
      console.warn(`[replay:all] SKIP ${fixture.id}: missing ${projectDir}`);
      skipped += 1;
      continue;
    }
    console.log(`[replay:all] ${fixture.id} (${fixture.jobId})`);
    for (const file of rawFiles(projectDir)) {
      const name = path.basename(file);
      const expected = expectedFor(fixture.expectedRaw, file);
      if (!expected) {
        console.warn(`  SKIP ${name}: no frozen expectation recorded`);
        skipped += 1;
        continue;
      }
      const raw = fs.readFileSync(file);
      if (sha256(raw) !== expected.artifactSha256) {
        console.error(`  FAIL ${name}: fixture bytes drifted`);
        failures += 1;
        continue;
      }
      try {
        const replayHash = sha256(stableReplay(raw.toString("utf8")));
        if (expected.outcome !== "parsed" || replayHash !== expected.replaySha256) {
          console.error(`  FAIL ${name}: replay outcome/hash drifted`);
          failures += 1;
        } else {
          console.log(`  PASS ${name}`);
          replayed += 1;
        }
      } catch (error) {
        const replayHash = sha256(String(error));
        if (expected.outcome === "rejected" && replayHash === expected.replaySha256) {
          console.log(`  PASS ${name} (expected rejection)`);
          replayed += 1;
        } else {
          console.error(`  FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
          failures += 1;
        }
      }
    }
    for (const file of sourceFiles(projectDir)) {
      const name = path.basename(file);
      const expected = expectedFor(fixture.expectedSource, file);
      if (!expected) {
        console.warn(`  SKIP ${name}: no frozen expectation recorded`);
        skipped += 1;
        continue;
      }
      if (sha256(fs.readFileSync(file)) !== expected.artifactSha256) {
        console.error(`  FAIL ${name}: fixture bytes drifted`);
        failures += 1;
        continue;
      }
      try {
        const result = await replaySourceArtifact(projectDir, file);
        const replayHash = sha256(result.repairedHtml + JSON.stringify(result.storyboard));
        if (replayHash !== expected.replaySha256) {
          console.error(`  FAIL ${name}: strict source replay drifted`);
          failures += 1;
        } else {
          console.log(`  PASS ${name} (strict source)`);
          replayed += 1;
        }
      } catch (error) {
        console.error(`  FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
        failures += 1;
      }
    }
  }
  console.log(`[replay:all] ${replayed} replay(s), ${skipped} skipped, ${failures} failure(s)`);
  return failures ? 1 : 0;
}

async function printExpectations(): Promise<void> {
  for (const fixture of FIXTURES) {
    const projectDir = path.join(projectsDir, fixture.jobId);
    if (!fs.existsSync(projectDir)) continue;
    console.log(`${fixture.id} ${fixture.jobId}`);
    for (const file of rawFiles(projectDir)) {
      const raw = fs.readFileSync(file);
      try {
        console.log(`  raw ${path.basename(file)} ${JSON.stringify({ artifactSha256: sha256(raw), replaySha256: sha256(stableReplay(raw.toString("utf8"))), outcome: "parsed" })}`);
      } catch (error) {
        console.log(`  raw ${path.basename(file)} ${JSON.stringify({ artifactSha256: sha256(raw), replaySha256: sha256(String(error)), outcome: "rejected" })}`);
      }
    }
    for (const file of sourceFiles(projectDir)) {
      const result = await replaySourceArtifact(projectDir, file);
      console.log(`  source ${path.basename(file)} ${JSON.stringify({ artifactSha256: sha256(fs.readFileSync(file)), replaySha256: sha256(result.repairedHtml + JSON.stringify(result.storyboard)) })}`);
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes("--print-expectations")) await printExpectations();
  else process.exitCode = await main();
}
