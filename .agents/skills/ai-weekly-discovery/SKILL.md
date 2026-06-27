---
name: ai-weekly-discovery
description: Run local RSS and web-search discovery for weekly AI progress candidates and write DiscoveryRecord JSON files.
reuse_mode: adapt_github_skill
---

# AI Weekly Discovery

Use only through the local backend Codex CLI runner.

Read source packs from `.curation/source-packs`.
Read run input from `.curation/pipeline-runs/<run_id>/input.json`.
Write discovery records to `.curation/discovery-records`.
Write diagnostics to `.curation/agent-outputs/<run_id>`.

Follow `references/discovery-output-contract.md`.

Rules:
- Do not write `content/approved`.
- Do not install skills from ClawHub or public registries.
- Use RSS and local-first SearXNG search only when configured by backend environment.
- Normalize URLs, dedupe candidates, classify trajectories, and preserve `reason_found`.
- Surface named failures instead of silently dropping candidates.
