import { describe, expect, it } from "vitest";

import type { SkillReviewRecord } from "@mind-wiki/core/schema";

import { assertSkillCanBeCreatedOrRevised } from "./skill-governance";

const githubReview: SkillReviewRecord = {
  review_id: "github-review",
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
};

const clawHubReview: SkillReviewRecord = {
  review_id: "clawhub-review",
  target_skill: "ai-weekly-discovery",
  candidate_name: "clawhub-rss",
  candidate_source: "clawhub",
  candidate_url: "https://example.com/clawhub/rss",
  license: "Unknown",
  reviewed_files: ["SKILL.md"],
  capability_match: "adjacent pattern worth borrowing",
  risk_level: "high",
  decision: "reject_candidate",
  reuse_mode: "adapt_clawhub_reference",
  notes: "Reference only; no direct install.",
  reviewed_at: "2026-06-25T00:00:00.000Z"
};

describe("skill governance", () => {
  it("requires GitHub and ClawHub comparison before local skill revision", () => {
    expect(() => assertSkillCanBeCreatedOrRevised("ai-weekly-discovery", [githubReview])).toThrow(
      /ClawHub comparison/
    );
  });

  it("allows reviewed GitHub adaptation plus rejected ClawHub reference", () => {
    expect(() =>
      assertSkillCanBeCreatedOrRevised("ai-weekly-discovery", [githubReview, clawHubReview])
    ).not.toThrow();
  });
});
