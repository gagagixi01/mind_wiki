import { useState, type FormEvent } from "react";
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
} from "./components/ui/primitives";

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
    detail: "主抽取器缺少正文，已切换到本地备用抽取器",
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

export function App() {
  const [isReviewOpen, setIsReviewOpen] = useState(false);
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

  function approveDraft() {
    setDraftStatus("已批准草稿");
    setToastMessage("已批准草稿：OpenAI 发布本地推理优化");
  }

  function rejectDraft() {
    setDraftStatus("已拒绝草稿");
    setToastMessage("已驳回草稿：OpenAI 发布本地推理优化");
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

  return (
    <main className="workbench-shell">
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
          <span>未来模型调用必须在本地服务器进程中执行；当前 Vite shell 仅更新 React 本地状态。</span>
        </div>
      </header>

      <StatusToast message={toastMessage} />

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
