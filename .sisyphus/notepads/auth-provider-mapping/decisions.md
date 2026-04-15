## Design Decisions
- Runtime truth: providerAccounts is the primary runtime data path; accounts[] is only a migration boundary and must not influence runtime flow after startup.
- Migration path: Legacy accounts[] are migrated into providerAccounts at load-time; the runtime must always rely on providerAccounts thereafter.
- Rotation scope: Rotations occur strictly within a single provider's pool; there is no cross-provider fallback during rotation.
- Exhaustion signaling: When a provider pool runs out, return a provider-specific exhaustion notification and halt further rotation until a manual or cooldown-based reset occurs.
- Demolished smoke/demo artifacts: Runtime smoke files were removed to prevent drift; verification is done via TypeScript checks and explicit runtime tests elsewhere.
