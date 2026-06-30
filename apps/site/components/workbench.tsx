"use client";

import { useEffect, useState, type FormEvent } from "react";
import { APP_NAME } from "@mind-wiki/core";

import {
  Badge,
  Button,
  Card,
  Empty,
  Input,
  Progress,
  Select,
  Sheet,
  Skeleton,
  StatusToast,
  Textarea
} from "./workbench-primitives";

type QueueTone = "neutral" | "success" | "warning" | "danger" | "info";

type QueueItem = {
  id: string;
  source: string;
  stage: string;
  status: string;
  owner: string;
  detail: string;
  tone: QueueTone;
};

type DraftStatus = "待审阅草稿" | "已批准草稿" | "已拒绝草稿";

type PipelineStatus = {
  activeRun?: { id: string; stage: string; started_at: string };
  latestCompletedRun?: {
    id: string;
    stage: string;
    ended_at?: string;
    error?: { code?: string; message_zh: string; suggested_next_action: string; source_pack_id?: string };
  };
  stale: boolean;
  visibleStage: string;
  counts: {
    candidates: number;
    drafts: number;
    failures: number;
    readyForReview: number;
    sourcePacks: number;
  };
};

type DiscoveryRecord = {
  id: string;
  value_score?: number;
  value_reasons?: string[];
  data: {
    id: string;
    run_id: string;
    source_pack_id: string;
    discovered_url: string;
    normalized_url: string;
    canonical_url?: string;
    title: string;
    discovery_method: "rss" | "web_search";
    reason_found: string;
    source_type: string;
    trajectory_classification: string[];
    duplicate_status: string;
    confidence: "observed" | "likely" | "speculative";
    status: string;
    errors: string[];
    created_at: string;
    updated_at: string;
  };
};

type SourcePackRecord = {
  id: string;
  data: {
    id: string;
    name: string;
    enabled: boolean;
    rss_feeds: string[];
    web_search_queries: string[];
    source_type: string;
    trajectory_hints: string[];
    cadence: string;
    notes: string;
  };
};

type DiscoveryRunSummary = {
  runId: string;
  status: { exitCode?: number; skillName?: string } | null;
  recordsWritten: number;
  sourcePacks: Array<{
    sourcePackId?: string;
    rssCandidates?: number;
    rssWritten?: number;
    webSearchQueries?: number;
  }>;
  rss: Array<{
    sourcePackId?: string;
    feedUrl?: string;
    status?: string;
    candidatesWritten?: number;
    candidatesSkipped?: number;
  }>;
  webSearch: {
    configuredProvider?: string | null;
    attempted: number;
    skippedQueries: number;
    webSearchSkipped: boolean;
  };
};

type DiscoveryScopeMode = "quick" | "all" | "custom";
type DiscoveryCandidateView = "high-value" | "all" | "failures";

type ProviderProfileId = "profile-1" | "profile-2" | "profile-3";

type ProviderProfileSummary = {
  id: ProviderProfileId;
  label: string;
  baseUrl: string;
  modelId: string;
  hasApiKey: boolean;
  maskedApiKey: string;
  updatedAt: string | null;
};

type ProviderProfileDraft = ProviderProfileSummary & {
  apiKey: string;
};

type ProviderSettingsResponse = {
  activeProfileId: ProviderProfileId;
  profiles: ProviderProfileSummary[];
};

type ProviderSettingsTestResponse = {
  ok: boolean;
  status: number;
  message: string;
};

type ProviderProfileTestResult =
  | { state: "idle" }
  | { state: "testing" }
  | { state: "success" | "failure"; status: number; message: string; testedAt: string };

const backendOrigin = "http://127.0.0.1:8001";
const providerProfileIds: ProviderProfileId[] = ["profile-1", "profile-2", "profile-3"];
const emptyProviderTestResult: ProviderProfileTestResult = { state: "idle" };
const quickDiscoverySourcePackIds = ["provider-labs", "infra-commercial", "china-ai-watch"];

function emptyProviderProfile(id: ProviderProfileId): ProviderProfileDraft {
  return {
    id,
    label: "",
    baseUrl: "",
    apiKey: "",
    modelId: "",
    hasApiKey: false,
    maskedApiKey: "",
    updatedAt: null
  };
}

function providerProfilesFromResponse(
  response: ProviderSettingsResponse | null | undefined
): ProviderProfileDraft[] {
  const summaries = new Map((response?.profiles ?? []).map((profile) => [profile.id, profile]));
  return providerProfileIds.map((id) => {
    const summary = summaries.get(id);
    return {
      ...(summary ?? emptyProviderProfile(id)),
      id,
      apiKey: ""
    };
  });
}

function visiblePipelineFailureSuggestion(error: NonNullable<PipelineStatus["latestCompletedRun"]>["error"]) {
  if (error?.code === "model_api_failure") {
    return "检查本地 Codex CLI 认证、网络连通性和模型配置后重试。";
  }

  return error?.suggested_next_action ?? "";
}

const sourceTypeLabels: Record<string, string> = {
  paper: "论文",
  release: "发布说明",
  blog: "博客",
  eval: "评测",
  other: "其他"
};

const queueItems: QueueItem[] = [
  {
    id: "q-001",
    source: "arXiv: local inference routing",
    stage: "source intake",
    status: "抽取中",
    owner: "extractor.local",
    detail: "64% complete, 正在解析引用和发布日期",
    tone: "info"
  },
  {
    id: "q-002",
    source: "Research lab release notes",
    stage: "fallback",
    status: "备用抽取器",
    owner: "readability-fallback",
    detail: "主抽取器缺少正文，已切换到本地备用流程",
    tone: "warning"
  },
  {
    id: "q-003",
    source: "Vendor blog extraction timeout",
    stage: "failed",
    status: "抽取失败",
    owner: "manual review",
    detail: "网络快照超时，可本地重试或标记无效",
    tone: "danger"
  },
  {
    id: "q-004",
    source: "Model eval spreadsheet",
    stage: "schema guard",
    status: "AI 输出无效",
    owner: "validator.local",
    detail: "schema 校验失败：missing evidence[].source_url",
    tone: "danger"
  },
  {
    id: "q-005",
    source: "Mirrored press release",
    stage: "dedupe",
    status: "重复来源",
    owner: "dedupe.local",
    detail: "canonical_url 与 q-002 匹配，等待合并",
    tone: "warning"
  },
  {
    id: "q-006",
    source: "OpenAI 发布本地推理优化",
    stage: "draft review",
    status: "已批准草稿",
    owner: "curator",
    detail: "已进入周报候选池，仍只存在本地工作台",
    tone: "success"
  },
  {
    id: "q-007",
    source: "Unverified roadmap leak",
    stage: "draft review",
    status: "已拒绝草稿",
    owner: "curator",
    detail: "来源无法确认，保留为本地拒绝记录",
    tone: "neutral"
  }
];

const approvedEvents = [
  "OpenAI 发布本地推理优化",
  "开源推理服务器新增结构化输出守卫",
  "企业采购团队要求可追溯的 AI 证据包"
];

const stateLabels: Record<
  string,
  { label: string; tone: "neutral" | "success" | "warning" | "danger" | "info"; copy: string }
> = {
  idle: { label: "待运行", tone: "neutral", copy: "还没有运行本周发现流程。" },
  discovering: { label: "正在发现", tone: "info", copy: "正在通过 RSS 和 web search 查找候选来源。" },
  discovered: { label: "已发现候选", tone: "info", copy: "查看候选来源、重复状态和轨迹分类。" },
  extracting: { label: "正在抽取", tone: "info", copy: "Crawl4AI / Trafilatura 正在抽取内容。" },
  extracted: { label: "已抽取", tone: "success", copy: "可以进入质量检查和草稿生成。" },
  "low-quality": { label: "质量偏低", tone: "warning", copy: "抽取内容不足以生成可靠事件。" },
  drafting: { label: "正在起草", tone: "info", copy: "正在生成中文结构化草稿。" },
  "draft-invalid": { label: "草稿无效", tone: "warning", copy: "AI 输出未通过 schema 或中文质量校验。" },
  "ready-for-review": { label: "待人工审核", tone: "info", copy: "需要人工判断是否进入公开内容。" },
  approved: { label: "已批准", tone: "success", copy: "已可进入 content/approved。" },
  rejected: { label: "已拒绝", tone: "neutral", copy: "已保留拒绝原因和来源记录。" },
  failed: { label: "运行失败", tone: "danger", copy: "查看失败类型、source pack 和下一步建议。" }
};

const discoveryMethodLabels: Record<DiscoveryRecord["data"]["discovery_method"], string> = {
  rss: "RSS",
  web_search: "Web search"
};

const discoveryConfidenceLabels: Record<DiscoveryRecord["data"]["confidence"], string> = {
  observed: "已观察",
  likely: "可能",
  speculative: "推测"
};

const discoveryTrajectoryLabels: Record<string, string> = {
  llm_architecture: "LLM 架构",
  multimodal_architecture: "多模态",
  provider_releases: "供应商策略",
  commercial_forces: "商业与基础设施"
};

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(new URL(path, backendOrigin), init);
  const body = await response.text();
  const data = body ? JSON.parse(body) as unknown : null;
  if (!response.ok) {
    if (data && typeof data === "object") {
      const error = typeof (data as { message?: unknown }).message === "string"
        ? (data as { message: string }).message
        : typeof (data as { error?: unknown }).error === "string"
          ? (data as { error: string }).error
          : body;
      throw new Error(error || "Request failed.");
    }
    throw new Error(body || "Request failed.");
  }
  return data as T;
}

function formatElapsed(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

function latestDiscoveryRecordsPath(latestRunId: string | undefined, view: DiscoveryCandidateView) {
  const searchParams = new URLSearchParams();
  if (latestRunId) {
    searchParams.set("run_id", latestRunId);
  }

  if (view === "high-value") {
    searchParams.set("status", "discovered");
    searchParams.set("duplicate_status", "new");
    searchParams.set("sort", "value");
    searchParams.set("limit", "25");
    searchParams.set("min_value_score", "50");
  } else if (view === "failures") {
    searchParams.set("status", "failed");
    searchParams.set("limit", "25");
  } else {
    searchParams.set("sort", "value");
    searchParams.set("limit", "50");
  }

  return `/api/discovery-records?${searchParams.toString()}`;
}

function candidateViewLabel(view: DiscoveryCandidateView) {
  if (view === "high-value") {
    return "High value";
  }
  if (view === "failures") {
    return "Failures";
  }
  return "All";
}

export function WorkbenchApp() {
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [isProviderSettingsOpen, setIsProviderSettingsOpen] = useState(false);
  const [draftStatus, setDraftStatus] = useState<DraftStatus>("待审阅草稿");
  const [reviewNote, setReviewNote] = useState("证据链完整，但需要补一条生产部署影响。");
  const [toastMessage, setToastMessage] = useState("本地工作台已加载，浏览器不会发起模型调用。");
  const [relationship, setRelationship] = useState("supports");
  const [confidence, setConfidence] = useState("0.66");
  const [causalExplanation, setCausalExplanation] = useState(
    "结构化输出守卫提高本地验证能力，支持企业把事件纳入周报证据图。"
  );
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceType, setSourceType] = useState("release");
  const [sourceNotes, setSourceNotes] = useState("");
  const [localSources, setLocalSources] = useState<QueueItem[]>([]);
  const [status, setStatus] = useState<PipelineStatus | null>(null);
  const [discoveryRecords, setDiscoveryRecords] = useState<DiscoveryRecord[] | null>(null);
  const [isRunningDiscovery, setIsRunningDiscovery] = useState(false);
  const [sourcePacks, setSourcePacks] = useState<SourcePackRecord[]>([]);
  const [discoveryScopeMode, setDiscoveryScopeMode] = useState<DiscoveryScopeMode>("quick");
  const [selectedDiscoverySourcePackIds, setSelectedDiscoverySourcePackIds] = useState<string[]>(
    quickDiscoverySourcePackIds
  );
  const [candidateView, setCandidateView] = useState<DiscoveryCandidateView>("high-value");
  const [runSummary, setRunSummary] = useState<DiscoveryRunSummary | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [providerProfiles, setProviderProfiles] = useState<ProviderProfileDraft[]>(
    providerProfileIds.map((id) => emptyProviderProfile(id))
  );
  const [activeProviderProfileId, setActiveProviderProfileId] = useState<ProviderProfileId>("profile-1");
  const [selectedProviderProfileId, setSelectedProviderProfileId] = useState<ProviderProfileId>("profile-1");
  const [isSavingProviderSettings, setIsSavingProviderSettings] = useState(false);
  const [isTestingProviderSettings, setIsTestingProviderSettings] = useState(false);
  const [providerTestResults, setProviderTestResults] = useState<Record<ProviderProfileId, ProviderProfileTestResult>>({
    "profile-1": emptyProviderTestResult,
    "profile-2": emptyProviderTestResult,
    "profile-3": emptyProviderTestResult
  });

  async function refreshProviderSettings() {
    try {
      const settings = await fetchJson<ProviderSettingsResponse>("/api/workbench/provider-settings");
      setProviderProfiles(providerProfilesFromResponse(settings));
      setActiveProviderProfileId(settings.activeProfileId);
      setSelectedProviderProfileId((current) =>
        providerProfileIds.includes(current) ? current : settings.activeProfileId
      );
    } catch {
      setProviderProfiles(providerProfileIds.map((id) => emptyProviderProfile(id)));
      setActiveProviderProfileId("profile-1");
      setSelectedProviderProfileId("profile-1");
    }
  }

  async function refreshSourcePacks() {
    try {
      const packs = await fetchJson<SourcePackRecord[]>("/api/source-packs");
      setSourcePacks(packs);
      setSelectedDiscoverySourcePackIds((currentIds) => {
        const enabledIds = new Set(packs.filter((pack) => pack.data.enabled).map((pack) => pack.id));
        const stillValidIds = currentIds.filter((id) => enabledIds.has(id));
        if (stillValidIds.length > 0) {
          return stillValidIds;
        }

        const quickIds = quickDiscoverySourcePackIds.filter((id) => enabledIds.has(id));
        return quickIds.length > 0 ? quickIds : packs.filter((pack) => pack.data.enabled).map((pack) => pack.id);
      });
    } catch {
      setSourcePacks([]);
    }
  }

  async function refreshWorkbenchData() {
    let nextStatus: PipelineStatus;
    try {
      nextStatus = await fetchJson<PipelineStatus>("/api/pipeline/status");
      setStatus(nextStatus);
    } catch (error) {
      setStatus({
        stale: false,
        visibleStage: "idle",
        counts: {
          candidates: queueItems.length,
          drafts: 1,
          failures: 1,
          readyForReview: 1,
          sourcePacks: 0
        },
        latestCompletedRun: {
          id: "sample-run",
          stage: "idle"
        }
      });
      setDiscoveryRecords(null);
      setRunSummary(null);
      setToastMessage(
        error instanceof Error ? "本地后端不可用，当前显示样例状态。" : "本地后端不可用，当前显示样例状态。"
      );
      return;
    }

    try {
      const latestRunId = nextStatus.latestCompletedRun?.id;
      setDiscoveryRecords(await fetchJson<DiscoveryRecord[]>(latestDiscoveryRecordsPath(latestRunId, candidateView)));
    } catch {
      setDiscoveryRecords([]);
    }

    try {
      if (nextStatus.latestCompletedRun?.id) {
        setRunSummary(
          await fetchJson<DiscoveryRunSummary>(
            `/api/pipeline/runs/${encodeURIComponent(nextStatus.latestCompletedRun.id)}/discovery-summary`
          )
        );
      } else {
        setRunSummary(null);
      }
    } catch {
      setRunSummary(null);
    }
  }

  async function runDiscovery() {
    const enabledSourcePacks = sourcePacks.filter((pack) => pack.data.enabled);
    const enabledIds = enabledSourcePacks.map((pack) => pack.id);
    const sourcePackIds =
      discoveryScopeMode === "quick"
        ? quickDiscoverySourcePackIds.filter((id) => enabledIds.length === 0 || enabledIds.includes(id))
        : discoveryScopeMode === "all"
          ? enabledIds
          : selectedDiscoverySourcePackIds.filter((id) => enabledIds.length === 0 || enabledIds.includes(id));

    if (discoveryScopeMode === "custom" && sourcePackIds.length === 0) {
      setToastMessage("请选择至少一个启用的 source pack。");
      return;
    }

    setIsRunningDiscovery(true);
    setToastMessage("正在启动本地 Codex CLI 发现流程，认证与模型配置来自 Codex CLI 本地配置。");
    try {
      const payload = sourcePackIds.length > 0 ? { sourcePackIds } : {};
      const response = await fetchJson<{ run: { id: string; status: string; started_at: string } }>(
        "/api/pipeline/discovery/run",
        {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify(payload)
        }
      );
      await refreshWorkbenchData();
      setToastMessage(`Discovery started: ${response.run.id}`);
    } catch (error) {
      setToastMessage(error instanceof Error ? error.message : "发现流程启动失败。");
    } finally {
      setIsRunningDiscovery(false);
    }
  }

  useEffect(() => {
    void refreshWorkbenchData();
    void refreshSourcePacks();
    void refreshProviderSettings();
  }, []);

  useEffect(() => {
    void refreshWorkbenchData();
  }, [candidateView]);

  useEffect(() => {
    if (!status?.activeRun && !isRunningDiscovery) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      void refreshWorkbenchData();
    }, 3000);

    return () => window.clearInterval(intervalId);
  }, [status?.activeRun?.id, isRunningDiscovery, candidateView]);

  useEffect(() => {
    if (!status?.activeRun) {
      return undefined;
    }

    const intervalId = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, [status?.activeRun?.id]);

  const selectedProviderProfile =
    providerProfiles.find((profile) => profile.id === selectedProviderProfileId) ??
    emptyProviderProfile(selectedProviderProfileId);
  const selectedProviderTestResult = providerTestResults[selectedProviderProfileId] ?? emptyProviderTestResult;

  function updateSelectedProviderProfile(
    update: Partial<Pick<ProviderProfileDraft, "label" | "baseUrl" | "apiKey" | "modelId">>
  ) {
    setProviderProfiles((currentProfiles) =>
      currentProfiles.map((profile) =>
        profile.id === selectedProviderProfileId ? { ...profile, ...update } : profile
      )
    );

    if ("baseUrl" in update || "apiKey" in update || "modelId" in update) {
      setProviderTestResults((currentResults) => ({
        ...currentResults,
        [selectedProviderProfileId]: emptyProviderTestResult
      }));
    }
  }

  function saveableProviderProfiles() {
    return providerProfiles
      .filter((profile) => profile.label.trim() || profile.baseUrl.trim() || profile.apiKey.trim() || profile.modelId.trim())
      .map((profile) => ({
        id: profile.id,
        label: profile.label,
        baseUrl: profile.baseUrl,
        apiKey: profile.apiKey,
        modelId: profile.modelId
      }));
  }

  async function saveProviderSettings() {
    setIsSavingProviderSettings(true);
    try {
      const saved = await fetchJson<ProviderSettingsResponse>("/api/workbench/provider-settings/save", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          activeProfileId: activeProviderProfileId,
          profiles: saveableProviderProfiles()
        })
      });
      setProviderProfiles(providerProfilesFromResponse(saved));
      setActiveProviderProfileId(saved.activeProfileId);
      setSelectedProviderProfileId(saved.activeProfileId);
      setToastMessage("Saved workbench API settings.");
    } catch (error) {
      setToastMessage(error instanceof Error ? error.message : "Failed to save workbench API settings.");
    } finally {
      setIsSavingProviderSettings(false);
    }
  }

  async function testProviderSettings() {
    setIsTestingProviderSettings(true);
    setProviderTestResults((currentResults) => ({
      ...currentResults,
      [selectedProviderProfile.id]: { state: "testing" }
    }));

    try {
      const response = await fetch(new URL("/api/workbench/provider-settings/test", backendOrigin), {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          profile: {
            id: selectedProviderProfile.id,
            label: selectedProviderProfile.label,
            baseUrl: selectedProviderProfile.baseUrl,
            apiKey: selectedProviderProfile.apiKey,
            modelId: selectedProviderProfile.modelId
          }
        })
      });

      const body = await response.text();
      const parsed = body ? JSON.parse(body) as Partial<ProviderSettingsTestResponse> : {};
      const result: ProviderSettingsTestResponse = {
        ok: Boolean(parsed.ok && response.ok),
        status: typeof parsed.status === "number" ? parsed.status : response.status,
        message: typeof parsed.message === "string" ? parsed.message : "Connection test failed."
      };
      const nextResult: ProviderProfileTestResult = {
        state: result.ok ? "success" : "failure",
        status: result.status,
        message: result.message,
        testedAt: new Date().toLocaleString()
      };

      setProviderTestResults((currentResults) => ({
        ...currentResults,
        [selectedProviderProfile.id]: nextResult
      }));
      setToastMessage(result.message);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Connection test failed.";
      setProviderTestResults((currentResults) => ({
        ...currentResults,
        [selectedProviderProfile.id]: {
          state: "failure",
          status: 0,
          message,
          testedAt: new Date().toLocaleString()
        }
      }));
      setToastMessage(message);
    } finally {
      setIsTestingProviderSettings(false);
    }
  }

  function approveDraft() {
    setDraftStatus("已批准草稿");
    setToastMessage("已批准草稿：OpenAI 发布本地推理优化");
    setIsReviewOpen(false);
  }

  function rejectDraft() {
    setDraftStatus("已拒绝草稿");
    setToastMessage("已驳回草稿：OpenAI 发布本地推理优化");
    setIsReviewOpen(false);
  }

  function retryExtraction() {
    setToastMessage("已排队重试：Vendor blog extraction timeout");
  }

  function saveCausalLink() {
    setToastMessage("已保存本地因果链接");
  }

  function addLocalSource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedUrl = sourceUrl.trim();
    if (!trimmedUrl) {
      setToastMessage("请输入来源 URL，浏览器不会自动抓取或调用模型。");
      return;
    }

    const sourceTypeLabel = sourceTypeLabels[sourceType] ?? sourceTypeLabels.other;
    setLocalSources((currentSources) => [
      {
        id: `local-${currentSources.length + 1}`,
        source: trimmedUrl,
        stage: "source intake",
        status: "本地新增来源",
        owner: "browser.local",
        detail: `${sourceTypeLabel} · ${sourceNotes.trim() || "等待本地服务端摄入"}`,
        tone: "info"
      },
      ...currentSources
    ]);
    setToastMessage(`已加入本地队列：${trimmedUrl}`);
    setSourceUrl("");
    setSourceNotes("");
    setSourceType("release");
  }

  const enabledSourcePackIds = new Set(sourcePacks.filter((pack) => pack.data.enabled).map((pack) => pack.id));
  const quickAvailableSourcePackIds = quickDiscoverySourcePackIds.filter((id) =>
    enabledSourcePackIds.size === 0 ? true : enabledSourcePackIds.has(id)
  );
  const selectedEnabledSourcePackIds = selectedDiscoverySourcePackIds.filter((id) =>
    enabledSourcePackIds.size === 0 ? true : enabledSourcePackIds.has(id)
  );
  const activeRunStartedAt = status?.activeRun ? new Date(status.activeRun.started_at).getTime() : null;
  const activeRunElapsedMs = activeRunStartedAt ? Math.max(0, nowTick - activeRunStartedAt) : 0;
  const activeRunElapsed = status?.activeRun ? formatElapsed(activeRunElapsedMs) : null;
  const activeRunIsLongRunning = activeRunElapsedMs > 2 * 60 * 1000;
  const currentState = (stateLabels[status?.visibleStage ?? "idle"] ?? stateLabels.idle)!;
  const candidateCount = discoveryRecords?.length ?? status?.counts.candidates ?? queueItems.length;

  return (
    <main className="workbench-shell">
      <section className="status-bar" aria-label="Pipeline status">
        <div>
          <p className="eyebrow">Pipeline</p>
          <h1>本地发现流程</h1>
          <p>{currentState.copy}</p>
        </div>
        <div className="status-actions">
          <Badge tone={currentState.tone}>{currentState.label}</Badge>
          <div className="button-row workbench-actions">
            <Button onClick={() => setIsProviderSettingsOpen(true)} type="button" variant="outline">
              API settings
            </Button>
            <Button
              disabled={Boolean(status?.activeRun) || isRunningDiscovery}
              onClick={runDiscovery}
              type="button"
            >
              {status?.activeRun || isRunningDiscovery ? "运行中" : "Run discovery"}
            </Button>
          </div>
          <p className="muted">
            Run discovery uses your local Codex CLI config separately from these workbench API settings.
          </p>
        </div>
      </section>

      {status?.activeRun ? (
        <section className="active-run-panel" aria-label="Active discovery run">
          <div>
            <p className="eyebrow">Discovery started</p>
            <strong>{status.activeRun.id}</strong>
            <span>Stage: {stateLabels[status.activeRun.stage]?.label ?? status.activeRun.stage}</span>
          </div>
          <div>
            <span>Elapsed</span>
            <strong>{activeRunElapsed}</strong>
          </div>
          <p>
            The browser is polling local status while Codex CLI continues in the background. Discovery still uses local
            Codex CLI auth/config, not workbench API settings.
          </p>
          {activeRunIsLongRunning || status.stale ? (
            <div className="callout warning">
              <strong>Still waiting</strong>
              <span>
                Long runs can happen when RSS/search sources are slow. If this remains stale, inspect the run output in
                `.curation/agent-outputs/{status.activeRun.id}`.
              </span>
            </div>
          ) : null}
        </section>
      ) : null}

      {status?.latestCompletedRun?.error ? (
        <section className="failure-panel" aria-label="Pipeline failure">
          <strong>{status.latestCompletedRun.error.message_zh}</strong>
          {status.latestCompletedRun.error.source_pack_id ? (
            <span>Source pack: {status.latestCompletedRun.error.source_pack_id}</span>
          ) : null}
          <span>{visiblePipelineFailureSuggestion(status.latestCompletedRun.error)}</span>
          <Button onClick={runDiscovery} type="button" variant="outline">
            重试失败步骤
          </Button>
        </section>
      ) : null}

      <header className="hero-band">
        <div>
          <p className="eyebrow">本地工作台 · 不进入静态发布</p>
          <h1>Local Curation Workbench</h1>
          <p className="hero-copy">
            {APP_NAME} 的本地策展面板用于原始来源摄入、抽取状态、质量报告、草稿审阅和周报构建。
            浏览器只展示样例状态与本地动作边界，不会调用 OpenAI 或任何模型 API。
          </p>
        </div>
        <div className="boundary-box">
          <strong>Server/local boundary</strong>
          <span>未来模型调用必须在本地服务器进程中执行；当前 shell 仅更新 React 本地状态。</span>
        </div>
      </header>

      <StatusToast message={toastMessage} />

      <section className="ops-grid" aria-label="Local pipeline overview">
        <Card>
          <div className="section-heading">
            <div>
              <p className="eyebrow">Source packs</p>
              <h2>发现范围</h2>
            </div>
            <Badge tone={status?.counts.sourcePacks ? "info" : "neutral"}>
              {status?.counts.sourcePacks ?? 0} packs
            </Badge>
          </div>
          <p className="muted">
            默认使用高信号快速运行，只扫描 provider labs、基础设施商业和中国 AI 观察来源；也可以切到全部启用来源或自定义。
          </p>
          <div className="scope-preset-group" role="radiogroup" aria-label="Discovery source-pack scope">
            <button
              aria-checked={discoveryScopeMode === "quick"}
              className="scope-preset"
              onClick={() => setDiscoveryScopeMode("quick")}
              role="radio"
              type="button"
            >
              <strong>High-signal quick run</strong>
              <span>{quickAvailableSourcePackIds.length} focused packs</span>
            </button>
            <button
              aria-checked={discoveryScopeMode === "all"}
              className="scope-preset"
              onClick={() => setDiscoveryScopeMode("all")}
              role="radio"
              type="button"
            >
              <strong>All enabled packs</strong>
              <span>{sourcePacks.filter((pack) => pack.data.enabled).length || "all"} packs</span>
            </button>
            <button
              aria-checked={discoveryScopeMode === "custom"}
              className="scope-preset"
              onClick={() => setDiscoveryScopeMode("custom")}
              role="radio"
              type="button"
            >
              <strong>Custom</strong>
              <span>{selectedEnabledSourcePackIds.length} selected</span>
            </button>
          </div>

          <div className="source-pack-list" aria-label="Available source packs">
            {sourcePacks.length === 0 ? (
              <span className="muted">Source pack metadata will appear here after the local backend responds.</span>
            ) : (
              sourcePacks.map((pack) => {
                const selected = selectedDiscoverySourcePackIds.includes(pack.id);
                return (
                  <label className="source-pack-option" key={pack.id}>
                    <input
                      checked={selected}
                      disabled={discoveryScopeMode !== "custom" || !pack.data.enabled}
                      onChange={(event) => {
                        setSelectedDiscoverySourcePackIds((currentIds) =>
                          event.target.checked
                            ? Array.from(new Set([...currentIds, pack.id]))
                            : currentIds.filter((id) => id !== pack.id)
                        );
                      }}
                      type="checkbox"
                    />
                    <span>
                      <strong>{pack.data.name}</strong>
                      <small>
                        {pack.id} · {pack.data.rss_feeds.length} RSS · {pack.data.web_search_queries.length} search
                      </small>
                    </span>
                    <Badge tone={pack.data.enabled ? "success" : "neutral"}>
                      {pack.data.enabled ? "enabled" : "disabled"}
                    </Badge>
                  </label>
                );
              })
            )}
          </div>
        </Card>

        <Card>
          <div className="section-heading">
            <div>
              <p className="eyebrow">Discovery candidates</p>
              <h2>{candidateViewLabel(candidateView)} queue</h2>
            </div>
            <Badge tone="info">{candidateCount} candidates</Badge>
          </div>
          <div className="candidate-tabs" role="tablist" aria-label="Discovery candidate filters">
            {(["high-value", "all", "failures"] as const).map((view) => (
              <button
                aria-selected={candidateView === view}
                className="candidate-tab"
                key={view}
                onClick={() => setCandidateView(view)}
                role="tab"
                type="button"
              >
                {candidateViewLabel(view)}
              </button>
            ))}
          </div>
          {discoveryRecords === null ? (
            <div className="candidate-grid">
              {[...localSources, ...queueItems].slice(0, 5).map((item) => (
                <article className="candidate-row" key={item.id}>
                  <strong>{item.source}</strong>
                  <span>{item.stage}</span>
                  <Badge tone={item.tone}>{item.status}</Badge>
                  <span>{item.owner}</span>
                  <span>{item.detail}</span>
                </article>
              ))}
            </div>
          ) : discoveryRecords.length === 0 ? (
            <Empty
              className="compact-empty"
              description="本地后端已连接，但当前还没有 discovery records。运行发现流程后在这里查看真实候选。"
              title="暂无候选"
            >
              <span>候选队列读取 `.curation/discovery-records`，不会从公共站点补数据。</span>
            </Empty>
          ) : (
            <div className="candidate-grid">
              {discoveryRecords.slice(0, 25).map((record) => {
                const item = record.data;
                const discoveryTone: QueueTone =
                  item.status === "failed" ? "warning" : item.status === "ready-for-review" ? "success" : "info";
                const discoveryStatus =
                  item.status === "failed"
                    ? "发现失败"
                    : item.status === "ready-for-review"
                      ? "待审阅"
                      : "已发现候选";
                const trajectorySummary = item.trajectory_classification
                  .map((trajectory) => discoveryTrajectoryLabels[trajectory] ?? trajectory)
                  .join(" / ");
                const detail =
                  item.status === "failed" && item.errors.length > 0
                    ? item.errors.join(" · ")
                    : item.normalized_url;
                const valueReasons = record.value_reasons ?? [];

                return (
                  <article
                    className="candidate-card"
                    data-testid={`discovery-record-${record.id}`}
                    key={record.id}
                  >
                    <div className="candidate-card-heading">
                      <strong>{item.title}</strong>
                      <div className="candidate-card-badges">
                        {typeof record.value_score === "number" ? (
                          <Badge tone={record.value_score >= 70 ? "success" : "info"}>
                            Value {record.value_score}
                          </Badge>
                        ) : null}
                        <Badge tone={discoveryTone}>{discoveryStatus}</Badge>
                      </div>
                    </div>
                    <p>{detail}</p>
                    <div className="candidate-meta">
                      <span>{item.source_pack_id}</span>
                      <span>{discoveryMethodLabels[item.discovery_method]}</span>
                      <span>{discoveryConfidenceLabels[item.confidence]}</span>
                      <span>{trajectorySummary}</span>
                      <a href={item.normalized_url} rel="noreferrer" target="_blank">
                        source URL
                      </a>
                    </div>
                    {valueReasons.length > 0 ? (
                      <div className="value-reasons" aria-label="Value reasons">
                        {valueReasons.slice(0, 5).map((reason) => (
                          <span key={reason}>{reason}</span>
                        ))}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}

          {runSummary ? (
            <div className="discovery-summary" data-testid="discovery-run-summary">
              <div className="metric-row">
                <span>Latest run summary</span>
                <strong>{runSummary.runId}</strong>
              </div>
              <div className="summary-metrics">
                <div>
                  <strong>{runSummary.recordsWritten}</strong>
                  <span>records written</span>
                </div>
                <div>
                  <strong>{runSummary.sourcePacks.length}</strong>
                  <span>source-pack summaries</span>
                </div>
                <div>
                  <strong>{runSummary.rss.length}</strong>
                  <span>RSS diagnostics</span>
                </div>
                <div>
                  <strong>{runSummary.webSearch.webSearchSkipped ? "Web search skipped" : "Web search checked"}</strong>
                  <span>
                    {runSummary.webSearch.configuredProvider ??
                      `${runSummary.webSearch.skippedQueries} skipped queries`}
                  </span>
                </div>
              </div>
              {runSummary.sourcePacks.length > 0 ? (
                <div className="summary-pack-list">
                  {runSummary.sourcePacks.slice(0, 6).map((pack, index) => (
                    <span key={`${pack.sourcePackId ?? "pack"}-${index}`}>
                      {pack.sourcePackId ?? "unknown"} · RSS {pack.rssWritten ?? 0}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </Card>
      </section>

      <section className="dashboard-grid" aria-label="Local curation operations">
        <Card className="span-2">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Source intake</p>
              <h2>Queue progress</h2>
            </div>
            <Badge tone="info">local sample state</Badge>
          </div>

          <div className="queue-summary">
            <form aria-label="本地来源摄入" className="source-form" onSubmit={addLocalSource}>
              <div className="section-heading compact-heading">
                <div>
                  <p className="eyebrow">Local intake</p>
                  <h3>添加来源</h3>
                </div>
                <Badge data-testid="local-source-count" tone="info">
                  {localSources.length} local source{localSources.length === 1 ? "" : "s"}
                </Badge>
              </div>
              <label>
                来源 URL
                <Input
                  inputMode="url"
                  onChange={(event) => setSourceUrl(event.target.value)}
                  placeholder="https://example.local/research-note"
                  type="url"
                  value={sourceUrl}
                />
              </label>
              <label>
                来源类型
                <Select value={sourceType} onChange={(event) => setSourceType(event.target.value)}>
                  <option value="release">发布说明</option>
                  <option value="paper">论文</option>
                  <option value="blog">博客</option>
                  <option value="eval">评测</option>
                  <option value="other">其他</option>
                </Select>
              </label>
              <label>
                摄入备注
                <Textarea
                  onChange={(event) => setSourceNotes(event.target.value)}
                  placeholder="本地备注、初步判断、需要人工检查的点"
                  value={sourceNotes}
                />
              </label>
              <Button type="submit">加入本地队列</Button>
              <p className="form-note">只写入 React 本地状态；不会从浏览器抓取 URL，也不会调用模型 API。</p>
            </form>

            {localSources.length === 0 ? (
              <Empty
                data-testid="empty-queue"
                description="没有新的待摄入来源。样例队列仍显示下方所有边界状态，方便本地 QA。"
                title="空队列"
              >
                <span>使用左侧表单把来源加入本地队列。</span>
              </Empty>
            ) : null}

            <div className="progress-panel">
              <div className="metric-row">
                <span>In-progress extraction</span>
                <strong>64%</strong>
              </div>
              <Progress aria-label="抽取进度" data-testid="progress-extraction" value={64} />
              <p>抽取中项目仍停留在本地队列，等待服务端 worker 写入结果。</p>
              <div className="skeleton-stack" data-testid="skeleton-loader">
                <Skeleton className="skeleton-line wide" />
                <Skeleton className="skeleton-line medium" />
                <Skeleton className="skeleton-line short" />
              </div>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Stage</th>
                  <th>Status</th>
                  <th>Owner</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {[...localSources, ...queueItems].map((item) => (
                  <tr key={item.id}>
                    <td>{item.source}</td>
                    <td>{item.stage}</td>
                    <td>
                      <Badge tone={item.tone}>{item.status}</Badge>
                    </td>
                    <td>{item.owner}</td>
                    <td>{item.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <div className="section-heading">
            <div>
              <p className="eyebrow">Quality</p>
              <h2>Reports</h2>
            </div>
          </div>
          <div className="stack">
            <div className="callout warning" data-testid="duplicate-warning">
              <strong>重复来源</strong>
              <span>已检测到重复来源：Mirrored press release 与 Research lab release notes 共享 canonical URL。</span>
            </div>
            <div className="callout danger" data-testid="invalid-output">
              <strong>AI 输出无效</strong>
              <span>schema 校验失败：evidence[].source_url 缺失，本地 validator 已阻止进入批准池。</span>
            </div>
            <div className="quality-report" data-testid="quality-report">
              <div>
                <span>证据覆盖率</span>
                <strong>83%</strong>
              </div>
              <div>
                <span>来源可信度</span>
                <strong>高：4 / 中：2 / 低：0</strong>
              </div>
              <div>
                <span>因果链接完整度</span>
                <strong>5 of 6 mapped</strong>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="section-heading">
            <div>
              <p className="eyebrow">Draft review</p>
              <h2>Approval queue</h2>
            </div>
            <Badge data-testid="draft-status" tone={draftStatus === "已拒绝草稿" ? "neutral" : "success"}>
              {draftStatus}
            </Badge>
          </div>
          <p className="muted">
            草稿审阅、批准、驳回和重试都只更新浏览器内存；真正写入文件的动作需要未来本地服务端接口。
          </p>
          <Empty
            className="compact-empty"
            data-testid="empty-drafts"
            description="当真实队列没有待审阅草稿时，工作台显示这个本地空状态，不从公共站点或模型 API 补数据。"
            title="无草稿空状态示例"
          >
            <span>当前样例草稿仍保留在下方，用来演示审阅、批准和驳回动作。</span>
          </Empty>
          <div className="button-row">
            <Button onClick={() => setIsReviewOpen(true)} type="button">
              审阅草稿
            </Button>
            <Button onClick={retryExtraction} type="button" variant="outline">
              重试抽取
            </Button>
          </div>
        </Card>

        <Card className="span-2">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Causal editor</p>
              <h2>Local causal-link editing</h2>
            </div>
          </div>
          <div className="form-grid">
            <label>
              Source event
              <Select defaultValue="OpenAI 发布本地推理优化">
                <option>OpenAI 发布本地推理优化</option>
                <option>开源推理服务器新增结构化输出守卫</option>
              </Select>
            </label>
            <label>
              关系类型
              <Select value={relationship} onChange={(event) => setRelationship(event.target.value)}>
                <option value="supports">supports</option>
                <option value="enables">enables</option>
                <option value="pressures">pressures</option>
                <option value="contradicts">contradicts</option>
              </Select>
            </label>
            <label>
              置信度
              <Select value={confidence} onChange={(event) => setConfidence(event.target.value)}>
                <option value="0.42">0.42</option>
                <option value="0.66">0.66</option>
                <option value="0.82">0.82</option>
              </Select>
            </label>
            <label className="span-2">
              因果说明
              <Textarea
                onChange={(event) => setCausalExplanation(event.target.value)}
                value={causalExplanation}
              />
            </label>
            <label>
              Sources
              <Textarea defaultValue={"https://example.local/source/openai-local\nhttps://example.local/source/enterprise-evidence"} />
            </label>
          </div>
          <div className="preview-row">
            <div data-testid="causal-preview">
              <strong>{relationship}</strong>
              <span>confidence {confidence}</span>
              <p>{causalExplanation}</p>
            </div>
            <Button onClick={saveCausalLink} type="button">
              保存因果链接
            </Button>
          </div>
        </Card>

        <Card className="span-3 weekly-builder" data-testid="weekly-brief-builder">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Weekly brief builder</p>
              <h2>Approved-event proposal</h2>
            </div>
            <Badge tone="success">{approvedEvents.length} approved events</Badge>
          </div>
          <div className="brief-grid">
            <article>
              <h3>提议 thesis</h3>
              <p>AI 进展正在从模型能力展示转向可验证、可部署、可采购的本地工作流。</p>
            </article>
            <article>
              <h3>Headline</h3>
              <p>本地推理与结构化验证成为本周主线。</p>
            </article>
            <article>
              <h3>Watchlist</h3>
              <p>企业采购、离线评测、可追溯证据包、开源推理服务器。</p>
            </article>
            <article>
              <h3>Evidence mapping</h3>
              <ul>
                {approvedEvents.map((event) => (
                  <li key={event}>{event}</li>
                ))}
              </ul>
            </article>
            <article>
              <h3>Closing synthesis</h3>
              <p>下周要观察的是：这些本地化和证据化能力是否进入真实采购门槛，而不只是工程演示。</p>
            </article>
          </div>
        </Card>
      </section>

      <Sheet
        open={isProviderSettingsOpen}
        title="OpenAI-compatible API settings"
        onClose={() => setIsProviderSettingsOpen(false)}
      >
        <div className="sheet-body">
          <div>
            <p className="eyebrow">Workbench-only direct API config</p>
            <h3>Profile switching</h3>
            <p>
              管理最多 3 组本地 API 配置。当前设置只影响工作台自己的直连 OpenAI-compatible API
              调用和连接测试，不会改动 Codex CLI。
            </p>
            <p className="muted">
              用途边界：这些配置给后端草稿生成和连接测试使用；Run discovery 仍然走本地 Codex CLI 自己的认证与配置。
            </p>
          </div>

          <div className="provider-profile-picker" role="tablist" aria-label="Provider profiles">
            {providerProfiles.map((profile, index) => (
              <button
                aria-pressed={selectedProviderProfileId === profile.id}
                className="provider-profile-chip"
                key={profile.id}
                onClick={() => setSelectedProviderProfileId(profile.id)}
                type="button"
              >
                <strong>{profile.label || `Profile ${index + 1}`}</strong>
                <span>{profile.id === activeProviderProfileId ? "Active" : "Inactive"}</span>
              </button>
            ))}
          </div>

          <div className="form-grid provider-settings-grid">
            <label className="span-2">
              Profile label
              <Input
                onChange={(event) => updateSelectedProviderProfile({ label: event.target.value })}
                value={selectedProviderProfile.label}
              />
            </label>
            <div className="provider-active-field">
              <span className="provider-field-label">Active profile</span>
              <Button
                aria-label={selectedProviderProfile.id === activeProviderProfileId ? "Active profile" : "Set active"}
                disabled={selectedProviderProfile.id === activeProviderProfileId}
                onClick={() => setActiveProviderProfileId(selectedProviderProfile.id)}
                type="button"
                variant="outline"
              >
                {selectedProviderProfile.id === activeProviderProfileId ? "Active" : "Set active"}
              </Button>
            </div>
            <label className="span-3">
              Base URL
              <Input
                onChange={(event) => updateSelectedProviderProfile({ baseUrl: event.target.value })}
                placeholder="https://api.example.test/v1"
                type="url"
                value={selectedProviderProfile.baseUrl}
              />
            </label>
            <label className="span-3">
              API key
              <Input
                onChange={(event) => updateSelectedProviderProfile({ apiKey: event.target.value })}
                placeholder={selectedProviderProfile.hasApiKey ? "Leave blank to keep the saved key" : "sk-..."}
                type="password"
                value={selectedProviderProfile.apiKey}
              />
            </label>
            <label className="span-3">
              Model ID
              <Input
                onChange={(event) => updateSelectedProviderProfile({ modelId: event.target.value })}
                placeholder="gpt-4.1-mini"
                value={selectedProviderProfile.modelId}
              />
            </label>
          </div>

          {selectedProviderProfile.hasApiKey ? (
            <div className="callout warning provider-key-hint">
              <strong>Stored key</strong>
              <span>{selectedProviderProfile.maskedApiKey}</span>
              <span>Leave the API key field blank to keep the saved secret.</span>
            </div>
          ) : (
            <div className="callout warning provider-key-hint">
              <strong>No saved key yet</strong>
              <span>New profiles must include an API key before they can be saved or tested.</span>
            </div>
          )}

          <div className="button-row">
            <Button disabled={isTestingProviderSettings} onClick={testProviderSettings} type="button" variant="outline">
              {isTestingProviderSettings ? "Testing..." : "Test connection"}
            </Button>
            <Button disabled={isSavingProviderSettings} onClick={saveProviderSettings} type="button">
              {isSavingProviderSettings ? "Saving..." : "Save settings"}
            </Button>
          </div>

          {selectedProviderTestResult.state !== "idle" ? (
            <div
              aria-live="polite"
              className={`callout provider-test-result ${
                selectedProviderTestResult.state === "success"
                  ? "success"
                  : selectedProviderTestResult.state === "failure"
                    ? "danger"
                    : "warning"
              }`}
              data-testid="provider-test-result"
            >
              {selectedProviderTestResult.state === "testing" ? (
                <>
                  <strong>Testing connection...</strong>
                  <span>Waiting for the provider response.</span>
                </>
              ) : (
                <>
                  <strong>
                    {selectedProviderTestResult.state === "success" ? "Connection succeeded" : "Connection failed"}
                  </strong>
                  <span>Status {selectedProviderTestResult.status}</span>
                  <span>{selectedProviderTestResult.message}</span>
                  <span>Last tested {selectedProviderTestResult.testedAt}</span>
                </>
              )}
            </div>
          ) : null}
        </div>
      </Sheet>

      <Sheet open={isReviewOpen} title="草稿审阅" onClose={() => setIsReviewOpen(false)}>
        <div className="sheet-body">
          <div>
            <p className="eyebrow">Draft</p>
            <h3>OpenAI 发布本地推理优化</h3>
            <p>
              样例草稿说明本地推理优化如何改变企业部署节奏。此处不会从浏览器写入内容仓库，也不会触发模型调用。
            </p>
          </div>
          <label>
            审阅意见
            <Textarea value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} />
          </label>
          <div className="button-row">
            <Button onClick={approveDraft} type="button">
              批准草稿
            </Button>
            <Button onClick={rejectDraft} type="button" variant="destructive">
              驳回草稿
            </Button>
          </div>
        </div>
      </Sheet>
    </main>
  );
}
