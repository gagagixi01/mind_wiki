import { z } from "zod";

export const eventTypes = [
  "paper",
  "model_release",
  "architecture",
  "business",
  "infra",
  "benchmark",
  "regulation",
  "product"
] as const;

export const trajectories = [
  "llm_architecture",
  "multimodal_architecture",
  "provider_releases",
  "commercial_forces"
] as const;

export const confidenceLevels = ["observed", "likely", "speculative"] as const;

export const sourceTypes = [
  "paper",
  "company",
  "news",
  "blog",
  "docs",
  "github",
  "benchmark",
  "regulatory",
  "analysis",
  "other"
] as const;

export const causalRelationshipTypes = [
  "enabled",
  "accelerated",
  "pressured",
  "contradicted",
  "validated",
  "influenced"
] as const;

const millisecondsPerDay = 24 * 60 * 60 * 1000;

const parseUtcCalendarDate = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }
  const [, yearValue, monthValue, dayValue] = match;
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
};

const isMondayToSundayWeek = (weekStart: Date, weekEnd: Date) =>
  weekStart.getUTCDay() === 1 && weekEnd.getUTCDay() === 0;

const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD")
  .refine((value) => parseUtcCalendarDate(value) !== null, "Expected a real calendar date");

export const sourceSchema = z.object({
  title: z.string().min(1),
  url: z.string().url(),
  source_type: z.enum(sourceTypes)
}).strict();

export const causalLinkSchema = z
  .object({
    source_event_id: z.string().min(1),
    target_event_id: z.string().min(1).optional(),
    target_concept: z.string().min(1).optional(),
    relationship_type: z.enum(causalRelationshipTypes),
    explanation: z.string().min(1),
    confidence: z.enum(confidenceLevels),
    sources: z.array(sourceSchema).min(1)
  })
  .strict()
  .refine((link) => Boolean(link.target_event_id ?? link.target_concept), {
    message: "Causal links must include target_event_id or target_concept",
    path: ["target_event_id"]
  });

export const eventSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  date: dateStringSchema,
  type: z.enum(eventTypes),
  summary: z.string().min(1),
  why_it_matters: z.string().min(1),
  trajectories: z.array(z.enum(trajectories)).min(1),
  sources: z.array(sourceSchema).min(1),
  confidence: z.enum(confidenceLevels),
  watchlist: z.boolean(),
  providers: z.array(z.string().min(1)).optional(),
  causal_links: z.array(causalLinkSchema).optional(),
  related_events: z.array(z.string().min(1)).optional()
}).strict();

export const weeklyBriefSchema = z
  .object({
    week_start: dateStringSchema,
    week_end: dateStringSchema,
    thesis: z.string().min(1),
    headline_event_ids: z.array(z.string().min(1)),
    watchlist_event_ids: z.array(z.string().min(1)),
    closing_synthesis: z.string().min(1)
  })
  .strict()
  .refine((brief) => {
    const weekStart = parseUtcCalendarDate(brief.week_start);
    const weekEnd = parseUtcCalendarDate(brief.week_end);
    return (
      weekStart !== null &&
      weekEnd !== null &&
      (weekEnd.getTime() - weekStart.getTime()) / millisecondsPerDay === 6
    );
  }, {
    message: "week_end must be exactly 6 days after week_start",
    path: ["week_end"]
  })
  .refine((brief) => {
    const weekStart = parseUtcCalendarDate(brief.week_start);
    const weekEnd = parseUtcCalendarDate(brief.week_end);
    return weekStart !== null && weekEnd !== null && isMondayToSundayWeek(weekStart, weekEnd);
  }, {
    message: "week_start must be Monday and week_end must be Sunday",
    path: ["week_start"]
  });

export const extractionQualityReportSchema = z
  .object({
    source_url: z.string().url(),
    extractor: z.string().min(1),
    status: z.enum(["success", "partial", "failure"]),
    failure: z.string().min(1).optional(),
    quality: z.enum(["high", "needs_review", "low"]).optional(),
    source_count: z.number().int().nonnegative(),
    missing_fields: z.array(z.string()),
    errors: z.array(z.string()),
    reviewable: z.boolean()
  })
  .strict()
  .refine((report) => report.status !== "failure" || Boolean(report.failure), {
    message: "Failure reports must include failure",
    path: ["failure"]
  });

export const draftStateSchema = z
  .object({
    state: z.enum(["generated", "invalid", "rejected", "approved"]),
    validation_errors: z.array(z.string()).default([]),
    rejection_reason: z.string().min(1).optional(),
    approved_at: z.string().datetime().optional(),
    quality_report: extractionQualityReportSchema.optional()
  })
  .strict()
  .superRefine((draft, context) => {
    if (draft.state === "approved" && !draft.approved_at) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Approved drafts must include approved_at",
        path: ["approved_at"]
      });
    }
    if (draft.state !== "approved" && draft.approved_at) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Only approved drafts may include approved_at",
        path: ["approved_at"]
      });
    }
    if (draft.state === "rejected" && !draft.rejection_reason) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Rejected drafts must include rejection_reason",
        path: ["rejection_reason"]
      });
    }
    if (draft.state !== "rejected" && draft.rejection_reason) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Only rejected drafts may include rejection_reason",
        path: ["rejection_reason"]
      });
    }
    if (draft.state === "invalid" && draft.validation_errors.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid drafts must include at least one validation error",
        path: ["validation_errors"]
      });
    }
    if (draft.state !== "invalid" && draft.validation_errors.length > 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Only invalid drafts may include validation_errors",
        path: ["validation_errors"]
      });
    }
  });

export const pipelineStates = [
  "idle",
  "discovering",
  "discovered",
  "extracting",
  "extracted",
  "low-quality",
  "drafting",
  "draft-invalid",
  "ready-for-review",
  "approved",
  "rejected",
  "failed"
] as const;

export const pipelineRunTypes = [
  "discovery",
  "extraction",
  "drafting",
  "quality_audit",
  "causal_chain",
  "weekly_brief"
] as const;

export const pipelineRunStatuses = ["idle", "running", "succeeded", "failed", "cancelled"] as const;

export const failureCodes = [
  "codex_cli_unavailable",
  "skill_missing",
  "command_timeout",
  "active_run_exists",
  "rss_timeout",
  "invalid_rss_feed",
  "search_provider_unavailable",
  "search_quota_or_rate_limit",
  "zero_search_results",
  "duplicate_flood",
  "blocked_or_private_url",
  "extraction_failure",
  "low_quality_extraction",
  "model_api_failure",
  "malformed_ai_output",
  "schema_invalid_draft",
  "approved_file_collision"
] as const;

export const allowedPipelineSkillNames = [
  "ai-source-pack-curator",
  "ai-weekly-discovery",
  "ai-source-quality-auditor",
  "ai-draft-reviewer",
  "ai-causal-chain-editor",
  "ai-weekly-brief-builder"
] as const;

export const sourcePackSourceTypes = [
  "provider_blog",
  "paper",
  "leaderboard",
  "business",
  "infra",
  "news",
  "mixed"
] as const;

export const sourcePackCadences = ["manual", "daily", "weekly", "monthly"] as const;
export const dedupeStrategies = ["normalized_url", "canonical_url", "title_date", "source_event"] as const;
export const discoveryMethods = ["rss", "web_search"] as const;
export const duplicateStatuses = ["new", "same_url", "same_event", "cross_event", "ignored"] as const;
export const badgeTones = ["neutral", "progress", "info", "success", "warning", "destructive"] as const;

const safeRecordIdSchema = z.string().min(1).regex(/^[a-zA-Z0-9._-]+$/);
const datetimeSchema = z.string().datetime();

export const sourcePackSchema = z.object({
  id: safeRecordIdSchema,
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
  id: safeRecordIdSchema,
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
  id: safeRecordIdSchema,
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
  review_id: safeRecordIdSchema,
  target_skill: z.enum(allowedPipelineSkillNames),
  candidate_name: z.string().min(1),
  candidate_source: z.enum(["github", "clawhub", "upstream_docs"]),
  candidate_url: z.string().url(),
  license: z.string().min(1),
  reviewed_files: z.array(z.string().min(1)).min(1),
  capability_match: z.enum([
    "exact match",
    "partial match worth adapting",
    "adjacent pattern worth borrowing",
    "not relevant"
  ]),
  risk_level: z.enum(["low", "medium", "high", "reject"]),
  decision: z.enum([
    "reuse_pattern",
    "reuse_prompt",
    "reuse_script_fragment",
    "reject_candidate",
    "author_local_adapter"
  ]),
  reuse_mode: z.enum([
    "adapt_github_skill",
    "adapt_clawhub_reference",
    "adapt_upstream_tool_docs",
    "local_only_last_resort"
  ]),
  notes: z.string().min(1),
  reviewed_at: datetimeSchema
}).strict();

export type EventType = (typeof eventTypes)[number];
export type Trajectory = (typeof trajectories)[number];
export type Confidence = (typeof confidenceLevels)[number];
export type SourceType = (typeof sourceTypes)[number];
export type CausalRelationshipType = (typeof causalRelationshipTypes)[number];
export type PipelineState = (typeof pipelineStates)[number];
export type PipelineRunType = (typeof pipelineRunTypes)[number];
export type PipelineRunStatus = (typeof pipelineRunStatuses)[number];
export type FailureCode = (typeof failureCodes)[number];
export type AllowedPipelineSkillName = (typeof allowedPipelineSkillNames)[number];
export type Source = z.infer<typeof sourceSchema>;
export type CausalLink = z.infer<typeof causalLinkSchema>;
export type Event = z.infer<typeof eventSchema>;
export type WeeklyBrief = z.infer<typeof weeklyBriefSchema>;
export type ExtractionQualityReport = z.infer<typeof extractionQualityReportSchema>;
export type DraftState = z.infer<typeof draftStateSchema>;
export type SourcePack = z.infer<typeof sourcePackSchema>;
export type DiscoveryRecord = z.infer<typeof discoveryRecordSchema>;
export type PipelineFailure = z.infer<typeof pipelineFailureSchema>;
export type PipelineRun = z.infer<typeof pipelineRunSchema>;
export type PipelineStateUi = z.infer<typeof pipelineStateUiSchema>;
export type SkillReviewRecord = z.infer<typeof skillReviewRecordSchema>;
