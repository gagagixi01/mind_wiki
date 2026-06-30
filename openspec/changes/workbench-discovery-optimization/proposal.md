## Why

The workbench discovery flow currently keeps the browser waiting on a long-running `POST /api/pipeline/discovery/run` request while the local Codex CLI skill executes. Real runs can take several minutes, and noisy source packs can produce hundreds of records, leaving the user with little feedback about what is happening or which records deserve attention.

## What Changes

- Start discovery asynchronously: return a running pipeline record immediately, then finalize it in the background.
- Keep discovery inside the Codex CLI boundary; workbench API profile settings remain unrelated to discovery.
- Let the browser choose discovery source-pack scope, with a high-signal quick run as the default.
- Add deterministic value scoring to discovery records so useful topics rise above noisy RSS and search-provider failures.
- Add a sanitized run summary endpoint for structured diagnostics, not raw stdout/stderr.
- Update the workbench UI to show elapsed time, polling state, long-run guidance, source-pack scope, high-value candidates, failures, and run summary.

## Capabilities

### New Capabilities

- `async-discovery-start`: discovery POST returns immediately with a running run record.
- `scoped-discovery-run`: workbench can request a validated subset of enabled source packs.
- `discovery-value-ranking`: discovery records can be returned with deterministic value scores and reasons.
- `sanitized-discovery-summary`: workbench can read structured summary/diagnostic JSON for a run.

### Modified Capabilities

- `workbench-discovery-ui`: discovery controls and candidate queue prefer high-value quick runs and visible progress feedback.

## Impact

Affected areas are the local backend discovery route, discovery-record listing, the repo-local discovery skill contract, the workbench UI, and workbench/backend tests. No public content schema, provider settings contract, or Codex CLI authentication/config behavior changes.
