# AI Progress Weekly Digest Contracts And Curation Store Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add shared pipeline contracts and local `.curation` storage primitives used by the backend, workbench, and Codex agent skill governance.

**Architecture:** Extend `packages/core` with Zod schemas for pipeline records and skill reviews. Extend `packages/curation` with safe typed read/write helpers for new local-only state directories while preserving the existing `approveDraft` gate into `content/approved`.

**Tech Stack:** TypeScript, Zod, Vitest, Node filesystem APIs, pnpm workspace.

---

## Task 1: Pipeline Contract Schemas

**Files:**
- Modify: `packages/core/src/schema.ts`
- Modify: `packages/core/src/schema.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write failing schema tests**

Append this test block to `packages/core/src/schema.test.ts`:

```ts
import {
  discoveryRecordSchema,
  failureCodes,
  pipelineRunSchema,
  pipelineStateUiSchema,
  skillReviewRecordSchema,
  sourcePackSchema
} from "./schema";

describe("pipeline contracts", () => {
  it("accepts source packs for manual discovery", () => {
    expect(sourcePackSchema.parse({
      id: "provider-blogs",
      name: "Provider Blogs",
      enabled: true,
      rss_feeds: ["https://openai.com/news/rss.xml"],
      web_search_queries: ["site:openai.com AI model release this week"],
      source_type: "provider_blog",
      trajectory_hints: ["provider_releases"],
      cadence: "manual",
      trusted_domains: ["openai.com"],
      excluded_domains: ["spam.example"],
      dedupe_strategy: "normalized_url",
      notes: "Official provider releases.",
      created_at: "2026-06-25T00:00:00.000Z",
      updated_at: "2026-06-25T00:00:00.000Z"
    }).dedupe_strategy).toBe("normalized_url");
  });

  it("accepts discovery records with visible pipeline state", () => {
    expect(discoveryRecordSchema.parse({
      id: "disc-1",
      run_id: "run-1",
      source_pack_id: "provider-blogs",
      discovered_url: "https://openai.com/news/release",
      normalized_url: "https://openai.com/news/release",
      canonical_url: "https://openai.com/news/release",
      title: "Release note",
      discovery_method: "rss",
      reason_found: "Matched configured RSS feed.",
      source_type: "provider_blog",
      trajectory_classification: ["provider_releases"],
      duplicate_status: "new",
      confidence: "observed",
      status: "discovered",
      errors: [],
      created_at: "2026-06-25T00:00:00.000Z",
      updated_at: "2026-06-25T00:00:00.000Z"
    }).status).toBe("discovered");
  });

  it("accepts pipeline runs with named failures", () => {
    expect(failureCodes).toContain("active_run_exists");
    expect(pipelineRunSchema.parse({
      id: "run-1",
      type: "discovery",
      status: "failed",
      stage: "failed",
      trigger: "manual_workbench",
      skill_name: "ai-weekly-discovery",
      started_at: "2026-06-25T00:00:00.000Z",
      ended_at: "2026-06-25T00:01:00.000Z",
      input_summary: "Manual discovery.",
      output_refs: [".curation/agent-outputs/run-1/stderr.txt"],
      error: {
        code: "search_provider_unavailable",
        message_zh: "本地搜索服务不可用。",
        suggested_next_action: "启动 SearXNG 后重试。",
        diagnostic_ref: ".curation/agent-outputs/run-1/error.json"
      }
    }).error?.code).toBe("search_provider_unavailable");
  });

  it("maps visible states to workbench UI copy", () => {
    expect(pipelineStateUiSchema.parse({
      state: "ready-for-review",
      label_zh: "待人工审核",
      badge_tone: "info",
      primary_action: "approve_or_reject",
      copy_zh: "需要人工判断是否进入公开内容。"
    }).label_zh).toBe("待人工审核");
  });

  it("records skill reuse review evidence", () => {
    expect(skillReviewRecordSchema.parse({
      review_id: "review-1",
      target_skill: "ai-weekly-discovery",
      candidate_name: "rss-search-skill",
      candidate_source: "github",
      candidate_url: "https://github.com/example/rss-search-skill",
      license: "MIT",
      reviewed_files: ["SKILL.md"],
      capability_match: "partial match worth adapting",
      risk_level: "medium",
      decision: "reuse_pattern",
      reuse_mode: "adapt_github_skill",
      notes: "Reuse discovery pattern only.",
      reviewed_at: "2026-06-25T00:00:00.000Z"
    }).target_skill).toBe("ai-weekly-discovery");
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
pnpm --filter @mind-wiki/core test -- schema.test.ts
```

Expected: FAIL with missing exports for the pipeline schemas.

- [ ] **Step 3: Add schema constants and types**

Add to `packages/core/src/schema.ts` after existing draft schemas:

```ts
export const pipelineStates = ["idle", "discovering", "discovered", "extracting", "extracted", "low-quality", "drafting", "draft-invalid", "ready-for-review", "approved", "rejected", "failed"] as const;
export const pipelineRunTypes = ["discovery", "extraction", "drafting", "quality_audit", "causal_chain", "weekly_brief"] as const;
export const pipelineRunStatuses = ["idle", "running", "succeeded", "failed", "cancelled"] as const;
export const failureCodes = ["codex_cli_unavailable", "skill_missing", "command_timeout", "active_run_exists", "rss_timeout", "invalid_rss_feed", "search_provider_unavailable", "search_quota_or_rate_limit", "zero_search_results", "duplicate_flood", "blocked_or_private_url", "extraction_failure", "low_quality_extraction", "model_api_failure", "malformed_ai_output", "schema_invalid_draft", "approved_file_collision"] as const;
export const allowedPipelineSkillNames = ["ai-source-pack-curator", "ai-weekly-discovery", "ai-source-quality-auditor", "ai-draft-reviewer", "ai-causal-chain-editor", "ai-weekly-brief-builder"] as const;
export const sourcePackSourceTypes = ["provider_blog", "paper", "leaderboard", "business", "infra", "news", "mixed"] as const;
export const sourcePackCadences = ["manual", "daily", "weekly", "monthly"] as const;
export const dedupeStrategies = ["normalized_url", "canonical_url", "title_date", "source_event"] as const;
export const discoveryMethods = ["rss", "web_search"] as const;
export const duplicateStatuses = ["new", "same_url", "same_event", "cross_event", "ignored"] as const;
export const badgeTones = ["neutral", "progress", "info", "success", "warning", "destructive"] as const;

const datetimeSchema = z.string().datetime();

export const sourcePackSchema = z.object({
  id: z.string().min(1).regex(/^[a-zA-Z0-9._-]+$/),
  name: z.string().min(1),
  enabled: z.boolean(),
  rss_feeds: z.array(z.string().url()),
  web_search_queries: z.array(z.string().min(1)),
  source_type: z.enum(sourcePackSourceTypes),
  trajectory_hints: z.array(z.enum(trajectories)),
  cadence: z.enum(sourcePackCadences),
  trusted_domains: z.array(z.string().min(1)),
  excluded_domains: z.array(z.string().min(1)),
  dedupe_strategy: z.enum(dedupeStrategies),
  notes: z.string(),
  created_at: datetimeSchema,
  updated_at: datetimeSchema
}).strict();

export const discoveryRecordSchema = z.object({
  id: z.string().min(1).regex(/^[a-zA-Z0-9._-]+$/),
  run_id: z.string().min(1),
  source_pack_id: z.string().min(1),
  discovered_url: z.string().url(),
  normalized_url: z.string().url(),
  canonical_url: z.string().url().optional(),
  title: z.string().min(1),
  discovery_method: z.enum(discoveryMethods),
  reason_found: z.string().min(1),
  source_type: z.enum(sourcePackSourceTypes),
  trajectory_classification: z.array(z.enum(trajectories)).min(1),
  duplicate_status: z.enum(duplicateStatuses),
  confidence: z.enum(confidenceLevels),
  status: z.enum(pipelineStates),
  errors: z.array(z.string()),
  created_at: datetimeSchema,
  updated_at: datetimeSchema
}).strict();

export const pipelineFailureSchema = z.object({
  code: z.enum(failureCodes),
  message_zh: z.string().min(1),
  source_pack_id: z.string().min(1).optional(),
  record_id: z.string().min(1).optional(),
  suggested_next_action: z.string().min(1),
  diagnostic_ref: z.string().min(1).optional()
}).strict();

export const pipelineRunSchema = z.object({
  id: z.string().min(1).regex(/^[a-zA-Z0-9._-]+$/),
  type: z.enum(pipelineRunTypes),
  status: z.enum(pipelineRunStatuses),
  stage: z.enum(pipelineStates),
  trigger: z.literal("manual_workbench"),
  skill_name: z.enum(allowedPipelineSkillNames),
  started_at: datetimeSchema,
  ended_at: datetimeSchema.optional(),
  input_summary: z.string().min(1),
  output_refs: z.array(z.string().min(1)),
  error: pipelineFailureSchema.optional()
}).strict();

export const pipelineStateUiSchema = z.object({
  state: z.enum(pipelineStates),
  label_zh: z.string().min(1),
  badge_tone: z.enum(badgeTones),
  primary_action: z.string().min(1),
  copy_zh: z.string().min(1)
}).strict();

export const skillReviewRecordSchema = z.object({
  review_id: z.string().min(1).regex(/^[a-zA-Z0-9._-]+$/),
  target_skill: z.enum(allowedPipelineSkillNames),
  candidate_name: z.string().min(1),
  candidate_source: z.enum(["github", "clawhub", "upstream_docs"]),
  candidate_url: z.string().url(),
  license: z.string().min(1),
  reviewed_files: z.array(z.string().min(1)).min(1),
  capability_match: z.enum(["exact match", "partial match worth adapting", "adjacent pattern worth borrowing", "not relevant"]),
  risk_level: z.enum(["low", "medium", "high", "reject"]),
  decision: z.enum(["reuse_pattern", "reuse_prompt", "reuse_script_fragment", "reject_candidate", "author_local_adapter"]),
  reuse_mode: z.enum(["adapt_github_skill", "adapt_clawhub_reference", "adapt_upstream_tool_docs", "local_only_last_resort"]),
  notes: z.string().min(1),
  reviewed_at: datetimeSchema
}).strict();

export type PipelineState = (typeof pipelineStates)[number];
export type AllowedPipelineSkillName = (typeof allowedPipelineSkillNames)[number];
export type SourcePack = z.infer<typeof sourcePackSchema>;
export type DiscoveryRecord = z.infer<typeof discoveryRecordSchema>;
export type PipelineRun = z.infer<typeof pipelineRunSchema>;
export type SkillReviewRecord = z.infer<typeof skillReviewRecordSchema>;
```

- [ ] **Step 4: Export schemas**

Ensure `packages/core/src/index.ts` contains:

```ts
export * from "./schema";
export * from "./content";
export * from "./ids";
export const APP_NAME = "AI Progress Weekly Digest";
```

Keep any existing `APP_NAME` value if already present.

- [ ] **Step 5: Verify tests pass**

Run:

```bash
pnpm --filter @mind-wiki/core test -- schema.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/schema.ts packages/core/src/schema.test.ts packages/core/src/index.ts
git commit -m "feat: add pipeline data contracts"
```

## Task 2: Curation Store Areas And Typed Helpers

**Files:**
- Modify: `packages/curation/src/store.ts`
- Modify: `packages/curation/src/store.test.ts`
- Modify: `packages/curation/src/index.ts`

- [ ] **Step 1: Write failing store tests**

Add to `packages/curation/src/store.test.ts`:

```ts
import {
  readCurationRecords,
  writeDiscoveryRecord,
  writePipelineRun,
  writeSkillReviewRecord,
  writeSourcePack
} from "./store";

it("creates backend curation directories", async () => {
  const rootDir = await makeWorkspaceRoot();
  const dirs = await ensureCurationDirs(rootDir);
  expect(Object.keys(dirs.areas)).toEqual(expect.arrayContaining([
    "source-packs",
    "discovery-records",
    "pipeline-runs",
    "agent-outputs",
    "skill-reviews"
  ]));
});

it("writes and reads typed backend records", async () => {
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
    status: "discovered",
    errors: [],
    created_at: "2026-06-25T00:00:00.000Z",
    updated_at: "2026-06-25T00:00:00.000Z"
  }, { rootDir });
  await writeSkillReviewRecord("review-1", {
    review_id: "review-1",
    target_skill: "ai-weekly-discovery",
    candidate_name: "rss-search-skill",
    candidate_source: "github",
    candidate_url: "https://github.com/example/rss-search-skill",
    license: "MIT",
    reviewed_files: ["SKILL.md"],
    capability_match: "partial match worth adapting",
    risk_level: "medium",
    decision: "reuse_pattern",
    reuse_mode: "adapt_github_skill",
    notes: "Pattern only.",
    reviewed_at: "2026-06-25T00:00:00.000Z"
  }, { rootDir });

  expect((await readCurationRecords("source-packs", { rootDir })).map((record) => record.id)).toEqual(["provider-blogs"]);
  expect((await readCurationRecords("discovery-records", { rootDir })).map((record) => record.id)).toEqual(["disc-1"]);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
pnpm --filter @mind-wiki/curation test -- store.test.ts
```

Expected: FAIL with missing curation areas and helper exports.

- [ ] **Step 3: Add curation areas**

In `packages/curation/src/store.ts`, update `curationAreaDirs`:

```ts
export const curationAreaDirs = [
  "raw",
  "drafts",
  "invalid",
  "rejected",
  "quality-reports",
  "run-logs",
  "source-packs",
  "discovery-records",
  "pipeline-runs",
  "agent-outputs",
  "skill-reviews"
] as const;
```

- [ ] **Step 4: Add typed helper imports and functions**

In `packages/curation/src/store.ts`, extend imports:

```ts
import { readdir } from "node:fs/promises";
import {
  discoveryRecordSchema,
  pipelineRunSchema,
  skillReviewRecordSchema,
  sourcePackSchema,
  type DiscoveryRecord,
  type PipelineRun,
  type SkillReviewRecord,
  type SourcePack
} from "@mind-wiki/core/schema";
```

If `readFile`, `writeFile`, or `basename` are already imported, merge imports rather than duplicating them.

Add:

```ts
export async function readCurationRecords<T = unknown>(
  area: CurationArea,
  options: StoreOptions = {}
): Promise<CurationRecord<T>[]> {
  const dirs = await ensureCurationDirs(options.rootDir);
  const entries = await readdir(dirs.areas[area], { withFileTypes: true });
  const records = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json") && !entry.name.startsWith("._"))
      .map((entry) => inspectCurationRecord<T>(area, basename(entry.name, ".json"), options))
  );
  return records.sort((a, b) => a.id.localeCompare(b.id));
}

export function writeSourcePack(id: string, data: SourcePack, options: StoreOptions = {}) {
  return writeJsonRecord("source-packs", id, sourcePackSchema.parse(data), options);
}

export function writeDiscoveryRecord(id: string, data: DiscoveryRecord, options: StoreOptions = {}) {
  return writeJsonRecord("discovery-records", id, discoveryRecordSchema.parse(data), options);
}

export function writePipelineRun(id: string, data: PipelineRun, options: StoreOptions = {}) {
  return writeJsonRecord("pipeline-runs", id, pipelineRunSchema.parse(data), options);
}

export function writeSkillReviewRecord(id: string, data: SkillReviewRecord, options: StoreOptions = {}) {
  return writeJsonRecord("skill-reviews", id, skillReviewRecordSchema.parse(data), options);
}
```

- [ ] **Step 5: Update local-only guards**

In `packages/curation/src/index.ts`, add local-only names and prefixes for:

```ts
"source-packs",
"discovery-records",
"pipeline-runs",
"agent-outputs",
"skill-reviews"
```

Expected behavior: `isLocalOnlyPath(".curation/source-packs/provider-blogs.json")` and `isLocalOnlyPath("source-packs")` both return `true`.

- [ ] **Step 6: Verify tests pass**

Run:

```bash
pnpm --filter @mind-wiki/curation test -- store.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/curation/src/store.ts packages/curation/src/store.test.ts packages/curation/src/index.ts
git commit -m "feat: persist local pipeline state"
```
