## Context

The API settings sheet already lets the user configure up to three workbench-only OpenAI-compatible provider profiles. The backend test route returns a compact result with `ok`, `status`, and `message`, and the UI currently copies that message into the global toast.

The gap is local visibility: once the button stops saying `Testing...`, the sheet has no durable result surface. This is especially confusing for failed tests, because the user needs to know whether authentication, URL reachability, compatibility, or timeout failed.

## Goals / Non-Goals

**Goals:**

- Show the latest connection-test outcome inline in the API settings sheet.
- Keep the result compact and safe: no raw API keys, no request body, no response body.
- Preserve the existing backend route and response shape.
- Make changed profile fields invalidate the prior result.
- Keep the result accessible to screen readers.

**Non-Goals:**

- Add provider diagnostics beyond the existing backend message.
- Persist test results to `.curation`.
- Add Codex CLI config visibility or controls.
- Change provider-settings save behavior.

## Decisions

### 1. Store test result as local UI state

The result should live in React state keyed by profile slot. It does not need to be written to disk because it describes the last interactive test, not durable provider configuration.

Each profile can have one latest result state: `idle`, `testing`, `success`, or `failure`. Success and failure include the backend `status`, backend `message`, and a `testedAt` timestamp.

### 2. Render an inline compact result panel

Place the result panel near the `Test connection` button. It should show:

- `Testing connection...` while the request is in flight.
- `Connection succeeded` or `Connection failed` after the response.
- `Status <number>`.
- The backend message.
- `Last tested <local time>`.

Use existing callout styling and add only small tone-specific variants if needed.

### 3. Invalidate result on meaningful profile edits

When the user edits Base URL, API key, or Model ID for the selected profile, clear the prior result for that profile. Editing the display label does not invalidate the connection result.

### 4. Preserve the current API contract

The UI should continue calling `POST /api/workbench/provider-settings/test`. Failed HTTP responses from the route are still parsed by `fetchJson`, so the UI should convert thrown errors into an inline failure result with a generic status of `0` when no numeric status is available.

## Risks / Trade-offs

- Multiple live regions can confuse tests and screen readers, so the inline panel should use `aria-live="polite"` without replacing the existing global toast role.
- The timestamp can vary by locale; tests should assert the presence of the `Last tested` label rather than a full formatted string.
- The result may become stale after edits, so clearing on provider-critical field changes is simpler and less ambiguous than showing a stale warning.
