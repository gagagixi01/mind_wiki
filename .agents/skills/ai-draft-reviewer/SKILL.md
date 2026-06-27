---
name: ai-draft-reviewer
description: Validate Chinese event drafts against schema, source support, confidence labels, and editorial quality before human review.
reuse_mode: adapt_github_skill
---

# AI Draft Reviewer

Read drafts from `.curation/drafts`, invalid outputs from `.curation/invalid`, and quality reports from `.curation/quality-reports`.
Write review diagnostics to `.curation/agent-outputs/<run_id>`.

Follow `references/draft-review-contract.md`.

Rules:
- Do not write `content/approved`.
- Do not approve drafts.
- Ensure confidence is one of `observed`, `likely`, or `speculative`.
- Ensure Chinese summary and why_it_matters are clear, evidence-backed, and concise.
- Save malformed or schema-invalid output under `.curation/invalid`.
