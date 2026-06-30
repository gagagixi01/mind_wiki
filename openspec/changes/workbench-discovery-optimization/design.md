## Context

The local backend already persists pipeline runs and discovery records under `.curation`. Discovery is launched through `runCodexSkill`, which invokes the repo-local `ai-weekly-discovery` skill inside the Codex CLI boundary. The workbench polls `/api/pipeline/status` and lists discovery records, but the launch endpoint currently blocks until the runner exits.

## Goals / Non-Goals

**Goals:**

- Make discovery launch feel immediate even for multi-minute Codex CLI runs.
- Give the user durable progress context: active run id, elapsed time, stale guidance, and structured diagnostics.
- Reduce noise by defaulting to high-signal source packs and high-value discovered records.
- Keep scoring deterministic and testable.

**Non-Goals:**

- No cancel endpoint in this pass.
- No LLM-based triage.
- No inspection or editing of Codex CLI `config.toml`.
- No raw stdout/stderr exposure through browser APIs.

## Decisions

### 1. Async start with background finalization

`POST /api/pipeline/discovery/run` creates the running pipeline record and returns `202 { run }` immediately. The route starts a background task that calls `runCodexSkill`, then finalizes the same run as succeeded or failed. Duplicate active discovery protection remains in `startDiscoveryRunRecord`.

### 2. Source-pack scoped input

The route accepts `{ sourcePackIds?: string[] }`. If supplied, ids must exist and be enabled. Valid ids are passed to the runner input as `source_pack_ids`. The discovery skill instructions must say that `source_pack_ids` restricts the source packs read from `.curation/source-packs`.

### 3. Deterministic value score

The backend decorates discovery-record responses with `value_score` and `value_reasons`. Scoring uses existing fields only: status, duplicate status, confidence, source pack, source type, trajectories, title keywords, and errors. Failed records receive low scores and stay visible through failure filters.

### 4. Sanitized run summary

`GET /api/pipeline/runs/:runId/discovery-summary` reads only structured JSON files from `.curation/agent-outputs/<runId>`: `status.json`, `discovery-summary.json`, and `diagnostics.json`. It returns a compact object containing status, counts, source-pack summaries, RSS diagnostics, and web-search skipped/configured state. It must not read or return raw stdout/stderr.

### 5. Workbench UX

The default run preset is `High-signal quick run`, using `provider-labs`, `infra-commercial`, and `china-ai-watch`. Users can choose `All enabled packs` or `Custom`. The candidate queue defaults to high-value records and offers `High value`, `All`, and `Failures` tabs.

## Risks / Trade-offs

- In-memory background work is enough for the local backend, but if the process exits mid-run, a stale running record may remain. The UI should surface existing stale guidance rather than adding cancellation now.
- Source-pack defaults depend on local pack ids. If a default pack is absent or disabled, the UI should send only available selected ids.
- Deterministic scoring is intentionally simple; it prioritizes explainability over perfect ranking.
