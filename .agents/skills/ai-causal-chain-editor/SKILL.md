---
name: ai-causal-chain-editor
description: Propose or refine structured commercial-to-technical causal links between approved or reviewable AI progress events.
reuse_mode: adapt_upstream_tool_docs
---

# AI Causal Chain Editor

Read approved events from `content/approved/events` and local drafts from `.curation/drafts`.
Write proposed causal-link edits to `.curation/agent-outputs/<run_id>`.

Rules:
- Do not write `content/approved`.
- Every causal claim must include confidence and source support.
- Use relationship_type values from the core schema only.
- Prefer compact explanations in Chinese.
