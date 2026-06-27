# Mind Wiki AI Progress Weekly Digest

Chinese-first static research site for the AI Progress Weekly Digest project. The public site publishes only approved MDX content, while the local curation workbench stays on the operator machine for source intake, extraction review, quality checks, approval, rejection, and weekly brief assembly.

## Setup

```bash
pnpm install
pnpm clean:appledouble
pnpm test
pnpm lint
pnpm build
```

Run the public site:

```bash
pnpm dev:site
```

Run the local workbench:

```bash
pnpm dev:workbench
```

The public site runs on `http://127.0.0.1:3000` by default. The workbench runs on `http://127.0.0.1:5173`.

## Environment

Copy `.env.example` to `.env.local` for local work. Do not commit real secrets.

```bash
NEXT_PUBLIC_SITE_URL=http://localhost:3000
OPENAI_BASE_URL=
OPENAI_API_KEY=
OPENAI_MODEL=
CURATION_STATE_DIR=.curation
```

`NEXT_PUBLIC_SITE_URL` is safe to expose to the browser. `OPENAI_BASE_URL`, `OPENAI_API_KEY`, `OPENAI_MODEL`, and `CURATION_STATE_DIR` are local-only and must never be included in public static output. The browser workbench must not call model APIs directly; future extraction/model calls belong in a local server or worker process.

## Approved Content

The static site discovers only approved content:

- Weekly briefs: `content/approved/weeks/*.mdx`
- Events: `content/approved/events/*.mdx`
- Trajectory primers: `content/approved/trajectories.ts`

AppleDouble files can confuse content discovery on macOS. Run `pnpm clean:appledouble` before verification or publishing. The loader also ignores dotfiles, `._*`, drafts, raw extracts, rejected items, quality reports, run logs, and `.curation` state.

## Extractor Expectations

Extractor packages live in `packages/curation`. They are expected to run from local scripts, tests, or future server-side workers, not from the browser UI. Install normal workspace dependencies with `pnpm install`; no browser-side extractor credentials are required.

Local curation state belongs under `.curation/` or another path configured by `CURATION_STATE_DIR`. Keep raw extracts, drafts, invalid outputs, rejected drafts, run logs, and quality reports outside `content/approved` until they are manually reviewed.

## Local Workbench

Use `pnpm dev:workbench` to open the local-only curation cockpit. It displays sample states for extraction progress, extraction failure, invalid draft output, duplicate sources, approved drafts, rejected drafts, quality reporting, causal-link editing, and weekly brief proposal building.

The workbench currently updates React local state only. Adding a source in the UI does not fetch the URL, write files, or call OpenAI or other model/browser APIs.

## Discovery Smoke Test

For a repeatable local discovery smoke test:

```bash
pnpm clean:appledouble
ls .curation/source-packs
MIND_WIKI_ROOT_DIR=/Volumes/X320/code/study/mind_wiki pnpm dev:backend
curl -X POST http://127.0.0.1:8001/api/pipeline/discovery/run
ls .curation/discovery-records | head
```

Use `ls .curation/source-packs` or `find .curation/source-packs -type f` to inspect seeded source packs. Running `.curation/source-packs` as a shell command will fail because it is a directory, not an executable.

On macOS, `._*` AppleDouble sidecar files may appear under `.curation/source-packs`, `.curation/discovery-records`, and `.curation/agent-outputs`. Run `pnpm clean:appledouble` before repeating the smoke test if those files make inspection noisy.

## Approval Workflow

1. Intake sources into local curation state.
2. Run extractor and schema validation locally.
3. Review duplicate source warnings, invalid output reports, quality reports, and causal-link evidence.
4. Approve or reject drafts in the local workflow.
5. Promote approved material into `content/approved/events` or `content/approved/weeks`.
6. Run `pnpm clean:appledouble`, `pnpm test`, `pnpm lint`, `pnpm build`, and `pnpm test:e2e`.

Only approved MDX should enter the public site. Drafts, raw extracts, logs, rejected items, local state, and secrets must remain outside the static artifact.

## Static Deployment

`pnpm build` builds packages and exports the Next.js public site to `apps/site/out`. Deploy that directory to static hosting.

Do not deploy:

- `.curation/`
- `apps/workbench/dist/`
- raw extracts, drafts, invalid outputs, rejected drafts, run logs, or quality reports
- `.env.local` or real API credentials

The workbench is a separate local Vite app and is not part of the public static site output.

## TODO

- Seed-data bootstrap: add a repeatable command that creates or refreshes starter approved events/weeks for local onboarding without mixing them with real curation state.
- Recurring source packs: define scheduled source pack inputs for common AI progress feeds, including dedupe keys, expected extractor strategy, and review ownership.
