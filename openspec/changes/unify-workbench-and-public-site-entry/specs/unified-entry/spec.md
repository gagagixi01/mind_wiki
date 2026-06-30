## ADDED Requirements

### Requirement: Unified product entry
The system SHALL provide one primary application entry that exposes public reading and local curation from the same browser shell. The user SHALL not need to launch a separate workbench application to reach curation tools.

The primary browser entry SHALL be `dev:site`. The standalone `dev:workbench` launch path SHALL not be treated as a supported runtime.

#### Scenario: Open the product
- **WHEN** the user opens the product through the primary site entry
- **THEN** the app presents one shell that can navigate to both public reading views and local curation views

### Requirement: Shared navigation context
The system SHALL preserve the current reading or review context when the user switches between public content and curation views.

#### Scenario: Switch between views
- **WHEN** the user opens a weekly brief or event and then switches into a workbench view
- **THEN** the app keeps the selected item available so the user can return to it without starting over

### Requirement: Local-only workbench access
The system SHALL expose workbench controls only when local execution context and local backend access are available.

#### Scenario: Open a published build
- **WHEN** the user opens the published public site
- **THEN** no workbench controls or local curation actions are visible

#### Scenario: Open locally
- **WHEN** the user opens the app in a local environment with the local backend available
- **THEN** the workbench controls appear in the same application shell and can trigger local curation actions

### Requirement: Public export protection
The system SHALL continue to publish only approved content and SHALL exclude drafts, raw extracts, secrets, and local curation state from the public export.

#### Scenario: Build the public site
- **WHEN** the public site is built for publication
- **THEN** the generated output contains approved content only and omits workbench-only state and local files

### Requirement: Backend split preserved
The system SHALL keep backend orchestration, filesystem writes, and local-only integrations in a separate local backend service on `8001`. The unified browser shell SHALL invoke backend APIs instead of implementing curation actions in the browser.

#### Scenario: Trigger a local action
- **WHEN** the user runs a curation action from the unified webpage
- **THEN** the browser sends the request to the local backend and the backend performs the work
