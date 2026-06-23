export const CURATION_STATE_DIR = ".curation";

const localOnlyPrefixes = [
  ".curation/",
  "curation/",
  "runs/",
  "artifacts/",
  "drafts/",
  "logs/"
] as const;

export function isLocalOnlyPath(path: string) {
  const normalized = path.replaceAll("\\", "/").replace(/^\.\/+/, "");
  return localOnlyPrefixes.some((prefix) => normalized.startsWith(prefix));
}
