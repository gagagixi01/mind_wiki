import { mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { getPipelineStatus, startDiscoveryRunRecord } from "./pipeline";
import { writeDiscoveryRecord, writePipelineRun, writeSourcePack } from "./store";

async function makeWorkspaceRoot() {
  const root = await mkdtemp(join(tmpdir(), "mind-wiki-pipeline-"));
  await mkdir(join(root, "content", "approved", "events"), { recursive: true });
  return root;
}

describe("pipeline status", () => {
  it("summarizes idle state with zero counts", async () => {
    const rootDir = await makeWorkspaceRoot();

    const status = await getPipelineStatus({
      rootDir,
      now: () => new Date("2026-06-25T00:00:00.000Z")
    });

    expect(status.visibleStage).toBe("idle");
    expect(status.counts.candidates).toBe(0);
    expect(status.counts.sourcePacks).toBe(0);
    expect(status.stale).toBe(false);
  });

  it("summarizes active runs and record counts", async () => {
    const rootDir = await makeWorkspaceRoot();
    await writeSourcePack("provider-blogs", {
      id: "provider-blogs",
      name: "Provider Blogs",
      enabled: true,
      rss_feeds: ["https://openai.com/news/rss.xml"],
      web_search_queries: ["site:openai.com AI release"],
      source_type: "provider_blog",
      trajectory_hints: ["provider_releases"],
      cadence: "manual",
      trusted_domains: ["openai.com"],
      excluded_domains: [],
      dedupe_strategy: "normalized_url",
      notes: "Official feeds.",
      created_at: "2026-06-25T00:00:00.000Z",
      updated_at: "2026-06-25T00:00:00.000Z"
    }, { rootDir });
    await writePipelineRun("run-1", {
      id: "run-1",
      type: "discovery",
      status: "running",
      stage: "discovering",
      trigger: "manual_workbench",
      skill_name: "ai-weekly-discovery",
      started_at: "2026-06-25T00:00:00.000Z",
      input_summary: "Manual discovery.",
      output_refs: []
    }, { rootDir });
    await writeDiscoveryRecord("disc-1", {
      id: "disc-1",
      run_id: "run-1",
      source_pack_id: "provider-blogs",
      discovered_url: "https://openai.com/news/release",
      normalized_url: "https://openai.com/news/release",
      title: "Release",
      discovery_method: "rss",
      reason_found: "Matched RSS.",
      source_type: "provider_blog",
      trajectory_classification: ["provider_releases"],
      duplicate_status: "new",
      confidence: "observed",
      status: "ready-for-review",
      errors: [],
      created_at: "2026-06-25T00:00:00.000Z",
      updated_at: "2026-06-25T00:00:00.000Z"
    }, { rootDir });

    const status = await getPipelineStatus({
      rootDir,
      now: () => new Date("2026-06-25T00:10:00.000Z")
    });

    expect(status.activeRun?.id).toBe("run-1");
    expect(status.visibleStage).toBe("discovering");
    expect(status.counts).toMatchObject({
      candidates: 1,
      readyForReview: 1,
      sourcePacks: 1
    });
  });

  it("prevents duplicate active discovery runs", async () => {
    const rootDir = await makeWorkspaceRoot();
    await startDiscoveryRunRecord({
      rootDir,
      now: () => new Date("2026-06-25T00:00:00.000Z")
    });

    await expect(startDiscoveryRunRecord({
      rootDir,
      now: () => new Date("2026-06-25T00:01:00.000Z")
    })).rejects.toThrow(/active_run_exists/);
  });
});
