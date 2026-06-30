## Why

The workbench API settings sheet can test an OpenAI-compatible provider profile, but the result is only visible through the global toast. After the `Test connection` button leaves its `Testing...` state, the sheet itself does not show whether the connection succeeded, failed, or what the backend reported. That makes provider setup feel opaque and forces the user to infer state from a transient message.

## What Changes

- Show a persistent inline connection-test result inside the API settings sheet.
- Reuse the existing provider test endpoint and response shape: `{ ok, status, message }`.
- Show compact feedback: success/failure, status code, backend message, and last-tested time.
- Clear or mark the result stale when the selected profile's Base URL, API key, or Model ID changes.
- Keep raw API keys out of visible result text and avoid any Codex CLI config inspection.

## Capabilities

### New Capabilities

- `visible-provider-test-result`: the workbench API settings sheet shows the latest provider connection test outcome inline.

### Modified Capabilities

- None

## Impact

Affected areas are the site-hosted workbench component, its styling, and Playwright coverage. The backend API contract remains stable, and the Codex CLI boundary is unchanged.
