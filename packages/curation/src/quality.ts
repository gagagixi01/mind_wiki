import {
  extractionQualityReportSchema,
  type ExtractionQualityReport
} from "@mind-wiki/core/schema";

export type ExtractionQualityInput = {
  source_url: string;
  extractor: string;
  status: "success" | "partial" | "failure";
  title?: string;
  text?: string;
  sources?: Array<{ title?: string; url?: string }>;
  errors?: string[];
  failure?: string;
};

const minimumReviewableTextLength = 500;

export function buildExtractionQualityReport(
  extraction: ExtractionQualityInput
): ExtractionQualityReport {
  const errors = extraction.errors ?? [];
  const missing_fields = missingFields(extraction);
  const source_count = sourceCount(extraction);
  const quality = extraction.status === "failure"
    ? "low"
    : extraction.text && extraction.text.trim().length >= minimumReviewableTextLength && missing_fields.length === 0
      ? "high"
      : extraction.text && extraction.text.trim().length > 0
        ? "needs_review"
        : "low";
  const reviewable = extraction.status !== "failure" && quality !== "low" && errors.length === 0 && source_count > 0;

  return extractionQualityReportSchema.parse({
    source_url: extraction.source_url,
    extractor: extraction.extractor,
    status: extraction.status,
    ...(extraction.failure ? { failure: extraction.failure } : {}),
    quality,
    source_count,
    missing_fields,
    errors,
    reviewable
  });
}

function missingFields(extraction: ExtractionQualityInput) {
  const missing: string[] = [];

  if (!extraction.title?.trim()) {
    missing.push("title");
  }
  if (!extraction.text?.trim()) {
    missing.push("text");
  }
  if (sourceCount(extraction) === 0) {
    missing.push("sources");
  }

  return missing;
}

function sourceCount(extraction: ExtractionQualityInput) {
  if (extraction.status === "failure") {
    return 0;
  }
  const explicitSources = extraction.sources?.filter((source) => source.url?.trim()).length ?? 0;
  return explicitSources > 0 ? explicitSources : 1;
}
