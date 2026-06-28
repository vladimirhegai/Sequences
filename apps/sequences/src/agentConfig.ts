/**
 * Agent provider configuration surface for /api/meta.
 *
 * Local CLI providers use existing subscription logins (Codex, Claude Code,
 * and Google Antigravity) and need NO API key — they are the default path.
 * API keys are optional, read from env or passed
 * per-request, and never written to project.json or any file.
 */
export {
  detectProviders,
  defaultProvider,
  PROVIDERS,
  type ProviderId,
  type ProviderInfo,
} from "@sequences/platform/providers";
