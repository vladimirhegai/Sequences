import { recordSentinelNormalization } from "../sentinelTelemetry.ts";

/** A stable L2 identifier owned by the Sentinel normalize registry. */
export type NormalizerId = `normalize.${string}`;

export interface NormalizerOutcome<State> {
  /** State handed to the next normalizer in the ordered pipeline. */
  readonly state: State;
  /** Number of deterministic repairs performed by this stage. */
  readonly repairCount: number;
  /**
   * Telemetry count when it intentionally differs from the state-change count.
   * `0` preserves legacy stages that emitted diagnostics but no normalization
   * telemetry; omitted means `repairCount`.
   */
  readonly telemetryCount?: number;
  /** Side effects that historically followed normalization telemetry. */
  readonly afterTelemetry?: () => void;
  /** Operator diagnostics emitted after the stage completes. */
  readonly diagnostics?: readonly string[];
}

/** Array order is execution order; ids are stable contract paperwork. */
export interface OrderedNormalizer<State, Context = undefined> {
  readonly id: NormalizerId;
  /** Retain historical telemetry keys while execution becomes registry-owned. */
  readonly telemetryTag: string;
  readonly run: (state: State, context: Context) => NormalizerOutcome<State>;
}

export interface NormalizerRuntimeHooks {
  /** Tests can observe telemetry without entering an AsyncLocalStorage run. */
  readonly recordTelemetry?: (tag: string, count: number) => void;
  /** Tests can suppress/capture stderr while production retains current output. */
  readonly writeDiagnostic?: (message: string) => void;
}

export interface NormalizerRegistryRun<State> {
  readonly state: State;
  /** Full trace, including no-op stages, exposes the load-bearing order. */
  readonly executedIds: readonly NormalizerId[];
  readonly changedIds: readonly NormalizerId[];
}

/**
 * Execute an ordered deterministic-normalizer registry through one seam.
 * Telemetry and diagnostics are centralized so a stage cannot silently omit
 * L2 accounting or grow a second execution path.
 */
export function runNormalizerRegistry<State, Context>(
  registry: readonly OrderedNormalizer<State, Context>[],
  initialState: State,
  context: Context,
  hooks: NormalizerRuntimeHooks = {},
): NormalizerRegistryRun<State> {
  const executedIds: NormalizerId[] = [];
  const changedIds: NormalizerId[] = [];
  const recordTelemetry = hooks.recordTelemetry ?? recordSentinelNormalization;
  const writeDiagnostic = hooks.writeDiagnostic ?? ((message: string) => {
    process.stderr.write(message);
  });
  let state = initialState;

  for (const normalizer of registry) {
    executedIds.push(normalizer.id);
    const outcome = normalizer.run(state, context);
    state = outcome.state;
    if (outcome.repairCount > 0) {
      changedIds.push(normalizer.id);
    }
    const telemetryCount = outcome.telemetryCount ?? outcome.repairCount;
    if (telemetryCount > 0) recordTelemetry(normalizer.telemetryTag, telemetryCount);
    outcome.afterTelemetry?.();
    for (const diagnostic of outcome.diagnostics ?? []) writeDiagnostic(diagnostic);
  }

  return { state, executedIds, changedIds };
}
