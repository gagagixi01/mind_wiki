import { readFile } from "node:fs/promises";
import { join } from "node:path";

import {
  approveDraft,
  getPipelineStatus,
  inspectCurationRecord,
  readCurationRecords,
  readWorkbenchProviderSettingsSummary,
  readRunLog,
  rejectDraft,
  retryDraft,
  runCodexSkill,
  saveWorkbenchProviderSettings,
  startDiscoveryRunRecord,
  testWorkbenchProviderProfile,
  writePipelineRun,
  writeSourcePack,
  type CurationRecord
} from "@mind-wiki/curation";
import {
  discoveryMethods,
  duplicateStatuses,
  pipelineStates,
  trajectories,
  type DiscoveryRecord,
  type FailureCode,
  type PipelineFailure,
  type PipelineRun,
  type SourcePack
} from "@mind-wiki/core/schema";

const workbenchOrigin = "http://127.0.0.1:3000";

type DiscoveryRunPayload = {
  sourcePackIds?: string[];
};

type ScoredDiscoveryRecord = CurationRecord<DiscoveryRecord> & {
  value_score: number;
  value_reasons: string[];
};

export type RouteContext = {
  rootDir: string;
  now?: () => Date;
  runner?: typeof runCodexSkill;
};

function corsHeaders(request: Request, preflight = false): Record<string, string> {
  if (request.headers.get("origin") !== workbenchOrigin) {
    return {};
  }

  const headers: Record<string, string> = {
    "access-control-allow-origin": workbenchOrigin,
    vary: "Origin"
  };

  if (preflight) {
    headers["access-control-allow-methods"] = "GET, POST, OPTIONS";
    headers["access-control-allow-headers"] =
      request.headers.get("access-control-request-headers") ?? "content-type";
  }

  return headers;
}

function isProtectedApiRequest(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== workbenchOrigin) {
    return true;
  }

  return request.headers.get("sec-fetch-site") === "cross-site";
}

function createJson(request: Request) {
  return function json(data: unknown, init: ResponseInit = {}) {
    return new Response(`${JSON.stringify(data, null, 2)}\n`, {
      ...init,
      headers: {
        "content-type": "application/json; charset=utf-8",
        ...corsHeaders(request),
        ...(init.headers ?? {})
      }
    });
  };
}

async function toggleSourcePack(
  id: string,
  enabled: boolean,
  context: RouteContext
): Promise<CurationRecord<SourcePack>> {
  const record = await inspectCurationRecord<SourcePack>("source-packs", id, {
    rootDir: context.rootDir,
    now: context.now
  });
  const updated: SourcePack = {
    ...record.data,
    enabled,
    updated_at: (context.now?.() ?? new Date()).toISOString()
  };
  return writeSourcePack(id, updated, { rootDir: context.rootDir, now: context.now });
}

function failureFromError(error: unknown): PipelineFailure {
  const message = error instanceof Error ? error.message : String(error);
  const code = parseFailureCode(message);
  return {
    code,
    message_zh: failureMessageZh(code),
    suggested_next_action: failureSuggestedAction(code),
    diagnostic_ref: ".curation/agent-outputs/latest/status.json"
  };
}

function parseFailureCode(message: string): FailureCode {
  if (message.includes("skill_missing")) {
    return "skill_missing";
  }
  if (message.includes("command_timeout")) {
    return "command_timeout";
  }
  if (message.includes("codex_cli_unavailable")) {
    return "codex_cli_unavailable";
  }
  if (
    message.includes("model_api_failure") ||
    message.includes("api.openai.com/v1/responses") ||
    message.includes("401 Unauthorized") ||
    message.includes("Missing bearer or basic authentication")
  ) {
    return "model_api_failure";
  }
  return "malformed_ai_output";
}

function failureMessageZh(code: FailureCode) {
  switch (code) {
    case "codex_cli_unavailable":
      return "Codex CLI 不可用。";
    case "skill_missing":
      return "本地 Codex 技能缺失。";
    case "command_timeout":
      return "本地 Codex 运行超时。";
    case "model_api_failure":
      return "模型 API 调用失败。";
    default:
      return "本地发现流程运行失败。";
  }
}

function failureSuggestedAction(code: FailureCode) {
  switch (code) {
    case "codex_cli_unavailable":
      return "确认 Codex CLI 已安装并可在当前环境运行。";
    case "skill_missing":
      return "确认 repo-local 技能文件存在后重试。";
    case "command_timeout":
      return "检查本地网络、搜索和抽取服务后重试。";
    case "model_api_failure":
      return "检查本地 Codex CLI 认证、网络连通性和模型配置后重试。";
    default:
      return "查看本地诊断日志后重试。";
  }
}

async function finalizeDiscoveryRun(
  run: PipelineRun,
  update: Pick<PipelineRun, "status" | "stage" | "output_refs"> & { error?: PipelineFailure },
  context: RouteContext
) {
  const finished: PipelineRun = {
    ...run,
    status: update.status,
    stage: update.stage,
    ended_at: (context.now?.() ?? new Date()).toISOString(),
    output_refs: update.output_refs,
    ...(update.error ? { error: update.error } : {})
  };
  await writePipelineRun(run.id, finished, { rootDir: context.rootDir, now: context.now });
  return finished;
}

function enumFilterError(
  url: URL,
  key: string,
  allowedValues: readonly string[],
  json: (data: unknown, init?: ResponseInit) => Response
): Response | undefined {
  const value = url.searchParams.get(key);
  if (value && !allowedValues.includes(value)) {
    return json({ error: `invalid_${key}_filter` }, { status: 400 });
  }
  return undefined;
}

function filterDiscoveryRecords(
  records: CurationRecord<DiscoveryRecord>[],
  url: URL
) {
  const runId = url.searchParams.get("run_id");
  const sourcePackId = url.searchParams.get("source_pack_id");
  const discoveryMethod = url.searchParams.get("discovery_method");
  const trajectory = url.searchParams.get("trajectory");
  const duplicateStatus = url.searchParams.get("duplicate_status");
  const status = url.searchParams.get("status");

  return records.filter((record) => {
    const data = record.data;
    return (
      (!runId || data.run_id === runId) &&
      (!sourcePackId || data.source_pack_id === sourcePackId) &&
      (!discoveryMethod || data.discovery_method === discoveryMethod) &&
      (!trajectory || data.trajectory_classification.includes(trajectory as DiscoveryRecord["trajectory_classification"][number])) &&
      (!duplicateStatus || data.duplicate_status === duplicateStatus) &&
      (!status || data.status === status)
    );
  });
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, value));
}

function scoreDiscoveryRecord(record: CurationRecord<DiscoveryRecord>): ScoredDiscoveryRecord {
  const data = record.data;
  const reasons: string[] = [];
  let score = 0;

  if (data.status === "discovered" || data.status === "ready-for-review") {
    score += 45;
    reasons.push("usable discovery status");
  } else if (data.status === "failed") {
    score -= 25;
    reasons.push("failed record");
  } else {
    score += 20;
    reasons.push("intermediate status");
  }

  if (data.duplicate_status === "new") {
    score += 20;
    reasons.push("new source");
  } else if (data.duplicate_status === "same_url" || data.duplicate_status === "same_event") {
    score += 5;
    reasons.push("duplicate signal");
  } else if (data.duplicate_status === "ignored") {
    score -= 20;
    reasons.push("ignored duplicate");
  }

  if (data.confidence === "observed") {
    score += 15;
    reasons.push("observed confidence");
  } else if (data.confidence === "likely") {
    score += 8;
    reasons.push("likely confidence");
  } else {
    score += 2;
    reasons.push("speculative confidence");
  }

  if (["provider-labs", "infra-commercial", "china-ai-watch"].includes(data.source_pack_id)) {
    score += 15;
    reasons.push("high-signal source pack");
  } else if (["research-feeds", "market-news-watch"].includes(data.source_pack_id)) {
    score += 5;
    reasons.push("broad monitoring source pack");
  }

  if (data.source_type === "provider_blog" || data.source_type === "infra") {
    score += 10;
    reasons.push("primary or infrastructure source");
  } else if (data.source_type === "paper" || data.source_type === "business") {
    score += 6;
    reasons.push("research or commercial source");
  } else if (data.source_type === "news") {
    score += 3;
    reasons.push("news source");
  }

  if (data.trajectory_classification.includes("provider_releases")) {
    score += 5;
    reasons.push("provider release trajectory");
  }
  if (data.trajectory_classification.includes("commercial_forces")) {
    score += 5;
    reasons.push("commercial force trajectory");
  }
  if (
    data.trajectory_classification.includes("llm_architecture") ||
    data.trajectory_classification.includes("multimodal_architecture")
  ) {
    score += 5;
    reasons.push("technical trajectory");
  }

  const keywordText = `${data.title} ${data.reason_found} ${data.errors.join(" ")}`.toLowerCase();
  const keywordBoosts: Array<[string, number, string]> = [
    ["model release", 8, "model release signal"],
    ["frontier", 6, "frontier model signal"],
    ["agent", 6, "agent signal"],
    ["benchmark", 6, "benchmark signal"],
    ["inference", 6, "inference signal"],
    ["chip", 6, "chip signal"],
    ["gpu", 6, "gpu signal"],
    ["datacenter", 6, "datacenter signal"],
    ["data center", 6, "datacenter signal"],
    ["multimodal", 6, "multimodal signal"],
    ["database", 5, "database signal"],
    ["release", 4, "release signal"],
    ["supply", 4, "supply-chain signal"]
  ];
  for (const [keyword, boost, reason] of keywordBoosts) {
    if (keywordText.includes(keyword)) {
      score += boost;
      if (!reasons.includes(reason)) {
        reasons.push(reason);
      }
    }
  }

  if (data.errors.some((error) => error.includes("search_provider_unavailable"))) {
    score -= 30;
    reasons.push("search provider unavailable");
  }

  return {
    ...record,
    value_score: clampScore(score),
    value_reasons: reasons
  };
}

function invalidNumberFilter(
  url: URL,
  key: "limit" | "min_value_score",
  json: (data: unknown, init?: ResponseInit) => Response
): Response | undefined {
  const value = url.searchParams.get(key);
  if (!value) {
    return undefined;
  }
  const numberValue = Number(value);
  const invalidLimit = key === "limit" && (!Number.isInteger(numberValue) || numberValue < 1);
  const invalidMinimum =
    key === "min_value_score" && (!Number.isFinite(numberValue) || numberValue < 0 || numberValue > 100);
  if (invalidLimit || invalidMinimum) {
    return json({ error: `invalid_${key}_filter` }, { status: 400 });
  }
  return undefined;
}

function invalidSortFilter(url: URL, json: (data: unknown, init?: ResponseInit) => Response): Response | undefined {
  const value = url.searchParams.get("sort");
  if (value && value !== "value") {
    return json({ error: "invalid_sort_filter" }, { status: 400 });
  }
  return undefined;
}

function applyDiscoveryRecordRanking(records: CurationRecord<DiscoveryRecord>[], url: URL) {
  const scored = records.map(scoreDiscoveryRecord);
  const minimumScore = url.searchParams.get("min_value_score");
  const limit = url.searchParams.get("limit");
  const filteredByValue = minimumScore
    ? scored.filter((record) => record.value_score >= Number(minimumScore))
    : scored;

  const sorted =
    url.searchParams.get("sort") === "value"
      ? [...filteredByValue].sort((a, b) => {
          if (b.value_score !== a.value_score) {
            return b.value_score - a.value_score;
          }
          const createdComparison = b.data.created_at.localeCompare(a.data.created_at);
          return createdComparison === 0 ? a.id.localeCompare(b.id) : createdComparison;
        })
      : filteredByValue;

  return limit ? sorted.slice(0, Number(limit)) : sorted;
}

async function parseDiscoveryRunPayload(request: Request): Promise<DiscoveryRunPayload> {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return {};
  }

  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload !== "object") {
    return {};
  }

  const rawSourcePackIds = (payload as { sourcePackIds?: unknown }).sourcePackIds;
  if (rawSourcePackIds === undefined) {
    return {};
  }

  return {
    sourcePackIds: Array.isArray(rawSourcePackIds)
      ? rawSourcePackIds.filter((sourcePackId): sourcePackId is string => typeof sourcePackId === "string")
      : []
  };
}

async function invalidDiscoverySourcePackIds(sourcePackIds: string[] | undefined, context: RouteContext) {
  if (!sourcePackIds) {
    return [];
  }

  const records = await readCurationRecords<SourcePack>("source-packs", {
    rootDir: context.rootDir,
    now: context.now
  });
  const enabledIds = new Set(records.filter((record) => record.data.enabled).map((record) => record.id));
  return sourcePackIds.filter((sourcePackId) => !enabledIds.has(sourcePackId));
}

async function completeDiscoveryRunInBackground(
  run: PipelineRun,
  sourcePackIds: string[] | undefined,
  context: RouteContext
) {
  try {
    const result = await (context.runner ?? runCodexSkill)({
      runId: run.id,
      skillName: "ai-weekly-discovery",
      rootDir: context.rootDir,
      input: {
        run_id: run.id,
        ...(sourcePackIds ? { source_pack_ids: sourcePackIds } : {})
      },
      timeoutMs: 600000
    });
    await finalizeDiscoveryRun(
      run,
      {
        status: result.failure ? "failed" : "succeeded",
        stage: result.failure ? "failed" : "discovered",
        output_refs: result.outputRefs,
        ...(result.failure ? { error: result.failure } : {})
      },
      context
    );
  } catch (error) {
    await finalizeDiscoveryRun(
      run,
      {
        status: "failed",
        stage: "failed",
        output_refs: [],
        error: failureFromError(error)
      },
      context
    );
  }
}

async function readJsonFileIfPresent(filePath: string): Promise<Record<string, unknown> | null> {
  try {
    const parsed = JSON.parse(await readFile(filePath, "utf8")) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function numericValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function arrayValue(value: unknown) {
  return Array.isArray(value) ? value : [];
}

async function readDiscoveryRunSummary(runId: string, rootDir: string) {
  const outputDir = join(rootDir, ".curation", "agent-outputs", runId);
  const [status, summary, diagnostics] = await Promise.all([
    readJsonFileIfPresent(join(outputDir, "status.json")),
    readJsonFileIfPresent(join(outputDir, "discovery-summary.json")),
    readJsonFileIfPresent(join(outputDir, "diagnostics.json"))
  ]);

  const recordsWrittenRaw = summary?.records_written;
  const sourcePacksRaw = arrayValue(summary?.source_packs);
  const rssRaw = arrayValue(diagnostics?.rss);
  const webSearchRaw =
    diagnostics?.web_search && typeof diagnostics.web_search === "object" && !Array.isArray(diagnostics.web_search)
      ? diagnostics.web_search as Record<string, unknown>
      : {};
  const skippedQueries = arrayValue(webSearchRaw.skipped_queries);
  const configuredProvider =
    webSearchRaw.configured_provider === null ? null : stringValue(webSearchRaw.configured_provider);

  return {
    runId,
    status: status
      ? {
          exitCode: numericValue(status.exitCode),
          skillName: stringValue(status.skillName)
        }
      : null,
    recordsWritten: Array.isArray(recordsWrittenRaw)
      ? recordsWrittenRaw.length
      : numericValue(recordsWrittenRaw) ?? 0,
    sourcePacks: sourcePacksRaw
      .filter((sourcePack): sourcePack is Record<string, unknown> => sourcePack !== null && typeof sourcePack === "object" && !Array.isArray(sourcePack))
      .map((sourcePack) => ({
        sourcePackId: stringValue(sourcePack.source_pack_id),
        rssCandidates: numericValue(sourcePack.rss_candidates),
        rssWritten: numericValue(sourcePack.rss_written),
        webSearchQueries: numericValue(sourcePack.web_search_queries)
      })),
    rss: rssRaw
      .filter((entry): entry is Record<string, unknown> => entry !== null && typeof entry === "object" && !Array.isArray(entry))
      .map((entry) => ({
        sourcePackId: stringValue(entry.source_pack_id),
        feedUrl: stringValue(entry.feed_url),
        status: stringValue(entry.status),
        candidatesWritten: numericValue(entry.candidates_written),
        candidatesSkipped: numericValue(entry.candidates_skipped)
      })),
    webSearch: {
      configuredProvider,
      attempted: numericValue(webSearchRaw.attempted) ?? 0,
      skippedQueries: skippedQueries.length,
      webSearchSkipped: configuredProvider === null && skippedQueries.length > 0
    }
  };
}

export async function handleApiRequest(request: Request, context: RouteContext): Promise<Response> {
  const url = new URL(request.url);
  const options = { rootDir: context.rootDir, now: context.now };
  const json = createJson(request);

  if (url.pathname.startsWith("/api/") && isProtectedApiRequest(request)) {
    return json({ error: "forbidden" }, { status: 403 });
  }

  if (request.method === "OPTIONS" && url.pathname.startsWith("/api/")) {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(request, true)
    });
  }

  if (request.method === "GET" && url.pathname === "/api/pipeline/status") {
    return json(await getPipelineStatus(options));
  }

  if (request.method === "GET" && url.pathname === "/api/workbench/provider-settings") {
    return json(await readWorkbenchProviderSettingsSummary(options));
  }

  if (request.method === "POST" && url.pathname === "/api/workbench/provider-settings/save") {
    const payload = await request.json().catch(() => null);
    if (!payload || typeof payload !== "object") {
      return json({ error: "invalid_provider_settings_payload" }, { status: 400 });
    }

    try {
      await saveWorkbenchProviderSettings(
        {
          activeProfileId: String((payload as { activeProfileId?: string }).activeProfileId ?? "profile-1") as
            | "profile-1"
            | "profile-2"
            | "profile-3",
          profiles: Array.isArray((payload as { profiles?: unknown[] }).profiles)
            ? (payload as { profiles: Array<Record<string, unknown>> }).profiles.map((profile) => ({
                id: String(profile.id ?? "") as "profile-1" | "profile-2" | "profile-3",
                label: String(profile.label ?? ""),
                baseUrl: String(profile.baseUrl ?? ""),
                apiKey: String(profile.apiKey ?? ""),
                modelId: String(profile.modelId ?? "")
              }))
            : []
        },
        options
      );
    } catch (error) {
      return json(
        { error: error instanceof Error ? error.message : "invalid_provider_settings_payload" },
        { status: 400 }
      );
    }

    return json(await readWorkbenchProviderSettingsSummary(options));
  }

  if (request.method === "POST" && url.pathname === "/api/workbench/provider-settings/test") {
    const payload = await request.json().catch(() => null);
    if (!payload || typeof payload !== "object") {
      return json({ ok: false, status: 400, message: "No provider profile was supplied for testing." }, { status: 400 });
    }

    const result = await testWorkbenchProviderProfile(
      {
        profileId:
          typeof (payload as { profileId?: unknown }).profileId === "string"
            ? ((payload as { profileId: string }).profileId as "profile-1" | "profile-2" | "profile-3")
            : undefined,
        profile:
          payload &&
          typeof (payload as { profile?: unknown }).profile === "object" &&
          (payload as { profile?: unknown }).profile !== null
            ? {
                id: String(((payload as { profile: Record<string, unknown> }).profile.id ?? "")) as
                  | "profile-1"
                  | "profile-2"
                  | "profile-3",
                label: String((payload as { profile: Record<string, unknown> }).profile.label ?? ""),
                baseUrl: String((payload as { profile: Record<string, unknown> }).profile.baseUrl ?? ""),
                apiKey: String((payload as { profile: Record<string, unknown> }).profile.apiKey ?? ""),
                modelId: String((payload as { profile: Record<string, unknown> }).profile.modelId ?? "")
              }
            : undefined
      },
      options
    );

    return json(result, { status: result.ok ? 200 : result.status });
  }

  if (request.method === "POST" && url.pathname === "/api/pipeline/discovery/run") {
    try {
      const payload = await parseDiscoveryRunPayload(request);
      const invalidSourcePackIds = await invalidDiscoverySourcePackIds(payload.sourcePackIds, context);
      if (invalidSourcePackIds.length > 0) {
        return json(
          {
            error: "invalid_source_pack_scope",
            invalidSourcePackIds
          },
          { status: 400 }
        );
      }

      const run = await startDiscoveryRunRecord(options);
      void completeDiscoveryRunInBackground(run, payload.sourcePackIds, context);
      return json({ run }, { status: 202 });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return json({ error: message }, { status: message.includes("active_run_exists") ? 409 : 500 });
    }
  }

  if (request.method === "GET" && url.pathname === "/api/source-packs") {
    return json(await readCurationRecords<SourcePack>("source-packs", options));
  }

  const sourcePackToggleMatch = /^\/api\/source-packs\/([^/]+)\/(enable|disable)$/.exec(url.pathname);
  if (request.method === "POST" && sourcePackToggleMatch) {
    const id = sourcePackToggleMatch[1];
    const action = sourcePackToggleMatch[2];
    if (!id || !action) {
      return json({ error: "invalid_source_pack_request" }, { status: 400 });
    }
    return json(await toggleSourcePack(id, action === "enable", context));
  }

  if (request.method === "GET" && url.pathname === "/api/discovery-records") {
    const invalidFilter =
      enumFilterError(url, "discovery_method", discoveryMethods, json) ??
      enumFilterError(url, "trajectory", trajectories, json) ??
      enumFilterError(url, "duplicate_status", duplicateStatuses, json) ??
      enumFilterError(url, "status", pipelineStates, json) ??
      invalidSortFilter(url, json) ??
      invalidNumberFilter(url, "limit", json) ??
      invalidNumberFilter(url, "min_value_score", json);
    if (invalidFilter) {
      return invalidFilter;
    }
    return json(
      applyDiscoveryRecordRanking(
        filterDiscoveryRecords(
          await readCurationRecords<DiscoveryRecord>("discovery-records", options),
          url
        ),
        url
      )
    );
  }

  if (request.method === "GET" && url.pathname === "/api/drafts") {
    return json(await readCurationRecords("drafts", options));
  }

  const draftRecordMatch = /^\/api\/drafts\/([^/]+)$/.exec(url.pathname);
  if (request.method === "GET" && draftRecordMatch) {
    const draftId = draftRecordMatch[1];
    if (!draftId) {
      return json({ error: "invalid_draft_request" }, { status: 400 });
    }
    return json(
      await inspectCurationRecord("drafts", draftId, {
        rootDir: context.rootDir,
        now: context.now
      })
    );
  }

  const draftActionMatch = /^\/api\/drafts\/([^/]+)\/(approve|reject|retry)$/.exec(url.pathname);
  if (request.method === "POST" && draftActionMatch) {
    const draftId = draftActionMatch[1];
    const action = draftActionMatch[2];
    if (!draftId || !action) {
      return json({ error: "invalid_draft_request" }, { status: 400 });
    }
    const payload = await request.json().catch(() => ({}));
    if (action === "approve") {
      return json(
        await approveDraft(draftId, {
          ...options,
          filename: String(payload.filename),
          approvedMdx: String(payload.approvedMdx)
        })
      );
    }
    if (action === "reject") {
      return json(
        await rejectDraft(draftId, String(payload.reason ?? "Rejected from workbench."), options)
      );
    }
    return json(await retryDraft(draftId, String(payload.reason ?? "Retry requested from workbench."), options));
  }

  if (request.method === "GET" && url.pathname === "/api/pipeline/runs") {
    return json(await readCurationRecords<PipelineRun>("pipeline-runs", options));
  }

  const discoverySummaryMatch = /^\/api\/pipeline\/runs\/([^/]+)\/discovery-summary$/.exec(url.pathname);
  if (request.method === "GET" && discoverySummaryMatch) {
    const runId = discoverySummaryMatch[1];
    if (!runId) {
      return json({ error: "invalid_pipeline_run_request" }, { status: 400 });
    }
    return json(await readDiscoveryRunSummary(runId, context.rootDir));
  }

  const runRecordMatch = /^\/api\/pipeline\/runs\/([^/]+)$/.exec(url.pathname);
  if (request.method === "GET" && runRecordMatch) {
    const runId = runRecordMatch[1];
    if (!runId) {
      return json({ error: "invalid_pipeline_run_request" }, { status: 400 });
    }
    return json(
      await inspectCurationRecord<PipelineRun>("pipeline-runs", runId, {
        rootDir: context.rootDir,
        now: context.now
      })
    );
  }

  if (request.method === "GET" && url.pathname === "/api/run-logs") {
    return json(await readRunLog(options));
  }

  return json({ error: "not_found" }, { status: 404 });
}
