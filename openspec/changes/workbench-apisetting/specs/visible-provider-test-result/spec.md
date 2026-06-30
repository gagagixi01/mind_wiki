## ADDED Requirements

### Requirement: Inline provider connection test state
The workbench API settings sheet SHALL show the current connection-test state inline for the selected provider profile.

#### Scenario: Test is running
- **WHEN** the user clicks `Test connection`
- **THEN** the API settings sheet shows an inline testing state while the provider test request is in flight

### Requirement: Persistent provider connection test outcome
The workbench API settings sheet SHALL show the latest provider connection-test outcome after the test completes.

#### Scenario: Test succeeds
- **WHEN** the provider test endpoint returns a successful result
- **THEN** the sheet shows a persistent success result with the backend message, status code, and last-tested time

#### Scenario: Test fails
- **WHEN** the provider test endpoint returns a failed result
- **THEN** the sheet shows a persistent failure result with the backend message, status code, and last-tested time

### Requirement: Provider test result invalidation
The workbench API settings sheet SHALL remove the selected profile's prior connection-test result when fields that affect connectivity change.

#### Scenario: Connectivity field changes
- **WHEN** the user edits the selected profile's Base URL, API key, or Model ID
- **THEN** the sheet clears the prior inline connection-test result for that profile

### Requirement: Provider test secret safety
The workbench API settings sheet SHALL NOT render raw API keys in inline connection-test results.

#### Scenario: Test result is displayed
- **WHEN** the sheet displays a testing, success, or failure result
- **THEN** the result text does not include the profile's raw API key
