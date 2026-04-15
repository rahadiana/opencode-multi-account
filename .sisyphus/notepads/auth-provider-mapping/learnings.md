## Learnings
- Provider-mapped accounts (providerAccounts) are now the single source of truth at runtime. Legacy accounts[] are migrated at load-time and no longer drive runtime decisions.
- Migration is idempotent: if legacy config exists, it is migrated to providerAccounts and accounts[] is cleared; repeated runs should not duplicate data.
- Rotation is strictly provider-scoped: switch only within the current provider's pool; cross-provider fallback is disabled during rotation.
- Exhaustion handling is provider-aware: when a provider pool exhausts, the plugin stops with a clear, provider-specific error notification.
- Removed the runtime smoke demo to avoid stale validation paths; runtime verification is performed via TypeScript checks and a runtime smoke flow external to the codebase if needed.
