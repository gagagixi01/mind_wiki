import { describe, expect, it } from "vitest";

import {
  causalLinkSchema,
  discoveryRecordSchema,
  draftStateSchema,
  eventSchema,
  extractionQualityReportSchema,
  failureCodes,
  pipelineRunSchema,
  pipelineStateUiSchema,
  skillReviewRecordSchema,
  sourcePackSchema,
  weeklyBriefSchema
} from "./schema";

describe("content schemas", () => {
  it("accepts event frontmatter with typed causal links", () => {
    const event = eventSchema.parse({
      id: "2026-06-01-transformer-update",
      title: "Transformer Update",
      date: "2026-06-01",
      type: "architecture",
      summary: "A concise event summary.",
      why_it_matters: "It changes inference planning.",
      trajectories: ["llm_architecture", "provider_releases"],
      sources: [
        {
          title: "Research note",
          url: "https://example.com/research",
          source_type: "paper"
        }
      ],
      confidence: "likely",
      watchlist: true,
      providers: ["ExampleAI"],
      related_events: ["2026-05-20-previous-event"],
      causal_links: [
        {
          source_event_id: "2026-05-20-previous-event",
          target_event_id: "2026-06-01-transformer-update",
          relationship_type: "enabled",
          explanation: "Earlier tooling made this release practical.",
          confidence: "observed",
          sources: [
            {
              title: "Release note",
              url: "https://example.com/release",
              source_type: "company"
            }
          ]
        }
      ]
    });

    expect(event.type).toBe("architecture");
    expect(event.causal_links?.[0]?.relationship_type).toBe("enabled");
  });

  it("requires causal links to identify a target event or concept", () => {
    expect(() =>
      causalLinkSchema.parse({
        source_event_id: "source-event",
        relationship_type: "pressured",
        explanation: "Market pressure changed the product plan.",
        confidence: "speculative",
        sources: [
          {
            title: "Market note",
            url: "https://example.com/market",
            source_type: "analysis"
          }
        ]
      })
    ).toThrow(/target_event_id or target_concept/);
  });

  it("rejects invalid event type and trajectory enums", () => {
    const result = eventSchema.safeParse({
      id: "2026-06-01-invalid",
      title: "Invalid",
      date: "2026-06-01",
      type: "rumor",
      summary: "A summary.",
      why_it_matters: "It should fail.",
      trajectories: ["research"],
      sources: [
        {
          title: "Source",
          url: "https://example.com/source",
          source_type: "news"
        }
      ],
      confidence: "observed",
      watchlist: true
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path.join("."))).toEqual(
        expect.arrayContaining(["type", "trajectories.0"])
      );
    }
  });

  it("rejects non-boolean event watchlist values", () => {
    const result = eventSchema.safeParse({
      id: "2026-06-01-invalid-watchlist",
      title: "Invalid Watchlist",
      date: "2026-06-01",
      type: "architecture",
      summary: "A summary.",
      why_it_matters: "It should fail.",
      trajectories: ["llm_architecture"],
      sources: [
        {
          title: "Source",
          url: "https://example.com/source",
          source_type: "news"
        }
      ],
      confidence: "observed",
      watchlist: ["Watch benchmark replications."]
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path.join("."))).toContain("watchlist");
    }
  });

  it("rejects impossible calendar dates", () => {
    expect(
      eventSchema.safeParse({
        id: "2026-06-01-invalid-date",
        title: "Invalid Date",
        date: "2026-99-99",
        type: "architecture",
        summary: "A summary.",
        why_it_matters: "It should fail.",
        trajectories: ["llm_architecture"],
        sources: [
          {
            title: "Source",
            url: "https://example.com/source",
            source_type: "news"
          }
        ],
        confidence: "observed",
        watchlist: true
      }).success
    ).toBe(false);

    expect(
      weeklyBriefSchema.safeParse({
        week_start: "2026-02-29",
        week_end: "2026-03-07",
        thesis: "Invalid leap dates should fail.",
        headline_event_ids: [],
        watchlist_event_ids: [],
        closing_synthesis: "Calendar validation rejects non-leap Feb 29."
      }).success
    ).toBe(false);

    expect(
      weeklyBriefSchema.safeParse({
        week_start: "2028-02-29",
        week_end: "2028-03-06",
        thesis: "Valid leap dates should pass.",
        headline_event_ids: [],
        watchlist_event_ids: [],
        closing_synthesis: "Calendar validation accepts real dates."
      }).success
    ).toBe(true);
  });

  it("requires state-specific draft metadata", () => {
    expect(draftStateSchema.safeParse({ state: "approved" }).success).toBe(false);
    expect(draftStateSchema.safeParse({ state: "rejected" }).success).toBe(false);
    expect(draftStateSchema.safeParse({ state: "invalid" }).success).toBe(false);

    expect(
      draftStateSchema.safeParse({
        state: "approved",
        approved_at: "2026-06-01T12:00:00.000Z"
      }).success
    ).toBe(true);
    expect(
      draftStateSchema.safeParse({
        state: "rejected",
        rejection_reason: "Duplicate source."
      }).success
    ).toBe(true);
    expect(
      draftStateSchema.safeParse({
        state: "invalid",
        validation_errors: ["title is required"]
      }).success
    ).toBe(true);
  });

  it("rejects contradictory draft state metadata", () => {
    expect(
      draftStateSchema.safeParse({
        state: "approved",
        approved_at: "2026-06-01T12:00:00.000Z",
        rejection_reason: "Duplicate source."
      }).success
    ).toBe(false);
    expect(
      draftStateSchema.safeParse({
        state: "approved",
        approved_at: "2026-06-01T12:00:00.000Z",
        validation_errors: ["title is required"]
      }).success
    ).toBe(false);
    expect(
      draftStateSchema.safeParse({
        state: "rejected",
        rejection_reason: "Duplicate source.",
        approved_at: "2026-06-01T12:00:00.000Z"
      }).success
    ).toBe(false);
    expect(
      draftStateSchema.safeParse({
        state: "rejected",
        rejection_reason: "Duplicate source.",
        validation_errors: ["title is required"]
      }).success
    ).toBe(false);
    expect(
      draftStateSchema.safeParse({
        state: "invalid",
        validation_errors: ["title is required"],
        approved_at: "2026-06-01T12:00:00.000Z"
      }).success
    ).toBe(false);
    expect(
      draftStateSchema.safeParse({
        state: "invalid",
        validation_errors: ["title is required"],
        rejection_reason: "Duplicate source."
      }).success
    ).toBe(false);
    expect(
      draftStateSchema.safeParse({
        state: "generated",
        approved_at: "2026-06-01T12:00:00.000Z"
      }).success
    ).toBe(false);
    expect(
      draftStateSchema.safeParse({
        state: "generated",
        rejection_reason: "Duplicate source."
      }).success
    ).toBe(false);
    expect(
      draftStateSchema.safeParse({
        state: "generated",
        validation_errors: ["title is required"]
      }).success
    ).toBe(false);
  });

  it("rejects weekly briefs with reversed real calendar dates", () => {
    expect(
      weeklyBriefSchema.safeParse({
        week_start: "2026-06-08",
        week_end: "2026-06-07",
        thesis: "Real dates in reverse order should fail.",
        headline_event_ids: [],
        watchlist_event_ids: [],
        closing_synthesis: "The interval must not end before it starts."
      }).success
    ).toBe(false);
  });

  it("rejects weekly briefs shorter than 7 inclusive real calendar days", () => {
    expect(
      weeklyBriefSchema.safeParse({
        week_start: "2026-06-01",
        week_end: "2026-06-06",
        thesis: "Short intervals should fail.",
        headline_event_ids: [],
        watchlist_event_ids: [],
        closing_synthesis: "Weekly briefs must span exactly seven inclusive days."
      }).success
    ).toBe(false);
  });

  it("rejects weekly briefs longer than 7 inclusive real calendar days", () => {
    expect(
      weeklyBriefSchema.safeParse({
        week_start: "2026-06-01",
        week_end: "2026-06-08",
        thesis: "Long intervals should fail.",
        headline_event_ids: [],
        watchlist_event_ids: [],
        closing_synthesis: "Weekly briefs must span exactly seven inclusive days."
      }).success
    ).toBe(false);
  });

  it("rejects unknown event frontmatter keys", () => {
    const result = eventSchema.safeParse({
      id: "2026-06-01-provider-typo",
      title: "Provider Typo",
      date: "2026-06-01",
      type: "model_release",
      summary: "A summary.",
      why_it_matters: "It should fail.",
      trajectories: ["provider_releases"],
      sources: [
        {
          title: "Source",
          url: "https://example.com/source",
          source_type: "news"
        }
      ],
      confidence: "observed",
      watchlist: true,
      provider: ["ExampleAI"]
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.message)).toContain(
        "Unrecognized key(s) in object: 'provider'"
      );
    }
  });

  it("rejects unknown nested event frontmatter keys", () => {
    const result = eventSchema.safeParse({
      id: "2026-06-01-causal-link-typo",
      title: "Causal Link Typo",
      date: "2026-06-01",
      type: "architecture",
      summary: "A summary.",
      why_it_matters: "It should fail.",
      trajectories: ["llm_architecture"],
      sources: [
        {
          title: "Source",
          url: "https://example.com/source",
          source_type: "news",
          publisher: "Example News"
        }
      ],
      confidence: "observed",
      watchlist: true,
      causal_link: [
        {
          source_event_id: "source-event",
          target_concept: "tooling",
          relationship_type: "enabled",
          explanation: "Earlier tooling made this practical.",
          confidence: "likely",
          sources: [
            {
              title: "Release note",
              url: "https://example.com/release",
              source_type: "company"
            }
          ]
        }
      ]
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.message)).toEqual(
        expect.arrayContaining([
          "Unrecognized key(s) in object: 'publisher'",
          "Unrecognized key(s) in object: 'causal_link'"
        ])
      );
    }
  });

  it("accepts weekly briefs that reference event IDs instead of duplicating cards", () => {
    const week = weeklyBriefSchema.parse({
      week_start: "2026-06-01",
      week_end: "2026-06-07",
      thesis: "Provider releases dominated the week.",
      headline_event_ids: ["2026-06-01-transformer-update"],
      watchlist_event_ids: ["2026-06-02-provider-release"],
      closing_synthesis: "The pattern is stronger infrastructure leverage."
    });

    expect(week.headline_event_ids).toEqual(["2026-06-01-transformer-update"]);
  });

  it("models extraction quality reports and draft state for curation", () => {
    const report = extractionQualityReportSchema.parse({
      source_url: "https://example.com/source",
      extractor: "manual-fixture",
      status: "partial",
      quality: "needs_review",
      source_count: 2,
      missing_fields: ["why_it_matters"],
      errors: ["No direct benchmark source found."],
      reviewable: true
    });

    const draft = draftStateSchema.parse({
      state: "invalid",
      validation_errors: ["title is required"],
      quality_report: report
    });

    expect(draft.state).toBe("invalid");
    expect(draft.quality_report?.reviewable).toBe(true);
  });
});

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
