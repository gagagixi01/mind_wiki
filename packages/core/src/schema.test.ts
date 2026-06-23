import { describe, expect, it } from "vitest";

import {
  causalLinkSchema,
  draftStateSchema,
  eventSchema,
  extractionQualityReportSchema,
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
