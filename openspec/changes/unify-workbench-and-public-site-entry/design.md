## Context

The repo currently splits the product into two browser apps and one local backend service:

- `apps/site` is the public Next.js site that renders approved MDX content and static exports.
- `apps/workbench` is a separate Vite app for local curation, review, and backend-triggered actions.
- `packages/local-backend` is the local API service that workbench actions already call.

That split made sense when the workbench was a clearly separate operator tool, but this product is now personal. The two-entry model adds friction without adding value, while still requiring us to preserve the boundary between approved public content and local-only curation state. The browser should be unified, but the backend should stay separate.

## Goals / Non-Goals

**Goals:**

- Present one primary browser entry for reading and curation.
- Keep public reading and local workbench capabilities in one shared navigation model.
- Keep backend orchestration in the existing local backend service instead of merging it into the browser app.
- Preserve the local-only boundary for drafts, secrets, run logs, and curation state.
- Minimize migration risk for scripts, tests, and docs.

**Non-Goals:**

- Add multi-user auth or role-based access control.
- Change the content model or approval workflow.
- Move extraction, model calls, or backend orchestration into the browser.
- Redesign the editorial experience beyond what is needed for a unified entry.

## Decisions

### 1. Make the site app the canonical browser host

The unified entry should live in `apps/site`, which already owns the public reading experience and the site shell. The workbench becomes a local-only mode or route inside that shell rather than a separate day-to-day app.

Why this over keeping two apps:

- It gives one obvious entry point for the user.
- It avoids duplicated navigation, layout, and content chrome.
- It lets the public reader and local operator views share the same application vocabulary.

Alternative considered: keep `apps/workbench` and connect it with redirects, tabs, or an iframe. Rejected because it preserves the split and makes the product feel like two different tools.

### 2. Use one shared shell with explicit read/workbench modes

The shell should expose public reading and local workbench views through a mode switch or equivalent top-level navigation, with the current location preserved when switching. The user should be able to move from a week page into curation and back without losing context.

Why this over separate shells:

- One shell makes the entry feel unified.
- Context preservation is easier when both modes share the same router and shell state.
- The workbench can stay operational without forcing the user to learn a second app structure.

Alternative considered: keep a dedicated workbench navigation tree. Rejected because it still communicates "second app" instead of "same product, different mode."

### 3. Keep local actions behind the local backend boundary

Workbench actions should continue to call the local backend, not execute directly in the browser. The browser can render controls and status, but the backend remains responsible for filesystem writes, pipeline orchestration, and any local-only integrations.

The unified browser shell should live on the site port, and the local backend should continue to listen on its own API port. The browser entry consolidates onto 3000 for the site and workbench views, and 8001 should remain the backend service port.

Why this over browser-side workbench execution:

- The current security model depends on local-only APIs.
- It keeps secrets and filesystem state off the public site path.
- It reduces the risk of accidentally coupling the public site bundle to privileged operations.

Alternative considered: move the workbench logic directly into client components. Rejected because it weakens the local-only boundary and would be harder to secure.

### 4. Preserve the public export boundary with explicit gating and tests

The unified shell must still build a publishable public site that excludes drafts, raw extracts, secrets, and other local curation artifacts. Workbench views should only appear when local execution context and backend access are available.

Why this over visual hiding or naming conventions:

- A unified codebase increases the chance of accidental leakage.
- Explicit gating makes the boundary testable.
- Build-time and e2e checks can catch regressions before publication.

Alternative considered: hide workbench content through CSS or navigation alone. Rejected because the code and data could still leak into published output.

### 5. Treat `dev:site` as the main user-facing command

The main command should match the new product shape. `dev:site` becomes the primary entry for the unified product, and `dev:workbench` is not kept as a compatibility alias in the supported workflow.

Why this over preserving both commands equally:

- One entry deserves one primary launch command.
- It reduces confusion for future maintenance.
- It makes docs and support instructions simpler.

Alternative considered: keep both commands permanently. Rejected because it preserves the old split in the developer workflow.

## Risks / Trade-offs

- Larger site bundle size -> Lazy-load the workbench panels and keep local-only code out of the default public reader path.
- Local-only data leakage -> Add tests that verify the public export excludes curation artifacts and secrets.
- Migration churn -> Update scripts, docs, and tests together so the unified shell becomes the only supported browser entry.
- Backend outages in local mode -> Degrade workbench controls gracefully and leave public reading intact.

## Migration Plan

1. Introduce the unified shell in `apps/site`.
2. Port or embed the workbench views and connect them to the existing local backend.
3. Update scripts, docs, and test coverage so the user lands in one main entry.
4. Verify that the public build still excludes local-only state and workbench artifacts.
5. Keep the backend service split intact on `8001` while the unified browser entry runs from `dev:site`.

Rollback plan:

- Keep the public site behavior unchanged so publication remains safe if any browser-entry work needs to be revisited.
- Re-establish the browser entry from `dev:site` only; do not restore `dev:workbench` as a supported launch path.

## Open Questions

- Should the unified workbench live at a dedicated route such as `/workbench`, or as a docked panel inside the existing shell?
- Should the standalone Vite app stay in the repo as an internal harness after migration, or be removed once the unified shell is stable?
