import { appendFile, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";

export const RUN_LOG_FILE = "curation.jsonl";

export type RunLogEventType =
  | "extraction"
  | "drafting"
  | "validation"
  | "approval"
  | "rejection"
  | "duplicate_warning";

export type RunLogRecord = {
  eventType: RunLogEventType;
  timestamp: string;
  status: string;
  message: string;
  refs?: Record<string, unknown>;
};

export type RunLogOptions = {
  rootDir?: string;
  now?: () => Date;
};

function curationRoot(rootDir = process.cwd()) {
  return join(rootDir, ".curation");
}

export function runLogPath(options: RunLogOptions = {}) {
  return join(curationRoot(options.rootDir), "run-logs", RUN_LOG_FILE);
}

export async function appendRunLog(
  record: Omit<RunLogRecord, "timestamp"> & { timestamp?: string },
  options: RunLogOptions = {}
): Promise<RunLogRecord> {
  const timestamp = record.timestamp ?? (options.now?.() ?? new Date()).toISOString();
  const logRecord: RunLogRecord = {
    eventType: record.eventType,
    timestamp,
    status: record.status,
    message: record.message,
    ...(record.refs ? { refs: record.refs } : {})
  };
  const filePath = runLogPath(options);
  await mkdir(join(curationRoot(options.rootDir), "run-logs"), { recursive: true });
  await appendFile(filePath, `${JSON.stringify(logRecord)}\n`, "utf8");
  return logRecord;
}

export async function readRunLog(options: RunLogOptions = {}): Promise<RunLogRecord[]> {
  let raw;
  try {
    raw = await readFile(runLogPath(options), "utf8");
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }

  return raw
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as RunLogRecord);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
