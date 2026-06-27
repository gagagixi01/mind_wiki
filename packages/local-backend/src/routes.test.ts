import { mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  getPipelineStatus,
  inspectCurationRecord,
  writeDiscoveryRecord,
  writeSourcePack
} from "@mind-wiki/curation";
import type { DiscoveryRecord, PipelineRun } from "@mind-wiki/core/schema";

import { handleApiRequest } from "./routes";

const workbenchOrigin = "http://127.0.0.1:3000";

async function makeRoot() {
  const rootDir = await mkdtemp(join(tmpdir(), "mind-wiki-api-"));
  await mkdir(join(rootDir, "content", "approved", "events"), { recursive: true });
  return rootDir;
}

function discoveryRecord(overrides: Partial<DiscoveryRecord> = {}): DiscoveryRecord {
  return {
    id: "disc-provider",
    run_id: "run-a",
    source_pack_id: "provider-blogs",
    discovered_url: "https://openai.com/news/release",
    normalized_url: "https://openai.com/news/release",
    title: "Provider release",
    discovery_method: "rss",
    reason_found: "Matched RSS.",
    source_type: "provider_blog",
    trajectory_classification: ["provider_releases"],
    duplicate_status: "new",
    confidence: "observed",
    status: "discovered",
    errors: [],
    created_at: "2026-06-25T00:00:00.000Z",
    updated_at: "2026-06-25T00:00:00.000Z",
    ...overrides
  };
}

async function seedDiscoveryRecords(rootDir: string) {
  await writeDiscoveryRecord("disc-provider", discoveryRecord(), { rootDir });
  await writeDiscoveryRecord(
    "disc-arch",
    discoveryRecord({
      id: "disc-arch",
      run_id: "run-b",
      source_pack_id: "papers",
      discovered_url: "https://arxiv.org/abs/2606.00001",
      normalized_url: "https://arxiv.org/abs/2606.00001",
      title: "Architecture paper",
      discovery_method: "web_search",
      source_type: "paper",
      trajectory_classification: ["llm_architecture"],
      duplicate_status: "same_event",
      status: "ready-for-review"
    }),
    { rootDir }
  );
  await writeDiscoveryRecord(
    "disc-multi",
    discoveryRecord({
      id: "disc-multi",
      run_id: "run-b",
      source_pack_id: "provider-blogs",
      discovered_url: "https://example.com/multimodal",
      normalized_url: "https://example.com/multimodal",
      title: "Multimodal update",
      trajectory_classification: ["multimodal_architecture"],
      duplicate_status: "ignored",
      status: "failed"
    }),
    { rootDir }
  );
}

async function discoveryIds(rootDir: string, query = "") {
  const response = await handleApiRequest(
    new Request(`http://127.0.0.1:8001/api/discovery-records${query}`),
    { rootDir }
  );
  const body = await response.json() as Array<{ id: string }>;
  return { response, ids: body.map((record) => record.id) };
}

describe("local backend routes", () => {
  it("returns status without secrets", async () => {
    process.env.OPENAI_API_KEY = "secret-key";
    const response = await handleApiRequest(new Request("http://127.0.0.1:8001/api/pipeline/status"), {
      rootDir: await makeRoot(),
      now: () => new Date("2026-06-25T00:00:00.000Z")
    });
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain("visibleStage");
    expect(body).not.toContain("secret-key");
  });

  it("adds CORS headers to successful browser responses", async () => {
    const response = await handleApiRequest(
      new Request("http://127.0.0.1:8001/api/pipeline/status", {
        headers: { origin: workbenchOrigin }
      }),
      {
        rootDir: await makeRoot(),
        now: () => new Date("2026-06-25T00:00:00.000Z")
      }
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe(workbenchOrigin);
  });

  it("handles discovery preflight requests", async () => {
    const response = await handleApiRequest(
      new Request("http://127.0.0.1:8001/api/pipeline/discovery/run", {
        method: "OPTIONS",
        headers: {
          origin: workbenchOrigin,
          "access-control-request-method": "POST",
          "access-control-request-headers": "content-type"
        }
      }),
      {
        rootDir: await makeRoot()
      }
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe(workbenchOrigin);
    expect(response.headers.get("access-control-allow-methods")).toBe("GET, POST, OPTIONS");
    expect(response.headers.get("access-control-allow-headers")).toContain("content-type");
  });

  it("rejects discovery runs from disallowed origins before invoking the runner", async () => {
    const runner = vi.fn().mockResolvedValue({ outputRefs: [], exitCode: 0 });
    const response = await handleApiRequest(
      new Request("http://127.0.0.1:8001/api/pipeline/discovery/run", {
        method: "POST",
        headers: {
          origin: "http://evil.example"
        }
      }),
      {
        rootDir: await makeRoot(),
        now: () => new Date("2026-06-25T00:00:00.000Z"),
        runner
      }
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "forbidden" });
    expect(runner).not.toHaveBeenCalled();
  });

  it("rejects discovery runs marked as cross-site fetches", async () => {
    const runner = vi.fn().mockResolvedValue({ outputRefs: [], exitCode: 0 });
    const response = await handleApiRequest(
      new Request("http://127.0.0.1:8001/api/pipeline/discovery/run", {
        method: "POST",
        headers: {
          origin: workbenchOrigin,
          "sec-fetch-site": "cross-site"
        }
      }),
      {
        rootDir: await makeRoot(),
        now: () => new Date("2026-06-25T00:00:00.000Z"),
        runner
      }
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "forbidden" });
    expect(runner).not.toHaveBeenCalled();
  });

  it("allows originless discovery runs through the injected runner", async () => {
    const runner = vi.fn().mockResolvedValue({ outputRefs: [], exitCode: 0 });
    const response = await handleApiRequest(
      new Request("http://127.0.0.1:8001/api/pipeline/discovery/run", { method: "POST" }),
      {
        rootDir: await makeRoot(),
        now: () => new Date("2026-06-25T00:00:00.000Z"),
        runner
      }
    );

    expect(response.status).toBe(202);
    expect(runner).toHaveBeenCalledWith(expect.objectContaining({ skillName: "ai-weekly-discovery" }));
  });

  it("marks successful discovery runs as completed with output refs", async () => {
    const rootDir = await makeRoot();
    const runner = vi.fn().mockResolvedValue({
      outputRefs: [".curation/agent-outputs/run-1/stdout.txt"],
      exitCode: 0
    });

    const response = await handleApiRequest(
      new Request("http://127.0.0.1:8001/api/pipeline/discovery/run", { method: "POST" }),
      {
        rootDir,
        now: () => new Date("2026-06-25T00:00:00.000Z"),
        runner
      }
    );
    const { run } = await response.json() as { run: PipelineRun };
    const record = await inspectCurationRecord<PipelineRun>("pipeline-runs", run.id, { rootDir });
    const status = await getPipelineStatus({
      rootDir,
      now: () => new Date("2026-06-25T00:01:00.000Z")
    });

    expect(record.data.status).toBe("succeeded");
    expect(record.data.stage).toBe("discovered");
    expect(record.data.ended_at).toBe("2026-06-25T00:00:00.000Z");
    expect(record.data.output_refs).toEqual([".curation/agent-outputs/run-1/stdout.txt"]);
    expect(status.activeRun).toBeUndefined();
  });

  it("marks failed discovery runs with a named error", async () => {
    const rootDir = await makeRoot();
    const runner = vi.fn().mockRejectedValue(new Error("codex_cli_unavailable: codex was not found"));

    const response = await handleApiRequest(
      new Request("http://127.0.0.1:8001/api/pipeline/discovery/run", { method: "POST" }),
      {
        rootDir,
        now: () => new Date("2026-06-25T00:00:00.000Z"),
        runner
      }
    );
    const { run } = await response.json() as { run: PipelineRun };
    const record = await inspectCurationRecord<PipelineRun>("pipeline-runs", run.id, { rootDir });
    const status = await getPipelineStatus({
      rootDir,
      now: () => new Date("2026-06-25T00:01:00.000Z")
    });

    expect(response.status).toBe(500);
    expect(record.data.status).toBe("failed");
    expect(record.data.stage).toBe("failed");
    expect(record.data.error?.code).toBe("codex_cli_unavailable");
    expect(record.data.error?.message_zh).toBe("Codex CLI 不可用。");
    expect(status.activeRun).toBeUndefined();
  });

  it("marks model API authentication failures separately", async () => {
    const rootDir = await makeRoot();
    const runner = vi.fn().mockRejectedValue(
      new Error("unexpected status 401 Unauthorized: Missing bearer or basic authentication in header, url: https://api.openai.com/v1/responses")
    );

    const response = await handleApiRequest(
      new Request("http://127.0.0.1:8001/api/pipeline/discovery/run", { method: "POST" }),
      {
        rootDir,
        now: () => new Date("2026-06-25T00:00:00.000Z"),
        runner
      }
    );
    const { run } = await response.json() as { run: PipelineRun };
    const record = await inspectCurationRecord<PipelineRun>("pipeline-runs", run.id, { rootDir });

    expect(response.status).toBe(500);
    expect(record.data.error?.code).toBe("model_api_failure");
    expect(record.data.error?.message_zh).toBe("模型 API 调用失败。");
  });

  it("lists and toggles source packs", async () => {
    const rootDir = await makeRoot();
    await writeSourcePack(
      "provider-blogs",
      {
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
      },
      { rootDir }
    );

    const listResponse = await handleApiRequest(new Request("http://127.0.0.1:8001/api/source-packs"), {
      rootDir
    });
    expect(await listResponse.text()).toContain("provider-blogs");

    const toggleResponse = await handleApiRequest(
      new Request("http://127.0.0.1:8001/api/source-packs/provider-blogs/disable", { method: "POST" }),
      { rootDir, now: () => new Date("2026-06-25T01:00:00.000Z") }
    );
    const body = await toggleResponse.text();
    expect(toggleResponse.status).toBe(200);
    expect(body).toContain('"enabled": false');
  });

  it.each([
    ["run_id", "run-a", ["disc-provider"]],
    ["source_pack_id", "papers", ["disc-arch"]],
    ["discovery_method", "web_search", ["disc-arch"]],
    ["trajectory", "multimodal_architecture", ["disc-multi"]],
    ["duplicate_status", "same_event", ["disc-arch"]],
    ["status", "ready-for-review", ["disc-arch"]]
  ])("filters discovery records by %s", async (key, value, expectedIds) => {
    const rootDir = await makeRoot();
    await seedDiscoveryRecords(rootDir);

    const { response, ids } = await discoveryIds(rootDir, `?${key}=${value}`);

    expect(response.status).toBe(200);
    expect(ids).toEqual(expectedIds);
  });

  it("ignores unknown discovery record query params", async () => {
    const rootDir = await makeRoot();
    await seedDiscoveryRecords(rootDir);

    const { response, ids } = await discoveryIds(rootDir, "?unknown=value");

    expect(response.status).toBe(200);
    expect(ids).toEqual(["disc-arch", "disc-multi", "disc-provider"]);
  });

  it("rejects invalid discovery record enum filters", async () => {
    const rootDir = await makeRoot();
    await seedDiscoveryRecords(rootDir);

    const response = await handleApiRequest(
      new Request("http://127.0.0.1:8001/api/discovery-records?discovery_method=browser", {
        headers: { origin: workbenchOrigin }
      }),
      { rootDir }
    );

    expect(response.status).toBe(400);
    expect(response.headers.get("access-control-allow-origin")).toBe(workbenchOrigin);
    await expect(response.json()).resolves.toEqual({
      error: "invalid_discovery_method_filter"
    });
  });
});
