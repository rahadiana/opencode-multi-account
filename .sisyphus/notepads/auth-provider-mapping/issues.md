## Open Issues
- Ensure providerAccounts remains the sole runtime decision path; confirm all code paths avoid legacy accounts[] during operation.
- Validate that exhaustion notifications are provider-specific and do not erroneously trigger cross-provider fallbacks.
- Confirm migration from accounts[] to providerAccounts is idempotent across reloads and restarts.
- Remove any leftover demos/smoke references from the runtime to prevent drift with the plan.
