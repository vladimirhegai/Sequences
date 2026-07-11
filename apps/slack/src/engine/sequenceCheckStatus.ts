export type SequenceCheckStatus = "pass" | "warn" | "fail";

export interface SequenceCheckStatusInput {
  direct?: { validation?: { ok?: boolean; motionWarnings?: string[] } };
  result: {
    authoringMode: string;
    thumbnailPaths: Array<{ exists: boolean; bytes: number }>;
    fallback?: unknown;
    stages?: Array<{ attempts?: number }>;
    sentinelDisposition?: string | null;
    sentinelDegradations?: string[];
  };
  checks?: { qaWarningCount?: number | null };
  artifacts: { mp4?: { exists: boolean; bytes: number } | null };
  options: { render: boolean };
}

/** Honest CLI/probe summary; this does not change any production gate. */
export function summarizeSequenceCheckStatus(
  report: SequenceCheckStatusInput,
): SequenceCheckStatus {
  if (report.direct?.validation?.ok === false) return "fail";
  if (report.result.thumbnailPaths.some((thumb) => !thumb.exists || thumb.bytes <= 0)) return "fail";
  if (report.options.render && (!report.artifacts.mp4?.exists || report.artifacts.mp4.bytes <= 0)) {
    return "fail";
  }
  if (report.result.authoringMode === "deterministic-fallback") return "warn";
  if (report.result.fallback) return "warn";
  if (report.result.sentinelDisposition && report.result.sentinelDisposition !== "published") {
    return "warn";
  }
  if ((report.result.sentinelDegradations?.length ?? 0) > 0) return "warn";
  if (report.result.stages?.some((stage) => (stage.attempts ?? 1) > 1)) return "warn";
  if ((report.direct?.validation?.motionWarnings?.length ?? 0) > 0) return "warn";
  if ((report.checks?.qaWarningCount ?? 0) > 0) return "warn";
  return "pass";
}
