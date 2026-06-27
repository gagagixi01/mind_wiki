import {
  allowedPipelineSkillNames,
  skillReviewRecordSchema,
  type AllowedPipelineSkillName,
  type SkillReviewRecord
} from "@mind-wiki/core/schema";

export function assertSkillCanBeCreatedOrRevised(
  skillName: AllowedPipelineSkillName,
  reviews: SkillReviewRecord[]
) {
  if (!allowedPipelineSkillNames.includes(skillName)) {
    throw new Error(`Unknown pipeline skill: ${skillName}`);
  }

  const relevant = reviews
    .map((review) => skillReviewRecordSchema.parse(review))
    .filter((review) => review.target_skill === skillName);

  if (!relevant.some((review) => review.candidate_source === "github")) {
    throw new Error(`GitHub search review is required before revising ${skillName}`);
  }

  if (!relevant.some((review) => review.candidate_source === "clawhub")) {
    throw new Error(`ClawHub comparison review is required before revising ${skillName}`);
  }

  if (
    relevant.some(
      (review) =>
        review.candidate_source === "clawhub" &&
        review.risk_level === "high" &&
        review.decision !== "reject_candidate"
    )
  ) {
    throw new Error(
      "High-risk ClawHub candidates may only be rejected or used as non-installed reference notes."
    );
  }
}
