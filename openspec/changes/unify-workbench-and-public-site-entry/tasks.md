## 1. Shared Shell

- [x] 1.1 Introduce a shared browser shell in `apps/site` that can host both public reading navigation and local workbench navigation.
- [x] 1.2 Add a mode switch or equivalent navigation affordance that preserves the current page or item when switching between reader and workbench views.
- [x] 1.3 Define the local-only visual state for workbench access so the unified entry clearly distinguishes public content from curation mode.

## 2. Workbench Migration

- [x] 2.1 Move or adapt the current workbench UI from `apps/workbench/src/App.tsx` into the unified shell.
- [x] 2.2 Wire the migrated workbench views to the existing separate local backend endpoints and keep action handling out of the browser.
- [x] 2.3 Add graceful fallback states so workbench controls render safely when the local backend is unavailable.

## 3. Boundary And Cleanup

- [x] 3.1 Update public-site filters, export logic, or content loading so drafts, raw extracts, secrets, and local curation state stay out of the public build.
- [ ] 3.2 Update scripts and documentation so `dev:site` is the primary browser entry on port `3000`, the local backend remains on port `8001`, and the browser workflow no longer advertises a separate workbench port.
- [x] 3.3 Extend or update e2e coverage to verify unified navigation, local-only workbench visibility, backend separation, and public export boundaries.
- [ ] 3.4 Run the repo verification steps (`pnpm build`, `pnpm test`, and `pnpm test:e2e` as applicable) and confirm the unified entry is stable while the backend stays split with no supported standalone workbench runtime.
