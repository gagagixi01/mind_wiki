# AI Progress Weekly Digest UI Optimization Spec

Date: 2026-06-25
Status: Draft
Project: mind_wiki
Source spec: `docs/superpowers/specs/2026-06-23-ai-progress-weekly-digest-design.md`

## Summary

This specification optimizes the current AI Progress Weekly Digest UI. It is not a greenfield redesign.

The current product direction stays intact:

- Static public Next.js site.
- Local-only workbench.
- shadcn/ui component system.
- Codex CLI local-agent pipeline.
- Public site reads approved content only.

The optimization goal is to make the existing UI clearer, more editorial, and more operationally useful. The public site should feel like a Chinese research cockpit for reading AI progress. The local workbench should feel like a calm operations cockpit for triggering and reviewing local Codex CLI agent runs.

## Design Principles

- Start from reader questions, not feature categories.
- Make the current state visible before asking the user to act.
- Keep trajectory navigation contextual instead of repeating trajectory controls everywhere.
- Separate public evidence from local curation state.
- Use dense layouts only when density helps scanning.
- Let shadcn/ui provide interaction primitives, but tune the surface so it does not look like a generic SaaS dashboard.

Avoid:

- Marketing-page hero treatment.
- Purple gradients, decorative blobs, and ornamental cards.
- Repeated global trajectory panels.
- Card grids that only decorate sections.
- Browser-side model, search, extractor, or approved-content writes.

## Visual System

The visual language should be an editorial research cockpit:

- `paper surface`: warm off-white or quiet paper background for the public site.
- `ink text`: near-black text for strong reading hierarchy and active states.
- `muted border`: quiet dividers instead of heavy card chrome.
- `mono metadata`: compact mono treatment for dates, source counts, confidence, run status, and source-pack metadata.
- `serif headline`: local/system serif-style treatment for weekly thesis, main headlines, and synthesis callouts.
- `status colors`: restrained semantic tones for observed, likely, speculative, warning, destructive, and success states.

Use card radius at 8px or less. Avoid nested cards. Prefer bands, separators, tables, sheets, and section rhythm over stacked floating panels.

Typography should prioritize Chinese reading:

- Body text must be comfortable for long-form Chinese reading.
- Metadata can be smaller and mono, but never too low contrast.
- Weekly thesis and major synthesis should have stronger editorial presence than event metadata.
- Do not depend on Google Fonts or external font loading.

## Public Site Optimization

### Navigation

Global navigation labels:

- `本周`
- `长期趋势`
- `因果链`
- `提供方`
- `来源`

The sidebar should act as a reader-question router. It must not show the four trajectory choices as a global group on every page.

The four trajectory choices appear only where they are contextual:

- `/trajectories`: overview and chooser for the four trajectories.
- `/trajectories/[trajectory]`: current trajectory header with compact switching.

### Home

The home page should optimize the current reading flow, top to bottom:

1. Latest weekly brief.
2. Main thesis or `本周主线`.
3. Headline event stream.
4. Watchlist, lower visual priority.
5. Causal-chain context or “why it matters” synthesis.

The homepage should not read like a generic dashboard. It should give the reader a clear 10-minute path: what happened, why it matters, where it fits historically, and what to watch next.

### Event Cards And Sheet

Event card primary action: open the event detail `Sheet`.

Event card secondary action: `View in trajectory`, which routes to the primary trajectory context and highlights the event.

Do not make the same card click both navigate and open details.

Event cards should show:

- Title.
- Date.
- One-line summary.
- Event type.
- Primary trajectory.
- Provider, when present.
- Confidence label.
- Source count.

The event `Sheet` should make `为什么关键` a first-class section, followed by summary, source links, confidence, related trajectories, provider tags, and causal links.

### Long-Term Trends

`长期趋势是什么` should avoid repeated panels. The overview page should show the four trajectory reading sections top-to-bottom, not as a duplicated card row plus repeated sections.

Each trajectory section should include:

- Trajectory name.
- Concept explanation.
- Key historical anchors.
- Current-week relevance.
- Next watch question.
- Link to focus that trajectory.

Trajectory detail pages should show `当前轨迹` clearly and keep route-scoped filters from feeling like global filters.

### Public Sources

The public Sources page shows approved event source metadata only.

It must never expose:

- Source packs.
- Discovery records.
- Raw extracts.
- Drafts.
- Rejected items.
- Run logs.
- Local `.curation` state.

## Local Workbench Optimization

The workbench is a local display and activation layer for the Codex CLI agent pipeline. It does not run the pipeline in the browser.

First viewport hierarchy:

1. Pipeline status and control bar.
2. Source pack health.
3. Discovery candidate queue.
4. Quality and draft review.
5. Causal-link editor.
6. Weekly brief builder.

The first screen must answer:

- Is the pipeline idle, running, stale, failed, or ready for review?
- What action is available now?
- Which source packs are healthy or failing?
- Which discovered candidates need attention?

### Run Discovery

`Run discovery` is the primary workbench action.

Rules:

- Disabled while a run is active.
- Shows progress while running.
- Shows active run timestamp and current stage.
- Shows stale-run indicator when the displayed state is old.
- On failure, shows named failure, source pack, timestamp, and retry action.
- Retry must not clear previous discovery records, quality reports, or logs.

### Pipeline State Mapping

| State | Chinese label | Badge tone | Primary action | User-facing copy |
| --- | --- | --- | --- | --- |
| `idle` | 待运行 | neutral | `Run discovery` | 还没有运行本周发现流程。 |
| `discovering` | 正在发现 | progress | disabled | 正在通过 RSS 和 web search 查找候选来源。 |
| `discovered` | 已发现候选 | info | review candidates | 查看候选来源、重复状态和轨迹分类。 |
| `extracting` | 正在抽取 | progress | disabled | Crawl4AI / Trafilatura 正在抽取内容。 |
| `extracted` | 已抽取 | success | generate draft | 可以进入质量检查和草稿生成。 |
| `low-quality` | 质量偏低 | warning | retry or reject | 抽取内容不足以生成可靠事件。 |
| `drafting` | 正在起草 | progress | disabled | 正在生成中文结构化草稿。 |
| `draft-invalid` | 草稿无效 | warning | inspect errors | AI 输出未通过 schema 或中文质量校验。 |
| `ready-for-review` | 待人工审核 | info | approve or reject | 需要人工判断是否进入公开内容。 |
| `approved` | 已批准 | success | build weekly brief | 已可进入 `content/approved`。 |
| `rejected` | 已拒绝 | neutral | retry if useful | 已保留拒绝原因和来源记录。 |
| `failed` | 运行失败 | destructive | retry failed step | 查看失败类型、source pack 和下一步建议。 |

### Source Pack Health

Source pack cards or rows should show:

- Name.
- Enabled or disabled.
- Feed/search type.
- Last successful run.
- Last failure.
- Candidate count.
- Duplicate count.
- Next action.

Source pack controls can be compact. They should not dominate the workbench unless there is a failure.

### Candidate Queue

The candidate queue should be table-like on desktop and card-like on mobile.

Each candidate should show:

- Normalized URL or source title.
- Source pack origin.
- Discovery method.
- Reason found.
- Duplicate status.
- Trajectory classification.
- Quality status.
- Next action.

Wide tables must be wrapped or transformed on mobile. No horizontal page overflow.

## shadcn/ui Component Usage

Use shadcn/ui components as interaction primitives:

- `Sidebar`: public question routing and local workbench navigation.
- `Card`: event cards and reviewable items only when the card is the interaction.
- `Badge`: event type, confidence, provider, source count, pipeline state, duplicate state.
- `Sheet`: event details and local record inspection.
- `Command`: fast navigation and search across weeks, providers, trajectories, event IDs, and local workbench records.
- `Empty`: no events, no drafts, no source packs, no candidates, no matching filters.
- `Skeleton`: loading states that match final dimensions.
- `Progress`: active local agent run progress.
- `Sonner`: short local status feedback.
- `Table/Data Table`: dense candidate, draft, and quality-review lists.
- `Tabs/ToggleGroup`: trajectory switching and workbench modes where scope is obvious.
- `Select`, `Checkbox`, `Textarea`: filters, state controls, review notes, and causal-link editing.

Do not use a heavy chart or graph library in V1. Causal chains should be compact linked panels.

## Responsive Rules

Desktop:

- Persistent sidebar.
- Editorial/public pages may use two-column layouts where it improves reading.
- Workbench can use denser grids and tables.

Tablet:

- Sidebar may collapse.
- Secondary panels move below primary content.
- Workbench status/control bar stays first.

Mobile:

- Single-column public reading flow.
- Candidate queue becomes stacked cards or horizontally contained tables.
- `Run discovery`, approve, reject, retry, and Sheet close remain reachable.
- Touch targets are at least 44px.
- No horizontal overflow.

## Accessibility And Interaction States

Required states:

- Hover.
- Focus-visible.
- Pressed/active.
- Disabled.
- Loading.
- Empty.
- Error.
- Success.

Requirements:

- Confidence and pipeline status must include text, not color alone.
- Event Sheet opens and closes by keyboard.
- Focus returns to the triggering element after Sheet close.
- Disabled `Run discovery` must look disabled and explain why.
- Error copy must name the failure and suggest the next action.
- Skeleton dimensions should match final content layout.

## Implementation Acceptance Tests

Future implementation should verify:

- Public sidebar does not show the four trajectory choices globally.
- `/trajectories` and `/trajectories/[trajectory]` expose trajectory choices contextually.
- Home shows latest weekly brief, thesis, event stream, and causal context in that order.
- Event card primary action opens detail Sheet.
- `View in trajectory` is a separate secondary action.
- Public Sources excludes source packs, discovery records, raw extracts, drafts, rejected items, and logs.
- Workbench first viewport shows pipeline status, source pack health, and `Run discovery`.
- Running discovery disables duplicate trigger and shows progress.
- Discovery failure shows named failure, source pack, timestamp, and next action.
- Candidate queue is usable on mobile without horizontal page overflow.
- Static public export excludes workbench code and local curation state.

## Non-Goals

- Do not redesign the product from scratch.
- Do not add a public admin UI.
- Do not move local curation state into the public site.
- Do not make the browser call Codex CLI, web search, OpenAI-compatible APIs, Crawl4AI, or Trafilatura directly.
- Do not add agents/tools or robotics content trajectories in this UI pass.

