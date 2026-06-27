# AI Progress Weekly Digest Design

Date: 2026-06-23
Status: Draft
Project: mind_wiki
Source design: `/Users/walter/.gstack/projects/mind_wiki/walter-unknown-design-20260623-122236.md`

## Summary

Build a Next.js website that helps the user understand AI progress as a living system. The site starts from questions, not a database. The default question is:

> What changed this week?

The answer is a brief-first weekly synthesis supported by event cards. Headline events route primarily into trajectory pages so the user learns patterns over time instead of reading isolated news items.

V1 also includes an AI-assisted local curation pipeline. A local Codex CLI agent uses repo-scoped agent skills to discover sources, run extraction, draft structured event cards, and prepare review artifacts. The user approves cards before they become public MDX content.

## Goals

- Help the user understand weekly AI progress in under 10 minutes.
- Connect new events to long-running technical and commercial trajectories.
- Preserve weak signals without cluttering the weekly brief.
- Let one event appear in weekly briefs, trajectory pages, provider views, and causal links without duplicate writing.
- Use AI assistance to reduce curation labor while keeping human approval before publication.

## Non-Goals

- No public admin UI in v1.
- No automatic publishing.
- No database requirement in v1.
- No auth in v1.
- No fully automated crawler that decides what matters without user review.
- No browser-side web search, model calls, extraction, or direct writes to approved MDX.
- No agents/tools or robotics content trajectory pages in the first release.

## Information Architecture

### Home: Question Router

The homepage is organized around learning questions.

Default route:

- What changed this week?

Secondary routes:

- Where does this fit in AI history?
- Why did this happen?
- Which provider moved?

The default route opens the latest weekly brief. Secondary routes point into trajectory and provider views.

Navigation:

- 本周
- 长期趋势
- 因果链
- 提供方
- 来源

Global navigation stays question-oriented. It should not expose the four trajectory choices as a repeated sidebar group on every page.

### Weekly Brief Page

One page per week. The page starts with a sharp weekly thesis, followed by evidence.

Sections:

- Weekly thesis
- 5-8 headline event cards
- Watchlist of smaller items that are not headline-worthy yet but should be tracked for future patterns
- Source trail
- Closing synthesis

Voice:

- Two-layer voice.
- Top line can be opinionated.
- Evidence and causal claims must carry confidence labels: `observed`, `likely`, or `speculative`.

### Trajectory Pages

The primary drill-down from headline event cards is the relevant trajectory page.

V1 trajectories:

- LLM architecture
- Multimodal architecture
- Provider releases
- Commercial forces

Each trajectory page includes:

- A concept primer explaining what the trajectory is and why it matters.
- A chronological timeline of related events.
- Event cards that explain why each event matters inside that trajectory.
- Filters for provider, event type, confidence, and watchlist status.

Future trajectories:

- Agents/tools
- Robotics/embodied AI

### Event Detail Drawer

Event pages are not the primary drill-down. Instead, the UI provides a compact event detail drawer or panel.

The drawer shows:

- Summary
- Why it matters
- Source links
- Confidence label
- Related trajectories
- Provider tags
- Causal links

The drawer must preserve browsing context so the user can inspect an event without losing their place in a trajectory.

### Provider View

Provider views are lightweight in v1.

They show provider/model release lineage for major AI providers such as:

- OpenAI
- Anthropic
- Google
- Meta
- Nvidia, when the event is commercial or infrastructure related

Provider views are generated from event tags rather than a separate data model.

## Content Model

Use separate MDX event files plus weekly brief files.

### Event Files

Each event is a reusable MDX file. Required fields:

- `id`
- `title`
- `date`
- `type`: one of `paper`, `model_release`, `architecture`, `business`, `infra`, `benchmark`, `regulation`, `product`
- `summary`
- `why_it_matters`
- `trajectories`: one or more of `llm_architecture`, `multimodal_architecture`, `provider_releases`, `commercial_forces`
- `sources`: list of source objects with title, URL, and source type
- `confidence`: one of `observed`, `likely`, `speculative`
- `watchlist`: boolean

Optional fields:

- `providers`
- `causal_links`
- `related_events`

### Weekly Brief Files

Weekly brief files reference event IDs rather than duplicating event content.

Required fields:

- Week start date
- Week end date
- Weekly thesis
- Headline event IDs
- Watchlist event IDs
- Closing synthesis

## Collection And Curation Pipeline

V1 includes a local AI-assisted curation pipeline driven by Codex CLI, not by the browser. The local workbench displays state and activates approved actions, but the backend orchestration happens in a local command wrapper that invokes Codex CLI with repo-local agent skills.

Pipeline shape:

```text
Workbench action
  -> local backend command
  -> Codex CLI agent
  -> repo-local skill
  -> filesystem curation state
  -> workbench display
```

### Automatic Source Discovery

The normal V1 flow does not require the user to manually add source URLs. The local agent discovers candidate sources from configured source packs.

Source packs include:

- RSS feeds from provider blogs, arXiv, Hugging Face papers, leaderboard updates, infrastructure sources, and business/news sources.
- Web search queries for weekly model releases, GPU supply, Nvidia investment, multimodal models, LLM architecture, benchmark shifts, and related AI progress topics.
- Source type, trajectory hints, cadence, trusted domains, excluded domains, and dedupe key strategy.

Default tooling:

- Web search: local-first SearXNG adapter.
- RSS: Node/TypeScript RSS parser such as `rss-parser`.
- Optional later hosted search adapters: Tavily, Brave Search, or another web-search API behind the same local adapter boundary.

The local agent normalizes candidate URLs, removes duplicates, classifies likely trajectories, records why each candidate was found, and passes reviewable candidates into extraction.

### Repo-Local Agent Skills

V1 defines repo-local skills under `.agents/skills` as workflow contracts for Codex CLI:

- `ai-source-pack-curator`: maintain RSS feeds, search queries, cadence, source type, trajectory tags, and dedupe rules.
- `ai-weekly-discovery`: run RSS and web search discovery and write discovery records.
- `ai-source-quality-auditor`: evaluate extraction quality, source credibility, duplicates, missing evidence, and suspicious domains.
- `ai-draft-reviewer`: validate event drafts against schema, Chinese quality, source support, and confidence labels.
- `ai-causal-chain-editor`: create or refine structured commercial-to-technical causal links.
- `ai-weekly-brief-builder`: turn approved events into weekly brief proposals.

These skills guide local Codex CLI runs. They cannot publish directly, bypass review, call browser-side APIs, or write public content without explicit user approval.

### Open-Source Extraction

Primary extractor:

- Crawl4AI, because it is designed for LLM-ready Markdown, browser-backed crawling, structured extraction, citations, and source capture.

Fallback extractor:

- Trafilatura, for simpler static article-like pages.

Extraction output should be stored as raw Markdown or structured raw artifacts separate from approved MDX content.

Extraction failures must be visible. A failed or low-quality extraction cannot silently create an event card.

### Curation State Records

Local filesystem state includes:

- `SourcePack`: name, enabled flag, RSS feeds, web search queries, source type, trajectory hints, cadence, trusted domains, excluded domains, and dedupe key strategy.
- `DiscoveryRecord`: discovered URL, normalized URL, source pack, discovery method, reason found, trajectory classification, duplicate status, confidence, status, timestamps, and errors.
- Raw extraction output, quality reports, draft JSON, invalid AI output, rejected items, duplicate warnings, and JSONL run logs.

Visible pipeline states:

- `idle`
- `discovering`
- `discovered`
- `extracting`
- `extracted`
- `low-quality`
- `drafting`
- `draft-invalid`
- `ready-for-review`
- `approved`
- `rejected`
- `failed`

Named failures:

- RSS timeout
- Invalid RSS feed
- Search provider unavailable
- Search quota or rate limit
- Zero search results
- Duplicate flood
- Blocked or private URL
- Extraction failure
- Low-quality extraction
- Malformed AI output
- Schema-invalid draft

### AI Assistant Drafting

The AI assistant reads extracted source material and proposes draft event cards.

Draft fields:

- Event title
- Summary
- Why it matters
- Trajectory tags
- Provider tags
- Source list
- Confidence label
- Possible causal links

### Human Review Gate

The user approves, edits, or rejects every draft.

Rules:

- Unapproved drafts never appear on public pages.
- Approved drafts become MDX event files.
- Weekly briefs reference approved event IDs.
- The assistant may suggest a weekly thesis, but the user approves it before publication.

## Technical Architecture

Use Next.js with MDX content and a static-first build.

Core pieces:

- Content collections for events and weekly briefs.
- Frontmatter validation for required fields and allowed enum values.
- Static routes for home, weekly briefs, trajectories, providers, and sources.
- Client-side explorer interactions for filtering by trajectory, provider, event type, confidence, and watchlist.
- Event detail drawer for compact inspection.
- Relationship overlays for related trajectories, provider releases, and causal links.
- Local backend command wrapper for workbench-triggered pipeline actions.
- Codex CLI as the local agent orchestrator for discovery, extraction, quality review, drafting, causal-link editing, and weekly brief proposal building.
- Repo-local `.agents/skills` used by Codex CLI for pipeline-specific workflows.

The public website reads only approved content. Raw extraction output and unapproved drafts stay local.

The browser workbench is thin. It can trigger local commands through the local backend and read curation state for display, but it must not call web search, OpenAI-compatible APIs, Crawl4AI, Trafilatura, or write approved MDX directly.

## UI System

The UI should use shadcn/ui as the standard component system for both the static public site and the local workbench.

### UI Thesis

The interface is a Chinese research cockpit for understanding AI progress. It should feel dense, calm, source-aware, and fast to scan.

The site should not feel like:

- A generic SaaS dashboard.
- A marketing landing page.
- A database museum.
- A decorative AI-news magazine.

The first screen should keep the weekly research question visible:

> 本周 AI 发生了什么，它在长期趋势中意味着什么？

### shadcn/ui Setup

Use shadcn/ui with Next.js App Router and pnpm.

In a monorepo, run shadcn/ui commands from the target app directory or use the shadcn workspace config path for the target app.

Initial v1 component set:

- `button`
- `card`
- `badge`
- `tabs`
- `sheet`
- `sidebar`
- `separator`
- `scroll-area`
- `command`
- `input`
- `textarea`
- `select`
- `checkbox`
- `toggle-group`
- `empty`
- `skeleton`
- `progress`
- `sonner`
- `table` or `data-table`, only for dense local workbench review lists

### Component Map

Use shadcn/ui components deliberately:

- `Sidebar`: persistent desktop navigation and question router.
- `Tabs` or `ToggleGroup`: question modes and trajectory switching.
- `Card`: event cards, weekly brief panels, trajectory previews, and workbench review items.
- `Badge`: confidence labels, event types, trajectories, providers, source counts, and watchlist status.
- `Sheet`: event detail drawer and local workbench detail inspection.
- `Command`: fast navigation/search across weeks, providers, trajectories, and event IDs.
- `Empty`: empty trajectory, no matching filters, no sources, no drafts, and no queue states.
- `Skeleton` and `Progress`: extraction, drafting, and weekly brief builder states.
- `Sonner`: local workbench status toasts for extraction, draft generation, approval, rejection, and retry actions.
- `Table` or `Data Table`: local-only draft/source review lists where density is useful.

### Public Site Layout

The public site should use a persistent sidebar on desktop and a collapsed/mobile navigation pattern on small screens.

Sidebar groups:

- Questions
  - 本周 AI 发生了什么？
  - 长期趋势是什么？
  - 商业如何影响技术？
  - 哪家公司在移动？
  - 这些判断来自哪里？
- Views
  - Sources, approved event source metadata only
  - Causal chains

The four trajectory choices appear contextually inside `/trajectories` and `/trajectories/[trajectory]`, not as a global sidebar group. Public Sources must never expose source packs, discovery candidates, raw extracts, run logs, or local curation state.

Homepage structure:

1. Weekly question and thesis.
2. Confidence and source metadata as badges.
3. Headline event cards.
4. Watchlist cards, visually lower priority.
5. Causal-chain panel.
6. Trajectory preview or timeline panel.

### Local Workbench Layout

The local workbench should use the same shadcn/ui tokens and components as the public site, but it can be denser and more operational.

Workbench first viewport hierarchy:

1. Pipeline status and control bar: current run state, last run time, `Run discovery`, retry, and stale-run indicator.
2. Source pack health: enabled packs, feed/search status, last successful discovery, and failing packs.
3. Discovery candidate queue: candidate URL, source-pack origin, discovery reason, duplicate status, trajectory classification, and next action.
4. Quality and draft review: extraction quality reports, invalid outputs, draft cards, approve/reject/retry controls.
5. Causal-link editor: structured commercial-to-technical links tied to candidate or approved events.
6. Weekly brief builder: approved event selection and weekly brief proposal state.

Workbench state mapping:

| Pipeline state | Chinese label | Badge tone | Primary action | Empty or error copy |
| --- | --- | --- | --- | --- |
| `idle` | 待运行 | neutral | `Run discovery` | 还没有运行本周发现流程。 |
| `discovering` | 正在发现 | progress | disabled running button | 正在通过 RSS 和 web search 查找候选来源。 |
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

The local workbench must remain local-only and must not be included in the static public export.

`Run discovery` behavior:

- While a run is active, the trigger is disabled and shows progress instead of allowing duplicate runs.
- If a run fails, the workbench shows the named failure, affected source pack, timestamp, and retry action.
- Stale run logs remain visible so the user can tell whether the displayed queue is current.
- Retrying a failed step must not clear previous discovery records or quality reports.

### Visual Tone

- Use a restrained research-notebook palette with named roles: paper surface, ink text, muted border, mono metadata, serif thesis/headline treatment, and restrained confidence badge tones.
- Prefer warm off-white or paper surfaces, near-black active states, high-contrast body text, quiet borders, and semantic confidence colors.
- Metadata such as dates, source counts, confidence, and run status can use compact mono styling.
- Thesis, section headlines, and weekly synthesis can use a serif-style treatment through local/system fallbacks only.
- Avoid purple gradient themes, beige/brown palettes, decorative blobs, and marketing-page hero treatments.
- Keep card radius at 8px or less.
- Avoid nested cards. Use spacing, separators, and section headings instead.
- Make Chinese body copy comfortable for long-form reading. Do not use tiny body text for weekly synthesis.

### Responsive Behavior

- Desktop: persistent sidebar plus two-column research cockpit where useful.
- Tablet: sidebar may collapse; secondary panels move below the primary content.
- Mobile: question, thesis, event cards, filters, and timelines stack in one column.
- Sheets should fill most of the mobile viewport and remain keyboard accessible.

### Accessibility

- Event cards and timeline items must be keyboard reachable.
- Sheet close must be keyboard reachable and visible.
- Confidence must not rely on color alone; show text labels.
- Filters need visible labels and focus states.
- Empty and error states must explain what happened and what the user can do next.

## UI Behavior

### Home

The home page defaults to the latest weekly brief.

It should make the latest weekly thesis immediately visible, then show event cards grouped as:

- Headline cards
- Watchlist

The home page should use the research cockpit layout from the UI system:

- Sidebar question router on desktop.
- Weekly thesis panel.
- Headline event card group.
- Watchlist card group.
- Causal-chain panel.
- Trajectory preview panel.

### Event Cards

Headline event cards show:

- Title
- Date
- One-line summary
- Event type
- Primary trajectory
- Provider, when present
- Confidence label
- Source count

Headline event cards use shadcn/ui `Card` and `Badge` components.

The card's primary action opens the event detail `Sheet`. A secondary text link, `View in trajectory`, routes to the primary trajectory page and highlights that event in context. Do not make the same card click both navigate and open details.

The detail sheet shows:

- Summary
- Why it matters
- Source links
- Confidence badge
- Related trajectories
- Provider tags
- Causal links

### Trajectory Pages

Each trajectory page starts with a concept primer, then a timeline.

The timeline supports:

- Event type filtering
- Provider filtering
- Confidence filtering
- Watchlist toggle
- Event detail drawer

Trajectory pages use shadcn/ui `Tabs` or `ToggleGroup` for trajectory switching, `Select` and `Checkbox` for filters, and `Empty` when a filter combination has no matching events.

The timeline should be custom layout built from shadcn/ui primitives, not a heavy chart library in v1.

### Causal Chain View

The causal-chain view is first-class in v1.

It should use compact linked panels rather than a graph database visualization.

Each causal chain item shows:

- Event or concept title
- Relationship type
- Confidence badge
- Source count
- Short explanation in Chinese

### Local Workbench UI

The local workbench uses shadcn/ui for:

- Source pack management
- Discovery activation and candidate review
- Queue progress
- Extraction quality reports
- Draft review lists
- Invalid output inspection
- Approval, rejection, retry, and causal-link editing
- Weekly brief builder states

The workbench should use `Progress`, `Skeleton`, `Empty`, `Table` or `Data Table`, `Sheet`, `Textarea`, `Select`, and `Sonner` for these states.

### Confidence Labels

Causal claims must visibly indicate confidence:

- `observed`: directly supported by a source
- `likely`: plausible synthesis from multiple signals
- `speculative`: useful hypothesis, not established fact

## Seed Content

V1 needs enough content to make the four trajectories useful.

Minimum seed target:

- At least 3 approved events per trajectory.
- At least one complete weekly brief.
- At least one commercial-to-technical causal chain.

Example anchor events:

- Transformer
- BERT
- GPT-3
- ChatGPT
- GPT-4
- CLIP
- Diffusion model breakthroughs
- Mamba or other non-Transformer sequence architectures
- Major open-weight model releases
- Nvidia or GPU-supply commercial inflection points

## Success Criteria

V1 is successful when:

- The user can trigger a local Codex CLI agent run from the workbench and automatically discover candidate sources through RSS and web search.
- The user can see discovered candidates, source-pack origin, discovery reason, duplicate status, trajectory classification, and failure records.
- The local agent can turn reviewable discovered candidates into draft event cards with AI assistance.
- The user can review and approve those cards into MDX without automatic publishing.
- A weekly brief can be published in under 60 minutes after candidate discovery finishes.
- The home page answers "What changed this week?" in under 10 minutes of reading.
- Each headline event routes into at least one of the four v1 trajectory pages.
- Each trajectory page has a concept primer and at least 3 seed events.
- Confidence labels are visible anywhere causal claims appear.
- Extraction failures are visible and recoverable.
- Watchlist items are visible but lower priority than headline cards.

## Testing

Content validation:

- Missing required event frontmatter fails clearly.
- Invalid event type, trajectory, or confidence value fails clearly.
- Weekly brief references to unknown event IDs fail clearly.

Extraction pipeline:

- Source packs produce discovery records or readable discovery failures.
- RSS timeout, invalid feed, search failure, rate limit, zero-result, duplicate-flood, and blocked/private URL paths are visible.
- Discovered candidate URLs pass through public URL validation before extraction.
- Reviewable discovered candidates produce stored raw Markdown or a readable extraction failure.
- Extraction failures do not create approved event files.
- Draft event output must include all required fields before it can be reviewed.

Local agent boundary:

- Workbench actions invoke a local backend command wrapper rather than browser-side search, model, or extractor calls.
- The command wrapper invokes Codex CLI with the relevant repo-local skill and run context.
- Codex CLI run results update filesystem curation state that the workbench displays.
- Static public output excludes workbench code, `.curation`, source packs, discovery records, raw extracts, drafts, logs, and API secrets.

Human review gate:

- Unapproved drafts never appear in public routes.
- Approved events appear in weekly briefs and trajectory pages.

Routes and UI:

- Weekly, trajectory, provider, and source routes build from approved content.
- Public sidebar does not show the four trajectory choices globally.
- `/trajectories` and `/trajectories/[trajectory]` expose trajectory choices contextually.
- Public Sources excludes source packs, discovery records, raw extracts, run logs, and local curation state.
- Trajectory, provider, type, confidence, and watchlist filters work together.
- Empty trajectory, no matching filters, missing sources, failed extraction, and watchlist-only week states are handled.
- Event drawer opens by keyboard, has visible focus states, and can be closed without losing context.
- Event card primary action opens details; trajectory navigation is a separate secondary action.
- Sidebar navigation works on desktop and mobile.
- Event detail `Sheet` opens and closes by keyboard.
- shadcn/ui `Empty` states render for no events, no drafts, no sources, and no matching filters.
- Confidence labels are visible as text, not color alone.
- Local workbench first viewport shows pipeline status, source pack health, and `Run discovery`.
- Running discovery disables duplicate triggers and shows progress.
- Discovery failure shows named failure, affected source pack, timestamp, and next action.
- Local workbench states render for extraction progress, extraction failure, invalid draft output, duplicate source warning, approved draft, rejected draft, and stale run logs.
- Mobile workbench has no horizontal overflow and keeps primary actions reachable.

## References

- Crawl4AI: https://github.com/unclecode/crawl4ai
- Trafilatura: https://trafilatura.readthedocs.io/en/latest/
- SearXNG: https://github.com/searxng/searxng
- rss-parser: https://github.com/rbren/rss-parser
- WCXB extraction benchmark: https://arxiv.org/abs/2605.21097
- shadcn/ui Next.js installation: https://ui.shadcn.com/docs/installation/next
- shadcn/ui components: https://ui.shadcn.com/docs/components
