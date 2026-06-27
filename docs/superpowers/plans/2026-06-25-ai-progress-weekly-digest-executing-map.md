# AI Progress Weekly Digest Executing Map

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Every implementation subagent must start with failing tests before production changes.

**Goal:** Coordinate execution of the 2026-06-25 AI Progress Weekly Digest plans after review repair.

**Architecture:** Preserve the split-plan architecture: shared contracts first, local skill governance and backend next, UI surfaces after backend contracts, acceptance tests last. Public site stays approved-content-only; workbench actions stay local-backend-only.

**Tech Stack:** pnpm workspace, TypeScript, Zod, Vitest, Next.js, Vite React, local Node backend, Codex CLI skills, Playwright.

---

## Phase 0: Plan Repair Gate

- Confirm the review-fixes plan has landed before broader execution continues.
- Required fixes:
  - Discovery runs are finalized to `succeeded` or `failed`.
  - Codex runner outputs redact allowed env secrets.
  - Codex runner returns named failures.
  - `/api/discovery-records` supports documented filters.
  - This execution map exists.
- Gate commands:

```bash
pnpm --filter @mind-wiki/core test
pnpm --filter @mind-wiki/curation test
pnpm --filter @mind-wiki/local-backend test
```

## Dependency Graph

```text
Phase 0 Plan Repair
  -> Phase 1 Contracts And Curation Store
  -> Phase 2 Codex Agent Skills
  -> Phase 3 Local Backend And Runner
  -> Phase 4 Workbench UI
  -> Phase 5 Public Site UI
  -> Phase 6 Acceptance Tests
```

Parallelization rules:

- Phase 1 must complete before backend, workbench, and acceptance-test changes that consume pipeline contracts.
- Phase 2 and Phase 3 can proceed in parallel only after Phase 1, but the Codex runner whitelist must match the final skill names.
- Phase 4 depends on Phase 3 API shapes.
- Phase 5 can proceed after Phase 1 because it must not depend on local backend state.
- Phase 6 starts only after Phases 3, 4, and 5 are complete.
- If using subagents, each subagent owns one phase and starts with failing tests for its phase.

## Phase Execution

Phase 1: Contracts And Curation Store

- Execute `docs/superpowers/plans/2026-06-25-ai-progress-weekly-digest-contracts-and-curation-store.md`.
- Verify:

```bash
pnpm --filter @mind-wiki/core test
pnpm --filter @mind-wiki/curation test
```

Phase 2: Codex Agent Skills

- Execute `docs/superpowers/plans/2026-06-25-ai-progress-weekly-digest-codex-agent-skills.md`.
- Verify skill files and governance tests.

Phase 3: Local Backend And Runner

- Execute `docs/superpowers/plans/2026-06-25-ai-progress-weekly-digest-local-backend-and-runner.md`.
- Keep browser-triggered actions restricted to localhost backend endpoints and whitelisted skills.
- Verify:

```bash
pnpm --filter @mind-wiki/curation test
pnpm --filter @mind-wiki/local-backend test
pnpm --filter @mind-wiki/local-backend build
```

Phase 4: Workbench UI

- Execute `docs/superpowers/plans/2026-06-25-ai-progress-weekly-digest-workbench-ui.md`.
- Verify the first viewport shows pipeline state, source pack health, candidate queue, and failure details.

Phase 5: Public Site UI

- Execute `docs/superpowers/plans/2026-06-25-ai-progress-weekly-digest-public-site-ui.md`.
- Verify public pages read only approved content and never expose `.curation` state.

Phase 6: Acceptance Tests

- Execute `docs/superpowers/plans/2026-06-25-ai-progress-weekly-digest-acceptance-tests.md`.
- Cover public UI, workbench pipeline controls, and static-output boundary.

## TDD Rule

- Every subagent starts by writing the failing test for its assigned behavior.
- The failure must be observed before production code changes.
- Minimal production code is added only after the red test is confirmed.
- Refactors happen only after the relevant tests are green.

## Final Gate

Run the full verification gate from a clean AppleDouble state:

```bash
pnpm clean:appledouble
pnpm test
pnpm build
pnpm test:e2e
```

The work is ready for review only after the final gate completes or every remaining failure is documented with a concrete owner and reproduction command.
