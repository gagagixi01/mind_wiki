# AI Progress Weekly Digest Main Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Coordinate the AI Progress Weekly Digest optimization across public UI, local workbench, backend autopipeline, curation state, and Codex agent skills.

**Architecture:** Execute the work as six independent subsystem plans with explicit dependency order. The static public site continues to read only `content/approved`; the local workbench talks to a localhost backend; the backend writes local `.curation` state and invokes only whitelisted repo-local Codex skills.

**Tech Stack:** pnpm workspace, TypeScript, Zod, Vitest, Next.js App Router, shadcn/ui, Tailwind CSS, Vite React, Node local HTTP server, execa, Codex CLI, Playwright.

---

## Breakdown Plans

- `docs/superpowers/plans/2026-06-25-ai-progress-weekly-digest-contracts-and-curation-store.md`
- `docs/superpowers/plans/2026-06-25-ai-progress-weekly-digest-codex-agent-skills.md`
- `docs/superpowers/plans/2026-06-25-ai-progress-weekly-digest-local-backend-and-runner.md`
- `docs/superpowers/plans/2026-06-25-ai-progress-weekly-digest-workbench-ui.md`
- `docs/superpowers/plans/2026-06-25-ai-progress-weekly-digest-public-site-ui.md`
- `docs/superpowers/plans/2026-06-25-ai-progress-weekly-digest-acceptance-tests.md`

## Execution Order

### Task 1: Contracts And Curation Store

**Files:**
- Execute: `docs/superpowers/plans/2026-06-25-ai-progress-weekly-digest-contracts-and-curation-store.md`
- Modify: `packages/core/src/schema.ts`
- Modify: `packages/curation/src/store.ts`

- [ ] **Step 1: Execute the breakdown plan**

Run the plan at `docs/superpowers/plans/2026-06-25-ai-progress-weekly-digest-contracts-and-curation-store.md`.

- [ ] **Step 2: Verify the subsystem**

Run:

```bash
pnpm --filter @mind-wiki/core test
pnpm --filter @mind-wiki/curation test
```

Expected: PASS. The new schemas and `.curation` store helpers are available to later plans.

- [ ] **Step 3: Commit**

```bash
git add packages/core packages/curation
git commit -m "feat: add pipeline contracts and curation store"
```

### Task 2: Codex Agent Skills

**Files:**
- Execute: `docs/superpowers/plans/2026-06-25-ai-progress-weekly-digest-codex-agent-skills.md`
- Create: `.agents/skills/ai-source-pack-curator/SKILL.md`
- Create: `.agents/skills/ai-weekly-discovery/SKILL.md`
- Create: `.agents/skills/ai-source-quality-auditor/SKILL.md`
- Create: `.agents/skills/ai-draft-reviewer/SKILL.md`
- Create: `.agents/skills/ai-causal-chain-editor/SKILL.md`
- Create: `.agents/skills/ai-weekly-brief-builder/SKILL.md`

- [ ] **Step 1: Execute the breakdown plan**

Run the plan at `docs/superpowers/plans/2026-06-25-ai-progress-weekly-digest-codex-agent-skills.md`.

- [ ] **Step 2: Verify the subsystem**

Run:

```bash
test -f .agents/skills/ai-source-pack-curator/SKILL.md
test -f .agents/skills/ai-weekly-discovery/SKILL.md
test -f .agents/skills/ai-source-quality-auditor/SKILL.md
test -f .agents/skills/ai-draft-reviewer/SKILL.md
test -f .agents/skills/ai-causal-chain-editor/SKILL.md
test -f .agents/skills/ai-weekly-brief-builder/SKILL.md
pnpm --filter @mind-wiki/curation test
```

Expected: PASS. The six whitelisted skills exist and governance tests pass.

- [ ] **Step 3: Commit**

```bash
git add .agents/skills packages/curation
git commit -m "feat: add governed codex pipeline skills"
```

### Task 3: Local Backend And Runner

**Files:**
- Execute: `docs/superpowers/plans/2026-06-25-ai-progress-weekly-digest-local-backend-and-runner.md`
- Create: `packages/local-backend/package.json`
- Create: `packages/local-backend/src/routes.ts`
- Create: `packages/curation/src/codex-runner.ts`

- [ ] **Step 1: Execute the breakdown plan**

Run the plan at `docs/superpowers/plans/2026-06-25-ai-progress-weekly-digest-local-backend-and-runner.md`.

- [ ] **Step 2: Verify the subsystem**

Run:

```bash
pnpm --filter @mind-wiki/curation test
pnpm --filter @mind-wiki/local-backend test
pnpm --filter @mind-wiki/local-backend build
```

Expected: PASS. The workbench can call localhost APIs, and the backend invokes only allowed Codex skills.

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-workspace.yaml packages/curation packages/local-backend
git commit -m "feat: add local pipeline backend"
```

### Task 4: Workbench UI

**Files:**
- Execute: `docs/superpowers/plans/2026-06-25-ai-progress-weekly-digest-workbench-ui.md`
- Modify: `apps/workbench/src/App.tsx`
- Modify: `apps/workbench/src/styles.css`

- [ ] **Step 1: Execute the breakdown plan**

Run the plan at `docs/superpowers/plans/2026-06-25-ai-progress-weekly-digest-workbench-ui.md`.

- [ ] **Step 2: Verify the subsystem**

Run:

```bash
pnpm --filter @mind-wiki/workbench lint
pnpm --filter @mind-wiki/workbench build
```

Expected: PASS. The workbench first viewport shows pipeline status, source pack health, and candidate queue.

- [ ] **Step 3: Commit**

```bash
git add apps/workbench
git commit -m "feat: optimize local workbench cockpit"
```

### Task 5: Public Site UI

**Files:**
- Execute: `docs/superpowers/plans/2026-06-25-ai-progress-weekly-digest-public-site-ui.md`
- Modify: `apps/site/components/public-site.tsx`
- Modify: `apps/site/app/globals.css`

- [ ] **Step 1: Execute the breakdown plan**

Run the plan at `docs/superpowers/plans/2026-06-25-ai-progress-weekly-digest-public-site-ui.md`.

- [ ] **Step 2: Verify the subsystem**

Run:

```bash
pnpm --filter @mind-wiki/site lint
pnpm --filter @mind-wiki/site build
```

Expected: PASS. The public site remains static and exposes only approved content.

- [ ] **Step 3: Commit**

```bash
git add apps/site packages/core/src/styles
git commit -m "feat: optimize public research cockpit"
```

### Task 6: Acceptance Tests

**Files:**
- Execute: `docs/superpowers/plans/2026-06-25-ai-progress-weekly-digest-acceptance-tests.md`
- Create: `e2e/ai-progress-public.spec.ts`
- Create: `e2e/workbench-pipeline.spec.ts`

- [ ] **Step 1: Execute the breakdown plan**

Run the plan at `docs/superpowers/plans/2026-06-25-ai-progress-weekly-digest-acceptance-tests.md`.

- [ ] **Step 2: Run full verification**

Run:

```bash
pnpm clean:appledouble
pnpm test
pnpm build
pnpm test:e2e
```

Expected: PASS. Static output excludes `.curation`, local state, API secrets, and workbench routes.

- [ ] **Step 3: Commit**

```bash
git add e2e package.json
git commit -m "test: cover ai digest optimization flows"
```

## Final Acceptance Gate

- [ ] **Step 1: Confirm all breakdown plans were executed**

Run:

```bash
git log --oneline --grep "pipeline contracts"
git log --oneline --grep "codex pipeline skills"
git log --oneline --grep "local pipeline backend"
git log --oneline --grep "workbench cockpit"
git log --oneline --grep "public research cockpit"
git log --oneline --grep "ai digest optimization flows"
```

Expected: each command prints at least one commit.

- [ ] **Step 2: Confirm full build and tests**

Run:

```bash
pnpm clean:appledouble
pnpm test
pnpm build
pnpm test:e2e
```

Expected: PASS.

## Notes

- `docs/superpowers/plans/2026-06-25-ai-progress-weekly-digest-optimization-execution.md` was the superseded monolithic plan and has been removed after these split plans were created.
- Keep `docs/superpowers/plans/2026-06-23-ai-progress-weekly-digest-implementation.md` as historical scaffold context.
