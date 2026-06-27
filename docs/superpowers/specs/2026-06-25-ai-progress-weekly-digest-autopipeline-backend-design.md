# AI Progress Weekly Digest Autopipeline Backend Design

Date: 2026-06-25
Status: Draft
Project: mind_wiki
Source specs:

- `docs/superpowers/specs/2026-06-23-ai-progress-weekly-digest-design.md`
- `docs/superpowers/specs/2026-06-25-ai-progress-weekly-digest-ui-optimization.md`

## Summary

This specification optimizes the current AI Progress Weekly Digest project. It is not a greenfield backend redesign.

The backend goal is to turn the local workbench from a sample interface into a real activation surface for a local Codex CLI agent pipeline. The browser remains thin: it displays pipeline state and triggers approved local actions. It does not run web search, RSS discovery, extraction, model calls, Codex CLI, or approved-content writes directly.

V1 starts with a manual `Run discovery` action. Local scheduled runs are deferred until the manual pipeline is reliable.

## Product Boundary

Keep the current architecture:

- Static public Next.js site.
- Public site reads `content/approved` only.
- Local-only workbench.
- Filesystem curation state under `.curation`.
- Codex CLI local agent as the pipeline orchestrator.
- Repo-local `.agents/skills` as workflow contracts.
- Crawl4AI primary extraction and Trafilatura fallback.
- OpenAI-compatible API configured only in local backend or agent environment.

Do not add:

- Public admin UI.
- Browser-side model/search/extractor calls.
- Browser-side writes to approved MDX.
- Automatic publishing.
- Database requirement.
- Cloud crawler service.
- Unattended scheduled discovery in V1.

## Current Assets To Reuse

The current repo already has the foundation for the backend pipeline:

- `packages/curation/src/store.ts`: local `.curation` writes, draft approval, rejection, retry logs, safe approved MDX writes.
- `packages/curation/src/run-log.ts`: JSONL run logs.
- `packages/curation/src/queue.ts`: bounded extraction and drafting concurrency.
- `packages/curation/src/extractors.ts`: Crawl4AI / Trafilatura extraction boundary.
- `packages/curation/src/quality.ts`: extraction quality report logic.
- `packages/curation/src/draft.ts`: OpenAI-compatible draft generation and schema validation path.
- `apps/workbench`: local UI surface that should become the display and activation layer.

The backend design should extend these pieces instead of replacing them.

## Target Architecture

```text
Workbench UI
  -> local backend API
  -> safe command wrapper
  -> Codex CLI agent
  -> repo-local skill
  -> packages/curation helpers
  -> .curation filesystem state
  -> workbench display
```

### Backend Units

#### Local Backend Server

The local backend server is the only thing the workbench calls for pipeline actions. It should run on the developer machine and be excluded from static public export.

Responsibilities:

- Serve pipeline status to the workbench.
- Start a manual discovery run.
- Prevent duplicate active runs.
- Read source packs, discovery records, quality reports, drafts, rejected records, and run logs from `.curation`.
- Approve, reject, or retry draft records through `packages/curation` APIs.
- Never expose local API keys to the browser.

#### Codex CLI Runner

The runner is a narrow command wrapper, not a general shell.

Responsibilities:

- Invoke Codex CLI only with whitelisted pipeline skills.
- Pin `cwd` to the repo root.
- Pass structured input as JSON.
- Use a run ID for every invocation.
- Write stdout, stderr, status, and output references to `.curation`.
- Enforce timeouts.
- Return named failures when Codex CLI is unavailable, a skill is missing, output is malformed, or a command times out.

The runner must not accept arbitrary command strings from the browser.

#### Curation State Store

The filesystem remains the source of truth.

Existing state directories stay valid:

- `.curation/raw`
- `.curation/drafts`
- `.curation/invalid`
- `.curation/rejected`
- `.curation/quality-reports`
- `.curation/run-logs`

Add V1 backend state directories:

- `.curation/source-packs`
- `.curation/discovery-records`
- `.curation/pipeline-runs`
- `.curation/agent-outputs`

These folders are local-only and must never appear in static public output.

## Manual Discovery Flow

`Run discovery` is the first real pipeline action.

```text
User clicks Run discovery
  -> workbench POST /api/pipeline/discovery/run
  -> backend checks no active run
  -> backend creates PipelineRun record
  -> backend invokes Codex CLI with ai-weekly-discovery
  -> agent reads source packs
  -> agent discovers RSS and web search candidates
  -> agent writes DiscoveryRecord files
  -> backend/workbench shows discovered candidates
  -> extraction and drafting stages run through approved local actions
  -> user reviews drafts
  -> user approves or rejects
  -> approved content writes to content/approved
```

The public site never reads discovery records, drafts, raw extracts, quality reports, source packs, or run logs.

## Repo-Local Agent Skills

The backend assumes these repo-local skills exist under `.agents/skills` as pipeline contracts:

- `ai-source-pack-curator`: maintain RSS feeds, search queries, cadence, source type, trajectory tags, trusted domains, excluded domains, and dedupe rules.
- `ai-weekly-discovery`: run RSS and web search discovery and write discovery records.
- `ai-source-quality-auditor`: evaluate extraction quality, source credibility, duplicates, missing evidence, and suspicious domains.
- `ai-draft-reviewer`: validate event drafts against schema, Chinese quality, confidence labels, and source support.
- `ai-causal-chain-editor`: create or refine structured commercial-to-technical causal links.
- `ai-weekly-brief-builder`: turn approved events into weekly brief proposals.

Skills guide Codex CLI behavior. They do not bypass the human approval gate.

## Data Contracts

Use Zod schemas for all records that cross the backend, curation store, and workbench boundary.

### SourcePack

`SourcePack` describes where discovery should look.

Fields:

- `id`
- `name`
- `enabled`
- `rss_feeds`: array of feed URLs
- `web_search_queries`: array of query strings
- `source_type`: `provider_blog`, `paper`, `leaderboard`, `business`, `infra`, `news`, or `mixed`
- `trajectory_hints`: array of approved trajectory IDs
- `cadence`: `manual`, `daily`, `weekly`, or `monthly`
- `trusted_domains`
- `excluded_domains`
- `dedupe_strategy`: `normalized_url`, `canonical_url`, `title_date`, or `source_event`
- `notes`
- `created_at`
- `updated_at`

For V1, `cadence` may be stored but only `manual` is active.

### DiscoveryRecord

`DiscoveryRecord` describes a candidate source found by RSS or web search.

Fields:

- `id`
- `run_id`
- `source_pack_id`
- `discovered_url`
- `normalized_url`
- `canonical_url`
- `title`
- `discovery_method`: `rss` or `web_search`
- `reason_found`
- `source_type`
- `trajectory_classification`
- `duplicate_status`: `new`, `same_url`, `same_event`, `cross_event`, or `ignored`
- `confidence`: `observed`, `likely`, or `speculative`
- `status`: pipeline state
- `errors`
- `created_at`
- `updated_at`

### PipelineRun

`PipelineRun` tracks a local agent invocation.

Fields:

- `id`
- `type`: `discovery`, `extraction`, `drafting`, `quality_audit`, `causal_chain`, or `weekly_brief`
- `status`: `idle`, `running`, `succeeded`, `failed`, or `cancelled`
- `stage`: visible pipeline state
- `trigger`: `manual_workbench`
- `skill_name`
- `started_at`
- `ended_at`
- `input_summary`
- `output_refs`
- `error`

Only one `discovery` run may be active at a time.

### Pipeline States

Use the same state language as the UI optimization spec:

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

Each state must have a Chinese label, badge tone, next action, and error or empty copy in the workbench.

## Local Backend API

These endpoints define the workbench-to-backend contract. Exact framework choice is implementation detail.

### Status

- `GET /api/pipeline/status`
- Returns active run, latest completed run, stale-state flag, visible stage, and counts for candidates, drafts, failures, and ready-for-review items.

### Discovery

- `POST /api/pipeline/discovery/run`
- Starts a manual `ai-weekly-discovery` Codex CLI run.
- Fails with `active_run_exists` if another discovery run is active.

### Source Packs

- `GET /api/source-packs`
- Returns local source pack health and metadata.
- `POST /api/source-packs/:id/enable`
- `POST /api/source-packs/:id/disable`

Source pack editing can stay minimal in V1. Full source pack authoring may be handled by the `ai-source-pack-curator` skill.

### Discovery Records

- `GET /api/discovery-records`
- Supports filters for run, source pack, method, trajectory, duplicate status, quality status, and pipeline state.

### Draft Review

- `GET /api/drafts`
- `GET /api/drafts/:id`
- `POST /api/drafts/:id/approve`
- `POST /api/drafts/:id/reject`
- `POST /api/drafts/:id/retry`

Approval must go through existing safe approval behavior:

- validate draft exists
- validate approved MDX
- validate filename safety
- reject overwrite collisions
- write to `content/approved/events`
- append run log

### Logs

- `GET /api/pipeline/runs`
- `GET /api/pipeline/runs/:id`
- `GET /api/run-logs`

Logs should be visible in the local workbench and excluded from public export.

## Command Runner Contract

The command wrapper receives a structured request:

```json
{
  "run_id": "run_2026_06_25_001",
  "skill_name": "ai-weekly-discovery",
  "cwd": "/Volumes/X320/code/study/mind_wiki",
  "input_path": ".curation/pipeline-runs/run_2026_06_25_001/input.json",
  "output_dir": ".curation/agent-outputs/run_2026_06_25_001",
  "timeout_ms": 600000
}
```

Allowed skills:

- `ai-source-pack-curator`
- `ai-weekly-discovery`
- `ai-source-quality-auditor`
- `ai-draft-reviewer`
- `ai-causal-chain-editor`
- `ai-weekly-brief-builder`

Allowed environment variables:

- `OPENAI_BASE_URL`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `SEARXNG_BASE_URL`
- extractor-specific local configuration needed by Crawl4AI or Trafilatura

The backend must never return secret environment values to the browser.

## Failure Handling

Failures are first-class records, not console-only events.

Named failures:

- `codex_cli_unavailable`
- `skill_missing`
- `command_timeout`
- `active_run_exists`
- `rss_timeout`
- `invalid_rss_feed`
- `search_provider_unavailable`
- `search_quota_or_rate_limit`
- `zero_search_results`
- `duplicate_flood`
- `blocked_or_private_url`
- `extraction_failure`
- `low_quality_extraction`
- `model_api_failure`
- `malformed_ai_output`
- `schema_invalid_draft`
- `approved_file_collision`

Each failure record must include:

- failure code
- Chinese user-facing message
- source pack or record reference when available
- timestamp
- suggested next action
- raw diagnostic reference stored locally, not shown by default

## Security And Safety

The backend is local-only, but it still needs strict boundaries.

Rules:

- Bind to localhost only.
- Do not expose secrets in API responses, logs intended for UI, screenshots, or static output.
- Whitelist Codex CLI skills instead of accepting command strings.
- Validate record IDs and paths before reading or writing.
- Keep all `.curation` paths under the repo root.
- Reuse approved URL validation before extraction.
- Block private, localhost, and unsupported URL schemes from source extraction unless explicitly allowed for tests.
- Do not auto-approve AI output.
- Do not let Codex CLI runs write directly to `content/approved` except through explicit approval APIs.

## Workbench UX Requirements

The backend must support the current UI optimization target:

- First viewport shows pipeline status and `Run discovery`.
- `Run discovery` is disabled while a run is active.
- Active run shows current stage, start time, and progress copy.
- Failure states show named failure, source pack, timestamp, and retry action.
- Candidate queue shows discovered URL, source pack, method, reason found, trajectory classification, duplicate status, quality status, and next action.
- Draft review shows validation status, source support, confidence, and approve/reject/retry actions.
- Public Sources remains approved-source metadata only and never shows source packs or discovery records.

## Implementation Acceptance Tests

Unit tests:

- `SourcePack`, `DiscoveryRecord`, and `PipelineRun` schema validation.
- Pipeline state transition validation.
- Duplicate active discovery run prevention.
- Command runner skill whitelist.
- Safe path and record ID validation.
- Secret redaction from API responses.

Integration tests:

- `Run discovery` creates a `PipelineRun` and invokes mocked Codex CLI.
- Missing Codex CLI returns `codex_cli_unavailable`.
- Missing skill returns `skill_missing`.
- Timeout returns `command_timeout` and preserves logs.
- Malformed agent output is saved under `.curation/invalid`.
- Discovery records are readable through backend API.
- Approval writes only through existing safe `approveDraft` path.

Playwright tests:

- Workbench first viewport shows pipeline status, source pack health, and `Run discovery`.
- Clicking `Run discovery` disables duplicate trigger while active.
- Successful mocked discovery shows candidate records.
- Failure shows Chinese failure copy, source pack, timestamp, and retry action.
- Public site export does not include `.curation`, source packs, discovery records, drafts, raw extracts, logs, workbench routes, or API secrets.

## Deferred Work

- Local scheduled discovery.
- Source pack visual authoring beyond enable/disable and health display.
- Hosted search adapters beyond the local adapter boundary.
- Multi-user review, auth, or cloud deployment.
- Automatic weekly publishing.
- Database-backed queue or workflow engine.

