## Why

The current product is split between a public website and a separate local workbench, which creates two entry points for one personal workflow. Since this project is built for a single user, we can simplify the experience by unifying reading and curation into one place and removing the context-switching overhead of a separate workbench app.

## What Changes

- Merge the workbench experience into the main website entry so the product opens through one unified UI shell on the site port.
- Keep public reading and local curation in the same navigation model instead of separate apps and separate mental models, while leaving backend orchestration in a separate local service.
- Preserve the distinction between approved public content, local-only curation state, and the backend API boundary, but expose both through one entry path.
- Remove the expectation that the workbench is a separate day-to-day app for normal use.
- **BREAKING**: scripts, routes, and documentation that assume a standalone workbench entry will change, and `dev:site` becomes the supported browser entry while the standalone workbench port is retired from the supported workflow.

## Capabilities

### New Capabilities
- `unified-entry`: one application entry that combines public reading and local workbench actions in a single interface.

### Modified Capabilities

- None

## Impact

Affected areas include `apps/site`, `apps/workbench`, root scripts, test coverage, routing/navigation, and documentation. The unified entry will likely change local dev commands and how the UI distinguishes public content from local-only curation state, while keeping secrets and unpublished artifacts out of the public surface. The browser entry should consolidate onto the site port while the backend remains split out as a local API service.
