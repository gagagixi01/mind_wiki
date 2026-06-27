---
name: ai-source-pack-curator
description: Maintain local AI progress source packs for RSS feeds, web search queries, trusted domains, excluded domains, cadence, trajectory hints, and dedupe strategy.
reuse_mode: adapt_upstream_tool_docs
---

# AI Source Pack Curator

Use only in the local Codex CLI backend for mind_wiki.

Inputs are JSON files under `.curation/pipeline-runs/<run_id>/input.json`.
Outputs must be JSON records under `.curation/source-packs` or diagnostics under `.curation/agent-outputs/<run_id>`.

Rules:
- Do not write `content/approved`.
- Do not call browser-side APIs.
- Keep cadence stored but treat only `manual` as active for V1.
- Preserve existing source packs unless the input explicitly requests enable, disable, or metadata refinement.
- Record trusted domains, excluded domains, source type, trajectory hints, and dedupe strategy.
