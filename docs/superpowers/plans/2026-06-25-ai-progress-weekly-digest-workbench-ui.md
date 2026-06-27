# AI Progress Weekly Digest Workbench UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the local workbench from a sample-state interface into an API-backed operations cockpit for the Codex CLI autopipeline.

**Architecture:** Keep `apps/workbench` as a local Vite React app. React fetches localhost backend API endpoints for status and actions; it never runs RSS, search, extraction, model calls, Codex CLI, or approved-content writes in the browser.

**Tech Stack:** Vite React, TypeScript, existing workbench UI primitives, CSS, localhost API endpoints from `packages/local-backend`.

---

## Task 1: API Client And Pipeline Status Bar

**Files:**
- Modify: `apps/workbench/src/App.tsx`
- Modify: `apps/workbench/src/styles.css`

- [ ] **Step 1: Add API types and fetch helper**

At the top of `apps/workbench/src/App.tsx`, add:

```ts
type PipelineStatus = {
  activeRun?: { id: string; stage: string; started_at: string };
  latestCompletedRun?: {
    id: string;
    stage: string;
    ended_at?: string;
    error?: { message_zh: string; suggested_next_action: string; source_pack_id?: string };
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

const stateLabels: Record<string, { label: string; tone: "neutral" | "success" | "warning" | "danger" | "info"; copy: string }> = {
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

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json() as Promise<T>;
}
```

- [ ] **Step 2: Add status state and actions**

Inside `App`, add:

```ts
const [status, setStatus] = useState<PipelineStatus | null>(null);
const [isRunningDiscovery, setIsRunningDiscovery] = useState(false);

async function refreshStatus() {
  setStatus(await fetchJson<PipelineStatus>("/api/pipeline/status"));
}

async function runDiscovery() {
  setIsRunningDiscovery(true);
  setToastMessage("正在启动本地 Codex CLI 发现流程。");
  try {
    await fetchJson("/api/pipeline/discovery/run", { method: "POST" });
    await refreshStatus();
    setToastMessage("发现流程已启动。");
  } catch (error) {
    setToastMessage(error instanceof Error ? error.message : "发现流程启动失败。");
  } finally {
    setIsRunningDiscovery(false);
  }
}
```

Add `useEffect` to the React import and call:

```ts
useEffect(() => {
  void refreshStatus();
}, []);
```

- [ ] **Step 3: Render status/control bar first**

At the top of `<main className="workbench-shell">`, before the old hero content, render:

```tsx
<section className="status-bar" aria-label="Pipeline status">
  <div>
    <p className="eyebrow">Pipeline</p>
    <h1>本地发现流程</h1>
    <p>{stateLabels[status?.visibleStage ?? "idle"].copy}</p>
  </div>
  <Badge tone={stateLabels[status?.visibleStage ?? "idle"].tone}>
    {stateLabels[status?.visibleStage ?? "idle"].label}
  </Badge>
  <Button
    disabled={Boolean(status?.activeRun) || isRunningDiscovery}
    onClick={runDiscovery}
    type="button"
  >
    {status?.activeRun || isRunningDiscovery ? "运行中" : "Run discovery"}
  </Button>
</section>
```

- [ ] **Step 4: Add status CSS**

Add to `apps/workbench/src/styles.css`:

```css
.status-bar {
  align-items: center;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  display: grid;
  gap: 16px;
  grid-template-columns: minmax(0, 1fr) auto auto;
  margin: 0 auto 16px;
  max-width: 1440px;
  padding: 16px;
}

.status-bar h1,
.status-bar p {
  margin: 0;
}

.status-bar h1 {
  font-size: 24px;
  line-height: 1.2;
}

@media (max-width: 760px) {
  .status-bar {
    align-items: stretch;
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 5: Verify build**

Run:

```bash
pnpm --filter @mind-wiki/workbench lint
pnpm --filter @mind-wiki/workbench build
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/workbench/src/App.tsx apps/workbench/src/styles.css
git commit -m "feat: add workbench pipeline status bar"
```

## Task 2: Operations Sections And Responsive Candidate Queue

**Files:**
- Modify: `apps/workbench/src/App.tsx`
- Modify: `apps/workbench/src/styles.css`

- [ ] **Step 1: Add source-pack health summary**

Replace the old `hero-band` first viewport emphasis with a compact health section:

```tsx
<section className="ops-grid" aria-label="Local pipeline overview">
  <Card>
    <div className="section-heading">
      <div>
        <p className="eyebrow">Source packs</p>
        <h2>来源包健康</h2>
      </div>
      <Badge tone={status?.counts.sourcePacks ? "info" : "neutral"}>
        {status?.counts.sourcePacks ?? 0} packs
      </Badge>
    </div>
    <p className="muted">显示启用状态、最近成功、最近失败、候选数量、重复数量和下一步动作。</p>
  </Card>
```

- [ ] **Step 2: Add candidate queue summary**

Continue the same `ops-grid` with:

```tsx
  <Card>
    <div className="section-heading">
      <div>
        <p className="eyebrow">Discovery candidates</p>
        <h2>候选队列</h2>
      </div>
      <Badge tone="info">{status?.counts.candidates ?? 0} candidates</Badge>
    </div>
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
  </Card>
</section>
```

Keep the later draft review, quality, causal editor, and weekly brief builder sections after this first viewport hierarchy.

- [ ] **Step 3: Add candidate queue CSS**

Add to `apps/workbench/src/styles.css`:

```css
.ops-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: minmax(0, 0.7fr) minmax(0, 1.3fr);
  margin: 0 auto 16px;
  max-width: 1440px;
}

.candidate-grid {
  display: grid;
  gap: 10px;
}

.candidate-row {
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  display: grid;
  gap: 10px;
  grid-template-columns: minmax(220px, 1.4fr) repeat(4, minmax(100px, 1fr));
  padding: 12px;
}

@media (max-width: 900px) {
  .ops-grid {
    grid-template-columns: 1fr;
  }

  .candidate-row {
    grid-template-columns: 1fr;
  }

  .table-wrap {
    overflow-x: hidden;
  }
}
```

- [ ] **Step 4: Verify mobile overflow manually**

Run:

```bash
pnpm --filter @mind-wiki/workbench build
```

Expected: PASS. In browser QA, a 390px viewport shows stacked candidate rows without page-level horizontal scrolling.

- [ ] **Step 5: Commit**

```bash
git add apps/workbench/src/App.tsx apps/workbench/src/styles.css
git commit -m "feat: add workbench operations overview"
```

## Task 3: Failure And Review States

**Files:**
- Modify: `apps/workbench/src/App.tsx`
- Modify: `apps/workbench/src/styles.css`

- [ ] **Step 1: Show named failure details**

Add this failure panel after the status bar:

```tsx
{status?.latestCompletedRun?.error ? (
  <section className="failure-panel" aria-label="Pipeline failure">
    <strong>{status.latestCompletedRun.error.message_zh}</strong>
    {status.latestCompletedRun.error.source_pack_id ? <span>Source pack: {status.latestCompletedRun.error.source_pack_id}</span> : null}
    <span>{status.latestCompletedRun.error.suggested_next_action}</span>
    <Button onClick={runDiscovery} type="button" variant="outline">重试失败步骤</Button>
  </section>
) : null}
```

- [ ] **Step 2: Add CSS**

Add:

```css
.failure-panel {
  background: hsl(var(--destructive) / 0.08);
  border: 1px solid hsl(var(--destructive) / 0.35);
  border-radius: var(--radius);
  display: grid;
  gap: 8px;
  margin: 0 auto 16px;
  max-width: 1440px;
  padding: 14px;
}
```

- [ ] **Step 3: Verify build**

Run:

```bash
pnpm --filter @mind-wiki/workbench lint
pnpm --filter @mind-wiki/workbench build
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/workbench/src/App.tsx apps/workbench/src/styles.css
git commit -m "feat: show workbench pipeline failures"
```
