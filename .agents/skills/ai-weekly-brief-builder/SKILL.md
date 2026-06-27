---
name: ai-weekly-brief-builder
description: Build a reviewable weekly brief proposal from approved events, watchlist events, and causal context.
reuse_mode: adapt_github_skill
---

# AI Weekly Brief Builder

Read approved events from `content/approved/events`.
Read approved weeks from `content/approved/weeks`.
Write weekly brief proposals to `.curation/agent-outputs/<run_id>`.

Rules:
- Do not write `content/approved`.
- Reference event IDs instead of duplicating event content.
- Propose thesis, headline_event_ids, watchlist_event_ids, and closing_synthesis.
- Human approval is required before publication.
