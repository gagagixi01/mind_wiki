import {
  approveDraft,
  getPipelineStatus,
  inspectCurationRecord,
  readCurationRecords,
  readRunLog,
  rejectDraft,
  retryDraft,
  runCodexSkill,
  startDiscoveryRunRecord,
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
      return "检查 OpenAI API 认证、网络连通性和模型配置后重试。";
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

export async function handleApiRequest(request: Request, context: RouteContext): Promise<Response> {
  const url = new URL(request.url);
  const options = { rootDir: context.rootDir, now: context.now };
  const json = createJson(request);

  if (request.method === "OPTIONS" && url.pathname.startsWith("/api/")) {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(request, true)
    });
  }

  if (request.method === "GET" && url.pathname === "/api/pipeline/status") {
    return json(await getPipelineStatus(options));
  }

  if (request.method === "POST" && url.pathname === "/api/pipeline/discovery/run") {
    let run: PipelineRun | undefined;
    try {
      run = await startDiscoveryRunRecord(options);
      const result = await (context.runner ?? runCodexSkill)({
        runId: run.id,
        skillName: "ai-weekly-discovery",
        rootDir: context.rootDir,
        input: { run_id: run.id },
        timeoutMs: 600000
      });
      const finished = await finalizeDiscoveryRun(
        run,
        {
          status: result.failure ? "failed" : "succeeded",
          stage: result.failure ? "failed" : "discovered",
          output_refs: result.outputRefs,
          ...(result.failure ? { error: result.failure } : {})
        },
        context
      );
      return json({ run: finished }, { status: result.failure ? 500 : 202 });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (run) {
        const finished = await finalizeDiscoveryRun(
          run,
          {
            status: "failed",
            stage: "failed",
            output_refs: [],
            error: failureFromError(error)
          },
          context
        );
        return json({ run: finished, error: message }, { status: 500 });
      }
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
      enumFilterError(url, "status", pipelineStates, json);
    if (invalidFilter) {
      return invalidFilter;
    }
    return json(filterDiscoveryRecords(
      await readCurationRecords<DiscoveryRecord>("discovery-records", options),
      url
    ));
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
