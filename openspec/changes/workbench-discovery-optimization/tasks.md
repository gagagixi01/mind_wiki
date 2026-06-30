## 1. Backend Async Discovery

- [x] 1.1 Add tests proving discovery POST returns before the runner resolves.
- [x] 1.2 Finalize background runner success/failure into the original pipeline run.
- [x] 1.3 Validate optional `sourcePackIds` and pass valid ids to runner input as `source_pack_ids`.
- [x] 1.4 Preserve duplicate active-run protection and Codex CLI config boundary.

## 2. Ranking And Summary APIs

- [x] 2.1 Add deterministic value scoring for discovery records.
- [x] 2.2 Extend discovery-record listing with `sort=value`, `limit`, and `min_value_score`.
- [x] 2.3 Add sanitized discovery summary endpoint for structured run diagnostics.
- [x] 2.4 Cover scoring, filtering, limits, and summary sanitization in route tests.

## 3. Discovery Skill Contract

- [x] 3.1 Update `ai-weekly-discovery` instructions to honor `source_pack_ids` from run input.
- [x] 3.2 Keep output contract unchanged for DiscoveryRecord JSON.

## 4. Workbench UI

- [x] 4.1 Add source-pack scope presets with high-signal quick run as default.
- [x] 4.2 Start discovery asynchronously and poll status/records/summary.
- [x] 4.3 Show active run id, elapsed time, long-running guidance, and Codex CLI boundary copy.
- [x] 4.4 Add candidate tabs for High value, All, and Failures.
- [x] 4.5 Show value score/reasons and sanitized run summary.

## 5. Verification

- [x] 5.1 Run backend route and Codex runner focused tests.
- [x] 5.2 Run workbench Playwright coverage.
- [x] 5.3 Run site build.
