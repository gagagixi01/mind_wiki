# AI Progress Weekly Digest Design

Date: 2026-06-23
Status: Draft
Project: mind_wiki
Source design: `/Users/walter/.gstack/projects/mind_wiki/walter-unknown-design-20260623-122236.md`

## Summary

Build a Next.js website that helps the user understand AI progress as a living system. The site starts from questions, not a database. The default question is:

> What changed this week?

The answer is a brief-first weekly synthesis supported by event cards. Headline events route primarily into trajectory pages so the user learns patterns over time instead of reading isolated news items.

V1 also includes an AI-assisted local curation pipeline. Open-source extraction tools collect source material, an AI assistant drafts structured event cards, and the user approves cards before they become public MDX content.

## Goals

- Help the user understand weekly AI progress in under 10 minutes.
- Connect new events to long-running technical and commercial trajectories.
- Preserve weak signals without cluttering the weekly brief.
- Let one event appear in weekly briefs, trajectory pages, provider views, and causal links without duplicate writing.
- Use AI assistance to reduce curation labor while keeping human approval before publication.

## Non-Goals

- No public admin UI in v1.
- No automatic publishing.
- No database requirement in v1.
- No auth in v1.
- No fully automated crawler that decides what matters without user review.
- No agents/tools or robotics trajectory pages in the first release.

## Information Architecture

### Home: Question Router

The homepage is organized around learning questions.

Default route:

- What changed this week?

Secondary routes:

- Where does this fit in AI history?
- Why did this happen?
- Which provider moved?

The default route opens the latest weekly brief. Secondary routes point into trajectory and provider views.

Navigation:

- This Week
- Trajectories
- Providers
- Sources

### Weekly Brief Page

One page per week. The page starts with a sharp weekly thesis, followed by evidence.

Sections:

- Weekly thesis
- 5-8 headline event cards
- Watchlist of smaller items that are not headline-worthy yet but should be tracked for future patterns
- Source trail
- Closing synthesis

Voice:

- Two-layer voice.
- Top line can be opinionated.
- Evidence and causal claims must carry confidence labels: `observed`, `likely`, or `speculative`.

### Trajectory Pages

The primary drill-down from headline event cards is the relevant trajectory page.

V1 trajectories:

- LLM architecture
- Multimodal architecture
- Provider releases
- Commercial forces

Each trajectory page includes:

- A concept primer explaining what the trajectory is and why it matters.
- A chronological timeline of related events.
- Event cards that explain why each event matters inside that trajectory.
- Filters for provider, event type, confidence, and watchlist status.

Future trajectories:

- Agents/tools
- Robotics/embodied AI

### Event Detail Drawer

Event pages are not the primary drill-down. Instead, the UI provides a compact event detail drawer or panel.

The drawer shows:

- Summary
- Why it matters
- Source links
- Confidence label
- Related trajectories
- Provider tags
- Causal links

The drawer must preserve browsing context so the user can inspect an event without losing their place in a trajectory.

### Provider View

Provider views are lightweight in v1.

They show provider/model release lineage for major AI providers such as:

- OpenAI
- Anthropic
- Google
- Meta
- Nvidia, when the event is commercial or infrastructure related

Provider views are generated from event tags rather than a separate data model.

## Content Model

Use separate MDX event files plus weekly brief files.

### Event Files

Each event is a reusable MDX file. Required fields:

- `id`
- `title`
- `date`
- `type`: one of `paper`, `model_release`, `architecture`, `business`, `infra`, `benchmark`, `regulation`, `product`
- `summary`
- `why_it_matters`
- `trajectories`: one or more of `llm_architecture`, `multimodal_architecture`, `provider_releases`, `commercial_forces`
- `sources`: list of source objects with title, URL, and source type
- `confidence`: one of `observed`, `likely`, `speculative`
- `watchlist`: boolean

Optional fields:

- `providers`
- `causal_links`
- `related_events`

### Weekly Brief Files

Weekly brief files reference event IDs rather than duplicating event content.

Required fields:

- Week start date
- Week end date
- Weekly thesis
- Headline event IDs
- Watchlist event IDs
- Closing synthesis

## Collection And Curation Pipeline

V1 includes a local AI-assisted curation pipeline.

### Source Intake

The user provides source URLs from:

- Research papers
- Model release posts
- Company blogs
- Benchmark posts
- Provider announcements
- Investor or market analysis
- GPU, infrastructure, or supply-chain news
- GitHub repositories

Post-v1 source lists can add RSS feeds, arXiv queries, Hugging Face papers, provider blogs, and market/news sources.

### Open-Source Extraction

Primary extractor:

- Crawl4AI, because it is designed for LLM-ready Markdown, browser-backed crawling, structured extraction, citations, and source capture.

Fallback extractor:

- Trafilatura, for simpler static article-like pages.

Extraction output should be stored as raw Markdown or structured raw artifacts separate from approved MDX content.

Extraction failures must be visible. A failed or low-quality extraction cannot silently create an event card.

### AI Assistant Drafting

The AI assistant reads extracted source material and proposes draft event cards.

Draft fields:

- Event title
- Summary
- Why it matters
- Trajectory tags
- Provider tags
- Source list
- Confidence label
- Possible causal links

### Human Review Gate

The user approves, edits, or rejects every draft.

Rules:

- Unapproved drafts never appear on public pages.
- Approved drafts become MDX event files.
- Weekly briefs reference approved event IDs.
- The assistant may suggest a weekly thesis, but the user approves it before publication.

## Technical Architecture

Use Next.js with MDX content and a static-first build.

Core pieces:

- Content collections for events and weekly briefs.
- Frontmatter validation for required fields and allowed enum values.
- Static routes for home, weekly briefs, trajectories, providers, and sources.
- Client-side explorer interactions for filtering by trajectory, provider, event type, confidence, and watchlist.
- Event detail drawer for compact inspection.
- Relationship overlays for related trajectories, provider releases, and causal links.
- Local scripts or CLI commands for extraction and AI-assisted draft generation.

The public website reads only approved content. Raw extraction output and unapproved drafts stay local.

## UI Behavior

### Home

The home page defaults to the latest weekly brief.

It should make the latest weekly thesis immediately visible, then show event cards grouped as:

- Headline cards
- Watchlist

### Event Cards

Headline event cards show:

- Title
- Date
- One-line summary
- Event type
- Primary trajectory
- Provider, when present
- Confidence label
- Source count

Clicking a headline card routes to the primary trajectory page and highlights that event in context. The detail drawer remains available from the card or trajectory timeline.

### Trajectory Pages

Each trajectory page starts with a concept primer, then a timeline.

The timeline supports:

- Event type filtering
- Provider filtering
- Confidence filtering
- Watchlist toggle
- Event detail drawer

### Confidence Labels

Causal claims must visibly indicate confidence:

- `observed`: directly supported by a source
- `likely`: plausible synthesis from multiple signals
- `speculative`: useful hypothesis, not established fact

## Seed Content

V1 needs enough content to make the four trajectories useful.

Minimum seed target:

- At least 3 approved events per trajectory.
- At least one complete weekly brief.
- At least one commercial-to-technical causal chain.

Example anchor events:

- Transformer
- BERT
- GPT-3
- ChatGPT
- GPT-4
- CLIP
- Diffusion model breakthroughs
- Mamba or other non-Transformer sequence architectures
- Major open-weight model releases
- Nvidia or GPU-supply commercial inflection points

## Success Criteria

V1 is successful when:

- The user can turn 5-8 source URLs into draft event cards with AI assistance.
- The user can review and approve those cards into MDX without automatic publishing.
- A weekly brief can be published in under 60 minutes after sources are chosen.
- The home page answers "What changed this week?" in under 10 minutes of reading.
- Each headline event routes into at least one of the four v1 trajectory pages.
- Each trajectory page has a concept primer and at least 3 seed events.
- Confidence labels are visible anywhere causal claims appear.
- Extraction failures are visible and recoverable.
- Watchlist items are visible but lower priority than headline cards.

## Testing

Content validation:

- Missing required event frontmatter fails clearly.
- Invalid event type, trajectory, or confidence value fails clearly.
- Weekly brief references to unknown event IDs fail clearly.

Extraction pipeline:

- Sample source URLs produce stored raw Markdown or a readable failure.
- Extraction failures do not create approved event files.
- Draft event output must include all required fields before it can be reviewed.

Human review gate:

- Unapproved drafts never appear in public routes.
- Approved events appear in weekly briefs and trajectory pages.

Routes and UI:

- Weekly, trajectory, provider, and source routes build from approved content.
- Trajectory, provider, type, confidence, and watchlist filters work together.
- Empty trajectory, no matching filters, missing sources, failed extraction, and watchlist-only week states are handled.
- Event drawer opens by keyboard, has visible focus states, and can be closed without losing context.

## References

- Crawl4AI: https://github.com/unclecode/crawl4ai
- Trafilatura: https://trafilatura.readthedocs.io/en/latest/
- WCXB extraction benchmark: https://arxiv.org/abs/2605.21097
