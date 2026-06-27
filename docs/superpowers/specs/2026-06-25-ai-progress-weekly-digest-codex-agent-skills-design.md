# AI Progress Weekly Digest Codex Agent Skills Design

Date: 2026-06-25
Status: Draft
Project: mind_wiki
Source specs:

- `docs/superpowers/specs/2026-06-23-ai-progress-weekly-digest-design.md`
- `docs/superpowers/specs/2026-06-25-ai-progress-weekly-digest-autopipeline-backend-design.md`
- `docs/superpowers/specs/2026-06-25-ai-progress-weekly-digest-ui-optimization.md`

Reference sources:

- `https://github.com/Huangdingcheng/SkillWiki`
- `https://arxiv.org/abs/2604.16911` (Skilldex)
- `https://www.techradar.com/pro/what-are-openclaw-skills-a-detailed-guide`
- `https://www.tomshardware.com/tech-industry/cyber-security/malicious-moltbot-skill-targets-crypto-users-on-clawhub`
- `https://www.theverge.com/news/874011/openclaw-ai-skill-clawhub-extensions-security-nightmare`
- `https://arxiv.org/abs/2604.06550` (SkillSieve)

## Summary

This specification defines the Codex CLI backend skill layer for the AI Progress Weekly Digest project.

The project already assumes a local Codex CLI agent backend and six repo-local skills. This document defines how those skills should be sourced, reviewed, adapted, and maintained.

The main rule is reuse-first:

1. Search GitHub for a similar skill first.
2. Search ClawHub or OpenClaw skill registries second.
3. Adapt the closest safe match when possible.
4. Create a local repo skill only when reuse is not viable.

For this project, "create local" does not mean blank-page authoring by default. A local skill should still be based on an existing external skill, an upstream tool repository, or the official documentation of the underlying tool whenever possible.

## Goals

- Avoid inventing the project skill layer from scratch when reusable patterns already exist.
- Keep the backend skill system auditable, project-scoped, and compatible with the current `.curation` plus Codex CLI architecture.
- Separate trusted local execution from untrusted public skill registries.
- Make skill reuse a deliberate review workflow instead of ad hoc copying.
- Preserve human approval as the only path into `content/approved`.

## Non-Goals

- Do not add direct marketplace installation into the project.
- Do not let the browser search, install, or execute skills.
- Do not allow third-party skills to write directly to public content.
- Do not treat ClawHub as a trusted source of executable code.
- Do not require every local skill to be fully original if a well-scoped external pattern exists.

## Current Backend Context

The current project backend already defines these local skill contracts:

- `ai-source-pack-curator`
- `ai-weekly-discovery`
- `ai-source-quality-auditor`
- `ai-draft-reviewer`
- `ai-causal-chain-editor`
- `ai-weekly-brief-builder`

These skills are invoked by the local Codex CLI backend and operate over local filesystem state, especially `.curation`, run logs, draft records, and approved-event workflows.

This specification adds the sourcing and governance layer for those skills. It does not replace the current backend design.

## Skill Source Hierarchy

When the project needs a new skill or a revision to an existing skill, use this source order:

### 1. GitHub skill repositories

Search GitHub first for:

- standalone SKILL.md repositories
- multi-skill registries
- project-local `.agents/skills` or `.claude/skills` folders
- open-source skill tooling ecosystems

GitHub is the preferred external source because repositories are easier to audit for:

- license
- commit history
- scope
- scripts
- hidden side effects
- maintenance quality

Useful ecosystem references for discovery and structure:

- SkillWiki provides a public skill knowledge base and source repo.
- Skilldex documents a GitHub-backed skill registry model and a validation-oriented package workflow.

### 2. ClawHub or OpenClaw skill registry

Search ClawHub second, only as a discovery and comparison surface.

ClawHub is not a trusted install source for this project. Recent reporting and research show that OpenClaw skill registries have meaningful supply-chain and social-engineering risk, especially through `SKILL.md` instructions and bundled scripts.

For this project:

- ClawHub candidates may be reviewed.
- ClawHub candidates may be compared against GitHub candidates.
- ClawHub candidates may inspire a local adaptation.
- ClawHub candidates may not be directly installed into `.agents/skills`.

### 3. Upstream tool repositories and docs

If no sufficiently similar skill exists, look at the underlying tool sources before writing a local skill.

Examples:

- Crawl4AI repository and docs for extraction behavior
- Trafilatura repository and docs for fallback extraction behavior
- RSS parser documentation for feed discovery
- search adapter docs or examples for local web-search orchestration

This keeps even "local" skills grounded in existing upstream behavior rather than blank-page invention.

### 4. Local repo skill

Only after the first three sources fail to provide a good reusable base should the project author a fully local skill.

Even then, the local skill should reuse:

- existing project schemas
- current backend API boundaries
- current `.curation` record shapes
- prior approved prompts or instruction patterns

## Reuse-First Authoring Rule

The project should not create skills from scratch by default.

Before any local skill is added or substantially rewritten, the implementer must document:

- at least one GitHub search pass
- at least one ClawHub search pass
- the closest matching candidates
- why each candidate was accepted, adapted, or rejected

If a local skill is created, it must be described as one of these modes:

- `adapt_github_skill`
- `adapt_clawhub_reference`
- `adapt_upstream_tool_docs`
- `local_only_last_resort`

`local_only_last_resort` is allowed but should be rare and must include a short reason why no safe reusable base existed.

## Candidate Review Workflow

Every external candidate should go through the same review flow.

### Step 1: Capability match

Compare the candidate against one of the six backend skill contracts.

Possible outcomes:

- exact match
- partial match worth adapting
- adjacent pattern worth borrowing
- not relevant

### Step 2: Structural review

Read the candidate contents before reuse:

- `SKILL.md`
- any `scripts/`
- any `references/` directly used by the workflow
- installation instructions

Reject the candidate if review would require blind trust in hidden files or remote installation steps.

### Step 3: Safety review

Check for:

- obfuscated shell commands
- remote curl or pipe install flows
- secret collection
- SSH or browser credential access
- broad filesystem mutation
- undeclared network calls
- hidden subprocess execution
- prompts that attempt to bypass review or approval boundaries

### Step 4: Maintenance review

Prefer candidates with:

- clear license
- understandable repo ownership
- readable commit history
- narrow scope
- deterministic helper scripts
- no dependency on opaque hosted services

### Step 5: Adaptation decision

Each candidate ends with one of these decisions:

- `reuse_pattern`
- `reuse_prompt`
- `reuse_script_fragment`
- `reject_candidate`
- `author_local_adapter`

For this project, direct install from a public registry is not an allowed decision.

## Candidate Review Record

Each review should produce a local record under `.curation/skill-reviews`.

Suggested record name:

- `<date>-<skill-name>-<candidate-slug>.json`

Suggested fields:

- `review_id`
- `target_skill`
- `candidate_name`
- `candidate_source`: `github` or `clawhub`
- `candidate_url`
- `license`
- `reviewed_files`
- `capability_match`
- `risk_level`: `low`, `medium`, `high`, or `reject`
- `decision`
- `reuse_mode`
- `notes`
- `reviewed_at`

This record is local project evidence. It is not part of the public site.

## Local Skill Set For V1

The project should maintain these six repo-local skills under `.agents/skills`:

### `ai-source-pack-curator`

Purpose:

- maintain RSS feeds, web search queries, trust hints, excluded domains, and cadence metadata

Preferred reuse base:

- existing search or curation skills from GitHub
- source-pack or feed-maintenance patterns from public skill repos
- fallback to local adapter based on current backend `SourcePack` model

### `ai-weekly-discovery`

Purpose:

- orchestrate RSS and web search discovery
- normalize URLs
- dedupe candidates
- classify trajectory hints
- write discovery records

Preferred reuse base:

- GitHub skills for search or discovery orchestration
- upstream docs or examples for RSS parsing and local search adapters

### `ai-source-quality-auditor`

Purpose:

- inspect extraction quality
- identify low-quality content
- flag duplicates and weak evidence
- produce quality reports

Preferred reuse base:

- review or evaluation skills from GitHub
- quality-gate instruction patterns
- local adapter on top of existing `packages/curation` quality logic

### `ai-draft-reviewer`

Purpose:

- validate Chinese event drafts
- enforce schema expectations
- check confidence labels and source support

Preferred reuse base:

- editorial or review skills from GitHub
- structured-output validation patterns
- local adapter using current draft and schema rules

### `ai-causal-chain-editor`

Purpose:

- propose or refine structured commercial-to-technical causal links

Preferred reuse base:

- analysis or knowledge-graph oriented skills from GitHub
- local adapter grounded in current causal-link schema and event model

### `ai-weekly-brief-builder`

Purpose:

- turn approved events into a draft weekly brief proposal

Preferred reuse base:

- summarization or report-building skills from GitHub
- local adapter built from current weekly brief contract and approved event loaders

## Local Skill Structure

Each repo-local skill should follow the current Codex skill structure:

- required `SKILL.md`
- optional `scripts/`
- optional `references/`
- optional `assets/`

Rules:

- keep `SKILL.md` concise and trigger-focused
- put long guidance in `references/`
- put deterministic helpers in `scripts/`
- avoid extra README-style files
- keep each skill narrowly scoped to one pipeline role

## Backend Boundaries

These skills are part of the Codex CLI backend, not the public website.

They must preserve these boundaries:

- the browser can trigger local backend actions but cannot search, install, or execute skills directly
- skill execution happens only through the local Codex CLI command wrapper
- skills write to `.curation`, run logs, or review artifacts
- only explicit approval paths may write to `content/approved`
- no skill may bypass the workbench review and approval gate

## Implementation Defaults

The project should adopt these defaults:

- GitHub-first discovery is mandatory
- ClawHub search is mandatory for comparison, but ClawHub install is forbidden by default
- local skill creation should start from adaptation, not blank-page writing
- if both GitHub and ClawHub have weak matches, prefer adapting GitHub
- if neither has a viable skill, adapt the underlying tool docs before authoring a fully local workflow

## Acceptance Criteria

This spec is correct when:

- it requires GitHub and ClawHub search before adding a local skill
- it prefers adaptation over from-scratch skill creation
- it treats ClawHub as reference-only by default
- it defines review gates for scope, license, scripts, secrets, and side effects
- it maps all six backend skills to the current autopipeline architecture
- it preserves the thin-browser and approved-content-only boundaries

## Future Implementation Checks

When the team implements this spec, verify:

- every new or revised local skill has a candidate review record
- every local skill declares its reuse mode
- no public skill is installed directly into `.agents/skills` without review
- the Codex CLI runner continues to whitelist allowed skill names
- skill outputs stay inside local curation state unless explicitly approved

## Assumptions

- "ClawHub" refers to the OpenClaw skills marketplace and similar public skill registries.
- The project wants to reuse existing skill patterns whenever safely possible.
- The current backend contracts in the autopipeline backend spec remain the source of truth for runtime behavior.
- This document governs skill sourcing and adaptation, not public website behavior.
