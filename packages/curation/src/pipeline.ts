import type { DiscoveryRecord, PipelineRun, PipelineState, SourcePack } from "@mind-wiki/core/schema";

import { readCurationRecords, writePipelineRun, type StoreOptions } from "./store";

export type PipelineStatus = {
  activeRun?: PipelineRun;
  latestCompletedRun?: PipelineRun;
  stale: boolean;
  visibleStage: PipelineState;
  counts: {
    candidates: number;
    drafts: number;
    failures: number;
    readyForReview: number;
    sourcePacks: number;
  };
};

const staleAfterMs = 30 * 60 * 1000;

export async function getPipelineStatus(options: StoreOptions = {}): Promise<PipelineStatus> {
  const [runs, discoveryRecords, sourcePacks, drafts] = await Promise.all([
    readCurationRecords<PipelineRun>("pipeline-runs", options),
    readCurationRecords<DiscoveryRecord>("discovery-records", options),
    readCurationRecords<SourcePack>("source-packs", options),
    readCurationRecords<Record<string, unknown>>("drafts", options)
  ]);

  const sortedRuns = runs
    .map((record) => record.data)
    .sort((a, b) => b.started_at.localeCompare(a.started_at));
  const activeRun = sortedRuns.find((run) => run.status === "running");
  const latestCompletedRun = sortedRuns.find((run) => run.status !== "running");
  const statusTimestamp = activeRun?.started_at ?? latestCompletedRun?.ended_at ?? latestCompletedRun?.started_at;
  const now = options.now?.() ?? new Date();

  return {
    ...(activeRun ? { activeRun } : {}),
    ...(latestCompletedRun ? { latestCompletedRun } : {}),
    stale: statusTimestamp ? now.getTime() - new Date(statusTimestamp).getTime() > staleAfterMs : false,
    visibleStage: activeRun?.stage ?? latestCompletedRun?.stage ?? "idle",
    counts: {
      candidates: discoveryRecords.length,
      drafts: drafts.length,
      failures: sortedRuns.filter((run) => run.status === "failed").length,
      readyForReview: discoveryRecords.filter((record) => record.data.status === "ready-for-review").length,
      sourcePacks: sourcePacks.length
    }
  };
}

export async function startDiscoveryRunRecord(options: StoreOptions = {}): Promise<PipelineRun> {
  const status = await getPipelineStatus(options);
  if (status.activeRun?.type === "discovery") {
    throw new Error("active_run_exists: discovery run is already active");
  }

  const startedAt = (options.now?.() ?? new Date()).toISOString();
  const run: PipelineRun = {
    id: `run-${startedAt.replace(/[:.]/g, "-")}`,
    type: "discovery",
    status: "running",
    stage: "discovering",
    trigger: "manual_workbench",
    skill_name: "ai-weekly-discovery",
    started_at: startedAt,
    input_summary: "Manual discovery triggered from local workbench.",
    output_refs: []
  };

  await writePipelineRun(run.id, run, options);
  return run;
}
