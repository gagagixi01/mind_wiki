---
name: ai-source-quality-auditor
description: Evaluate extraction quality, duplicates, source credibility, missing evidence, suspicious domains, and low-quality extraction records.
reuse_mode: adapt_github_skill
---

# AI Source Quality Auditor

Read extraction artifacts from `.curation/raw` and discovery records from `.curation/discovery-records`.
Write quality reports to `.curation/quality-reports`.
Write diagnostics to `.curation/agent-outputs/<run_id>`.

Rules:
- Do not write `content/approved`.
- Mark low-quality extraction as `low-quality`.
- Name duplicate, blocked/private URL, extraction failure, and source credibility problems.
- Prefer observed evidence over speculative synthesis.
