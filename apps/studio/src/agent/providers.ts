/**
 * Agent providers — the brains Sequences can plan with.
 *
 * Priority design goal (Phase 1): work WITHOUT API keys. The two `cli`
 * providers shell out to locally installed, subscription-authenticated
 * agent CLIs:
 *
 *   - codex-cli       → `codex exec` (uses your ChatGPT/Codex login)
 *   - claude-code-cli → `claude -p`  (uses your Claude Code subscription login)
 *
 * The two `api` providers are optional and only light up when a key is
 * present (env var or a key passed per-request from the studio UI — never
 * persisted to disk, never written into project.json).
 *
 * Every provider implements one method: complete(prompt) → text. The plan
 * pipeline (prompt building, JSON extraction, schema validation, commands)
 * is identical regardless of brain — quality is enforced by the schema +
 * validator + deterministic fill, not by the model.
 */
import { execFile, execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export type ProviderId = "codex-cli" | "claude-code-cli" | "openai-api" | "anthropic-api";

export interface CompleteOptions {
  /** Per-request API key (api providers only). Overrides the env var. */
  apiKey?: string;
  timeoutMs?: number;
}

export interface AgentProvider {
  id: ProviderId;
  label: string;
  kind: "cli" | "api";
  /** Env var consulted for api providers when no per-request key is given. */
  apiKeyEnv?: string;
  /** Quick availability probe (CLI on PATH / key in env). */
  detect(): Promise<{ available: boolean; detail: string }>;
  complete(prompt: string, options?: CompleteOptions): Promise<string>;
}

export interface ProviderInfo {
  id: ProviderId;
  label: string;
  kind: "cli" | "api";
  apiKeyEnv?: string;
  available: boolean;
  detail: string;
}

const DEFAULT_TIMEOUT_MS = 240_000;

/** Resolve a command on PATH (where.exe on Windows, which elsewhere). */
export function findOnPath(command: string): string | undefined {
  try {
    const finder = process.platform === "win32" ? "where.exe" : "which";
    const output = execFileSync(finder, [command], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 5000,
    });
    return output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean);
  } catch {
    return undefined;
  }
}

/**
 * Run a CLI with the prompt on STDIN (never as an argv — prompts are long,
 * multi-line, and full of quotes). Windows `.cmd`/`.bat` shims are launched
 * through cmd.exe.
 */
function runCli(
  file: string,
  args: string[],
  stdin: string,
  timeoutMs: number,
): Promise<{ stdout: string; stderr: string }> {
  const isCmdShim = process.platform === "win32" && /\.(cmd|bat)$/i.test(file);
  const command = isCmdShim ? "cmd.exe" : file;
  const commandArgs = isCmdShim ? ["/d", "/s", "/c", file, ...args] : args;
  return new Promise((resolve, reject) => {
    const child = execFile(
      command,
      commandArgs,
      {
        encoding: "utf8",
        timeout: timeoutMs,
        maxBuffer: 32 * 1024 * 1024,
        windowsHide: true,
        ...(isCmdShim ? { windowsVerbatimArguments: true } : {}),
      },
      (error, stdout, stderr) => {
        if (error) {
          const detail = (stderr || stdout || "").trim().slice(0, 500);
          reject(new Error(`${path.basename(file)} failed: ${error.message}${detail ? `\n${detail}` : ""}`));
        } else {
          resolve({ stdout, stderr });
        }
      },
    );
    child.stdin?.end(stdin);
  });
}

/* ---------- CLI providers (no API key — local subscription logins) ---------- */

export const codexCli: AgentProvider = {
  id: "codex-cli",
  label: "Codex CLI (ChatGPT login)",
  kind: "cli",
  async detect() {
    const found = findOnPath("codex");
    return found
      ? { available: true, detail: found }
      : { available: false, detail: "codex not on PATH — install: npm i -g @openai/codex, then `codex login`" };
  },
  async complete(prompt, options = {}) {
    const file = findOnPath("codex");
    if (!file) throw new Error("codex CLI not found on PATH");
    // --output-last-message gives us ONLY the final agent message (stdout
    // carries reasoning/log noise). Read-only sandbox: planning never needs
    // to touch the filesystem.
    const lastMessageFile = path.join(
      os.tmpdir(),
      `seq-codex-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.txt`,
    );
    try {
      await runCli(
        file,
        [
          "exec",
          "--skip-git-repo-check",
          "--sandbox",
          "read-only",
          "--output-last-message",
          lastMessageFile,
          "-",
        ],
        prompt,
        options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      );
      if (fs.existsSync(lastMessageFile)) {
        const text = fs.readFileSync(lastMessageFile, "utf8").trim();
        if (text) return text;
      }
      throw new Error("codex exec produced no final message");
    } finally {
      fs.rmSync(lastMessageFile, { force: true });
    }
  },
};

export const claudeCodeCli: AgentProvider = {
  id: "claude-code-cli",
  label: "Claude Code CLI (subscription login)",
  kind: "cli",
  async detect() {
    const found = findOnPath("claude");
    return found
      ? { available: true, detail: found }
      : { available: false, detail: "claude not on PATH — install Claude Code, then sign in once" };
  },
  async complete(prompt, options = {}) {
    const file = findOnPath("claude");
    if (!file) throw new Error("claude CLI not found on PATH");
    // -p (print mode) reads the prompt from stdin and prints the final
    // response. Planning is a one-shot text task — no tools needed.
    const { stdout } = await runCli(
      file,
      ["-p", "--output-format", "text"],
      prompt,
      options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    );
    const text = stdout.trim();
    if (!text) throw new Error("claude -p produced no output");
    return text;
  },
};

/* ---------- API providers (optional, key required, never persisted) ---------- */

async function postJson(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  timeoutMs: number,
): Promise<unknown> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 500);
    throw new Error(`${url} → HTTP ${res.status}${detail ? `: ${detail}` : ""}`);
  }
  return res.json();
}

export const openaiApi: AgentProvider = {
  id: "openai-api",
  label: "OpenAI API (key)",
  kind: "api",
  apiKeyEnv: "OPENAI_API_KEY",
  async detect() {
    return process.env.OPENAI_API_KEY
      ? { available: true, detail: "OPENAI_API_KEY set" }
      : { available: false, detail: "no OPENAI_API_KEY — optional; the CLI providers need no key" };
  },
  async complete(prompt, options = {}) {
    const key = options.apiKey || process.env.OPENAI_API_KEY;
    if (!key) throw new Error("no OpenAI API key (set OPENAI_API_KEY or pass one per request)");
    const model = process.env.SEQUENCES_OPENAI_MODEL ?? "gpt-5.1-mini";
    const json = (await postJson(
      "https://api.openai.com/v1/chat/completions",
      { authorization: `Bearer ${key}` },
      { model, messages: [{ role: "user", content: prompt }] },
      options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    )) as { choices?: Array<{ message?: { content?: string } }> };
    const text = json.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error("OpenAI returned an empty completion");
    return text;
  },
};

export const anthropicApi: AgentProvider = {
  id: "anthropic-api",
  label: "Anthropic API (key)",
  kind: "api",
  apiKeyEnv: "ANTHROPIC_API_KEY",
  async detect() {
    return process.env.ANTHROPIC_API_KEY
      ? { available: true, detail: "ANTHROPIC_API_KEY set" }
      : { available: false, detail: "no ANTHROPIC_API_KEY — optional; the CLI providers need no key" };
  },
  async complete(prompt, options = {}) {
    const key = options.apiKey || process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error("no Anthropic API key (set ANTHROPIC_API_KEY or pass one per request)");
    const model = process.env.SEQUENCES_ANTHROPIC_MODEL ?? "claude-sonnet-4-6";
    const json = (await postJson(
      "https://api.anthropic.com/v1/messages",
      { "x-api-key": key, "anthropic-version": "2023-06-01" },
      { model, max_tokens: 4096, messages: [{ role: "user", content: prompt }] },
      options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    )) as { content?: Array<{ type: string; text?: string }> };
    const text = json.content
      ?.filter((block) => block.type === "text")
      .map((block) => block.text ?? "")
      .join("")
      .trim();
    if (!text) throw new Error("Anthropic returned an empty completion");
    return text;
  },
};

/* ---------- registry ---------- */

/** Ordered by preference: local subscription CLIs first — no keys required. */
export const PROVIDERS: Record<ProviderId, AgentProvider> = {
  "codex-cli": codexCli,
  "claude-code-cli": claudeCodeCli,
  "anthropic-api": anthropicApi,
  "openai-api": openaiApi,
};

let detectCache: Promise<ProviderInfo[]> | null = null;

export function detectProviders(force = false): Promise<ProviderInfo[]> {
  if (!detectCache || force) {
    detectCache = Promise.all(
      Object.values(PROVIDERS).map(async (provider) => {
        const { available, detail } = await provider.detect();
        return {
          id: provider.id,
          label: provider.label,
          kind: provider.kind,
          ...(provider.apiKeyEnv ? { apiKeyEnv: provider.apiKeyEnv } : {}),
          available,
          detail,
        };
      }),
    );
  }
  return detectCache;
}

/** First available provider in preference order (CLIs before APIs). */
export async function defaultProvider(): Promise<ProviderId | null> {
  const infos = await detectProviders();
  return infos.find((p) => p.available)?.id ?? null;
}
