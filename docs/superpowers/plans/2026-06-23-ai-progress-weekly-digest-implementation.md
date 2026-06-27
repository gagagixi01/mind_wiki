# AI Progress Weekly Digest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` recommended, or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Build a Chinese-first static Next.js public site plus a local-only AI curation workbench for tracking AI progress, weekly briefs, trajectories, providers, and causal chains.

**Architecture:** Use a pnpm workspace with a static public site, a separate local workbench, and shared TypeScript packages. Public pages read only approved MDX/content. Local curation state, extraction artifacts, invalid drafts, run logs, and API credentials never ship with the static site.

**Tech Stack:** Node 24, pnpm 10, TypeScript, Next.js App Router, Tailwind CSS, shadcn/ui, Vite React, Zod, MDX/frontmatter parsing, Vitest, Playwright, OpenAI-compatible API, Crawl4AI/Trafilatura command adapters.

---

## Implementation Changes

### Task 1: Project Scaffold And Guardrails

**Files:** create root `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.gitignore`, `.env.example`, `apps/site`, `apps/workbench`, `packages/core`, `packages/curation`.

- [ ] Initialize Git because this folder is currently not a repo.
- [ ] Scaffold pnpm workspace with scripts: `dev:site`, `dev:workbench`, `build`, `test`, `test:e2e`, `lint`, `clean:appledouble`.
- [ ] Scaffold the public site with Next.js App Router, Tailwind CSS, and the default `@/*` import alias.
- [ ] Initialize shadcn/ui for the public site with pnpm using the current shadcn CLI.
- [ ] Add the initial shadcn/ui component set to the site: `button`, `card`, `badge`, `tabs`, `sheet`, `sidebar`, `separator`, `scroll-area`, `command`, `input`, `textarea`, `select`, `checkbox`, `toggle-group`, `empty`, `skeleton`, `progress`, `sonner`, and `table`.
- [ ] Configure shared shadcn/ui tokens so the public site and local workbench can use the same research-cockpit visual language.
- [ ] Add `.gitignore` entries for `.env*`, `.curation/`, `.next/`, `dist/`, `node_modules/`, Playwright reports, and all `._*`.
- [ ] Add `scripts/clean-appledouble.mjs` that recursively removes or ignores `._*` files before content discovery.
- [ ] Install baseline dependencies: `typescript`, `tsx`, `zod`, `gray-matter`, `next`, `react`, `react-dom`, `tailwindcss`, shadcn/ui-generated dependencies, `vite`, `@vitejs/plugin-react`, `vitest`, `@playwright/test`, `openai`, `execa`.

Verification:
- [ ] `pnpm install`
- [ ] shadcn/ui generated components compile in the Next.js app.
- [ ] `pnpm clean:appledouble`
- [ ] `pnpm test` starts successfully with at least one smoke test.
- [ ] Commit: `chore: scaffold ai progress workspace`

### Task 2: Shared Content Model

**Files:** create `packages/core/src/schema.ts`, `packages/core/src/content.ts`, `packages/core/src/ids.ts`, `packages/core/src/fixtures.ts`, tests under `packages/core/src/*.test.ts`.

- [ ] Define Zod schemas for event, source, weekly brief, extraction quality report, draft state, and typed causal link.
- [ ] Enforce enums from the spec:
  - event types: `paper`, `model_release`, `architecture`, `business`, `infra`, `benchmark`, `regulation`, `product`
  - trajectories: `llm_architecture`, `multimodal_architecture`, `provider_releases`, `commercial_forces`
  - confidence: `observed`, `likely`, `speculative`
- [ ] Add loaders that read approved content only from `content/approved/events` and `content/approved/weeks`.
- [ ] Make loaders ignore `._*`, hidden local folders, invalid extensions, and unapproved drafts.
- [ ] Add duplicate URL and probable duplicate event detection.

Verification:
- [ ] Missing required frontmatter fails with a clear message.
- [ ] Invalid enum values fail.
- [ ] Unknown weekly event IDs fail.
- [ ] `._*` files are ignored.
- [ ] Commit: `feat: add shared ai progress content schemas`

### Task 3: Seed Approved Content

**Files:** create `content/approved/events/*.mdx`, `content/approved/weeks/2026-06-23.mdx`, `content/approved/trajectories.ts`.

- [ ] Add at least 12 approved seed events, with at least 3 per v1 trajectory.
- [ ] Include anchor events from the spec: Transformer, BERT, GPT-3, ChatGPT, GPT-4, CLIP, diffusion breakthroughs, Mamba, major open-weight releases, and Nvidia/GPU infrastructure inflection points.
- [ ] Add at least one typed commercial-to-technical causal chain.
- [ ] Add one Chinese weekly brief that references approved event IDs instead of duplicating event text.
- [ ] Add concept primers for the four v1 trajectories in Chinese.

Verification:
- [ ] `pnpm --filter @mind-wiki/core test`
- [ ] All seed content validates.
- [ ] Commit: `feat: seed ai progress knowledge base`

### Task 4: Static Public Site

**Files:** create `apps/site/app`, `apps/site/components`, `apps/site/lib`, `apps/site/next.config.ts`, public styles.

- [ ] Build Chinese-first homepage answering "本周 AI 发生了什么，它在长期趋势中意味着什么？"
- [ ] Implement the public UI as a shadcn/ui research cockpit, not a generic SaaS dashboard.
- [ ] Add a shadcn/ui `Sidebar` question router on desktop with groups for Questions, Trajectories, and Views.
- [ ] Add mobile navigation that preserves the same question-router structure without horizontal overflow.
- [ ] Add routes for latest week, weekly brief detail, trajectories, providers, sources, and causal chains.
- [ ] Add event cards using shadcn/ui `Card` and `Badge` with title, date, type, primary trajectory, providers, confidence, source count, and watchlist marker.
- [ ] Add event detail drawer using shadcn/ui `Sheet`; it opens from cards/timelines, supports keyboard close, and preserves browsing context.
- [ ] Add filters using shadcn/ui `Tabs` or `ToggleGroup`, `Select`, `Checkbox`, and `Badge` for trajectory, provider, event type, confidence, and watchlist.
- [ ] Add shadcn/ui `Empty` states for sparse trajectories, no matching filters, missing sources, and watchlist-only week states.
- [ ] Add a first-class causal-chain view using compact linked panels with confidence badges and source counts.
- [ ] Apply restrained research-notebook styling: neutral backgrounds, high-contrast text, quiet borders, 8px-or-less card radius, no nested cards, no decorative gradient/orb treatment.
- [ ] Configure static export so only approved public content is included.

Verification:
- [ ] `pnpm --filter site build`
- [ ] Confirm static output contains no `.curation`, draft, raw extract, run log, or env files.
- [ ] Playwright verifies Sidebar desktop navigation and mobile navigation.
- [ ] Playwright verifies event `Sheet` opens and closes by keyboard.
- [ ] Playwright verifies confidence labels appear as text, not color alone.
- [ ] Commit: `feat: build static ai progress site`

### Task 5: Local Curation Filesystem

**Files:** create `.curation/.gitkeep`, `packages/curation/src/store.ts`, `packages/curation/src/run-log.ts`, tests.

- [ ] Store local-only state under `.curation/`:
  - `raw/`
  - `drafts/`
  - `invalid/`
  - `rejected/`
  - `quality-reports/`
  - `run-logs/`
- [ ] Write JSONL run logs for extraction, drafting, validation, approval, rejection, and duplicate warnings.
- [ ] Ensure secrets and raw local artifacts are never read by the public site package.
- [ ] Add filesystem helpers for approve, reject, retry, and inspect.

Verification:
- [ ] Store tests prove approved content is the only bridge into `content/approved`.
- [ ] Commit: `feat: add local curation filesystem`

### Task 6: Extraction And AI Draft Pipeline

**Files:** create `packages/curation/src/extractors.ts`, `packages/curation/src/draft.ts`, `packages/curation/src/quality.ts`, `packages/curation/src/queue.ts`.

- [ ] Add safe URL validation: allow public `http`/`https`, reject `localhost`, private IPs, `file:`, and unsupported schemes.
- [ ] Add Crawl4AI command adapter as primary extractor.
- [ ] Add Trafilatura command adapter as fallback for static article-like pages.
- [ ] If extractor tools are missing, write a visible failed extraction record instead of crashing silently.
- [ ] Add OpenAI-compatible API client using `OPENAI_BASE_URL`, `OPENAI_API_KEY`, and `OPENAI_MODEL`.
- [ ] Require Chinese draft output.
- [ ] Validate AI output with shared Zod schemas.
- [ ] Save malformed/schema-invalid AI output to `.curation/invalid` with validation errors.
- [ ] Use a bounded queue: 1-2 extractions and one AI draft at a time.
- [ ] Generate extraction quality reports with extractor used, source count, missing fields, errors, and reviewability.

Verification:
- [ ] Mocked Crawl4AI success/failure tests.
- [ ] Mocked Trafilatura fallback tests.
- [ ] Mocked OpenAI-compatible API success, refusal, malformed JSON, timeout, and rate-limit tests.
- [ ] Commit: `feat: add extraction and ai draft pipeline`

### Task 7: Local Workbench

**Files:** create `apps/workbench/src`, local API routes/server code, shared UI components where useful.

- [ ] Build the local workbench with the same shadcn/ui tokens and component vocabulary as the public site.
- [ ] Build local-only web UI for source intake, queue progress, quality reports, draft review, approval, rejection, retry, and causal-link editing.
- [ ] Add weekly brief builder that proposes thesis, headline/watchlist split, evidence mapping, and closing synthesis from approved events.
- [ ] Keep all model calls server-side/local-only.
- [ ] Use shadcn/ui `Progress`, `Skeleton`, `Empty`, `Table` or `Data Table`, `Sheet`, `Textarea`, `Select`, and `Sonner` for workbench states and actions.
- [ ] Add clear states for empty queue, in-progress extraction, fallback extractor used, failed extraction, invalid AI output, duplicate source, approved draft, and rejected draft.
- [ ] Add local-only warning in the UI and do not expose this app through static site build.

Verification:
- [ ] Workbench runs locally with `pnpm dev:workbench`.
- [ ] Playwright covers review, approve, reject, invalid output, duplicate warning, extraction progress/failure, and quality report display.
- [ ] Playwright verifies local workbench `Empty`, `Progress`, `Skeleton`, and toast/status states render correctly.
- [ ] Commit: `feat: add local curation workbench`

### Task 8: End-To-End Verification And Docs

**Files:** create/update `README.md`, `docs/superpowers/plans/2026-06-23-ai-progress-weekly-digest-implementation.md`, Playwright tests.

- [ ] Document setup, environment variables, extractor installation expectations, local workbench usage, approval workflow, and static deployment.
- [ ] Add TODOs for deferred seed-data bootstrap and recurring source packs.
- [ ] Add Playwright tests:
  - homepage shows latest Chinese weekly brief
  - desktop Sidebar and mobile navigation work
  - trajectory filters combine correctly
  - drawer opens/closes by keyboard
  - shadcn/ui Empty states render for no events, no drafts, no sources, and no matching filters
  - causal-chain view renders confidence labels and sources
  - confidence labels do not rely on color alone
  - workbench renders extraction progress, extraction failure, invalid draft, duplicate source, approved draft, and rejected draft states
  - static build excludes local files and secrets
- [ ] Run full verification:
  - `pnpm clean:appledouble`
  - `pnpm test`
  - `pnpm test:e2e`
  - `pnpm build`

Verification:
- [ ] All tests pass.
- [ ] Static output contains approved public content only.
- [ ] Commit: `docs: document ai progress weekly digest workflow`

## Assumptions

- Execution will save this plan to `docs/superpowers/plans/2026-06-23-ai-progress-weekly-digest-implementation.md`.
- Git will be initialized before implementation.
- Public site and workbench are separate apps in one pnpm workspace.
- The public site is static-exportable and unauthenticated.
- The workbench is local-only and may require `.env.local`.
- The UI uses shadcn/ui with Next.js App Router, Tailwind CSS, and pnpm.
- The visual direction is a Chinese research cockpit: dense, calm, source-aware, and not a generic SaaS dashboard.
- Crawl4AI and Trafilatura are external command tools; missing tools produce visible failure records.
