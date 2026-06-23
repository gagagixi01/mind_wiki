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

export type EventType = (typeof eventTypes)[number];
export type Trajectory = (typeof trajectories)[number];
export type Confidence = (typeof confidenceLevels)[number];
export type SourceType = (typeof sourceTypes)[number];
export type CausalRelationshipType = (typeof causalRelationshipTypes)[number];
export type Source = z.infer<typeof sourceSchema>;
export type CausalLink = z.infer<typeof causalLinkSchema>;
export type Event = z.infer<typeof eventSchema>;
export type WeeklyBrief = z.infer<typeof weeklyBriefSchema>;
export type ExtractionQualityReport = z.infer<typeof extractionQualityReportSchema>;
export type DraftState = z.infer<typeof draftStateSchema>;
