import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, extname, join, relative } from "node:path";

import { loadApprovedEvents } from "@mind-wiki/core/content";
import {
  discoveryRecordSchema,
  pipelineRunSchema,
  skillReviewRecordSchema,
  sourcePackSchema,
  type DiscoveryRecord,
  type PipelineRun,
  type SkillReviewRecord,
  type SourcePack
} from "@mind-wiki/core/schema";

import {
  appendRunLog,
  type RunLogEventType,
  type RunLogOptions,
  type RunLogRecord
} from "./run-log";

export const curationAreaDirs = [
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
  "skill-reviews"
] as const;

export type CurationArea = (typeof curationAreaDirs)[number];

export type StoreOptions = RunLogOptions;

export type WriteJsonRecordOptions = StoreOptions & {
  logEvent?: RunLogEventType;
};

export type CurationDirs = {
  rootDir: string;
  areas: Record<CurationArea, string>;
};

export type CurationRecord<T = unknown> = {
  area: CurationArea;
  id: string;
  data: T;
  filePath: string;
  relativePath: string;
};

export type ApproveDraftOptions = StoreOptions & {
  approvedMdx: string;
  filename: string;
};

export function resolveCurationRoot(rootDir = process.cwd()) {
  return join(rootDir, ".curation");
}

export async function ensureCurationDirs(rootDir = process.cwd()): Promise<CurationDirs> {
  const curationRoot = resolveCurationRoot(rootDir);
  const areas = Object.fromEntries(
    curationAreaDirs.map((area) => [area, join(curationRoot, area)])
  ) as Record<CurationArea, string>;

  await Promise.all(Object.values(areas).map((dir) => mkdir(dir, { recursive: true })));

  return {
    rootDir: curationRoot,
    areas
  };
}

export async function writeJsonRecord<T>(
  area: CurationArea,
  id: string,
  data: T,
  options: WriteJsonRecordOptions = {}
): Promise<CurationRecord<T>> {
  const filePath = await recordPath(area, id, options);
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  const record = recordResult(area, id, data, filePath, options.rootDir);

  if (options.logEvent) {
    await appendRunLog(
      {
        eventType: options.logEvent,
        status: options.logEvent === "duplicate_warning" ? "warning" : "success",
        message: `Wrote ${area} record ${id}`,
        refs: {
          area,
          id,
          path: record.relativePath
        }
      },
      options
    );
  }

  return record;
}

export function writeDraftRecord<T>(id: string, data: T, options: StoreOptions = {}) {
  return writeJsonRecord("drafts", id, data, { ...options, logEvent: "drafting" });
}

export function writeQualityReport<T>(id: string, data: T, options: StoreOptions = {}) {
  return writeJsonRecord("quality-reports", id, data, options);
}

export async function inspectCurationRecord<T = unknown>(
  area: CurationArea,
  id: string,
  options: StoreOptions = {}
): Promise<CurationRecord<T>> {
  const filePath = await recordPath(area, id, options);
  const raw = await readFile(filePath, "utf8");
  return recordResult(area, id, JSON.parse(raw) as T, filePath, options.rootDir);
}

export async function readCurationRecords<T = unknown>(
  area: CurationArea,
  options: StoreOptions = {}
): Promise<CurationRecord<T>[]> {
  const dirs = await ensureCurationDirs(options.rootDir);
  const entries = await readdir(dirs.areas[area], { withFileTypes: true });
  const records = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json") && !entry.name.startsWith("._"))
      .map((entry) => inspectCurationRecord<T>(area, basename(entry.name, ".json"), options))
  );

  return records.sort((a, b) => a.id.localeCompare(b.id));
}

export function writeSourcePack(id: string, data: SourcePack, options: StoreOptions = {}) {
  return writeJsonRecord("source-packs", id, sourcePackSchema.parse(data), options);
}

export function writeDiscoveryRecord(id: string, data: DiscoveryRecord, options: StoreOptions = {}) {
  return writeJsonRecord("discovery-records", id, discoveryRecordSchema.parse(data), options);
}

export function writePipelineRun(id: string, data: PipelineRun, options: StoreOptions = {}) {
  return writeJsonRecord("pipeline-runs", id, pipelineRunSchema.parse(data), options);
}

export function writeSkillReviewRecord(id: string, data: SkillReviewRecord, options: StoreOptions = {}) {
  return writeJsonRecord("skill-reviews", id, skillReviewRecordSchema.parse(data), options);
}

export async function rejectDraft(
  id: string,
  reason: string,
  options: StoreOptions = {}
): Promise<CurationRecord<Record<string, unknown>>> {
  if (!reason.trim()) {
    throw new Error("Rejection reason is required");
  }

  const draft = await readDraftData(id, options);
  const rejectedData = {
    ...objectRecord(draft.data),
    state: "rejected",
    rejection_reason: reason,
    rejected_at: (options.now?.() ?? new Date()).toISOString()
  };
  const rejected = await writeJsonRecord("rejected", id, rejectedData, options);

  await appendRunLog(
    {
      eventType: "rejection",
      status: "success",
      message: `Rejected draft ${id}`,
      refs: {
        draftId: id,
        reason,
        rejectedPath: rejected.relativePath
      }
    },
    options
  );

  return rejected;
}

export async function retryDraft(
  id: string,
  reason = "retry requested",
  options: StoreOptions = {}
): Promise<RunLogRecord> {
  await readDraftData(id, options);

  return appendRunLog(
    {
      eventType: "drafting",
      status: "retry_requested",
      message: `Retry requested for draft ${id}`,
      refs: {
        draftId: id,
        reason
      }
    },
    options
  );
}

export async function approveDraft(
  id: string,
  options: ApproveDraftOptions
): Promise<{ filePath: string; relativePath: string }> {
  if (id.endsWith(".retry")) {
    throw new Error("Retry records cannot be approved");
  }

  await readDraftData(id, options);
  assertSafeApprovedFilename(options.filename);

  if (!options.approvedMdx.trim()) {
    throw new Error("Approved MDX payload is required");
  }

  const rootDir = options.rootDir ?? process.cwd();
  await validateApprovedEventMdx(options.filename, options.approvedMdx);

  const approvedDir = join(rootDir, "content", "approved", "events");
  await mkdir(approvedDir, { recursive: true });

  const filePath = join(approvedDir, options.filename);
  try {
    await writeFile(filePath, options.approvedMdx, { encoding: "utf8", flag: "wx" });
  } catch (error) {
    if (isNodeError(error) && error.code === "EEXIST") {
      throw new Error(`Approved event file already exists: ${normalizeRelative(rootDir, filePath)}`);
    }
    throw error;
  }
  const relativePath = normalizeRelative(rootDir, filePath);

  await appendRunLog(
    {
      eventType: "approval",
      status: "success",
      message: `Approved draft ${id}`,
      refs: {
        draftId: id,
        approvedPath: relativePath
      }
    },
    options
  );

  return {
    filePath,
    relativePath
  };
}

async function validateApprovedEventMdx(filename: string, approvedMdx: string) {
  const tempRoot = await mkdtemp(join(tmpdir(), "mind-wiki-approval-"));
  try {
    const eventDir = join(tempRoot, "content", "approved", "events");
    await mkdir(eventDir, { recursive: true });
    await writeFile(join(eventDir, filename), approvedMdx, "utf8");
    await loadApprovedEvents({ rootDir: tempRoot });
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Approved MDX did not validate: ${error.message}`);
    }
    throw error;
  } finally {
    await rm(tempRoot, { force: true, recursive: true });
  }
}

async function readDraftData(id: string, options: StoreOptions) {
  try {
    return await inspectCurationRecord("drafts", id, options);
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      throw new Error(`Draft ${id} was not found`);
    }
    throw error;
  }
}

async function recordPath(area: CurationArea, id: string, options: StoreOptions) {
  assertCurationArea(area);
  assertSafeId(id);
  const dirs = await ensureCurationDirs(options.rootDir);
  return join(dirs.areas[area], `${id}.json`);
}

function recordResult<T>(
  area: CurationArea,
  id: string,
  data: T,
  filePath: string,
  rootDir = process.cwd()
): CurationRecord<T> {
  return {
    area,
    id,
    data,
    filePath,
    relativePath: normalizeRelative(rootDir, filePath)
  };
}

function assertCurationArea(area: string): asserts area is CurationArea {
  if (!curationAreaDirs.includes(area as CurationArea)) {
    throw new Error(`Unknown curation area: ${area}`);
  }
}

function assertSafeId(id: string) {
  if (!/^[a-zA-Z0-9._-]+$/.test(id) || id === "." || id === "..") {
    throw new Error(`Unsafe curation record id: ${id}`);
  }
}

function assertSafeApprovedFilename(filename: string) {
  const extension = extname(filename);
  if (
    filename !== basename(filename) ||
    filename.startsWith(".") ||
    ![".md", ".mdx"].includes(extension)
  ) {
    throw new Error(`Unsafe approved event filename: ${filename}`);
  }
}

function objectRecord(value: unknown): Record<string, unknown> {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return { value };
}

function normalizeRelative(rootDir: string, filePath: string) {
  return relative(rootDir, filePath).replaceAll("\\", "/");
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
