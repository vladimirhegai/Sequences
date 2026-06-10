/**
 * Agent provider configuration surface for /api/meta.
 *
 * Phase 1 ships four providers; the two CLI ones use existing local
 * subscription logins (Codex / Claude Code) and need NO API key — they are
 * the default path. API keys are optional, read from env or passed
 * per-request, and never written to project.json or any file.
 */
export {
  detectProviders,
  defaultProvider,
  PROVIDERS,
  type ProviderId,
  type ProviderInfo,
} from "./agent/providers.ts";
