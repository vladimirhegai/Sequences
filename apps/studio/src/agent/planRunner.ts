/**
 * The plan pipeline: brief → provider completion → JSON extraction → plan
 * schema validation → one atomic Batch through the store. Provider-agnostic;
 * all the quality enforcement lives in @sequences/core (PlanSchema +
 * validateProject + deterministic fill).
 */
import {
  buildPlanPrompt,
  extractJsonObject,
  parsePlan,
  planToCommands,
  type Plan,
  type Project,
  type ProjectStore,
} from "@sequences/core";
import {
  PROVIDERS,
  type AgentProvider,
  type CompleteOptions,
  type ProviderId,
} from "./providers.ts";

export interface PlanRunResult {
  provider: ProviderId;
  plan: Plan;
  /** Raw model/CLI output, for the journal/debugging. */
  raw: string;
}

/** Ask a specific provider instance for a plan (injectable for tests). */
export async function requestPlanWith(
  provider: AgentProvider,
  brief: string,
  project: Project,
  options: CompleteOptions = {},
): Promise<PlanRunResult> {
  if (!brief.trim()) throw new Error("brief is empty");
  const prompt = buildPlanPrompt(brief, project);
  const raw = await provider.complete(prompt, options);
  const plan = parsePlan(extractJsonObject(raw));
  return { provider: provider.id, plan, raw };
}

/** Ask a registered provider for a plan. Pure with respect to the project. */
export async function requestPlan(
  providerId: ProviderId,
  brief: string,
  project: Project,
  options: CompleteOptions = {},
): Promise<PlanRunResult> {
  const provider = PROVIDERS[providerId];
  if (!provider) throw new Error(`unknown provider "${providerId}"`);
  return requestPlanWith(provider, brief, project, options);
}

/** Request a plan AND apply it through the store (source: "agent"). */
export async function runPlan(
  providerId: ProviderId,
  brief: string,
  store: ProjectStore,
  options: CompleteOptions = {},
): Promise<PlanRunResult> {
  const result = await requestPlan(providerId, brief, store.project, options);
  const batch = planToCommands(store.project, result.plan);
  const outcome = store.apply(batch, "agent");
  if (!outcome.ok) {
    const issues = outcome.errors.map((e) => `${e.path}: ${e.message}`).join("; ");
    throw new Error(`plan failed project validation — ${issues}`);
  }
  return result;
}
