# AI Progress Weekly Digest Codex Agent Skills Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add governed repo-local Codex CLI skills for the AI weekly digest pipeline and enforce reuse-first skill review records.

**Architecture:** Store six local skills under `.agents/skills`, each scoped to one backend pipeline role. Store candidate review records under `.curation/skill-reviews`; direct installation from ClawHub/OpenClaw is forbidden, and all local skills preserve the human approval gate into `content/approved`.

**Tech Stack:** Codex skill `SKILL.md` files, TypeScript governance helpers, Zod `SkillReviewRecord`, Vitest.

---

## Task 1: Skill Governance Helper

**Files:**
- Create: `packages/curation/src/skill-governance.ts`
- Create: `packages/curation/src/skill-governance.test.ts`
- Modify: `packages/curation/src/index.ts`

- [ ] **Step 1: Write failing governance tests**

Create `packages/curation/src/skill-governance.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { assertSkillCanBeCreatedOrRevised } from "./skill-governance";

const githubReview = {
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
} as const;

const clawHubReview = {
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
} as const;

describe("skill governance", () => {
  it("requires GitHub and ClawHub comparison before local skill revision", () => {
    expect(() => assertSkillCanBeCreatedOrRevised("ai-weekly-discovery", [githubReview]))
      .toThrow(/ClawHub comparison/);
  });

  it("allows reviewed GitHub adaptation plus rejected ClawHub reference", () => {
    expect(() => assertSkillCanBeCreatedOrRevised("ai-weekly-discovery", [githubReview, clawHubReview]))
      .not.toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
pnpm --filter @mind-wiki/curation test -- skill-governance.test.ts
```

Expected: FAIL because `skill-governance.ts` does not exist.

- [ ] **Step 3: Implement governance helper**

Create `packages/curation/src/skill-governance.ts`:

```ts
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

  if (relevant.some((review) => review.candidate_source === "clawhub" && review.risk_level === "high" && review.decision !== "reject_candidate")) {
    throw new Error("High-risk ClawHub candidates may only be rejected or used as non-installed reference notes.");
  }
}
```

- [ ] **Step 4: Export helper**

Add to `packages/curation/src/index.ts`:

```ts
export * from "./skill-governance";
```

- [ ] **Step 5: Verify tests pass**

Run:

```bash
pnpm --filter @mind-wiki/curation test -- skill-governance.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/curation/src/skill-governance.ts packages/curation/src/skill-governance.test.ts packages/curation/src/index.ts
git commit -m "feat: enforce codex skill governance"
```

## Task 2: Six Local Skill Contracts

**Files:**
- Create: `.agents/skills/ai-source-pack-curator/SKILL.md`
- Create: `.agents/skills/ai-weekly-discovery/SKILL.md`
- Create: `.agents/skills/ai-source-quality-auditor/SKILL.md`
- Create: `.agents/skills/ai-draft-reviewer/SKILL.md`
- Create: `.agents/skills/ai-causal-chain-editor/SKILL.md`
- Create: `.agents/skills/ai-weekly-brief-builder/SKILL.md`
- Create: `.agents/skills/ai-weekly-discovery/references/discovery-output-contract.md`
- Create: `.agents/skills/ai-draft-reviewer/references/draft-review-contract.md`

- [ ] **Step 1: Create source pack curator skill**

Create `.agents/skills/ai-source-pack-curator/SKILL.md`:

```markdown
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
```

- [ ] **Step 2: Create weekly discovery skill**

Create `.agents/skills/ai-weekly-discovery/SKILL.md`:

```markdown
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
```

- [ ] **Step 3: Create quality auditor skill**

Create `.agents/skills/ai-source-quality-auditor/SKILL.md`:

```markdown
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
```

- [ ] **Step 4: Create draft reviewer skill**

Create `.agents/skills/ai-draft-reviewer/SKILL.md`:

```markdown
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
```

- [ ] **Step 5: Create causal chain editor skill**

Create `.agents/skills/ai-causal-chain-editor/SKILL.md`:

```markdown
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
```

- [ ] **Step 6: Create weekly brief builder skill**

Create `.agents/skills/ai-weekly-brief-builder/SKILL.md`:

```markdown
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
```

- [ ] **Step 7: Add skill references**

Create `.agents/skills/ai-weekly-discovery/references/discovery-output-contract.md`:

```markdown
# Discovery Output Contract

Each candidate must become one DiscoveryRecord JSON object with:
- id
- run_id
- source_pack_id
- discovered_url
- normalized_url
- canonical_url when known
- title
- discovery_method: rss or web_search
- reason_found
- source_type
- trajectory_classification
- duplicate_status
- confidence
- status
- errors
- created_at
- updated_at

Use status `discovered` for usable candidates and `failed` for named discovery failures.
```

Create `.agents/skills/ai-draft-reviewer/references/draft-review-contract.md`:

```markdown
# Draft Review Contract

A valid event draft must match the approved event schema:
- id
- title
- date
- type
- summary
- why_it_matters
- trajectories
- sources
- confidence
- watchlist

Review Chinese clarity, source support, confidence label, duplicate risk, and whether causal claims are marked observed, likely, or speculative.
Never approve or publish a draft.
```

- [ ] **Step 8: Verify skill files exist**

Run:

```bash
test -f .agents/skills/ai-source-pack-curator/SKILL.md
test -f .agents/skills/ai-weekly-discovery/SKILL.md
test -f .agents/skills/ai-source-quality-auditor/SKILL.md
test -f .agents/skills/ai-draft-reviewer/SKILL.md
test -f .agents/skills/ai-causal-chain-editor/SKILL.md
test -f .agents/skills/ai-weekly-brief-builder/SKILL.md
pnpm --filter @mind-wiki/curation test -- skill-governance.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add .agents/skills packages/curation/src/skill-governance.ts packages/curation/src/skill-governance.test.ts packages/curation/src/index.ts
git commit -m "feat: add governed local codex skills"
```
