# AI Progress Weekly Digest Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development and superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the five review findings from the 2026-06-25 pre-landing review.

**Architecture:** Keep the existing split-plan architecture. Patch the local backend lifecycle, Codex runner failure/redaction behavior, discovery-record filtering, and add the missing execution-map handoff document.

**Tech Stack:** TypeScript, Vitest, pnpm, local filesystem `.curation`, Node HTTP backend.

---

## Task 1: Finalize Discovery Run Lifecycle

**Files:**
- Modify: `packages/local-backend/src/routes.ts`
- Modify: `packages/local-backend/src/routes.test.ts`

- [ ] Write failing route test proving successful discovery rewrites the run to `succeeded` with `ended_at` and `output_refs`.
- [ ] Write failing route test proving runner failure rewrites the run to `failed` with a named `error`.
- [ ] Add helper in `routes.ts` to update the initial `PipelineRun` after `runCodexSkill` returns or throws.
- [ ] Ensure failed runs are no longer treated as active by `getPipelineStatus()`.
- [ ] Run `pnpm --filter @mind-wiki/local-backend test`.
- [ ] Commit: `fix: finalize discovery pipeline runs`.

## Task 2: Add Codex Runner Secret Redaction

**Files:**
- Modify: `packages/curation/src/codex-runner.ts`
- Modify: `packages/curation/src/codex-runner.test.ts`

- [ ] Write failing test where mocked stdout/stderr contain `OPENAI_API_KEY`; assert persisted logs do not contain the secret.
- [ ] Add `redactSecrets(text, env)` helper that replaces allowed env secret values with `[REDACTED:<ENV_NAME>]`.
- [ ] Apply redaction before writing `stdout.txt`, `stderr.txt`, and `status.json`.
- [ ] Keep env allowlist unchanged.
- [ ] Run `pnpm --filter @mind-wiki/curation test -- codex-runner.test.ts`.
- [ ] Commit: `fix: redact codex runner outputs`.

## Task 3: Normalize Runner Failures

**Files:**
- Modify: `packages/curation/src/codex-runner.ts`
- Modify: `packages/curation/src/codex-runner.test.ts`
- Modify if needed: `packages/core/src/schema.ts`

- [ ] Write failing tests for `codex_cli_unavailable`, `skill_missing`, `command_timeout`, and nonzero exit failure.
- [ ] Return a structured runner result with `exitCode`, `outputRefs`, and optional `failure`.
- [ ] Map missing `SKILL.md` to `skill_missing`.
- [ ] Map `ENOENT` from `execa` to `codex_cli_unavailable`.
- [ ] Map timeout errors to `command_timeout`.
- [ ] Map nonzero exit to a named failure with Chinese user-facing message and local diagnostic ref.
- [ ] Run `pnpm --filter @mind-wiki/core test` and `pnpm --filter @mind-wiki/curation test`.
- [ ] Commit: `fix: return named codex runner failures`.

## Task 4: Implement Discovery Record Filters

**Files:**
- Modify: `packages/local-backend/src/routes.ts`
- Modify: `packages/local-backend/src/routes.test.ts`

- [ ] Write failing tests for filtering `/api/discovery-records` by `run_id`, `source_pack_id`, `discovery_method`, `trajectory`, `duplicate_status`, and `status`.
- [ ] Add query-param parsing in `routes.ts`.
- [ ] Filter records in memory after `readCurationRecords("discovery-records")`.
- [ ] Ignore unknown query params.
- [ ] Return `400` only for invalid enum filter values.
- [ ] Run `pnpm --filter @mind-wiki/local-backend test`.
- [ ] Commit: `fix: filter discovery records api`.

## Task 5: Add Missing Execution Map Plan

**Files:**
- Create: `docs/superpowers/plans/2026-06-25-ai-progress-weekly-digest-executing-map.md`

- [ ] Create the saved execution map with Phase 0 plan repair gate through Phase 6 acceptance tests.
- [ ] Include the dependency graph and parallelization rules.
- [ ] Include TDD rule: every subagent starts with failing tests.
- [ ] Include final gate: `pnpm clean:appledouble`, `pnpm test`, `pnpm build`, `pnpm test:e2e`.
- [ ] Run `rg -n "Plan Repair|Phase 6|pnpm test:e2e" docs/superpowers/plans/2026-06-25-ai-progress-weekly-digest-executing-map.md`.
- [ ] Commit: `docs: add ai digest execution map`.

## Final Verification

- [ ] Run `pnpm --filter @mind-wiki/core test`.
- [ ] Run `pnpm --filter @mind-wiki/curation test`.
- [ ] Run `pnpm --filter @mind-wiki/local-backend test`.
- [ ] Run `pnpm --filter @mind-wiki/local-backend build`.
- [ ] Run `pnpm test`.
- [ ] Run `pnpm build`.
- [ ] Run `pnpm test:e2e`.
- [ ] Re-run review against the five prior findings and confirm no repeats.

## Assumptions

- The fix plan file itself is saved at `docs/superpowers/plans/2026-06-25-ai-progress-weekly-digest-review-fixes.md`.
- The missing execution map is a separate plan file, not folded into the fix plan.
- No public site visual work is included unless needed to keep tests green.
