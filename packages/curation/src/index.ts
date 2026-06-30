export const CURATION_STATE_DIR = ".curation";

const localOnlyPrefixes = [
  ".curation/",
  "curation/",
  "runs/",
  "artifacts/",
  "raw/",
  "drafts/",
  "invalid/",
  "rejected/",
  "quality-reports/",
  "run-logs/",
  "source-packs/",
  "discovery-records/",
  "pipeline-runs/",
  "agent-outputs/",
  "skill-reviews/",
  "logs/"
] as const;

const localOnlyNames = [
  ".curation",
  "curation",
  "runs",
  "artifacts",
  "raw",
  "drafts",
  "invalid",
  "rejected",
  "quality-reports",
  "run-logs",
  "source-packs",
  "discovery-records",
  "pipeline-runs",
  "agent-outputs",
  "skill-reviews",
  "logs"
] as const;

export function isLocalOnlyPath(path: string) {
  const normalized = path.replaceAll("\\", "/").replace(/^\.\/+/, "");
  return (
    localOnlyNames.some((name) => normalized === name) ||
    localOnlyPrefixes.some((prefix) => normalized.startsWith(prefix))
  );
}

export * from "./run-log";
export * from "./store";
export * from "./extractors";
export * from "./draft";
export * from "./provider-settings";
export * from "./quality";
export * from "./queue";
export * from "./pipeline";
export * from "./skill-governance";
export * from "./codex-runner";
