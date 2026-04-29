- T1 keeps global state.currentAccountId as the default pointer while optional sessionId arguments update only per-session mappings in memory for handleRateLimit and switchToAccount.

- T2 keeps non-session fetch handling on explicit defaultPluginState/defaultLastActivity fallback variables and routes session-aware rotation through AccountManager session APIs instead of any last-session singleton.
